/**
 * reportDocx.js — PrestaNeo Finance OS
 * Dos reportes independientes:
 *   exportReportDocxPrestamos — cartera de préstamos en efectivo
 *   exportReportDocxVentas    — ventas a crédito
 *   exportComprobantePrestamoDocx — comprobante individual de préstamo
 */

import {
  Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  ShadingType, TableLayoutType, Header, Footer,
  PageNumber, NumberFormat,
} from 'docx'

/* ─── Formato ────────────────────────────────────────────── */
const money = (v) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  }).format(Number(v) || 0)

const dateShort = (d = new Date()) =>
  new Date(d).toLocaleDateString('es-AR', { dateStyle: 'short' })

const dateOnly = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-AR', { dateStyle: 'short' }) } catch { return String(d) }
}

const todayLabel = new Date().toLocaleDateString('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).toUpperCase()

/* ─── Paleta ─────────────────────────────────────────────── */
const P = {
  purple:  '8F43C2',
  purpleL: 'C485F8',
  green:   '22C55E',
  greenL:  '4ADE80',
  text:    'E8E9ED',
  muted:   '9297A2',
  border:  '2E3038',
  red:     'EF4444',
  amber:   'F59E0B',
  bg:      '14161B',
  bgAlt:   '0F1114',
  surface: '1A1D26',
}

/* ─── Primitivos ─────────────────────────────────────────── */
const borderThin = { style: BorderStyle.SINGLE, size: 4, color: P.border }
const borderNone = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const allBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin }
const noBorders  = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone }

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? '—'),
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italic ?? false,
    color: opts.color ?? P.text,
    font: 'Calibri',
  })
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    children: Array.isArray(children) ? children : [children],
  })
}

function spacer(pts = 160) {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] })
}

function heading2(text, color = P.purple) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, size: 28, color, font: 'Calibri' })],
  })
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.border } },
    spacing: { before: 60, after: 60 },
    children: [],
  })
}

function cell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { before: 70, after: 70 },
      children: [run(text, { bold: opts.bold ?? false, color: opts.color ?? P.text, size: opts.size ?? 18 })],
    })],
    borders: allBorders,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg, fill: opts.bg } : undefined,
    ...(opts.width ? { width: { size: opts.width, type: WidthType.PERCENTAGE } } : {}),
  })
}

function headerRow(labels, color = P.purpleL) {
  return new TableRow({
    tableHeader: true,
    children: labels.map(l => cell(l, { bold: true, color, bg: '1A1023', size: 17 })),
  })
}

function dataRow(values, ri) {
  return new TableRow({
    children: values.map(([v, c]) => cell(v, { bg: ri % 2 === 0 ? P.bg : P.bgAlt, color: c ?? P.text })),
  })
}

function makeTable(headers, rows, headerColor = P.purpleL) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      headerRow(headers, headerColor),
      ...rows.map((row, ri) => dataRow(row, ri)),
    ],
  })
}

/** Fila de KPIs (tarjetas horizontales) */
function kpiRow(items) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: items.map(({ label, value, color }) =>
        new TableCell({
          children: [
            para([run(label, { size: 16, color: P.muted })], { align: AlignmentType.CENTER, after: 20 }),
            para([run(value, { size: 28, bold: true, color: color ?? P.purpleL })], { align: AlignmentType.CENTER }),
          ],
          borders: allBorders,
          shading: { type: ShadingType.SOLID, color: P.surface, fill: P.surface },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
        }),
      ),
    })],
  })
}

/** Header y footer reutilizable */
function makeHeaderFooter(modulo) {
  return {
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.border } },
          spacing: { after: 100 },
          children: [
            run('PRESTANEO FINANCE OS', { bold: true, color: P.purple, size: 18 }),
            run(`  ·  ${modulo}`, { color: P.muted, size: 18 }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: P.border } },
          spacing: { before: 100 },
          children: [
            run('Prestaneo Finance OS  ·  Documento de control interno  ·  ', { color: P.muted, size: 16, italic: true }),
            run(dateShort(), { color: P.muted, size: 16 }),
            run('  ·  Pág. ', { color: P.muted, size: 16 }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: P.muted }),
          ],
        })],
      }),
    },
  }
}

