-- ═══════════════════════════════════════════════════════════════
-- PrestaNeo — Módulo de Ventas a Crédito
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════
-- Este script AGREGA las tablas del módulo de ventas SIN tocar
-- las tablas existentes (clientes, prestamos, cuotas, pagos, caja).
-- Solo modifica la tabla `prestamos` para agregar la columna `origen`.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. AGREGAR COLUMNA ORIGEN A PRESTAMOS
-- Indica si el préstamo/crédito proviene de una venta de producto
-- o de un préstamo de dinero en efectivo.
-- ───────────────────────────────────────────────────────────────
alter table public.prestamos
  add column if not exists origen text not null default 'efectivo'
    check (origen in ('efectivo', 'venta'));

alter table public.prestamos
  add column if not exists venta_id uuid references public.ventas(id) on delete set null;

-- ───────────────────────────────────────────────────────────────
-- 2. TABLA PRODUCTOS (catálogo de artículos)
-- ───────────────────────────────────────────────────────────────
create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  categoria    text not null default 'General'
    check (categoria in ('Electrodoméstico','Mueble','Electrónica','Herramienta','Ropa','Otro','General')),
  precio_contado numeric(14,2) not null check (precio_contado >= 0),
  costo          numeric(14,2) default 0 check (costo >= 0),
  stock          integer not null default 0 check (stock >= 0),
  activo         boolean not null default true,
  imagen_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index productos_owner_idx      on public.productos(owner_id);
create index productos_categoria_idx  on public.productos(owner_id, categoria);
create index productos_activo_idx     on public.productos(owner_id, activo);

create trigger productos_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 3. TABLA VENTAS (cabecera de cada venta a crédito)
-- ───────────────────────────────────────────────────────────────
create table public.ventas (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  referencia       text not null,
  monto_total      numeric(14,2) not null check (monto_total > 0),
  anticipo         numeric(14,2) not null default 0 check (anticipo >= 0),
  monto_financiado numeric(14,2) not null generated always as (monto_total - anticipo) stored,
  fecha_venta      date not null default current_date,
  estado           text not null default 'activo'
    check (estado in ('activo','pagado','cancelado')),
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(owner_id, referencia),
  check (anticipo <= monto_total)
);

create index ventas_owner_idx    on public.ventas(owner_id);
create index ventas_cliente_idx  on public.ventas(cliente_id);
create index ventas_estado_idx   on public.ventas(owner_id, estado);
create index ventas_fecha_idx    on public.ventas(owner_id, fecha_venta desc);

create trigger ventas_updated_at
  before update on public.ventas
  for each row execute function public.set_updated_at();

-- Validar que el cliente pertenece al owner
create or replace function public.validar_cliente_venta_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.clientes c
    where c.id = new.cliente_id and c.owner_id = new.owner_id
  ) then
    raise exception 'Cliente no disponible para este usuario';
  end if;
  return new;
end;
$$;

create trigger ventas_cliente_tenant
  before insert or update of cliente_id, owner_id on public.ventas
  for each row execute function public.validar_cliente_venta_tenant();

-- ───────────────────────────────────────────────────────────────
-- 4. TABLA DETALLE_VENTAS (productos de cada venta)
-- ───────────────────────────────────────────────────────────────
create table public.detalle_ventas (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venta_id        uuid not null references public.ventas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete restrict,
  cantidad        integer not null default 1 check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),
  subtotal        numeric(14,2) not null generated always as (cantidad * precio_unitario) stored,
  created_at      timestamptz not null default now()
);

create index detalle_venta_idx    on public.detalle_ventas(venta_id);
create index detalle_producto_idx on public.detalle_ventas(producto_id);

