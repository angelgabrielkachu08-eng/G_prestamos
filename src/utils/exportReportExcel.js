/**
 * exportReportExcel.js — PrestaNeo Finance OS
 * Dos exportaciones independientes:
 *   exportReportExcelPrestamos — cartera de préstamos en efectivo
 *   exportReportExcelVentas    — ventas a crédito
 *
 * Colores del tema PrestaNeo: morado/verde neón sobre fondo oscuro.
 */

import * as XLSX from 'xlsx'

/* ─── Helpers de formato ──────────────────────────────────── */
const $  = (v) => Number(Number(v) || 0)
const $s = (v) => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:2 }).format($(v))
const dt = (d) => { try { return d ? new Date(d).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }) : '—' } catch { return String(d) } }
const dd = (d) => { try { return d ? new Date(d).toLocaleDateString('es-AR', { dateStyle:'short' }) : '—' } catch { return String(d) } }

/* ─── Estilos ─────────────────────────────────────────────── */
const FONT_BASE  = { name:'Calibri', sz:10, color:{ rgb:'E8E9ED' } }
const FONT_MUTED = { ...FONT_BASE, color:{ rgb:'9297A2' } }
const FONT_GREEN = { ...FONT_BASE, bold:true, color:{ rgb:'4ADE80' } }
const FONT_RED   = { ...FONT_BASE, bold:true, color:{ rgb:'EF4444' } }
const FONT_PURPLE= { ...FONT_BASE, bold:true, color:{ rgb:'C485F8' } }
const FONT_AMBER = { ...FONT_BASE, bold:true, color:{ rgb:'F59E0B' } }
const FONT_TITLE = { name:'Calibri', sz:16, bold:true, color:{ rgb:'C485F8' } }

const BG_HEADER  = { fgColor:{ rgb:'1A1023' } }
const BG_EVEN    = { fgColor:{ rgb:'14161B' } }
const BG_ODD     = { fgColor:{ rgb:'0F1114' } }
const BG_SURFACE = { fgColor:{ rgb:'1A1D26' } }

const BORDER = { style:'thin', color:{ rgb:'2E3038' } }
const BORDERS = { top:BORDER, bottom:BORDER, left:BORDER, right:BORDER }

const ALIGN_C = { horizontal:'center', vertical:'center', wrapText:true }
const ALIGN_L = { horizontal:'left',   vertical:'center', wrapText:true }
const ALIGN_R = { horizontal:'right',  vertical:'center' }

const S_HEADER   = { fill:BG_HEADER,  font:{ name:'Calibri', sz:11, bold:true, color:{ rgb:'C485F8' } }, border:BORDERS, alignment:ALIGN_C }
const S_EVEN     = { fill:BG_EVEN,  font:FONT_BASE,  border:BORDERS, alignment:ALIGN_L }
const S_ODD      = { fill:BG_ODD,   font:FONT_BASE,  border:BORDERS, alignment:ALIGN_L }
const S_GREEN    = (ri) => ({ fill: ri%2===0 ? BG_EVEN : BG_ODD, font:FONT_GREEN,  border:BORDERS, alignment:ALIGN_R })
const S_RED      = (ri) => ({ fill: ri%2===0 ? BG_EVEN : BG_ODD, font:FONT_RED,    border:BORDERS, alignment:ALIGN_R })
const S_PURPLE   = (ri) => ({ fill: ri%2===0 ? BG_EVEN : BG_ODD, font:FONT_PURPLE, border:BORDERS, alignment:ALIGN_L })
const S_MUTED    = (ri) => ({ fill: ri%2===0 ? BG_EVEN : BG_ODD, font:FONT_MUTED,  border:BORDERS, alignment:ALIGN_L })

function sc(ws, ref, style) {
  if (!ws[ref]) ws[ref] = { v:'', t:'s' }
  ws[ref].s = style
}

function setRow(ws, r, cols, style) {
  cols.forEach(c => { const ref = XLSX.utils.encode_cell({r,c}); sc(ws, ref, style) })
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wpx: w }))
}

