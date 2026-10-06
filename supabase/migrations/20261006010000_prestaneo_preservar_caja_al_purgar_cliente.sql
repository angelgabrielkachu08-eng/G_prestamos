-- Preserve cash ledger entries when a customer and their related records are
-- permanently removed from the trash. The descriptive marker also satisfies
-- the caja check after the FK references are set to null.
alter table public.caja drop constraint if exists caja_entrada_check;
alter table public.caja drop constraint if exists caja_check;
alter table public.caja add constraint caja_entrada_check
  check (
    (tipo = 'entrada' and (
      pago_id is not null
      or venta_id is not null
      or concepto like 'Histórico preservado · %'
    ))
    or tipo <> 'entrada'
  );

create or replace function public.eliminar_cliente_permanente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada';
  end if;

  select nombre_completo into v_nombre
  from public.clientes
  where id = p_cliente_id
    and owner_id = auth.uid()
    and eliminado = true
  for update;

  if not found then
    raise exception 'El cliente no está en tu papelera';
  end if;

  -- Keep amounts and movement types for cash totals while preserving who and
  -- what the transaction referred to after customer-linked rows are removed.
  update public.caja m
  set concepto = format('Histórico preservado · %s · %s', v_nombre, m.concepto)
  where m.owner_id = auth.uid()
    and m.concepto not like 'Histórico preservado · %'
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
