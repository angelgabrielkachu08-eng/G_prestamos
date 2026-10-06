-- Eliminación definitiva desde la papelera, conservando movimientos de caja.
-- Solo el propietario autenticado puede purgar un cliente que ya archivó.
create or replace function public.eliminar_cliente_permanente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada';
  end if;

  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and owner_id = auth.uid() and eliminado = true
  ) then
    raise exception 'El cliente no está en tu papelera';
  end if;

  -- El detalle se elimina con la venta; el préstamo se borra explícitamente.
  -- La caja conserva el concepto y el importe gracias a sus referencias SET NULL.
  delete from public.ventas
    where cliente_id = p_cliente_id and owner_id = auth.uid();
  delete from public.prestamos
    where cliente_id = p_cliente_id and owner_id = auth.uid();
  delete from public.clientes
    where id = p_cliente_id and owner_id = auth.uid() and eliminado = true;
end;
$$;

revoke all on function public.eliminar_cliente_permanente(uuid) from public, anon;
grant execute on function public.eliminar_cliente_permanente(uuid) to authenticated;
