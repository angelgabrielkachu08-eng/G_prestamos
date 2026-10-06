/**
 * supabaseService.js
 * Capa de datos centralizada para PrestaNeo.
 * Todos los accesos a Supabase pasan por aquí: sin lógica de negocio en componentes.
 */

import { supabase } from './supabase'

const today = () => new Date().toISOString().slice(0, 10)

// PostgREST limita cada respuesta; pagina los historiales para no calcular
// saldos ni reportes con una muestra silenciosamente truncada.
async function queryAllPages(buildQuery, pageSize = 500) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}

/* ─────────────────────────────────────────────
   Helpers internos
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export function onAuthStateChange(callback) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session?.user ?? null),
  )
  return () => listener.subscription.unsubscribe()
}

/* ─────────────────────────────────────────────
   CARGA INICIAL (todos los datos del usuario)
───────────────────────────────────────────── */

/**
 * Carga en paralelo clientes, préstamos, cuotas, caja y pagos.
 * Retorna { clientes, prestamos, cuotas, caja, pagos } o lanza error.
 */
export async function cargarCarteraCompleta(userId) {
  const t = today()

  const [clientResult, loanResult, quotaResult, saleResult, ledgerResult, receiptResult, loanHistoryResult] =
    await Promise.all([
      queryAllPages(() => supabase
        .from('clientes')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }).order('id')),

      queryAllPages(() => supabase
        .from('prestamos')
        .select('*')
        .eq('owner_id', userId)
        .in('estado', ['activo', 'en_mora'])
        .order('created_at', { ascending: false }).order('id')),

      queryAllPages(() => supabase
        .from('cuotas')
        .select('*')
        .eq('owner_id', userId)
        .order('fecha_vencimiento').order('id')),

      queryAllPages(() => supabase
        .from('ventas')
        .select('id, referencia, cliente_id')
        .eq('owner_id', userId).order('created_at', { ascending: false }).order('id')),

      queryAllPages(() => supabase
        .from('caja')
        .select('id, tipo, concepto, monto, fecha, pago_id, prestamo_id, venta_id, anulado_at, anulado_motivo')
        .eq('owner_id', userId)
        .order('fecha', { ascending: false }).order('id')),

      queryAllPages(() => supabase
        .from('pagos')
        .select(`
          *,
          cuota:cuotas (
            *,
            prestamo:prestamos (
              referencia,
              origen,
              cliente:clientes ( nombre_completo, telefono )
            )
          )
        `)
        .eq('owner_id', userId)
        .order('recibido_at', { ascending: false }).order('id')),

      queryAllPages(() => supabase
        .from('prestamos')
        .select('id, referencia, cliente_id')
        .eq('owner_id', userId).order('id')),
    ])

  // Verificar errores en cualquiera de las queries
  for (const result of [clientResult, loanResult, quotaResult, saleResult, ledgerResult, receiptResult, loanHistoryResult]) {
    if (result.error) {
      throw new Error(
        `Error al cargar datos: ${result.error.message}. Verifica que aplicaste las migraciones SQL en Supabase.`,
      )
    }
  }

  const clientes = new Map(clientResult.data.map((c) => [c.id, c]))
  const loanMap = new Map(loanResult.data.map((l) => [l.id, l]))
  const saleMap = new Map((saleResult.data ?? []).map((v) => [v.id, v]))
  const loanHistoryMap = new Map((loanHistoryResult.data ?? []).map((l) => [l.id, l]))
  const receiptMap = new Map((receiptResult.data ?? []).map((p) => [p.id, p]))

  // Agrupar cuotas por préstamo
  const quotasByLoan = new Map()
  for (const q of quotaResult.data) {
    const arr = quotasByLoan.get(q.prestamo_id) ?? []
    arr.push(q)
    quotasByLoan.set(q.prestamo_id, arr)
  }

  // Transformar préstamos al modelo de UI
  const loans = loanResult.data.filter((l) => !clientes.get(l.cliente_id)?.eliminado).map((l) => {
    const client = clientes.get(l.cliente_id) ?? {}
    const quotas = quotasByLoan.get(l.id) ?? []
    const hasOverdue = quotas.some(
      (q) => q.estado !== 'pagada' && q.fecha_vencimiento < t,
    )
    const paidCount = quotas.filter((q) => q.estado === 'pagada').length
    const nextQuota = quotas.find((q) => q.estado !== 'pagada')

    return {
      id: l.referencia,
      dbId: l.id,
      clienteId: l.cliente_id,
      client: client.nombre_completo ?? 'Cliente',
      dni: client.documento ?? '',
      phone: client.telefono ?? '',
      address: client.direccion ?? '',
      risk: client.nivel_riesgo ?? 'medio',
      score: client.score_crediticio ?? null,
      principal: Number(l.capital),
      rate: Number(l.tasa_interes),
      installments: l.cantidad_cuotas,
      installment: quotas[0]?.monto ?? 0,
      paid: paidCount,
      status:
        l.estado === 'en_mora' || hasOverdue
          ? 'En mora'
          : l.estado === 'pagado'
            ? 'Pagado'
            : 'Activo',
      next: nextQuota?.fecha_vencimiento ?? l.fecha_desembolso,
      createdAt: l.created_at,
      origen: l.origen ?? 'efectivo',
    }
  })

  // Transformar cuotas al modelo de cobros
  const payments = quotaResult.data
    .filter((q) => {
      const loan = loanMap.get(q.prestamo_id) ?? loanHistoryMap.get(q.prestamo_id)
      return q.estado !== 'pagada' && !clientes.get(loan?.cliente_id)?.eliminado
    })
    .map((q) => {
      const loan = loanMap.get(q.prestamo_id) ?? loanHistoryMap.get(q.prestamo_id)
      const client = clientes.get(loan?.cliente_id)
      const remaining = Math.max(0, Number(q.monto) - Number(q.monto_pagado ?? 0))
      const balanceRatio = Number(q.monto) > 0 ? remaining / Number(q.monto) : 0
      const overdue = q.fecha_vencimiento < t && q.estado !== 'pagada'

      return {
        id: q.id,
        loanId: loan?.referencia ?? '',
        client: client?.nombre_completo ?? 'Cliente',
        phone: client?.telefono ?? '',
        amount: remaining,
        capital: Number(q.capital) * balanceRatio,
        interest: Number(q.interes) * balanceRatio,
        due: q.fecha_vencimiento,
        status:
          q.estado === 'parcial'
            ? 'Parcial'
            : overdue
              ? 'Vencido'
              : 'Pendiente',
        n: q.numero,
        totalQuotas: loan?.cantidad_cuotas ?? 0,
        origen: loan?.origen ?? 'efectivo',
      }
    })

  // Transformar movimientos de caja
  const ledger = ledgerResult.data.map((m) => {
    const loan = m.prestamo_id ? (loanMap.get(m.prestamo_id) ?? loanHistoryMap.get(m.prestamo_id)) : null
    const loanClient = loan ? clientes.get(loan.cliente_id) : null
    const receipt = m.pago_id ? receiptMap.get(m.pago_id) : null
    const receiptLoanRaw = receipt?.cuota?.prestamo
    const receiptLoan = Array.isArray(receiptLoanRaw) ? receiptLoanRaw[0] : receiptLoanRaw
    const receiptClientRaw = receiptLoan?.cliente
    const receiptClient = Array.isArray(receiptClientRaw) ? receiptClientRaw[0] : receiptClientRaw
    const sale = m.venta_id ? saleMap.get(m.venta_id) : null
    const saleClient = sale ? clientes.get(sale.cliente_id) : null
    const reference = loan?.referencia ?? receiptLoan?.referencia ?? sale?.referencia
    const person = loanClient?.nombre_completo ?? receiptClient?.nombre_completo ?? saleClient?.nombre_completo
    const typeLabel = m.tipo === 'entrada' ? 'Cobro' : m.tipo === 'salida' ? 'Desembolso' : 'Ajuste'
    const label = person
      ? `${m.venta_id ? 'Venta' : typeLabel} · ${person}${reference ? ` · ${reference}` : ''}`
      : m.concepto
    return {
    id: m.id,
    label,
    type: m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : 'Ajuste',
    amount: Number(m.monto),
    time: new Date(m.fecha).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    rawDate: m.fecha,
    voided: Boolean(m.anulado_at),
    voidReason: m.anulado_motivo ?? '',
    // Si tiene venta_id directamente es un movimiento de ventas.
    // Si tiene prestamo_id o pago_id sin venta_id => efectivo.
    // Fallback: detectar por prefijo del concepto (CV- = crédito venta).
    origen: m.venta_id != null || receiptLoan?.origen === 'venta'
      ? 'venta'
      : m.concepto?.includes('CV-') || m.concepto?.startsWith('Anticipo venta')
        ? 'venta'
        : 'efectivo',
    }
  })

  // Transformar pagos como recibos
  const receipts = receiptResult.data.flatMap((p) => {
    const loanRaw = p.cuota?.prestamo
    const loan = Array.isArray(loanRaw) ? loanRaw[0] : loanRaw
    const clientRaw = loan?.cliente
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    if (client?.eliminado) return []
    return [{
      id: p.referencia,
      dbId: p.id,
      loanId: loan?.referencia ?? '',
      client: client?.nombre_completo ?? 'Cliente',
      phone: client?.telefono ?? '',
      amount: Number(p.monto),
      capital: Number(p.capital),
      interest: Number(p.interes),
      due: p.recibido_at,
      paidAt: p.recibido_at,
      status: 'Pagado',
      n: p.cuota?.numero,
      method: p.metodo,
      origen: loan?.origen ?? 'efectivo',
    }]
  })

  return { loans, payments, ledger, receipts }
}

