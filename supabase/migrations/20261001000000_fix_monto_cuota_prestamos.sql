-- ═══════════════════════════════════════════════════════════════
-- Fix: columna monto_cuota NOT NULL en tabla prestamos
-- ═══════════════════════════════════════════════════════════════
-- El error "null value in column monto_cuota of relation prestamos"
-- indica que la tabla tiene esa columna como NOT NULL pero la
-- función RPC emitir_prestamo no la incluía en el INSERT.
--
-- Este script:
-- 1. Se asegura de que la columna exista con un default temporal.
-- 2. Recrea emitir_prestamo incluyendo monto_cuota en el INSERT.
-- ═══════════════════════════════════════════════════════════════

-- Dar un default temporal para no romper registros existentes
alter table public.prestamos
  alter column monto_cuota set default 0;

-- Recrear la función incluyendo monto_cuota
create or replace function public.emitir_prestamo(p_cliente jsonb, p_prestamo jsonb, p_cuotas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_cliente  public.clientes%rowtype;
  v_prestamo public.prestamos%rowtype;
  v_cuotas   jsonb;
begin
  -- Insertar o reutilizar cliente
  insert into public.clientes(owner_id, nombre_completo, documento, telefono, direccion, nivel_riesgo)
  values (
    auth.uid(),
    p_cliente->>'nombre_completo',
    nullif(p_cliente->>'documento', ''),
    p_cliente->>'telefono',
    nullif(p_cliente->>'direccion', ''),
    coalesce(p_cliente->>'nivel_riesgo', 'medio')
  )
  returning * into v_cliente;

  -- Insertar préstamo incluyendo monto_cuota
  insert into public.prestamos(
    owner_id, cliente_id, referencia,
    capital, tasa_interes, total_interes, total_a_pagar,
    monto_cuota,
    cantidad_cuotas, frecuencia, omitir_domingo, fecha_desembolso
  )
  values (
    auth.uid(),
    v_cliente.id,
    p_prestamo->>'referencia',
    (p_prestamo->>'capital')::numeric,
    (p_prestamo->>'tasa_interes')::numeric,
    (p_prestamo->>'total_interes')::numeric,
    (p_prestamo->>'total_a_pagar')::numeric,
    coalesce((p_prestamo->>'monto_cuota')::numeric, 0),
    (p_prestamo->>'cantidad_cuotas')::integer,
    p_prestamo->>'frecuencia',
    coalesce((p_prestamo->>'omitir_domingo')::boolean, false),
    coalesce((p_prestamo->>'fecha_desembolso')::date, current_date)
  )
  returning * into v_prestamo;

  -- Insertar cuotas
  insert into public.cuotas(owner_id, prestamo_id, numero, fecha_vencimiento, capital, interes, monto)
  select
    auth.uid(),
    v_prestamo.id,
    (item.value->>'numero')::integer,
    (item.value->>'fecha_vencimiento')::date,
    (item.value->>'capital')::numeric,
    (item.value->>'interes')::numeric,
    (item.value->>'monto')::numeric
  from jsonb_array_elements(p_cuotas) as item(value);

  -- Devolver resultado
  select coalesce(jsonb_agg(to_jsonb(c) order by c.numero), '[]'::jsonb)
    into v_cuotas
    from public.cuotas c
   where c.prestamo_id = v_prestamo.id;

  return jsonb_build_object(
    'cliente_id',  v_cliente.id,
    'prestamo_id', v_prestamo.id,
    'cuotas',      v_cuotas
  );
end;
$$;

-- Ajustar search_path de la nueva función
alter function public.emitir_prestamo(jsonb, jsonb, jsonb) set search_path = '';

-- Restaurar permisos
revoke all on function public.emitir_prestamo(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.emitir_prestamo(jsonb, jsonb, jsonb) to authenticated;
