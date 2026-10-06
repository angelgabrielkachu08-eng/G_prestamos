alter function public.set_updated_at() set search_path = '';
alter function public.validar_cliente_tenant() set search_path = '';
alter function public.validar_prestamo_tenant() set search_path = '';
alter function public.validar_cuota_tenant() set search_path = '';
alter function public.registrar_pago_en_caja() set search_path = '';
alter function public.registrar_desembolso_en_caja() set search_path = '';
alter function public.emitir_prestamo(jsonb, jsonb, jsonb) set search_path = '';

create index if not exists prestamos_cliente_id_idx on public.prestamos(cliente_id);
create index if not exists pagos_cuota_id_idx on public.pagos(cuota_id);
create index if not exists caja_pago_id_idx on public.caja(pago_id);
create index if not exists caja_prestamo_id_idx on public.caja(prestamo_id);
