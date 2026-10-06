-- Upgrade the existing empty prestamos-app schema in place; retain existing tables/FKs.
create extension if not exists pgcrypto;
do $$
begin
  if exists (select 1 from public.clientes) or exists (select 1 from public.prestamos) or exists (select 1 from public.cuotas) then
    raise exception 'Existing records found. Assign owner_id values before applying tenant isolation.';
  end if;
end;
$$;

alter table public.clientes rename column dni_identificacion to documento;
alter table public.prestamos rename column monto_principal to capital;
alter table public.prestamos rename column modalidad_pago to frecuencia;
alter table public.prestamos rename column total_cuotas to cantidad_cuotas;
alter table public.cuotas rename column numero_cuota to numero;
alter table public.cuotas rename column monto_cuota to monto;
alter table public.cuotas rename column capital_cuota to capital;
alter table public.cuotas rename column interes_cuota to interes;

alter table public.clientes alter column documento drop not null;
alter table public.clientes add column owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table public.clientes add column nivel_riesgo text not null default 'medio' check (nivel_riesgo in ('bajo','medio','alto'));
alter table public.clientes add column score_crediticio integer check (score_crediticio between 300 and 850);
alter table public.clientes add column documento_path text;
alter table public.clientes add column notas text;
alter table public.clientes add column updated_at timestamptz not null default now();
alter table public.clientes drop constraint clientes_dni_identificacion_key;
alter table public.clientes add constraint clientes_owner_documento_key unique(owner_id, documento);

alter table public.prestamos add column owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table public.prestamos add column referencia text not null default ('LN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
alter table public.prestamos add column fecha_desembolso date not null default current_date;
alter table public.prestamos add column omitir_domingo boolean not null default false;
alter table public.prestamos add column updated_at timestamptz not null default now();
alter table public.prestamos alter column cliente_id set not null;
alter table public.prestamos alter column capital type numeric(14,2) using capital::numeric;
alter table public.prestamos alter column tasa_interes type numeric(7,4) using tasa_interes::numeric;
alter table public.prestamos alter column total_interes type numeric(14,2) using total_interes::numeric;
update public.prestamos set total_a_pagar = capital + total_interes where total_a_pagar is null;
alter table public.prestamos alter column total_a_pagar set not null;
alter table public.prestamos drop constraint prestamos_estado_check;
alter table public.prestamos drop constraint prestamos_modalidad_pago_check;
alter table public.prestamos add constraint prestamos_frecuencia_check check (frecuencia in ('diario','semanal','quincenal','mensual'));
alter table public.prestamos add constraint prestamos_estado_check check (estado in ('activo','pagado','en_mora','cancelado'));
alter table public.prestamos add constraint prestamos_owner_referencia_key unique(owner_id, referencia);

alter table public.cuotas add column owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table public.cuotas add column pagada_at timestamptz;
alter table public.cuotas alter column prestamo_id set not null;
alter table public.cuotas alter column fecha_vencimiento set not null;
alter table public.cuotas alter column capital type numeric(14,2) using capital::numeric;
alter table public.cuotas alter column interes type numeric(14,2) using interes::numeric;
alter table public.cuotas alter column monto type numeric(14,2) using monto::numeric;
alter table public.cuotas add constraint cuotas_prestamo_numero_key unique(prestamo_id, numero);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cuota_id uuid not null references public.cuotas(id) on delete cascade,
  referencia text not null,
  monto numeric(14,2) not null check (monto > 0),
  capital numeric(14,2) not null default 0 check (capital >= 0),
  interes numeric(14,2) not null default 0 check (interes >= 0),
  metodo text not null default 'efectivo' check (metodo in ('efectivo','transferencia','otro')),
  recibido_at timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now(),
  unique(owner_id, referencia)
);
create table public.caja (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pago_id uuid references public.pagos(id) on delete set null,
  prestamo_id uuid references public.prestamos(id) on delete set null,
  tipo text not null check (tipo in ('entrada','salida','ajuste')),
  concepto text not null,
  monto numeric(14,2) not null check (monto > 0),
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((tipo = 'entrada' and pago_id is not null) or tipo <> 'entrada')
);

create index clientes_owner_nombre_idx on public.clientes(owner_id, nombre_completo);
create index prestamos_owner_estado_idx on public.prestamos(owner_id, estado);
create index cuotas_owner_vencimiento_idx on public.cuotas(owner_id, fecha_vencimiento, estado);
create index cuotas_prestamo_idx on public.cuotas(prestamo_id, numero);
create index pagos_owner_fecha_idx on public.pagos(owner_id, recibido_at desc);
create index caja_owner_fecha_idx on public.caja(owner_id, fecha desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger clientes_updated_at before update on public.clientes for each row execute function public.set_updated_at();
create trigger prestamos_updated_at before update on public.prestamos for each row execute function public.set_updated_at();

create or replace function public.validar_cliente_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.clientes c where c.id = new.cliente_id and c.owner_id = new.owner_id) then
    raise exception 'Cliente no disponible para este usuario';
  end if;
  return new;
end;
$$;
create trigger prestamos_cliente_tenant before insert or update of cliente_id, owner_id on public.prestamos for each row execute function public.validar_cliente_tenant();

create or replace function public.validar_prestamo_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.prestamos p where p.id = new.prestamo_id and p.owner_id = new.owner_id) then
    raise exception 'Préstamo no disponible para este usuario';
  end if;
  return new;
end;
$$;
create trigger cuotas_prestamo_tenant before insert or update of prestamo_id, owner_id on public.cuotas for each row execute function public.validar_prestamo_tenant();

