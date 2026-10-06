-- Crea cliente, préstamo, cuotas y movimiento de caja en una transacción.
-- Evita clientes huérfanos, desembolsos duplicados y operaciones incompletas.
create or replace function public.crear_prestamo_atomico(
  p_cliente jsonb,
  p_prestamo jsonb,
  p_cuotas jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_cliente public.clientes%rowtype;
  v_prestamo public.prestamos%rowtype;
  v_cuotas jsonb;
  v_movimiento_id uuid;
  v_documento text := nullif(btrim(p_cliente->>'documento'), '');
  v_reutilizado boolean := false;
begin
  if v_owner is null then
    raise exception 'Debes iniciar sesión para crear un préstamo';
  end if;
  if jsonb_typeof(p_cuotas) <> 'array'
     or jsonb_array_length(p_cuotas) <> coalesce((p_prestamo->>'cantidad_cuotas')::integer, 0)
     or jsonb_array_length(p_cuotas) = 0 then
    raise exception 'El cronograma de cuotas no coincide con la cantidad indicada';
  end if;
  if nullif(btrim(p_prestamo->>'referencia'), '') is null then
    raise exception 'Falta la referencia del préstamo';
  end if;

  -- DNI identifica al cliente sin crear duplicados; sin DNI solo reutilizamos
  -- cuando coinciden nombre y teléfono para no fusionar homónimos.
  if v_documento is not null then
    select c.* into v_cliente
    from public.clientes c
    where c.owner_id = v_owner and c.documento = v_documento
    for update;
    v_reutilizado := found;
  elsif nullif(btrim(p_cliente->>'telefono'), '') is not null then
    select c.* into v_cliente
    from public.clientes c
    where c.owner_id = v_owner
      and c.eliminado = false
      and lower(btrim(c.nombre_completo)) = lower(btrim(p_cliente->>'nombre_completo'))
      and btrim(coalesce(c.telefono, '')) = btrim(p_cliente->>'telefono')
    order by c.created_at desc
    limit 1
    for update;
    v_reutilizado := found;
  end if;

  if v_reutilizado and v_cliente.eliminado then
    raise exception 'El cliente está en la papelera. Restáuralo antes de crearle un préstamo';
  elsif v_reutilizado then
    update public.clientes
    set nombre_completo = coalesce(nullif(btrim(p_cliente->>'nombre_completo'), ''), nombre_completo),
        telefono = coalesce(p_cliente->>'telefono', telefono),
        direccion = coalesce(nullif(p_cliente->>'direccion', ''), direccion),
        nivel_riesgo = coalesce(nullif(p_cliente->>'nivel_riesgo', ''), nivel_riesgo)
    where id = v_cliente.id
    returning * into v_cliente;
  else
    insert into public.clientes(
      owner_id, nombre_completo, documento, telefono, direccion, nivel_riesgo
    ) values (
      v_owner,
      nullif(btrim(p_cliente->>'nombre_completo'), ''),
      v_documento,
      coalesce(p_cliente->>'telefono', ''),
      nullif(p_cliente->>'direccion', ''),
      coalesce(nullif(p_cliente->>'nivel_riesgo', ''), 'medio')
    ) returning * into v_cliente;
  end if;

  insert into public.prestamos(
    owner_id, cliente_id, referencia, capital, tasa_interes,
    total_interes, total_a_pagar, monto_cuota, cantidad_cuotas,
    frecuencia, omitir_domingo, fecha_desembolso, estado
  ) values (
    v_owner, v_cliente.id, p_prestamo->>'referencia',
    (p_prestamo->>'capital')::numeric,
    (p_prestamo->>'tasa_interes')::numeric,
    (p_prestamo->>'total_interes')::numeric,
    (p_prestamo->>'total_a_pagar')::numeric,
    (p_prestamo->>'monto_cuota')::numeric,
    (p_prestamo->>'cantidad_cuotas')::integer,
    p_prestamo->>'frecuencia',
    coalesce((p_prestamo->>'omitir_domingo')::boolean, false),
    coalesce((p_prestamo->>'fecha_desembolso')::date, current_date),
    'activo'
  ) returning * into v_prestamo;

  insert into public.cuotas(
    owner_id, prestamo_id, numero, fecha_vencimiento,
    capital, interes, monto, monto_pagado, estado
  )
  select
    v_owner,
    v_prestamo.id,
    (item.value->>'numero_cuota')::integer,
    (item.value->>'fecha_vencimiento')::date,
    (item.value->>'capital_cuota')::numeric,
    (item.value->>'interes_cuota')::numeric,
    (item.value->>'monto_cuota')::numeric,
    0,
    'pendiente'
  from jsonb_array_elements(p_cuotas) as item(value);

  -- El trigger prestamo_desembolso_en_caja registra exactamente un egreso.
  select c.id into v_movimiento_id
  from public.caja c
  where c.owner_id = v_owner and c.prestamo_id = v_prestamo.id and c.tipo = 'salida'
  order by c.created_at desc
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.numero), '[]'::jsonb)
  into v_cuotas
  from public.cuotas c where c.prestamo_id = v_prestamo.id;

  return jsonb_build_object(
    'cliente_id', v_cliente.id,
    'prestamo_id', v_prestamo.id,
    'cuotas', v_cuotas,
    'movimiento_caja_id', v_movimiento_id
  );