/* ─────────────────────────────────────────────
   PRÉSTAMOS
───────────────────────────────────────────── */

/** Crea cliente, préstamo, cuotas y desembolso en una sola transacción. */
export async function crearPrestamo(userId, form) {
  const reference = `LN-${String(Date.now()).slice(-7)}`
  const montoCuota = form.schedule.length > 0
    ? Number(Number(form.schedule[0].monto_cuota).toFixed(2))
    : Number((form.principal * (1 + form.rate / 100) / form.installments).toFixed(2))
  const p_cliente = {
    nombre_completo: form.client,
    documento: form.dni?.trim() || null,
    telefono: form.phone || '',
    direccion: form.address || null,
    nivel_riesgo: String(form.risk || 'medio').toLowerCase(),
  }
  const p_prestamo = {
    referencia: reference,
    capital: Number(form.principal),
    tasa_interes: Number(form.rate),
    total_interes: Number((form.principal * (form.rate / 100)).toFixed(2)),
    total_a_pagar: Number((form.principal * (1 + form.rate / 100)).toFixed(2)),
    monto_cuota: montoCuota,
    cantidad_cuotas: Number(form.installments),
    frecuencia: form.frequency,
    omitir_domingo: form.frequency === 'diario' && Boolean(form.omitSunday),
    fecha_desembolso: form.firstDue,
  }
  const p_cuotas = form.schedule.map(q => ({
    numero_cuota: q.numero_cuota,
    fecha_vencimiento: q.fecha_vencimiento,
    capital_cuota: Number(Number(q.capital_cuota).toFixed(2)),
    interes_cuota: Number(Number(q.interes_cuota).toFixed(2)),
    monto_cuota: Number(Number(q.monto_cuota).toFixed(2)),
  }))
  const { data: dbResult, error } = await supabase.rpc('crear_prestamo_atomico', {
    p_cliente,
    p_prestamo,
    p_cuotas,
  })
  if (error) throw new Error(error.message)

  return {
    dbResult,
    reference,
  }
}

