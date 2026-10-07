-- Historial de inventario para ingresos, salidas manuales y ventas.
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  venta_id uuid references public.ventas(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'salida', 'venta')),
  cantidad integer not null check (cantidad > 0),
  stock_anterior integer not null check (stock_anterior >= 0),
  stock_resultante integer not null check (stock_resultante >= 0),
  motivo text not null,
  created_at timestamptz not null default now(),
  constraint movimientos_stock_consistencia check (
    (tipo = 'entrada' and stock_resultante = stock_anterior + cantidad)
    or (tipo in ('salida', 'venta') and stock_resultante = stock_anterior - cantidad)
  )
);

create index if not exists movimientos_stock_owner_fecha_idx
  on public.movimientos_stock(owner_id, created_at desc);
create index if not exists movimientos_stock_producto_fecha_idx
  on public.movimientos_stock(producto_id, created_at desc);

alter table public.movimientos_stock enable row level security;
drop policy if exists "movimientos_stock lectura propia" on public.movimientos_stock;
create policy "movimientos_stock lectura propia"
  on public.movimientos_stock for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "movimientos_stock inserción propia" on public.movimientos_stock;
create policy "movimientos_stock inserción propia"
  on public.movimientos_stock for insert to authenticated
  with check ((select auth.uid()) = owner_id);
revoke all on public.movimientos_stock from anon;
grant select, insert on public.movimientos_stock to authenticated;

-- El movimiento y el nuevo saldo se registran dentro de una sola transacción.
create or replace function public.registrar_movimiento_stock(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad integer,
  p_motivo text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock_anterior integer;
  v_stock_resultante integer;
  v_movimiento_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para actualizar el inventario';
  end if;
  if p_tipo not in ('entrada', 'salida') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser un entero mayor a cero';
  end if;

  select stock into v_stock_anterior
    from public.productos
    where id = p_producto_id and owner_id = auth.uid() and activo = true
    for update;
  if not found then
    raise exception 'No encontramos ese producto en tu catálogo';
  end if;
  if p_tipo = 'salida' and p_cantidad > v_stock_anterior then
    raise exception 'No podés retirar más unidades que las disponibles (%)', v_stock_anterior;
  end if;

  v_stock_resultante := v_stock_anterior + case when p_tipo = 'entrada' then p_cantidad else -p_cantidad end;
  update public.productos set stock = v_stock_resultante
    where id = p_producto_id and owner_id = auth.uid();
  insert into public.movimientos_stock(owner_id, producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo)
    values (auth.uid(), p_producto_id, p_tipo, p_cantidad, v_stock_anterior, v_stock_resultante,
      coalesce(nullif(trim(p_motivo), ''), case when p_tipo = 'entrada' then 'Reposición de inventario' else 'Salida manual de inventario' end))
    returning id into v_movimiento_id;

  return jsonb_build_object('id', v_movimiento_id, 'stock', v_stock_resultante);
end;
$$;

revoke all on function public.registrar_movimiento_stock(uuid, text, integer, text) from public, anon;
grant execute on function public.registrar_movimiento_stock(uuid, text, integer, text) to authenticated;

-- El trigger original ya descontaba unidades, pero no guardaba el movimiento.
-- Esta versión registra el descuento y comprueba stock en la misma transacción.
create or replace function public.descontar_stock_venta()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock_resultante integer;
  v_referencia text;
begin
  update public.productos
    set stock = stock - new.cantidad
    where id = new.producto_id
      and owner_id = new.owner_id
      and stock >= new.cantidad
    returning stock into v_stock_resultante;

  if not found then
    raise exception 'Stock insuficiente para registrar esta venta';
  end if;

  select referencia into v_referencia from public.ventas where id = new.venta_id;
  insert into public.movimientos_stock(
    owner_id, producto_id, venta_id, tipo, cantidad, stock_anterior, stock_resultante, motivo
  ) values (
    new.owner_id, new.producto_id, new.venta_id, 'venta', new.cantidad,
    v_stock_resultante + new.cantidad, v_stock_resultante,
    'Venta ' || coalesce(v_referencia, new.venta_id::text)
  );
  return new;
end;
$$;

alter function public.descontar_stock_venta() set search_path = '';
