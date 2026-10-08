-- Permite acordar una tasa menor y adelantar las cuotas pendientes de un
-- préstamo de efectivo sin borrar pagos ni alterar ventas a crédito.
create or replace function public.ajustar_prestamo_anticipado(
  p_prestamo_id uuid,
  p_tasa numeric,
  p_fecha_cobro date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_prestamo public.prestamos%rowtype;
  v_cuota public.cuotas%rowtype;
  v_ultima_cuota_id uuid;
  v_total_pagado numeric(14,2);
  v_interes_pagado numeric(14,2);
  v_total_nuevo numeric(14,2);
  v_interes_nuevo numeric(14,2);
  v_saldo_nuevo numeric(14,2);
  v_interes_pendiente numeric(14,2);
  v_peso_total numeric(14,2);
  v_peso numeric(14,2);
  v_pendientes integer;
  v_pagado_cuota numeric(14,2);
  v_interes_cuota_pagado numeric(14,2);
  v_saldo_cuota numeric(14,2);
  v_interes_asignado numeric(14,2);
  v_interes_total_cuota numeric(14,2);
  v_importe_cuota numeric(14,2);
begin
  if v_owner is null then
    raise exception 'Iniciá sesión para ajustar el préstamo';
  end if;
  if p_tasa is null or p_tasa < 0 or p_tasa > 10000 then
    raise exception 'Ingresá una tasa válida';
  end if;
  if p_fecha_cobro is null then
    raise exception 'Elegí la fecha acordada para cobrar';
  end if;

  select p.* into v_prestamo
  from public.prestamos p
  where p.id = p_prestamo_id
    and p.owner_id = v_owner
    and coalesce(p.origen, 'efectivo') = 'efectivo'
    and p.estado in ('activo', 'en_mora')
  for update;
  if not found then
    raise exception 'No se encontró un préstamo de efectivo activo para ajustar';
  end if;

  select count(*) into v_pendientes
  from public.cuotas q
  where q.prestamo_id = v_prestamo.id and q.owner_id = v_owner and q.estado <> 'pagada';
  if v_pendientes = 0 then
    raise exception 'Este préstamo ya no tiene cuotas pendientes';
  end if;

  select coalesce(sum(q.monto_pagado), 0)
  into v_total_pagado
  from public.cuotas q
  where q.prestamo_id = v_prestamo.id and q.owner_id = v_owner;

  select coalesce(sum(pg.interes), 0)
  into v_interes_pagado
  from public.pagos pg
  join public.cuotas q on q.id = pg.cuota_id
  where q.prestamo_id = v_prestamo.id and pg.owner_id = v_owner;

  v_total_nuevo := round(v_prestamo.capital * (1 + p_tasa / 100), 2);
  v_interes_nuevo := round(v_total_nuevo - v_prestamo.capital, 2);
  v_saldo_nuevo := round(v_total_nuevo - v_total_pagado, 2);
  v_interes_pendiente := round(v_interes_nuevo - v_interes_pagado, 2);

  if v_saldo_nuevo <= 0 then
    raise exception 'La tasa elegida deja un saldo nulo o negativo frente a lo ya cobrado';
  end if;
  if v_interes_pendiente < 0 or v_interes_pendiente > v_saldo_nuevo then
    raise exception 'La tasa elegida es menor al interés ya cobrado. Revisá el valor antes de guardar';
  end if;

  select coalesce(sum(q.monto - q.monto_pagado), 0)
  into v_peso_total
  from public.cuotas q
  where q.prestamo_id = v_prestamo.id
    and q.owner_id = v_owner
    and q.estado <> 'pagada';
  if v_peso_total <= 0 then
    raise exception 'No hay saldo pendiente para recalcular';
  end if;
  select q.id into v_ultima_cuota_id
  from public.cuotas q
  where q.prestamo_id = v_prestamo.id
    and q.owner_id = v_owner
    and q.estado <> 'pagada'
  order by q.numero desc, q.id desc
  limit 1;

  for v_cuota in
    select q.*
    from public.cuotas q
    where q.prestamo_id = v_prestamo.id
      and q.owner_id = v_owner
      and q.estado <> 'pagada'
    order by q.numero, q.id
    for update
  loop
    v_peso := greatest(v_cuota.monto - v_cuota.monto_pagado, 0);
    v_pagado_cuota := v_cuota.monto_pagado;
    select coalesce(sum(pg.interes), 0)
    into v_interes_cuota_pagado
    from public.pagos pg
    where pg.cuota_id = v_cuota.id and pg.owner_id = v_owner;

    if v_cuota.id = v_ultima_cuota_id then
      v_saldo_cuota := v_saldo_nuevo;
      v_interes_asignado := v_interes_pendiente;
    else
      v_saldo_cuota := least(v_saldo_nuevo, round(v_saldo_nuevo * v_peso / v_peso_total, 2));
      v_interes_asignado := least(v_interes_pendiente, round(v_interes_pendiente * v_saldo_cuota / nullif(v_saldo_nuevo, 0), 2));
    end if;

    v_importe_cuota := round(v_pagado_cuota + v_saldo_cuota, 2);
    v_interes_total_cuota := round(v_interes_cuota_pagado + v_interes_asignado, 2);
    if v_interes_total_cuota > v_importe_cuota then
      v_interes_total_cuota := v_importe_cuota;
    end if;
    update public.cuotas
    set fecha_vencimiento = p_fecha_cobro,
        monto = v_importe_cuota,
        capital = round(v_importe_cuota - v_interes_total_cuota, 2),
        interes = v_interes_total_cuota
    where id = v_cuota.id and owner_id = v_owner;

    v_saldo_nuevo := round(v_saldo_nuevo - v_saldo_cuota, 2);
    v_interes_pendiente := round(v_interes_pendiente - v_interes_asignado, 2);
    v_peso_total := greatest(0, v_peso_total - v_peso);
  end loop;

  update public.prestamos
  set tasa_interes = p_tasa,
      total_interes = round(v_interes_nuevo, 2),
      total_a_pagar = round(v_total_nuevo, 2),
      monto_cuota = round((v_total_nuevo - v_total_pagado) / v_pendientes, 2)
  where id = v_prestamo.id and owner_id = v_owner;

  return jsonb_build_object(
    'prestamo_id', v_prestamo.id,
    'referencia', v_prestamo.referencia,
    'tasa_interes', p_tasa,
    'total_a_pagar', v_total_nuevo,
    'saldo_pendiente', round(v_total_nuevo - v_total_pagado, 2),
    'fecha_cobro', p_fecha_cobro
  );
end;
$$;

revoke all on function public.ajustar_prestamo_anticipado(uuid, numeric, date) from public, anon;
grant execute on function public.ajustar_prestamo_anticipado(uuid, numeric, date) to authenticated;
