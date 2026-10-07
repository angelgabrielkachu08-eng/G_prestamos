import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, BriefcaseBusiness,
  Check, CheckCheck, ChevronDown, Download, FileText, Filter, HandCoins,
  LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, ShieldCheck,
  Sparkles, TrendingDown, TrendingUp, Users, Wallet, X, ReceiptText, UserRound,
  MessageCircle, Landmark, CircleAlert, Loader2, AlertTriangle, RefreshCw,
  Phone, Clock, Zap, BarChart3, CreditCard, Edit3, History,
  Calendar, Target, ChevronRight, PieChart, Route, RefreshCcw, Star,
  HelpCircle, GraduationCap, ChevronLeft,
  FileSpreadsheet, ArrowRight,
  ShoppingCart, Package, Store, Layers,
  PackagePlus, ShoppingBag, DollarSign,
  Trash2, ArchiveRestore, FileSignature, Gauge, ZapOff,
} from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'
import { calcularPrestamoDirecto } from './utils/loanCalculator'
import {
  signInWithGoogle, signOut as supabaseSignOut, getSession, onAuthStateChange,
  cargarCarteraCompleta, crearPrestamo, registrarPago,
  buscarClientesPorNombre, actualizarCliente,
  cargarHistorialPrestamos, cobradoPorMes,
  // Módulo ventas
  cargarProductos, cargarMovimientosStock, registrarMovimientoStock, crearProducto, actualizarProducto, desactivarProducto,
  cargarVentas, crearVentaCredito, cargarCuotasUnificadas,
  // Papelera
  archivarCliente, restaurarCliente, cargarPapelera, cargarFichaCliente, eliminarClientePermanente,
  anularMovimientosCaja, restaurarMovimientoCaja,
} from './lib/supabaseService'

const exportComprobanteDocx = async (...args) =>
  (await import('./utils/reportDocx')).exportComprobantePrestamoDocx(...args)

/* ─── Utilidades ──────────────────────────────────────────── */
const fmt = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(v) || 0)

function sanitizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '')
}

function BrandMark({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 2.5 28 9.4v13.2L16 29.5 4 22.6V9.4L16 2.5Z" stroke="currentColor" strokeWidth="1.7" opacity=".72"/>
    <path d="M11 23V9h7a4.5 4.5 0 0 1 0 9h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="m16 22 5 2.5 4-2" stroke="#c785ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="22.5" cy="10" r="2" fill="#c785ff"/>
  </svg>
}

function friendlyConnectionError(message) {
  const value = String(message || '')
  if (typeof navigator !== 'undefined' && (!navigator.onLine || /failed to fetch|network request failed|load failed|fetch failed|networkerror/i.test(value))) {
    return 'No hay conexión a Internet. Conectate para acceder a tus datos y volvé a intentar.'
  }
  return value
}

const today = new Date().toISOString().slice(0, 10)
const todayLabel = new Date().toLocaleDateString('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long',
}).toUpperCase()

const daysUntil = (date) =>
  Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86_400_000)

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PERFORMANCE_MODE_KEY = 'pn-performance-mode'
function readPerformancePreference() {
  try {
    const saved = localStorage.getItem(PERFORMANCE_MODE_KEY)
    if (saved !== null) return saved === 'on'
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch { return false }
}
let performanceModeActive = readPerformancePreference()

function PerformanceToggle({ enabled, onToggle, className = '' }) {
  return (
    <button type="button" className={`performance-mode-toggle ${enabled ? 'is-active' : ''} ${className}`}
      onClick={onToggle} aria-pressed={enabled}>
      {enabled ? <ZapOff size={14}/> : <Gauge size={14}/>}
      <span>Modo rendimiento</span>
      <small>{enabled ? 'Activo' : 'Inactivo'}</small>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SISTEMA DE AYUDA CONTEXTUAL
   ─ HelpModal      — modal reutilizable con contenido contextual
   ─ HelpBtn        — botón ? que abre el modal
   ─ HELP_CONTENT   — base de datos de todos los textos de ayuda
   ─ TOUR_STEPS     — pasos del tour guiado
═══════════════════════════════════════════════════════════════ */

const HELP_CONTENT = {

  selector_gestion: {
    icon: LayoutDashboard,
    title: 'Elegí qué querés gestionar',
    color: 'purple',
    sections: [
      { heading: 'Préstamos', text: 'Usá este módulo para registrar dinero prestado, seguir cuotas, gestionar clientes y controlar cobros y caja.' },
      { heading: 'Ventas', text: 'Usá este módulo para mantener el catálogo, registrar ventas financiadas, seguir pagos por cliente y revisar ingresos.' },
      { heading: 'Podés cambiar después', text: 'La selección solo define por dónde empezar. Podés pasar de un módulo al otro desde el menú lateral.' },
    ],
  },
  login: {
    icon: ShieldCheck,
    title: 'Acceso seguro a PrestaNeo',
    color: 'green',
    sections: [
      { heading: 'Entrá con tu cuenta de Google', text: 'El acceso se valida mediante Supabase Auth. Usá la cuenta autorizada para este negocio.' },
      { heading: 'Tus datos quedan asociados a tu cuenta', text: 'Los préstamos, clientes, ventas y movimientos se cargan desde el espacio conectado a tu sesión.' },
      { heading: '¿No pudiste entrar?', text: 'Revisá que la cuenta tenga acceso habilitado y volvé a intentarlo. Si el problema continúa, contactá a quien administra el sistema.' },
    ],
  },

  /* ── DASHBOARD ───────────────────────────────── */
  dashboard: {
    icon: LayoutDashboard,
    title: 'Panel de Resumen',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'El Dashboard es tu pantalla de control diario. Muestra en tiempo real el estado completo de tu cartera: dinero prestado, ganancia proyectada, caja disponible y cobros prioritarios.',
      },
      {
        heading: '¿Por qué es importante?',
        text: 'Te permite saber de un vistazo cuánto dinero tenés en la calle, cuánto ganás en intereses y a qué clientes tenés que cobrarles hoy, sin entrar a ninguna otra sección.',
      },
      {
        heading: '¿Cómo usarlo?',
        text: 'Revisá los 4 KPIs al inicio del día. Si hay cobros urgentes, aparecen en el panel inferior. El gráfico de barras muestra tu historial mensual de cobros reales.',
      },
    ],
  },

  /* ── KPIs ────────────────────────────────────── */
  kpi_capital: {
    icon: Landmark,
    title: 'Capital Colocado',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Es el total de dinero que tenés actualmente prestado a tus clientes en préstamos activos o en mora. No incluye préstamos ya pagados.',
      },
      {
        heading: '¿Por qué importa?',
        text: 'Te indica cuánto de tu capital propio o de trabajo está "en la calle". Cuanto más alto, mayor es tu exposición al riesgo — asegurate de que sea proporcional a tu capacidad de pérdida.',
      },
      {
        heading: '¿Cómo se calcula?',
        text: 'Es la suma del capital original de cada préstamo activo. No se descuenta lo ya cobrado — para ver el saldo real pendiente, usá la sección Estadísticas.',
      },
    ],
  },
  kpi_retorno: {
    icon: TrendingUp,
    title: 'Retorno Esperado',
    color: 'green',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Es el total que recibirías si todos tus clientes terminan de pagar sus préstamos. Incluye el capital original más todos los intereses pactados.',
      },
      {
        heading: '¿Por qué importa?',
        text: 'Es el "techo" de ganancia posible de tu cartera actual. La diferencia entre Retorno y Capital es tu interés proyectado total.',
      },
      {
        heading: '¿Cómo se calcula?',
        text: 'Suma de capital × (1 + tasa/100) para cada préstamo activo. Si un cliente paga antes o se refinancia, este número cambia.',
      },
    ],
  },
  kpi_interes: {
    icon: Activity,
    title: 'Interés Proyectado',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Es la ganancia bruta que generaría tu cartera si todos los préstamos activos se pagan completos. Equivale a Retorno Esperado menos Capital Colocado.',
      },
      {
        heading: '¿Por qué importa?',
        text: 'Es tu utilidad bruta potencial. Refleja qué tan rentable está siendo tu estrategia de tasas. A mayor tasa promedio o mayor capital prestado, más alto este número.',
      },
      {
        heading: '¿Cómo se usa?',
        text: 'Comparalo con tu Caja Disponible. Si la caja es mucho menor al interés proyectado, hay muchos clientes que deben — chequeá las Alertas de mora.',
      },
    ],
  },
  kpi_caja: {
    icon: Wallet,
    title: 'Caja Disponible',
    color: 'green',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Es el saldo neto de caja: suma de todos los cobros recibidos menos todos los préstamos desembolsados registrados en el sistema.',
      },
      {
        heading: '¿Por qué importa?',
        text: 'Te dice el dinero real disponible para hacer nuevos préstamos. Si este número es negativo, prestaste más de lo que cobrastes — necesitás esperar cobros o conseguir más capital.',
      },
      {
        heading: '¿Cómo se mantiene al día?',
        text: 'Se actualiza automáticamente con cada pago que marcás como Cobrado y con cada préstamo que emitís. No necesitás tocar nada manualmente.',
      },
    ],
  },

  /* ── PRÉSTAMOS ───────────────────────────────── */
  crear_prestamo: {
    icon: BriefcaseBusiness,
    title: 'Crear Nuevo Préstamo',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué hace esta pantalla?',
        text: 'Te permite registrar un nuevo préstamo a un cliente. El sistema calcula automáticamente las cuotas, fechas de vencimiento y el desglose de capital e interés.',
      },
      {
        heading: '¿Por qué es importante hacer esto bien?',
        text: 'Los datos que cargás aquí son los que se usan para recordatorios de cobro, comprobantes PDF, caja y estadísticas. Un error en el capital o la tasa afecta todos los cálculos.',
      },
      {
        heading: '¿Qué campo es más crítico?',
        text: 'El Teléfono del cliente es obligatorio — sin él no podés enviar recordatorios por WhatsApp. El Capital y la Tasa definen el monto de cada cuota. El resto es opcional.',
      },
    ],
  },
  campo_tasa: {
    icon: Activity,
    title: 'Tasa de Interés (%)',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Es el porcentaje de interés total que cobra sobre el capital prestado. Si prestás $100.000 con tasa 20%, el cliente devuelve $120.000.',
      },
      {
        heading: '¿Es mensual o total?',
        text: 'En PrestaNeo, la tasa es TOTAL sobre el préstamo completo (interés directo o flat). No es una tasa mensual. Si querés 5% mensual por 10 semanas, ingresá 50%.',
      },
      {
        heading: '¿Cómo elegir la tasa?',
        text: 'Depende del riesgo del cliente, el plazo y la frecuencia. Tasas típicas: riesgo bajo 15–25%, riesgo medio 25–40%, riesgo alto 40–60%. El sistema muestra el interés total en pesos en tiempo real.',
      },
    ],
  },
  campo_frecuencia: {
    icon: Calendar,
    title: 'Frecuencia de Pago',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué significa cada opción?',
        text: '• Diario: el cliente paga una cuota por cada día hábil\n• Semanal: paga una cuota por semana (7 días)\n• Quincenal: paga cada 15 días\n• Mensual: paga una vez al mes',
      },
      {
        heading: '¿Cuál elegir según el cliente?',
        text: 'Los microemprendedores con flujo diario (kioscos, verdulerías) prefieren cuotas diarias pequeñas. Los asalariados prefieren mensual o semanal. Más frecuencia = menor riesgo de mora.',
      },
      {
        heading: '¿Qué pasa con los domingos?',
        text: 'Si elegís frecuencia Diaria, aparece la opción "Omitir domingos". Activala si tu cliente no trabaja los domingos — las cuotas de ese día se mueven al lunes automáticamente.',
      },
    ],
  },
  campo_omitir_domingos: {
    icon: Calendar,
    title: 'Omitir Domingos',
    color: 'green',
    sections: [
      {
        heading: '¿Qué hace?',
        text: 'Cuando está activado, el sistema salta los domingos al generar el cronograma de cuotas diarias. La cuota que habría caído en domingo pasa automáticamente al lunes siguiente.',
      },
      {
        heading: '¿Por qué importa?',
        text: 'Muchos comerciantes y empleados informales no tienen ingresos los domingos. Cobrar en domingo genera conflictos y moras. Esta opción evita ese problema desde el primer día.',
      },
      {
        heading: '¿Cuándo NO activarlo?',
        text: 'Si el cliente trabaja los 7 días (rotiserías, deliveries, etc.) dejalo desactivado para cobrar también los domingos y acortar el plazo total del préstamo.',
      },
    ],
  },

  /* ── COBROS / BOTONES ────────────────────────── */
  btn_cobrar: {
    icon: Check,
    title: 'Marcar Cuota como Cobrada',
    color: 'green',
    sections: [
      {
        heading: '¿Qué hace este botón?',
        text: 'Registra el pago completo de una cuota en la base de datos. Actualiza el estado del préstamo, suma el importe a la caja del día y genera un comprobante disponible para descargar.',
      },
      {
        heading: '¿Qué pasa en el sistema?',
        text: 'El trigger automático de Supabase actualiza la cuota a "pagada", registra el ingreso en el libro de caja y, si era la última cuota, marca el préstamo como completado.',
      },
      {
        heading: '¿Qué hago si cobré solo una parte?',
        text: 'Usá el botón "Parcial" que está al lado. Te va a pedir el monto exacto que recibiste y te muestra atajos del 25%, 50% y 75% del total para registrarlo rápido.',
      },
    ],
  },
  btn_whatsapp: {
    icon: MessageCircle,
    title: 'Enviar Recordatorio por WhatsApp',
    color: 'green',
    sections: [
      {
        heading: '¿Qué hace este botón?',
        text: 'Abre WhatsApp (o WhatsApp Web) con un mensaje pre-redactado que incluye el nombre del cliente, el número de cuota, el monto exacto y la fecha de vencimiento.',
      },
      {
        heading: '¿Por qué es útil?',
        text: 'Te ahorra escribir el mensaje manualmente para cada cliente. El mensaje ya tiene todos los datos del sistema y usa el nombre y saldo actualizados — nunca vas a enviar información desactualizada.',
      },
      {
        heading: '¿Cómo funciona?',
        text: '1. El sistema genera la URL wa.me/ con el número del cliente.\n2. Prepara el texto con los datos de la cuota.\n3. Se abre WhatsApp listo para enviar — vos solo presionás el botón de enviar.',
      },
    ],
  },
  btn_pdf: {
    icon: FileText,
    title: 'Descargar Comprobante PDF',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué genera?',
        text: 'Un comprobante de pago en formato A5 con el diseño institucional de PrestaNeo. Incluye: nombre del cliente, número de préstamo, cuota cobrada, desglose capital/interés, fecha y código QR de verificación.',
      },
      {
        heading: '¿Para qué sirve?',
        text: 'Es el recibo oficial del pago. Podés enviárselo al cliente por WhatsApp, imprimirlo o guardarlo como registro. El código QR permite verificar la autenticidad del comprobante.',
      },
      {
        heading: '¿Cómo descargarlo?',
        text: 'Andá a la sección Comprobantes → buscá el pago del cliente → presioná el botón PDF. Se descarga automáticamente en tu dispositivo.',
      },
    ],
  },
  btn_docx: {
    icon: Download,
    title: 'Exportar Reporte Word (.docx)',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué genera?',
        text: 'Un documento Word completo con 3 secciones: resumen ejecutivo de cartera con KPIs, tabla de todas las cuotas pendientes y libro de caja con cada movimiento.',
      },
      {
        heading: '¿Para qué sirve?',
        text: 'Es ideal para presentar ante un contador, un banco o como respaldo contable. También podés usarlo para revisión mensual de tu negocio o para exportar datos a Excel.',
      },
      {
        heading: '¿Cómo exportarlo?',
        text: 'En cualquier sección, buscá el botón "Exportar reporte" o "Reporte general". Se genera el archivo con los datos actuales de tu cartera y se descarga automáticamente.',
      },
    ],
  },
  btn_refinanciar: {
    icon: RefreshCcw,
    title: 'Refinanciar Préstamo',
    color: 'red',
    sections: [
      {
        heading: '¿Qué hace?',
        text: 'Crea un nuevo préstamo con las deudas pendientes del cliente anterior. Podés ajustar el capital (generalmente el saldo restante), la tasa y el número de cuotas para nuevas condiciones más manejables.',
      },
      {
        heading: '¿Cuándo usarlo?',
        text: 'Cuando un cliente está en mora y no puede pagar. La refinanciación reestructura la deuda con cuotas más pequeñas o un plazo más largo, evitando que la mora se acumule y el cliente abandone.',
      },
      {
        heading: '¿Qué pasa con el préstamo viejo?',
        text: 'El préstamo original sigue registrado en el historial. La refinanciación crea uno nuevo — coordiná con el cliente que el préstamo anterior queda saldado con el nuevo acuerdo.',
      },
    ],
  },

  /* ── CAJA ────────────────────────────────────── */
  caja: {
    icon: Wallet,
    title: 'Caja y Movimientos',
    color: 'green',
    sections: [
      {
        heading: '¿Qué muestra esta sección?',
        text: 'El libro de caja con todos los movimientos de dinero: entradas (cobros de cuotas) y salidas (préstamos desembolsados). Podés buscar, filtrar por tipo y ver el resumen del balance en tiempo real.',
      },
      {
        heading: '¿Cuál es la diferencia entre los 3 números del resumen?',
        text: '• Balance: lo que tenés disponible ahora (entradas − salidas)\n• Entradas: total cobrado a clientes hasta hoy\n• Salidas: total prestado hasta hoy\n\nSi el balance es negativo significa que tenés más plata en la calle que lo que recuperaste — no es un problema, es tu capital trabajando.',
      },
      {
        heading: '¿Cómo genero un reporte?',
        text: 'Presioná "Generar reporte" arriba a la derecha. Podés elegir Word (.docx) o Excel (.xlsx), seleccionar si querés datos de un cliente específico o de todo, y filtrar por período (últimos 30 días, 90 días o todo).',
      },
    ],
  },

  /* ── CLIENTES / SCORE ────────────────────────── */
  clientes: {
    icon: Users,
    title: 'Cartera de Clientes',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué muestra?',
        text: 'Todos los clientes con préstamos activos o en mora, con su score crediticio interno calculado desde el historial real de pagos dentro de PrestaNeo.',
      },
      {
        heading: '¿Qué es el Score Crediticio?',
        text: 'Un número entre 300 y 850 que indica qué tan buen pagador es el cliente basado en su historial en tu cartera. Verde (720–850) = paga a tiempo. Amarillo (580–719) = demoras leves. Rojo (300–579) = alto riesgo.',
      },
      {
        heading: '¿Cómo se calcula el score?',
        text: 'Se basa en: % de cuotas pagadas a tiempo, cantidad de préstamos completados, y penalización si está actualmente en mora. Sube con cada cuota puntual y baja con cada mora.',
      },
    ],
  },
  score_crediticio: {
    icon: Star,
    title: 'Score Crediticio Interno',
    color: 'green',
    sections: [
      {
        heading: '¿Qué significa el número?',
        text: '• 720–850 (verde) "Paga a tiempo": cliente confiable, historial impecable.\n• 580–719 (amarillo) "Demoras leves": paga pero a veces tarde.\n• 300–579 (rojo) "Alto riesgo": mora frecuente o deuda actual en mora.',
      },
      {
        heading: '¿Por qué usarlo?',
        text: 'Te ayuda a decidir si darle un nuevo préstamo a un cliente y con qué condiciones. A menor score, conviene pedir una tasa más alta o cuotas más frecuentes para reducir el riesgo.',
      },
      {
        heading: '¿Es el score BCRA/Veraz?',
        text: 'No. Es un score INTERNO calculado exclusivamente con el historial de pagos dentro de PrestaNeo. No consulta ni impacta en el score financiero externo del cliente.',
      },
    ],
  },

  /* ── ALERTAS ─────────────────────────────────── */
  alertas: {
    icon: Bell,
    title: 'Alertas y Vencimientos',
    color: 'red',
    sections: [
      {
        heading: '¿Qué muestra?',
        text: 'Las cuotas que están vencidas, que vencen hoy o que vencen en las próximas 48 horas. Se ordenan por urgencia: primero mora, luego hoy, luego próximas.',
      },
      {
        heading: '¿Cómo interpretar los colores?',
        text: '• Rojo: cuota vencida (mora activa). Actuar de inmediato.\n• Amarillo: vence hoy. Prioridad alta.\n• Azul: vence en 1–2 días. Enviar recordatorio por WhatsApp.',
      },
      {
        heading: '¿Qué hacer con cada alerta?',
        text: 'Usá el botón "Cobrar" si recibiste el dinero, el ícono WhatsApp para enviar recordatorio, o el teléfono para llamar directamente. Las alertas desaparecen cuando marcás la cuota como pagada.',
      },
    ],
  },

  /* ── ESTADÍSTICAS ────────────────────────────── */
  estadisticas: {
    icon: PieChart,
    title: 'Estadísticas de Cartera',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué muestra?',
        text: 'Métricas avanzadas de tu operación: tasa de cobro, índice de morosidad, ticket promedio, total cobrado histórico y un ranking de clientes por saldo pendiente.',
      },
      {
        heading: '¿Qué es la Tasa de Mora?',
        text: 'Es el porcentaje de préstamos activos que están en estado "En mora". Si tenés 10 préstamos y 2 están atrasados, la mora es 20%. Mantenerla por debajo del 10% es una señal de cartera sana.',
      },
      {
        heading: '¿Para qué sirve el Calendario Semanal?',
        text: 'Muestra cuántas cuotas vencen cada día de la próxima semana y el monto total a cobrar. Usalo para planificar tu ruta de cobro y saber cuáles días vas a estar más ocupado.',
      },
    ],
  },

  /* ── RUTA DE COBRO ───────────────────────────── */
  ruta: {
    icon: Route,
    title: 'Ruta de Cobro Diaria',
    color: 'green',
    sections: [
      {
        heading: '¿Qué es?',
        text: 'Una vista operativa enfocada exclusivamente en los clientes a los que tenés que cobrar HOY. Incluye cuotas que vencen hoy y las que ya están vencidas.',
      },
      {
        heading: '¿Cómo se ordena la lista?',
        text: 'Primero aparecen los clientes en mora (más urgentes), luego los de hoy, ordenados de mayor a menor monto. Los de mayor importe tienen prioridad para maximizar el recupero diario.',
      },
      {
        heading: '¿Qué hacer en campo?',
        text: '1. Revisá la lista al salir a cobrar.\n2. Por cada cliente: intentá cobrar → marcá "Cobrar" si lo lográs.\n3. Si no están: enviá WhatsApp o llamá desde la misma pantalla.\n4. Seguí el progreso con la barra del día.',
      },
    ],
  },

  /* ── COBRANZAS ───────────────────────────────── */
  cobros: {
    icon: HandCoins,
    title: 'Sección Cobranzas',
    color: 'green',
    sections: [
      {
        heading: '¿Qué es esta sección?',
        text: 'Acá están todas las cuotas pendientes de cobrar, organizadas por cliente. Podés expandir cada cliente para ver todas sus cuotas activas y actuar sobre cada una.',
      },
      {
        heading: '¿Por qué usarla?',
        text: 'Es el lugar principal para registrar los pagos del día. Cada cuota que marcás como pagada actualiza automáticamente la caja, el préstamo y genera el comprobante.',
      },
      {
        heading: '¿Cómo navegar?',
        text: 'Usá los filtros (Pendiente, Vencido, Parcial) para ordenar la vista. Tocá el nombre de un cliente para expandir sus cuotas. Usá los botones Cobrar, Parcial o WhatsApp para cada cuota.',
      },
    ],
  },

  /* ── COMPROBANTES ────────────────────────────── */
  comprobantes: {    icon: ReceiptText,
    title: 'Centro de Comprobantes',
    color: 'purple',
    sections: [
      {
        heading: '¿Qué encontrás aquí?',
        text: 'Todos los recibos de cobro ordenados por cliente, con la fecha, el monto, el desglose de capital e interés y el método de pago. Podés descargarlo como PDF individual o exportar todo como reporte.',
      },
      {
        heading: '¿Cuándo aparece un comprobante?',
        text: 'Automáticamente al marcar una cuota como "Cobrada" o "Parcial". No necesitás hacer nada más — el sistema genera el recibo con todos los datos del momento del cobro.',
      },
      {
        heading: '¿Qué hace el botón "Generar reporte"?',
        text: 'Abre el asistente de exportación donde podés elegir: formato Word o Excel, período (30/90 días o todo el historial), y si querés los datos de un cliente específico o de toda la cartera.',
      },
    ],
  },

  /* ── MÓDULO PRÉSTAMOS ─────────────────────── */
  p_inicio: {
    icon: LayoutDashboard,
    title: 'Inicio — Préstamos',
    color: 'green',
    sections: [
      { heading: '¿Qué muestra esta pantalla?', text: 'Tu resumen operativo de préstamos: capital en calle, cobrado hoy, lo que falta cobrar, caja disponible y los cobros urgentes del día.' },
      { heading: '¿Cómo empezar?', text: 'Tocá "Nuevo préstamo" para registrar uno nuevo. En segundos el sistema calcula las cuotas y arma el cronograma completo.' },
      { heading: '¿Qué son los cobros urgentes?', text: 'Cuotas que vencen hoy o ya vencidas. Podés marcarlas como pagadas directamente desde acá o ir a "Ruta del día" para gestionarlas todas.' },
    ],
  },
  p_nuevo: {
    icon: Plus,
    title: 'Nuevo Préstamo',
    color: 'green',
    sections: [
      { heading: '¿Qué hace esta sección?', text: 'Registra un préstamo de dinero en efectivo a un cliente. Ingresás el capital, la tasa y las cuotas — el sistema calcula todo automáticamente.' },
      { heading: '¿Qué es el interés directo (flat)?', text: 'La tasa se aplica sobre el capital original, no sobre el saldo. Si prestás $100.000 al 20%, el interés total es siempre $20.000 sin importar cuándo paguen.' },
      { heading: '¿Cómo genero el comprobante?', text: 'Una vez creado el préstamo, andá a Clientes → tocá el cliente → tocá el préstamo → botón "Comprobante Word". Descarga el cronograma completo listo para firmar.' },
    ],
  },
  p_ruta: {
    icon: Route,
    title: 'Ruta del Día',
    color: 'green',
    sections: [
      { heading: '¿Qué muestra la ruta?', text: 'Los cobros de HOY: cuotas que vencen hoy y cuotas ya vencidas. Aparecen ordenadas de mayor urgencia a menor para que empieces por lo más importante.' },
      { heading: '¿Cómo usarla en campo?', text: '1. Abrila al salir a cobrar.\n2. Cobrás → tocás "Cobrar".\n3. No están → enviás WhatsApp o llamás desde el mismo botón.\n4. La barra de progreso muestra cuánto llevás del día.' },
      { heading: '¿Incluye también ventas a crédito?', text: 'Sí. Si tenés ambos módulos activos, la ruta unifica cuotas de préstamos en efectivo y de ventas en un solo lugar, con badges de color para distinguirlos.' },
    ],
  },
  p_clientes: {
    icon: Users,
    title: 'Clientes — Préstamos',
    color: 'green',
    sections: [
      { heading: '¿Qué muestra cada tarjeta?', text: 'Nombre, teléfono, score crediticio calculado de su historial de pagos, capital prestado y progreso de cuotas.' },
      { heading: '¿Qué es la ficha de cliente?', text: 'Al tocar "Ver ficha" accedés a su historial completo: todos los préstamos, compras a crédito, deuda total pendiente y acciones directas (WhatsApp, volver a prestar, archivar).' },
      { heading: '¿Qué pasa si archivás un cliente?', text: 'No se borra. Se mueve a la Papelera con todos sus datos e historial intactos. Podés restaurarlo cuando quieras desde la sección Papelera.' },
    ],
  },
  p_papelera: {
    icon: Trash2,
    title: 'Papelera de Clientes',
    color: 'red',
    sections: [
      { heading: '¿Qué es la papelera?', text: 'Clientes que archivaste. No se borraron — siguen teniendo su historial de préstamos, pagos y datos personales guardados.' },
      { heading: '¿Cuándo usar esto?', text: 'Cuando un cliente termina de pagar y no va a volver, o cuando querés sacar clientes inactivos de la lista principal sin perder el registro.' },
      { heading: '¿Puedo restaurarlos?', text: 'Sí, con el botón "Restaurar cliente". El cliente vuelve a aparecer en la lista activa con todo su historial como si nada.' },
    ],
  },
  p_caja: {
    icon: Wallet,
    title: 'Caja — Préstamos',
    color: 'green',
    sections: [
      { heading: '¿Qué registra la caja?', text: 'Entradas: cobros de cuotas. Salidas: dinero prestado (desembolsos). El balance es la diferencia: lo que tenés disponible para prestar.' },
      { heading: '¿Se actualiza sola?', text: 'Sí. Cada vez que marcás una cuota como pagada o creás un préstamo, la caja se actualiza automáticamente. No tenés que ingresar nada manualmente.' },
      { heading: '¿Cómo exporto un reporte?', text: 'Tocá "Generar reporte". Podés elegir Word o Excel, filtrando por período o por cliente. El Word incluye cronograma y el Excel tiene 3 hojas para analizar.' },
    ],
  },

  /* ── MÓDULO VENTAS ────────────────────────── */
  v_inicio: {
    icon: Store,
    title: 'Inicio — Ventas',
    color: 'purple',
    sections: [
      { heading: '¿Qué muestra esta pantalla?', text: 'Resumen de tu operación de ventas: total vendido, anticipo cobrado, monto financiado activo y las últimas ventas registradas.' },
      { heading: '¿Cómo empezar?', text: 'Primero agregá tus productos al Catálogo. Luego tocá "Nueva venta" para registrar una venta con anticipo y cuotas a medida.' },
      { heading: '¿Las ventas y préstamos se mezclan?', text: 'No. Son dos módulos separados. Las cuotas de las ventas sí aparecen en la Ruta del Día junto con las de préstamos, pero con un badge de color diferente.' },
    ],
  },
  v_catalogo: {
    icon: Package,
    title: 'Catálogo de Productos',
    color: 'purple',
    sections: [
      { heading: '¿Qué es el catálogo?', text: 'El inventario de artículos disponibles para vender. Cada producto tiene nombre, categoría, precio de contado, costo y stock.' },
      { heading: '¿Para qué sirve el precio de costo?', text: 'Para calcular tu margen de ganancia. No lo ve el cliente — es solo para tu control interno.' },
      { heading: '¿Qué pasa con el stock?', text: 'Cuando registrás una venta, el sistema descuenta el stock automáticamente. Los productos con stock 0 no aparecen al crear una nueva venta.' },
    ],
  },
  v_nueva: {
    icon: ShoppingCart,
    title: 'Nueva Venta a Crédito',
    color: 'purple',
    sections: [
      { heading: '¿Cómo funciona?', text: 'Elegís uno o más productos del catálogo, registrás al cliente, el anticipo que entregó y configurás el financiamiento del resto en cuotas.' },
      { heading: '¿Qué es el monto financiado?', text: 'Total del artículo menos el anticipo. Eso es lo que se divide en cuotas con el interés que vos definas.' },
      { heading: '¿Puedo vender sin financiamiento?', text: 'Sí. Si el anticipo es igual al precio total, el monto financiado queda en $0 y no se generan cuotas. Solo se registra la venta.' },
    ],
  },
  v_ventas: {
    icon: Store,
    title: 'Historial de Ventas',
    color: 'purple',
    sections: [
      { heading: '¿Qué muestra el historial?', text: 'Todas las ventas a crédito registradas, con el detalle de los productos, anticipo, monto financiado y estado del crédito asociado.' },
      { heading: '¿Cómo cobro las cuotas?', text: 'Las cuotas de cada venta aparecen en la "Ruta del Día" junto con las de préstamos. Marcalas como pagadas desde ahí.' },
      { heading: '¿Puedo contactar al cliente?', text: 'Sí. En cada tarjeta de venta hay un botón de WhatsApp que abre el chat con el cliente con un mensaje de contacto pre-armado.' },
    ],
  },
  v_clientes: {
    icon: Users,
    title: 'Clientes — Ventas',
    color: 'purple',
    sections: [
      { heading: '¿Qué muestra la ficha del cliente?', text: 'Historial de todas sus compras a crédito, productos adquiridos, deuda pendiente total y sus datos de contacto.' },
      { heading: '¿Puedo hacerle otra venta?', text: 'Sí. Desde la ficha del cliente usá el botón "Volver a prestar" que lleva a Nueva Venta con sus datos ya precargados.' },
      { heading: '¿Puedo archivar un cliente?', text: 'Sí. El cliente se mueve a la Papelera con todo su historial intacto. Podés restaurarlo cuando quieras.' },
    ],
  },
  v_caja: {
    icon: Wallet,
    title: 'Caja — Ventas',
    color: 'purple',
    sections: [
      { heading: '¿Qué muestra?', text: 'Los anticipos y cuotas cobrados por ventas, el importe financiado que sigue pendiente y los movimientos de caja asociados al módulo de ventas.' },
      { heading: '¿Cómo leer el resumen?', text: 'Disponible ahora refleja entradas menos salidas registradas. Pendiente de cobro suma las cuotas de ventas todavía abiertas. La proyección agrega ese saldo pendiente al disponible actual.' },
      { heading: '¿Cómo exportar?', text: 'Abrí Generar reporte para descargar los movimientos de ventas y su resumen. Revisá el período elegido antes de guardar el archivo.' },
    ],
  },
}