/* ─────────────────────────────────────────────
   COBROS / PAGOS
───────────────────────────────────────────── */

/**
 * Registra un pago parcial o total de una cuota.
 * El trigger de Supabase actualiza cuota + caja automáticamente.
 * Retorna el registro de pago insertado.
 */
export async function registrarPago(payment, amount, method = 'efectivo') {
  const reference = `RC-${Date.now()}`
  const ratio = Number(payment.amount) > 0 ? Number(amount) / Number(payment.amount) : 0
  const capital = Number((payment.capital * ratio).toFixed(2))
  const interest = Number((payment.interest * ratio).toFixed(2))

  const { data, error } = await supabase
    .from('pagos')
    .insert({
      cuota_id: payment.id,
      referencia: reference,
      monto: Number(amount),
      capital,
      interes: interest,
      metodo: method,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: cajaMovement } = await supabase
    .from('caja').select('id').eq('pago_id', data.id).maybeSingle()

  return {
    ...data,
    movimientoCajaId: cajaMovement?.id,
    referencia: reference,
    capital,
    interes: interest,
    client: payment.client,
    phone: payment.phone,
    loanId: payment.loanId,
    n: payment.n,
  }
}

/* ─────────────────────────────────────────────
   ALERTAS INTELIGENTES
───────────────────────────────────────────── */

/**
 * Devuelve cuotas que vencen en ≤ 48 hs o están vencidas/en mora.
 * Se calcula desde el estado local ya cargado (no query adicional).
 */
export function calcularAlertas(payments) {
  const t = today()
  const nowMs = new Date(`${t}T12:00:00`).getTime()

  return payments
    .map((p) => {
      const dueMs = new Date(`${p.due}T12:00:00`).getTime()
      const diffDays = Math.round((dueMs - nowMs) / 86_400_000)
      return { ...p, diffDays }
    })
    .filter(
      (p) =>
        p.diffDays <= 2 &&
        (p.status === 'Pendiente' || p.status === 'Vencido' || p.status === 'Parcial'),
    )
    .sort((a, b) => a.diffDays - b.diffDays)
}

/* ─────────────────────────────────────────────
   STORAGE — URL firmada para ver documento
───────────────────────────────────────────── */

export async function getDocumentUrl(path) {
  const { data, error } = await supabase.storage
    .from('documentos-clientes')
    .createSignedUrl(path, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

/* ─────────────────────────────────────────────
   CLIENTES — búsqueda y edición
───────────────────────────────────────────── */

/**
 * Busca clientes por nombre (ilike) para el autocompletado del modal.
 * Retorna máximo 6 resultados con su préstamo activo más reciente.
 */
export async function buscarClientesPorNombre(userId, query) {
  if (!query || query.trim().length < 2) return []

  const { data, error } = await supabase
    .from('clientes')
    .select(`
      id,
      nombre_completo,
      telefono,
      documento,
      direccion,
      nivel_riesgo,
      prestamos (
        id, referencia, capital, estado, cantidad_cuotas, tasa_interes, monto_cuota
      )
    `)
    .eq('owner_id', userId)
    .ilike('nombre_completo', `%${query.trim()}%`)
    .order('nombre_completo')
    .limit(6)

  if (error) return []

  return data.map((c) => {
    const activeLoan = (c.prestamos ?? []).find((p) => p.estado === 'activo' || p.estado === 'en_mora')
    return {
      id:       c.id,
      name:     c.nombre_completo,
      phone:    c.telefono ?? '',
      dni:      c.documento ?? '',
      address:  c.direccion ?? '',
      risk:     c.nivel_riesgo ?? 'medio',
      activeLoan: activeLoan ?? null,
    }
  })
}

/**
 * Actualiza datos básicos de un cliente existente.
 */
export async function actualizarCliente(clienteId, campos) {
  const { error } = await supabase
    .from('clientes')
    .update({
      nombre_completo: campos.nombre,
      telefono:        campos.telefono,
      documento:       campos.dni || null,
      direccion:       campos.direccion || null,
      nivel_riesgo:    String(campos.riesgo || 'medio').toLowerCase(),
    })
    .eq('id', clienteId)

  if (error) throw new Error(error.message)
}

/* ─────────────────────────────────────────────
   HISTORIAL COMPLETO (préstamos pagados/todos)
───────────────────────────────────────────── */

/**
 * Carga préstamos en todos los estados (incluye 'pagado', 'cancelado').
 * Usado en la pestaña "Historial" de la sección Préstamos.
 */
export async function cargarHistorialPrestamos(userId) {
  const t = new Date().toISOString().slice(0, 10)

  const [loanResult, clientResult, quotaResult] = await Promise.all([
    queryAllPages(() => supabase
      .from('prestamos')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }).order('id')),
    queryAllPages(() => supabase
      .from('clientes')
      .select('id, nombre_completo, telefono, documento, nivel_riesgo, eliminado')
      .eq('owner_id', userId).order('id')),
    queryAllPages(() => supabase
      .from('cuotas')
      .select('prestamo_id, estado, monto, monto_pagado, fecha_vencimiento')
      .eq('owner_id', userId).order('id')),
  ])

  if (loanResult.error) throw new Error(loanResult.error.message)

  const clientes = new Map((clientResult.data ?? []).map((c) => [c.id, c]))
  const quotasByLoan = new Map()
  for (const q of (quotaResult.data ?? [])) {
    const arr = quotasByLoan.get(q.prestamo_id) ?? []
    arr.push(q)
    quotasByLoan.set(q.prestamo_id, arr)
  }

  return loanResult.data.filter(l => !clientes.get(l.cliente_id)?.eliminado).map((l) => {
    const client = clientes.get(l.cliente_id) ?? {}
    const quotas = quotasByLoan.get(l.id) ?? []
    const hasOverdue = quotas.some((q) => q.estado !== 'pagada' && q.fecha_vencimiento < t)
    const paidCount = quotas.filter((q) => q.estado === 'pagada').length
    const totalRecuperado = quotas.reduce((s, q) => s + Number(q.monto_pagado ?? 0), 0)

    return {
      id:             l.referencia,
      dbId:           l.id,
      clienteId:      l.cliente_id,
      client:         client.nombre_completo ?? 'Cliente',
      dni:            client.documento ?? '',
      phone:          client.telefono ?? '',
      risk:           client.nivel_riesgo ?? 'medio',
      principal:      Number(l.capital),
      rate:           Number(l.tasa_interes),
      installments:   l.cantidad_cuotas,
      paid:           paidCount,
      totalRecuperado,
      status:
        l.estado === 'pagado'    ? 'Pagado'   :
        l.estado === 'cancelado' ? 'Cancelado':
        l.estado === 'en_mora' || hasOverdue ? 'En mora' : 'Activo',
      createdAt:      l.created_at,
      next:           quotas.find((q) => q.estado !== 'pagada')?.fecha_vencimiento ?? null,
      origen:         l.origen ?? 'efectivo',
    }
  })
}

/* ─────────────────────────────────────────────
   PROYECCIÓN FINANCIERA (próximos 30 días)
───────────────────────────────────────────── */

/**
 * Calcula los ingresos esperados en los próximos N días
 * basándose en las cuotas pendientes con fecha_vencimiento dentro del rango.
 */
export async function calcularProyeccion(userId, dias = 30) {
  const hoy   = new Date()
  const hasta = new Date(hoy)
  hasta.setDate(hoy.getDate() + dias)

  const desde  = hoy.toISOString().slice(0, 10)
  const hastaS = hasta.toISOString().slice(0, 10)

  const { data, error } = await queryAllPages(() => supabase
    .from('cuotas')
    .select(`
      fecha_vencimiento,
      monto,
      monto_pagado,
      estado,
      prestamo:prestamos ( cliente:clientes ( nombre_completo, eliminado ) )
    `)
    .eq('owner_id', userId)
    .neq('estado', 'pagada')
    .gte('fecha_vencimiento', desde)
    .lte('fecha_vencimiento', hastaS)
    .order('fecha_vencimiento').order('id'))

  if (error) throw new Error(error.message)

  // Agrupa por día para el sparkline
  const byDay = {}
  let totalEsperado = 0

  for (const q of data) {
    const loanRaw = q.prestamo
    const loan = Array.isArray(loanRaw) ? loanRaw[0] : loanRaw
    const clientRaw = loan?.cliente
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    if (client?.eliminado) continue
    const saldo = Math.max(0, Number(q.monto) - Number(q.monto_pagado ?? 0))
    byDay[q.fecha_vencimiento] = (byDay[q.fecha_vencimiento] ?? 0) + saldo
    totalEsperado += saldo
  }

  // Genera array de los próximos `dias` días con monto (0 si no hay cuotas)
  const serie = []
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    serie.push({ fecha: key, monto: byDay[key] ?? 0 })
  }

  return {
    totalEsperado,
    cuotasCount: data.length,
    serie, // array[30] para el miniChart
  }
}