-- Validar tenant cruzado
create or replace function public.validar_detalle_venta_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.ventas v
    where v.id = new.venta_id and v.owner_id = new.owner_id
  ) then
    raise exception 'Venta no disponible para este usuario';
  end if;
  if not exists (
    select 1 from public.productos p
    where p.id = new.producto_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Producto no disponible para este usuario';
  end if;
  return new;
end;
$$;

create trigger detalle_ventas_tenant
  before insert on public.detalle_ventas
  for each row execute function public.validar_detalle_venta_tenant();

-- Descontar stock al registrar detalle
create or replace function public.descontar_stock_venta()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.productos
    set stock = stock - new.cantidad
    where id = new.producto_id;
  if (select stock from public.productos where id = new.producto_id) < 0 then
    raise exception 'Stock insuficiente para el producto';
  end if;
  return new;
end;
$$;

create trigger stock_descuento
  after insert on public.detalle_ventas
  for each row execute function public.descontar_stock_venta();

-- ───────────────────────────────────────────────────────────────
-- 5. AGREGAR venta_id A PRESTAMOS
--    (FK se puede agregar ahora que la tabla ventas existe)
-- ───────────────────────────────────────────────────────────────
-- Ya fue declarada arriba en el ALTER TABLE inicial.
-- Solo aseguramos el índice:
create index if not exists prestamos_venta_idx on public.prestamos(venta_id);

-- ───────────────────────────────────────────────────────────────
-- 6. RLS EN NUEVAS TABLAS
-- ───────────────────────────────────────────────────────────────
alter table public.productos      enable row level security;
alter table public.ventas         enable row level security;
alter table public.detalle_ventas enable row level security;

-- Políticas productos
create policy "productos aislados por usuario"
  on public.productos for all to authenticated
  using  ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Políticas ventas
create policy "ventas aisladas por usuario"
  on public.ventas for all to authenticated
  using  ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Políticas detalle_ventas
create policy "detalle_ventas aislado por usuario"
  on public.detalle_ventas for all to authenticated
  using  ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- ───────────────────────────────────────────────────────────────
-- 7. PERMISOS
-- ───────────────────────────────────────────────────────────────
revoke all on table public.productos, public.ventas, public.detalle_ventas from anon;
grant select, insert, update, delete
  on public.productos, public.ventas, public.detalle_ventas
  to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 8. FUNCIÓN RPC: emitir_venta_credito
--    Crea cliente (si es nuevo), venta, detalle, préstamo asociado
--    y cuotas en una transacción atómica.
-- ───────────────────────────────────────────────────────────────
create or replace function public.emitir_venta_credito(
  p_cliente  jsonb,  -- { nombre_completo, telefono, documento?, direccion?, nivel_riesgo? }
  p_venta    jsonb,  -- { referencia, monto_total, anticipo, fecha_venta, notas? }
  p_detalles jsonb,  -- [{ producto_id, cantidad, precio_unitario }]
  p_prestamo jsonb,  -- { referencia, capital, tasa_interes, total_interes, total_a_pagar, monto_cuota, cantidad_cuotas, frecuencia, omitir_domingo, fecha_desembolso }
  p_cuotas   jsonb   -- [{ numero, fecha_vencimiento, capital, interes, monto }]
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_cliente_id  uuid;
  v_venta_id    uuid;
  v_prestamo_id uuid;
  v_cuotas_out  jsonb;
begin
  -- 1. Crear o encontrar cliente
  insert into public.clientes(owner_id, nombre_completo, documento, telefono, direccion, nivel_riesgo)
  values (
    auth.uid(),
    p_cliente->>'nombre_completo',
    nullif(p_cliente->>'documento', ''),
    p_cliente->>'telefono',
    nullif(p_cliente->>'direccion', ''),
    coalesce(p_cliente->>'nivel_riesgo', 'medio')
  )
  on conflict (owner_id, documento) do update
    set nombre_completo = excluded.nombre_completo,
        telefono        = excluded.telefono,
        direccion       = excluded.direccion
  returning id into v_cliente_id;

  -- 2. Crear venta
  insert into public.ventas(owner_id, cliente_id, referencia, monto_total, anticipo, fecha_venta, notas)
  values (
    auth.uid(),
    v_cliente_id,
    p_venta->>'referencia',
    (p_venta->>'monto_total')::numeric,
    coalesce((p_venta->>'anticipo')::numeric, 0),
    coalesce((p_venta->>'fecha_venta')::date, current_date),
    p_venta->>'notas'
  )
  returning id into v_venta_id;

  -- 3. Insertar detalles (triggers descuentan stock automáticamente)
  insert into public.detalle_ventas(owner_id, venta_id, producto_id, cantidad, precio_unitario)
  select
    auth.uid(),
    v_venta_id,
    (item.value->>'producto_id')::uuid,
    (item.value->>'cantidad')::integer,
    (item.value->>'precio_unitario')::numeric
  from jsonb_array_elements(p_detalles) as item(value);

  -- 4. Crear préstamo vinculado a la venta
  insert into public.prestamos(
    owner_id, cliente_id, venta_id, origen,
    referencia, capital, tasa_interes, total_interes, total_a_pagar,
    monto_cuota, cantidad_cuotas, frecuencia, omitir_domingo, fecha_desembolso
  )
  values (
    auth.uid(), v_cliente_id, v_venta_id, 'venta',
    p_prestamo->>'referencia',
    (p_prestamo->>'capital')::numeric,
    (p_prestamo->>'tasa_interes')::numeric,
    (p_prestamo->>'total_interes')::numeric,
    (p_prestamo->>'total_a_pagar')::numeric,
    (p_prestamo->>'monto_cuota')::numeric,
    (p_prestamo->>'cantidad_cuotas')::integer,
    p_prestamo->>'frecuencia',
    coalesce((p_prestamo->>'omitir_domingo')::boolean, false),
    coalesce((p_prestamo->>'fecha_desembolso')::date, current_date)
  )
  returning id into v_prestamo_id;

  -- 5. Insertar cuotas
  insert into public.cuotas(owner_id, prestamo_id, numero, fecha_vencimiento, capital, interes, monto)
  select
    auth.uid(), v_prestamo_id,
    (item.value->>'numero')::integer,
    (item.value->>'fecha_vencimiento')::date,
    (item.value->>'capital')::numeric,
    (item.value->>'interes')::numeric,
    (item.value->>'monto')::numeric
  from jsonb_array_elements(p_cuotas) as item(value);

  -- Registrar anticipo en caja si > 0
  if coalesce((p_venta->>'anticipo')::numeric, 0) > 0 then
    insert into public.caja(owner_id, venta_id, tipo, concepto, monto)
    values (
      auth.uid(), v_venta_id, 'entrada',
      'Anticipo venta ' || (p_venta->>'referencia'),
      (p_venta->>'anticipo')::numeric
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.numero), '[]'::jsonb)
    into v_cuotas_out
    from public.cuotas c where c.prestamo_id = v_prestamo_id;

  return jsonb_build_object(
    'cliente_id',  v_cliente_id,
    'venta_id',    v_venta_id,
    'prestamo_id', v_prestamo_id,
    'cuotas',      v_cuotas_out
  );
end;
$$;

alter function public.emitir_venta_credito(jsonb,jsonb,jsonb,jsonb,jsonb) set search_path = '';
revoke all on function public.emitir_venta_credito(jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.emitir_venta_credito(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 9. COLUMNA venta_id EN CAJA (para registrar anticipo)
-- ───────────────────────────────────────────────────────────────
alter table public.caja
  add column if not exists venta_id uuid references public.ventas(id) on delete set null;

-- Relajar el CHECK de caja para admitir entradas de anticipo (venta_id not null)
alter table public.caja drop constraint if exists caja_check;
alter table public.caja add constraint caja_entrada_check
  check (
    (tipo = 'entrada' and (pago_id is not null or venta_id is not null))
    or tipo <> 'entrada'
  );

-- Índice adicional
create index if not exists caja_venta_id_idx on public.caja(venta_id);

-- ───────────────────────────────────────────────────────────────
-- COMENTARIO FINAL
-- ───────────────────────────────────────────────────────────────
comment on table public.productos is
  'Catálogo de productos disponibles para venta a crédito. Multitenant por owner_id.';
comment on table public.ventas is
  'Cabecera de cada venta a crédito. Vinculada a clientes y a un préstamo financiador.';
comment on table public.detalle_ventas is
  'Líneas de producto de cada venta. Un trigger descuenta el stock automáticamente.';
comment on column public.prestamos.origen is
  'efectivo = préstamo de dinero, venta = crédito por compra de producto';