/** Portada genérica */
function portada(titulo, subtitulo) {
  return [
    spacer(800),
    para([run('PRESTANEO', { bold: true, size: 72, color: P.purple })], { align: AlignmentType.CENTER }),
    para([run('FINANCE OS', { size: 28, color: P.purpleL, bold: true })], { align: AlignmentType.CENTER, after: 30 }),
    para([run(titulo, { size: 22, color: P.muted })], { align: AlignmentType.CENTER }),
    spacer(180),
    new Table({
      width: { size: 70, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                para([run(subtitulo, { bold: true, size: 24, color: P.purpleL })], { align: AlignmentType.CENTER }),
                para([run(todayLabel, { size: 18, color: P.muted })], { align: AlignmentType.CENTER }),
              ],
              borders: allBorders,
              shading: { type: ShadingType.SOLID, color: P.surface, fill: P.surface },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
            }),
          ],
        }),
      ],
    }),
    spacer(200),
    divider(),
  ]
}

/** Firma */
function firmaRow() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [
      new TableCell({
        children: [spacer(400), new Paragraph({
          border: { top: borderThin },
          spacing: { before: 60, after: 60 },
          children: [run('Firma del Prestamista', { size: 16, color: P.muted })],
        })],
        borders: noBorders, margins: { right: 400 },
      }),
      new TableCell({
        children: [spacer(400), new Paragraph({
          border: { top: borderThin },
          spacing: { before: 60, after: 60 },
          children: [run('Firma del Cliente', { size: 16, color: P.muted })],
        })],
        borders: noBorders, margins: { left: 400 },
      }),
    ]})],
  })
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════════════════════════════════
   REPORTE DE PRÉSTAMOS
   opts: { loans, payments, ledger, titulo }