/* ─────────────────────────────────────────────
   MÉTRICAS DE RENDIMIENTO MENSUAL (para barras reales)
───────────────────────────────────────────── */

/**
 * Suma de cobros (entradas en caja) agrupados por mes, últimos 12 meses.
 * Retorna array de 12 elementos { mes: 'YYYY-MM', total: number }.
 */
export async function cobradoPorMes(userId, origen = 'efectivo') {
  const { data, error } = await queryAllPages(() => supabase
    .from('pagos')
    .select('monto, recibido_at, cuota:cuotas(prestamo:prestamos(origen))')
    .eq('owner_id', userId)
    .order('recibido_at').order('id'))

  if (error) return Array(12).fill(0)

  const meses = {}
  for (const p of data) {
    const loanRaw = p.cuota?.prestamo
    const loan = Array.isArray(loanRaw) ? loanRaw[0] : loanRaw
    if (origen && (loan?.origen ?? 'efectivo') !== origen) continue
    const key = p.recibido_at.slice(0, 7)
    meses[key] = (meses[key] ?? 0) + Number(p.monto)
  }

  // Últimos 12 meses desde hoy hacia atrás
  const resultado = []
  const ahora = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    resultado.push(meses[key] ?? 0)
  }
  return resultado // array[12], el último es el mes actual
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO VENTAS
   Funciones para catálogo de productos, ventas a crédito y
   carga de cuotas unificadas (origen efectivo + venta).