end;
$$;

revoke all on function public.crear_prestamo_atomico(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.crear_prestamo_atomico(jsonb, jsonb, jsonb) to authenticated;

-- La caja mantiene un historial auditable: las correcciones anulan/restauran
-- movimientos y no destruyen el vínculo con pagos, préstamos o ventas.
alter table public.caja
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references auth.users(id) on delete set null,
  add column if not exists anulado_motivo text;

create index if not exists caja_owner_anulado_fecha_idx
  on public.caja(owner_id, anulado_at, fecha desc);

create table if not exists public.caja_eventos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  movimiento_id uuid not null references public.caja(id) on delete cascade,
  accion text not null check (accion in ('anulacion', 'restauracion')),
  motivo text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists caja_eventos_owner_movimiento_fecha_idx
  on public.caja_eventos(owner_id, movimiento_id, created_at desc);
alter table public.caja_eventos enable row level security;
drop policy if exists "eventos caja aislados por usuario" on public.caja_eventos;
create policy "eventos caja aislados por usuario" on public.caja_eventos
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
revoke all on table public.caja_eventos from anon;
grant select, insert on table public.caja_eventos to authenticated;

create or replace function public.anular_movimientos_caja(
  p_ids uuid[] default null,
  p_scope text default null,
  p_motivo text default 'Anulado desde Caja'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer := 0;
  v_reason text := coalesce(nullif(btrim(p_motivo), ''), 'Anulado desde Caja');
begin
  if v_owner is null then raise exception 'Debes iniciar sesión'; end if;
  if p_scope is not null and p_scope not in ('prestamos', 'ventas') then
    raise exception 'Alcance de Caja inválido';
  end if;
  if p_scope is null and coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'Selecciona al menos un movimiento';
  end if;

  with updated as (
    update public.caja m
    set anulado_at = now(), anulado_por = v_owner, anulado_motivo = v_reason
    where m.owner_id = v_owner
      and m.anulado_at is null
      and (
        (p_scope is null and m.id = any(p_ids))
        or (p_scope = 'ventas' and (
          m.venta_id is not null
          or exists (
            select 1 from public.pagos pg
            join public.cuotas q on q.id = pg.cuota_id
            join public.prestamos pr on pr.id = q.prestamo_id
            where pg.id = m.pago_id and pr.origen = 'venta'
          )
          or m.concepto like '%CV-%'
          or m.concepto like 'Anticipo venta%'
        ))
        or (p_scope = 'prestamos' and not (
          m.venta_id is not null
          or exists (
            select 1 from public.pagos pg
            join public.cuotas q on q.id = pg.cuota_id
            join public.prestamos pr on pr.id = q.prestamo_id
            where pg.id = m.pago_id and pr.origen = 'venta'
          )
          or m.concepto like '%CV-%'
          or m.concepto like 'Anticipo venta%'
        ))
      )
    returning m.id
  ), logged as (
    insert into public.caja_eventos(owner_id, movimiento_id, accion, motivo, actor_id)
    select v_owner, updated.id, 'anulacion', v_reason, v_owner from updated
    returning id
  )
  select count(*)::integer into v_count from logged;
  return v_count;
end;
$$;

create or replace function public.restaurar_movimiento_caja(p_movimiento_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer := 0;
begin
  if v_owner is null then raise exception 'Debes iniciar sesión'; end if;
  update public.caja
  set anulado_at = null,
      anulado_por = null,
      anulado_motivo = null
  where id = p_movimiento_id
    and owner_id = v_owner
    and anulado_at is not null;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.caja_eventos(owner_id, movimiento_id, accion, motivo, actor_id)
    values (v_owner, p_movimiento_id, 'restauracion', 'Restaurado desde Caja', v_owner);
  end if;
  return v_count > 0;
end;
$$;

revoke all on function public.anular_movimientos_caja(uuid[], text, text) from public, anon;
revoke all on function public.restaurar_movimiento_caja(uuid) from public, anon;
grant execute on function public.anular_movimientos_caja(uuid[], text, text) to authenticated;
grant execute on function public.restaurar_movimiento_caja(uuid) to authenticated;
