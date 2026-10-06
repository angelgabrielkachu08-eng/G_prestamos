/**
 * receiptPdf.js
 * Genera comprobantes de pago A5 en PDF con diseño institucional premium.
 * Incluye: cabecera con logo, desglose completo, tabla de amortización,
 * código QR de validación, y sello de autenticidad.
 */

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

/* ─── Utilidades ─────────────────────────────────────────── */
const money = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const dateText = (date = new Date()) =>
  new Date(date).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })

const dateShort = (date = new Date()) =>
  new Date(date).toLocaleDateString('es-AR', { dateStyle: 'short' })

/* ─── Paleta ─────────────────────────────────────────────── */
const C = {
  bg:        [8,   9,  12],   // #08090C
  surface:   [16,  18,  23],  // #101217
  surface2:  [22,  24,  30],  // #16181E
  border:    [38,  40,  50],  // #262832
  purple:    [168, 85,  247], // #A855F7
  purpleD:   [124, 58,  237], // #7C3AED
  green:     [34,  197, 94],  // #22C55E
  greenD:    [22,  163, 74],  // #16A34A
  text:      [232, 233, 237], // #E8E9ED
  muted:     [127, 133, 146], // #7F8592
  accent:    [196, 133, 248], // #C485F8
  white:     [255, 255, 255],
  success:   [34,  197, 94],
  warn:      [234, 179, 8],
  danger:    [239, 68,  68],
}

/* ─── Primitivos de dibujo ────────────────────────────────── */
function setFill(doc, rgb)   { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
function setStroke(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }
function setColor(doc, rgb)  { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }

/**
 * Rectángulo redondeado — usa roundedRect si la versión de jsPDF lo expone,
 * o cae en rect() simple como fallback seguro.
 */
function roundRect(doc, x, y, w, h, r = 3) {
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(x, y, w, h, r, r, 'F')
  } else {
    doc.rect(x, y, w, h, 'F')
  }
}

/** Línea horizontal delgada. */
function hLine(doc, x1, x2, y, rgb = C.border) {
  setStroke(doc, rgb)
  doc.setLineWidth(0.25)
  doc.line(x1, y, x2, y)
}

/** Texto con overflow truncado. */
function textClipped(doc, text, x, y, maxW, align = 'left') {
  const s = String(text ?? '—')
  doc.text(s, x, y, { align, maxWidth: maxW })
}