═══════════════════════════════════════════════════════════════ */

/* ─── Productos ──────────────────────────────────────────────── */

/** Carga todos los productos activos del usuario */
export async function cargarProductos(userId) {
  const { data, error } = await queryAllPages(() => supabase
    .from('productos')
    .select('*')
    .eq('owner_id', userId)
    .eq('activo', true)
    .order('nombre').order('id'))

  if (error) throw new Error(error.message)

  return data.map(p => ({
    id:            p.id,
    nombre:        p.nombre,
    descripcion:   p.descripcion ?? '',
    categoria:     p.categoria,
    precioContado: Number(p.precio_contado),
    costo:         Number(p.costo ?? 0),
    stock:         Number(p.stock),
    imagenUrl:     p.imagen_url ?? null,
    createdAt:     p.created_at,
  }))
}

/** Crea un producto nuevo */
export async function crearProducto(userId, data) {
  const { data: row, error } = await supabase
    .from('productos')
    .insert({
      owner_id:       userId,
      nombre:         data.nombre,
      descripcion:    data.descripcion || null,
      categoria:      data.categoria || 'General',
      precio_contado: data.precioContado,
      costo:          data.costo ?? 0,
      stock:          data.stock ?? 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row
}

/** Actualiza un producto existente */
export async function actualizarProducto(productoId, data) {
  const { error } = await supabase
    .from('productos')
    .update({
      nombre:         data.nombre,
      descripcion:    data.descripcion || null,
      categoria:      data.categoria,
      precio_contado: data.precioContado,
      costo:          data.costo,
      stock:          data.stock,
    })
    .eq('id', productoId)

  if (error) throw new Error(error.message)
}

/** Elimina (desactiva) un producto */
export async function desactivarProducto(productoId) {
  const { error } = await supabase
    .from('productos')
    .update({ activo: false })
    .eq('id', productoId)

  if (error) throw new Error(error.message)
}

/* ─── Ventas ─────────────────────────────────────────────────── */

/** Carga ventas con detalle de productos y estado del crédito */
export async function cargarVentas(userId) {
  const { data, error } = await queryAllPages(() => supabase
    .from('ventas')
    .select(`
      *,
      cliente:clientes ( id, nombre_completo, telefono, eliminado ),
      detalle_ventas (
        id, cantidad, precio_unitario, subtotal,
        producto:productos ( id, nombre, categoria )
      ),
      prestamo:prestamos ( id, referencia, estado, origen, cantidad_cuotas, monto_cuota )
    `)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false }).order('id'))

  if (error) throw new Error(error.message)

  return data.filter(v => !v.cliente?.eliminado).map(v => {
    // La relación ventas→préstamos es 1:N en PostgREST y puede llegar como arreglo.
    const prestamoRow = Array.isArray(v.prestamo) ? v.prestamo[0] : v.prestamo
    return {
    id:              v.id,
    referencia:      v.referencia,
    clienteId:       v.cliente?.id ?? '',
    client:          v.cliente?.nombre_completo ?? 'Cliente',
    phone:           v.cliente?.telefono ?? '',
    montoTotal:      Number(v.monto_total),
    anticipo:        Number(v.anticipo),
    montoFinanciado: Number(v.monto_financiado),
    fechaVenta:      v.fecha_venta,
    estado:          v.estado,
    notas:           v.notas ?? '',
    items:           (v.detalle_ventas ?? []).map(d => ({
      id:             d.id,
      productoId:     d.producto?.id ?? '',
      nombre:         d.producto?.nombre ?? 'Producto',
      categoria:      d.producto?.categoria ?? 'General',
      cantidad:       d.cantidad,
      precioUnitario: Number(d.precio_unitario),
      subtotal:       Number(d.subtotal),
    })),
    prestamo:        prestamoRow ? {
      id:           prestamoRow.id,
      referencia:   prestamoRow.referencia,
      estado:       prestamoRow.estado,
      origen:       prestamoRow.origen ?? 'venta',
      cuotas:       Number(prestamoRow.cantidad_cuotas) || 0,
      montoCuota:   Number(prestamoRow.monto_cuota) || 0,
    } : null,
    createdAt:       v.created_at,
    }
  })
}

