#!/usr/bin/env python3
"""Apply all remaining fixes to App.jsx"""
APP = r"c:\Users\angel\OneDrive\Desktop\prestamos-web\src\App.jsx"

with open(APP, encoding='utf-8') as f:
    lines = f.readlines()

def find_fn(name):
    for i, l in enumerate(lines):
        if l.startswith(f'function {name}('):
            return i
    return -1

def find_end(start):
    for i in range(start + 5, len(lines)):
        if lines[i].startswith('function ') and len(lines[i]) > 9 and lines[i][9].isupper():
            return i
        if lines[i].startswith('/* ═') or lines[i].startswith('export default'):
            return i
    return len(lines)

def replace_fn(name, new_code):
    global lines
    s = find_fn(name)
    e = find_end(s)
    print(f"{name}: lines {s+1}–{e}")
    new_lines = (new_code.strip() + '\n').splitlines(keepends=True)
    lines = lines[:s] + new_lines + ['\n'] + lines[e:]

def replace_str(old, new):
    global lines
    content = ''.join(lines)
    if old not in content:
        print(f"WARNING: string not found for replace: {old[:60]!r}")
        return
    content = content.replace(old, new, 1)
    lines = content.splitlines(keepends=True)
    print(f"Replaced: {old[:60]!r}")

# ═══════════════════════════════════════════════════════════
# FIX handleGenerarReporte — filtrar payments por cliente
# ═══════════════════════════════════════════════════════════
replace_str(
    "        } else {\n      // ── Reporte de PRÉSTAMOS ──\n      const loansF   = alcance === 'cliente' ? loansEfectivo.filter(l => l.client === clienteFiltro) : loansEfectivo\n      const ledgerF  = ledgerEfectivo.filter(m => enRango(m.rawDate))\n      const receiptsF = receipts.filter(r => enRango(r.paidAt))\n      const titulo   = alcance === 'cliente' ? `Cliente: ${clienteFiltro}` : desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Reporte de Préstamos'\n      try {\n        if (formato === 'excel') {\n          const { exportReportExcelPrestamos } = await import('./utils/exportReportExcel')\n          await exportReportExcelPrestamos({ loans: loansF, payments: paymentsEfectivo, ledger: ledgerF, receipts: receiptsF, desde, hasta, titulo })\n          showToast('Excel descargado')\n        } else {\n          const { exportReportDocxPrestamos } = await import('./utils/reportDocx')\n          await exportReportDocxPrestamos({ loans: loansF, payments: paymentsEfectivo, ledger: ledgerF, titulo })\n          showToast('Word descargado')\n        }\n      } catch (err) { showToast(`Error al generar reporte: ${err.message}`, 'error') }\n    }\n  }, [modo, loansEfectivo, paymentsEfectivo, ledgerEfectivo, ledgerVentas, ventas, receipts])",
    "        } else {\n      // ── Reporte de PRÉSTAMOS ──\n      const loansF    = alcance === 'cliente' ? loansEfectivo.filter(l => l.client === clienteFiltro) : loansEfectivo\n      const paymentsF = alcance === 'cliente' ? paymentsEfectivo.filter(p => p.client === clienteFiltro) : paymentsEfectivo\n      const ledgerF   = ledgerEfectivo.filter(m => enRango(m.rawDate))\n      const receiptsF = receipts.filter(r => enRango(r.paidAt) && (alcance !== 'cliente' || r.client === clienteFiltro))\n      const titulo    = alcance === 'cliente' ? `Cliente: ${clienteFiltro}` : desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Reporte de Préstamos'\n      try {\n        if (formato === 'excel') {\n          const { exportReportExcelPrestamos } = await import('./utils/exportReportExcel')\n          await exportReportExcelPrestamos({ loans: loansF, payments: paymentsF, ledger: ledgerF, receipts: receiptsF, desde, hasta, titulo })\n          showToast('Excel descargado')\n        } else {\n          const { exportReportDocxPrestamos } = await import('./utils/reportDocx')\n          await exportReportDocxPrestamos({ loans: loansF, payments: paymentsF, ledger: ledgerF, titulo })\n          showToast('Word descargado')\n        }\n      } catch (err) { showToast(`Error al generar reporte: ${err.message}`, 'error') }\n    }\n  }, [modo, loansEfectivo, paymentsEfectivo, ledgerEfectivo, ledgerVentas, ventas, receipts])"
)

