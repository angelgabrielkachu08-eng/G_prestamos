-- Cierres de caja por módulo: conserva una foto inmutable de cada período.
create table if not exists public.cierres_caja (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  modulo text not null check (modulo in ('prestamos', 'ventas')),
  desde_at timestamptz not null,
  cerrado_at timestamptz not null default now(),
  resumen jsonb not null default '{}'::jsonb,
  movimientos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (cerrado_at >= desde_at)
);

create index if not exists cierres_caja_owner_modulo_fecha_idx
  on public.cierres_caja(owner_id, modulo, cerrado_at desc);

alter table public.cierres_caja enable row level security;
revoke all on public.cierres_caja from anon, authenticated;
drop policy if exists "cierres de caja visibles por propietario" on public.cierres_caja;
create policy "cierres de caja visibles por propietario"
  on public.cierres_caja for select to authenticated
  using ((select auth.uid()) = owner_id);
grant select on public.cierres_caja to authenticated;

create or replace function public.cerrar_periodo_caja(p_modulo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_inicio timestamptz;
  v_last timestamptz;
  v_entradas numeric(14,2) := 0;
  v_salidas numeric(14,2) := 0;
  v_movimientos jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'Debes iniciar sesión para cerrar caja';
  end if;
  if p_modulo not in ('prestamos', 'ventas') then
    raise exception 'El módulo de caja no es válido';
  end if;

  -- Evita que dos clics simultáneos creen cierres superpuestos.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_modulo, 0));

  select c.cerrado_at into v_last
  from public.cierres_caja c
  where c.owner_id = v_owner and c.modulo = p_modulo
  order by c.cerrado_at desc
  limit 1;

  if v_last is not null then
    v_inicio := v_last;
  else
    -- El primer período comienza al inicio del mes local en Argentina.
    v_inicio := date_trunc('month', v_now at time zone 'America/Argentina/Buenos_Aires')
      at time zone 'America/Argentina/Buenos_Aires';
  end if;

  with periodo as materialized (
    select
      m.id,
      m.tipo,
      m.concepto,
      m.monto,
      m.fecha,
      m.anulado_at,
      m.anulado_motivo,
      coalesce(pr.origen, pm.origen, '') as origen_prestamo,
      coalesce(sv.referencia, pr.referencia, pm.referencia) as referencia,
      cl.nombre_completo as nombre_cliente,
      (m.venta_id is not null
        or coalesce(pr.origen, pm.origen, '') = 'venta'
        or m.concepto ilike 'CV-%'
        or m.concepto ilike 'Anticipo venta%') as es_venta
    from public.caja m
    left join public.pagos pg on pg.id = m.pago_id
    left join public.cuotas q on q.id = pg.cuota_id
    left join public.prestamos pr on pr.id = q.prestamo_id
    left join public.prestamos pm on pm.id = m.prestamo_id
    left join public.ventas sv on sv.id = m.venta_id
    left join public.clientes cl on cl.id = coalesce(pr.cliente_id, pm.cliente_id, sv.cliente_id)
    where m.owner_id = v_owner
      and ((v_last is null and m.fecha >= v_inicio) or (v_last is not null and m.fecha > v_inicio))
      and m.fecha <= v_now
  )
  select
    coalesce(sum(monto) filter (where tipo = 'entrada' and anulado_at is null), 0),
    coalesce(sum(monto) filter (where tipo <> 'entrada' and anulado_at is null), 0),
    count(*),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'label', case
        when nombre_cliente is null then concepto
        when es_venta then 'Venta · ' || nombre_cliente || coalesce(' · ' || referencia, '')
        when tipo = 'entrada' then 'Cobro · ' || nombre_cliente || coalesce(' · ' || referencia, '')
        when tipo = 'salida' then 'Desembolso · ' || nombre_cliente || coalesce(' · ' || referencia, '')
        else concepto
      end,
      'type', case tipo when 'entrada' then 'Entrada' when 'salida' then 'Salida' else 'Ajuste' end,
      'amount', monto,
      'rawDate', fecha,
      'voided', anulado_at is not null,
      'voidReason', coalesce(anulado_motivo, '')
    ) order by fecha, id), '[]'::jsonb)
  into v_entradas, v_salidas, v_count, v_movimientos
  from periodo
  where (p_modulo = 'ventas' and es_venta)
     or (p_modulo = 'prestamos' and not es_venta);

  insert into public.cierres_caja(owner_id, modulo, desde_at, cerrado_at, resumen, movimientos)
  values (
    v_owner,
    p_modulo,
    v_inicio,
    v_now,
    jsonb_build_object(
      'entradas', v_entradas,
      'salidas', v_salidas,
      'neto', v_entradas - v_salidas,
      'movimientos', v_count
    ),
    v_movimientos
  )
  returning jsonb_build_object(
    'id', id,
    'owner_id', owner_id,
    'modulo', modulo,
    'desde_at', desde_at,
    'cerrado_at', cerrado_at,
    'resumen', resumen,
    'movimientos', movimientos,
    'created_at', created_at
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.cerrar_periodo_caja(text) from public, anon;
grant execute on function public.cerrar_periodo_caja(text) to authenticated;
