-- A permanent customer deletion also removes their linked accounting data so
-- deleted customers no longer contribute to cash or collection statistics.
-- Clean up orphan rows left by the earlier preservation migration first.
delete from public.caja
where concepto like 'Histórico preservado · %'
   or (tipo = 'entrada' and pago_id is null and venta_id is null);

-- Restore the normal invariant: every income must reference its payment or sale.
alter table public.caja drop constraint if exists caja_entrada_check;
alter table public.caja drop constraint if exists caja_check;
alter table public.caja add constraint caja_entrada_check
  check (
    (tipo = 'entrada' and (pago_id is not null or venta_id is not null))
    or tipo <> 'entrada'
  );

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

  perform 1
  from public.clientes
  where id = p_cliente_id
    and owner_id = auth.uid()
    and eliminado = true
  for update;

  if not found then
    raise exception 'El cliente no está en tu papelera';
  end if;

  -- Delete related cash entries before their payment, loan and sale foreign
  -- keys are removed. This keeps caja constraints valid and removes the
  -- amounts from cash, collection and monthly revenue statistics.
  delete from public.caja m
  where m.owner_id = auth.uid()
    and (
      m.venta_id in (
        select v.id from public.ventas v
        where v.cliente_id = p_cliente_id and v.owner_id = auth.uid()
      )
      or m.prestamo_id in (
        select p.id from public.prestamos p
        where p.cliente_id = p_cliente_id and p.owner_id = auth.uid()
      )
      or m.pago_id in (
        select pg.id
        from public.pagos pg
        join public.cuotas q on q.id = pg.cuota_id
        join public.prestamos p on p.id = q.prestamo_id
        where p.cliente_id = p_cliente_id and p.owner_id = auth.uid()
      )
    );

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