/**
 * Crea una venta a crédito completa vía RPC atómica.
 * Devuelve { ventaId, prestamoId, clienteId, cuotas }
 */
export async function crearVentaCredito(userId, form) {
  /* form:
     client, phone, dni, address, risk,
     items: [{ productoId, nombre, cantidad, precioUnitario }],
     montoTotal, anticipo, fechaVenta, notas,
     schedule: [{ numero_cuota, fecha_vencimiento, capital_cuota, interes_cuota, monto_cuota }],
     rate, installments, frequency, firstDue, omitSunday
  */
  const refVenta   = `VT-${String(Date.now()).slice(-7)}`
  const refPrestamo = `CV-${String(Date.now()).slice(-7)}`

  const montoFinanciado = Number(form.montoTotal) - Number(form.anticipo ?? 0)
  const montoCuota = form.schedule.length > 0
    ? Number(form.schedule[0].monto_cuota.toFixed(2))
    : Number((montoFinanciado * (1 + form.rate / 100) / form.installments).toFixed(2))

  const p_cliente = {
    nombre_completo: form.client,
    documento:       form.dni || null,
    telefono:        form.phone,
    direccion:       form.address || null,
    nivel_riesgo:    String(form.risk || 'medio').toLowerCase(),
  }
  const p_venta = {
    referencia:  refVenta,
    monto_total: Number(form.montoTotal),
    anticipo:    Number(form.anticipo ?? 0),
    fecha_venta: form.fechaVenta || new Date().toISOString().slice(0, 10),
    notas:       form.notas || null,
  }
  const p_detalles = form.items.map(i => ({
    producto_id:     i.productoId,
    cantidad:        i.cantidad,
    precio_unitario: i.precioUnitario,
  }))
  const p_prestamo = {
    referencia:       refPrestamo,
    capital:          montoFinanciado,
    tasa_interes:     form.rate,
    total_interes:    Number((montoFinanciado * form.rate / 100).toFixed(2)),
    total_a_pagar:    Number((montoFinanciado * (1 + form.rate / 100)).toFixed(2)),
    monto_cuota:      montoCuota,
    cantidad_cuotas:  form.installments,
    frecuencia:       form.frequency,
    omitir_domingo:   form.frequency === 'diario' && Boolean(form.omitSunday),
    fecha_desembolso: form.firstDue,
  }
  const p_cuotas = form.schedule.map(q => ({
    numero:            q.numero_cuota,
    fecha_vencimiento: q.fecha_vencimiento,
    capital:           Number(q.capital_cuota.toFixed(2)),
    interes:           Number(q.interes_cuota.toFixed(2)),
    monto:             Number(q.monto_cuota.toFixed(2)),
  }))

  const { data: result, error } = await supabase.rpc('emitir_venta_credito', {
    p_cliente, p_venta, p_detalles, p_prestamo, p_cuotas,
  })

  if (error) throw new Error(error.message)

  const { data: cajaMovement } = await supabase
    .from('caja').select('id').eq('venta_id', result.venta_id).eq('tipo', 'entrada').maybeSingle()

  return {
    ventaId:    result.venta_id,
    prestamoId: result.prestamo_id,
    clienteId:  result.cliente_id,
    cuotas:     result.cuotas ?? [],
    movimientoCajaId: cajaMovement?.id,
    refVenta,
    refPrestamo,
  }
}

