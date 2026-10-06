/**
 * loanCalculator.js
 * Calcula préstamos con interés directo (flat rate).
 * Retorna el cronograma de cuotas con fechas de vencimiento exactas.
 *
 * FIXES aplicados:
 *  - Fecha inválida/vacía → usa hoy como fallback (evita fechas NaN).
 *  - Loop diario O(n²) → refactorizado a O(n) llevando un cursor de fecha
 *    que avanza de cuota en cuota en lugar de recalcular desde el inicio.
 */

/**
 * @param {string|number} monto         Capital del préstamo
 * @param {string|number} tasaPorcentaje Tasa de interés total (ej. 20 = 20%)
 * @param {string|number} totalCuotas    Número de cuotas
 * @param {'diario'|'semanal'|'quincenal'|'mensual'} modalidad
 * @param {string}        fechaInicio    YYYY-MM-DD — fecha de desembolso
 * @param {boolean}       omitirDomingos Solo aplicable en modalidad 'diario'
 * @returns {object|null} Objeto con cronograma o null si los datos son inválidos
 */
export function calcularPrestamoDirecto(
  monto,
  tasaPorcentaje,
  totalCuotas,
  modalidad,
  fechaInicio,
  omitirDomingos = true,
) {
  const p = Number(monto)
  const r = Number(tasaPorcentaje)
  const n = Number(totalCuotas)

  // Validación defensiva: todos los valores deben ser finitos y positivos
  if (!Number.isFinite(p) || p <= 0) return null
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  if (!Number.isFinite(r) || r < 0) return null

  const totalInteres = p * (r / 100)
  const totalAPagar  = p + totalInteres
  const montoCuota   = totalAPagar / n
  const capitalCuota = p / n
  const interesCuota = totalInteres / n

  // Sanitizar fecha: si viene vacía, inválida o mal formateada → usar hoy
  const hoy = new Date().toISOString().slice(0, 10)
  const rawFecha = String(fechaInicio || hoy).trim()
  // Comprobamos que tenga formato YYYY-MM-DD con 10 chars y sea una fecha real
  const fechaBase = new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(rawFecha) ? rawFecha : hoy}T12:00:00`)
  if (isNaN(fechaBase.getTime())) {
    // Último recurso: fecha de hoy
    fechaBase.setTime(new Date(`${hoy}T12:00:00`).getTime())
  }

  const cuotas = []

  if (modalidad === 'diario') {
    // O(n) — cursor que avanza un día a la vez desde la fecha base
    let cursor = new Date(fechaBase)
    for (let i = 1; i <= n; i++) {
      cursor.setDate(cursor.getDate() + 1)
      // Saltear domingos (día 0)
      while (omitirDomingos && cursor.getDay() === 0) {
        cursor.setDate(cursor.getDate() + 1)
      }
      cuotas.push(buildCuota(i, cursor, montoCuota, capitalCuota, interesCuota))
    }
  } else {
    for (let i = 1; i <= n; i++) {
      const fecha = new Date(fechaBase)

      if (modalidad === 'semanal') {
        fecha.setDate(fecha.getDate() + i * 7)
      } else if (modalidad === 'quincenal') {
        fecha.setDate(fecha.getDate() + i * 15)
      } else if (modalidad === 'mensual') {
        // Avanzar i meses manteniendo el día original (con clamp al último día del mes)
        const diaOriginal = fechaBase.getDate()
        fecha.setDate(1) // ir al primer día para evitar desbordamiento de mes
        fecha.setMonth(fechaBase.getMonth() + i)
        const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
        fecha.setDate(Math.min(diaOriginal, ultimoDia))
      }

      cuotas.push(buildCuota(i, fecha, montoCuota, capitalCuota, interesCuota))
    }
  }

  return {
    monto_principal: round2(p),
    total_interes:   round2(totalInteres),
    total_a_pagar:   round2(totalAPagar),
    monto_cuota:     round2(montoCuota),
    cronograma:      cuotas,
  }
}

/* ─── Helpers ──────────────────────────────────────────── */

function round2(n) {
  return Number(n.toFixed(2))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function buildCuota(numero, fecha, montoCuota, capitalCuota, interesCuota) {
  return {
    numero_cuota:      numero,
    fecha_vencimiento: isoDate(fecha),
    monto_cuota:       round2(montoCuota),
    capital_cuota:     round2(capitalCuota),
    interes_cuota:     round2(interesCuota),
  }
}