/* ══════════════════════════════════════════════════════════
   PRÉSTAMOS
══════════════════════════════════════════════════════════ */
function sheetResumenPrestamos(loans, ledger, receipts, { desde, hasta, titulo }) {
  const cap   = loans.reduce((s,l) => s + $(l.principal), 0)
  const ret   = loans.reduce((s,l) => s + $(l.principal) * (1 + $(l.rate)/100), 0)
  const int   = ret - cap
  const ent   = ledger.filter(m=>m.type==='Entrada').reduce((s,m)=>s+$(m.amount),0)
  const sal   = ledger.filter(m=>m.type==='Salida' ).reduce((s,m)=>s+$(m.amount),0)
  const caja  = ent - sal
  const cob   = receipts.reduce((s,r)=>s+$(r.amount),0)
  const mora  = loans.filter(l=>l.status==='En mora').length
  const act   = loans.filter(l=>l.status==='Activo').length
  const moraPct = loans.length ? ((mora/loans.length)*100).toFixed(1)+'%' : '0%'

  const rows = [
    ['PRESTANEO FINANCE OS — REPORTE DE PRÉSTAMOS'],
    [titulo || 'Período: General'],
    [desde && hasta ? `Desde ${desde} hasta ${hasta}` : `Generado: ${new Date().toLocaleDateString('es-AR')}`],
    [''],
    ['INDICADOR', 'VALOR', 'DESCRIPCIÓN'],
    ['Capital colocado',    $s(cap), 'Suma del capital de todos los préstamos incluidos'],
    ['Retorno esperado',    $s(ret), 'Capital + intereses si todos los clientes pagan'],
    ['Interés proyectado',  $s(int), 'Ganancia bruta potencial del período'],
    ['Total cobrado',       $s(cob), 'Pagos registrados en el período'],
    ['Entradas de caja',    $s(ent), 'Cobros recibidos'],
    ['Salidas de caja',     $s(sal), 'Dinero prestado (desembolsos)'],
    ['Balance de caja',     $s(caja),'Entradas − Salidas'],
    [''],
    ['ESTADO DE CARTERA', 'CANTIDAD', ''],
    ['Préstamos activos',   act,   ''],
    ['Préstamos en mora',   mora,  ''],
    ['Total de préstamos',  loans.length, ''],
    ['Tasa de morosidad',   moraPct, '% de préstamos en mora vs total'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  setColWidths(ws, [210, 160, 340])

  sc(ws,'A1',{ fill:BG_SURFACE, font:FONT_TITLE,  alignment:ALIGN_L })
  sc(ws,'A2',{ fill:BG_SURFACE, font:FONT_MUTED,  alignment:ALIGN_L })
  sc(ws,'A3',{ fill:BG_SURFACE, font:FONT_MUTED,  alignment:ALIGN_L })

  // cabecera métricas
  setRow(ws, 4, [0,1,2], S_HEADER)

  // métricas
  const metricFonts = [FONT_PURPLE, FONT_GREEN, FONT_PURPLE, FONT_GREEN, FONT_GREEN, FONT_RED,
    caja>=0 ? FONT_GREEN : FONT_RED]
  metricFonts.forEach((f,i) => {
    const r = 5+i
    sc(ws, XLSX.utils.encode_cell({r,c:0}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
    sc(ws, XLSX.utils.encode_cell({r,c:1}), { fill:r%2===0?BG_EVEN:BG_ODD, font:f, border:BORDERS, alignment:ALIGN_R })
    sc(ws, XLSX.utils.encode_cell({r,c:2}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
  })

  // cabecera estado cartera
  setRow(ws, 13, [0,1,2], S_HEADER)
  ;[14,15,16,17].forEach((r) => {
    const f = r===15 ? FONT_RED : FONT_BASE
    sc(ws, XLSX.utils.encode_cell({r,c:0}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
    sc(ws, XLSX.utils.encode_cell({r,c:1}), { fill:r%2===0?BG_EVEN:BG_ODD, font:f, border:BORDERS, alignment:ALIGN_R })
    sc(ws, XLSX.utils.encode_cell({r,c:2}), { fill:r%2===0?BG_EVEN:BG_ODD, font:r===17?FONT_AMBER:FONT_MUTED, border:BORDERS })
  })

  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:2} },
    { s:{r:1,c:0}, e:{r:1,c:2} },
    { s:{r:2,c:0}, e:{r:2,c:2} },
  ]
  return ws
}

function sheetPrestamos(loans) {
  const headers = ['Referencia','Cliente','Capital','Tasa %','Cuotas','Pagadas','Próximo vencimiento','Estado']
  const rows = loans.map(l => [l.id, l.client, $(l.principal), $(l.rate), $(l.installments), $(l.paid), l.next||'—', l.status])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setColWidths(ws, [120,170,110,65,65,65,120,90])

  headers.forEach((_,c) => sc(ws, XLSX.utils.encode_cell({r:0,c}), S_HEADER))

  rows.forEach((row, ri) => {
    const base = ri%2===0 ? S_EVEN : S_ODD
    row.forEach((_,c) => {
      const ref = XLSX.utils.encode_cell({r:ri+1,c})
      let s = base
      if (c===2) { s = { ...base, font:FONT_PURPLE, alignment:ALIGN_R }; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      if (c===3) s = { ...base, alignment:ALIGN_C }
      if (c===4||c===5) s = { ...base, alignment:ALIGN_C }
      if (c===7) s = row[7]==='En mora' ? S_RED(ri) : row[7]==='Activo' ? S_GREEN(ri) : S_PURPLE(ri)
      sc(ws, ref, s)
    })
  })
  return ws
}

function sheetMovimientos(ledger) {
  const headers = ['Descripción','Tipo','Importe','Fecha / Hora']
  const rows = ledger.map(m => [m.label, m.type==='Entrada'?'▲ Entrada':'▼ Salida', $(m.amount), m.time||dt(m.rawDate)])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setColWidths(ws, [260, 90, 120, 140])

  headers.forEach((_,c) => sc(ws, XLSX.utils.encode_cell({r:0,c}), S_HEADER))
  rows.forEach((row, ri) => {
    sc(ws, XLSX.utils.encode_cell({r:ri+1,c:0}), ri%2===0?S_EVEN:S_ODD)
    sc(ws, XLSX.utils.encode_cell({r:ri+1,c:1}), row[1].includes('▲') ? S_GREEN(ri) : S_RED(ri))
    const refM = XLSX.utils.encode_cell({r:ri+1,c:2})
    sc(ws, refM, row[1].includes('▲') ? S_GREEN(ri) : S_RED(ri))
    if(ws[refM]) ws[refM].z = '"$"#,##0.00'
    sc(ws, XLSX.utils.encode_cell({r:ri+1,c:3}), S_MUTED(ri))
  })
  return ws
}

/**
 * @param {{ loans, payments, ledger, receipts, desde, hasta, titulo }}
 */
export async function exportReportExcelPrestamos({ loans=[], ledger=[], receipts=[], desde=null, hasta=null, titulo='Reporte de Préstamos' }={}) {
  const wb = XLSX.utils.book_new()
  wb.Props = { Title:'PrestaNeo — Préstamos', Author:'PrestaNeo Finance OS', Subject:titulo }

  XLSX.utils.book_append_sheet(wb, sheetResumenPrestamos(loans, ledger, receipts, { desde, hasta, titulo }), 'Resumen')
  XLSX.utils.book_append_sheet(wb, sheetPrestamos(loans),             'Préstamos')
  XLSX.utils.book_append_sheet(wb, sheetMovimientos(ledger), 'Movimientos')

  XLSX.writeFile(wb, `prestaneo-prestamos-${new Date().toISOString().slice(0,10)}.xlsx`)
}

/* ── Alias legacy ── */
export async function exportReportExcel(opts={}) {
  return exportReportExcelPrestamos(opts)
}

/* ══════════════════════════════════════════════════════════
   VENTAS
══════════════════════════════════════════════════════════ */
function sheetResumenVentas(ventas, ledger, { desde, hasta, titulo }) {
  const totVend = ventas.reduce((s,v)=>s+$(v.montoTotal),    0)
  const totAnt  = ventas.reduce((s,v)=>s+$(v.anticipo),      0)
  const totFin  = ventas.reduce((s,v)=>s+$(v.montoFinanciado),0)
  const ent     = ledger.filter(m=>m.type==='Entrada').reduce((s,m)=>s+$(m.amount),0)
  const sal     = ledger.filter(m=>m.type==='Salida' ).reduce((s,m)=>s+$(m.amount),0)
  const caja    = ent - sal
  const nClients= new Set(ventas.map(v=>v.clienteId)).size
  const nItems  = ventas.reduce((s,v)=>s+(v.items?.length??0),0)

  const rows = [
    ['PRESTANEO FINANCE OS — REPORTE DE VENTAS'],
    [titulo || 'Período: General'],
    [desde && hasta ? `Desde ${desde} hasta ${hasta}` : `Generado: ${new Date().toLocaleDateString('es-AR')}`],
    [''],
    ['INDICADOR', 'VALOR', 'DESCRIPCIÓN'],
    ['Total vendido',       $s(totVend), 'Suma de todos los montos de venta'],
    ['Anticipos cobrados',  $s(totAnt),  'Total recibido en anticipos'],
    ['Saldo financiado',    $s(totFin),  'Monto financiado pendiente de cobro'],
    ['Entradas de caja',    $s(ent),     'Cobros y anticipos recibidos'],
    ['Salidas de caja',     $s(sal),     'Desembolsos registrados'],
    ['Balance de caja',     $s(caja),    'Entradas − Salidas'],
    [''],
    ['ESTADÍSTICAS', 'CANTIDAD', ''],
    ['Total ventas',        ventas.length,  ''],
    ['Clientes únicos',     nClients,       ''],
    ['Artículos vendidos',  nItems,         '(líneas de detalle)'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  setColWidths(ws, [210, 160, 340])

  sc(ws,'A1',{ fill:BG_SURFACE, font:{...FONT_TITLE, color:{rgb:'C485F8'}}, alignment:ALIGN_L })
  sc(ws,'A2',{ fill:BG_SURFACE, font:FONT_MUTED, alignment:ALIGN_L })
  sc(ws,'A3',{ fill:BG_SURFACE, font:FONT_MUTED, alignment:ALIGN_L })

  setRow(ws, 4, [0,1,2], S_HEADER)

  const metricFonts = [FONT_PURPLE, FONT_GREEN, FONT_AMBER, FONT_GREEN, FONT_RED, caja>=0?FONT_GREEN:FONT_RED]
  metricFonts.forEach((f,i) => {
    const r = 5+i
    sc(ws, XLSX.utils.encode_cell({r,c:0}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
    sc(ws, XLSX.utils.encode_cell({r,c:1}), { fill:r%2===0?BG_EVEN:BG_ODD, font:f, border:BORDERS, alignment:ALIGN_R })
    sc(ws, XLSX.utils.encode_cell({r,c:2}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
  })

  setRow(ws, 12, [0,1,2], S_HEADER)
  ;[13,14,15].forEach(r => {
    sc(ws, XLSX.utils.encode_cell({r,c:0}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
    sc(ws, XLSX.utils.encode_cell({r,c:1}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_PURPLE, border:BORDERS, alignment:ALIGN_R })
    sc(ws, XLSX.utils.encode_cell({r,c:2}), { fill:r%2===0?BG_EVEN:BG_ODD, font:FONT_MUTED, border:BORDERS })
  })

  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:2} },
    { s:{r:1,c:0}, e:{r:1,c:2} },
    { s:{r:2,c:0}, e:{r:2,c:2} },
  ]
  return ws
}

function sheetVentas(ventas) {
  const headers = ['Cliente','Teléfono','Referencia','Artículos','Total','Anticipo','Financiado','Cuotas','Fecha','Estado']
  const rows = ventas.map(v => [
    v.client,
    v.phone || '—',
    v.referencia,
    (v.items??[]).map(i=>`${i.cantidad}× ${i.nombre}`).join(' / ') || '—',
    $(v.montoTotal),
    $(v.anticipo),
    $(v.montoFinanciado),
    v.prestamo ? `${v.prestamo.cuotas} × ${$s(v.prestamo.montoCuota)}` : '—',
    dd(v.fechaVenta),
    v.estado === 'activo' ? 'Activo' : v.estado === 'pagado' ? 'Pagado' : 'Cancelado',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setColWidths(ws, [160,100,100,220,110,110,110,130,90,80])

  headers.forEach((_,c) => sc(ws, XLSX.utils.encode_cell({r:0,c}), S_HEADER))
  rows.forEach((row, ri) => {
    const base = ri%2===0 ? S_EVEN : S_ODD
    row.forEach((_,c) => {
      const ref = XLSX.utils.encode_cell({r:ri+1,c})
      let s = base
      if (c===4) { s={...base,font:FONT_PURPLE,alignment:ALIGN_R}; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      if (c===5) { s={...base,font:FONT_GREEN, alignment:ALIGN_R}; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      if (c===6) { s={...base,font:FONT_AMBER, alignment:ALIGN_R}; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      if (c===9) s = row[9]==='Pagado' ? S_GREEN(ri) : row[9]==='Activo' ? S_PURPLE(ri) : S_RED(ri)
      sc(ws, ref, s)
    })
  })
  return ws
}

function sheetDetalleVentas(ventas) {
  const headers = ['Cliente','Venta','Artículo','Categoría','Cantidad','Precio unit.','Subtotal']
  const rows = ventas.flatMap(v =>
    (v.items ?? []).map(it => [
      v.client, v.referencia, it.nombre, it.categoria??'—',
      it.cantidad, $(it.precioUnitario), $(it.subtotal),
    ])
  )
  if (rows.length === 0) return null
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setColWidths(ws, [160,100,180,100,70,110,110])

  headers.forEach((_,c) => sc(ws, XLSX.utils.encode_cell({r:0,c}), S_HEADER))
  rows.forEach((row,ri) => {
    const base = ri%2===0 ? S_EVEN : S_ODD
    row.forEach((_,c) => {
      const ref = XLSX.utils.encode_cell({r:ri+1,c})
      let s = base
      if (c===5) { s={...base,font:FONT_BASE,alignment:ALIGN_R}; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      if (c===6) { s={...base,font:FONT_PURPLE,alignment:ALIGN_R}; if(ws[ref]) ws[ref].z='"$"#,##0.00' }
      sc(ws, ref, s)
    })
  })
  return ws
}

/**
 * @param {{ ventas, ledger, desde, hasta, titulo }}
 */
export async function exportReportExcelVentas({ ventas=[], ledger=[], desde=null, hasta=null, titulo='Reporte de Ventas' }={}) {
  const wb = XLSX.utils.book_new()
  wb.Props = { Title:'PrestaNeo — Ventas', Author:'PrestaNeo Finance OS', Subject:titulo }

  XLSX.utils.book_append_sheet(wb, sheetResumenVentas(ventas, ledger, { desde, hasta, titulo }), 'Resumen')
  XLSX.utils.book_append_sheet(wb, sheetVentas(ventas),                'Ventas')
  const det = sheetDetalleVentas(ventas)
  if (det) XLSX.utils.book_append_sheet(wb, det, 'Artículos')
  XLSX.utils.book_append_sheet(wb, sheetMovimientos(ledger), 'Movimientos')

  XLSX.writeFile(wb, `prestaneo-ventas-${new Date().toISOString().slice(0,10)}.xlsx`)
}