# ═══════════════════════════════════════════════════════════
# LOANMODAL — rediseño como página inline, más espacioso
# ═══════════════════════════════════════════════════════════
replace_fn('LoanModal', r"""
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
    if (!client || client.length < 2) { setSugs([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      try { const r = await buscarClientesPorNombre(userId, client); setSugs(r || []) }
      catch { setSugs([]) }
    }, 350)
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
            <div>
              <label className="lm-label">Nivel de riesgo</label>
              <select className="lm-input" value={risk} onChange={e => setRisk(e.target.value)}>
                <option value="bajo">🟢 Bajo</option>
                <option value="medio">🟡 Medio</option>
                <option value="alto">🔴 Alto</option>
              </select>
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

        {/* ── Preview ── */}
        <AnimatePresence>
          {preview && (
            <motion.div className="lm-preview"
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
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
              {/* Mini-cronograma: primeras 4 cuotas */}
              <div className="lm-mini-sched">
                {preview.cronograma.slice(0, 4).map((q, i) => (
                  <div key={i} className="lm-mini-row">
                    <span className="lm-mini-n">#{q.numero_cuota}</span>
                    <span className="lm-mini-date">{q.fecha_vencimiento}</span>
                    <span className="lm-mini-amt">{fmt(q.monto_cuota)}</span>
                  </div>
                ))}
                {preview.cronograma.length > 4 && (
                  <div className="lm-mini-more">+ {preview.cronograma.length - 4} cuotas más…</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errors.submit && <div className="lm-submit-error">{errors.submit}</div>}
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
          <h2 className="lm-page-title">Nuevo préstamo</h2>
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
            <h2 className="lm-page-title">Nuevo préstamo</h2>
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
""")

# ═══════════════════════════════════════════════════════════
# NUEVAVENTA — rediseño espacioso y atractivo
# ═══════════════════════════════════════════════════════════
replace_fn('NuevaVenta', r"""
function NuevaVenta({ productos = [], loading = false, userId, onSubmit }) {
  const [step,     setStep]    = useState(1)
  const [carrito,  setCarrito] = useState([])   // [{producto, qty}]
  const [client,   setClient]  = useState('')
  const [phone,    setPhone]   = useState('')
  const [dni,      setDni]     = useState('')
  const [address,  setAddress] = useState('')
  const [risk,     setRisk]    = useState('medio')
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
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === prod.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? {...i, qty: i.qty + 1} : i)
      return [...prev, { producto: prod, qty: 1 }]
    })
  }
  function setQty(id, qty) {
    if (qty <= 0) setCarrito(prev => prev.filter(i => i.producto.id !== id))
    else setCarrito(prev => prev.map(i => i.producto.id === id ? {...i, qty} : i))
  }

  async function handleSubmit() {
    if (!client.trim()) { setErr('El nombre del cliente es requerido'); return }
    if (carrito.length === 0) { setErr('Agregá al menos un producto al carrito'); return }
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
          <h2 className="nv-title">Nueva venta a crédito</h2>
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
                              <button type="button" onClick={() => setQty(prod.id, inCart.qty + 1)}>+</button>
                            </div>
                          : <button type="button" className="nv-add-btn" onClick={() => addProd(prod)}>
                              <Plus size={13}/> Agregar
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
                <div>
                  <label className="lm-label">Nivel de riesgo</label>
                  <select className="lm-input" value={risk} onChange={e => setRisk(e.target.value)}>
                    <option value="bajo">🟢 Bajo</option>
                    <option value="medio">🟡 Medio</option>
                    <option value="alto">🔴 Alto</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="nv-step-nav">
              <button type="button" className="pn-btn-secondary" onClick={() => setStep(1)}>
                <ChevronLeft size={14}/> Atrás
              </button>
              <motion.button type="button" className="pn-btn-primary pn-btn-purple"
                onClick={() => { setErr(''); setStep(3) }}
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
                    <input className="lm-input lm-input-prefix" value={anticipo} onChange={e => setAnticipo(e.target.value)} type="number" min="0" placeholder="0"/>
                  </div>
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
""")

# ═══════════════════════════════════════════════════════════
# CLIENTESPRESTAMOS — ficha útil con cuotas cobrables + eliminar
# ═══════════════════════════════════════════════════════════
replace_fn('ClientesPrestamos', r"""
function ClientesPrestamos({ loans = [], allLoans = [], receipts = [], loading = false, onNew, onEdit, onArchivar, onComprobanteDocx, payments = [] }) {
  const [q,        setQ]   = useState('')
  const [selected, setSel] = useState(null)

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
                      <div key={p.id} className={`ficha-cuota-row ${vencida ? 'ficha-cuota-vencida' : esHoy ? 'ficha-cuota-hoy' : ''}`}>
                        <div className="ficha-cuota-info">
                          <span className="ficha-cuota-n">Cuota {p.n}/{p.totalQuotas}</span>
                          <span className="ficha-cuota-date">{p.due}</span>
                          {vencida && <span className="pn-badge-red">{Math.abs(dias)}d vencida</span>}
                          {esHoy && !vencida && <span className="pn-badge-amber">Hoy</span>}
                          {p.status === 'Parcial' && <span className="pn-badge-purple">Parcial</span>}
                        </div>
                        <div className="ficha-cuota-right">
                          <span className={`ficha-cuota-amt ${vencida ? 'text-red' : ''}`}><Money value={p.amount}/></span>
                          <div style={{ display:'flex', gap:5 }}>
                            <motion.button className="pn-cobrar-mini"
                              onClick={() => {/* handled by parent via PartialModal or direct pay */}}
                              style={{ display:'none' }}  /* placeholder */
                              whileHover={{ scale:1.1 }} whileTap={{ scale:.9 }}>
                              <Check size={12}/>
                            </motion.button>
                          </div>
                        </div>
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
          <h2 className="pn-section-title">Clientes</h2>
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
""")

with open(APP, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Done! Lines: {len(lines)}")