/**
 * Carga cuotas unificadas (efectivo + ventas) para la Ruta del Día.
 * Enriquece cada cuota con el origen y, si viene de venta, el nombre del producto.
 */
export async function cargarCuotasUnificadas(userId) {
  const t = today()

  const { data, error } = await queryAllPages(() => supabase
    .from('cuotas')
    .select(`
      *,
      prestamo:prestamos (
        referencia, origen, cliente_id, cantidad_cuotas,
        venta:ventas (
          referencia,
          detalle_ventas (
            cantidad,
            producto:productos ( nombre, categoria )
          )
        ),
        cliente:clientes ( nombre_completo, telefono, eliminado )
      )
    `)
    .eq('owner_id', userId)
    .neq('estado', 'pagada')
    .order('fecha_vencimiento').order('id'))

  if (error) throw new Error(error.message)

  return data.flatMap(q => {
    const loanRaw = q.prestamo
    const prestamo = (Array.isArray(loanRaw) ? loanRaw[0] : loanRaw) ?? {}
    const clientRaw = prestamo.cliente
    const cliente = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) ?? {}
    if (cliente.eliminado) return []
    const saleRaw = prestamo.venta
    const venta = Array.isArray(saleRaw) ? saleRaw[0] : saleRaw
    const remaining = Math.max(0, Number(q.monto) - Number(q.monto_pagado ?? 0))
    const ratio     = Number(q.monto) > 0 ? remaining / Number(q.monto) : 0
    const overdue   = q.fecha_vencimiento < t

    // Etiqueta de producto (para cuotas de venta)
    let productoLabel = null
    if (venta?.detalle_ventas?.length > 0) {
      const items = venta.detalle_ventas
      if (items.length === 1) {
        productoLabel = `${items[0].producto?.nombre ?? 'Producto'}`
      } else {
        productoLabel = `${items.length} artículos`
      }
    }

    return [{
      id:           q.id,
      loanId:       prestamo.referencia ?? '',
      client:       cliente.nombre_completo ?? 'Cliente',
      phone:        cliente.telefono ?? '',
      amount:       remaining,
      capital:      Number(q.capital) * ratio,
      interest:     Number(q.interes) * ratio,
      due:          q.fecha_vencimiento,
      status:       q.estado === 'parcial' ? 'Parcial' : overdue ? 'Vencido' : 'Pendiente',
      n:            q.numero,
      totalQuotas:  prestamo.cantidad_cuotas ?? 0,
      // Campos específicos del módulo de ventas
      origen:       prestamo.origen ?? 'efectivo',  // 'efectivo' | 'venta'
      productoLabel,
      ventaRef:     venta?.referencia ?? null,
    }]
  })
}