/* ─── Pasos del Tour guiado ──────────────────── */
const TOUR_STEPS = [
  {
    id: 'dashboard',
    target: 'dashboard',
    title: '1 de 6 · Panel de Resumen',
    text: 'Acá está el corazón de la app. Cada mañana empezá acá: revisá cuánto dinero tenés prestado, cuánto se ganó en intereses y quiénes tienen cuotas vencidas.',
    position: 'right',
  },
  {
    id: 'ruta',
    target: 'ruta',
    title: '2 de 6 · Ruta de Cobro',
    text: 'Tu lista de cobros del día. Cuando salís a cobrar, abrí esta sección: te muestra cada cliente que debés visitar hoy, el monto y botones directos para WhatsApp o llamada.',
    position: 'right',
  },
  {
    id: 'prestamos',
    target: 'prestamos',
    title: '3 de 6 · Préstamos',
    text: 'Acá están todos tus préstamos activos e historial completo. Podés emitir uno nuevo con el botón "Emitir préstamo" y refinanciar los que estén en mora.',
    position: 'right',
  },
  {
    id: 'clientes',
    target: 'clientes',
    title: '4 de 6 · Clientes',
    text: 'El listado de clientes con su score crediticio calculado de su historial de pagos. Verde = buen pagador. Rojo = alto riesgo. Usá "Volver a prestar" para darles un nuevo préstamo sin re-ingresar datos.',
    position: 'right',
  },
  {
    id: 'alertas',
    target: 'alertas',
    title: '5 de 6 · Alertas',
    text: 'Cuotas en mora o próximas a vencer (48hs). El número rojo en el ícono del menú te avisa cuántas alertas activas hay. Atendelas diariamente para mantener la mora bajo control.',
    position: 'right',
  },
  {
    id: 'caja',
    target: 'caja',
    title: '6 de 6 · Caja y Reportes',
    text: 'Todos los movimientos de dinero organizados por cliente. Al final del mes, usá "Exportar reporte" para generar un Word con tu balance completo. ¡Eso es todo, ya podés usar PrestaNeo!',
    position: 'right',
  },
]