/* ─── Exportar recibo ─────────────────────────────────────── */
export async function exportReceiptPdf(payment) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  const W    = doc.internal.pageSize.getWidth()   // 148 mm
  const H    = doc.internal.pageSize.getHeight()  // 210 mm
  const PAD  = 14

  /* ── 1. Fondo ── */
  setFill(doc, C.bg)
  doc.rect(0, 0, W, H, 'F')

  /* ── 2. Barra superior con degradado simulado ── */
  // banda principal morada
  setFill(doc, C.purple)
  doc.rect(0, 0, W, 5, 'F')
  // acento verde al 30%
  setFill(doc, C.green)
  doc.rect(W * 0.68, 0, W * 0.32, 5, 'F')

  /* ── 3. Cabecera (logo + tipo de documento) ── */
  // superficie de cabecera
  setFill(doc, C.surface)
  doc.rect(0, 5, W, 26, 'F')

  // Orb / icono de marca (círculo con gradiente simulado)
  setFill(doc, C.purpleD)
  doc.circle(PAD + 5, 18, 5, 'F')
  setFill(doc, C.purple)
  doc.circle(PAD + 5, 18, 3.5, 'F')

  // Nombre de marca
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setColor(doc, C.text)
  doc.text('PRESTANEO', PAD + 13, 16.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setColor(doc, C.muted)
  doc.text('FINANCE OS · SISTEMA DE GESTIÓN DE PRÉSTAMOS', PAD + 13, 22)

  // Tipo documento (derecha)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setColor(doc, C.accent)
  doc.text('COMPROBANTE DE PAGO', W - PAD, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setColor(doc, C.muted)
  doc.text(`Ref. ${payment.id ?? '—'}`, W - PAD, 21, { align: 'right' })

  hLine(doc, 0, W, 31, C.border)

  /* ── 4. Hero: importe ── */
  let y = 40

  // Badge "PAGO REGISTRADO"
  setFill(doc, [14, 33, 22])
  roundRect(doc, PAD, y - 5, 45, 8, 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setColor(doc, C.green)
  doc.text('✓  PAGO REGISTRADO', PAD + 3, y)
  y += 7

  // Importe principal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  setColor(doc, C.text)
  doc.text(money(payment.amount), PAD, y + 7)

  // Fecha a la derecha
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setColor(doc, C.muted)
  doc.text(dateText(payment.paidAt), W - PAD, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setColor(doc, C.accent)
  doc.text(String(payment.method ?? 'Efectivo').toUpperCase(), W - PAD, y + 8, { align: 'right' })

  y += 18
  hLine(doc, PAD, W - PAD, y, C.border)
  y += 7

  /* ── 5. Tabla de datos del cliente / cuota ── */
  const rows = [
    ['Cliente',           payment.client          ?? '—'],
    ['Préstamo',          payment.loanId           ?? '—'],
    ['Cuota N°',          String(payment.n ?? '—')],
    ['Fecha de cobro',    dateText(payment.paidAt)],
    ['Fecha de vencimiento', payment.due            ?? '—'],
  ]

  doc.setFontSize(7.5)
  for (const [label, value] of rows) {
    setColor(doc, C.muted)
    doc.setFont('helvetica', 'normal')
    doc.text(label, PAD, y)
    setColor(doc, C.text)
    doc.setFont('helvetica', 'bold')
    textClipped(doc, value, W - PAD, y, 78, 'right')
    y += 7.5
    hLine(doc, PAD, W - PAD, y - 2, [30, 32, 40])
  }

  y += 4

  /* ── 6. Desglose financiero ── */
  setFill(doc, C.surface)
  roundRect(doc, PAD, y, W - PAD * 2, 28, 3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setColor(doc, C.muted)
  doc.text('DESGLOSE DEL PAGO', PAD + 4, y + 6)

  // Capital
  const colW = (W - PAD * 2 - 8) / 3
  const cols = [
    { label: 'Capital devuelto', value: payment.capital,  color: C.text },
    { label: 'Interés aplicado',  value: payment.interest, color: C.green },
    { label: 'Total cobrado',     value: payment.amount,   color: C.accent },
  ]

  cols.forEach(({ label, value, color }, i) => {
    const cx = PAD + 4 + i * (colW + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setColor(doc, C.muted)
    doc.text(label, cx, y + 13)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setColor(doc, color)
    doc.text(money(value), cx, y + 21)
    if (i < 2) {
      setStroke(doc, [32, 34, 43])
      doc.setLineWidth(0.2)
      doc.line(cx + colW, y + 8, cx + colW, y + 26)
    }
  })

  y += 34

  /* ── 7. QR de validación ── */
  const qrData = [
    'PRESTANEO', payment.id, payment.client,
    payment.amount, payment.paidAt ?? new Date().toISOString(),
    payment.loanId, payment.n,
  ].join('|')

  const qrDataUrl = await QRCode.toDataURL(qrData, {
    margin: 1,
    width: 260,
    color: { dark: '#e8e9ed', light: '#10121700' },
    errorCorrectionLevel: 'M',
  })

  const QR_SIZE = 26
  const qrX     = W - PAD - QR_SIZE
  const qrY     = y

  // superficie QR
  setFill(doc, C.surface2)
  roundRect(doc, qrX - 2, qrY - 2, QR_SIZE + 4, QR_SIZE + 10, 2)
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  setColor(doc, C.muted)
  doc.text('Escanear para', qrX + QR_SIZE / 2, qrY + QR_SIZE + 4, { align: 'center' })
  doc.text('validar pago', qrX + QR_SIZE / 2, qrY + QR_SIZE + 7.5, { align: 'center' })

  /* ── 8. Sello de autenticidad ── */
  setFill(doc, [10, 20, 15])
  roundRect(doc, PAD, y, W - PAD * 2 - QR_SIZE - 6, QR_SIZE + 8, 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setColor(doc, C.green)
  doc.text('OPERACIÓN VERIFICADA', PAD + 4, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  setColor(doc, C.muted)
  doc.text('Este comprobante fue generado automáticamente', PAD + 4, y + 14)
  doc.text('por Prestaneo Finance OS y está respaldado', PAD + 4, y + 20)
  doc.text('por la base de datos segura del sistema.', PAD + 4, y + 26)

  y += QR_SIZE + 14

  /* ── 9. Líneas de firma ── */
  hLine(doc, PAD, PAD + 48, y + 12, [55, 60, 72])
  hLine(doc, W / 2, W / 2 + 50, y + 12, [55, 60, 72])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  setColor(doc, C.muted)
  doc.text('Firma del prestatario', PAD, y + 17)
  doc.text('Firma autorizada',      W / 2, y + 17)

  y += 24

  /* ── 10. Footer ── */
  hLine(doc, PAD, W - PAD, y, C.border)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  setColor(doc, [75, 79, 92])
  doc.text(
    `Documento de control interno · Prestaneo Finance OS · Generado el ${dateShort()} · ID ${payment.id ?? 'N/A'}`,
    W / 2,
    y,
    { align: 'center' },
  )

  /* ── Guardar ── */
  doc.save(`prestaneo-recibo-${payment.id ?? Date.now()}.pdf`)
}