/* ─────────────────────────────────────────────
   PAPELERA DE CLIENTES
───────────────────────────────────────────── */

/** Mueve un cliente a la papelera (no lo borra) */
export async function archivarCliente(clienteId) {
  const { error } = await supabase.rpc('archivar_cliente', { p_cliente_id: clienteId })
  if (error) throw new Error(error.message)
}

/** Restaura un cliente desde la papelera */
export async function restaurarCliente(clienteId) {
  const { error } = await supabase.rpc('restaurar_cliente', { p_cliente_id: clienteId })
  if (error) throw new Error(error.message)
}

/** Elimina permanentemente un cliente que ya se encuentra en la papelera. */
export async function eliminarClientePermanente(clienteId) {
  const { error } = await supabase.rpc('eliminar_cliente_permanente', { p_cliente_id: clienteId })
  if (error) throw new Error(error.message)
}

/** Elimina exclusivamente filas de Caja pertenecientes al usuario; pagos y cuotas permanecen intactos. */
export async function anularMovimientosCaja(movementIds, scope = null, reason = '') {
  const ids = [...new Set((movementIds ?? []).filter(Boolean))]
  if (!ids.length && !['prestamos', 'ventas'].includes(scope)) return 0
  const { data, error } = await supabase.rpc('anular_movimientos_caja', {
    p_ids: scope ? null : ids,
    p_scope: scope,
    p_motivo: reason,
  })
  if (error) throw new Error(error.message)
  return Number(data) || 0
}

/** Restaura un movimiento anulado, conservando su motivo anterior en la auditoría. */
export async function restaurarMovimientoCaja(movementId) {
  const { error } = await supabase.rpc('restaurar_movimiento_caja', { p_movimiento_id: movementId })
  if (error) throw new Error(error.message)
}

/** Carga clientes en la papelera */
export async function cargarPapelera(userId) {
  const { data, error } = await queryAllPages(() => supabase
    .from('clientes')
    .select('*')
    .eq('owner_id', userId)
    .eq('eliminado', true)
    .order('eliminado_at', { ascending: false }).order('id'))
  if (error) throw new Error(error.message)
  return data
}

/** Carga un cliente con su historial completo (préstamos + ventas + cuotas) */
export async function cargarFichaCliente(clienteId, userId) {
  const { data: cliente, error: ce } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .eq('owner_id', userId)
    .single()
  if (ce) throw new Error(ce.message)

  const [prestamosRes, ventasRes] = await Promise.all([
    supabase
      .from('prestamos')
      .select('*, cuotas(*)')
      .eq('cliente_id', clienteId)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ventas')
      .select('*, detalle_ventas(*, producto:productos(nombre, categoria))')
      .eq('cliente_id', clienteId)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
  ])
  if (prestamosRes.error) throw new Error(prestamosRes.error.message)
  if (ventasRes.error) throw new Error(ventasRes.error.message)

  const cuotaIds = (prestamosRes.data ?? []).flatMap(p => (p.cuotas ?? []).map(q => q.id))
  let pagos = []
  if (cuotaIds.length) {
    const { data, error } = await supabase
      .from('pagos')
      .select('id, referencia, monto, metodo, recibido_at, cuota_id, cuota:cuotas(numero, prestamo:prestamos(referencia))')
      .eq('owner_id', userId)
      .in('cuota_id', cuotaIds)
      .order('recibido_at', { ascending: true })
    if (error) throw new Error(error.message)
    pagos = data ?? []
  }

  return {
    cliente,
    prestamos: (prestamosRes.data ?? []),
    ventas:    (ventasRes.data ?? []),
    pagos,
  }
}