═══════════════════════════════════════════════════════════ */
export async function exportReportDocxPrestamos({ loans = [], payments = [], ledger = [], titulo = 'Reporte General' }) {
  const totalCapital  = loans.reduce((s, l) => s + Number(l.principal), 0)
  const totalRetorno  = loans.reduce((s, l) => s + Number(l.principal) * (1 + Number(l.rate) / 100), 0)
  const totalInteres  = totalRetorno - totalCapital
  const cajaSaldo     = ledger.reduce((s, m) => s + (m.type === 'Entrada' ? m.amount : -m.amount), 0)
  const activos       = loans.filter(l => l.status === 'Activo').length
  const enMora        = loans.filter(l => l.status === 'En mora').length
  const pendientes    = payments.filter(p => ['Pendiente','Vencido','Parcial'].includes(p.status))
  const montoPend     = pendientes.reduce((s, p) => s + Number(p.amount), 0)

  const loanRows = loans.map(l => [
    [l.id,                       P.purpleL],
    [l.client,                   P.text],
    [money(l.principal),         P.green],
    [`${l.rate}%`,               P.text],
    [`${l.paid} / ${l.installments}`, P.muted],
    [l.status === 'En mora' ? '⚠ En mora' : l.status === 'Pagado' ? '✓ Pagado' : '● Activo',
      l.status === 'En mora' ? P.red : l.status === 'Pagado' ? P.green : P.purpleL],
  ])

  const cashRows = ledger.slice(0, 80).map(m => [
    [m.label,                              P.text],
    [m.type === 'Entrada' ? '▲ Entrada' : '▼ Salida', m.type === 'Entrada' ? P.greenL : P.red],
    [money(m.amount),                      m.type === 'Entrada' ? P.greenL : P.red],
    [m.time,                               P.muted],
  ])

  const doc = new Document({
    creator: 'Prestaneo Finance OS',
    title: `Reporte de Préstamos · ${dateShort()}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: P.text } } } },
    sections: [{
      ...makeHeaderFooter('Reporte de Préstamos'),
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: [

        ...portada('Sistema de Gestión de Préstamos', 'REPORTE DE CARTERA · ' + titulo.toUpperCase()),

        /* KPIs */
        heading2('Resumen ejecutivo'),
        kpiRow([
          { label: 'Capital colocado',   value: money(totalCapital), color: P.purpleL },
          { label: 'Interés proyectado', value: money(totalInteres), color: P.greenL  },
          { label: 'Saldo en caja',      value: money(cajaSaldo),    color: cajaSaldo >= 0 ? P.greenL : P.red },
          { label: 'Pendiente de cobro', value: money(montoPend),    color: P.amber  },
        ]),
        spacer(120),
        kpiRow([
          { label: 'Préstamos activos',   value: String(activos),  color: P.purpleL },
          { label: 'En mora',             value: String(enMora),   color: enMora > 0 ? P.red : P.greenL },
          { label: 'Total préstamos',     value: String(loans.length), color: P.text },
          { label: 'Tasa morosidad',      value: loans.length ? `${((enMora / loans.length) * 100).toFixed(1)}%` : '0%', color: P.amber },
        ]),

        spacer(200),

        /* Cartera */
        heading2('Cartera de préstamos'),
        divider(),
        spacer(80),
        loans.length > 0
          ? makeTable(
              ['Referencia', 'Cliente', 'Capital', 'Tasa', 'Cuotas', 'Estado'],
              loanRows,
            )
          : para([run('Sin préstamos en el período seleccionado.', { color: P.muted, italic: true })]),

        spacer(240),

        /* Cobros pendientes */
        heading2('Cobros pendientes'),
        divider(),
        spacer(80),
        pendientes.length > 0
          ? makeTable(
              ['Cliente', 'Préstamo', 'N° Cuota', 'Vence', 'Importe', 'Estado'],
              pendientes.slice(0, 50).map((p, ri) => [
                [p.client,                    P.text],
                [p.loanId,                    P.muted],
                [`Cuota ${p.n}`,              P.muted],
                [p.due,                       P.text],
                [money(p.amount),             p.status === 'Vencido' ? P.red : P.amber],
                [p.status === 'Vencido' ? '⚠ Vencida' : p.status === 'Parcial' ? '◑ Parcial' : '○ Pendiente',
                  p.status === 'Vencido' ? P.red : P.amber],
              ]),
            )
          : para([run('Sin cuotas pendientes. ¡Todo al día!', { color: P.greenL, italic: true })]),

        spacer(240),

        /* Libro de caja */
        heading2('Movimientos de caja'),
        divider(),
        spacer(80),
        para([
          run(`Balance operativo: `, { size: 20, color: P.muted }),
          run(money(cajaSaldo), { size: 22, bold: true, color: cajaSaldo >= 0 ? P.greenL : P.red }),
        ], { after: 120 }),
        cashRows.length > 0
          ? makeTable(
              ['Descripción', 'Tipo', 'Importe', 'Fecha'],
              cashRows,
            )
          : para([run('Sin movimientos registrados.', { color: P.muted, italic: true })]),

        spacer(300),
        divider(),
        para([run('Prestaneo Finance OS · Documento de control interno · No requiere firma adicional.', { italic: true, color: P.muted, size: 16 })], { align: AlignmentType.CENTER }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  download(blob, `prestaneo-prestamos-${dateShort().replace(/\//g, '-')}.docx`)
}

/* ═══════════════════════════════════════════════════════════
   REPORTE DE VENTAS
   opts: { ventas, ledger, titulo }
═══════════════════════════════════════════════════════════ */
export async function exportReportDocxVentas({ ventas = [], ledger = [], titulo = 'Reporte de Ventas' }) {
  const totalVendido  = ventas.reduce((s, v) => s + Number(v.montoTotal),    0)
  const totalAnticipo = ventas.reduce((s, v) => s + Number(v.anticipo),      0)
  const totalFinanc   = ventas.reduce((s, v) => s + Number(v.montoFinanciado), 0)
  const cajaSaldo     = ledger.reduce((s, m) => s + (m.type === 'Entrada' ? m.amount : -m.amount), 0)

  // Agrupar por cliente para el reporte
  const byClient = new Map()
  for (const v of ventas) {
    if (!byClient.has(v.clienteId)) byClient.set(v.clienteId, { client: v.client, phone: v.phone, ventas: [] })
    byClient.get(v.clienteId).ventas.push(v)
  }
  const clientes = [...byClient.values()]

  const cashRows = ledger.slice(0, 80).map(m => [
    [m.label,                              P.text],
    [m.type === 'Entrada' ? '▲ Entrada' : '▼ Salida', m.type === 'Entrada' ? P.greenL : P.red],
    [money(m.amount),                      m.type === 'Entrada' ? P.greenL : P.red],
    [m.time,                               P.muted],
  ])

  // Secciones por cliente
  const clienteSections = clientes.flatMap(c => {
    const totalC    = c.ventas.reduce((s, v) => s + Number(v.montoTotal), 0)
    const anticipoC = c.ventas.reduce((s, v) => s + Number(v.anticipo),   0)
    const financC   = c.ventas.reduce((s, v) => s + Number(v.montoFinanciado), 0)

    return [
      heading2(`Cliente: ${c.client}`, P.purpleL),
      para([
        run(`Teléfono: ${c.phone || '—'}  ·  Compras: ${c.ventas.length}  ·  Total comprado: ${money(totalC)}`, { color: P.muted, size: 18 }),
      ], { after: 100 }),
      kpiRow([
        { label: 'Total comprado',   value: money(totalC),    color: P.purpleL },
        { label: 'Anticipo pagado',  value: money(anticipoC), color: P.greenL  },
        { label: 'Saldo financiado', value: money(financC),   color: P.amber  },
      ]),
      spacer(100),
      ...c.ventas.flatMap(v => {
        const items = (v.items ?? [])
        return [
          para([
            run(`Venta ${v.referencia}`, { bold: true, color: P.purpleL, size: 20 }),
            run(`  ·  ${dateOnly(v.fechaVenta)}  ·  Estado: ${v.estado === 'activo' ? 'Activo' : v.estado === 'pagado' ? 'Pagado' : 'Cancelado'}`, { color: P.muted, size: 18 }),
          ], { after: 80 }),
          items.length > 0
            ? makeTable(
                ['Artículo', 'Categoría', 'Cant.', 'Precio unit.', 'Subtotal'],
                items.map((it, ri) => [
                  [it.nombre,             P.text],
                  [it.categoria ?? '—',  P.muted],
                  [String(it.cantidad),   P.text],
                  [money(it.precioUnitario), P.text],
                  [money(it.subtotal),    P.purpleL],
                ]),
                P.purpleL,
              )
            : para([run('Sin detalle de artículos.', { color: P.muted, italic: true })]),
          spacer(80),
          new Table({
            width: { size: 60, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [
                cell('Precio total contado', { bold: true, color: P.muted, bg: P.bg, width: 55 }),
                cell(money(v.montoTotal), { color: P.text, bg: P.bg }),
              ]}),
              new TableRow({ children: [
                cell('Anticipo recibido', { bold: true, color: P.muted, bg: P.bgAlt, width: 55 }),
                cell(money(v.anticipo), { color: P.greenL, bg: P.bgAlt }),
              ]}),
              new TableRow({ children: [
                cell('Monto financiado', { bold: true, color: P.muted, bg: P.bg, width: 55 }),
                cell(money(v.montoFinanciado), { color: P.purpleL, bg: P.bg }),
              ]}),
              ...(v.prestamo ? [new TableRow({ children: [
                cell(`Cuota (${v.prestamo.cuotas} cuotas)`, { bold: true, color: P.muted, bg: P.bgAlt, width: 55 }),
                cell(money(v.prestamo.montoCuota), { color: P.amber, bg: P.bgAlt }),
              ]})] : []),
              ...(v.notas ? [new TableRow({ children: [
                cell('Notas', { bold: true, color: P.muted, bg: P.bg, width: 55 }),
                cell(v.notas, { color: P.muted, bg: P.bg }),
              ]})] : []),
            ],
          }),
          spacer(160),
        ]
      }),
      divider(),
      spacer(80),
    ]
  })

  const doc = new Document({
    creator: 'Prestaneo Finance OS',
    title: `Reporte de Ventas · ${dateShort()}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: P.text } } } },
    sections: [{
      ...makeHeaderFooter('Reporte de Ventas a Crédito'),
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: [

        ...portada('Sistema de Ventas a Crédito', 'REPORTE DE VENTAS · ' + titulo.toUpperCase()),

        /* Resumen global */
        heading2('Resumen de ventas', P.purple),
        kpiRow([
          { label: 'Total vendido',    value: money(totalVendido),  color: P.purpleL },
          { label: 'Anticipos cobrados', value: money(totalAnticipo), color: P.greenL },
          { label: 'Saldo financiado',  value: money(totalFinanc),   color: P.amber  },
          { label: 'Total clientes',    value: String(clientes.length), color: P.text },
        ]),
        spacer(200),

        /* Detalle por cliente */
        heading2('Detalle por cliente', P.purple),
        divider(),
        spacer(80),

        ...clienteSections,

        /* Movimientos de caja */
        heading2('Movimientos de caja de ventas', P.purple),
        divider(),
        spacer(80),
        para([
          run('Balance operativo: ', { color: P.muted }),
          run(money(cajaSaldo), { bold: true, color: cajaSaldo >= 0 ? P.greenL : P.red }),
        ], { after: 120 }),
        cashRows.length > 0
          ? makeTable(['Descripción', 'Tipo', 'Importe', 'Fecha'], cashRows)
          : para([run('Sin movimientos de ventas registrados.', { color: P.muted, italic: true })]),

        spacer(300),
        divider(),
        para([run('Prestaneo Finance OS · Documento de control interno · No requiere firma adicional.', { italic: true, color: P.muted, size: 16 })], { align: AlignmentType.CENTER }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  download(blob, `prestaneo-ventas-${dateShort().replace(/\//g, '-')}.docx`)
}

/* ═══════════════════════════════════════════════════════════
   COMPROBANTE INDIVIDUAL DE PRÉSTAMO (sin cambios)
═══════════════════════════════════════════════════════════ */
export async function exportComprobantePrestamoDocx(loan, cuotas = [], modo = 'completo', nCuota = null) {
  const cuotasFiltradas = modo === 'cuota' && nCuota != null
    ? cuotas.filter(q => q.n === nCuota || q.numero === nCuota)
    : cuotas

  const cuotaRows = cuotasFiltradas.map(q => [
    [String(q.n ?? q.numero ?? '—'),         P.muted],
    [q.due ?? q.fecha_vencimiento ?? '—',    P.text],
    [money(q.amount ?? q.monto ?? 0),        P.purpleL],
    [money(q.capital ?? 0),                  P.text],
    [money(q.interest ?? q.interes ?? 0),    P.greenL],
    [q.status ?? q.estado ?? 'Pendiente',    P.muted],
  ])

  const titleText = modo === 'cuota' && nCuota != null
    ? `COMPROBANTE DE CUOTA N° ${nCuota}`
    : 'COMPROBANTE DE PRÉSTAMO'

  const montoCuota = loan.installment
    ?? (loan.principal && loan.rate != null && loan.installments
        ? Number(loan.principal) * (1 + Number(loan.rate) / 100) / Number(loan.installments)
        : 0)

  const doc = new Document({
    creator: 'Prestaneo Finance OS',
    title: `${titleText} — ${loan.id ?? loan.referencia ?? ''}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: P.text } } } },
    sections: [{
      ...makeHeaderFooter('Comprobante de Préstamo'),
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: [
        spacer(200),
        para([run(titleText, { bold: true, size: 52, color: P.purple })], { align: AlignmentType.CENTER }),
        para([run(`Emitido el ${new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}`, { size: 18, color: P.muted })], { align: AlignmentType.CENTER, after: 200 }),
        divider(),
        spacer(120),

        heading2('Datos del cliente', P.purple),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ children: [ cell('Cliente',   { bold:true, color:P.muted, bg:P.bg,    width:30 }), cell(loan.client  ?? '—',  { color:P.text })    ] }),
            new TableRow({ children: [ cell('Teléfono',  { bold:true, color:P.muted, bg:P.bgAlt, width:30 }), cell(loan.phone   ?? '—',  { color:P.text, bg:P.bgAlt }) ] }),
            new TableRow({ children: [ cell('DNI / Doc.',{ bold:true, color:P.muted, bg:P.bg,    width:30 }), cell(loan.dni     || '—',  { color:P.text })    ] }),
            new TableRow({ children: [ cell('Dirección', { bold:true, color:P.muted, bg:P.bgAlt, width:30 }), cell(loan.address || '—',  { color:P.text, bg:P.bgAlt }) ] }),
          ],
        }),

        spacer(160),
        heading2('Condiciones del préstamo', P.purple),
        kpiRow([
          { label: 'Capital prestado',  value: money(loan.principal ?? 0),   color: P.purpleL },
          { label: 'Tasa de interés',   value: `${loan.rate ?? 0}%`,          color: P.greenL  },
          { label: 'Total a devolver',  value: money((loan.principal ?? 0) * (1 + (loan.rate ?? 0) / 100)), color: P.purpleL },
          { label: 'Cuota fija',        value: money(montoCuota),              color: P.amber   },
        ]),
        spacer(80),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ children: [ cell('Referencia',     { bold:true, color:P.muted, bg:P.bg,    width:30 }), cell(loan.id ?? loan.referencia ?? '—', { color:P.purpleL }) ] }),
            new TableRow({ children: [ cell('Cantidad cuotas',{ bold:true, color:P.muted, bg:P.bgAlt, width:30 }), cell(`${loan.installments ?? 0} cuotas`, { color:P.text, bg:P.bgAlt }) ] }),
            new TableRow({ children: [ cell('Fecha emisión',  { bold:true, color:P.muted, bg:P.bg,    width:30 }), cell(loan.createdAt ? dateOnly(loan.createdAt) : dateShort(), { color:P.text }) ] }),
          ],
        }),

        spacer(200),
        heading2(modo === 'cuota' ? `Cuota N° ${nCuota}` : 'Cronograma de cuotas', P.purple),
        divider(),
        spacer(80),
        cuotaRows.length > 0
          ? makeTable(['N°', 'Vencimiento', 'Cuota', 'Capital', 'Interés', 'Estado'], cuotaRows)
          : para([run('Sin cuotas disponibles.', { color: P.muted, italic: true })]),

        spacer(300),
        firmaRow(),
        spacer(200),
        divider(),
        para([run('Prestaneo Finance OS · Documento generado automáticamente · No requiere firma electrónica adicional.', { italic: true, color: P.muted, size: 16 })], { align: AlignmentType.CENTER }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  download(blob, `prestaneo-prestamo-${(loan.id ?? loan.referencia ?? 'comprobante').replace(/[^a-z0-9]/gi, '-')}.docx`)
}

/** Reporte integral de ficha del cliente, también disponible desde papelera. */
export async function exportFichaClienteDocx({ cliente = {}, prestamos = [], ventas = [], pagos = [] }) {
  const nombre = cliente.nombre_completo ?? 'Cliente'
  const allQuotas = prestamos.flatMap(p => p.cuotas ?? [])
  const totalPrestado = prestamos.reduce((sum, p) => sum + Number(p.capital ?? 0), 0)
  const totalVenta = ventas.reduce((sum, v) => sum + Number(v.monto_total ?? 0), 0)
  const totalCobrado = allQuotas.reduce((sum, q) => sum + Number(q.monto_pagado ?? 0), 0) + ventas.reduce((sum, v) => sum + Number(v.anticipo ?? 0), 0)
  const saldoPendiente = allQuotas.reduce((sum, q) => sum + Math.max(0, Number(q.monto ?? 0) - Number(q.monto_pagado ?? 0)), 0)
  const fecha = dateShort()
  const loanRows = prestamos.flatMap(p => (p.cuotas ?? []).map(q => [
    [p.referencia ?? '—', P.muted], [String(q.numero ?? '—'), P.text],
    [dateOnly(q.fecha_vencimiento), P.text], [money(q.monto), P.purpleL],
    [money(q.monto_pagado), P.greenL],
    [q.estado === 'pagada' ? 'Pagada' : q.estado === 'parcial' ? 'Parcial' : 'Pendiente', P.muted],
  ]))
  const paymentRows = pagos.map(p => {
    const cuota = Array.isArray(p.cuota) ? p.cuota[0] : p.cuota
    const prestamo = Array.isArray(cuota?.prestamo) ? cuota.prestamo[0] : cuota?.prestamo
    return [
      [dateOnly(p.recibido_at), P.text], [prestamo?.referencia ?? '—', P.muted],
      [String(cuota?.numero ?? '—'), P.text], [money(p.monto), P.greenL],
      [p.metodo ?? 'Efectivo', P.muted],
    ]
  })
  const saleRows = ventas.flatMap(v => (v.detalle_ventas ?? []).map(d => [
    [v.referencia ?? '—', P.muted], [d.producto?.nombre ?? 'Artículo', P.text],
    [String(d.cantidad ?? 0), P.text], [money(d.subtotal), P.purpleL],
    [dateOnly(v.fecha_venta), P.muted],
  ]))
  const doc = new Document({
    creator: 'Prestaneo Finance OS',
    title: `Ficha de ${nombre} · ${fecha}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: P.text } } },
      title: { run: { font: 'Calibri', bold: true, color: P.purple, size: 34 } } },
    sections: [{
      ...makeHeaderFooter('Ficha integral de cliente'),
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: [
        ...portada('Ficha integral del cliente', `HISTORIAL DE MOVIMIENTOS · ${nombre.toUpperCase()}`),
        heading2('Datos personales', P.purple),
        makeTable(['Dato', 'Información'], [
          [['Nombre', P.muted], [nombre, P.text]],
          [['Documento', P.muted], [cliente.documento ?? '—', P.text]],
          [['Teléfono', P.muted], [cliente.telefono ?? '—', P.text]],
          [['Dirección', P.muted], [cliente.direccion ?? '—', P.text]],
          [['Estado', P.muted], [cliente.eliminado ? 'En papelera' : 'Activo', P.amber]],
        ]),
        spacer(150), heading2('Resumen de cuenta', P.purple),
        kpiRow([
          { label: 'Capital prestado', value: money(totalPrestado), color: P.purpleL },
          { label: 'Compras registradas', value: money(totalVenta), color: P.purpleL },
          { label: 'Total abonado', value: money(totalCobrado), color: P.greenL },
          { label: 'Saldo pendiente', value: money(saldoPendiente), color: P.amber },
        ]),
        spacer(150), heading2('Préstamos y cuotas', P.purple),
        prestamos.length ? makeTable(['Referencia', 'Cuota', 'Vencimiento', 'Importe', 'Abonado', 'Estado'], loanRows)
          : para([run('No hay préstamos registrados.', { italic: true, color: P.muted })]),
        spacer(150), heading2('Movimientos de pago', P.purple),
        paymentRows.length ? makeTable(['Fecha', 'Préstamo', 'Cuota', 'Importe', 'Medio'], paymentRows)
          : para([run('No hay pagos registrados.', { italic: true, color: P.muted })]),
        spacer(150), heading2('Compras realizadas', P.purple),
        ventas.length ? makeTable(['Venta', 'Producto', 'Cantidad', 'Importe', 'Fecha'], saleRows)
          : para([run('No hay compras registradas.', { italic: true, color: P.muted })]),
        spacer(200), divider(),
        para([run(`Documento generado el ${todayLabel}. Prestaneo Finance OS · Historial del cliente.`, { italic: true, color: P.muted, size: 16 })], { align: AlignmentType.CENTER }),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  const safeName = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  download(blob, `prestaneo-ficha-${safeName || 'cliente'}.docx`)
}

/* ── Alias legacy para compatibilidad ── */
export async function exportReportDocx(loans, payments, ledger) {
  return exportReportDocxPrestamos({ loans, payments, ledger })
}