/* ─── HelpModal ──────────────────────────────── */
function HelpModal({ contentKey, onClose }) {
  const content = HELP_CONTENT[contentKey]

  /* Escape + bloquear scroll */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!content) return null

  const colorMap = {
    purple: { border: 'rgba(179,71,255,.55)', glow: '0 0 60px rgba(179,71,255,.18)', icon: '#c785ff', bg: 'rgba(179,71,255,.09)' },
    green:  { border: 'rgba(0,255,135,.45)',  glow: '0 0 60px rgba(0,255,135,.12)',  icon: '#00ff87', bg: 'rgba(0,255,135,.07)' },
    red:    { border: 'rgba(255,77,109,.5)',  glow: '0 0 60px rgba(255,77,109,.15)', icon: '#ff6080', bg: 'rgba(255,77,109,.09)' },
  }
  const c = colorMap[content.color] ?? colorMap.purple
  const Icon = content.icon ?? HelpCircle
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  /* ── El nodo JSX del modal ─────────────────────────────── */
  const modalJSX = (
    <motion.div
      className="help-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Ayuda: ${content.title}`}
    >
      <motion.div
        className="help-modal"
        style={{ '--hm-border': c.border, '--hm-glow': c.glow, '--hm-icon': c.icon, '--hm-bg': c.bg }}
        initial={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.93, y: 24 }}
        animate={isMobile ? { opacity: 1, y: 0 }      : { opacity: 1, scale: 1,    y: 0  }}
        exit={isMobile    ? { opacity: 0, y: '70%' }   : { opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        <div className="help-modal-grip" aria-hidden="true" />

        <div className="help-modal-header">
          <div className="help-modal-icon-wrap"><Icon size={22} /></div>
          <div className="help-modal-titles">
            <p className="help-modal-eyebrow">GUÍA DE USO</p>
            <h3 className="help-modal-title">{content.title}</h3>
          </div>
          <button className="help-modal-close" onClick={onClose} aria-label="Cerrar" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="help-modal-divider" />

        <div className="help-modal-body">
          {content.sections.map((s, i) => (
            <motion.div key={i} className="help-section"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + i * 0.09, duration: 0.22 }}>
              <div className="help-section-badge" aria-hidden="true">{i + 1}</div>
              <div className="help-section-content">
                <p className="help-section-title">{s.heading}</p>
                <p className="help-section-text">{s.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="help-modal-footer">
          <motion.button className="help-understood-btn" onClick={onClose}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="button">
            <Check size={16} /> Entendido
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )

  /*
   * PORTAL: monta el modal directamente en document.body.
   * Esto lo saca del árbol de React del componente llamador
   * y rompe cualquier stacking context creado por:
   *   - transform / will-change en kpi-card (whileHover framer-motion)
   *   - z-index del sidebar o topbar
   *   - overflow: hidden en .panel o .loan-modal
   * El backdrop position:fixed funciona respecto al viewport, no al padre.
   */
  return createPortal(modalJSX, document.body)
}

/* ─── HelpBtn ────────────────────────────────────────────────
   El botón vive donde se llama.  El modal se teletransporta
   a document.body via Portal — cero interferencia con cualquier
   transform/z-index/overflow del árbol padre.
────────────────────────────────────────────────────────────── */
function HelpBtn({ contentKey, size = 'md', className = '' }) {
  const [open, setOpen] = useState(false)
  const sz = size === 'sm' ? 14 : size === 'lg' ? 18 : 16

  return (
    <>
      <button
        className={`help-btn help-btn-${size} ${className}`}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true) }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Abrir ayuda"
        title="¿Cómo funciona esto?"
        type="button"
      >
        <HelpCircle size={sz} />
      </button>

      {/* AnimatePresence controla enter/exit; el Portal lo mueve a body */}
      <AnimatePresence>
        {open && <HelpModal contentKey={contentKey} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

/* ─── Tour guiado ────────────────────────────── */
function TourModal({ step, onNext, onClose, total }) {
  const s = TOUR_STEPS[step]
  if (!s) return null
  const isLast = step === total - 1

  return (
    <motion.div
      className="tour-overlay"
      key={`tour-${step}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="tour-card"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        <div className="tour-header">
          <div className="tour-dots">
            {TOUR_STEPS.map((_, i) => (
              <div key={i} className={`tour-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>
          <button className="help-modal-close" onClick={onClose} aria-label="Cerrar tour"><X size={16}/></button>
        </div>
        <div className="tour-icon"><GraduationCap size={22}/></div>
        <h3 className="tour-title">{s.title}</h3>
        <p className="tour-text">{s.text}</p>
        <div className="tour-footer">
          <button className="secondary-button" onClick={onClose}>Saltar tour</button>
          <button className="primary-button" onClick={isLast ? onClose : onNext}>
            {isLast ? <><Check size={15}/> ¡Listo!</> : <>Siguiente <ChevronRight size={15}/></>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Hook: animación countUp ─────────────────────────────── */
function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (target == null) return
    const to = Number(target) || 0
    if (performanceModeActive) {
      raf.current = requestAnimationFrame(() => setDisplay(to))
      return () => cancelAnimationFrame(raf.current)
    }
    const start    = Date.now()
    const from     = 0
    const tick = () => {
      if (performanceModeActive) {
        setDisplay(to)
        return
      }
      const elapsed = Date.now() - start
      const pct     = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const ease    = 1 - Math.pow(1 - pct, 3)
      setDisplay(Math.round(from + (to - from) * ease))
      if (pct < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  // La preferencia global se actualiza junto con el rerender del árbol de la app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, performanceModeActive])
  return display
}

/* ─── Navegación — dos modos independientes ─────────────────
   PRÉSTAMOS: verde neón   |   VENTAS: morado neón
─────────────────────────────────────────────────────────────── */
const NAV_PRESTAMOS = [
  { id: 'p_inicio',   label: 'Inicio',          icon: LayoutDashboard },
  { id: 'p_nuevo',    label: 'Nuevo préstamo',   icon: Plus },
  { id: 'p_ruta',     label: 'Cobros',           icon: Route },
  { id: 'p_clientes', label: 'Clientes',         icon: Users },
  { id: 'p_papelera', label: 'Papelera',         icon: Trash2 },
  { id: 'p_caja',     label: 'Caja',             icon: Wallet },
]
const NAV_VENTAS = [
  { id: 'v_inicio',   label: 'Inicio',           icon: LayoutDashboard },
  { id: 'v_catalogo', label: 'Catálogo',         icon: Package },
  { id: 'v_nueva',    label: 'Nueva venta',      icon: ShoppingCart },
  { id: 'v_ventas',   label: 'Ventas',           icon: Store },
  { id: 'v_clientes', label: 'Clientes',         icon: Users },
  { id: 'v_papelera', label: 'Papelera',         icon: Trash2 },
  { id: 'v_caja',     label: 'Caja',             icon: Wallet },
]
const nav = [...NAV_PRESTAMOS, ...NAV_VENTAS]

/* ─── Micro-componentes ───────────────────────────────────── */
function Money({ value, className = '' }) { return <span className={className}>{fmt(value)}</span> }

function Status({ status }) {
  const cls = status === 'Activo' || status === 'Pagado' ? 'good'
    : status === 'En mora' || status === 'Vencido' ? 'bad'
    : status === 'Parcial' || status === 'Cancelado' ? 'warning'
    : 'neutral'
  return <span className={`status ${cls}`}><i />{status}</span>
}

function PageTitle({ eyebrow, title, description, action, actionLabel = 'Nueva operación', icon: Icon = Plus, helpKey }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow"><span />{eyebrow}</div>
        <div className="page-heading-title-row">
          <h1>{title}</h1>
          {helpKey && <HelpBtn contentKey={helpKey} size="md" />}
        </div>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary-button" onClick={action}>
          <Icon size={18} />{actionLabel}
        </button>
      )}
    </div>
  )
}

function Spinner({ size = 20, className = '' }) {
  return <Loader2 size={size} className={`spin ${className}`} aria-label="Cargando…" />
}

function SkeletonRow() {
  return (
    <tr className="skeleton-row" aria-hidden="true">
      {[1,2,3,4,5,6].map((i) => <td key={i}><div className="skeleton-cell" /></td>)}
    </tr>
  )
}

function Toast({ message, kind = 'success', onDismiss }) {
  const icons = { success: Check, error: AlertTriangle, info: Zap }
  const Icon = icons[kind] ?? Check
  return (
    <motion.div className={`toast toast-${kind}`}
      initial={{ y: 28, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 16, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 24, stiffness: 320 }}>
      <Icon size={16} />
      <span>{message}</span>
      <button className="toast-dismiss" onClick={onDismiss} aria-label="Cerrar"><X size={13} /></button>
    </motion.div>
  )
}

/* ─── Command Palette ─────────────────────────────────────── */
function CommandPalette({ loans, payments, mode = 'prestamos', onClose, onNavigate }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    if (!q.trim()) return []
    const lower = q.toLowerCase()
    const loanHits = loans.filter((l) =>
      l.client.toLowerCase().includes(lower) || l.id.toLowerCase().includes(lower)
    ).slice(0, 5).map((l) => ({ type: 'loan', id: l.id, tab: mode === 'ventas' ? 'v_clientes' : 'p_clientes', label: l.client, sub: `${l.id} · ${fmt(l.principal)}`, status: l.status }))

    const payHits = payments.filter((p) =>
      p.client.toLowerCase().includes(lower) && p.status !== 'Pagado'
    ).slice(0, 4).map((p) => ({ type: 'payment', id: p.id, tab: mode === 'ventas' ? 'v_ventas' : 'p_ruta', label: p.client, sub: `Cuota ${p.n} · ${fmt(p.amount)} · vence ${p.due}`, status: p.status }))

    return [...loanHits, ...payHits]
  }, [q, loans, payments, mode])

  const navActions = (mode === 'ventas' ? NAV_VENTAS : NAV_PRESTAMOS)
    .map(({ id, label, icon }) => ({ label: `Ir a ${label}`, sub: mode === 'ventas' ? 'Gestión de ventas' : 'Gestión de préstamos', tab: id, icon }))
    .filter((a) => !q.trim() || a.label.toLowerCase().includes(q.toLowerCase()))

  return (
    <motion.div className="cmd-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="cmd-box" initial={{ y: -24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -16, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
        <div className="cmd-search">
          <Search size={17} />
          <input ref={inputRef} placeholder="Buscar clientes, préstamos o navegar…"
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()} />
          <kbd>ESC</kbd>
        </div>
        <div className="cmd-results">
          {results.length > 0 && (
            <div className="cmd-group">
              <p className="cmd-group-label">Resultados</p>
              {results.map((r) => (
                <button key={r.id} className="cmd-item" onClick={() => {
                  onNavigate(r.tab)
                  onClose()
                }}>
                  <div className={`cmd-dot ${r.status === 'En mora' || r.status === 'Vencido' ? 'red' : r.status === 'Pagado' ? 'green' : 'purple'}`} />
                  <div>
                    <b>{r.label}</b>
                    <small>{r.sub}</small>
                  </div>
                  <Status status={r.status} />
                </button>
              ))}
            </div>
          )}
          {navActions.length > 0 && (
            <div className="cmd-group">
              <p className="cmd-group-label">Navegación</p>
              {navActions.map((a) => (
                <button key={a.tab} className="cmd-item" onClick={() => { onNavigate(a.tab); onClose() }}>
                  <a.icon size={15} className="cmd-nav-icon" />
                  <div><b>{a.label}</b><small>{a.sub}</small></div>
                  <ChevronRight size={14} className="cmd-arrow" />
                </button>
              ))}
            </div>
          )}
          {!q.trim() && (
            <p className="cmd-hint">Escribí para buscar · <kbd>↵</kbd> para navegar</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── App ──────────────────────────────────────────────────── */
export default function App() {
  const [performanceMode, setPerformanceMode] = useState(() => readPerformancePreference())
  const [tab, setTab] = useState(() => {
    // Si ya hay modo guardado, iniciar en la sección correcta
    try {
      const m = localStorage.getItem('pn-modo')
      return m === 'prestamos' ? 'p_inicio' : m === 'ventas' ? 'v_inicio' : 'dashboard'
    } catch { return 'dashboard' }
  })
  const [user, setUser]                   = useState(null)
  const [loading, setLoading]             = useState(false)
  const [authReady, setAuthReady]         = useState(false)
  const [loans, setLoans]                 = useState([])
  const [allLoans, setAllLoans]           = useState([])   // historial completo
  const [payments, setPayments]           = useState([])
  const [receipts, setReceipts]           = useState([])
  const [ledger, setLedger]               = useState([])
  const [monthBars, setMonthBars]         = useState(Array(12).fill(0))
  const [modal, setModal]                 = useState(null) // 'loan'|null
  const [partialTarget, setPartialTarget] = useState(null)
  const [editTarget, setEditTarget]       = useState(null) // cliente a editar
  const [cmdOpen, setCmdOpen]             = useState(false)
  const [tourOpen, setTourOpen]           = useState(false)
  const [tourStep, setTourStep]           = useState(0)
  const [exportOpen, setExportOpen]       = useState(false) // ExportModal
  // Módulo ventas
  const [productos, setProductos]         = useState([])
  const [movimientosStock, setMovimientosStock] = useState([])
  const [stockHistoryError, setStockHistoryError] = useState(null)
  const [ventas, setVentas]               = useState([])
  const [ventasLoading, setVentasLoading] = useState(false)
  const [rutaUnificada, setRutaUnificada] = useState([]) // cuotas efectivo+venta
  // Modo dual: null=selector | 'prestamos' | 'ventas'
  const [modo, setModo]                   = useState(() => {
    try { return localStorage.getItem('pn-modo') || null } catch { return null }
  })
  const [papelera, setPapelera]           = useState([])
  const [toast, setToast]                 = useState(null)
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [dataError, setDataError]         = useState(null)
  const [isOnline, setIsOnline]           = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [legalSection, setLegalSection]   = useState(null)
  const paymentLocks = useRef(new Set())
  const dataLoadVersion = useRef(0)

  const togglePerformanceMode = useCallback(() => {
    setPerformanceMode((current) => {
      const next = !current
      performanceModeActive = next
      try { localStorage.setItem(PERFORMANCE_MODE_KEY, next ? 'on' : 'off') } catch { /* La preferencia sigue activa durante esta sesión. */ }
      return next
    })
  }, [])

  useEffect(() => {
    performanceModeActive = performanceMode
    document.documentElement.dataset.performanceMode = performanceMode ? 'on' : 'off'
  }, [performanceMode])

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  /* ── Toasts ── */
  const showToast = useCallback((message, kind = 'success') => setToast({ message: friendlyConnectionError(message), kind }), [])
  const dismissToast = useCallback(() => setToast(null), [])
  useEffect(() => { if (!toast) return; const t = setTimeout(dismissToast, 4500); return () => clearTimeout(t) }, [toast, dismissToast])

  /* ── Auth ── */
  useEffect(() => {
    getSession().then((u) => { setUser(u); setAuthReady(true) })
    return onAuthStateChange((u) => { setUser(u); setAuthReady(true) })
  }, [])

  /* ── Carga de datos ── */
  const loadData = useCallback(async (uid) => {
    const requestVersion = ++dataLoadVersion.current
    setLoading(true)
    setDataError(null)
    try {
      const [cartera, historial, bars, prods, vtas, rutaUni, stockResult] = await Promise.all([
        cargarCarteraCompleta(uid),
        cargarHistorialPrestamos(uid),
        cobradoPorMes(uid),
        cargarProductos(uid),
        cargarVentas(uid),
        cargarCuotasUnificadas(uid),
        cargarMovimientosStock(uid).then(data => ({ data })).catch(error => ({ error })),
      ])
      if (requestVersion !== dataLoadVersion.current) return
      setLoans(cartera.loans)
      setPayments(cartera.payments)
      setLedger(cartera.ledger)
      setReceipts(cartera.receipts)
      setAllLoans(historial)
      setMonthBars(bars)
      setProductos(prods)
      setMovimientosStock(stockResult.data ?? [])
      setStockHistoryError(stockResult.error ? 'Falta aplicar la migración de historial de inventario en Supabase.' : null)
      setVentas(vtas)
      setRutaUnificada(rutaUni)
    } catch (err) {
      if (requestVersion !== dataLoadVersion.current) return
      const message = friendlyConnectionError(err.message)
      setDataError(message)
      showToast(message, 'error')
    } finally {
      if (requestVersion === dataLoadVersion.current) setLoading(false)
    }
  }, [showToast])

  const handleDeleteCashMovements = useCallback(async (movementIds, options = {}) => {
    if (!user || (!movementIds?.length && !(options.bulk && ['prestamos', 'ventas'].includes(options.mode)))) return false
    try {
      const affectedCount = await anularMovimientosCaja(movementIds, options.bulk ? options.mode : null, options.reason)
      await loadData(user.id)
      showToast(affectedCount === 1 ? 'Movimiento anulado; quedó guardado en el historial' : `${affectedCount} movimientos anulados y guardados en el historial`)
      return true
    } catch (err) {
      showToast(`No se pudieron eliminar los movimientos: ${err.message}`, 'error')
      return false
    }
  }, [user, loadData, showToast])

  const handleRestoreCashMovement = useCallback(async (movementId) => {
    if (!user || !movementId) return false
    try {
      await restaurarMovimientoCaja(movementId)
      await loadData(user.id)
      showToast('Movimiento restaurado en Caja')
      return true
    } catch (err) {
      showToast(`No se pudo restaurar el movimiento: ${err.message}`, 'error')
      return false
    }
  }, [user, loadData, showToast])

  // Sincroniza las colecciones de Supabase cuando cambia la sesión.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadData(user.id) }, [user, loadData])

  /* ── Cmd+K ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── Separación de carteras por origen ── */
  // Solo préstamos en efectivo → alimentan el módulo PRÉSTAMOS
  const loansEfectivo   = useMemo(() => loans.filter(l => (l.origen ?? 'efectivo') === 'efectivo'), [loans])
  const allLoansEfectivo = useMemo(() => allLoans.filter(l => (l.origen ?? 'efectivo') === 'efectivo'), [allLoans])
  // Solo cuotas de préstamos en efectivo
  const paymentsEfectivo = useMemo(() => payments.filter(p => (p.origen ?? 'efectivo') === 'efectivo'), [payments])
  const receiptsEfectivo = useMemo(() => receipts.filter(r => (r.origen ?? 'efectivo') === 'efectivo'), [receipts])
  // Separar ledger por módulo
  const ledgerEfectivo = useMemo(() => ledger.filter(m => (m.origen ?? 'efectivo') === 'efectivo'), [ledger])
  const ledgerVentas   = useMemo(() => ledger.filter(m => m.origen === 'venta'), [ledger])

  /* ── Totales — módulo Préstamos (solo efectivo) ── */
  const totals = useMemo(() => {
    const principal    = loansEfectivo.reduce((s, l) => s + Number(l.principal), 0)
    const returnTotal  = loansEfectivo.reduce((s, l) => s + Number(l.principal) * (1 + Number(l.rate) / 100), 0)
    const caja         = ledgerEfectivo.filter(m => !m.voided).reduce((s, m) => s + (m.type === 'Entrada' ? m.amount : -m.amount), 0)
    const delinquent   = loansEfectivo.filter((l) => l.status === 'En mora').length
    const cobradoHoy   = receiptsEfectivo.filter((r) => r.paidAt?.slice(0, 10) === today).reduce((s, r) => s + Number(r.amount), 0)
    const pendingAmount = paymentsEfectivo.filter((p) => ['Pendiente','Vencido','Parcial'].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0)
    const mesActual    = monthBars[11] ?? 0
    const mesAnterior  = monthBars[10] ?? 0
    const cambioMes    = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior * 100).toFixed(1) : null
    return { principal, returnTotal, interest: returnTotal - principal, caja, delinquency: loansEfectivo.length ? (delinquent / loansEfectivo.length) * 100 : 0, cobradoHoy, pendingAmount, cambioMes }
  }, [loansEfectivo, paymentsEfectivo, ledgerEfectivo, receiptsEfectivo, monthBars])

  /* ── Totales — módulo Ventas (solo ventas) ── */
  const totalsVentas = useMemo(() => {
    const caja = ledgerVentas.filter(m => !m.voided).reduce((s, m) => s + (m.type === 'Entrada' ? m.amount : -m.amount), 0)
    return { ...totals, caja }
  }, [totals, ledgerVentas])

  /* ── Acciones ── */
  const handleSignIn  = async () => { try { await signInWithGoogle() } catch (e) { showToast(e.message, 'error') } }
  const handleSignOut = async () => {
    try {
      await supabaseSignOut()
      dataLoadVersion.current += 1
      setLoans([]); setPayments([]); setLedger([]); setReceipts([])
      setAllLoans([]); setMonthBars(Array(12).fill(0))
      setProductos([]); setVentas([]); setRutaUnificada([]); setPapelera([])
      setModo(null); setTab('dashboard'); setModal(null); setDataError(null)
      try { localStorage.removeItem('pn-modo') } catch { /* El almacenamiento puede estar deshabilitado. */ }
    } catch (e) { showToast(e.message, 'error') }
  }

  const handlePay = async (payment, status, amount = payment.amount) => {
    if (!user) { showToast('Debes iniciar sesión', 'error'); return false }
    if (status !== 'Pagado' && status !== 'Parcial') return false
    const importeNum = Number(amount)
    if (!Number.isFinite(importeNum) || importeNum <= 0) { showToast('El importe debe ser mayor a cero.', 'error'); return false }
    if (importeNum > Number(payment.amount) + 0.005) { showToast('El importe supera el saldo pendiente de la cuota.', 'error'); return false }
    if (paymentLocks.current.has(payment.id)) return false
    paymentLocks.current.add(payment.id)
    try {
      const pago = await registrarPago(payment, importeNum)
      if ('vibrate' in navigator) navigator.vibrate(status === 'Pagado' ? [24,30,24] : 18)
      const finalStatus = status === 'Parcial' && importeNum >= Number(payment.amount) ? 'Pagado' : status
      setPayments((prev) => prev.map((p) => {
        if (p.id !== payment.id) return p
        if (finalStatus === 'Pagado') return null
        return { ...p, status: 'Parcial', amount: Math.max(0, Number(p.amount) - importeNum) }
      }).filter(Boolean))
      setReceipts((prev) => [{ id: pago.referencia, loanId: payment.loanId, client: payment.client, phone: payment.phone, amount: importeNum, capital: pago.capital, interest: pago.interes, due: payment.due, paidAt: new Date().toISOString(), status: 'Pagado', n: payment.n, method: 'efectivo', origen: payment.origen ?? 'efectivo' }, ...prev])
      setLedger((prev) => [{ id: pago.movimientoCajaId ?? pago.referencia, label: `Cobro · ${payment.client}`, type: 'Entrada', amount: importeNum, time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), rawDate: new Date().toISOString(), origen: (payment.origen ?? 'efectivo') }, ...prev])
      const paidIncrement = finalStatus === 'Pagado' ? 1 : 0
      const advanceLoan = (loan) => {
        if (loan.id !== payment.loanId) return loan
        const paid = Math.min(Number(loan.installments) || Number.MAX_SAFE_INTEGER, (Number(loan.paid) || 0) + paidIncrement)
        return {
          ...loan,
          paid,
          totalRecuperado: (Number(loan.totalRecuperado) || 0) + importeNum,
          status: paidIncrement && paid >= Number(loan.installments) ? 'Pagado' : loan.status,
        }
      }
      setLoans((prev) => prev.map(advanceLoan))
      setAllLoans((prev) => prev.map(advanceLoan))
      showToast(finalStatus === 'Pagado' ? `✓ Pago registrado · Recibo ${pago.referencia}` : 'Pago parcial registrado')
      return true
    } catch (err) { showToast(`No se pudo registrar: ${err.message}`, 'error'); return false }
    finally { paymentLocks.current.delete(payment.id) }
  }

  const handleCreateLoan = async (form) => {
    if (!user) { showToast('Debes iniciar sesión', 'error'); return }
    try {
      const { dbResult, reference } = await crearPrestamo(user.id, form)
      const newLoan = { id: reference, dbId: dbResult.prestamo_id, clienteId: dbResult.cliente_id, client: form.client, dni: form.dni || '', phone: form.phone, address: form.address || '', risk: String(form.risk).toLowerCase(), principal: form.principal, rate: form.rate, installments: form.installments, installment: form.schedule[0]?.monto_cuota ?? 0, paid: 0, status: 'Activo', next: form.schedule[0]?.fecha_vencimiento ?? form.firstDue, createdAt: new Date().toISOString(), origen: 'efectivo' }
      const newPayments = (dbResult.cuotas ?? form.schedule).map((q) => ({ id: q.id ?? `${reference}-${q.numero ?? q.numero_cuota}`, loanId: reference, client: form.client, phone: form.phone, amount: Number(q.monto ?? q.monto_cuota), capital: Number(q.capital ?? q.capital_cuota), interest: Number(q.interes ?? q.interes_cuota), due: q.fecha_vencimiento, status: 'Pendiente', n: q.numero ?? q.numero_cuota, totalQuotas: form.installments, origen: 'efectivo' }))
      setLoans((prev) => [newLoan, ...prev])
      setAllLoans((prev) => [{ ...newLoan, totalRecuperado: 0 }, ...prev])
      setPayments((prev) => [...newPayments, ...prev])
      setLedger((prev) => [{ id: dbResult.movimiento_caja_id ?? `MOV-${Date.now()}`, label: `Desembolso · ${form.client}`, type: 'Salida', amount: form.principal, time: 'Ahora', rawDate: new Date().toISOString(), origen: 'efectivo' }, ...prev])
      setModal(null); setTab('p_clientes')
      showToast(`Préstamo ${reference} creado`)
    } catch (err) { showToast(`No se pudo crear: ${err.message}`, 'error') }
  }

  const handleEditClient = async (campos) => {
    if (!editTarget) return
    try {
      await actualizarCliente(editTarget.clienteId, campos)
      setLoans((prev) => prev.map((l) => l.clienteId === editTarget.clienteId ? { ...l, client: campos.nombre, phone: campos.telefono, dni: campos.dni, address: campos.direccion, risk: campos.riesgo.toLowerCase() } : l))
      setAllLoans((prev) => prev.map((l) => l.clienteId === editTarget.clienteId ? { ...l, client: campos.nombre, phone: campos.telefono, dni: campos.dni, risk: campos.riesgo.toLowerCase() } : l))
      setEditTarget(null)
      showToast(`Cliente ${campos.nombre} actualizado`)
    } catch (err) { showToast(`No se pudo actualizar: ${err.message}`, 'error') }
  }

  /* handleCreateVenta — crea venta a crédito y actualiza estado local */
  const handleCreateVenta = async (form) => {
    if (!user) { showToast('Debes iniciar sesión', 'error'); return }
    setVentasLoading(true)
    try {
      const result = await crearVentaCredito(user.id, form)

      // Construir objeto local de la nueva venta
      const nuevaVenta = {
        id:              result.ventaId,
        referencia:      result.refVenta,
        clienteId:       result.clienteId,
        client:          form.client,
        phone:           form.phone,
        montoTotal:      Number(form.montoTotal),
        anticipo:        Number(form.anticipo ?? 0),
        montoFinanciado: Number(form.montoTotal) - Number(form.anticipo ?? 0),
        fechaVenta:      form.fechaVenta,
        estado:          'activo',
        items:           form.items,
        prestamo: {
          id:         result.prestamoId,
          referencia: result.refPrestamo,
          estado:     'activo',
          cuotas:     form.installments,
          montoCuota: form.schedule[0]?.monto_cuota ?? 0,
        },
        createdAt: new Date().toISOString(),
      }
      setVentas(prev => [nuevaVenta, ...prev])
      setAllLoans(prev => [{
        id: result.refPrestamo,
        dbId: result.prestamoId,
        clienteId: result.clienteId,
        client: form.client,
        phone: form.phone,
        principal: Number(form.montoTotal) - Number(form.anticipo ?? 0),
        rate: Number(form.rate),
        installments: Number(form.installments),
        paid: 0,
        totalRecuperado: 0,
        status: 'Activo',
        next: form.schedule[0]?.fecha_vencimiento ?? form.firstDue,
        createdAt: new Date().toISOString(),
        origen: 'venta',
      }, ...prev])

      // Descuentar stock localmente
      setProductos(prev => prev.map(p => {
        const item = form.items.find(i => i.productoId === p.id)
        return item ? { ...p, stock: Math.max(0, p.stock - item.cantidad) } : p
      }))

      // Cuotas para cobros
      const newPayments = (result.cuotas ?? form.schedule).map(q => ({
        id:          q.id ?? `${result.refPrestamo}-${q.numero ?? q.numero_cuota}`,
        loanId:      result.refPrestamo,
        client:      form.client,
        phone:       form.phone,
        amount:      Number(q.monto ?? q.monto_cuota),
        capital:     Number(q.capital ?? q.capital_cuota),
        interest:    Number(q.interes ?? q.interes_cuota),
        due:         q.fecha_vencimiento,
        status:      'Pendiente',
        n:           q.numero ?? q.numero_cuota,
        totalQuotas: form.installments,
        origen:      'venta',
        productoLabel: form.items.length === 1
          ? form.items[0].nombre
          : `${form.items.length} artículos`,
        ventaRef: result.refVenta,
      }))
      setPayments(prev => [...newPayments, ...prev])
      setRutaUnificada(prev => [...newPayments, ...prev])

      // Caja
      if (Number(form.anticipo ?? 0) > 0) {
        setLedger(prev => [{
          id:      result.movimientoCajaId ?? `ANT-${Date.now()}`,
          label:   `Anticipo · ${form.client}`,
          type:    'Entrada',
          amount:  Number(form.anticipo),
          time:    'Ahora',
          rawDate: new Date().toISOString(),
          origen:  'venta',
        }, ...prev])
      }

      setModal(null)
      setTab('v_ventas')
      showToast(`Venta ${result.refVenta} registrada`)
    } catch (err) {
      showToast(`No se pudo registrar la venta: ${err.message}`, 'error')
    } finally {
      setVentasLoading(false)
    }
  }

  /* ── Elegir modo: guarda en localStorage ── */
  const elegirModo = (m) => {
    try { localStorage.setItem('pn-modo', m) } catch { /* La sesión sigue funcionando sin persistencia local. */ }
    setModo(m)
    setTab(m === 'prestamos' ? 'p_inicio' : 'v_inicio')
  }

  /* ── Papelera de clientes ── */
  const handleArchivarCliente = async (clienteId, nombre) => {
    try {
      await archivarCliente(clienteId)
      // Sincronizar ventas, préstamos, cuotas y estadísticas con el cliente archivado.
      await loadData(user.id)
      setPapelera(await cargarPapelera(user.id))
      showToast(`${nombre} movido a la papelera`)
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  const handleRestaurarCliente = async (clienteId, nombre) => {
    try {
      await restaurarCliente(clienteId)
      setPapelera(prev => prev.filter(c => c.id !== clienteId))
      showToast(`${nombre} restaurado`)
      await loadData(user.id) // recargar para que aparezca en activos
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  const handleEliminarClientePermanente = async (clienteId, nombre) => {
    try {
      await eliminarClientePermanente(clienteId)
      setPapelera(prev => prev.filter(c => c.id !== clienteId))
      showToast(`${nombre} eliminado permanentemente`)
      await loadData(user.id)
    } catch (err) { showToast(`No se pudo eliminar: ${err.message}`, 'error') }
  }

  const handleExportFichaCliente = async (clienteId) => {
    try {
      const ficha = await cargarFichaCliente(clienteId, user.id)
      const { exportFichaClienteDocx } = await import('./utils/reportDocx')
      await exportFichaClienteDocx(ficha)
      showToast('Reporte Word del cliente descargado')
    } catch (err) { showToast(`No se pudo generar el Word: ${err.message}`, 'error') }
  }

  const handleExportClienteActivo = async (cliente, origen = 'prestamos') => {
    try {
      if (origen === 'ventas') {
        const ventasCliente = ventas.filter(v => v.clienteId === cliente.clienteId)
        const refs = ventasCliente.flatMap(v => [v.referencia, v.prestamo?.referencia]).filter(Boolean)
        const ledgerCliente = ledgerVentas.filter(m => !m.voided && refs.some(ref => m.label?.includes(ref)))
        const loansCliente = allLoans.filter(l => ventasCliente.some(v => v.prestamo?.referencia === l.id))
        const paymentsCliente = payments.filter(p => ventasCliente.some(v => v.prestamo?.referencia === p.loanId))
        const { exportReportDocxVentas } = await import('./utils/reportDocx')
        await exportReportDocxVentas({ ventas: ventasCliente, ledger: ledgerCliente, loans:loansCliente, payments:paymentsCliente, titulo: `Ficha de ${cliente.client}` })
      } else {
        const loansCliente = allLoansEfectivo.filter(l => l.clienteId === cliente.clienteId || l.client === cliente.client)
        const paysCliente = paymentsEfectivo.filter(p => p.client === cliente.client)
        const loanRefs = loansCliente.map(l => l.id).filter(Boolean)
        const ledgerCliente = ledgerEfectivo.filter(m => !m.voided && loanRefs.some(ref => m.label?.includes(ref)))
        const { exportReportDocxPrestamos } = await import('./utils/reportDocx')
        await exportReportDocxPrestamos({ loans: loansCliente, payments: paysCliente, ledger: ledgerCliente, titulo: `Ficha de ${cliente.client}` })
      }
      showToast('Reporte Word del cliente descargado')
    } catch (err) { showToast(`No se pudo generar el Word: ${err.message}`, 'error') }
  }

  const handleExportVentaDocx = async (venta) => {
    try {
      const refs = [venta.referencia, venta.prestamo?.referencia].filter(Boolean)
      const ledgerVenta = ledgerVentas.filter(m => !m.voided && refs.some(ref => m.label?.includes(ref)))
      const loansVenta = allLoans.filter(l => l.id === venta.prestamo?.referencia)
      const paymentsVenta = payments.filter(p => p.loanId === venta.prestamo?.referencia)
      const { exportReportDocxVentas } = await import('./utils/reportDocx')
      await exportReportDocxVentas({ ventas:[venta], ledger:ledgerVenta, loans:loansVenta, payments:paymentsVenta, titulo:`Comprobante de venta ${venta.referencia}` })
      showToast('Reporte Word de la venta descargado')
    } catch (err) { showToast(`No se pudo generar el Word: ${err.message}`, 'error') }
  }

  /* Cargar papelera cuando cambia el modo */
  useEffect(() => {
    if (user && modo) {
      cargarPapelera(user.id).then(setPapelera).catch(err => showToast(`No se pudo cargar la papelera: ${err.message}`, 'error'))
    }
  }, [user, modo, showToast])

  const handleExportComprobanteDocx = async (loan, cuotas, modoExport, nCuota) => {
    try {
      await exportComprobanteDocx(loan, cuotas, modoExport, nCuota)
      showToast('Comprobante Word descargado')
    } catch { showToast('Error al generar comprobante', 'error') }
  }

  const handleCreateProduct = async (form) => {
    if (!user) return
    const row = await crearProducto(user.id, form)
    setProductos(prev => [...prev, {
      id: row.id, nombre: row.nombre, descripcion: row.descripcion ?? '',
      categoria: row.categoria, precioContado: Number(row.precio_contado),
      costo: Number(row.costo ?? 0), stock: Number(row.stock), imagenUrl: null,
    }])
    showToast('Producto agregado al catálogo')
  }

  const handleUpdateProduct = async (id, form) => {
    await actualizarProducto(id, form)
    setProductos(prev => prev.map(p => p.id === id ? { ...p, ...form, stock:p.stock } : p))
    showToast('Producto actualizado')
  }

  const handleStockMovement = async (id, movement) => {
    try {
      const result = await registrarMovimientoStock(id, movement)
      const producto = productos.find(p => p.id === id)
      setProductos(prev => prev.map(p => p.id === id ? { ...p, stock:result.stock } : p))
      setMovimientosStock(prev => [{
        id: result.id, productoId:id, producto:producto?.nombre ?? 'Producto', tipo:movement.tipo,
        cantidad:Number(movement.cantidad), stockAnterior:producto?.stock ?? 0,
        stockResultante:result.stock, motivo:movement.motivo || (movement.tipo === 'entrada' ? 'Reposición de inventario' : 'Salida manual'), fecha:new Date().toISOString(),
      }, ...prev])
      showToast(movement.tipo === 'entrada' ? `Stock actualizado: ${result.stock} unidades disponibles` : `Salida registrada: quedan ${result.stock} unidades`)
    } catch (err) {
      showToast(`No se pudo actualizar el stock: ${err.message}`, 'error')
      throw err
    }
  }

  const handleDeleteProduct = async (id) => {
    try {
      await desactivarProducto(id)
      setProductos(prev => prev.filter(p => p.id !== id))
      showToast('Producto eliminado del catálogo')
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  /* handleGenerarReporte: llamado por ExportModal con los filtros elegidos */
  const handleGenerarReporte = useCallback(async (opts) => {
    const { formato, alcance, clienteFiltro, desde, hasta } = opts
    const enRango = (rawDate) => {
      if (!rawDate) return true
      const d = (rawDate || '').slice(0, 10)
      if (desde && d < desde) return false
      if (hasta && d > hasta) return false
      return true
    }

    const esVentas = modo === 'ventas'

    if (esVentas) {
      // ── Reporte de VENTAS ──
      const ventasF = ventas.filter(v =>
        (alcance !== 'cliente' || v.client === clienteFiltro) &&
        enRango(v.fechaVenta || v.createdAt)
      )
      const referencias = new Set(ventasF.map(v => v.prestamo?.referencia).filter(Boolean))
      const ledgerF = ledgerVentas.filter(m => !m.voided && enRango(m.rawDate) &&
        (alcance !== 'cliente' || [...referencias].some(ref => String(m.label || '').includes(ref))))
      const loansF = allLoans.filter(l => referencias.has(l.id))
      const paymentsF = payments.filter(p => p.origen === 'venta' && referencias.has(p.loanId))
      const titulo   = alcance === 'cliente' ? `Cliente: ${clienteFiltro}` : desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Reporte de Ventas'
      try {
        if (formato === 'excel') {
          const { exportReportExcelVentas } = await import('./utils/exportReportExcel')
          await exportReportExcelVentas({ ventas: ventasF, ledger: ledgerF, desde, hasta, titulo })
          showToast('Excel de ventas descargado')
        } else {
          const { exportReportDocxVentas } = await import('./utils/reportDocx')
          await exportReportDocxVentas({ ventas: ventasF, ledger: ledgerF, loans: loansF, payments: paymentsF, titulo })
          showToast('Word de ventas descargado')
        }
      } catch (err) { showToast(`Error al generar reporte: ${err.message}`, 'error') }
    } else {
      // ── Reporte de PRÉSTAMOS ──
      const loansF    = alcance === 'cliente' ? loansEfectivo.filter(l => l.client === clienteFiltro) : loansEfectivo
      const paymentsF = alcance === 'cliente' ? paymentsEfectivo.filter(p => p.client === clienteFiltro) : paymentsEfectivo
      const ledgerF   = ledgerEfectivo.filter(m => !m.voided && enRango(m.rawDate))
      const receiptsF = receiptsEfectivo.filter(r => enRango(r.paidAt) && (alcance !== 'cliente' || r.client === clienteFiltro))
      const titulo    = alcance === 'cliente' ? `Cliente: ${clienteFiltro}` : desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Reporte de Préstamos'
      try {
        if (formato === 'excel') {
          const { exportReportExcelPrestamos } = await import('./utils/exportReportExcel')
          await exportReportExcelPrestamos({ loans: loansF, payments: paymentsF, ledger: ledgerF, receipts: receiptsF, desde, hasta, titulo })
          showToast('Excel descargado')
        } else {
          const { exportReportDocxPrestamos } = await import('./utils/reportDocx')
          await exportReportDocxPrestamos({ loans: loansF, payments: paymentsF, ledger: ledgerF, titulo })
          showToast('Word descargado')
        }
      } catch (err) { showToast(`Error al generar reporte: ${err.message}`, 'error') }
    }
  }, [modo, loansEfectivo, paymentsEfectivo, ledgerEfectivo, ledgerVentas, ventas, receiptsEfectivo, allLoans, payments, showToast])

  /* ── Auth screens ── */
  if (!authReady) return (
    <div className="auth-loader">
      <div className="brand-mark"><BrandMark size={24} /></div>
      <Spinner size={28} />
      <p>{isOnline ? 'Conectando…' : 'Sin conexión a Internet. Conectate para acceder a tus datos.'}</p>
    </div>
  )
  if (isSupabaseConfigured && !user) return <><Login onSignIn={handleSignIn} onOpenLegal={setLegalSection} performanceMode={performanceMode} onTogglePerformance={togglePerformanceMode} isOnline={isOnline}/>{legalSection && <LegalDialog key={legalSection} section={legalSection} onClose={() => setLegalSection(null)}/>}</>

  /* ── Selector de modo (primera pantalla tras login) ── */
  if (!modo) return <><ModeSelector onSelect={elegirModo} onOpenLegal={setLegalSection} performanceMode={performanceMode} onTogglePerformance={togglePerformanceMode}/>{legalSection && <LegalDialog key={legalSection} section={legalSection} onClose={() => setLegalSection(null)}/>}</>

  const rutaCount    = paymentsEfectivo.filter((p) => daysUntil(p.due) === 0 && (p.status === 'Pendiente' || p.status === 'Parcial')).length

  return (
    <MotionConfig reducedMotion={performanceMode ? 'always' : 'never'} skipAnimations={performanceMode} transition={performanceMode ? { skipAnimations: true } : undefined}>
    <div className={`app-shell app-shell-${modo} ${performanceMode ? 'pn-performance-on' : ''}`}>
      <aside className={`sidebar sidebar-${modo} ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Brand con botón cambiar modo */}
        <div className="brand">
          <div className="brand-mark"><BrandMark size={21} /></div>
          <div>
            <b>presta<span>neo</span></b>
            <small>{modo === 'prestamos' ? '💵 PRÉSTAMOS' : '🛒 VENTAS'}</small>
          </div>
          <button className="close-nav" onClick={() => setMobileOpen(false)} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* Cambiar modo */}
        <button className={`modo-switch modo-switch-${modo}`} onClick={() => { setModo(null); try { localStorage.removeItem('pn-modo') } catch { /* Permite cambiar de modo aunque el almacenamiento esté bloqueado. */ } }}>
          {modo === 'prestamos'
            ? <><ShoppingCart size={13}/> Ir a Ventas</>
            : <><DollarSign size={13}/> Ir a Préstamos</>}
        </button>

        <p className={`nav-caption nav-caption-${modo}`}>
          {modo === 'prestamos' ? <><DollarSign size={9}/> PRÉSTAMOS</> : <><ShoppingBag size={9}/> VENTAS</>}
        </p>
        <nav className="side-nav">
          {(modo === 'prestamos' ? NAV_PRESTAMOS : NAV_VENTAS).map(({ id, label, icon: Icon }) => {
            const badge = id === 'p_ruta' ? rutaCount : 0
            return (
              <button key={id}
                className={`nav-item nav-item-${modo} ${tab === id ? `selected selected-${modo}` : ''}`}
                onClick={() => { setTab(id); setMobileOpen(false) }}>
                <Icon size={18} strokeWidth={1.8}/><span>{label}</span>
                {badge > 0 && <em>{badge}</em>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <PerformanceToggle enabled={performanceMode} onToggle={togglePerformanceMode}/>
          <div className="secure-card">
            <div className="secure-icon"><ShieldCheck size={16}/></div>
            <div><b>Datos protegidos</b><small>RLS · Cifrado</small></div>
          </div>
          <button className="profile" onClick={user ? handleSignOut : handleSignIn}>
            <div className="profile-avatar">
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" className="profile-photo" referrerPolicy="no-referrer"/>
                : user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="profile-info">
              <b>{user?.user_metadata?.full_name ?? 'Usuario'}</b>
              <small>{user?.email ?? ''}</small>
            </div>
            {user ? <LogOut size={16}/> : <MoreHorizontal size={19}/>}
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Cerrar"/>}

      <main className="main-area">
        <header className={`topbar topbar-${modo}`}>
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Menú"><Menu size={21}/></button>
          <button className="topbar-brand" onClick={() => setTab(modo === 'prestamos' ? 'p_inicio' : 'v_inicio')} aria-label="Inicio">
            <div className="topbar-brand-mark"><BrandMark size={18}/></div>
            <span>PrestaNeo</span>
          </button>
          <div className="breadcrumb">
            <span>/</span> <b>{nav.find(n => n.id === tab)?.label}</b>
          </div>
          <div className="top-actions">
            {(loading || ventasLoading) && <Spinner size={16} className="top-spinner"/>}
            <div className="topbar-caja" title="Cobrado hoy">
              <ArrowDownLeft size={13}/><span>{fmt(totals.cobradoHoy)}</span>
            </div>
            <div className="topbar-user">
              <div className="top-avatar" style={{ cursor:'pointer' }} onClick={() => setTab(modo === 'prestamos' ? 'p_inicio' : 'v_inicio')}>
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="" style={{ width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} referrerPolicy="no-referrer"/>
                  : user?.email?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <button className="topbar-signout" onClick={handleSignOut} aria-label="Cerrar sesión"><LogOut size={15}/></button>
            </div>
          </div>
        </header>

        <div className="page-wrap">
          {!isOnline && <div className="data-error-banner connection-banner"><AlertTriangle size={17}/><span>Sin conexión a Internet. Conectate para acceder y actualizar tus datos.</span></div>}
          {dataError && (
            <div className="data-error-banner">
              <AlertTriangle size={17}/><span>{dataError}</span>
              <button onClick={() => user && loadData(user.id)}><RefreshCw size={14}/> Reintentar</button>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.18, ease:'easeOut' }}>

              {/* ── MÓDULO PRÉSTAMOS ── */}
              {tab === 'p_inicio'   && <PrestamosInicio totals={totals} loans={loansEfectivo} payments={paymentsEfectivo} monthBars={monthBars} loading={loading} go={setTab} onNew={() => setModal('loan')} onPay={handlePay} />}
              {tab === 'p_nuevo'    && <LoanModal inline onClose={() => setTab('p_inicio')} onCreate={handleCreateLoan} userId={user?.id} />}
              {tab === 'p_ruta'     && <RutaDia payments={rutaUnificada.length ? rutaUnificada.filter(p => (p.origen ?? 'efectivo') === 'efectivo') : paymentsEfectivo} loading={loading} onPay={handlePay} onPartial={setPartialTarget} />}
              {tab === 'p_clientes' && <ClientesPrestamos loans={loansEfectivo} allLoans={allLoansEfectivo} loading={loading} onNew={(opts) => setModal(opts?.prefill ? { type:'loan', prefill:opts.prefill } : 'loan')} onEdit={setEditTarget} onArchivar={handleArchivarCliente} onComprobanteDocx={handleExportComprobanteDocx} onExportClient={(c) => handleExportClienteActivo(c, 'prestamos')} onPay={handlePay} onPartial={setPartialTarget} payments={paymentsEfectivo} />}
              {tab === 'p_papelera' && <PapeleraClientes papelera={papelera} onRestaurar={handleRestaurarCliente} onEliminar={handleEliminarClientePermanente} onExport={handleExportFichaCliente} />}
              {tab === 'p_caja'     && <Cash ledger={ledgerEfectivo} totals={totals} loading={loading} onExport={() => setExportOpen(true)} onDeleteMovements={handleDeleteCashMovements} onRestoreMovement={handleRestoreCashMovement} mode="prestamos" payments={paymentsEfectivo} />}

              {/* ── MÓDULO VENTAS ── */}
              {tab === 'v_inicio'   && <VentasInicio ventas={ventas} payments={payments} loans={allLoans} productos={productos} totals={totalsVentas} loading={loading} go={setTab} />}
      {tab === 'v_catalogo' && <Catalogo productos={productos} movimientosStock={movimientosStock} stockHistoryError={stockHistoryError} loading={loading} onCreate={handleCreateProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} onStockMovement={handleStockMovement} />}
              {tab === 'v_nueva'    && <NuevaVenta productos={productos} onSubmit={handleCreateVenta} />}
              {tab === 'v_ventas'   && <VentasClientes ventas={ventas} payments={payments} loans={allLoans} loading={loading} go={setTab} onPay={handlePay} onPartial={setPartialTarget} onExportSale={handleExportVentaDocx} onReport={() => setExportOpen(true)} />}
              {tab === 'v_clientes' && <ClientesVentas ventas={ventas} payments={payments} loans={allLoans} loading={loading} go={setTab} onPay={handlePay} onPartial={setPartialTarget} onArchive={handleArchivarCliente} onExportSale={handleExportVentaDocx} onExportClient={(c) => handleExportClienteActivo(c, 'ventas')} />}
              {tab === 'v_papelera' && <PapeleraClientes papelera={papelera} onRestaurar={handleRestaurarCliente} onEliminar={handleEliminarClientePermanente} onExport={handleExportFichaCliente} />}
              {tab === 'v_caja'     && <Cash ledger={ledgerVentas} totals={totalsVentas} loading={loading} onExport={() => setExportOpen(true)} onDeleteMovements={handleDeleteCashMovements} onRestoreMovement={handleRestoreCashMovement} mode="ventas" ventas={ventas} payments={payments.filter(p => p.origen === 'venta')} />}

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="footer">
          <span>© 2026 Prestaneo Finance OS</span>
          <span><i/> Cifrado de extremo a extremo</span>
          <div className="legal-footer-links">
            <button type="button" onClick={() => setLegalSection('terms')}>Términos</button>
            <button type="button" onClick={() => setLegalSection('privacy')}>Privacidad</button>
            <button type="button" onClick={() => setLegalSection('cookies')}>Cookies</button>
          </div>
        </footer>
      </main>

      {/* Modales */}
      <AnimatePresence>
        {(modal === 'loan' || modal?.type === 'loan') && <LoanModal onClose={() => setModal(null)} onCreate={handleCreateLoan} userId={user?.id} prefill={modal?.prefill} />}
      </AnimatePresence>
      <AnimatePresence>
        {modal?.type === 'producto' && <ProductoModal onClose={() => setModal(null)} onCreate={handleCreateProduct} producto={modal?.producto} onUpdate={handleUpdateProduct} />}
      </AnimatePresence>
      <AnimatePresence>
        {exportOpen && (
          <ExportModal
            modo={modo}
            loans={loansEfectivo}
            ventas={ventas}
            onClose={() => setExportOpen(false)}
            onGenerate={(opts) => { handleGenerarReporte(opts); setExportOpen(false) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal?.type === 'refinanciar' && (
          <RefinanciarModal
            loan={modal.loan}
            onClose={() => setModal(null)}
            onCreate={(form) => { handleCreateLoan(form); setModal(null) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partialTarget && <PartialModal payment={partialTarget} onClose={() => setPartialTarget(null)} onConfirm={async (amt) => {
          const saved = await handlePay(partialTarget, 'Parcial', amt)
          if (saved) setPartialTarget(null)
          return saved
        }} />}
      </AnimatePresence>
      <AnimatePresence>
        {editTarget && <EditClientModal client={editTarget} onClose={() => setEditTarget(null)} onSave={handleEditClient} />}
      </AnimatePresence>
      <AnimatePresence>
        {cmdOpen && <CommandPalette
          mode={modo}
          loans={modo === 'ventas' ? allLoans.filter(l => l.origen === 'venta') : loansEfectivo}
          payments={modo === 'ventas' ? payments.filter(p => p.origen === 'venta') : paymentsEfectivo}
          onClose={() => setCmdOpen(false)} onNavigate={(t) => setTab(t)}
        />}
      </AnimatePresence>
      <AnimatePresence>
        {tourOpen && (
          <TourModal
            step={tourStep}
            total={TOUR_STEPS.length}
            onNext={() => setTourStep((s) => s + 1)}
            onClose={() => setTourOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={dismissToast} />}
      </AnimatePresence>
      <AnimatePresence>
        {legalSection && <LegalDialog key={legalSection} section={legalSection} onClose={() => setLegalSection(null)}/>}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}

/* ═══════════════════════════════════════════════
   DASHBOARD — con datos reales
═══════════════════════════════════════════════ */
function Kpi({ label, value, change, icon: Icon, kind = 'purple', foot, loading, helpKey }) {
  const animated = useCountUp(loading ? 0 : value, 800)
  const isNeg = typeof change === 'string' ? change.startsWith('-') : Number(change) < 0
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`kpi-card ${kind}`}
    >
      {loading ? (
        <><div className="sk sk-label"/><div className="sk sk-value"/><div className="sk sk-foot"/></>
      ) : (
        <>
          <div className="kpi-top">
            <span>{label}</span>
            <div className="kpi-top-right">
              {helpKey && <HelpBtn contentKey={helpKey} size="sm" className="kpi-help" />}
              <span className="kpi-icon"><Icon size={17}/></span>
            </div>
          </div>
          <strong key={value}>
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(animated)}
          </strong>
          <div className="kpi-bottom">
            {change != null && (
              <span className={isNeg ? 'negative' : 'positive'}>
                {isNeg ? <TrendingDown size={13}/> : <TrendingUp size={13}/>} {change}
              </span>
            )}
            <span>{foot}</span>
          </div>
        </>
      )}
    </motion.article>
  )
}

// Pantalla anterior conservada como referencia durante la renovación del dashboard.
// eslint-disable-next-line no-unused-vars
function Dashboard({ totals, loans, payments, ledger, alerts: _alerts, loading, monthBars, proyeccion, go, onNew, onPay }) {
  const [alertFilter, setAlertFilter] = useState('Todos')

  const due = payments
    .filter((p) => ['Pendiente','Vencido','Parcial'].includes(p.status))
    .filter((p) => {
      const d = daysUntil(p.due)
      if (alertFilter === 'Todos') return true
      if (alertFilter === 'Hoy') return d === 0
      if (alertFilter === '48 hs') return d >= 0 && d <= 2
      if (alertFilter === 'Mora') return p.status === 'Vencido' || d < 0
      if (alertFilter === 'Al día') return d > 2
      return true
    })
    .sort((a, b) => daysUntil(a.due) - daysUntil(b.due))
    .slice(0, 5)

  /* Barras con datos reales */
  const monthLabels = (() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      return MONTHS_SHORT[d.getMonth()]
    })
  })()

  /* Donut dinámico */
  const activoCount   = loans.filter((l) => l.status === 'Activo').length
  const moraCount     = loans.filter((l) => l.status === 'En mora').length
  const total         = loans.length || 1
  const pctActivo     = (activoCount / total * 100).toFixed(1)
  const pctMora       = (moraCount   / total * 100).toFixed(1)
  const donutGrad     = loans.length === 0
    ? 'conic-gradient(#262630 0 100%)'
    : `conic-gradient(#ac63e9 0 ${pctActivo}%, #ed7376 ${pctActivo}% ${(Number(pctActivo)+Number(pctMora)).toFixed(1)}%, #262630 ${(Number(pctActivo)+Number(pctMora)).toFixed(1)}% 100%)`

  const cambioLabel = totals.cambioMes != null
    ? `${totals.cambioMes >= 0 ? '+' : ''}${totals.cambioMes}%`
    : 'primer mes'

  return (
    <>
      <PageTitle eyebrow={todayLabel} title="Tu dinero, en movimiento." description="Estado real de tu cartera." action={onNew} actionLabel="Nuevo préstamo" helpKey="dashboard" />

      <div className="kpi-grid">
        <Kpi label="Capital colocado"   value={totals.principal}   change={cambioLabel} foot="vs. mes anterior"  icon={Landmark}   loading={loading} helpKey="kpi_capital" />
        <Kpi label="Retorno esperado"   value={totals.returnTotal} change={null}        foot="cartera activa"    icon={TrendingUp} kind="green" loading={loading} helpKey="kpi_retorno" />
        <Kpi label="Interés proyectado" value={totals.interest}    change={null}        foot="utilidad bruta"    icon={Activity}   loading={loading} helpKey="kpi_interes" />
        <Kpi label="Caja disponible"    value={totals.caja}        change={null}        foot="balance operativo" icon={Wallet}     kind="green" loading={loading} helpKey="kpi_caja" />
      </div>

      {/* Proyección 30 días */}
      {proyeccion && proyeccion.totalEsperado > 0 && (
        <div className="forecast-strip">
          <div className="forecast-icon"><Target size={16}/></div>
          <div className="forecast-body">
            <b>Proyección próximos 30 días</b>
            <p><Money value={proyeccion.totalEsperado}/> esperados en {proyeccion.cuotasCount} cuota{proyeccion.cuotasCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="forecast-spark">
            {proyeccion.serie.slice(-14).map((d, i) => {
              const maxS = Math.max(...proyeccion.serie.map((x) => x.monto), 1)
              return (
                <div key={i} className="spark-bar" title={`${d.fecha}: ${fmt(d.monto)}`}>
                  <div className="spark-fill" style={{ height: `${(d.monto / maxS) * 100}%` }} />
                </div>
              )
            })}
          </div>
          <button className="text-link" onClick={() => go('cobros')}>Ver cobros <ArrowUpRight size={13}/></button>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Gráfico — datos reales de caja */}
        <section className="panel performance">
          <div className="panel-header">
            <div><div className="section-title">Cobros mensuales <span className="live-dot"/></div><p>Ingresos reales de los últimos 12 meses</p></div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-purple"/> Cobros</span>
            <span><i className="legend-green"/> Meta (promedio)</span>
            <b><Money value={monthBars.reduce((s, v) => s + v, 0)}/><small>total año</small></b>
          </div>
          <div className="chart-area">
            <div className="y-labels">
              {(() => {
                const m = Math.max(...monthBars, 1)
                return [m, m*0.66, m*0.33, 0].map((v, i) => <span key={i}>{v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$0`}</span>)
              })()}
            </div>
            <div className="chart-bars">
              {monthBars.map((v, i) => (
                <div className="bar-slot" key={i}>
                  <div className="bar-stack" style={{ height: `${(v / Math.max(...monthBars, 1)) * 100}%` }} title={fmt(v)}>
                    <i style={{ height: `${Math.min(38, (i / 11) * 38)}%` }} /><b/>
                  </div>
                  <small>{monthLabels[i]}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Donut dinámico */}
        <section className="panel portfolio">
          <div className="panel-header">
            <div><div className="section-title">Salud de cartera</div><p>Distribución real de operaciones</p></div>
          </div>
          <div className="portfolio-center">
            <div className="donut" style={{ background: donutGrad }}>
              <div><b>{loans.length}</b><small>préstamos</small></div>
            </div>
            <div className="portfolio-total">
              <b><Money value={totals.principal}/></b>
              <small>capital activo</small>
            </div>
          </div>
          <div className="portfolio-legend">
            <span><i className="green-dot"/> Al día <b>{activoCount}</b></span>
            <span><i className="red-dot"/> En mora <b>{moraCount}</b></span>
          </div>
          {/* Métricas adicionales */}
          <div className="portfolio-metrics">
            <div><small>Por cobrar</small><b><Money value={totals.pendingAmount}/></b></div>
            <div><small>Cobrado hoy</small><b className="text-green"><Money value={totals.cobradoHoy}/></b></div>
          </div>
        </section>

        {/* Cobros prioritarios */}
        <section className="panel collection-panel">
          <div className="panel-header">
            <div><div className="section-title">Cobros prioritarios <span className="count-badge">{due.length}</span></div><p>Vencimientos pendientes y en mora</p></div>
            <div className="collection-heading-actions">
              <div className="alert-filters">
                {['Todos','Hoy','48 hs','Mora','Al día'].map((item) => (
                  <button key={item} className={alertFilter === item ? 'active' : ''} onClick={() => setAlertFilter(item)}>{item}</button>
                ))}
              </div>
              <button className="text-link" onClick={() => go('cobros')}>Ver <ArrowUpRight size={14}/></button>
            </div>
          </div>
          <div className="due-list">
            {loading ? [1,2,3].map((i) => <div key={i} className="due-row-skeleton"/>) : due.length ? due.map((p) => {
              const d = daysUntil(p.due)
              const label = p.status === 'Vencido' || d < 0 ? `Vencido hace ${Math.abs(d)} días` : d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`
              return (
                <div className="due-row" key={p.id}>
                  <div className={`due-indicator ${p.status === 'Vencido' || d < 0 ? 'late' : ''}`}/>
                  <div className="due-person"><b>{p.client}</b><small>{label} · Cuota {p.n}{p.totalQuotas ? ` de ${p.totalQuotas}` : ''}</small></div>
                  <b className="due-amount"><Money value={p.amount}/></b>
                  <button className="quick-pay" onClick={() => onPay(p,'Pagado')} title="Registrar cobro"><Check size={15}/></button>
                </div>
              )
            }) : <div className="empty-inline"><CheckCheck size={18}/> Sin cobros en este filtro</div>}
          </div>
        </section>

        {/* Actividad reciente */}
        <section className="panel activity-panel">
          <div className="panel-header">
            <div><div className="section-title">Actividad reciente</div><p>Últimos movimientos de caja</p></div>
          </div>
          <div className="activity-list">
            {loading ? [1,2,3].map((i) => <div key={i} className="activity-skeleton"/>) : ledger.slice(0, 5).map((item) => (
              <div className="activity-row" key={item.id}>
                <div className={`activity-icon ${item.type === 'Entrada' ? 'in' : 'out'}`}>
                  {item.type === 'Entrada' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                </div>
                <div className="activity-desc"><b>{item.label}</b><small>{item.time} · {item.type}</small></div>
                <b className={item.type === 'Entrada' ? 'amount-in' : 'amount-out'}>
                  {item.type === 'Entrada' ? '+' : '−'}<Money value={item.amount}/>
                </b>
              </div>
            ))}
          </div>
          <button className="text-link activity-link" onClick={() => go('caja')}>Ver todos los movimientos <ArrowUpRight size={14}/></button>
        </section>
      </div>

      <div className="dashboard-bottom">
        <div className="insight-card">
          <div className="insight-icon"><Sparkles size={17}/></div>
          <div>
            <b>{totals.cobradoHoy > 0 ? `Recaudaste ${fmt(totals.cobradoHoy)} hoy` : 'Sin cobros registrados hoy'}</b>
            <p>{totals.cobradoHoy > 0 ? 'Sigue así. Tu cartera está en movimiento activo.' : 'Registra cobros para mantener el libro de caja actualizado.'}</p>
          </div>
          <button onClick={() => go('cobros')}>Cobrar <ArrowUpRight size={14}/></button>
        </div>
        <div className="delinquency-chip">
          <div><CircleAlert size={17}/><span>Índice de morosidad</span></div>
          <b>{totals.delinquency.toFixed(1)}<small>%</small></b>
          <span className="delinquency-track"><i style={{ width: `${Math.max(4, totals.delinquency)}%` }}/></span>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════
   ACORDEÓN — componente compartido
═══════════════════════════════════════════════ */
function ClientAccordion({ clientName, phone, initials, badge, badgeKind='neutral', summary, defaultOpen=false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`client-accordion ${open ? 'acc-open' : ''}`}>
      <button className="acc-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="acc-avatar">{initials}</div>
        <div className="acc-info"><b>{clientName}</b>{phone && <small>{phone}</small>}</div>
        {summary && <div className="acc-summary">{summary}</div>}
        {badge != null && <span className={`acc-badge acc-badge-${badgeKind}`}>{badge}</span>}
        <ChevronDown size={16} className={`acc-chevron ${open ? 'acc-chevron-open' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="acc-body" initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.22, ease:'easeInOut' }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   COBRANZAS
═══════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Collections({ payments, receipts, filter, setFilter, query, setQuery, loading, onPay, onReceipt, onPartial }) {
  const filters = ['Todos','Pendiente','Vencido','Parcial']
  const pendingTotal  = payments.filter((p) => ['Pendiente','Vencido','Parcial'].includes(p.status)).reduce((s,p) => s+Number(p.amount), 0)
  const cobradoHoy    = receipts.filter((r) => r.paidAt?.slice(0,10) === today).reduce((s,r) => s+Number(r.amount), 0)
  const grouped = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      if (!map.has(p.client)) map.set(p.client, { client: p.client, phone: p.phone, items: [] })
      map.get(p.client).items.push(p)
    }
    return [...map.values()]
  }, [payments])

  return (
    <>
      <PageTitle eyebrow="GESTIÓN DE COBROS" title="Cobranzas" description="Tocá un cliente para ver y gestionar sus cuotas." action={() => setFilter('Pendiente')} actionLabel="Ver pendientes" icon={Filter} helpKey="cobros" />
      <div className="collection-summary">
        <div><span><HandCoins size={14}/> Por cobrar</span><b><Money value={pendingTotal}/></b></div>
        <div><span><Clock size={14}/> Operaciones pendientes</span><b>{payments.filter((p) => ['Pendiente','Vencido','Parcial'].includes(p.status)).length}</b></div>
        <div><span><Check size={14}/> Recaudado hoy</span><b className="text-green"><Money value={cobradoHoy}/></b></div>
      </div>
      <div className="acc-toolbar">
        <div className="filter-tabs">{filters.map((f) => <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'active' : ''}>{f}</button>)}</div>
        <label className="searchbox"><Search size={16}/><input placeholder="Buscar cliente o préstamo" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
      </div>
      {loading ? <div className="acc-skeleton-wrap">{[1,2,3].map((i) => <div key={i} className="acc-skeleton"/>)}</div>
        : grouped.length === 0 ? <div className="empty-state-page"><CheckCheck size={38}/><h3>Todo al día</h3><p>No hay cuotas pendientes para este filtro.</p></div>
        : (
          <div className="acc-list">
            {grouped.map((g) => {
              const pending  = g.items.filter((p) => ['Pendiente','Vencido','Parcial'].includes(p.status))
              const overdue  = g.items.some((p) => p.status === 'Vencido')
              const total    = g.items.reduce((s,p) => s+Number(p.amount), 0)
              const initials = g.client.split(' ').map((x) => x[0]).slice(0,2).join('')
              const kind     = overdue ? 'bad' : pending.length > 0 ? 'warn' : 'good'
              return (
                <ClientAccordion key={g.client} clientName={g.client} phone={g.phone} initials={initials} badge={`${pending.length} pendiente${pending.length!==1?'s':''}`} badgeKind={kind} defaultOpen={grouped.length===1} summary={<Money value={total}/>}>
                  <div className="acc-table-wrap">
                    <table className="acc-table">
                      <thead><tr><th>PRÉSTAMO</th><th>VENCIMIENTO</th><th>CUOTA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
                      <tbody>
                        {g.items.map((p) => (
                          <tr key={p.id}>
                            <td className="mono">{p.loanId}<small>Cuota {p.n}{p.totalQuotas ? ` / ${p.totalQuotas}` : ''}</small></td>
                            <td><span className={p.status==='Vencido'?'text-red':''}>{p.due}</span><small>{p.status==='Vencido'?'Requiere atención':'Fecha de vencimiento'}</small></td>
                            <td className="money-cell"><Money value={p.amount}/><small>Cap. {fmt(p.capital)} · Int. {fmt(p.interest)}</small></td>
                            <td><Status status={p.status}/></td>
                            <td>
                              <div className="row-actions">
                                {['Pendiente','Vencido','Parcial'].includes(p.status) ? (
                                  <><button className="mini-action" onClick={() => onPay(p,'Pagado')}><Check size={14}/> Cobrar</button>
                                  <button className="mini-action subtle" onClick={() => onPartial(p)}>Parcial</button>
                                  <a className="whatsapp" href={`https://wa.me/${sanitizePhone(p.phone)}?text=${encodeURIComponent(`Hola ${p.client.split(' ')[0]}, te recordamos el vencimiento de tu cuota ${p.n} por ${fmt(p.amount)} con fecha ${p.due}.`)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={16}/></a>
                                  <HelpBtn contentKey="btn_whatsapp" size="sm" /></>
                                ) : <><button className="mini-action subtle" onClick={() => onReceipt(p)}><Download size={14}/> Recibo</button><HelpBtn contentKey="btn_pdf" size="sm" /></>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ClientAccordion>
              )
            })}
          </div>
        )}
    </>
  )
}

/* ═══════════════════════════════════════════════
   PRÉSTAMOS — con pestaña Historial
═══════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Loans({ loans, allLoans, query, setQuery, loading, onNew, onRefinanciar }) {
  const [loanTab, setLoanTab] = useState('activos')

  const visibleLoans = loanTab === 'activos'
    ? loans.filter((l) => `${l.client} ${l.id}`.toLowerCase().includes(query.toLowerCase()))
    : allLoans.filter((l) => l.status !== 'Activo' && l.status !== 'En mora' && `${l.client} ${l.id}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageTitle eyebrow="CARTERA" title="Préstamos" description="Gestiona las operaciones y sigue su evolución." action={onNew} actionLabel="Emitir préstamo" helpKey="crear_prestamo" />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="loan-tabs">
            <button className={`loan-tab ${loanTab==='activos'?'active':''}`} onClick={() => setLoanTab('activos')}>
              <BriefcaseBusiness size={14}/> Activos <em>{loans.length}</em>
            </button>
            <button className={`loan-tab ${loanTab==='historial'?'active':''}`} onClick={() => setLoanTab('historial')}>
              <History size={14}/> Historial <em>{allLoans.filter((l) => l.status !== 'Activo' && l.status !== 'En mora').length}</em>
            </button>
          </div>
          <label className="searchbox"><Search size={16}/><input placeholder="Buscar cliente o préstamo" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CLIENTE</th><th>OPERACIÓN</th><th>CAPITAL</th>
                {loanTab === 'historial' ? <th>RECUPERADO</th> : <th>PROGRESO</th>}
                <th>{loanTab === 'historial' ? 'FECHA' : 'PRÓX. VENCIMIENTO'}</th>
                <th>ESTADO</th>
                {loanTab === 'activos' && <th>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3,4].map((i) => <SkeletonRow key={i}/>)
                : visibleLoans.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="table-person">
                        <div className="person-avatar">{l.client.split(' ').map((x) => x[0]).slice(0,2).join('')}</div>
                        <div><b>{l.client}</b><small>{l.dni || '—'} · {l.risk}</small></div>
                      </div>
                    </td>
                    <td className="mono">{l.id}<small>{l.installments} cuotas · {l.rate}%</small></td>
                    <td className="money-cell"><Money value={l.principal}/><small>Total {fmt(l.principal*(1+l.rate/100))}</small></td>
                    <td>
                      {loanTab === 'historial'
                        ? <div className="money-cell"><Money value={l.totalRecuperado ?? 0}/><small>{l.paid ?? 0}/{l.installments} cuotas</small></div>
                        : <div className="progress-cell"><span>{l.paid}/{l.installments}</span><div><i style={{ width:`${(l.paid/l.installments)*100}%` }}/></div></div>}
                    </td>
                    <td>{loanTab === 'historial'
                      ? new Date(l.createdAt).toLocaleDateString('es-AR', { dateStyle:'short' })
                      : l.next}</td>
                    <td><Status status={l.status}/></td>
                    {loanTab === 'activos' && (
                      <td>
                        <div className="row-actions">
                          {l.status === 'En mora' && (
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <button
                                className="mini-action subtle refi-btn"
                                onClick={() => onRefinanciar(l)}
                                title="Refinanciar deuda"
                              >
                                <RefreshCcw size={13}/> Refinanciar
                              </button>
                              <HelpBtn contentKey="btn_refinanciar" size="sm" />
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && visibleLoans.length === 0 && (
            <div className="empty-state">
              {loanTab === 'activos'
                ? <><span>No hay préstamos activos. </span><button className="text-link" onClick={onNew}>Emite el primero <ArrowUpRight size={13}/></button></>
                : 'No hay préstamos en el historial todavía.'}
            </div>
          )}
        </div>
      </section>
      <div className="note-strip"><ShieldCheck size={16}/> El capital e interés se calculan con interés directo. Confirma las condiciones antes de emitir.</div>
    </>
  )
}

/* ═══════════════════════════════════════════════
   CLIENTES — con botón editar
═══════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Clients({ loans, allLoans, loading, onNew, onEdit }) {
  const grouped = [...new Map(loans.map((l) => [l.client, l])).values()]

  // Score calculado desde historial real de pagos
  const calcScore = useCallback((clientName) => {
    const clientLoans = (allLoans.length > 0 ? allLoans : loans).filter((l) => l.client === clientName)
    if (clientLoans.length === 0) return { score: 700, label: 'Sin historial', cls: 'medio' }
    const totalCuotas = clientLoans.reduce((s, l) => s + Number(l.installments || 0), 0)
    const pagadas     = clientLoans.reduce((s, l) => s + Number(l.paid || 0), 0)
    const enMora      = clientLoans.some(l => l.status === 'En mora')
    const completados = clientLoans.filter(l => l.status === 'Pagado').length
    const tasa        = totalCuotas > 0 ? pagadas / totalCuotas : 0
    let score = Math.round(300 + tasa * 450 + completados * 20)
    if (enMora) score = Math.max(300, score - 120)
    score = Math.min(850, score)
    const cls   = score >= 720 ? 'bajo' : score >= 580 ? 'medio' : 'alto'
    const label = score >= 720 ? 'Paga a tiempo' : score >= 580 ? 'Demoras leves' : 'Alto riesgo'
    return { score, label, cls }
  }, [allLoans, loans])

  return (
    <>
      <PageTitle eyebrow="RELACIÓN CON CLIENTES" title="Clientes" description="Tu red de confianza y su historial crediticio." action={onNew} actionLabel="Añadir con préstamo" icon={UserRound} helpKey="clientes" />
      {loading
        ? <div className="client-grid">{[1,2,3,4,5,6].map((i) => <div key={i} className="panel client-card client-skeleton"><div className="sk sk-avatar"/><div className="sk sk-name"/><div className="sk sk-meta"/><div className="sk sk-score"/></div>)}</div>
        : grouped.length === 0
          ? <div className="empty-state-page"><UserRound size={40}/><h3>Sin clientes todavía</h3><p>Los clientes aparecen aquí al crear un préstamo.</p><button className="primary-button" onClick={onNew}><Plus size={16}/> Nuevo préstamo</button></div>
          : (
            <div className="client-grid">
              {grouped.map((client, i) => (
                <motion.article
                  key={client.client}
                  whileHover={{ y: -4 }}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.06 }}
                  className="panel client-card"
                >
                  <div className="client-head">
                    <div className="client-avatar">{client.client.split(' ').map((x) => x[0]).slice(0,2).join('')}</div>
                    <button className="client-edit-btn" onClick={() => onEdit(client)} title="Editar cliente"><Edit3 size={15}/></button>
                  </div>
                  <h3>{client.client}</h3>
                  <p>DNI {client.dni || '—'} · {client.address || 'Sin dirección'}</p>
                  {(() => {
                    const { score, label, cls } = calcScore(client.client)
                    return (
                      <div className="score-row">
                        <div>
                          <small>SCORE CREDITICIO INTERNO</small>
                          <b className={cls === 'alto' ? 'text-red' : cls === 'medio' ? '' : 'text-green'}>
                            {score}<span>/850</span>
                          </b>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span className={`score-badge score-${cls}`}>
                            {cls === 'bajo' ? '★ ' : cls === 'medio' ? '◑ ' : '⚠ '}{label}
                          </span>
                          <HelpBtn contentKey="score_crediticio" size="sm" />
                        </div>
                      </div>
                    )
                  })()}
                  <div className="client-metrics">
                    <div><small>Préstamo actual</small><b><Money value={client.principal}/></b></div>
                    <div><small>Cuotas pagadas</small><b>{client.paid} <span>/ {client.installments}</span></b></div>
                  </div>
                  <a className="client-whatsapp" href={`https://wa.me/${sanitizePhone(client.phone)}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={15}/> Contactar por WhatsApp <ArrowUpRight size={14}/>
                  </a>
                  {/* Volver a prestar — abre modal precargado con datos del cliente */}
                  <button
                    className="client-represtamo"
                    onClick={() => onNew({ prefill: { client: client.client, phone: client.phone, dni: client.dni, address: client.address, risk: client.risk } })}
                  >
                    <RefreshCcw size={13}/> Volver a prestar
                  </button>
                </motion.article>
              ))}
            </div>
          )}
    </>
  )
}

/* ═══════════════════════════════════════════════
   ALERTAS
═══════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Alerts({ alerts, loans, loading, onPay }) {
  const overdueTotal   = alerts.filter((a) => a.diffDays < 0).reduce((s,a) => s+Number(a.amount), 0)
  const dueTodayTotal  = alerts.filter((a) => a.diffDays === 0).reduce((s,a) => s+Number(a.amount), 0)
  const due48Total     = alerts.filter((a) => a.diffDays > 0 && a.diffDays <= 2).reduce((s,a) => s+Number(a.amount), 0)

  return (
    <>
      <PageTitle eyebrow="AVISOS INTELIGENTES" title="Alertas" description="Cuotas que requieren atención inmediata ordenadas por urgencia." icon={Bell} helpKey="alertas" />
      <div className="alerts-summary">
        <div className="alert-chip overdue"><AlertTriangle size={17}/><div><b>En mora</b><Money value={overdueTotal}/><small>{alerts.filter((a) => a.diffDays < 0).length} cuotas</small></div></div>
        <div className="alert-chip today"><Clock size={17}/><div><b>Vencen hoy</b><Money value={dueTodayTotal}/><small>{alerts.filter((a) => a.diffDays === 0).length} cuotas</small></div></div>
        <div className="alert-chip soon"><Bell size={17}/><div><b>Próximas 48 hs</b><Money value={due48Total}/><small>{alerts.filter((a) => a.diffDays > 0 && a.diffDays <= 2).length} cuotas</small></div></div>
      </div>
      {loading ? <div className="panel" style={{padding:'24px'}}>{[1,2,3].map((i) => <div key={i} className="due-row-skeleton"/>)}</div>
        : alerts.length === 0 ? <div className="empty-state-page"><CheckCheck size={40}/><h3>Todo al día</h3><p>No hay cuotas vencidas ni próximas a vencer en 48 horas.</p></div>
        : (
          <section className="panel alerts-list-panel">
            {alerts.map((a, i) => {
              const loan = loans.find((l) => l.id === a.loanId)
              const urgency = a.diffDays < 0 ? 'mora' : a.diffDays === 0 ? 'today' : 'soon'
              const label = a.diffDays < 0 ? `Vencida hace ${Math.abs(a.diffDays)} día${Math.abs(a.diffDays)!==1?'s':''}` : a.diffDays === 0 ? 'Vence hoy' : `Vence en ${a.diffDays} día${a.diffDays!==1?'s':''}`
              return (
                <motion.div
                  key={a.id}
                  className={`alert-row alert-${urgency}`}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05 }}
                >
                  <div className={`alert-urgency-bar ${urgency}`}/>
                  <div className="alert-person">
                    <div className="person-avatar sm">{a.client.split(' ').map((x) => x[0]).slice(0,2).join('')}</div>
                    <div><b>{a.client}</b><small>{label} · Cuota {a.n}{loan ? ` de ${loan.installments}` : ''} · {a.loanId}</small></div>
                  </div>
                  <div className="alert-amount"><b><Money value={a.amount}/></b><small>{a.status}</small></div>
                  <div className="alert-actions">
                    <button className="mini-action" onClick={() => onPay(a,'Pagado')}><Check size={14}/> Cobrar</button>
                    <a className="whatsapp" href={`https://wa.me/${sanitizePhone(a.phone)}?text=${encodeURIComponent(`Hola ${a.client.split(' ')[0]}, te recordamos que tu cuota ${a.n} de ${fmt(a.amount)} ${a.diffDays < 0 ? 'está vencida' : 'vence hoy'}. Por favor comunícate con nosotros.`)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${a.client}`}><MessageCircle size={16}/></a>
                    <a className="whatsapp subtle" href={`tel:${sanitizePhone(a.phone)}`} aria-label={`Llamar a ${a.client}`} title="Llamar"><Phone size={15}/></a>
                  </div>
                </motion.div>
              )
            })}
          </section>
        )}
    </>
  )
}

/* ═══════════════════════════════════════════════
   CAJA — tabla plana con búsqueda y filtros
═══════════════════════════════════════════════ */
function VoidCashModal({ count, bulk, mode, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const label = bulk ? `${count} movimientos` : 'este movimiento'

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim() || saving) return
    setSaving(true)
    try {
      if (await onConfirm(reason.trim())) onClose()
    } finally { setSaving(false) }
  }

  return createPortal(
    <motion.div className="modal-backdrop" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onMouseDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <motion.form className="loan-modal pn-void-cash-modal" onSubmit={submit}
        initial={{ opacity:0, y:16, scale:.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:10, scale:.98 }}>
        <div className="modal-header"><ArchiveRestore size={18} color="#ffb76b"/><span>Anular movimiento</span><button type="button" className="icon-button" style={{marginLeft:'auto'}} onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={16}/></button></div>
        <div className="modal-body">
          <p className="pn-void-cash-copy">Vas a anular <b>{label}</b> de {mode === 'ventas' ? 'Caja de ventas' : 'Caja de préstamos'}. Quedará en el historial y podrás restaurarlo; el pago y la cuota asociados no se borran.</p>
          <label className="field"><span>Motivo de la anulación</span><textarea className="field-input pn-void-cash-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: importe cargado por error" maxLength={180} required autoFocus/></label>
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="pn-btn-danger" disabled={saving || !reason.trim()}>{saving ? <Spinner size={14}/> : <ArchiveRestore size={14}/>} Confirmar anulación</button></div>
      </motion.form>
    </motion.div>,
    document.body,
  )
}

function Cash({ ledger, totals, loading, onExport, onDeleteMovements, onRestoreMovement, mode = 'prestamos', ventas = [], payments = [] }) {
  const [q,          setQ]     = useState('')
  const [filtro,     setFiltro]= useState('Todos')
  const [busyIds, setBusyIds] = useState([])
  const [voidTarget, setVoidTarget] = useState(null)

  const entradas = ledger.filter(x => !x.voided && x.type === 'Entrada').reduce((s,x) => s+x.amount, 0)
  const salidas  = ledger.filter(x => !x.voided && x.type === 'Salida').reduce((s,x) => s+x.amount, 0)
  const balance  = entradas - salidas
  const capitalColocado = mode === 'ventas'
    ? ventas.reduce((sum, v) => sum + Number(v.montoFinanciado ?? 0), 0)
    : Number(totals.principal ?? 0)
  const deudaTotal = mode === 'ventas'
    ? payments.filter(p => p.status !== 'Pagado').reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    : Number(totals.pendingAmount ?? 0)
  const recaudacionEsperada = balance + deudaTotal
  const deudaPorCliente = useMemo(() => {
    const map = new Map()
    payments.filter(p => p.status !== 'Pagado' && Number(p.amount) > 0).forEach(p => {
      const row = map.get(p.client) ?? { client:p.client, amount:0, count:0, nextDue:null }
      row.amount += Number(p.amount)
      row.count += 1
      if (p.due && (!row.nextDue || p.due < row.nextDue)) row.nextDue = p.due
      map.set(p.client, row)
    })
    return [...map.values()].sort((a,b) => b.amount-a.amount)
  }, [payments])

  const visible = useMemo(() => ledger.filter(m => {
    const okTipo = filtro === 'Todos' ? !m.voided : filtro === 'Anulados' ? m.voided : !m.voided && m.type === filtro
    const okQ    = !q.trim() || m.label.toLowerCase().includes(q.toLowerCase())
    return okTipo && okQ
  }), [ledger, filtro, q])

  const requestVoid = (rows, bulk = false) => {
    const ids = rows.map(row => row.id).filter(Boolean)
    if (!bulk && !ids.length) return
    setVoidTarget({ ids, bulk, count: bulk ? ledger.filter(m=>!m.voided).length : ids.length })
  }

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Wallet size={11}/> CONTROL FINANCIERO</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Caja</h2><HelpBtn contentKey={mode === 'ventas' ? 'v_caja' : 'p_caja'} /></div>
          <p className="pn-section-desc">{mode === 'ventas' ? 'Cobros y saldos pendientes de ventas a crédito.' : 'Saldo disponible, cartera prestada y dinero pendiente de recaudar.'}</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-green" onClick={onExport} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <Download size={15}/> Generar reporte
        </motion.button>
      </div>

      {/* Resumen explicado */}
      <div className="pn-cash-strip pn-cash-strip-four">
        {[
          { label:'Disponible ahora', value:balance, color:balance >= 0 ? 'green' : 'red', icon:Wallet, help:'Cobros recibidos menos dinero entregado.' },
          { label:mode === 'ventas' ? 'Financiado' : 'Capital prestado', value:capitalColocado, color:'purple', icon:Landmark, help:mode === 'ventas' ? 'Importe financiado en ventas registradas.' : 'Capital originalmente entregado en préstamos activos.' },
          { label:'Pendiente de cobro', value:deudaTotal, color:'amber', icon:Clock, help:'Saldo de cuotas aún no pagadas.' },
          { label:'Proyección al cobrar', value:recaudacionEsperada, color:'green', icon:TrendingUp, help:'Saldo de hoy más las cuotas pendientes.' },
        ].map((k, i) => (
          <motion.div key={k.label} className={`pn-cash-card pn-cash-${k.color}`}
            initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.07 }}>
            <div className="pn-cash-card-top">
              <span>{k.label}</span><k.icon size={15}/>
            </div>
            {loading ? <div className="pn-kpi-sk"/> : <div className="pn-cash-val">{fmt(k.value)}</div>}
            <small className="pn-cash-help">{k.help}</small>
          </motion.div>
        ))}
      </div>

      {deudaPorCliente.length > 0 && (
        <section className="pn-panel pn-cash-debt-panel">
          <div className="pn-panel-header">
            <span className="pn-panel-title"><Users size={14}/> Deuda pendiente por cliente</span>
            <span className="pn-count">{deudaPorCliente.length} clientes</span>
          </div>
          <div className="pn-cash-debt-list">
            {deudaPorCliente.slice(0, 8).map((row, i) => (
              <motion.div key={row.client} className="pn-cash-debt-row"
                initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.035}}>
                <span className="pn-cash-debt-avatar">{row.client?.split(' ').map(x=>x[0]).slice(0,2).join('') || '?'}</span>
                <span className="pn-cash-debt-name"><b>{row.client}</b><small>{row.count} cuotas · próximo vencimiento {row.nextDue ? new Date(`${row.nextDue}T12:00:00`).toLocaleDateString('es-AR') : 'sin fecha'}</small></span>
                <strong>{fmt(row.amount)}</strong>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="pn-toolbar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar movimiento…" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <div className="pn-filter-pills">
          {['Todos','Entrada','Salida','Anulados'].map(f => (
            <button key={f} className={`pn-pill ${filtro===f?'pn-pill-active':''}`} onClick={()=>setFiltro(f)}>{f}</button>
          ))}
        </div>
        <span className="pn-count">{visible.length} mov.</span>
        <button className="pn-btn-danger pn-btn-sm pn-cash-clear" type="button" disabled={!ledger.some(m => !m.voided) || busyIds.length > 0} onClick={() => requestVoid([], true)}>
          {busyIds.length > 1 ? <Loader2 size={14} className="pn-spin"/> : <ArchiveRestore size={14}/>} Anular movimientos
        </button>
      </div>

      {/* Tabla */}
      {loading
        ? <div className="pn-sk-rows">{[1,2,3,4,5].map(i=><div key={i} className="pn-sk-row"/>)}</div>
        : visible.length === 0
          ? <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="pn-empty-icon"><Wallet size={28}/></div>
              <h3>Sin movimientos</h3>
              <p>Los movimientos aparecen al registrar cobros y préstamos.</p>
            </motion.div>
          : <motion.div className="pn-panel" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15 }}>
              <div className="table-scroll">
                <table className="pn-table">
                  <thead><tr><th>DESCRIPCIÓN</th><th>TIPO</th><th>IMPORTE</th><th>FECHA / HORA</th><th>ACCIÓN</th></tr></thead>
                  <tbody>
                    {visible.map((m, i) => (
                      <motion.tr key={m.id} className={`pn-cash-row pn-cash-row-${m.type === 'Entrada' ? 'entrada' : 'salida'} ${m.voided ? 'pn-cash-row-voided' : ''}`}
                        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.1+i*.02 }}>
                        <td className="pn-td-main">
                          <span className={`pn-cash-dot ${m.type==='Entrada'?'dot-green':'dot-red'}`}/>
                          {m.label}
                          {m.voided && <small className="pn-cash-void-note">ANULADO · {m.voidReason || 'Sin motivo'}</small>}
                        </td>
                        <td>
                          <span className={`pn-tipo-chip ${m.type==='Entrada'?'pn-tipo-green':'pn-tipo-red'}`}>
                            {m.type==='Entrada'?<ArrowDownLeft size={10}/>:<ArrowUpRight size={10}/>} {m.type}
                          </span>
                        </td>
                        <td className={m.type==='Entrada'?'pn-td-green':'pn-td-red'}>
                          {m.type==='Salida'?'−':''}{fmt(m.amount)}
                        </td>
                        <td className="pn-td-muted">{m.time}</td>
                        <td>
                          {m.voided
                            ? <button className="pn-btn-icon pn-cash-restore" type="button" title="Restaurar movimiento" aria-label={`Restaurar movimiento: ${m.label}`} disabled={busyIds.includes(m.id)} onClick={async () => { setBusyIds([m.id]); await onRestoreMovement?.(m.id); setBusyIds([]) }}>
                                {busyIds.includes(m.id) ? <Loader2 size={13} className="pn-spin"/> : <ArchiveRestore size={13}/>}
                              </button>
                            : <button className="pn-btn-icon pn-btn-danger-icon pn-cash-delete" type="button" title="Anular movimiento" aria-label={`Anular movimiento: ${m.label}`} disabled={busyIds.includes(m.id)} onClick={() => requestVoid([m])}>
                                {busyIds.includes(m.id) ? <Loader2 size={13} className="pn-spin"/> : <Trash2 size={13}/>}
                              </button>}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
      }
      <AnimatePresence>
        {voidTarget && <VoidCashModal count={voidTarget.count} bulk={voidTarget.bulk} mode={mode}
          onClose={() => setVoidTarget(null)}
          onConfirm={async reason => {
            const ids = voidTarget.bulk ? [] : voidTarget.ids
            setBusyIds(ids)
            try { return await onDeleteMovements?.(ids, { bulk:voidTarget.bulk, mode, reason }) }
            finally { setBusyIds([]) }
          }} />}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   COMPROBANTES — grid de recibos por cliente
═══════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Receipts({ payments, loading, onReceipt, onExport }) {
  const [q, setQ]       = useState('')
  const [selected, setSel] = useState(null) // cliente seleccionado

  const paid = useMemo(
    () => payments.filter(p => p.status === 'Pagado' || p.status === 'Parcial'),
    [payments]
  )

  // Clientes únicos con sus recibos
  const clientes = useMemo(() => {
    const map = new Map()
    for (const p of paid) {
      if (!map.has(p.client)) map.set(p.client, { client: p.client, phone: p.phone, items: [] })
      map.get(p.client).items.push(p)
    }
    return [...map.values()].filter(g =>
      !q.trim() || g.client.toLowerCase().includes(q.toLowerCase())
    )
  }, [paid, q])

  const clienteActual = selected ? clientes.find(c => c.client === selected) : null
  const totalGeneral  = paid.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <>
      <PageTitle
        eyebrow="DOCUMENTACIÓN"
        title="Comprobantes"
        description="Recibos de todos los cobros registrados."
        action={onExport}
        actionLabel="Generar reporte"
        icon={FileSpreadsheet}
        helpKey="comprobantes"
      />

      {/* Resumen rápido */}
      <div className="recibos-summary">
        <div className="recibos-stat">
          <span><ReceiptText size={14}/> Total recibos</span>
          <b>{paid.length}</b>
        </div>
        <div className="recibos-stat verde">
          <span><Check size={14}/> Total cobrado</span>
          <b className="text-green"><Money value={totalGeneral}/></b>
        </div>
        <div className="recibos-stat">
          <span><Users size={14}/> Clientes con recibos</span>
          <b>{clientes.length}</b>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="recibos-toolbar">
        <label className="searchbox" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15}/>
          <input
            placeholder="Buscar cliente…"
            value={q}
            onChange={e => { setQ(e.target.value); setSel(null) }}
          />
        </label>
        {selected && (
          <button className="secondary-button" style={{ height: 33, fontSize: 11 }} onClick={() => setSel(null)}>
            <X size={13}/> Ver todos
          </button>
        )}
      </div>

      {loading ? (
        <div className="acc-skeleton-wrap">{[1,2,3].map(i => <div key={i} className="acc-skeleton"/>)}</div>
      ) : clientes.length === 0 ? (
        <div className="empty-state-page">
          <ReceiptText size={38}/>
          <h3>Sin comprobantes</h3>
          <p>Los recibos aparecen aquí al registrar un cobro.</p>
        </div>
      ) : clienteActual ? (
        /* Vista de detalle de un cliente */
        <div className="recibos-detalle">
          <div className="recibos-detalle-header">
            <div className="acc-avatar">{clienteActual.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
            <div>
              <b>{clienteActual.client}</b>
              <small>{clienteActual.items.length} recibo{clienteActual.items.length!==1?'s':''} · <Money value={clienteActual.items.reduce((s,p)=>s+Number(p.amount),0)}/> cobrado</small>
            </div>
          </div>
          <section className="panel table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>REFERENCIA</th><th>FECHA</th><th>IMPORTE</th><th>MÉTODO</th><th>ESTADO</th><th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {clienteActual.items.map(p => (
                    <tr key={p.id}>
                      <td className="mono" style={{ fontSize: 10 }}>{p.id}</td>
                      <td style={{ fontSize: 11 }}>{p.paidAt ? new Date(p.paidAt).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}) : p.due}</td>
                      <td className="money-cell">
                        <Money value={p.amount}/>
                        <small>Cap. {fmt(p.capital)} · Int. {fmt(p.interest)}</small>
                      </td>
                      <td><span className="method-badge"><CreditCard size={11}/> {p.method ?? 'efectivo'}</span></td>
                      <td><Status status={p.status}/></td>
                      <td>
                        <button className="mini-action subtle" onClick={() => onReceipt(p)}>
                          <Download size={13}/> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        /* Grid de tarjetas de clientes */
        <div className="recibos-grid">
          {clientes.map((g, i) => {
            const total    = g.items.reduce((s,p) => s + Number(p.amount), 0)
            const initials = g.client.split(' ').map(x=>x[0]).slice(0,2).join('')
            const ultimo   = g.items.sort((a,b) => new Date(b.paidAt||0) - new Date(a.paidAt||0))[0]
            return (
              <motion.button
                key={g.client}
                className="recibo-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 280, damping: 24 }}
                onClick={() => setSel(g.client)}
                whileHover={{ y: -3 }}
              >
                <div className="recibo-card-top">
                  <div className="acc-avatar">{initials}</div>
                  <div className="recibo-card-info">
                    <b>{g.client}</b>
                    <small>{g.phone || '—'}</small>
                  </div>
                  <span className="acc-badge acc-badge-good">{g.items.length} rec.</span>
                </div>
                <div className="recibo-card-amount"><Money value={total}/></div>
                <div className="recibo-card-meta">
                  <small>Último: {ultimo?.paidAt ? new Date(ultimo.paidAt).toLocaleDateString('es-AR',{dateStyle:'short'}) : '—'}</small>
                  <span className="recibo-card-ver">Ver recibos <ArrowRight size={12}/></span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════
   EXPORT MODAL — asistente de generación de reporte
═══════════════════════════════════════════════ */
function ExportModal({ modo, loans, ventas = [], onClose, onGenerate }) {
  const [step, setStep]             = useState(1)
  const [formato, setFormato]       = useState(null)
  const [alcance, setAlcance]       = useState(null)
  const [clienteFiltro, setCliente] = useState('')
  const [desde, setDesde]           = useState('')
  const [hasta, setHasta]           = useState('')
  const [generando, setGenerando]   = useState(false)

  const esVentas = modo === 'ventas'
  const accentColor = esVentas ? '#c785ff' : '#00ff87'
  const accentBg    = esVentas ? 'rgba(179,71,255,.12)' : 'rgba(0,255,135,.1)'
  const accentBorder= esVentas ? 'rgba(179,71,255,.4)'  : 'rgba(0,255,135,.4)'

  // Clientes únicos según módulo
  const clientesUnicos = useMemo(() => {
    if (esVentas) return [...new Set(ventas.map(v => v.client))].sort()
    return [...new Set(loans.map(l => l.client))].sort()
  }, [esVentas, loans, ventas])

  const setPeriodo = (dias) => {
    const h = new Date(), d = new Date(h)
    d.setDate(h.getDate() - dias)
    setDesde(d.toISOString().slice(0, 10))
    setHasta(h.toISOString().slice(0, 10))
  }

  const canNext = () => {
    if (step === 1) return !!formato
    if (step === 2) return !!alcance && (alcance !== 'cliente' || clienteFiltro.trim())
    return true
  }

  const handleGenerate = async () => {
    if (generando) return
    setGenerando(true)
    await onGenerate({ formato, alcance, clienteFiltro, desde: desde || null, hasta: hasta || null })
    setGenerando(false)
  }

  const STEP_LABELS = ['Formato', 'Alcance', 'Período']

  const alcanceOpts = esVentas
    ? [
        { id: 'general', icon: Store,     label: 'Todas las ventas',       desc: 'Incluye todas las ventas a crédito y sus movimientos.' },
        { id: 'cliente', icon: UserRound, label: 'Un cliente específico',  desc: 'Solo las compras y cuotas del cliente que elijas.' },
        { id: 'fechas',  icon: Calendar,  label: 'Por período de tiempo',  desc: 'Filtrá por rango de fechas de venta.' },
      ]
    : [
        { id: 'general', icon: Wallet,    label: 'Toda la cartera',        desc: 'Incluye todos los préstamos, movimientos y recibos.' },
        { id: 'cliente', icon: UserRound, label: 'Un cliente específico',  desc: 'Solo los datos del cliente que elijas.' },
        { id: 'fechas',  icon: Calendar,  label: 'Por período de tiempo',  desc: 'Filtrá por rango de fechas.' },
      ]

  return (
    <motion.div
      className="help-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="export-modal"
        style={{ '--em-accent': accentColor, '--em-accent-bg': accentBg, '--em-accent-border': accentBorder }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-modal-icon" style={{ color: accentColor, background: accentBg, border: `1px solid ${accentBorder}` }}>
            <FileSpreadsheet size={22}/>
          </div>
          <div>
            <p className="help-modal-eyebrow" style={{ color: accentColor }}>
              {esVentas ? 'REPORTE DE VENTAS' : 'REPORTE DE PRÉSTAMOS'}
            </p>
            <h3 className="help-modal-title">Exportar datos</h3>
          </div>
          <button className="help-modal-close" onClick={onClose} type="button"><X size={18}/></button>
        </div>

        {/* Steps */}
        <div className="export-steps">
          {STEP_LABELS.map((l, i) => (
            <div key={i} className={`export-step ${step === i+1 ? 'active' : step > i+1 ? 'done' : ''}`}
              style={step === i+1 ? { '--step-color': accentColor } : {}}>
              <div className="export-step-dot">{step > i+1 ? <Check size={11}/> : i+1}</div>
              <span>{l}</span>
            </div>
          ))}
        </div>

        <div className="help-modal-divider"/>

        <div className="export-modal-body">

          {/* PASO 1: formato */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} className="export-step-content">
              <p className="export-step-label">¿En qué formato querés el reporte?</p>
              <div className="export-format-grid">
                <button className={`export-format-card ${formato === 'word' ? 'selected' : ''}`} onClick={() => setFormato('word')}>
                  <div className="export-format-icon word"><FileText size={28}/></div>
                  <b>Word (.docx)</b>
                  <small>{esVentas
                    ? 'Resumen de ventas por cliente, artículos comprados y cuotas. Listo para entregar.'
                    : 'Cartera de préstamos con cronograma y libro de caja. Listo para imprimir.'
                  }</small>
                </button>
                <button className={`export-format-card ${formato === 'excel' ? 'selected' : ''}`} onClick={() => setFormato('excel')}>
                  <div className="export-format-icon excel"><FileSpreadsheet size={28}/></div>
                  <b>Excel (.xlsx)</b>
                  <small>{esVentas
                    ? '3 hojas: Resumen, Ventas y Movimientos de caja de ventas.'
                    : '3 hojas: Resumen, Préstamos y Movimientos de caja.'
                  }</small>
                </button>
              </div>
            </motion.div>
          )}

          {/* PASO 2: alcance */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} className="export-step-content">
              <p className="export-step-label">¿Qué datos querés incluir?</p>
              <div className="export-alcance-list">
                {alcanceOpts.map(opt => (
                  <button key={opt.id}
                    className={`export-alcance-card ${alcance === opt.id ? 'selected' : ''}`}
                    onClick={() => { setAlcance(opt.id); setCliente('') }}
                  >
                    <div className="export-alcance-icon"><opt.icon size={18}/></div>
                    <div><b>{opt.label}</b><small>{opt.desc}</small></div>
                    {alcance === opt.id && <Check size={16} className="export-check"/>}
                  </button>
                ))}
              </div>
              {alcance === 'cliente' && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} style={{ marginTop: 14 }}>
                  <label className="export-select-label">
                    <span>Seleccionar cliente</span>
                    <div className="export-select-wrap">
                      <UserRound size={15} className="export-select-icon"/>
                      <select
                        value={clienteFiltro}
                        onChange={e => setCliente(e.target.value)}
                        className="export-select"
                      >
                        <option value="">— Elegir cliente —</option>
                        {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </label>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PASO 3: período */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} className="export-step-content">
              <p className="export-step-label">¿Qué período de tiempo?</p>
              <div className="export-periodo-quick">
                {[
                  { label: 'Últimos 30 días',   dias: 30 },
                  { label: 'Últimos 90 días',   dias: 90 },
                  { label: 'Este año',           dias: 365 },
                  { label: 'Todo el historial',  dias: null },
                ].map(p => (
                  <button key={p.label}
                    className={`export-quick-btn ${!desde && !hasta && p.dias === null ? 'selected' : desde && p.dias !== null && (() => { const d=new Date(); const f=new Date(d); f.setDate(d.getDate()-p.dias); return desde===f.toISOString().slice(0,10) })() ? 'selected' : ''}`}
                    onClick={() => p.dias === null ? (setDesde(''), setHasta('')) : setPeriodo(p.dias)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="form-grid" style={{ marginTop: 14 }}>
                <Field label="Desde (opcional)" value={desde} onChange={e => setDesde(e.target.value)} type="date"/>
                <Field label="Hasta (opcional)" value={hasta} onChange={e => setHasta(e.target.value)} type="date"/>
              </div>
              {!desde && !hasta && (
                <p style={{ fontSize: 11, color: '#9498a6', marginTop: 8 }}>Sin fechas = se incluye todo el historial.</p>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="export-modal-footer">
          {step > 1 && (
            <button className="secondary-button" onClick={() => setStep(s => s - 1)} type="button">
              <ChevronLeft size={15}/> Atrás
            </button>
          )}
          <span style={{ flex: 1 }}/>
          {step < 3 ? (
            <motion.button className="primary-button" onClick={() => setStep(s => s + 1)}
              disabled={!canNext()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="button"
              style={canNext() ? { background: `linear-gradient(${esVentas ? '#8030c8,#6520a8' : '#1a7a4a,#145c38'}) padding-box, linear-gradient(115deg,${esVentas ? '#b347ff,#e040fb 45%,#00ff87' : '#00ff87,#00cc6a 45%,#b347ff'}) border-box`, border:'1px solid transparent' } : {}}>
              Siguiente <ArrowRight size={15}/>
            </motion.button>
          ) : (
            <motion.button className="primary-button" onClick={handleGenerate}
              disabled={generando} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="button"
              style={{ background: `linear-gradient(${esVentas ? '#8030c8,#6520a8' : '#1a7a4a,#145c38'}) padding-box, linear-gradient(115deg,${esVentas ? '#b347ff,#e040fb 45%,#00ff87' : '#00ff87,#00cc6a 45%,#b347ff'}) border-box`, border:'1px solid transparent' }}>
              {generando ? <Spinner size={15}/> : <Download size={15}/>}
              {generando ? 'Generando…' : `Descargar ${formato === 'excel' ? 'Excel' : 'Word'}`}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FIELD — reutilizable form field
═══════════════════════════════════════════════════════════════ */
function Field({ label, value, onChange, type = 'text', placeholder, prefix, suffix, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span className="field-prefix" style={{ position: 'absolute', left: 10, color: '#9498a6', pointerEvents: 'none' }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={prefix ? { paddingLeft: 26 } : suffix ? { paddingRight: 26 } : undefined}
          {...props}
        />
        {suffix && <span className="field-suffix" style={{ position: 'absolute', right: 10, color: '#9498a6', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </label>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FIELD WITH ERROR
═══════════════════════════════════════════════════════════════ */
function FieldWithError({ label, value, onChange, type = 'text', placeholder, prefix, suffix, error, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span className="field-prefix" style={{ position: 'absolute', left: 10, color: '#9498a6', pointerEvents: 'none' }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={Object.assign(
            prefix ? { paddingLeft: 26 } : suffix ? { paddingRight: 26 } : {},
            error ? { borderColor: '#f97066' } : {},
          )}
          {...props}
        />
        {suffix && <span className="field-suffix" style={{ position: 'absolute', right: 10, color: '#9498a6', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
      {error && <span style={{ fontSize: 11, color: '#f97066', marginTop: 3 }}>{error}</span>}
    </label>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ESTADISTICAS — Analytics (legacy, simplified)
═══════════════════════════════════════════════════════════════ */
// Pantalla anterior conservada como referencia durante la renovación del módulo.
// eslint-disable-next-line no-unused-vars
function Estadisticas({ loans = [], allLoans = [], payments = [], receipts = [], monthBars = [], loading = false }) {
  const metrics = useMemo(() => {
    const todosLoans   = allLoans.length > 0 ? allLoans : loans
    const capitalTotal = todosLoans.reduce((s, l) => s + Number(l.principal || 0), 0)
    const totalCobrado = receipts.reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalCuotas  = todosLoans.reduce((s, l) => s + Number(l.installments || 0), 0)
    const pagadas      = todosLoans.reduce((s, l) => s + Number(l.paid || 0), 0)
    const tasaCobro    = totalCuotas > 0 ? Math.round((pagadas / totalCuotas) * 100) : 0
    const ticketProm   = todosLoans.length > 0 ? capitalTotal / todosLoans.length : 0
    const enMora       = loans.filter(l => l.status === 'En mora').length
    const completados  = todosLoans.filter(l => l.status === 'Pagado').length

    const clienteMap = new Map()
    for (const p of payments) {
      if (!clienteMap.has(p.client)) clienteMap.set(p.client, { client: p.client, phone: p.phone, pendiente: 0, vencidas: 0 })
      const c = clienteMap.get(p.client)
      c.pendiente += Number(p.amount || 0)
      if (p.status === 'Vencido') c.vencidas += 1
    }
    for (const l of loans) {
      if (!clienteMap.has(l.client)) clienteMap.set(l.client, { client: l.client, phone: l.phone, pendiente: 0, vencidas: 0 })
    }
    const rankingClientes = [...clienteMap.values()].sort((a, b) => b.pendiente - a.pendiente)

    return { capitalTotal, totalCobrado, tasaCobro, ticketProm, enMora, completados, rankingClientes, todosLoans }
  }, [loans, allLoans, payments, receipts])

  const MONTHS_SHORT_LOCAL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const maxBar = Math.max(...monthBars, 1)

  if (loading) return (
    <>
      <PageTitle eyebrow="ANÁLISIS" title="Estadísticas" description="Calculando métricas…" icon={PieChart}/>
      <div className="acc-skeleton-wrap">{[1,2,3].map(i=><div key={i} className="acc-skeleton"/>)}</div>
    </>
  )

  return (
    <>
      <PageTitle eyebrow="ANÁLISIS" title="Estadísticas" description="Resumen ejecutivo de tu cartera." icon={PieChart} helpKey="estadisticas"/>

      <div className="pi-kpi-row">
        {[
          { label:'Capital colocado',  value:metrics.capitalTotal,  color:'purple', icon:Landmark },
          { label:'Total cobrado',     value:metrics.totalCobrado,  color:'green',  icon:ArrowDownLeft },
          { label:'Tasa de cobro',     value:`${metrics.tasaCobro}%`, color:'green', icon:TrendingUp, isMoney:false },
          { label:'Ticket promedio',   value:metrics.ticketProm,    color:'amber',  icon:BarChart3 },
        ].map((k,i) => (
          <motion.div key={k.label} className={`pi-kpi pi-kpi-${k.color}`}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}>
            <div className="pi-kpi-top"><span>{k.label}</span><k.icon size={15}/></div>
            <b>{k.isMoney === false ? k.value : fmt(k.value)}</b>
          </motion.div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
        {/* Gráfico barras */}
        {monthBars.some(v=>v>0) && (
          <section className="panel pi-bars-section">
            <div className="panel-header"><div className="section-title"><BarChart3 size={14}/> Cobrado por mes</div></div>
            <div className="pi-bars">
              {monthBars.map((v,i) => {
                const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1)
                return (
                  <div key={i} className="pi-bar-col">
                    <div className="pi-bar-wrap"><div className="pi-bar-fill" style={{ height:`${(v/maxBar)*100}%` }}/></div>
                    <span>{MONTHS_SHORT_LOCAL[d.getMonth()]}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Ranking */}
        <section className="panel" style={{ padding:0, overflow:'hidden' }}>
          <div className="panel-header" style={{ padding:'14px 18px' }}>
            <div className="section-title"><Users size={14}/> Clientes por saldo pendiente</div>
            <p>{metrics.rankingClientes.length} clientes activos</p>
          </div>
          {metrics.rankingClientes.length === 0
            ? <div className="empty-state" style={{ padding:20 }}>Sin datos de clientes todavía.</div>
            : (
              <div style={{ padding:'0 18px 14px' }}>
                {metrics.rankingClientes.slice(0,8).map((c,i) => {
                  const maxPend = metrics.rankingClientes[0]?.pendiente || 1
                  return (
                    <div key={c.client} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:13, color:'#e2e3e8' }}>{i+1}. {c.client}</span>
                        <span style={{ fontSize:13, fontWeight:700, color: c.vencidas>0 ? '#ff6080' : '#00ff87' }}>{fmt(c.pendiente)}</span>
                      </div>
                      <div style={{ height:3, borderRadius:4, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(c.pendiente/maxPend)*100}%`, background: c.vencidas>0 ? '#ff4d6d' : '#00ff87', borderRadius:4 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </section>
      </div>

      {/* Estado cartera */}
      <div className="pi-kpi-row" style={{ marginTop:16 }}>
        {[
          { label:'Préstamos activos',  value:loans.filter(l=>l.status==='Activo').length,  isMoney:false, color:'purple', icon:BriefcaseBusiness },
          { label:'En mora',            value:metrics.enMora,                               isMoney:false, color:'amber',  icon:AlertTriangle },
          { label:'Completados',        value:metrics.completados,                          isMoney:false, color:'green',  icon:CheckCheck },
          { label:'Total préstamos',    value:metrics.todosLoans.length,                    isMoney:false, color:'blue',   icon:Activity },
        ].map((k,i) => (
          <motion.div key={k.label} className={`pi-kpi pi-kpi-${k.color}`}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3+i*0.07 }}>
            <div className="pi-kpi-top"><span>{k.label}</span><k.icon size={15}/></div>
            <b>{k.value}</b>
          </motion.div>
        ))}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LOAN MODAL — crear nuevo préstamo
═══════════════════════════════════════════════════════════════ */
function LoanModal({ onClose, onCreate, userId, prefill = {}, inline = false }) {
  const [client,   setClient]   = useState(prefill.client   || '')
  const [phone,    setPhone]    = useState(prefill.phone    || '')
  const [dni,      setDni]      = useState(prefill.dni      || '')
  const [address,  setAddress]  = useState(prefill.address  || '')
  const [risk,     setRisk]     = useState(prefill.risk     || 'medio')
  const [monto,    setMonto]    = useState('')
  const [tasa,     setTasa]     = useState('20')
  const [cuotas,   setCuotas]   = useState('10')
  const [freq,     setFreq]     = useState('diario')
  const [firstDue, setFirstDue] = useState(today)
  const [omitSun,  setOmitSun]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [sugs,     setSugs]     = useState([])
  const [errors,   setErrors]   = useState({})

  const preview = useMemo(() =>
    calcularPrestamoDirecto(monto, tasa, Number(cuotas), freq, firstDue, omitSun),
    [monto, tasa, cuotas, freq, firstDue, omitSun]
  )

  const searchRef = useRef(null)
  useEffect(() => {
    clearTimeout(searchRef.current)
    let active = true
    if (!client || client.length < 2) {
      searchRef.current = setTimeout(() => { if (active) setSugs([]) }, 0)
    } else {
      searchRef.current = setTimeout(async () => {
        try { const r = await buscarClientesPorNombre(userId, client); if (active) setSugs(r || []) }
        catch { if (active) setSugs([]) }
      }, 350)
    }
    return () => { active = false; clearTimeout(searchRef.current) }
  }, [client, userId])

  function pickSug(c) {
    setClient(c.name || ''); setPhone(c.phone || ''); setDni(c.dni || '')
    setAddress(c.address || ''); setRisk(c.risk || 'medio'); setSugs([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!client.trim()) errs.client = 'Requerido'
    if (!monto || Number(monto) <= 0) errs.monto = 'Monto inválido'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (!preview) { setErrors({ monto: 'Revisá los datos del préstamo' }); return }
    setSaving(true)
    try {
      await onCreate({ client: client.trim(), phone, dni, address, risk, principal: Number(monto), rate: Number(tasa), installments: Number(cuotas), frequency: freq, firstDue, omitSunday: omitSun, schedule: preview.cronograma })
    } catch (err) { setErrors({ submit: err.message }) }
    finally { setSaving(false) }
  }

  const body = (
    <form onSubmit={handleSubmit} noValidate>
      <div className="lm-body">
        <div className="lm-fields-column">
        {/* ── Sección cliente ── */}
        <div className="lm-section">
          <div className="lm-section-header">
            <UserRound size={16} className="lm-section-icon"/>
            <h3>Datos del cliente</h3>
          </div>
          <div className="lm-grid">
            {/* Nombre con autocomplete */}
            <div className="lm-field-full" style={{ position:'relative' }}>
              <label className="lm-label">Nombre completo *</label>
              <input className={`lm-input ${errors.client ? 'lm-input-error' : ''}`}
                value={client} onChange={e => setClient(e.target.value)}
                placeholder="Juan García" autoComplete="off"/>
              {errors.client && <span className="lm-error">{errors.client}</span>}
              <AnimatePresence>
                {sugs.length > 0 && (
                  <motion.div className="lm-sugs"
                    initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                    {sugs.map((s, i) => (
                      <button key={i} type="button" className="lm-sug" onClick={() => pickSug(s)}>
                        <div className="lm-sug-av">{(s.name||'?')[0]}</div>
                        <div>
                          <b>{s.name}</b>
                          <span>{s.phone || 'Sin teléfono'}</span>
                        </div>
                        {s.activeLoan && <span className="lm-sug-badge">Activo</span>}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <label className="lm-label">Teléfono</label>
              <input className="lm-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 1234-5678" type="tel"/>
            </div>
            <div>
              <label className="lm-label">DNI (opcional)</label>
              <input className="lm-input" value={dni} onChange={e => setDni(e.target.value)} placeholder="—"/>
            </div>
            <div>
              <label className="lm-label">Dirección (opcional)</label>
              <input className="lm-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="—"/>
            </div>
          </div>
        </div>

        {/* ── Sección condiciones ── */}
        <div className="lm-section">
          <div className="lm-section-header">
            <DollarSign size={16} className="lm-section-icon"/>
            <h3>Condiciones del préstamo</h3>
          </div>
          <div className="lm-grid">
            <div>
              <label className="lm-label">Capital a prestar *</label>
              <div className="lm-input-wrap">
                <span className="lm-prefix">$</span>
                <input className={`lm-input lm-input-prefix ${errors.monto ? 'lm-input-error' : ''}`}
                  value={monto} onChange={e => setMonto(e.target.value)} type="number" min="1" placeholder="50000"/>
              </div>
              {errors.monto && <span className="lm-error">{errors.monto}</span>}
            </div>
            <div>
              <label className="lm-label">Tasa de interés total</label>
              <div className="lm-input-wrap">
                <input className="lm-input lm-input-suffix" value={tasa} onChange={e => setTasa(e.target.value)} type="number" min="0" step="0.5" placeholder="20"/>
                <span className="lm-suffix">%</span>
              </div>
            </div>
            <div>
              <label className="lm-label">Número de cuotas</label>
              <input className="lm-input" value={cuotas} onChange={e => setCuotas(e.target.value)} type="number" min="1" placeholder="10"/>
            </div>
            <div>
              <label className="lm-label">Frecuencia de pago</label>
              <select className="lm-input" value={freq} onChange={e => setFreq(e.target.value)}>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div>
              <label className="lm-label">Primera cuota</label>
              <input className="lm-input" value={firstDue} onChange={e => setFirstDue(e.target.value)} type="date"/>
            </div>
            {freq === 'diario' && (
              <div className="lm-toggle-row">
                <label className="lm-toggle">
                  <input type="checkbox" checked={omitSun} onChange={e => setOmitSun(e.target.checked)}/>
                  <span className="lm-toggle-track"><span className="lm-toggle-thumb"/></span>
                  <span>Omitir domingos</span>
                </label>
              </div>
            )}
          </div>
        </div>
        {errors.submit && <div className="lm-submit-error">{errors.submit}</div>}
        </div>

        {/* ── Preview ── */}
        <AnimatePresence>
          {preview && (
            <motion.aside className="lm-summary-column"
              initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}>
              <div className="lm-preview">
                <div className="lm-preview-header">
                  <Sparkles size={14}/>
                  <span>Resumen del préstamo</span>
                </div>
                <div className="lm-preview-kpis">
                  <div className="lm-pkpi">
                    <span>Cuota fija</span>
                    <b>{fmt(preview.monto_cuota)}</b>
                  </div>
                  <div className="lm-pkpi">
                    <span>Interés total</span>
                    <b className="text-amber">{fmt(preview.total_interes)}</b>
                  </div>
                  <div className="lm-pkpi">
                    <span>Total a devolver</span>
                    <b className="text-green">{fmt(preview.total_a_pagar)}</b>
                  </div>
                  <div className="lm-pkpi">
                    <span>{preview.cronograma.length} cuotas</span>
                    <b>{preview.cronograma[0]?.fecha_vencimiento} → {preview.cronograma[preview.cronograma.length-1]?.fecha_vencimiento}</b>
                  </div>
                </div>
                {/* Cronograma compacto con todas las fechas de pago. */}
                <div className="lm-mini-sched">
                  {preview.cronograma.map((q, i) => (
                    <div key={i} className="lm-mini-row">
                      <span className="lm-mini-n">#{q.numero_cuota}</span>
                      <span className="lm-mini-date">{q.fecha_vencimiento}</span>
                      <span className="lm-mini-amt">{fmt(q.monto_cuota)}</span>
                    </div>
                  ))}
                </div>
                {freq === 'diario' && omitSun && <p className="lm-schedule-note">Las fechas omiten domingos.</p>}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <div className="lm-footer">
        {!inline && <button type="button" className="pn-btn-secondary" onClick={onClose}>Cancelar</button>}
        <motion.button type="submit" className="pn-btn-primary pn-btn-green lm-submit"
          disabled={saving || !preview}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: .97 }}>
          {saving ? <Spinner size={15}/> : <Plus size={15}/>}
          {saving ? 'Creando préstamo…' : 'Crear préstamo'}
        </motion.button>
      </div>
    </form>
  )

  if (inline) return (
    <div className="lm-page">
      <div className="lm-page-header">
        <div className="lm-page-icon"><HandCoins size={22}/></div>
        <div>
          <div className="pn-eyebrow"><DollarSign size={11}/> PRÉSTAMOS</div>
          <div className="pn-heading-with-help"><h2 className="lm-page-title">Nuevo préstamo</h2><HelpBtn contentKey="p_nuevo" /></div>
          <p className="lm-page-sub">Completá los datos para emitir el préstamo</p>
        </div>
      </div>
      {body}
    </div>
  )

  return createPortal(
    <motion.div className="lm-backdrop"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="lm-box"
        initial={{ opacity:0, scale:.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:.97, y:10 }}
        transition={{ type:'spring', damping:28, stiffness:300 }}>
        <div className="lm-modal-header">
          <div className="lm-page-icon"><HandCoins size={20}/></div>
          <div>
            <div className="pn-heading-with-help"><h2 className="lm-page-title">Nuevo préstamo</h2><HelpBtn contentKey="p_nuevo" /></div>
            <p className="lm-page-sub">Completá los datos para emitir</p>
          </div>
          <button type="button" className="lm-close" onClick={onClose}><X size={18}/></button>
        </div>
        {body}
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ═══════════════════════════════════════════════════════════════
   PARTIAL MODAL — pago parcial de cuota
═══════════════════════════════════════════════════════════════ */
function PartialModal({ payment, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const max = Number(payment?.amount || 0)

  async function handleConfirm() {
    const v = Number(amount)
    if (!v || v <= 0 || v > max) return
    setSaving(true)
    try { await onConfirm(Number(amount)) } finally { setSaving(false) }
  }

  return createPortal(
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="loan-modal" style={{ maxWidth: 380 }}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="modal-header">
          <CreditCard size={17} style={{ color: '#facc15' }} />
          <span>Pago parcial</span>
          <button type="button" className="icon-button" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14, color: '#9498a6', fontSize: 13 }}>
            <strong style={{ color: '#c8cad4' }}>{payment?.client}</strong>
            <br/>Cuota #{payment?.n} · Monto: <strong>{fmt(max)}</strong>
          </div>
          <FieldWithError
            label={`Monto a cobrar (máx. ${fmt(max)})`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            type="number"
            placeholder={String(max)}
            prefix="$"
            min="1"
            max={String(max)}
            error={Number(amount) > max ? `Máximo: ${fmt(max)}` : ''}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary-button" onClick={handleConfirm}
            disabled={saving || !amount || Number(amount) <= 0 || Number(amount) > max}>
            {saving ? <Spinner size={14}/> : <Check size={14}/>} Confirmar
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/* ═══════════════════════════════════════════════════════════════
   EDIT CLIENT MODAL
═══════════════════════════════════════════════════════════════ */
function EditClientModal({ client, onClose, onSave }) {
  const [nombre,    setNombre]    = useState(client?.client   || '')
  const [telefono,  setTelefono]  = useState(client?.phone    || '')
  const [dni,       setDni]       = useState(client?.dni      || '')
  const [direccion, setDireccion] = useState(client?.address  || '')
  const [riesgo]                  = useState(client?.risk     || 'medio')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!nombre.trim()) { setErr('El nombre es requerido'); return }
    setSaving(true)
    try {
      await onSave({ nombre: nombre.trim(), telefono: sanitizePhone(telefono), dni: dni.trim(), direccion: direccion.trim(), riesgo })
      onClose()
    } catch (ex) { setErr(ex.message) } finally { setSaving(false) }
  }

  return createPortal(
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.form className="loan-modal" style={{ maxWidth: 420 }} onSubmit={handleSave}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="modal-header">
          <Edit3 size={17} style={{ color: '#818cf8' }} />
          <span>Editar cliente</span>
          <button type="button" className="icon-button" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <FieldWithError label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} error={err}/>
            <Field label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} type="tel"/>
            <Field label="DNI" value={dni} onChange={e => setDni(e.target.value)}/>
            <Field label="Dirección" value={direccion} onChange={e => setDireccion(e.target.value)}/>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? <Spinner size={14}/> : <Check size={14}/>} Guardar
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  )
}

/* ═══════════════════════════════════════════════════════════════
   RUTA DIA — ruta de cobro del día
═══════════════════════════════════════════════════════════════ */
function RutaDia({ payments = [], loading = false, onPay, onPartial }) {
  const cobros = useMemo(() => {
    const pending  = payments.filter(p => p.status !== 'Pagado')
    const overdue  = pending.filter(p => daysUntil(p.due) < 0).sort((a,b) => daysUntil(a.due)-daysUntil(b.due))
    const todayDue = pending.filter(p => daysUntil(p.due) === 0)
    const tomorrow = pending.filter(p => daysUntil(p.due) === 1)
    return [...overdue, ...todayDue, ...tomorrow]
  }, [payments])

  const totalPendiente = cobros.reduce((s,p) => s + Number(p.amount), 0)

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Route size={11}/> COBROS DEL DÍA</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Ruta de Cobro</h2><HelpBtn contentKey="p_ruta" /></div>
          <p className="pn-section-desc">
            {cobros.length > 0
              ? <>{cobros.length} cobro{cobros.length!==1?'s':''} · <span className="text-green">{fmt(totalPendiente)}</span> pendiente</>
              : '0 cobros pendientes para hoy'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="pn-ruta-list">{[1,2,3].map(i=><div key={i} className="pn-ruta-sk"/>)}</div>
      ) : cobros.length === 0 ? (
        <motion.div className="pn-empty" initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }}>
          <motion.div className="pn-empty-icon pn-empty-icon-green"
            animate={{ scale:[1,1.08,1] }} transition={{ duration:2.5, repeat:Infinity }}>
            <CheckCheck size={30}/>
          </motion.div>
          <h3>¡Todo al día!</h3>
          <p>No hay cobros urgentes para hoy.</p>
        </motion.div>
      ) : (
        <div className="pn-ruta-list">
          {cobros.map((p, i) => {
            const dias    = daysUntil(p.due)
            const vencida = dias < 0
            const esHoy   = dias === 0
            const phone   = sanitizePhone(p.phone || '')
            const waMsg   = encodeURIComponent(`Hola ${p.client.split(' ')[0]}, te recordamos que tenés una cuota de ${fmt(p.amount)} que vence ${esHoy?'hoy':p.due}. PrestaNeo.`)
            return (
              <motion.div key={p.id}
                className={`pn-ruta-card ${vencida?'pn-ruta-vencida':esHoy?'pn-ruta-hoy':''}`}
                initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
                transition={{ delay:i*.06, type:'spring', stiffness:300, damping:26 }}>
                {/* Indicador lateral de urgencia */}
                <div className={`pn-ruta-urgencia ${vencida?'urg-red':esHoy?'urg-amber':'urg-dim'}`}/>

                <div className="pn-ruta-main">
                  <div className="pn-ruta-client-row">
                    <div className="pn-ruta-avatar">{p.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                    <div>
                      <h3 className="pn-ruta-client">{p.client}</h3>
                      <div className="pn-ruta-meta">
                        <span className="mono">{p.loanId}</span>
                        <span>·</span>
                        <span>Cuota {p.n}/{p.totalQuotas}</span>
                        <span>·</span>
                        {vencida
                          ? <span className="pn-badge-red"><CircleAlert size={9}/> {Math.abs(dias)}d vencida</span>
                          : esHoy
                            ? <span className="pn-badge-amber"><Clock size={9}/> Hoy</span>
                            : <span className="pn-badge-dim">Mañana</span>
                        }
                        {p.status === 'Parcial' && <span className="pn-badge-purple">Parcial</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pn-ruta-right">
                    <div className={`pn-ruta-amount ${vencida?'text-red':''}`}>{fmt(p.amount)}</div>
                    <div className="pn-ruta-date">{p.due}</div>
                  </div>
                </div>

                <div className="pn-ruta-actions">
                  {phone && (
                    <a className="pn-btn-wa pn-btn-sm"
                      href={`https://wa.me/${phone}?text=${waMsg}`}
                      target="_blank" rel="noreferrer" title="WhatsApp">
                      <MessageCircle size={14}/>
                    </a>
                  )}
                  {phone && (
                    <a className="pn-btn-icon" href={`tel:${phone}`} title="Llamar">
                      <Phone size={14}/>
                    </a>
                  )}
                  <button className="pn-btn-partial" onClick={() => onPartial(p)} title="Pago parcial">
                    <MoreHorizontal size={14}/>
                  </button>
                  <motion.button className="pn-btn-cobrar"
                    onClick={() => onPay(p, 'Pagado')}
                    whileHover={{ scale:1.05 }} whileTap={{ scale:.95 }}>
                    <Check size={14}/> Cobrar
                  </motion.button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════
   PRODUCTO MODAL
═══════════════════════════════════════════════════════════════ */
const CATEGORIAS = ['Electrodoméstico','Mueble','Electrónica','Herramienta','Ropa','Otro','General']

function ProductoModal({ producto, onClose, onSave }) {
  const [nombre,    setNombre]    = useState(producto?.nombre      || '')
  const [desc,      setDesc]      = useState(producto?.descripcion  || '')
  const [categoria, setCategoria] = useState(producto?.categoria    || 'General')
  const [precio,    setPrecio]    = useState(String(producto?.precioContado || ''))
  const [costo,     setCosto]     = useState(String(producto?.costo  || ''))
  const [stock,     setStock]     = useState(String(producto?.stock  ?? ''))
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')
  const editing = !!producto

  async function handleSave(e) {
    e.preventDefault()
    if (!nombre.trim()) { setErr('El nombre es requerido'); return }
    if (!precio || Number(precio) <= 0) { setErr('Precio inválido'); return }
    if (!editing && (stock === '' || !Number.isInteger(Number(stock)) || Number(stock) < 0)) { setErr('Ingresá un stock inicial entero igual o mayor a cero.'); return }
    setSaving(true)
    try {
      await onSave({
        id: producto?.id,
        nombre: nombre.trim(),
        descripcion: desc.trim(),
        categoria,
        precio_contado: Number(precio),
        costo: Number(costo) || 0,
        stock: stock !== '' ? Number(stock) : null,
      })
      onClose()
    } catch (ex) { setErr(ex.message) } finally { setSaving(false) }
  }

  return createPortal(
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.form className="loan-modal pn-product-modal" style={{ maxWidth: 560 }} onSubmit={handleSave}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="modal-header">
          <Package size={17} style={{ color: '#818cf8' }} />
          <span>{editing ? 'Editar producto' : 'Nuevo producto'}</span>
          <HelpBtn contentKey="v_catalogo" />
          <button type="button" className="icon-button" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)}/>
            <Field label="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)}/>
            <label className="field">
              <span>Categoría</span>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <Field label="Precio de venta ($)" value={precio} onChange={e => setPrecio(e.target.value)} type="number" prefix="$" min="1"/>
            <Field label="Costo ($)" value={costo} onChange={e => setCosto(e.target.value)} type="number" prefix="$" placeholder="Opcional"/>
            {!editing && <Field label="Stock inicial" value={stock} onChange={e => setStock(e.target.value)} type="number" placeholder="Ej.: 10" min="0" step="1" required/>}
          </div>
          <div className="pn-product-stock-help"><Layers size={14}/>{editing ? `Stock actual: ${producto?.stock ?? 0} unidades. Usá “Registrar movimiento” para reponer o retirar stock con motivo.` : 'Indicá cuántas unidades tenés listas para vender. Cada venta descontará las unidades automáticamente.'}</div>
          {err && <p className="pn-field-error pn-field-error-block" role="alert">{err}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? <Spinner size={14}/> : <Check size={14}/>} {editing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  )
}

/* ═══════════════════════════════════════════════════════════════
   CATALOGO
═══════════════════════════════════════════════════════════════ */
function Catalogo({ productos = [], movimientosStock = [], stockHistoryError, loading = false, onCreate, onUpdate, onDelete, onStockMovement }) {
  const [q,       setQ]      = useState('')
  const [modal,   setModal]  = useState(null)
  const [stockTarget, setStockTarget] = useState(null)
  const [catFil,  setCatFil] = useState('Todas')

  const cats = useMemo(() => ['Todas', ...new Set(productos.map(p => p.categoria))].sort(), [productos])

  const filtered = useMemo(() =>
    productos.filter(p =>
      (catFil === 'Todas' || p.categoria === catFil) &&
      (!q.trim() || `${p.nombre} ${p.descripcion} ${p.categoria}`.toLowerCase().includes(q.toLowerCase()))
    ), [productos, q, catFil]
  )

  async function handleSave(data) {
    if (data.id) await onUpdate(data.id, { nombre:data.nombre, descripcion:data.descripcion, categoria:data.categoria, precioContado:data.precio_contado??data.precioContado, costo:data.costo })
    else await onCreate({ nombre:data.nombre, descripcion:data.descripcion, categoria:data.categoria, precioContado:data.precio_contado??data.precioContado, costo:data.costo, stock:data.stock })
    setModal(null)
  }

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Package size={11}/> VENTAS</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Catálogo de Productos</h2><HelpBtn contentKey="v_catalogo" /></div>
          <p className="pn-section-desc">{productos.length} producto{productos.length!==1?'s':''} disponibles para venta a crédito.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={() => setModal('new')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <PackagePlus size={15}/> Agregar producto
        </motion.button>
        <button className="pn-btn-outline pn-btn-purple" disabled={!productos.length || Boolean(stockHistoryError)} onClick={() => setStockTarget({ productoId:productos[0]?.id })}>
          <Layers size={15}/> Registrar movimiento
        </button>
      </div>

      {stockHistoryError && <div className="pn-field-error pn-field-error-block" role="status">{stockHistoryError} Para habilitar reposiciones y el historial automático, aplicá `supabase/migrations/20261006000000_prestaneo_stock_movements.sql` en Supabase.</div>}

      <div className="pn-stock-overview">
        <div><small>Productos</small><b>{productos.length}</b></div>
        <div><small>Stock crítico</small><b className={productos.some(p => Number(p.stock) <= 3) ? 'pn-stock-low' : 'text-green'}>{productos.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 3).length}</b></div>
        <div><small>Agotados</small><b className={productos.some(p => Number(p.stock) <= 0) ? 'pn-stock-low' : 'text-green'}>{productos.filter(p => Number(p.stock) <= 0).length}</b></div>
        <div><small>Valor potencial del stock</small><b>{fmt(productos.reduce((sum,p) => sum + Number(p.precioContado || 0) * Number(p.stock || 0), 0))}</b></div>
      </div>

      <div className="pn-toolbar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar producto…" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <div className="pn-filter-pills">
          {cats.map(c => (
            <button key={c} className={`pn-pill ${catFil===c?'pn-pill-active-purple':''}`} onClick={()=>setCatFil(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="pn-prod-grid">{[1,2,3,4].map(i=><div key={i} className="pn-prod-sk"/>)}</div>
        : filtered.length === 0
          ? <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="pn-empty-icon pn-empty-icon-purple"><Package size={28}/></div>
              <h3>Sin productos</h3>
              <p>Agregá productos al catálogo para poder venderlos a crédito.</p>
            </motion.div>
          : <div className="pn-prod-grid">
              {filtered.map((p, i) => (
                <motion.div key={p.id} className="pn-prod-card"
                  initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i*.05, type:'spring', stiffness:260, damping:22 }}
                  whileHover={{ y:-4 }}>
                  <div className="pn-prod-header">
                    <span className="pn-prod-cat">{p.categoria}</span>
                    <div className="pn-prod-actions">
                      <button className="pn-btn-icon pn-stock-add-icon" disabled={Boolean(stockHistoryError)} title="Registrar entrada o salida de stock" aria-label={`Registrar movimiento de stock de ${p.nombre}`} onClick={() => setStockTarget(p)}><PackagePlus size={14}/></button>
                      <button className="pn-btn-icon" onClick={() => setModal(p)}><Edit3 size={13}/></button>
                      <button className="pn-btn-icon pn-btn-danger-icon" onClick={() => onDelete(p.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <h3 className="pn-prod-name">{p.nombre}</h3>
                  {p.descripcion && <p className="pn-prod-desc">{p.descripcion}</p>}
                  <div className="pn-prod-footer">
                    <div><div className="pn-prod-price">{fmt(p.precioContado)}</div>{Number(p.costo) > 0 && <small className="pn-prod-margin">Margen bruto estimado: {fmt(Number(p.precioContado) - Number(p.costo))} · {Math.round((Number(p.precioContado) - Number(p.costo)) / Number(p.precioContado) * 100)}%</small>}</div>
                    <div className={`pn-prod-stock ${p.stock <= 3 ? 'pn-stock-low' : ''}`}>
                      <Layers size={11}/> {p.stock <= 0 ? 'Agotado' : p.stock <= 3 ? `Stock bajo · ${p.stock}` : `${p.stock} unidades`}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
      }

      <section className="pn-panel pn-stock-history">
        <div className="pn-panel-header"><span className="pn-panel-title"><Activity size={14}/> Movimientos recientes de inventario</span><span className="pn-count">{movimientosStock.length} registrados</span></div>
        {movimientosStock.length === 0
          ? <p className="pn-stock-empty">Todavía no hay reposiciones ni salidas manuales registradas. Las ventas nuevas aparecerán aquí automáticamente.</p>
          : <div className="pn-stock-movement-list">{movimientosStock.slice(0,8).map(m => <div className="pn-stock-movement" key={m.id}>
              <span className={`pn-stock-movement-icon ${m.tipo}`}><Layers size={14}/></span>
              <span className="pn-stock-movement-main"><b>{m.producto}</b><small>{m.motivo}{m.venta ? ` · ${m.venta}` : ''}</small></span>
              <span className={`pn-stock-movement-qty ${m.tipo === 'entrada' ? 'text-green' : m.tipo === 'venta' ? 'text-purple' : 'pn-stock-low'}`}>{m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}</span>
              <span className="pn-stock-movement-balance">{m.stockAnterior} → {m.stockResultante}</span>
              <time>{new Date(m.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</time>
            </div>)}</div>}
      </section>

      <AnimatePresence>
        {modal && (
          <ProductoModal
            producto={modal === 'new' ? null : modal}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{stockTarget && <StockMovementModal productos={productos} initialProductId={stockTarget.productoId || stockTarget.id} onClose={() => setStockTarget(null)} onSave={onStockMovement}/>}</AnimatePresence>
    </div>
  )
}

function StockMovementModal({ productos = [], initialProductId, onClose, onSave }) {
  const [productoId, setProductoId] = useState(initialProductId || productos[0]?.id || '')
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const producto = productos.find(p => p.id === productoId)
  async function submit(e) {
    e.preventDefault()
    const qty = Number(cantidad)
    if (!productoId || !Number.isInteger(qty) || qty <= 0) { setError('Elegí un producto e ingresá una cantidad entera mayor a cero.'); return }
    if (tipo === 'salida' && qty > Number(producto?.stock || 0)) { setError(`Solo hay ${producto?.stock ?? 0} unidades disponibles.`); return }
    setSaving(true)
    try { await onSave(productoId, { tipo, cantidad:qty, motivo:motivo.trim() }); onClose() }
    catch (ex) { setError(friendlyConnectionError(ex.message)) }
    finally { setSaving(false) }
  }
  return createPortal(<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <motion.form className="loan-modal pn-stock-modal" onSubmit={submit} initial={{y:22,opacity:0}} animate={{y:0,opacity:1}} exit={{y:16,opacity:0}}>
      <div className="modal-header"><PackagePlus size={19}/><span>Registrar movimiento de stock</span><button type="button" className="icon-button" onClick={onClose} style={{marginLeft:'auto'}} aria-label="Cerrar"><X size={16}/></button></div>
      <div className="modal-body"><div className="pn-stock-current" aria-live="polite"><span>Disponible ahora</span><b>{producto?.stock ?? 0} unidades</b></div>
        <div className="form-grid">
          <label className="field"><span>Producto</span><select value={productoId} onChange={e=>setProductoId(e.target.value)} required>{productos.map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.stock} disponibles</option>)}</select></label>
          <label className="field"><span>Tipo de movimiento</span><select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="entrada">Ingreso / reposición</option><option value="salida">Salida / ajuste</option></select></label>
          <Field label="Cantidad de unidades" value={cantidad} onChange={e=>setCantidad(e.target.value)} type="number" min="1" step="1" required/>
          <Field label="Motivo (opcional)" value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder={tipo==='entrada'?'Compra a proveedor':'Merma, devolución, ajuste…'}/>
        </div>
        {tipo === 'salida' && <p className="pn-stock-result">Quedarán {Math.max(0,Number(producto?.stock || 0)-Number(cantidad || 0))} unidades disponibles.</p>}
        {error && <p className="pn-field-error pn-field-error-block" role="alert">{error}</p>}
      </div>
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || !productos.length}>{saving?<Spinner size={14}/>:<Check size={14}/>} Confirmar movimiento</button></div>
    </motion.form>
  </motion.div>,document.body)
}

/* ═══════════════════════════════════════════════════════════════
   NUEVA VENTA — formulario multi-paso
═══════════════════════════════════════════════════════════════ */
function NuevaVenta({ productos = [], onSubmit }) {
  const [step,     setStep]    = useState(1)
  const [carrito,  setCarrito] = useState([])   // [{producto, qty}]
  const [client,   setClient]  = useState('')
  const [phone,    setPhone]   = useState('')
  const [dni,      setDni]     = useState('')
  const [address,  setAddress] = useState('')
  const [risk]                 = useState('medio')
  const [anticipo, setAnticipo]= useState('')
  const [tasa,     setTasa]    = useState('20')
  const [cuotas,   setCuotas]  = useState('6')
  const [freq,     setFreq]    = useState('semanal')
  const [firstDue, setFirstDue]= useState(today)
  const [saving,   setSaving]  = useState(false)
  const [err,      setErr]     = useState('')
  const [catFil,   setCatFil]  = useState('Todas')
  const [qProd,    setQProd]   = useState('')

  const subtotal   = useMemo(() => carrito.reduce((s,i) => s + i.producto.precioContado * i.qty, 0), [carrito])
  const anticipoInvalido = anticipo !== '' && (Number(anticipo) < 0 || Number(anticipo) >= subtotal)
  const financiado = Math.max(0, subtotal - (Number(anticipo) || 0))
  const preview    = useMemo(() =>
    financiado > 0 ? calcularPrestamoDirecto(financiado, tasa, Number(cuotas), freq, firstDue, false) : null,
    [financiado, tasa, cuotas, freq, firstDue]
  )

  const cats = useMemo(() => ['Todas', ...new Set(productos.map(p => p.categoria))].sort(), [productos])
  const filteredProds = useMemo(() =>
    productos.filter(p =>
      (catFil === 'Todas' || p.categoria === catFil) &&
      (!qProd.trim() || p.nombre.toLowerCase().includes(qProd.toLowerCase()))
    ), [productos, catFil, qProd]
  )

  function addProd(prod) {
    if (Number(prod.stock) <= 0) { setErr(`${prod.nombre}: no hay unidades disponibles en stock.`); return }
    const existing = carrito.find(i => i.producto.id === prod.id)
    if (existing && existing.qty >= Number(prod.stock)) {
      setErr(`Solo hay ${prod.stock} unidad${Number(prod.stock) === 1 ? '' : 'es'} de ${prod.nombre}.`)
      return
    }
    setErr('')
    setCarrito(prev => existing
      ? prev.map(i => i.producto.id === prod.id ? {...i, qty: i.qty + 1} : i)
      : [...prev, { producto: prod, qty: 1 }])
  }
  function setQty(id, qty) {
    if (qty <= 0) { setErr(''); setCarrito(prev => prev.filter(i => i.producto.id !== id)); return }
    const item = carrito.find(i => i.producto.id === id)
    if (item && qty > Number(item.producto.stock)) {
      setErr(`Solo hay ${item.producto.stock} unidad${Number(item.producto.stock) === 1 ? '' : 'es'} de ${item.producto.nombre}.`)
      return
    }
    setErr('')
    setCarrito(prev => prev.map(i => i.producto.id === id ? {...i, qty} : i))
  }

  async function handleSubmit() {
    if (!client.trim()) { setErr('El nombre del cliente es requerido'); return }
    if (carrito.length === 0) { setErr('Agregá al menos un producto al carrito'); return }
    const sinStock = carrito.find(i => i.qty > Number(i.producto.stock))
    if (sinStock) { setErr(`Stock insuficiente de ${sinStock.producto.nombre}: disponibles ${sinStock.producto.stock}.`); setStep(1); return }
    if (Number(anticipo) < 0 || Number(anticipo) >= subtotal) { setErr('El anticipo debe ser menor que el total de la compra para financiar el saldo.'); return }
    if (!preview) { setErr('El monto financiado debe ser mayor a cero'); return }
    setSaving(true)
    try {
      await onSubmit({
        client: client.trim(), phone, dni, address, risk,
        items: carrito.map(i => ({ productoId: i.producto.id, nombre: i.producto.nombre, cantidad: i.qty, precioUnitario: i.producto.precioContado })),
        montoTotal: subtotal, anticipo: Number(anticipo) || 0, fechaVenta: today, notas: '',
        rate: Number(tasa), installments: Number(cuotas), frequency: freq, firstDue, omitSunday: false,
        schedule: preview.cronograma,
      })
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const STEPS = [
    { n: 1, label: 'Productos',    icon: Package },
    { n: 2, label: 'Cliente',      icon: UserRound },
    { n: 3, label: 'Financiación', icon: CreditCard },
  ]

  return (
    <div className="nv-root">
      {/* Header */}
      <div className="nv-header">
        <div>
          <div className="pn-eyebrow"><ShoppingCart size={11}/> MÓDULO VENTAS</div>
          <div className="pn-heading-with-help"><h2 className="nv-title">Nueva venta a crédito</h2><HelpBtn contentKey="v_nueva" /></div>
        </div>
      </div>

      {/* Steps */}
      <div className="nv-steps">
        {STEPS.map((s, i) => (
          <div key={s.n} className={`nv-step ${step === s.n ? 'nv-step-active' : step > s.n ? 'nv-step-done' : ''}`}>
            <div className="nv-step-dot">
              {step > s.n ? <Check size={12}/> : <s.icon size={13}/>}
            </div>
            <span>{s.label}</span>
            {i < STEPS.length - 1 && <div className="nv-step-line"/>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════ PASO 1: PRODUCTOS ═══════ */}
        {step === 1 && (
          <motion.div key="s1" className="nv-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>

            <div className="nv-toolbar">
              <label className="pn-searchbox" style={{ flex:1, maxWidth:280 }}>
                <Search size={13}/>
                <input placeholder="Buscar producto…" value={qProd} onChange={e => setQProd(e.target.value)}/>
              </label>
              <div className="pn-filter-pills">
                {cats.map(c => (
                  <button key={c} className={`pn-pill ${catFil === c ? 'pn-pill-active-purple' : ''}`} onClick={() => setCatFil(c)}>{c}</button>
                ))}
              </div>
            </div>

            {filteredProds.length === 0
              ? <div className="pn-empty">
                  <div className="pn-empty-icon pn-empty-icon-purple"><Package size={24}/></div>
                  <h3>Sin productos</h3>
                  <p>Agregá productos al catálogo primero.</p>
                </div>
              : <div className="nv-prod-grid">
                  {filteredProds.map((prod, i) => {
                    const inCart = carrito.find(x => x.producto.id === prod.id)
                    return (
                      <motion.div key={prod.id} className={`nv-prod-card ${inCart ? 'nv-prod-selected' : ''}`}
                        initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }}
                        transition={{ delay: i * .04 }}>
                        <div className="nv-prod-top">
                          <span className="nv-prod-cat">{prod.categoria}</span>
                          <span className={`nv-prod-stock ${prod.stock <= 3 ? 'nv-stock-low' : ''}`}>
                            {prod.stock} stock
                          </span>
                        </div>
                        <h3 className="nv-prod-name">{prod.nombre}</h3>
                        {prod.descripcion && <p className="nv-prod-desc">{prod.descripcion}</p>}
                        <div className="nv-prod-price">{fmt(prod.precioContado)}</div>
                        {inCart
                          ? <div className="nv-qty">
                              <button type="button" onClick={() => setQty(prod.id, inCart.qty - 1)}>−</button>
                              <span>{inCart.qty}</span>
                              <button type="button" disabled={inCart.qty >= Number(prod.stock)} aria-label={inCart.qty >= Number(prod.stock) ? 'Stock máximo alcanzado' : 'Sumar unidad'} onClick={() => setQty(prod.id, inCart.qty + 1)}>+</button>
                            </div>
                          : <button type="button" className="nv-add-btn" disabled={Number(prod.stock) <= 0} onClick={() => addProd(prod)}>
                              <Plus size={13}/> {Number(prod.stock) <= 0 ? 'Sin stock' : 'Agregar'}
                            </button>
                        }
                      </motion.div>
                    )
                  })}
                </div>
            }

            {/* Carrito flotante */}
            <AnimatePresence>
              {carrito.length > 0 && (
                <motion.div className="nv-carrito"
                  initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }}>
                  <div className="nv-carrito-items">
                    {carrito.map(item => (
                      <div key={item.producto.id} className="nv-carrito-item">
                        <span>{item.qty}× {item.producto.nombre}</span>
                        <span>{fmt(item.producto.precioContado * item.qty)}</span>
                        <button type="button" onClick={() => setQty(item.producto.id, 0)}><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                  <div className="nv-carrito-total">
                    <span>{carrito.reduce((s,i) => s + i.qty, 0)} artículo{carrito.reduce((s,i)=>s+i.qty,0) !== 1 ? 's' : ''}</span>
                    <span className="nv-total-val">{fmt(subtotal)}</span>
                    <motion.button type="button" className="pn-btn-primary pn-btn-purple"
                      onClick={() => setStep(2)}
                      whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
                      Siguiente <ArrowRight size={14}/>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══════ PASO 2: CLIENTE ═══════ */}
        {step === 2 && (
          <motion.div key="s2" className="nv-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
            <div className="lm-section">
              <div className="lm-section-header">
                <UserRound size={16} className="lm-section-icon"/>
                <h3>¿Para quién es la venta?</h3>
              </div>
              <div className="lm-grid">
                <div className="lm-field-full">
                  <label className="lm-label">Nombre completo *</label>
                  <input className="lm-input" value={client} onChange={e => setClient(e.target.value)} placeholder="María García"/>
                </div>
                <div>
                  <label className="lm-label">Teléfono</label>
                  <input className="lm-input" value={phone} onChange={e => setPhone(e.target.value)} type="tel"/>
                </div>
                <div>
                  <label className="lm-label">DNI (opcional)</label>
                  <input className="lm-input" value={dni} onChange={e => setDni(e.target.value)}/>
                </div>
                <div>
                  <label className="lm-label">Dirección (opcional)</label>
                  <input className="lm-input" value={address} onChange={e => setAddress(e.target.value)}/>
                </div>
              </div>
            </div>
            {err && <p className="pn-field-error pn-field-error-block" role="alert">{err}</p>}
            <div className="nv-step-nav">
              <button type="button" className="pn-btn-secondary" onClick={() => setStep(1)}>
                <ChevronLeft size={14}/> Atrás
              </button>
              <motion.button type="button" className="pn-btn-primary pn-btn-purple"
                onClick={() => { if (!client.trim()) { setErr('Ingresá el nombre del cliente para continuar.'); return } setErr(''); setStep(3) }}
                whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}>
                Siguiente <ArrowRight size={14}/>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══════ PASO 3: FINANCIACIÓN ═══════ */}
        {step === 3 && (
          <motion.div key="s3" className="nv-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>

            {/* Resumen de la venta */}
            <div className="nv-venta-resumen">
              <div className="nv-venta-titulo"><Package size={13}/> Resumen de la venta</div>
              <div className="nv-venta-items">
                {carrito.map(item => (
                  <div key={item.producto.id} className="nv-venta-item">
                    <span className="nv-vi-qty">{item.qty}×</span>
                    <span className="nv-vi-name">{item.producto.nombre}</span>
                    <span className="nv-vi-price">{fmt(item.producto.precioContado * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="nv-venta-total">
                <span>Total de contado</span>
                <b>{fmt(subtotal)}</b>
              </div>
            </div>

            <div className="lm-section">
              <div className="lm-section-header">
                <CreditCard size={16} className="lm-section-icon"/>
                <h3>Condiciones del crédito</h3>
              </div>
              <div className="lm-grid">
                <div>
                  <label className="lm-label">Anticipo inicial ($)</label>
                  <div className="lm-input-wrap">
                    <span className="lm-prefix">$</span>
                    <input className="lm-input lm-input-prefix" value={anticipo} onChange={e => setAnticipo(e.target.value)} type="number" min="0" max={subtotal} placeholder="0"/>
                  </div>
                  {anticipoInvalido && <small className="nv-field-warning">El anticipo debe ser mayor o igual a $0 y menor que el total de la compra ({fmt(subtotal)}).</small>}
                </div>
                <div>
                  <label className="lm-label">Tasa de interés total</label>
                  <div className="lm-input-wrap">
                    <input className="lm-input lm-input-suffix" value={tasa} onChange={e => setTasa(e.target.value)} type="number" min="0" step="0.5"/>
                    <span className="lm-suffix">%</span>
                  </div>
                </div>
                <div>
                  <label className="lm-label">Número de cuotas</label>
                  <input className="lm-input" value={cuotas} onChange={e => setCuotas(e.target.value)} type="number" min="1"/>
                </div>
                <div>
                  <label className="lm-label">Frecuencia</label>
                  <select className="lm-input" value={freq} onChange={e => setFreq(e.target.value)}>
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="lm-label">Primera cuota</label>
                  <input className="lm-input" value={firstDue} onChange={e => setFirstDue(e.target.value)} type="date"/>
                </div>
              </div>
            </div>

            {/* Preview crédito */}
            <AnimatePresence>
              {preview && (
                <motion.div className="lm-preview"
                  initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0 }}>
                  <div className="lm-preview-header"><Sparkles size={14}/><span>Resumen del crédito</span></div>
                  <div className="lm-preview-kpis">
                    <div className="lm-pkpi"><span>Financiado</span><b className="text-purple">{fmt(financiado)}</b></div>
                    <div className="lm-pkpi"><span>Cuota</span><b>{fmt(preview.monto_cuota)}</b></div>
                    <div className="lm-pkpi"><span>Interés</span><b className="text-amber">{fmt(preview.total_interes)}</b></div>
                    <div className="lm-pkpi"><span>Total a pagar</span><b className="text-green">{fmt(preview.total_a_pagar)}</b></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {err && <div className="lm-submit-error">{err}</div>}

            <div className="nv-step-nav">
              <button type="button" className="pn-btn-secondary" onClick={() => setStep(2)}>
                <ChevronLeft size={14}/> Atrás
              </button>
              <motion.button type="button" className="pn-btn-primary pn-btn-purple"
                onClick={handleSubmit} disabled={saving || !preview}
                whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}>
                {saving ? <Spinner size={14}/> : <ShoppingCart size={14}/>}
                {saving ? 'Registrando…' : 'Confirmar venta'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VENTA ACORDEON
═══════════════════════════════════════════════════════════════ */
function VentaAcordeon({ venta, cuotas = [], loans = [], onPay, onPartial, onExportSale }) {
  const [open, setOpen] = useState(false)
  const [expandedQuota, setExpandedQuota] = useState(null)

  const cuotasVenta = useMemo(() =>
    cuotas.filter(p => p.loanId === venta.prestamo?.referencia),
    [cuotas, venta]
  )
  const pendientes = cuotasVenta.filter(p => p.status !== 'Pagado' && Number(p.amount) > 0)
  const vencidas   = pendientes.filter(p => p.status === 'Vencido').length
  const loanStats = loans.find(l => l.id === venta.prestamo?.referencia)
  const totalCuotas = Number(loanStats?.installments ?? venta.prestamo?.cuotas ?? cuotasVenta[0]?.totalQuotas ?? 0)
  const cuotasPagadas = Math.min(totalCuotas, Number(loanStats?.paid) || 0)
  const progreso = totalCuotas > 0 ? Math.round((cuotasPagadas / totalCuotas) * 100) : 0
  const planValido = totalCuotas > 0
  const todasPagadas = planValido && cuotasPagadas >= totalCuotas && pendientes.length === 0
  const estadoVenta = planValido
    ? todasPagadas || venta.estado === 'pagado' ? 'Pagado' : vencidas > 0 ? 'En mora' : 'Activo'
    : Number(venta.montoFinanciado) > 0 ? 'Revisar cuotas' : 'Pagado'

  return (
    <div className={`vc-acordeon ${open ? 'vc-acordeon-open' : ''}`}>
      <button type="button" className="vc-acordeon-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <div className="vc-acordeon-left">
          <span className="origen-badge origen-venta"><ShoppingCart size={10}/> {venta.referencia}</span>
          <p className="vc-items-label">{(venta.items ?? []).map(it => `${it.cantidad}× ${it.nombre}`).join(', ')}</p>
        </div>
        <div className="vc-acordeon-mid">
          <span><small>Total</small><b><Money value={venta.montoTotal}/></b></span>
          <span><small>Anticipo</small><b className="text-green"><Money value={venta.anticipo}/></b></span>
          <span><small>Cuotas</small><b>{planValido ? `${cuotasPagadas}/${totalCuotas}` : Number(venta.montoFinanciado) > 0 ? 'Revisar plan' : 'Contado'}</b></span>
        </div>
        <div className="vc-acordeon-right">
          <Status status={estadoVenta}/>
          <ChevronDown size={15} className={`vc-chevron ${open ? 'vc-chevron-open' : ''}`}/>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="vc-acordeon-body"
            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:.22, ease:'easeInOut' }}>

            <div className="vc-resumen-compra">
              <div className="vc-resumen-titulo"><Package size={13}/> Resumen de compra</div>
              <div className="vc-resumen-items">
                {(venta.items ?? []).map((it, idx) => (
                  <div key={idx} className="vc-item-row">
                    <span className="vc-item-qty">{it.cantidad}×</span>
                    <span className="vc-item-nombre">{it.nombre}</span>
                    <span className="vc-item-cat">{it.categoria}</span>
                    <span className="vc-item-precio"><Money value={it.precioUnitario}/> c/u</span>
                    <span className="vc-item-sub"><Money value={it.subtotal}/></span>
                  </div>
                ))}
              </div>
              <div className="vc-resumen-totales">
                <div><small>Precio total contado</small><b><Money value={venta.montoTotal}/></b></div>
                <div><small>Anticipo pagado</small><b className="text-green"><Money value={venta.anticipo}/></b></div>
                <div><small>Monto financiado</small><b className="text-purple"><Money value={venta.montoFinanciado}/></b></div>
                {venta.prestamo && planValido && <div><small>Cuota</small><b><Money value={venta.prestamo.montoCuota}/> × {totalCuotas}</b></div>}
                {venta.notas && <div className="vc-notas"><small>Notas:</small> <span>{venta.notas}</span></div>}
              </div>
              {planValido && <div className="vc-progreso-wrap">
                <div className="vc-progreso-label"><span>Cuotas cobradas</span><span>{cuotasPagadas}/{totalCuotas} · {progreso}%</span></div>
                <div className="vc-progreso-bar"><div className="vc-progreso-fill" style={{ width:`${progreso}%` }}/></div>
              </div>}
              <button type="button" className="vc-export-btn" onClick={() => onExportSale?.(venta)}><FileText size={14}/> Descargar comprobante Word de esta compra</button>
            </div>

            {pendientes.length > 0 ? (
              <div className="vc-cuotas-section">
                <div className="vc-cuotas-titulo"><HandCoins size={13}/> Cuotas pendientes</div>
                <div className="vc-cuotas-lista">
                  {cuotasVenta.map(p => {
                    const esVencida = p.status === 'Vencido'
                    const esParcial = p.status === 'Parcial'
                    const dias = daysUntil(p.due)
                    return (
                      <div key={p.id} className="vc-cuota-item">
                      <button type="button" className={`vc-cuota-row ${esVencida ? 'vc-cuota-vencida' : esParcial ? 'vc-cuota-parcial' : ''}`} aria-expanded={expandedQuota === p.id} aria-controls={`venta-quota-actions-${p.id}`} onClick={() => setExpandedQuota(expandedQuota === p.id ? null : p.id)}>
                        <div className="vc-cuota-num">
                          {esVencida ? <CircleAlert size={14} className="icon-red"/> : <Clock size={14} className="icon-dim"/>}
                          <span>Cuota {p.n}/{p.totalQuotas || totalCuotas}</span>
                        </div>
                        <div className="vc-cuota-fecha">
                          <span>{p.due ? new Date(`${p.due}T12:00:00`).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }) : 'Sin vencimiento'}</span>
                          <span className={`vc-dias-badge ${esVencida ? 'badge-red' : dias <= 2 ? 'badge-amber' : 'badge-dim'}`}>
                            {esVencida ? `${Math.abs(dias)}d vencida` : dias === 0 ? 'Hoy' : `${dias}d`}
                          </span>
                        </div>
                        <div className="vc-cuota-monto"><Money value={p.amount}/></div>
                        <ChevronDown size={15} className={`vc-chevron ${expandedQuota === p.id ? 'vc-chevron-open' : ''}`}/>
                      </button>
                      {expandedQuota === p.id && (
                        <div id={`venta-quota-actions-${p.id}`} className="vc-cuota-actions-panel">
                          <button type="button" className="vc-cobrar-btn" onClick={() => {
                            if (window.confirm(`¿Confirmás el cobro de ${fmt(p.amount)} de la cuota ${p.n}? La ficha abierta no cobra cuotas.`)) onPay?.(p, 'Pagado')
                          }}><Check size={14}/> Cobrar completa</button>
                          <button type="button" className="vc-parcial-btn" onClick={() => onPartial?.(p)}><HandCoins size={14}/> Cobrar por partes</button>
                          {sanitizePhone(p.phone || venta.phone) ? (
                            <a className="vc-whatsapp-btn" href={`https://wa.me/${sanitizePhone(p.phone || venta.phone)}?text=${encodeURIComponent(`Hola ${(p.client || venta.client || 'cliente').split(' ')[0]}, te recordamos que la cuota ${p.n} de tu compra ${venta.referencia} vence el ${p.due ? new Date(`${p.due}T12:00:00`).toLocaleDateString('es-AR') : 'próximamente'}. Importe pendiente: $${Number(p.amount || 0).toLocaleString('es-AR')}. Si ya abonaste, podés ignorar este mensaje.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/> Avisar por WhatsApp</a>
                          ) : <span className="vc-no-phone"><Phone size={13}/> Agregá un teléfono a la ficha del cliente</span>}
                        </div>
                      )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : todasPagadas ? (
              <div className="vc-all-paid"><CheckCheck size={18} className="icon-green"/><span>Todas las cuotas cobradas</span></div>
            ) : !planValido && Number(venta.montoFinanciado) > 0 ? (
              <div className="vc-quota-warning"><AlertTriangle size={17}/><span>No encontramos el plan ni las cuotas de esta venta. No se registró ningún cobro al abrir la ficha.</span></div>
            ) : planValido ? (
              <div className="vc-quota-warning"><AlertTriangle size={17}/><span>No hay cuotas pendientes visibles, pero el progreso indica {cuotasPagadas}/{totalCuotas}. Revisá el historial antes de confirmar un cobro.</span></div>
            ) : (
              <div className="vc-all-paid"><CheckCheck size={18} className="icon-green"/><span>Venta sin saldo financiado</span></div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VENTAS CLIENTES — lista de ventas agrupada por cliente
═══════════════════════════════════════════════════════════════ */
function estadoVenta(venta, payments, loans) {
  if (venta.estado === 'cancelado') return 'Cancelado'
  const loan = loans.find(l => l.id === venta.prestamo?.referencia)
  const total = Number(loan?.installments ?? venta.prestamo?.cuotas ?? 0)
  const paid = Number(loan?.paid ?? 0)
  if (venta.estado === 'pagado' || (total > 0 && paid >= total) || Number(venta.montoFinanciado) <= 0) return 'Pagado'
  if (payments.some(p => p.loanId === venta.prestamo?.referencia && p.status === 'Vencido')) return 'En mora'
  return 'Activo'
}

function VentasClientes({ ventas = [], payments = [], loans = [], loading = false, go, onPay, onPartial, onExportSale, onReport }) {
  const [q,      setQ]      = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cuotasVenta = useMemo(() => payments.filter(p => p.origen === 'venta'), [payments])

  const clientes = useMemo(() => {
    const map = new Map()
    const visibles = ventas.filter(v => {
      const term = q.trim().toLowerCase()
      const matchesText = !term || [v.client, v.phone, v.referencia, ...(v.items ?? []).map(item => item.nombre)].some(value => String(value || '').toLowerCase().includes(term))
      const date = String(v.fechaVenta || '').slice(0,10)
      const matchesDate = (!desde || date >= desde) && (!hasta || date <= hasta)
      const matchesState = filtro === 'Todos' || estadoVenta(v, cuotasVenta, loans) === filtro
      return matchesText && matchesDate && matchesState
    })
    for (const v of visibles) {
      if (!map.has(v.clienteId)) map.set(v.clienteId, { clienteId:v.clienteId, client:v.client, phone:v.phone, ventas:[] })
      map.get(v.clienteId).ventas.push(v)
    }
    return [...map.values()]
      .sort((a,b) => a.client.localeCompare(b.client))
  }, [ventas, loans, q, filtro, desde, hasta, cuotasVenta])

  const kpis = useMemo(() => ({
    total:   ventas.reduce((s,v) => s+Number(v.montoTotal),    0),
    cobrado: ventas.reduce((s,v) => s + Number(v.anticipo || 0) + Number(loans.find(l => l.id === v.prestamo?.referencia)?.totalRecuperado || 0), 0),
    pend:    cuotasVenta.reduce((s,p)=>s+Number(p.amount || 0),0),
    vencido: cuotasVenta.filter(p=>p.status==='Vencido').reduce((s,p)=>s+Number(p.amount || 0),0),
  }), [ventas, cuotasVenta, loans])

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Store size={11}/> MÓDULO VENTAS</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Ventas</h2><HelpBtn contentKey="v_ventas" /></div>
          <p className="pn-section-desc">Compras a crédito por cliente. Tocá una venta para cobrar cuotas.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={()=>go('v_nueva')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <ShoppingCart size={15}/> Nueva venta
        </motion.button>
        <button className="pn-btn-outline pn-btn-purple" onClick={onReport}><FileSpreadsheet size={15}/> Reportes</button>
      </div>

      {/* KPIs */}
      <div className="pn-kpi-row">
        {[
          { label:'Total vendido',    value:kpis.total,    icon:ShoppingCart, color:'purple' },
          { label:'Total cobrado',    value:kpis.cobrado,  icon:Check,        color:'green'  },
          { label:'Saldo pendiente', value:kpis.pend,     icon:Clock,        color:'amber'  },
          { label:'Cuotas vencidas', value:kpis.vencido,  icon:CircleAlert,  color:'red' },
        ].map((k,i) => (
          <motion.div key={k.label} className={`pn-kpi pn-kpi-${k.color}`}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.07 }}>
            <div className="pn-kpi-top"><span className="pn-kpi-label">{k.label}</span><k.icon size={15} className="pn-kpi-icon"/></div>
            {loading ? <div className="pn-kpi-sk"/> : <div className="pn-kpi-val">{fmt(k.value)}</div>}
          </motion.div>
        ))}
      </div>

      <div className="pn-toolbar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar cliente, producto o referencia…" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <div className="pn-filter-pills">
          {['Todos','Activo','En mora','Pagado','Cancelado'].map(f=>(
            <button key={f} className={`pn-pill ${filtro===f?'pn-pill-active-purple':''}`} onClick={()=>setFiltro(f)}>{f}</button>
          ))}
        </div>
        <label className="pn-date-filter"><span>Desde</span><input type="date" value={desde} max={hasta || undefined} onChange={e=>setDesde(e.target.value)}/></label>
        <label className="pn-date-filter"><span>Hasta</span><input type="date" value={hasta} min={desde || undefined} onChange={e=>setHasta(e.target.value)}/></label>
        <span className="pn-count">{clientes.length} clientes · {clientes.reduce((n,c)=>n+c.ventas.length,0)} ventas</span>
      </div>

      {loading ? (
        <div className="vc-clientes-lista">{[1,2,3].map(i=><div key={i} className="acc-skeleton"/>)}</div>
      ) : clientes.length === 0 ? (
        <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <div className="pn-empty-icon pn-empty-icon-purple"><Store size={28}/></div>
          <h3>{ventas.length===0?'Sin ventas aún':'Sin resultados'}</h3>
          <p>{ventas.length===0?'Las ventas aparecen acá al registrarlas.':'Probá con otro filtro.'}</p>
          {ventas.length===0 && <button className="pn-btn-primary pn-btn-purple" onClick={()=>go('v_nueva')}><ShoppingCart size={14}/> Nueva venta</button>}
        </motion.div>
      ) : (
        <div className="vc-clientes-lista">
          {clientes.map((c,ci) => {
            const cuotasC = cuotasVenta.filter(p => c.ventas.some(v=>v.prestamo?.referencia===p.loanId))
            const pendTotal = cuotasC.filter(p=>p.status!=='Pagado'&&Number(p.amount)>0).reduce((s,p)=>s+Number(p.amount),0)
            const tieneVencidas = cuotasC.some(p=>p.status==='Vencido')
            return (
              <motion.div key={c.clienteId} className="vc-cliente-block"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:ci*.05 }}>
                <div className="vc-cliente-header">
                  <div className="vc-cliente-avatar">{c.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                  <div className="vc-cliente-info"><h3>{c.client}</h3><p>{c.phone||'—'}</p></div>
                  <div className="vc-cliente-resumen">
                    {tieneVencidas && <span className="vc-mora-badge"><CircleAlert size={11}/> En mora</span>}
                    <div className="vc-cliente-meta">
                      <span><ShoppingCart size={11}/> {c.ventas.length} {c.ventas.length===1?'compra':'compras'}</span>
                      {pendTotal>0 && <span className="text-red"><Money value={pendTotal}/> pend.</span>}
                    </div>
                    {c.phone && <a className="whatsapp" style={{width:30,height:30}} href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={13}/></a>}
                  </div>
                </div>
                <div className="vc-ventas-del-cliente">
                  {c.ventas.map(v => <VentaAcordeon key={v.id} venta={v} cuotas={cuotasVenta} loans={loans} onPay={onPay} onPartial={onPartial} onExportSale={onExportSale}/>)}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CLIENTES VENTAS — grid de tarjetas de clientes de ventas
═══════════════════════════════════════════════════════════════ */
function ClientesVentas({ ventas = [], payments = [], loans = [], loading = false, go, onPay, onPartial, onArchive, onExportClient, onExportSale }) {
  const [q,        setQ]      = useState('')
  const [selected, setSelected] = useState(null)

  const cuotasVenta = useMemo(() => payments.filter(p => p.origen === 'venta'), [payments])

  const clientesMap = useMemo(() => {
    const map = new Map()
    for (const v of ventas) {
      if (!map.has(v.clienteId)) map.set(v.clienteId, { clienteId:v.clienteId, client:v.client, phone:v.phone, ventas:[] })
      map.get(v.clienteId).ventas.push(v)
    }
    return map
  }, [ventas])

  const clientes = useMemo(() =>
    [...clientesMap.values()]
      .filter(c => !q.trim() || c.client.toLowerCase().includes(q.toLowerCase()))
      .sort((a,b) => a.client.localeCompare(b.client)),
    [clientesMap, q]
  )

  if (selected) {
    const c = clientesMap.get(selected.clienteId) ?? selected
    const cuotasC    = cuotasVenta.filter(p => c.ventas.some(v=>v.prestamo?.referencia===p.loanId))
    const deudaTotal = cuotasC.filter(p=>p.status!=='Pagado'&&Number(p.amount)>0).reduce((s,p)=>s+Number(p.amount),0)
    const totalComp  = c.ventas.reduce((s,v)=>s+Number(v.montoTotal),0)
    const totalCobrado = c.ventas.reduce((sum,v) => sum + Number(v.anticipo) + Number(loans.find(l => l.id === v.prestamo?.referencia)?.totalRecuperado || 0), 0)
    return (
      <div className="pn-section">
        <button className="pn-back-btn" onClick={()=>setSelected(null)}>
          <ChevronLeft size={15}/> Volver a clientes
        </button>
        <div className="pn-ficha-header">
          <div className="pn-ficha-avatar pn-score-bg-medio">
            {c.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
          </div>
          <div className="pn-ficha-info">
            <h2>{c.client}</h2>
            <p>{c.phone||'—'}</p>
          </div>
          <div className="pn-ficha-btns-row">
            <button className="pn-btn-outline pn-btn-sm" onClick={() => onExportClient?.(c)}>
              <FileText size={12}/> Word
            </button>
            <button className="pn-btn-primary pn-btn-purple pn-btn-sm" onClick={()=>go('v_nueva')}>
              <ShoppingCart size={13}/> Nueva venta
            </button>
            <button className="pn-btn-danger pn-btn-sm" onClick={() => {
              if (window.confirm(`¿Mover a ${c.client} a la papelera? Sus ventas y cuotas quedarán archivadas y podrás restaurarlo después.`)) {
                onArchive?.(c.clienteId, c.client)
                setSelected(null)
              }
            }}>
              <Trash2 size={12}/> Archivar cliente
            </button>
            {c.phone && <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/></a>}
          </div>
        </div>
        <div className="pn-ficha-strip">
          <div><small>Total comprado</small><b><Money value={totalComp}/></b></div>
          <div><small>Total cobrado</small><b className="text-green"><Money value={totalCobrado}/></b></div>
          <div><small>Saldo pendiente</small><b className="text-red"><Money value={deudaTotal}/></b></div>
          <div><small>Compras</small><b>{c.ventas.length}</b></div>
        </div>
        <div className="pn-panel" style={{padding:0,overflow:'hidden'}}>
          <div className="pn-panel-header"><span className="pn-panel-title"><ShoppingCart size={14}/> Compras a crédito</span></div>
          <div style={{padding:'8px 14px 14px'}}>
            {c.ventas.map(v => <VentaAcordeon key={v.id} venta={v} cuotas={cuotasVenta} loans={loans} onPay={onPay} onPartial={onPartial} onExportSale={onExportSale}/>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Users size={11}/> MÓDULO VENTAS</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Clientes</h2><HelpBtn contentKey="v_clientes" /></div>
          <p className="pn-section-desc">Clientes con compras a crédito.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={()=>go('v_nueva')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <ShoppingCart size={15}/> Nueva venta
        </motion.button>
      </div>
      <div className="pn-search-bar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar cliente…" value={q} onChange={e=>setQ(e.target.value)}/></label>
      </div>
      {loading
        ? <div className="pn-client-grid">{[1,2,3,4].map(i=><div key={i} className="pn-client-card pn-client-sk"><div className="pn-sk-av"/><div className="pn-sk-ln"/><div className="pn-sk-ln pn-sk-sm"/></div>)}</div>
        : clientes.length === 0
          ? <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="pn-empty-icon pn-empty-icon-purple"><Users size={28}/></div>
              <h3>Sin clientes de ventas</h3>
              <p>Los clientes aparecen al registrar una venta a crédito.</p>
              <button className="pn-btn-primary pn-btn-purple" onClick={()=>go('v_nueva')}><ShoppingCart size={14}/> Nueva venta</button>
            </motion.div>
          : <div className="pn-client-grid">
              {clientes.map((c,i) => {
                const cuotasC = cuotasVenta.filter(p=>c.ventas.some(v=>v.prestamo?.referencia===p.loanId))
                const pendTotal = cuotasC.filter(p=>p.status!=='Pagado'&&Number(p.amount)>0).reduce((s,p)=>s+Number(p.amount),0)
                const tieneVencidas = cuotasC.some(p=>p.status==='Vencido')
                const totalComp = c.ventas.reduce((s,v)=>s+Number(v.montoTotal),0)
                const totalCuotas = c.ventas.reduce((s,v) => s + Number(loans.find(l => l.id === v.prestamo?.referencia)?.installments ?? v.prestamo?.cuotas ?? 0), 0)
                const pagadas = c.ventas.reduce((s,v) => {
                  const loan = loans.find(l => l.id === v.prestamo?.referencia)
                  return s + Math.min(Number(loan?.installments ?? v.prestamo?.cuotas ?? 0), Number(loan?.paid || 0))
                }, 0)
                const avance = totalCuotas > 0 ? Math.round(pagadas / totalCuotas * 100) : 0
                return (
                  <motion.article key={c.clienteId} className="pn-client-card"
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:i*.05, type:'spring', stiffness:260, damping:22 }}
                    whileHover={{ y:-4 }}>
                    <div className="pn-client-card-top">
                      <div className={`pn-client-avatar ${tieneVencidas?'pn-score-bg-alto':'pn-score-bg-medio'}`}>
                        {c.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
                      </div>
                      {tieneVencidas && <span className="pn-badge-red" style={{fontSize:9}}>Mora</span>}
                    </div>
                    <h3 className="pn-client-name">{c.client}</h3>
                    <p className="pn-client-meta">{c.phone||'—'}</p>
                    <div className="pn-client-metrics">
                      <div><small>Compras</small><b>{c.ventas.length}</b></div>
                      <div><small>Total</small><b><Money value={totalComp}/></b></div>
                    </div>
                    {pendTotal>0 && <div className="pn-client-debt"><Money value={pendTotal}/> pendiente</div>}
                    <div className="vc-client-progress">
                      <div><span>Cuotas cobradas</span><b>{pagadas}/{totalCuotas} · {avance}%</b></div>
                      <div className="vc-client-progress-bar"><span style={{ width:`${avance}%` }}/></div>
                    </div>
                    <div className="pn-client-actions">
                      <button className="pn-btn-outline pn-btn-sm" style={{flex:1}} onClick={()=>setSelected(c)}>
                        <FileText size={12}/> Ver ficha
                      </button>
                      <button className="pn-btn-icon pn-btn-danger-icon" type="button" title="Archivar cliente" aria-label={`Archivar a ${c.client}`} onClick={() => {
                        if (window.confirm(`¿Mover a ${c.client} a la papelera? Sus ventas y cuotas quedarán archivadas y podrás restaurarlo después.`)) onArchive?.(c.clienteId, c.client)
                      }}>
                        <Trash2 size={13}/>
                      </button>
                      {c.phone && <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={13}/></a>}
                    </div>
                  </motion.article>
                )
              })}
            </div>
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REFINANCIAR MODAL
═══════════════════════════════════════════════════════════════ */
function RefinanciarModal({ loan, onClose, onCreate }) {
  const saldoPendiente = useMemo(() => {
    const pagadas = loan.paid || 0
    const total   = loan.installments || 1
    return Number(loan.principal) * (1 - pagadas / total)
  }, [loan])

  const [form, setForm] = useState({
    principal:    String(Math.round(saldoPendiente)),
    rate:         String(loan.rate || '20'),
    installments: String(loan.installments || '10'),
    frequency:    loan.frequency || 'semanal',
    firstDue:     today,
    omitSunday:   true,
  })
  const [submitting, setSub] = useState(false)
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const calc = calcularPrestamoDirecto(form.principal, form.rate, form.installments, form.frequency, form.firstDue, form.omitSunday)

  const submit = async (e) => {
    e.preventDefault()
    if (!calc || submitting) return
    setSub(true)
    try {
      await onCreate({
        client: loan.client, phone: loan.phone, dni: loan.dni || '',
        address: loan.address || '', risk: loan.risk || 'medio',
        principal: Number(form.principal), rate: Number(form.rate),
        installments: Number(form.installments), frequency: form.frequency,
        firstDue: form.firstDue, omitSunday: form.omitSunday,
        schedule: calc.cronograma,
      })
    } finally { setSub(false) }
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onMouseDown={(e) => e.target===e.currentTarget&&onClose()}>
      <motion.section className="loan-modal" style={{ maxWidth: 560 }} initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:45, opacity:0 }} transition={{ type:'spring', damping:26, stiffness:270 }}>
        <div className="modal-header" style={{ background: 'linear-gradient(108deg, rgba(255,77,109,.12), rgba(15,17,21,1))' }}>
          <div>
            <div className="eyebrow" style={{ color: '#ff8099' }}><span style={{ background:'#ff4d6d', boxShadow:'0 0 8px #ff4d6d' }}/> REFINANCIACIÓN</div>
            <h2>Reestructurar deuda</h2>
            <p>{loan.client} · Préstamo {loan.id} · En mora</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19}/></button>
        </div>
        <div className="refi-summary">
          <div><small>Capital original</small><b><Money value={loan.principal}/></b></div>
          <div><small>Cuotas pagadas</small><b>{loan.paid}/{loan.installments}</b></div>
          <div><small>Saldo estimado</small><b className="text-red"><Money value={saldoPendiente}/></b></div>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal-body" style={{ paddingTop: 4 }}>
            <div className="form-section">
              <h3>Nuevas condiciones del préstamo</h3>
              <div className="form-grid three">
                <Field label="Nuevo capital" value={form.principal} onChange={update('principal')} type="number" prefix="$" min="1" step="1000"/>
                <Field label="Interés total" value={form.rate} onChange={update('rate')} type="number" suffix="%" min="0" step="0.5"/>
                <Field label="Cuotas" value={form.installments} onChange={update('installments')} type="number" min="1" max="365"/>
                <label className="field"><span>Frecuencia</span><select value={form.frequency} onChange={update('frequency')}><option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></select></label>
                <Field label="Primer vencimiento" value={form.firstDue} onChange={update('firstDue')} type="date"/>
              </div>
              {form.frequency === 'diario' && (
                <label className="sunday-toggle">
                  <input type="checkbox" checked={form.omitSunday} onChange={(e) => setForm(f => ({ ...f, omitSunday: e.target.checked }))}/>
                  <span>Omitir domingos</span>
                </label>
              )}
              {calc && (
                <div className="calc-preview" style={{ borderColor: 'rgba(255,77,109,.25)' }}>
                  <div><small>Cuota nueva</small><b><Money value={calc.monto_cuota}/></b></div>
                  <div><small>Interés</small><b className="text-red"><Money value={calc.total_interes}/></b></div>
                  <div><small>Total nuevo</small><b><Money value={calc.total_a_pagar}/></b></div>
                  <span>{calc.cronograma.length} cuotas refinanciadas</span>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" style={{ background:'linear-gradient(#c4304a,#9e1f35) padding-box, linear-gradient(115deg,#ff6080,#c4304a 45%,#ffb703) border-box' }} disabled={!calc||submitting}>
              {submitting ? <Spinner size={15}/> : <RefreshCcw size={15}/>}
              {submitting ? 'Creando…' : 'Crear refinanciación'}
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MODE SELECTOR
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   MODE SELECTOR — Cyberpunk Split Screen
════════════════════════════════════════════════════════════ */
function ModeSelector({ onSelect, onOpenLegal, performanceMode, onTogglePerformance }) {
  const [hovered, setHovered] = useState(null)

  const modes = [
    {
      id: 'prestamos',
      label: 'Préstamos',
      sub: 'Cartera de crédito personal',
      icon: DollarSign,
      color: '#00ff87',
      colorDim: 'rgba(0,255,135,.12)',
      colorBorder: 'rgba(0,255,135,.35)',
      colorGlow: 'rgba(0,255,135,.25)',
      items: ['Ruta de cobro diaria', 'Score crediticio', 'Alertas de mora', 'Reportes completos'],
      gradient: 'linear-gradient(135deg, rgba(0,255,135,.07) 0%, rgba(0,0,0,0) 60%)',
    },
    {
      id: 'ventas',
      label: 'Ventas',
      sub: 'Ventas de productos a crédito',
      icon: ShoppingCart,
      color: '#c785ff',
      colorDim: 'rgba(179,71,255,.12)',
      colorBorder: 'rgba(179,71,255,.35)',
      colorGlow: 'rgba(179,71,255,.25)',
      items: ['Catálogo de productos', 'Ventas en cuotas', 'Cobro por cliente', 'Control de stock'],
      gradient: 'linear-gradient(135deg, rgba(179,71,255,.07) 0%, rgba(0,0,0,0) 60%)',
    },
  ]

  return (
    <MotionConfig reducedMotion={performanceMode ? 'always' : 'never'} skipAnimations={performanceMode} transition={performanceMode ? { skipAnimations: true } : undefined}>
    <div className={`ms2-root ${performanceMode ? 'pn-performance-on' : ''}`}>
      <PerformanceToggle enabled={performanceMode} onToggle={onTogglePerformance} className="performance-mode-floating"/>
      {/* Fondo animado */}
      <div className="ms2-bg" aria-hidden="true">
        <motion.div className="ms2-blob ms2-blob-green"
          animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}/>
        <motion.div className="ms2-blob ms2-blob-purple"
          animate={{ x: [0, -50, 0], y: [0, 50, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 3 }}/>
        <motion.div className="ms2-blob ms2-blob-blue"
          animate={{ x: [30, -30, 30], y: [-20, 20, -20], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 6 }}/>
        <div className="ms2-grid"/>
        {/* Líneas de scan */}
        <motion.div className="ms2-scanline"
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}/>
      </div>

      {/* Header */}
      <motion.div className="ms2-header"
        initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .6, ease: [.22, 1, .36, 1] }}>
        <div className="ms2-logo">
          <motion.div className="ms2-logo-icon"
            animate={{ boxShadow: ['0 0 16px rgba(0,255,135,.4)', '0 0 32px rgba(179,71,255,.5)', '0 0 16px rgba(0,255,135,.4)'] }}
            transition={{ duration: 3, repeat: Infinity }}>
            <BrandMark size={23}/>
          </motion.div>
          <span className="ms2-logo-name">presta<em>neo</em></span>
        </div>
        <div className="ms2-title-block">
          <h1 className="ms2-title">¿Qué vas a gestionar?</h1>
          <p className="ms2-subtitle">Seleccioná tu módulo de trabajo para hoy</p>
          <HelpBtn contentKey="selector_gestion" size="lg" />
        </div>
      </motion.div>

      {/* Cards */}
      <div className="ms2-cards">
        {modes.map((m, i) => {
          const Icon = m.icon
          const isHov = hovered === m.id
          return (
            <motion.button
              key={m.id}
              className="ms2-card"
              style={{ '--ms2-color': m.color, '--ms2-dim': m.colorDim, '--ms2-border': m.colorBorder, '--ms2-glow': m.colorGlow, background: m.gradient }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .55, delay: .25 + i * .12, ease: [.22, 1, .36, 1] }}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: .97 }}
              onHoverStart={() => setHovered(m.id)}
              onHoverEnd={() => setHovered(null)}
              onClick={() => onSelect(m.id)}
            >
              {/* Borde neón animado al hover */}
              <motion.div className="ms2-card-border"
                animate={{ opacity: isHov ? 1 : 0 }}
                transition={{ duration: .2 }}/>

              {/* Icono */}
              <motion.div className="ms2-card-icon"
                animate={{ boxShadow: isHov ? `0 0 28px ${m.colorGlow}` : '0 0 12px transparent' }}
                transition={{ duration: .25 }}>
                <Icon size={32}/>
              </motion.div>

              {/* Texto */}
              <div className="ms2-card-body">
                <h2 className="ms2-card-title">{m.label}</h2>
                <p className="ms2-card-sub">{m.sub}</p>
                <ul className="ms2-card-list">
                  {m.items.map((it, j) => (
                    <motion.li key={it}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: .4 + i * .1 + j * .07 }}>
                      <span className="ms2-check"><Check size={10}/></span>{it}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <motion.div className="ms2-card-cta"
                animate={{ opacity: isHov ? 1 : .6, x: isHov ? 4 : 0 }}
                transition={{ duration: .2 }}>
                <span>Entrar</span>
                <ArrowRight size={16}/>
              </motion.div>
            </motion.button>
          )
        })}
      </div>

      {/* Footer */}
      <motion.p className="ms2-footer"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .8 }}>
        Podés cambiar de módulo en cualquier momento desde el menú lateral
      </motion.p>
      <LegalLinks onOpen={onOpenLegal}/>
    </div>
    </MotionConfig>
  )
}


/* ═══════════════════════════════════════════════════════════
   LOGIN — neon (lv2)
════════════════════════════════════════════════════════════ */
function Login({ onSignIn, onOpenLegal, performanceMode, onTogglePerformance, isOnline = true }) {
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function handleGoogle() {
    setLoading(true)
    setErr('')
    try { await onSignIn() } catch (ex) { setErr(friendlyConnectionError(ex.message)); setLoading(false) }
  }

  const orbs = [
    { cls: 'lv2-orb lv2-orb-green',  style: { left: '5%',  top: '15%' } },
    { cls: 'lv2-orb lv2-orb-purple', style: { right: '8%', top: '20%' } },
    { cls: 'lv2-orb lv2-orb-blue',   style: { left: '60%', top: '65%' } },
    { cls: 'lv2-orb lv2-orb-pink',   style: { left: '20%', top: '70%' } },
  ]

  return (
    <MotionConfig reducedMotion={performanceMode ? 'always' : 'never'} skipAnimations={performanceMode} transition={performanceMode ? { skipAnimations: true } : undefined}>
    <div className={`lv2-root ${performanceMode ? 'lv2-reduced pn-performance-on' : ''}`}>
      {!isOnline && <div className="login-offline-banner" role="status"><AlertTriangle size={15}/> Sin conexión a Internet. Conectate para iniciar sesión y acceder a tus datos.</div>}
      {/* Background orbs */}
      {!performanceMode && orbs.map((o, i) => (
        <motion.div key={i} className={o.cls} style={o.style}
          animate={{ opacity: [0.18, 0.38, 0.18] }}
          transition={{ duration: 12 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}/>
      ))}
      {/* Side neon lines */}
      <div className="lv2-neon-left"/>
      <div className="lv2-neon-right"/>
      {/* Grid overlay */}
      <div className="lv2-grid"/>

      {/* Card */}
      <motion.div className="lv2-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="lv2-card-glow"/>

        {/* Brand */}
        <div className="lv2-brand">
          <div className="lv2-brand-icon">
            <BrandMark size={23}/>
          </div>
          <div className="lv2-brand-text">
            <span className="lv2-brand-name">prestaneo</span>
            <span className="lv2-brand-sub">Sistema de gestión</span>
          </div>
        </div>

        {/* Headline */}
        <div className="lv2-headline">
          <div className="lv2-neon-words">
            <span className="lv2-word-green">Préstamos</span>
            <span className="lv2-amp">&amp;</span>
            <span className="lv2-word-purple">Ventas</span>
          </div>
          <p className="lv2-tagline">Todo lo que necesitás para gestionar tu negocio financiero desde el celular.</p>
          <HelpBtn contentKey="login" size="lg" />
        </div>

        {/* Features 2×2 */}
        <div className="lv2-features">
          {[
            { icon: Route,        label: 'Ruta de cobro',      color: '#00e676' },
            { icon: Users,        label: 'Gestión de clientes', color: '#a78bfa' },
            { icon: ShoppingCart, label: 'Ventas en cuotas',    color: '#38bdf8' },
            { icon: BarChart3,    label: 'Reportes y estadísticas', color: '#fb923c' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="lv2-feature">
              <Icon size={15} style={{ color, flexShrink: 0 }}/>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Google button */}
        <div className="lv2-google-wrap">
          <motion.button type="button" className="lv2-google-btn" onClick={handleGoogle} disabled={loading}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <div className="lv2-google-inner">
              {loading
                ? <Spinner size={18}/>
                : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
                  </svg>
                )
              }
              <span>{loading ? 'Entrando…' : 'Continuar con Google'}</span>
            </div>
          </motion.button>
          {err && <p style={{ color: '#f97066', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{err}</p>}
        </div>

        {/* Footer */}
        <div className="lv2-footer">
          <span>© {new Date().getFullYear()} PrestaNeo</span>
          <PerformanceToggle enabled={performanceMode} onToggle={onTogglePerformance} className="login-performance-toggle"/>
        </div>
        <LegalLinks onOpen={onOpenLegal}/>
      </motion.div>
    </div>
    </MotionConfig>
  )
}

const LEGAL_SECTIONS = {
  terms: {
    label: 'Términos', title: 'Términos de uso',
    sections: [
      ['Alcance', 'PrestaNeo es una herramienta privada de gestión para registrar operaciones, clientes, productos, cuotas y caja. No es una entidad financiera, no capta depósitos, no otorga crédito por cuenta propia ni reemplaza el contrato que corresponda entre quien vende o presta y su cliente.'],
      ['Uso responsable', 'La persona que administra la cuenta es responsable de la exactitud de los datos ingresados, de verificar importes y vencimientos antes de confirmar una operación y de contar con las autorizaciones necesarias para cargar datos de terceros. Los reportes son auxiliares y deben cotejarse con los comprobantes originales.'],
      ['Cobros y acuerdos', 'Una cuota solo se registra como pagada cuando el operador confirma expresamente el cobro mediante la acción correspondiente. Abrir una ficha, ver un cliente o expandir una compra no registra pagos. Los términos de cada operación deben informarse y documentarse por separado de forma clara y conforme a la normativa aplicable.'],
      ['Crédito para consumo', 'La información y los reportes de esta aplicación no son por sí solos un contrato de crédito al consumo. Cuando corresponda, el documento de la operación debe incluir de forma clara los datos exigidos por el artículo 36 de la Ley 24.240, entre ellos precio de contado, anticipo y monto financiado, tasa efectiva anual, intereses o costo financiero total, sistema de amortización, cantidad/frecuencia/importe de pagos y cargos adicionales. La tasa total ingresada en la aplicación no sustituye automáticamente esos datos.'],
      ['Disponibilidad y seguridad', 'Se aplican controles de acceso y medidas razonables para proteger la cuenta. El servicio puede requerir mantenimiento o depender de proveedores externos de autenticación, base de datos y alojamiento. Conservá comprobantes fuera de la aplicación y no compartas tus credenciales.'],
      ['Derechos de consumidores', 'Estos términos no limitan derechos irrenunciables reconocidos por la normativa argentina. Cuando una operación concreta constituya una relación de consumo o una contratación a distancia, rigen las protecciones legales aplicables y la información particular de esa operación.'],
      ['Responsable y contacto', 'Responsable/operador: Kachuka Ángel Gabriel. Domicilio informado: Posadas, Misiones, Argentina. Atención y reclamos: 3765004174. Correo: angelgabrelkachu08@gmail.com.'],
    ],
  },
  privacy: {
    label: 'Privacidad', title: 'Política de privacidad',
    sections: [
      ['Quién trata los datos', 'El operador identificado en estos términos administra la cuenta y determina para qué utiliza los datos de sus clientes. PrestaNeo funciona como herramienta de gestión. Responsable informado: Kachuka Ángel Gabriel, con domicilio en Posadas, Misiones, Argentina.'],
      ['Datos y finalidades', 'La aplicación puede tratar datos de acceso (correo y perfil de Google), datos que el operador carga sobre clientes (nombre, teléfono, DNI, domicilio), productos, ventas, préstamos, cuotas, pagos, reportes y movimientos de caja. Se usan para autenticar al operador, administrar las operaciones, emitir comprobantes y responder consultas o reclamos. No se utilizan para publicidad comportamental.'],
      ['Proveedores y almacenamiento', 'La autenticación usa Google y los datos de la aplicación se almacenan en Supabase, según la configuración del proyecto. El proveedor de alojamiento de la versión publicada también puede procesar datos técnicos de conexión. Estos proveedores pueden alojar o procesar información en otras jurisdicciones; el operador debe verificar región, contratos y medidas de transferencia antes de producción. No se venden datos personales.'],
      ['Conservación y seguridad', 'Los datos se conservan mientras sean necesarios para gestionar la cuenta y las operaciones, y por los plazos legales o contractuales que correspondan. Se aplican controles de acceso por usuario y medidas técnicas razonables. Ningún sistema conectado a Internet puede garantizar riesgo cero.'],
      ['Derechos de las personas', 'Podés solicitar acceso, rectificación, actualización o supresión de tus datos y consultar su finalidad y destinatarios. Contactá al responsable por WhatsApp o teléfono al 3765004174, o escribí a angelgabrelkachu08@gmail.com, e indicá qué derecho querés ejercer; se podrá pedir información razonable para verificar identidad. La supresión puede tener límites cuando deban conservarse datos por obligaciones legales o derechos de terceros.'],
      ['Autoridad de control', 'La Agencia de Acceso a la Información Pública (AAIP) es el organismo de control de la Ley 25.326. Podés consultar sus canales y los derechos reconocidos por la ley en los enlaces oficiales incluidos al pie.'],
      ['Contacto del responsable', 'Kachuka Ángel Gabriel · Posadas, Misiones, Argentina. Atención y reclamos: 3765004174 · angelgabrelkachu08@gmail.com.'],
    ],
  },
  cookies: {
    label: 'Cookies', title: 'Cookies y almacenamiento local',
    sections: [
      ['Uso actual', 'La aplicación no incorpora actualmente herramientas propias de publicidad ni analítica de seguimiento. Guarda preferencias funcionales en el almacenamiento local del navegador (por ejemplo, el último módulo elegido) y utiliza almacenamiento del navegador para mantener la sesión de Supabase. El flujo de acceso con Google puede usar cookies propias de Google.'],
      ['Para qué sirven', 'Estos elementos permiten iniciar sesión, mantener la seguridad y recordar preferencias. Si se bloquean o se borran, algunas funciones —como conservar la sesión— pueden dejar de funcionar y quizá debas volver a ingresar.'],
      ['Cómo gestionarlas', 'Podés borrar o bloquear cookies y datos del sitio desde los ajustes del navegador. No se instalarán cookies publicitarias sin actualizar previamente esta política y la configuración correspondiente.'],
      ['Contacto', 'Consultas sobre privacidad o almacenamiento: 3765004174 o angelgabrelkachu08@gmail.com. Responsable: Kachuka Ángel Gabriel, Posadas, Misiones, Argentina.'],
    ],
  },
}

function LegalLinks({ onOpen }) {
  return (
    <nav className="legal-links" aria-label="Información legal">
      {Object.entries(LEGAL_SECTIONS).map(([key, item]) => (
        <button type="button" key={key} onClick={() => onOpen?.(key)}>{item.label}</button>
      ))}
      <a href="https://wa.me/5493765004174?text=Hola%2C%20necesito%20atenci%C3%B3n%20o%20quiero%20realizar%20un%20reclamo." target="_blank" rel="noreferrer">Atención y reclamos</a>
      <a href="mailto:angelgabrelkachu08@gmail.com">Correo</a>
    </nav>
  )
}

function LegalDialog({ section = 'terms', onClose }) {
  const [active, setActive] = useState(section)
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const content = LEGAL_SECTIONS[active] ?? LEGAL_SECTIONS.terms
  return (
    <motion.div className="legal-overlay" role="presentation" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
      <motion.section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-title" initial={{ opacity:0, y:18, scale:.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:10, scale:.98 }}>
        <header className="legal-dialog-head">
          <div><span className="legal-eyebrow"><ShieldCheck size={13}/> INFORMACIÓN LEGAL · ARGENTINA</span><h2 id="legal-title">{content.title}</h2></div>
          <button type="button" className="pn-btn-icon" onClick={onClose} aria-label="Cerrar información legal"><X size={17}/></button>
        </header>
        <div className="legal-tabs" role="tablist" aria-label="Políticas">
          {Object.entries(LEGAL_SECTIONS).map(([key, item]) => <button type="button" role="tab" aria-selected={active === key} className={active === key ? 'legal-tab-active' : ''} key={key} onClick={() => setActive(key)}>{item.label}</button>)}
        </div>
        <div className="legal-content">
          <div className="legal-notice"><AlertTriangle size={15}/><span>Responsable informado: Kachuka Ángel Gabriel · Posadas, Misiones. Confirmá que el domicilio indicado sea el domicilio legal que querés publicar.</span></div>
          {content.sections.map(([heading, text]) => <section key={heading}><h3>{heading}</h3><p>{text}</p></section>)}
          {active === 'privacy' && <section><h3>Normativa y autoridad</h3><p><a href="https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion" target="_blank" rel="noreferrer">Ley 25.326 de Protección de Datos Personales</a> · <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noreferrer">Derechos ante la AAIP</a></p></section>}
          {active === 'terms' && <section><h3>Normativa de referencia</h3><p><a href="https://www.argentina.gob.ar/normativa/nacional/638/actualizacion" target="_blank" rel="noreferrer">Ley 24.240 de Defensa del Consumidor</a> · <a href="https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion" target="_blank" rel="noreferrer">Código Civil y Comercial de la Nación</a></p></section>}
          <p className="legal-updated">Versión inicial · 6 de octubre de 2026 · Atención: <a href="tel:+543765004174">3765004174</a> · <a href="mailto:angelgabrelkachu08@gmail.com">angelgabrelkachu08@gmail.com</a></p>
        </div>
      </motion.section>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CLIENTES PRESTAMOS
═══════════════════════════════════════════════════════════════ */
function ClientesPrestamos({ loans = [], allLoans = [], loading = false, onNew, onEdit, onArchivar, onComprobanteDocx, onExportClient, onPay, onPartial, payments = [] }) {
  const [q,        setQ]   = useState('')
  const [selected, setSel] = useState(null)
  const [expandedInstallment, setExpandedInstallment] = useState(null)

  const calcScore = useCallback((clientName) => {
    const cl = (allLoans.length > 0 ? allLoans : loans).filter(l => l.client === clientName)
    if (!cl.length) return { score:700, label:'Sin historial', cls:'medio' }
    const totalQ  = cl.reduce((s,l) => s + Number(l.installments||0), 0)
    const pagadas = cl.reduce((s,l) => s + Number(l.paid||0), 0)
    const enMora  = cl.some(l => l.status === 'En mora')
    const completados = cl.filter(l => l.status === 'Pagado').length
    let score = Math.round(300 + (totalQ > 0 ? pagadas/totalQ : 0)*450 + completados*20)
    if (enMora) score = Math.max(300, score - 120)
    score = Math.min(850, score)
    const cls   = score >= 720 ? 'bajo' : score >= 580 ? 'medio' : 'alto'
    const label = score >= 720 ? 'Paga a tiempo' : score >= 580 ? 'Demoras leves' : 'Alto riesgo'
    return { score, label, cls }
  }, [allLoans, loans])

  // FIX: solo mostrar clientes que tienen préstamos activos/mora Y al menos una cuota pendiente
  // O que tienen préstamos activos aunque estén al día (para poder ver historial)
  const grouped = useMemo(() => {
    const map = new Map()
    for (const l of loans) {
      if (!map.has(l.client)) map.set(l.client, { ...l, count:0, hayPendiente:false })
      const entry = map.get(l.client)
      entry.count++
      // Verificar si tiene cuotas pendientes
      if (payments.some(p => p.loanId === l.id && p.status !== 'Pagado')) {
        entry.hayPendiente = true
      }
    }
    return [...map.values()]
      .filter(c => !q.trim() || c.client.toLowerCase().includes(q.toLowerCase()))
  }, [loans, payments, q])

  // ─── FICHA DE CLIENTE ───────────────────────────────────
  if (selected) {
    const cl   = allLoans.filter(l => l.client === selected.client)
    const pays = payments.filter(p => p.client === selected.client && p.status !== 'Pagado')
    const deuda = pays.reduce((s,p) => s + Number(p.amount), 0)
    const { score, label, cls } = calcScore(selected.client)

    // Cuotas agrupadas por préstamo
    const cuotasByLoan = new Map()
    for (const p of pays) {
      if (!cuotasByLoan.has(p.loanId)) cuotasByLoan.set(p.loanId, [])
      cuotasByLoan.get(p.loanId).push(p)
    }

    return (
      <div className="pn-section">
        <button className="pn-back-btn" onClick={() => setSel(null)}>
          <ChevronLeft size={15}/> Volver a clientes
        </button>

        {/* Header ficha */}
        <div className="ficha-header">
          <div className={`ficha-avatar pn-score-bg-${cls}`}>
            {selected.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
          </div>
          <div className="ficha-info">
            <h2>{selected.client}</h2>
            <p>{selected.phone || '—'} · DNI {selected.dni || '—'}</p>
            <p style={{ fontSize:11, color:'#60646e' }}>{selected.address || 'Sin dirección'}</p>
          </div>
          <div className="ficha-actions">
            <div className={`pn-score-arc pn-score-arc-${cls}`}>
              <span className="pn-score-big">{score}</span>
              <span className="pn-score-small">/850</span>
            </div>
            <span className={`pn-score-chip pn-score-${cls}`}>{label}</span>
            <div style={{ display:'flex', gap:7, marginTop:10, flexWrap:'wrap' }}>
              <button className="pn-btn-outline pn-btn-sm" onClick={() => onExportClient?.(selected)}>
                <FileText size={12}/> Word
              </button>
              <button className="pn-btn-secondary pn-btn-sm"
                onClick={() => onNew({ prefill:{ client:selected.client, phone:selected.phone, dni:selected.dni, address:selected.address, risk:selected.risk } })}>
                <RefreshCcw size={12}/> Nuevo préstamo
              </button>
              {selected.phone && (
                <a className="pn-btn-wa"
                  href={`https://wa.me/${sanitizePhone(selected.phone)}?text=${encodeURIComponent(`Hola ${selected.client.split(' ')[0]}, te recordamos tu cuota de préstamo con PrestaNeo.`)}`}
                  target="_blank" rel="noreferrer"><MessageCircle size={13}/></a>
              )}
              <button className="pn-btn-danger pn-btn-sm"
                onClick={() => { if(window.confirm(`¿Mover a ${selected.client} a la papelera?`)) { onArchivar(selected.clienteId, selected.client); setSel(null) } }}>
                <Trash2 size={12}/> Archivar
              </button>
            </div>
          </div>
        </div>

        {/* Strip de métricas */}
        <div className="pn-ficha-strip">
          <div><small>Deuda pendiente</small><b className="text-red"><Money value={deuda}/></b></div>
          <div><small>Préstamos totales</small><b>{cl.length}</b></div>
          <div><small>Cuotas pendientes</small><b>{pays.length}</b></div>
        </div>

        {/* ── Cuotas cobrables (por préstamo) ── */}
        {pays.length > 0 && (
          <div className="pn-panel">
            <div className="pn-panel-header">
              <span className="pn-panel-title"><HandCoins size={14}/> Cuotas pendientes de cobro</span>
            </div>
            <div style={{ padding:'8px 14px 14px', display:'flex', flexDirection:'column', gap:8 }}>
              {[...cuotasByLoan.entries()].map(([loanId, cuotas]) => (
                <div key={loanId} className="ficha-loan-block">
                  <div className="ficha-loan-ref"><span className="mono">{loanId}</span></div>
                  {cuotas.map(p => {
                    const dias    = daysUntil(p.due)
                    const vencida = dias < 0 || p.status === 'Vencido'
                    const esHoy   = dias === 0
                    return (
                      <div key={p.id} className="ficha-cuota-item">
                      <button type="button" className={`ficha-cuota-row ${vencida ? 'ficha-cuota-vencida' : esHoy ? 'ficha-cuota-hoy' : ''}`} aria-expanded={expandedInstallment === p.id} aria-controls={`cuota-actions-${p.id}`} onClick={() => setExpandedInstallment(expandedInstallment === p.id ? null : p.id)}>
                        <div className="ficha-cuota-info">
                          <span className="ficha-cuota-n">Cuota {p.n}/{p.totalQuotas}</span>
                          <span className="ficha-cuota-date">{p.due ? new Date(`${p.due}T12:00:00`).toLocaleDateString('es-AR') : 'Sin vencimiento'}</span>
                          {vencida && <span className="pn-badge-red">{Math.abs(dias)}d vencida</span>}
                          {esHoy && !vencida && <span className="pn-badge-amber">Hoy</span>}
                          {p.status === 'Parcial' && <span className="pn-badge-purple">Parcial</span>}
                        </div>
                        <div className="ficha-cuota-right">
                          <span className={`ficha-cuota-amt ${vencida ? 'text-red' : ''}`}><Money value={p.amount}/></span>
                          <ChevronDown size={16} className={`ficha-cuota-chevron ${expandedInstallment === p.id ? 'is-open' : ''}`}/>
                        </div>
                      </button>
                      {expandedInstallment === p.id && (
                        <div id={`cuota-actions-${p.id}`} className="ficha-cuota-actions">
                          <button type="button" className="ficha-action-pay" onClick={() => onPay?.(p, 'Pagado')}><Check size={15}/> Cobrar completa</button>
                          <button type="button" className="ficha-action-partial" onClick={() => onPartial?.(p)}><HandCoins size={15}/> Cobrar por partes</button>
                          {sanitizePhone(p.phone || selected.phone) ? (
                            <a className="ficha-action-whatsapp" href={`https://wa.me/${sanitizePhone(p.phone || selected.phone)}?text=${encodeURIComponent(`Hola ${selected.client.split(' ')[0]}, te recordamos que la cuota ${p.n} de tu préstamo vence el ${p.due ? new Date(`${p.due}T12:00:00`).toLocaleDateString('es-AR') : 'próximamente'}. Importe pendiente: $${Number(p.amount || 0).toLocaleString('es-AR')}. Si ya abonaste, podés ignorar este mensaje.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> Avisar por WhatsApp</a>
                          ) : <span className="ficha-action-no-phone"><Phone size={14}/> Agregá un teléfono para enviar el aviso</span>}
                        </div>
                      )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Historial de préstamos ── */}
        {cl.length > 0 && (
          <div className="pn-panel">
            <div className="pn-panel-header">
              <span className="pn-panel-title"><DollarSign size={14}/> Historial de préstamos</span>
            </div>
            <div className="table-scroll">
              <table className="pn-table">
                <thead><tr>
                  <th>REFERENCIA</th><th>CAPITAL</th><th>PROGRESO</th><th>ESTADO</th><th></th>
                </tr></thead>
                <tbody>
                  {cl.map(l => {
                    const cuotasLoan = payments.filter(p => p.loanId === l.id)
                    return (
                      <tr key={l.id}>
                        <td className="mono pn-td-muted">{l.id}</td>
                        <td className="pn-td-money"><Money value={l.principal}/></td>
                        <td>
                          <div className="pn-progress-cell">
                            <span>{l.paid}/{l.installments}</span>
                            <div className="pn-progress-bar">
                              <div className="pn-progress-fill" style={{ width:`${l.installments>0?(l.paid/l.installments)*100:0}%` }}/>
                            </div>
                          </div>
                        </td>
                        <td><Status status={l.status}/></td>
                        <td>
                          <button className="pn-btn-icon" title="Comprobante Word"
                            onClick={() => onComprobanteDocx(l, cuotasLoan, 'completo', null)}>
                            <FileSignature size={13}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pays.length === 0 && cl.length > 0 && (
          <div className="pn-empty" style={{ padding:24 }}>
            <div className="pn-empty-icon pn-empty-icon-green"><CheckCheck size={24}/></div>
            <h3>¡Todo al día!</h3>
            <p>Este cliente no tiene cuotas pendientes.</p>
          </div>
        )}
      </div>
    )
  }

  // ─── GRID DE CLIENTES ───────────────────────────────────
  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Users size={11}/> CLIENTES</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Clientes</h2><HelpBtn contentKey="p_clientes" /></div>
          <p className="pn-section-desc">Tocá un cliente para cobrar cuotas o ver su historial.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-green" onClick={() => onNew(null)}
          whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <Plus size={15}/> Nuevo préstamo
        </motion.button>
      </div>
      <div className="pn-search-bar">
        <label className="pn-searchbox">
          <Search size={14}/>
          <input placeholder="Buscar cliente…" value={q} onChange={e => setQ(e.target.value)}/>
        </label>
      </div>
      {loading
        ? <div className="pn-client-grid">{[1,2,3,4,5,6].map(i=><div key={i} className="pn-client-card pn-client-sk"><div className="pn-sk-av"/><div className="pn-sk-ln"/><div className="pn-sk-ln pn-sk-sm"/></div>)}</div>
        : grouped.length === 0
          ? <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="pn-empty-icon"><Users size={28}/></div>
              <h3>Sin clientes</h3>
              <p>Los clientes aparecen al crear un préstamo.</p>
            </motion.div>
          : <div className="pn-client-grid">
              {grouped.map((c, i) => {
                const { score, label, cls } = calcScore(c.client)
                const pendiente = payments.filter(p => p.client === c.client && p.status !== 'Pagado').reduce((s,p) => s+Number(p.amount), 0)
                const cuotasVenc = payments.filter(p => p.client === c.client && p.status === 'Vencido').length
                const cuotasHoy  = payments.filter(p => p.client === c.client && daysUntil(p.due) === 0 && p.status !== 'Pagado').length
                return (
                  <motion.article key={c.client} className="pn-client-card"
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:i*.04, type:'spring', stiffness:260, damping:22 }}
                    whileHover={{ y:-4 }}>
                    <div className="pn-client-card-top">
                      <div className={`pn-client-avatar pn-score-bg-${cls}`}>
                        {c.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        {cuotasVenc > 0 && <span className="pn-badge-red" style={{ fontSize:9 }}>{cuotasVenc} venc.</span>}
                        {cuotasHoy > 0 && cuotasVenc === 0 && <span className="pn-badge-amber" style={{ fontSize:9 }}>Hoy</span>}
                        <button className="pn-btn-icon" onClick={e => { e.stopPropagation(); onEdit(c) }} title="Editar"><Edit3 size={12}/></button>
                      </div>
                    </div>
                    <h3 className="pn-client-name">{c.client}</h3>
                    <p className="pn-client-meta">{c.phone || '—'} · DNI {c.dni || '—'}</p>
                    <div className="pn-score-row">
                      <span className="pn-score-number">{score}<span className="pn-score-denom">/850</span></span>
                      <span className={`pn-score-chip pn-score-${cls}`}>{label}</span>
                    </div>
                    <div className="pn-client-metrics">
                      <div><small>Capital</small><b><Money value={c.principal}/></b></div>
                      <div><small>Cuotas</small><b>{c.paid}/{c.installments}</b></div>
                    </div>
                    {pendiente > 0
                      ? <div className="pn-client-debt"><Money value={pendiente}/> pendiente</div>
                      : <div style={{ fontSize:11, color:'var(--pn-green)', fontWeight:600, marginTop:2 }}>✓ Sin deuda pendiente</div>
                    }
                    <div className="pn-client-actions" style={{ marginTop:10 }}>
                      <button className="pn-btn-outline pn-btn-sm" style={{ flex:1 }} onClick={() => setSel(c)}>
                        <FileText size={12}/> Ver ficha
                      </button>
                      {c.phone && (
                        <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer">
                          <MessageCircle size={13}/>
                        </a>
                      )}
                    </div>
                    <button className="pn-represtamo" onClick={() => onNew({ prefill:{ client:c.client, phone:c.phone, dni:c.dni, address:c.address, risk:c.risk } })}>
                      <RefreshCcw size={11}/> Nuevo préstamo
                    </button>
                  </motion.article>
                )
              })}
            </div>
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PAPELERA CLIENTES
═══════════════════════════════════════════════════════════════ */
function PapeleraClientes({ papelera = [], onRestaurar, onEliminar, onExport }) {
  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Trash2 size={11}/> CLIENTES</div>
          <div className="pn-heading-with-help"><h2 className="pn-section-title">Papelera</h2><HelpBtn contentKey="p_papelera" /></div>
          <p className="pn-section-desc">Clientes archivados con historial intacto.</p>
        </div>
      </div>
      {papelera.length === 0 ? (
        <motion.div className="pn-empty" initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }}>
          <div className="pn-empty-icon pn-empty-icon-green"><ArchiveRestore size={28}/></div>
          <h3>Papelera vacía</h3>
          <p>Los clientes archivados aparecen aquí.</p>
        </motion.div>
      ) : (
        <div className="pn-client-grid">
          {papelera.map((c, i) => (
            <motion.div key={c.id} className="pn-client-card pn-client-card-archived"
              initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*.05, type:'spring', stiffness:260, damping:22 }}>
              <div className="pn-client-avatar pn-client-avatar-dim">
                {c.nombre_completo?.split(' ').map(x=>x[0]).slice(0,2).join('') || '?'}
              </div>
              <h3 className="pn-client-name">{c.nombre_completo}</h3>
              <p className="pn-client-meta">{c.telefono || '—'}</p>
              <p className="pn-client-meta">Archivado {c.eliminado_at ? new Date(c.eliminado_at).toLocaleDateString('es-AR') : '—'}</p>
              <div className="pn-trash-actions">
                <button className="pn-btn-outline pn-btn-sm" onClick={() => onExport?.(c.id)}>
                  <FileText size={13}/> Word historial
                </button>
                <motion.button className="pn-restore-btn" onClick={() => onRestaurar(c.id, c.nombre_completo)}
                  whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}>
                  <ArchiveRestore size={14}/> Restaurar
                </motion.button>
                <button className="pn-btn-danger pn-btn-sm" onClick={() => {
                  if (window.confirm(`Eliminar permanentemente a ${c.nombre_completo} y su historial asociado? Esta acción no se puede deshacer.`)) onEliminar?.(c.id, c.nombre_completo)
                }}>
                  <Trash2 size={13}/> Eliminar definitivamente
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRESTAMOS INICIO
═══════════════════════════════════════════════════════════════ */
function PrestamosInicio({ totals = {}, loans = [], payments = [], monthBars = [], loading = false, go, onNew, onPay }) {
  const urgentes = useMemo(() =>
    payments.filter(p => (daysUntil(p.due) <= 0 || p.status === 'Vencido') && p.status !== 'Pagado').slice(0, 4),
    [payments]
  )
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const maxBar = Math.max(...monthBars, 1)

  const kpis = [
    { label:'Capital colocado',   value:totals.principal  || 0, icon:Landmark,     color:'purple', change:totals.cambioMes },
    { label:'Interés esperado',   value:totals.interest   || 0, icon:TrendingUp,    color:'green',  change:null },
    { label:'Cobrado hoy',        value:totals.cobradoHoy || 0, icon:ArrowDownLeft, color:'teal',   change:null },
    { label:'Caja disponible',    value:totals.caja       || 0, icon:Wallet,        color:'amber',  change:null },
  ]
  const quick = [
    { label:'Ruta del día',  icon:Route,  tab:'p_ruta',     desc:`${payments.filter(p=>daysUntil(p.due)===0&&p.status!=='Pagado').length} hoy` },
    { label:'Clientes',      icon:Users,  tab:'p_clientes', desc:`${loans.length} activos` },
    { label:'Mora',          icon:Bell,   tab:'p_clientes', desc:`${payments.filter(p=>p.status==='Vencido').length} vencidas` },
    { label:'Caja',          icon:Wallet, tab:'p_caja',     desc:'Movimientos' },
  ]

  return (
    <div className="pn-inicio">
      <div className="pn-hero pn-hero-green">
        <div className="pn-hero-content">
          <div className="pn-hero-eyebrow"><DollarSign size={12}/> MÓDULO PRÉSTAMOS</div>
          <div className="pn-heading-with-help"><h1 className="pn-hero-title">Panel de Resumen</h1><HelpBtn contentKey="p_inicio" /></div>
          <p className="pn-hero-date">{todayLabel}</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-green" onClick={() => onNew(null)} whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
          <Plus size={16}/> Emitir préstamo
        </motion.button>
      </div>

      <div className="pn-kpi-row">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className={`pn-kpi pn-kpi-${k.color}`}
            initial={{ opacity:0, y:20, scale:.95 }} animate={{ opacity:1, y:0, scale:1 }}
            transition={{ delay:i*.08, type:'spring', stiffness:300, damping:24 }}
            whileHover={{ y:-3 }}>
            <div className="pn-kpi-top"><span className="pn-kpi-label">{k.label}</span><k.icon size={16} className="pn-kpi-icon"/></div>
            {loading
              ? <div className="pn-kpi-sk"/>
              : <>
                  <div className="pn-kpi-val">{fmt(k.value)}</div>
                  {k.change != null && (
                    <div className={`pn-kpi-change ${Number(k.change) >= 0 ? 'pos' : 'neg'}`}>
                      {Number(k.change) >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                      {Math.abs(Number(k.change))}% vs mes ant.
                    </div>
                  )}
                </>
            }
          </motion.div>
        ))}
      </div>

      <div className="pn-quick">
        {quick.map((q, i) => (
          <motion.button key={q.tab} className="pn-quick-btn pn-quick-btn-green" onClick={() => go(q.tab)}
            initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:.2+i*.06 }} whileHover={{ x:4 }}>
            <div className="pn-quick-icon"><q.icon size={20}/></div>
            <div className="pn-quick-text"><span className="pn-quick-label">{q.label}</span><span className="pn-quick-desc">{q.desc}</span></div>
            <ArrowRight size={14} className="pn-quick-arrow"/>
          </motion.button>
        ))}
      </div>

      <div className="pn-bottom-row">
        {monthBars.some(v => v > 0) && (
          <motion.section className="pn-panel pn-bars-panel" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3 }}>
            <div className="pn-panel-header"><span className="pn-panel-title"><BarChart3 size={14}/> Cobrado por mes</span></div>
            <div className="pn-bars">
              {monthBars.map((v, i) => {
                const d = new Date(new Date().getFullYear(), new Date().getMonth()-11+i, 1)
                const pct = Math.max(4, Math.round((v/maxBar)*100))
                return (
                  <div key={i} className={`pn-bar-col ${i===11?'active':''}`}>
                    <div className="pn-bar-wrap">
                      <motion.div className={`pn-bar-fill ${i===11?'pn-bar-fill-active':''}`}
                        initial={{ height:0 }} animate={{ height:`${pct}%` }}
                        transition={{ delay:.4+i*.04, duration:.5, ease:'easeOut' }}/>
                    </div>
                    <span>{MESES[d.getMonth()]}</span>
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        {urgentes.length > 0 && (
          <motion.section className="pn-panel pn-urgent-panel" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35 }}>
            <div className="pn-panel-header">
              <span className="pn-panel-title"><CircleAlert size={14}/> Cobros urgentes</span>
              <button className="pn-panel-link" onClick={() => go('p_ruta')}>Ver ruta <ArrowRight size={12}/></button>
            </div>
            <div className="pn-urgent-list">
              {urgentes.map((p, i) => {
                const dias = daysUntil(p.due)
                const venc = dias < 0
                return (
                  <motion.div key={p.id} className={`pn-urgent-row ${venc?'pn-urgent-vencida':''}`}
                    initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:.4+i*.07 }}>
                    <div className="pn-urgent-info">
                      <span className="pn-urgent-client">{p.client}</span>
                      <span className="pn-urgent-meta">
                        {venc ? <span className="pn-badge-red">{Math.abs(dias)}d vencida</span> : <span className="pn-badge-amber">Hoy</span>}
                        <span className="pn-urgent-ref">{p.loanId} · #{p.n}</span>
                      </span>
                    </div>
                    <div className="pn-urgent-right">
                      <span className={`pn-urgent-amount ${venc?'text-red':''}`}><Money value={p.amount}/></span>
                      <motion.button className="pn-cobrar-mini" onClick={() => onPay(p, 'Pagado')} whileHover={{ scale:1.1 }} whileTap={{ scale:.9 }}>
                        <Check size={12}/>
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  )
}

function VentasInicio({ ventas = [], payments = [], loans = [], productos = [], totals = {}, loading = false, go }) {
  const totalVendido  = ventas.reduce((s,v) => s+Number(v.montoTotal),      0)
  const cuotasVenta = payments.filter(p => p.origen === 'venta')
  const saldoPorCobrar = cuotasVenta.reduce((s,p) => s + Number(p.amount || 0), 0)
  const totalCobrado = ventas.reduce((s,v) => s + Number(v.anticipo || 0) + Number(loans.find(l => l.id === v.prestamo?.referencia)?.totalRecuperado || 0), 0)
  const productosCriticos = productos.filter(p => Number(p.stock) <= 3)

  const kpis = [
    { label:'Total vendido', value:totalVendido, icon:ShoppingCart, color:'purple' },
    { label:'Total cobrado', value:totalCobrado, icon:Check, color:'green' },
    { label:'Saldo por cobrar', value:saldoPorCobrar, icon:Clock, color:'amber' },
    { label:'Caja ventas', value:totals.caja || 0, icon:Wallet, color:'teal' },
  ]
  const quick = [
    { label:'Nueva venta',icon:ShoppingCart,tab:'v_nueva',   desc:'Registrar venta' },
    { label:'Catálogo',   icon:Package,     tab:'v_catalogo',desc:'Ver productos'   },
    { label:'Ventas',     icon:Store,       tab:'v_ventas',  desc:`${ventas.length} total` },
    { label:'Clientes',   icon:Users,       tab:'v_clientes',desc:'Fichas'          },
  ]
  return (
    <div className="pn-inicio">
      <div className="pn-hero pn-hero-purple">
        <div className="pn-hero-content">
          <div className="pn-hero-eyebrow"><ShoppingCart size={12}/> MÓDULO VENTAS</div>
          <div className="pn-heading-with-help"><h1 className="pn-hero-title">Resumen de Ventas</h1><HelpBtn contentKey="v_inicio" /></div>
          <p className="pn-hero-date">{todayLabel}</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={() => go('v_nueva')} whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
          <ShoppingCart size={16}/> Nueva venta
        </motion.button>
      </div>
      <div className="pn-kpi-row">
        {kpis.map((k,i) => (
          <motion.div key={k.label} className={`pn-kpi pn-kpi-${k.color}`}
            initial={{ opacity:0, y:20, scale:.95 }} animate={{ opacity:1, y:0, scale:1 }}
            transition={{ delay:i*.08, type:'spring', stiffness:300, damping:24 }}>
            <div className="pn-kpi-top"><span className="pn-kpi-label">{k.label}</span><k.icon size={16} className="pn-kpi-icon"/></div>
            {loading ? <div className="pn-kpi-sk"/> : <div className="pn-kpi-val">{fmt(k.value)}</div>}
          </motion.div>
        ))}
      </div>
      <div className="pn-quick">
        {quick.map((q,i) => (
          <motion.button key={q.tab} className="pn-quick-btn pn-quick-btn-purple" onClick={() => go(q.tab)}
            initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:.2+i*.06 }} whileHover={{ x:4 }}>
            <div className="pn-quick-icon"><q.icon size={20}/></div>
            <div className="pn-quick-text"><span className="pn-quick-label">{q.label}</span><span className="pn-quick-desc">{q.desc}</span></div>
            <ArrowRight size={14} className="pn-quick-arrow"/>
          </motion.button>
        ))}
      </div>
      {productosCriticos.length > 0 && (
        <motion.button type="button" className="pn-inventory-alert" onClick={() => go('v_catalogo')}
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:.28 }}>
          <span className="pn-inventory-alert-icon"><CircleAlert size={18}/></span>
          <span className="pn-inventory-alert-copy"><b>{productosCriticos.length} producto{productosCriticos.length === 1 ? '' : 's'} con stock bajo</b><small>{productosCriticos.slice(0,3).map(p => `${p.nombre} (${p.stock})`).join(' · ')}{productosCriticos.length > 3 ? ' · y más' : ''}</small></span>
          <span className="pn-inventory-alert-action">Revisar catálogo <ArrowRight size={13}/></span>
        </motion.button>
      )}
      {ventas.length > 0 && (
        <motion.section className="pn-panel" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35 }}>
          <div className="pn-panel-header">
            <span className="pn-panel-title"><Store size={14}/> Últimas ventas</span>
            <button className="pn-panel-link" onClick={() => go('v_ventas')}>Ver todas <ArrowRight size={12}/></button>
          </div>
          <div className="table-scroll">
            <table className="pn-table">
              <thead><tr><th>CLIENTE</th><th>REFERENCIA</th><th>TOTAL</th><th>ANTICIPO</th><th>ESTADO</th></tr></thead>
              <tbody>
                {ventas.slice(0,6).map((v,i) => {
                  const loan = loans.find(l => l.id === v.prestamo?.referencia)
                  const cuotasTotales = Number(loan?.installments ?? v.prestamo?.cuotas ?? 0)
                  const vencida = payments.some(p => p.loanId === v.prestamo?.referencia && p.status === 'Vencido')
                  const estado = v.estado === 'cancelado' ? 'Cancelado' : cuotasTotales > 0 && Number(loan?.paid || 0) >= cuotasTotales ? 'Pagado' : vencida ? 'En mora' : 'Activo'
                  return (
                    <motion.tr key={v.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.4+i*.04 }}>
                      <td className="pn-td-main">{v.client}</td>
                      <td className="mono pn-td-muted">{v.referencia}</td>
                      <td className="pn-td-money"><Money value={v.montoTotal}/></td>
                      <td className="pn-td-green"><Money value={v.anticipo}/></td>
                      <td><Status status={estado}/></td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </div>
  )
}

