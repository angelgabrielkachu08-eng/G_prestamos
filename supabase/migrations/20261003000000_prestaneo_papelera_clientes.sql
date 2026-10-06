-- ═══════════════════════════════════════════════════════════════
-- PrestaNeo — Papelera de clientes
-- Agrega columna `eliminado` + `eliminado_at` a clientes.
-- Los clientes "eliminados" pasan a papelera, no se borran.
-- ═══════════════════════════════════════════════════════════════

alter table public.clientes
  add column if not exists eliminado    boolean   not null default false,
  add column if not exists eliminado_at timestamptz;

-- Índice para filtrar activos rápidamente
create index if not exists clientes_eliminado_idx
  on public.clientes(owner_id, eliminado);

-- Función para "eliminar" (mover a papelera)
create or replace function public.archivar_cliente(p_cliente_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.clientes
    set eliminado = true, eliminado_at = now()
    where id = p_cliente_id and owner_id = auth.uid();
end;
$$;

-- Función para restaurar desde papelera
create or replace function public.restaurar_cliente(p_cliente_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.clientes
    set eliminado = false, eliminado_at = null
    where id = p_cliente_id and owner_id = auth.uid();
end;
$$;

-- Permisos
revoke all on function public.archivar_cliente(uuid)  from public, anon;
revoke all on function public.restaurar_cliente(uuid) from public, anon;
grant execute on function public.archivar_cliente(uuid)  to authenticated;
grant execute on function public.restaurar_cliente(uuid) to authenticated;

comment on column public.clientes.eliminado    is 'true = cliente en papelera, no aparece en vistas activas';
comment on column public.clientes.eliminado_at is 'Fecha en que fue movido a la papelera';