create or replace function public.validar_cuota_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.cuotas c where c.id = new.cuota_id and c.owner_id = new.owner_id) then
    raise exception 'Cuota no disponible para este usuario';
  end if;
  return new;
end;
$$;
create trigger pagos_cuota_tenant before insert or update of cuota_id, owner_id on public.pagos for each row execute function public.validar_cuota_tenant();

create or replace function public.registrar_pago_en_caja()
returns trigger language plpgsql set search_path = public as $$
declare v_cuota public.cuotas%rowtype;
begin
  select * into v_cuota from public.cuotas where id = new.cuota_id for update;
  if not found or v_cuota.owner_id <> new.owner_id then raise exception 'Cuota no disponible para este usuario'; end if;
  if v_cuota.monto_pagado + new.monto > v_cuota.monto then raise exception 'El pago excede el saldo de la cuota'; end if;
  update public.cuotas
    set monto_pagado = monto_pagado + new.monto,
        estado = case when monto_pagado + new.monto >= monto then 'pagada' else 'parcial' end,
        pagada_at = case when monto_pagado + new.monto >= monto then now() else null end
    where id = v_cuota.id;
  update public.prestamos p set estado = 'pagado'
    where p.id = v_cuota.prestamo_id
      and not exists (select 1 from public.cuotas c where c.prestamo_id = p.id and c.estado <> 'pagada');
  insert into public.caja(owner_id, pago_id, tipo, concepto, monto)
    values (new.owner_id, new.id, 'entrada', 'Cobro ' || new.referencia, new.monto);
  return new;
end;
$$;
create trigger pago_actualiza_cuota_caja after insert on public.pagos for each row execute function public.registrar_pago_en_caja();

create or replace function public.registrar_desembolso_en_caja()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.caja(owner_id, prestamo_id, tipo, concepto, monto)
    values (new.owner_id, new.id, 'salida', 'Desembolso ' || new.referencia, new.capital);
  return new;
end;
$$;
create trigger prestamo_desembolso_caja after insert on public.prestamos for each row execute function public.registrar_desembolso_en_caja();

create or replace function public.emitir_prestamo(p_cliente jsonb, p_prestamo jsonb, p_cuotas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_cliente public.clientes%rowtype;
  v_prestamo public.prestamos%rowtype;
  v_cuotas jsonb;
begin
  insert into public.clientes(owner_id, nombre_completo, documento, telefono, direccion, nivel_riesgo)
  values (auth.uid(), p_cliente->>'nombre_completo', nullif(p_cliente->>'documento',''), p_cliente->>'telefono', nullif(p_cliente->>'direccion',''), coalesce(p_cliente->>'nivel_riesgo','medio'))
  returning * into v_cliente;
  insert into public.prestamos(owner_id, cliente_id, referencia, capital, tasa_interes, total_interes, total_a_pagar, cantidad_cuotas, frecuencia, omitir_domingo, fecha_desembolso)
  values (auth.uid(), v_cliente.id, p_prestamo->>'referencia', (p_prestamo->>'capital')::numeric, (p_prestamo->>'tasa_interes')::numeric, (p_prestamo->>'total_interes')::numeric, (p_prestamo->>'total_a_pagar')::numeric, (p_prestamo->>'cantidad_cuotas')::integer, p_prestamo->>'frecuencia', coalesce((p_prestamo->>'omitir_domingo')::boolean,false), coalesce((p_prestamo->>'fecha_desembolso')::date,current_date))
  returning * into v_prestamo;
  insert into public.cuotas(owner_id, prestamo_id, numero, fecha_vencimiento, capital, interes, monto)
  select auth.uid(), v_prestamo.id, (item.value->>'numero')::integer, (item.value->>'fecha_vencimiento')::date, (item.value->>'capital')::numeric, (item.value->>'interes')::numeric, (item.value->>'monto')::numeric
  from jsonb_array_elements(p_cuotas) as item(value);
  select coalesce(jsonb_agg(to_jsonb(c) order by c.numero), '[]'::jsonb) into v_cuotas from public.cuotas c where c.prestamo_id = v_prestamo.id;
  return jsonb_build_object('cliente_id', v_cliente.id, 'prestamo_id', v_prestamo.id, 'cuotas', v_cuotas);
end;
$$;

alter table public.clientes enable row level security;
alter table public.prestamos enable row level security;
alter table public.cuotas enable row level security;
alter table public.pagos enable row level security;
alter table public.caja enable row level security;
create policy "clientes aislados por usuario" on public.clientes for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "prestamos aislados por usuario" on public.prestamos for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "cuotas aisladas por usuario" on public.cuotas for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "pagos aislados por usuario" on public.pagos for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "caja aislada por usuario" on public.caja for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on table public.clientes, public.prestamos, public.cuotas, public.pagos, public.caja from anon;
grant select, insert, update, delete on public.clientes, public.prestamos, public.cuotas, public.pagos, public.caja to authenticated;
revoke all on function public.emitir_prestamo(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.emitir_prestamo(jsonb, jsonb, jsonb) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-clientes', 'documentos-clientes', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;
create policy "leer documentos propios" on storage.objects for select to authenticated using (bucket_id = 'documentos-clientes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "subir documentos propios" on storage.objects for insert to authenticated with check (bucket_id = 'documentos-clientes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "actualizar documentos propios" on storage.objects for update to authenticated using (bucket_id = 'documentos-clientes' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'documentos-clientes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eliminar documentos propios" on storage.objects for delete to authenticated using (bucket_id = 'documentos-clientes' and (storage.foldername(name))[1] = (select auth.uid())::text);
