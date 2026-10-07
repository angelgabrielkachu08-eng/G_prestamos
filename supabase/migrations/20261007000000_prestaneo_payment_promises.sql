-- Promesas de pago asociadas a una cuota, con historial auditable.
create table if not exists public.promesas_pago (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cuota_id uuid not null references public.cuotas(id) on delete cascade,
  fecha_promesa date not null,
  nota text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'cumplida', 'cancelada')),
  created_at timestamptz not null default now()
);

create index if not exists promesas_pago_owner_fecha_idx
  on public.promesas_pago(owner_id, fecha_promesa, estado);
create index if not exists promesas_pago_cuota_fecha_idx
  on public.promesas_pago(cuota_id, created_at desc);

alter table public.promesas_pago enable row level security;
drop policy if exists "promesas_pago lectura propia" on public.promesas_pago;
create policy "promesas_pago lectura propia"
  on public.promesas_pago for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "promesas_pago alta propia" on public.promesas_pago;
create policy "promesas_pago alta propia"
  on public.promesas_pago for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "promesas_pago actualización propia" on public.promesas_pago;
create policy "promesas_pago actualización propia"
  on public.promesas_pago for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
revoke all on public.promesas_pago from anon;
grant select, insert, update on public.promesas_pago to authenticated;

create or replace function public.validar_promesa_pago_tenant()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cuotas q
    where q.id = new.cuota_id and q.owner_id = new.owner_id
  ) then
    raise exception 'Cuota no disponible para registrar la promesa';
  end if;
  if tg_op = 'INSERT' then
    update public.promesas_pago
      set estado = 'cancelada'
      where cuota_id = new.cuota_id
        and owner_id = new.owner_id
        and estado = 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists promesas_pago_validar_tenant on public.promesas_pago;
create trigger promesas_pago_validar_tenant
  before insert or update of cuota_id, owner_id on public.promesas_pago
  for each row execute function public.validar_promesa_pago_tenant();

create or replace function public.cumplir_promesas_pago_cuota()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.estado = 'pagada' and old.estado <> 'pagada' then
    update public.promesas_pago
      set estado = 'cumplida'
      where cuota_id = new.id and owner_id = new.owner_id and estado = 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists cuota_cumple_promesas_pago on public.cuotas;
create trigger cuota_cumple_promesas_pago
  after update of estado on public.cuotas
  for each row execute function public.cumplir_promesas_pago_cuota();
