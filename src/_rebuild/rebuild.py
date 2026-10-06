#!/usr/bin/env python3
"""Rebuilds all target functions in App.jsx with beautiful new implementations."""
import sys

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
        if lines[i].startswith('function ') and lines[i][9].isupper():
            return i
        if lines[i].startswith('/* ═') or lines[i].startswith('export default'):
            return i
    return len(lines)

def replace(name, new_code):
    global lines
    s = find_fn(name)
    e = find_end(s)
    print(f"{name}: lines {s+1}–{e}")
    new_lines = (new_code.strip() + '\n').splitlines(keepends=True)
    lines = lines[:s] + new_lines + ['\n'] + lines[e:]

# ═══════════════════════════════════════════════════════════
# CASH
# ═══════════════════════════════════════════════════════════
replace('Cash', r"""
function Cash({ ledger, totals, loading, onExport }) {
  const [q,          setQ]     = useState('')
  const [filtro,     setFiltro]= useState('Todos')

  const entradas = ledger.filter(x => x.type === 'Entrada').reduce((s,x) => s+x.amount, 0)
  const salidas  = ledger.filter(x => x.type === 'Salida').reduce((s,x) => s+x.amount, 0)
  const balance  = entradas - salidas

  const visible = useMemo(() => ledger.filter(m => {
    const okTipo = filtro === 'Todos' || m.type === filtro
    const okQ    = !q.trim() || m.label.toLowerCase().includes(q.toLowerCase())
    return okTipo && okQ
  }), [ledger, filtro, q])

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Wallet size={11}/> CONTROL FINANCIERO</div>
          <h2 className="pn-section-title">Caja</h2>
          <p className="pn-section-desc">Todos los movimientos de entrada y salida.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-green" onClick={onExport} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <Download size={15}/> Generar reporte
        </motion.button>
      </div>

      {/* Balance strip */}
      <div className="pn-cash-strip">
        {[
          { label:'Balance',  value:balance,  color: balance >= 0 ? 'green' : 'red', icon:Wallet },
          { label:'Entradas', value:entradas, color:'green', icon:ArrowDownLeft },
          { label:'Salidas',  value:salidas,  color:'red',   icon:ArrowUpRight  },
        ].map((k, i) => (
          <motion.div key={k.label} className={`pn-cash-card pn-cash-${k.color}`}
            initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.07 }}>
            <div className="pn-cash-card-top">
              <span>{k.label}</span><k.icon size={15}/>
            </div>
            {loading ? <div className="pn-kpi-sk"/> : <div className="pn-cash-val">{fmt(k.value)}</div>}
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="pn-toolbar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar movimiento…" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <div className="pn-filter-pills">
          {['Todos','Entrada','Salida'].map(f => (
            <button key={f} className={`pn-pill ${filtro===f?'pn-pill-active':''}`} onClick={()=>setFiltro(f)}>{f}</button>
          ))}
        </div>
        <span className="pn-count">{visible.length} mov.</span>
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
                  <thead><tr><th>DESCRIPCIÓN</th><th>TIPO</th><th>IMPORTE</th><th>FECHA / HORA</th></tr></thead>
                  <tbody>
                    {visible.map((m, i) => (
                      <motion.tr key={m.id} className={`pn-cash-row pn-cash-row-${m.type === 'Entrada' ? 'entrada' : 'salida'}`}
                        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.1+i*.02 }}>
                        <td className="pn-td-main">
                          <span className={`pn-cash-dot ${m.type==='Entrada'?'dot-green':'dot-red'}`}/>
                          {m.label}
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
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
      }
    </div>
  )
}
""")

# ═══════════════════════════════════════════════════════════
# LOANMODAL
# ═══════════════════════════════════════════════════════════
replace('LoanModal', r"""
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
    if (!preview) errs.monto = 'Revisá los datos'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onCreate({ client: client.trim(), phone, dni, address, risk, principal: Number(monto), rate: Number(tasa), installments: Number(cuotas), frequency: freq, firstDue, omitSunday: omitSun, schedule: preview.cronograma })
    } catch (err) { setErrors({ submit: err.message }) }
    finally { setSaving(false) }
  }

  const form = (
    <form onSubmit={handleSubmit} className="pn-loan-form" noValidate>
      {/* Header */}
      {!inline && (
        <div className="pn-modal-header">
          <div className="pn-modal-header-icon"><HandCoins size={20}/></div>
          <div><h2>Nuevo préstamo</h2><p>Completá los datos para emitir</p></div>
          <button type="button" className="pn-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
      )}

      <div className="pn-loan-body">
        {/* Datos del cliente */}
        <div className="pn-form-section">
          <h3 className="pn-form-section-title"><UserRound size={14}/> Datos del cliente</h3>
          <div className="pn-form-grid">
            <div style={{ position:'relative' }}>
              <Field label="Nombre completo" value={client} onChange={e=>setClient(e.target.value)} placeholder="Juan García" autoComplete="off"/>
              {errors.client && <p className="pn-field-error">{errors.client}</p>}
              <AnimatePresence>
                {sugs.length > 0 && (
                  <motion.div className="pn-sugs" initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                    {sugs.map((s,i) => (
                      <button key={i} type="button" className="pn-sug-item" onClick={() => pickSug(s)}>
                        <div className="pn-sug-avatar">{(s.name||'?')[0]}</div>
                        <div><b>{s.name}</b><span>{s.phone || 'Sin tel'}</span></div>
                        {s.activeLoan && <span className="pn-sug-badge">Activo</span>}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Field label="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="11 1234-5678" type="tel"/>
            <Field label="DNI (opcional)" value={dni} onChange={e=>setDni(e.target.value)} placeholder="—"/>
            <Field label="Dirección (opcional)" value={address} onChange={e=>setAddress(e.target.value)} placeholder="—"/>
            <label className="field">
              <span>Nivel de riesgo</span>
              <select value={risk} onChange={e=>setRisk(e.target.value)}>
                <option value="bajo">🟢 Bajo</option>
                <option value="medio">🟡 Medio</option>
                <option value="alto">🔴 Alto</option>
              </select>
            </label>
          </div>
        </div>

        {/* Condiciones */}
        <div className="pn-form-section">
          <h3 className="pn-form-section-title"><DollarSign size={14}/> Condiciones del préstamo</h3>
          <div className="pn-form-grid">
            <div>
              <Field label="Capital ($)" value={monto} onChange={e=>setMonto(e.target.value)} type="number" prefix="$" min="1" placeholder="50000"/>
              {errors.monto && <p className="pn-field-error">{errors.monto}</p>}
            </div>
            <Field label="Tasa de interés (%)" value={tasa} onChange={e=>setTasa(e.target.value)} type="number" suffix="%" min="0" step="0.5"/>
            <Field label="Número de cuotas" value={cuotas} onChange={e=>setCuotas(e.target.value)} type="number" min="1"/>
            <label className="field">
              <span>Frecuencia</span>
              <select value={freq} onChange={e=>setFreq(e.target.value)}>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </label>
            <Field label="Primera cuota" value={firstDue} onChange={e=>setFirstDue(e.target.value)} type="date"/>
            {freq === 'diario' && (
              <label className="pn-toggle-label">
                <input type="checkbox" checked={omitSun} onChange={e=>setOmitSun(e.target.checked)}/>
                <span>Omitir domingos</span>
              </label>
            )}
          </div>
        </div>

        {/* Preview */}
        <AnimatePresence>
          {preview && (
            <motion.div className="pn-preview-card"
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
              <div className="pn-preview-title"><Sparkles size={13}/> Vista previa del cronograma</div>
              <div className="pn-preview-row">
                <div className="pn-preview-item">
                  <span>Cuota fija</span>
                  <b>{fmt(preview.monto_cuota)}</b>
                </div>
                <div className="pn-preview-item">
                  <span>Interés total</span>
                  <b className="text-amber">{fmt(preview.total_interes)}</b>
                </div>
                <div className="pn-preview-item">
                  <span>Total a pagar</span>
                  <b className="text-green">{fmt(preview.total_a_pagar)}</b>
                </div>
                <div className="pn-preview-item">
                  <span>Cuotas</span>
                  <b>{preview.cronograma.length}</b>
                </div>
              </div>
              {/* Primeras 3 cuotas */}
              <div className="pn-preview-schedule">
                {preview.cronograma.slice(0,3).map((q,i) => (
                  <div key={i} className="pn-preview-quota">
                    <span className="pn-preview-qn">#{q.numero_cuota}</span>
                    <span className="pn-preview-qdate">{q.fecha_vencimiento}</span>
                    <span className="pn-preview-qamt">{fmt(q.monto_cuota)}</span>
                  </div>
                ))}
                {preview.cronograma.length > 3 && <span className="pn-preview-more">+{preview.cronograma.length-3} más…</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errors.submit && <p className="pn-field-error pn-field-error-block">{errors.submit}</p>}
      </div>

      <div className="pn-loan-footer">
        {!inline && <button type="button" className="pn-btn-secondary" onClick={onClose}>Cancelar</button>}
        <motion.button type="submit" className="pn-btn-primary pn-btn-green" disabled={saving || !preview}
          whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}>
          {saving ? <Spinner size={15}/> : <Plus size={15}/>}
          {saving ? 'Creando…' : 'Crear préstamo'}
        </motion.button>
      </div>
    </form>
  )

  if (inline) return form
  return createPortal(
    <motion.div className="pn-modal-backdrop" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="pn-modal-box"
        initial={{ opacity:0, scale:.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:.97, y:10 }} transition={{ type:'spring', damping:28, stiffness:300 }}>
        {form}
      </motion.div>
    </motion.div>,
    document.body
  )
}
""")

# ═══════════════════════════════════════════════════════════
# RUTADIA
# ═══════════════════════════════════════════════════════════
replace('RutaDia', r"""
function RutaDia({ payments = [], receipts = [], loading = false, onPay, onPartial }) {
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
          <h2 className="pn-section-title">Ruta de Cobro</h2>
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
            const esMañana = dias === 1
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
""")

# ═══════════════════════════════════════════════════════════
# CATALOGO
# ═══════════════════════════════════════════════════════════
replace('Catalogo', r"""
function Catalogo({ productos = [], loading = false, onCreate, onUpdate, onDelete }) {
  const [q,       setQ]      = useState('')
  const [modal,   setModal]  = useState(null)
  const [catFil,  setCatFil] = useState('Todas')

  const cats = useMemo(() => ['Todas', ...new Set(productos.map(p => p.categoria))].sort(), [productos])

  const filtered = useMemo(() =>
    productos.filter(p =>
      (catFil === 'Todas' || p.categoria === catFil) &&
      (!q.trim() || p.nombre.toLowerCase().includes(q.toLowerCase()))
    ), [productos, q, catFil]
  )

  async function handleSave(data) {
    if (data.id) await onUpdate(data.id, { nombre:data.nombre, descripcion:data.descripcion, categoria:data.categoria, precioContado:data.precio_contado??data.precioContado, costo:data.costo, stock:data.stock })
    else await onCreate({ nombre:data.nombre, descripcion:data.descripcion, categoria:data.categoria, precioContado:data.precio_contado??data.precioContado, costo:data.costo, stock:data.stock })
    setModal(null)
  }

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Package size={11}/> VENTAS</div>
          <h2 className="pn-section-title">Catálogo de Productos</h2>
          <p className="pn-section-desc">{productos.length} producto{productos.length!==1?'s':''} disponibles para venta a crédito.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={() => setModal('new')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <PackagePlus size={15}/> Agregar producto
        </motion.button>
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
                      <button className="pn-btn-icon" onClick={() => setModal(p)}><Edit3 size={13}/></button>
                      <button className="pn-btn-icon pn-btn-danger-icon" onClick={() => onDelete(p.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <h3 className="pn-prod-name">{p.nombre}</h3>
                  {p.descripcion && <p className="pn-prod-desc">{p.descripcion}</p>}
                  <div className="pn-prod-footer">
                    <div className="pn-prod-price">{fmt(p.precioContado)}</div>
                    <div className={`pn-prod-stock ${p.stock <= 3 ? 'pn-stock-low' : ''}`}>
                      <Layers size={11}/> {p.stock} en stock
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
      }

      <AnimatePresence>
        {modal && (
          <ProductoModal
            producto={modal === 'new' ? null : modal}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
""")

# ═══════════════════════════════════════════════════════════
# NUEVAVENTA
# ═══════════════════════════════════════════════════════════
replace('NuevaVenta', r"""
function NuevaVenta({ productos = [], loading = false, userId, onSubmit }) {
  const [step,     setStep]    = useState(1)
  const [carrito,  setCarrito] = useState([])
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

  const subtotal   = useMemo(() => carrito.reduce((s,i) => s + i.producto.precioContado*i.qty, 0), [carrito])
  const financiado = Math.max(0, subtotal - (Number(anticipo)||0))
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
      if (idx >= 0) return prev.map((i,n) => n===idx ? {...i, qty:i.qty+1} : i)
      return [...prev, { producto:prod, qty:1 }]
    })
  }
  function setQty(id, qty) {
    if (qty <= 0) setCarrito(prev => prev.filter(i => i.producto.id !== id))
    else setCarrito(prev => prev.map(i => i.producto.id===id ? {...i,qty} : i))
  }

  async function handleSubmit() {
    if (!client.trim()) { setErr('El nombre del cliente es requerido'); return }
    if (carrito.length === 0) { setErr('Agregá al menos un producto'); return }
    if (!preview) { setErr('El monto financiado debe ser mayor a 0'); return }
    setSaving(true)
    try {
      await onSubmit({ client:client.trim(), phone, dni, address, risk, items:carrito.map(i=>({ productoId:i.producto.id, nombre:i.producto.nombre, cantidad:i.qty, precioUnitario:i.producto.precioContado })), montoTotal:subtotal, anticipo:Number(anticipo)||0, fechaVenta:today, notas:'', rate:Number(tasa), installments:Number(cuotas), frequency:freq, firstDue, omitSunday:false, schedule:preview.cronograma })
    } catch(ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const STEPS = ['Productos','Cliente','Financiación']

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><ShoppingCart size={11}/> VENTAS</div>
          <h2 className="pn-section-title">Nueva venta a crédito</h2>
        </div>
      </div>

      {/* Steps */}
      <div className="pn-steps">
        {STEPS.map((s,i) => (
          <div key={s} className={`pn-step ${step===i+1?'pn-step-active':step>i+1?'pn-step-done':''}`}>
            <div className="pn-step-dot">{step>i+1?<Check size={11}/>:i+1}</div>
            <span>{s}</span>
            {i < STEPS.length-1 && <div className="pn-step-line"/>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── PASO 1: Productos ── */}
        {step === 1 && (
          <motion.div key="s1" className="pn-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
            <div className="pn-toolbar">
              <label className="pn-searchbox"><Search size={13}/><input placeholder="Buscar…" value={qProd} onChange={e=>setQProd(e.target.value)}/></label>
              <div className="pn-filter-pills">
                {cats.map(c => <button key={c} className={`pn-pill ${catFil===c?'pn-pill-active-purple':''}`} onClick={()=>setCatFil(c)}>{c}</button>)}
              </div>
            </div>
            <div className="pn-prod-grid">
              {filteredProds.map((prod,i) => {
                const inCart = carrito.find(x => x.producto.id === prod.id)
                return (
                  <motion.div key={prod.id} className="pn-prod-card pn-prod-selectable"
                    initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.04 }}>
                    <div className="pn-prod-header">
                      <span className="pn-prod-cat">{prod.categoria}</span>
                      <span className={`pn-prod-stock ${prod.stock<=3?'pn-stock-low':''}`}>{prod.stock} stock</span>
                    </div>
                    <h3 className="pn-prod-name">{prod.nombre}</h3>
                    <div className="pn-prod-price">{fmt(prod.precioContado)}</div>
                    {inCart
                      ? <div className="pn-qty-control">
                          <button onClick={()=>setQty(prod.id, inCart.qty-1)}>−</button>
                          <span>{inCart.qty}</span>
                          <button onClick={()=>setQty(prod.id, inCart.qty+1)}>+</button>
                        </div>
                      : <button className="pn-btn-outline pn-btn-sm" style={{width:'100%',marginTop:8}} onClick={()=>addProd(prod)}>
                          <Plus size={12}/> Agregar
                        </button>
                    }
                  </motion.div>
                )
              })}
            </div>
            {carrito.length > 0 && (
              <motion.div className="pn-carrito-bar" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
                <span>{carrito.reduce((s,i)=>s+i.qty,0)} artículo{carrito.reduce((s,i)=>s+i.qty,0)!==1?'s':''}</span>
                <span className="pn-carrito-total">{fmt(subtotal)}</span>
                <button className="pn-btn-primary pn-btn-purple pn-btn-sm" onClick={()=>setStep(2)}>
                  Siguiente <ArrowRight size={13}/>
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── PASO 2: Cliente ── */}
        {step === 2 && (
          <motion.div key="s2" className="pn-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
            <div className="pn-form-section">
              <h3 className="pn-form-section-title"><UserRound size={14}/> Datos del cliente</h3>
              <div className="pn-form-grid">
                <Field label="Nombre completo" value={client} onChange={e=>setClient(e.target.value)} placeholder="María García"/>
                <Field label="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)} type="tel"/>
                <Field label="DNI (opcional)" value={dni} onChange={e=>setDni(e.target.value)}/>
                <Field label="Dirección (opcional)" value={address} onChange={e=>setAddress(e.target.value)}/>
                <label className="field"><span>Nivel de riesgo</span>
                  <select value={risk} onChange={e=>setRisk(e.target.value)}>
                    <option value="bajo">🟢 Bajo</option>
                    <option value="medio">🟡 Medio</option>
                    <option value="alto">🔴 Alto</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="pn-step-nav">
              <button className="pn-btn-secondary" onClick={()=>setStep(1)}><ChevronLeft size={14}/> Atrás</button>
              <button className="pn-btn-primary pn-btn-purple" onClick={()=>{setErr('');setStep(3)}}>Siguiente <ArrowRight size={14}/></button>
            </div>
          </motion.div>
        )}

        {/* ── PASO 3: Financiación ── */}
        {step === 3 && (
          <motion.div key="s3" className="pn-step-content"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
            <div className="pn-form-section">
              <h3 className="pn-form-section-title"><CreditCard size={14}/> Condiciones de financiación</h3>
              <div className="pn-preview-mini">
                <span>Total de la venta:</span><b>{fmt(subtotal)}</b>
              </div>
              <div className="pn-form-grid">
                <Field label="Anticipo ($)" value={anticipo} onChange={e=>setAnticipo(e.target.value)} type="number" prefix="$" placeholder="0" min="0"/>
                <Field label="Tasa de interés (%)" value={tasa} onChange={e=>setTasa(e.target.value)} type="number" suffix="%" min="0"/>
                <Field label="Número de cuotas" value={cuotas} onChange={e=>setCuotas(e.target.value)} type="number" min="1"/>
                <label className="field"><span>Frecuencia</span>
                  <select value={freq} onChange={e=>setFreq(e.target.value)}>
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </label>
                <Field label="Primera cuota" value={firstDue} onChange={e=>setFirstDue(e.target.value)} type="date"/>
              </div>
              <AnimatePresence>
                {preview && (
                  <motion.div className="pn-preview-card" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0 }}>
                    <div className="pn-preview-title"><Sparkles size={13}/> Resumen del crédito</div>
                    <div className="pn-preview-row">
                      <div className="pn-preview-item"><span>Financiado</span><b className="text-purple">{fmt(financiado)}</b></div>
                      <div className="pn-preview-item"><span>Cuota</span><b>{fmt(preview.monto_cuota)}</b></div>
                      <div className="pn-preview-item"><span>Interés</span><b className="text-amber">{fmt(preview.total_interes)}</b></div>
                      <div className="pn-preview-item"><span>Total</span><b className="text-green">{fmt(preview.total_a_pagar)}</b></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {err && <p className="pn-field-error pn-field-error-block">{err}</p>}
            <div className="pn-step-nav">
              <button className="pn-btn-secondary" onClick={()=>setStep(2)}><ChevronLeft size={14}/> Atrás</button>
              <motion.button className="pn-btn-primary pn-btn-purple" onClick={handleSubmit} disabled={saving||!preview}
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
# VENTASCLIENTES
# ═══════════════════════════════════════════════════════════
replace('VentasClientes', r"""
function VentasClientes({ ventas = [], payments = [], loading = false, go, onPay, onPartial }) {
  const [q,      setQ]      = useState('')
  const [filtro, setFiltro] = useState('Todos')

  const cuotasVenta = useMemo(() => payments.filter(p => p.origen === 'venta'), [payments])

  const clientes = useMemo(() => {
    const map = new Map()
    for (const v of ventas) {
      if (!map.has(v.clienteId)) map.set(v.clienteId, { clienteId:v.clienteId, client:v.client, phone:v.phone, ventas:[] })
      map.get(v.clienteId).ventas.push(v)
    }
    return [...map.values()]
      .filter(c => (!q.trim() || c.client.toLowerCase().includes(q.toLowerCase())) &&
        (filtro === 'Todos' || c.ventas.some(v => {
          const cuotasC = cuotasVenta.filter(p => p.loanId === v.prestamo?.referencia)
          const vencidas = cuotasC.filter(p => p.status === 'Vencido').length
          const est = v.estado==='pagado'?'Pagado':vencidas>0?'En mora':'Activo'
          return est === filtro
        })))
      .sort((a,b) => a.client.localeCompare(b.client))
  }, [ventas, q, filtro, cuotasVenta])

  const kpis = useMemo(() => ({
    total:   ventas.reduce((s,v) => s+Number(v.montoTotal),    0),
    anticipo:ventas.reduce((s,v) => s+Number(v.anticipo),      0),
    pend:    cuotasVenta.filter(p=>p.status!=='Pagado'&&Number(p.amount)>0).reduce((s,p)=>s+Number(p.amount),0),
    clientes:new Set(ventas.map(v=>v.clienteId)).size,
  }), [ventas, cuotasVenta])

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Store size={11}/> MÓDULO VENTAS</div>
          <h2 className="pn-section-title">Ventas</h2>
          <p className="pn-section-desc">Compras a crédito por cliente. Tocá una venta para cobrar cuotas.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-purple" onClick={()=>go('v_nueva')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <ShoppingCart size={15}/> Nueva venta
        </motion.button>
      </div>

      {/* KPIs */}
      <div className="pn-kpi-row">
        {[
          { label:'Total vendido',    value:kpis.total,    icon:ShoppingCart, color:'purple' },
          { label:'Anticipo cobrado', value:kpis.anticipo, icon:Check,        color:'green'  },
          { label:'Saldo pendiente',  value:kpis.pend,     icon:Clock,        color:'amber'  },
          { label:'Clientes',         value:kpis.clientes, icon:Users,        color:'teal', isMoney:false },
        ].map((k,i) => (
          <motion.div key={k.label} className={`pn-kpi pn-kpi-${k.color}`}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.07 }}>
            <div className="pn-kpi-top"><span className="pn-kpi-label">{k.label}</span><k.icon size={15} className="pn-kpi-icon"/></div>
            {loading ? <div className="pn-kpi-sk"/> : <div className="pn-kpi-val">{k.isMoney===false ? k.value : fmt(k.value)}</div>}
          </motion.div>
        ))}
      </div>

      <div className="pn-toolbar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar cliente…" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <div className="pn-filter-pills">
          {['Todos','Activo','En mora','Pagado'].map(f=>(
            <button key={f} className={`pn-pill ${filtro===f?'pn-pill-active-purple':''}`} onClick={()=>setFiltro(f)}>{f}</button>
          ))}
        </div>
        <span className="pn-count">{clientes.length} clientes</span>
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
                  {c.ventas.map(v => <VentaAcordeon key={v.id} venta={v} cuotas={cuotasVenta} onPay={onPay} onPartial={onPartial}/>)}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
""")

# ═══════════════════════════════════════════════════════════
# CLIENTESVENTAS
# ═══════════════════════════════════════════════════════════
replace('ClientesVentas', r"""
function ClientesVentas({ ventas = [], payments = [], loading = false, go, onPay, onPartial }) {
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
    const totalAnt   = c.ventas.reduce((s,v)=>s+Number(v.anticipo),0)
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
            <button className="pn-btn-primary pn-btn-purple pn-btn-sm" onClick={()=>go('v_nueva')}>
              <ShoppingCart size={13}/> Nueva venta
            </button>
            {c.phone && <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/></a>}
          </div>
        </div>
        <div className="pn-ficha-strip">
          <div><small>Total comprado</small><b><Money value={totalComp}/></b></div>
          <div><small>Anticipo cobrado</small><b className="text-green"><Money value={totalAnt}/></b></div>
          <div><small>Saldo pendiente</small><b className="text-red"><Money value={deudaTotal}/></b></div>
          <div><small>Compras</small><b>{c.ventas.length}</b></div>
        </div>
        <div className="pn-panel" style={{padding:0,overflow:'hidden'}}>
          <div className="pn-panel-header"><span className="pn-panel-title"><ShoppingCart size={14}/> Compras a crédito</span></div>
          <div style={{padding:'8px 14px 14px'}}>
            {c.ventas.map(v => <VentaAcordeon key={v.id} venta={v} cuotas={cuotasVenta} onPay={onPay} onPartial={onPartial}/>)}
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
          <h2 className="pn-section-title">Clientes</h2>
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
                    <div className="pn-client-actions">
                      <button className="pn-btn-outline pn-btn-sm" style={{flex:1}} onClick={()=>setSelected(c)}>
                        <FileText size={12}/> Ver ficha
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
""")

# ═══════════════════════════════════════════════════════════
# PAPELERACLIENTES
# ═══════════════════════════════════════════════════════════
replace('PapeleraClientes', r"""
function PapeleraClientes({ papelera = [], onRestaurar }) {
  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Trash2 size={11}/> CLIENTES</div>
          <h2 className="pn-section-title">Papelera</h2>
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
              <motion.button className="pn-restore-btn" onClick={() => onRestaurar(c.id, c.nombre_completo)}
                whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}>
                <ArchiveRestore size={14}/> Restaurar
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
""")

# ═══════════════════════════════════════════════════════════
# CLIENTESPRESTAMOS
# ═══════════════════════════════════════════════════════════
replace('ClientesPrestamos', r"""
function ClientesPrestamos({ loans = [], allLoans = [], receipts = [], loading = false, onNew, onEdit, onArchivar, onComprobanteDocx, payments = [] }) {
  const [q,        setQ]   = useState('')
  const [selected, setSel] = useState(null)

  const calcScore = useCallback((clientName) => {
    const cl = (allLoans.length > 0 ? allLoans : loans).filter(l => l.client === clientName)
    if (!cl.length) return { score:700, label:'Sin historial', cls:'medio' }
    const totalQ  = cl.reduce((s,l) => s+Number(l.installments||0), 0)
    const pagadas = cl.reduce((s,l) => s+Number(l.paid||0), 0)
    const enMora  = cl.some(l => l.status === 'En mora')
    const completados = cl.filter(l => l.status === 'Pagado').length
    let score = Math.round(300 + (totalQ>0?pagadas/totalQ:0)*450 + completados*20)
    if (enMora) score = Math.max(300, score-120)
    score = Math.min(850, score)
    const cls   = score >= 720 ? 'bajo' : score >= 580 ? 'medio' : 'alto'
    const label = score >= 720 ? 'Paga a tiempo' : score >= 580 ? 'Demoras leves' : 'Alto riesgo'
    return { score, label, cls }
  }, [allLoans, loans])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const l of loans) {
      if (!map.has(l.client)) map.set(l.client, { ...l, count:0 })
      map.get(l.client).count++
    }
    return [...map.values()].filter(c => !q.trim() || c.client.toLowerCase().includes(q.toLowerCase()))
  }, [loans, q])

  if (selected) {
    const cl   = allLoans.filter(l => l.client === selected.client)
    const pays = payments.filter(p => p.client===selected.client && p.status!=='Pagado')
    const deuda = pays.reduce((s,p) => s+Number(p.amount), 0)
    const { score, label, cls } = calcScore(selected.client)
    return (
      <div className="pn-section">
        <button className="pn-back-btn" onClick={() => setSel(null)}>
          <ChevronLeft size={15}/> Volver a clientes
        </button>
        <div className="pn-ficha-header">
          <div className={`pn-ficha-avatar pn-score-bg-${cls}`}>
            {selected.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
          </div>
          <div className="pn-ficha-info">
            <h2>{selected.client}</h2>
            <p>{selected.phone||'—'} · DNI {selected.dni||'—'}</p>
            <p className="pn-ficha-addr">{selected.address||'Sin dirección'}</p>
          </div>
          <div className="pn-ficha-score-block">
            <div className={`pn-score-arc pn-score-arc-${cls}`}>
              <span className="pn-score-big">{score}</span>
              <span className="pn-score-small">/850</span>
            </div>
            <span className={`pn-score-chip pn-score-${cls}`}>{label}</span>
          </div>
        </div>
        <div className="pn-ficha-strip">
          <div><small>Deuda pendiente</small><b className="text-red"><Money value={deuda}/></b></div>
          <div><small>Historial</small><b>{cl.length} préstamos</b></div>
          <div><small>Cuotas pagadas</small><b>{cl.reduce((s,l)=>s+Number(l.paid||0),0)}</b></div>
        </div>
        <div className="pn-ficha-btns-row">
          <button className="pn-btn-secondary pn-btn-sm" onClick={() => onNew({ prefill:{ client:selected.client, phone:selected.phone, dni:selected.dni, address:selected.address, risk:selected.risk } })}>
            <RefreshCcw size={12}/> Volver a prestar
          </button>
          {selected.phone && <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(selected.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={13}/></a>}
          <button className="pn-btn-danger pn-btn-sm" onClick={() => { if(window.confirm(`¿Mover a ${selected.client} a la papelera?`)) { onArchivar(selected.clienteId, selected.client); setSel(null) } }}>
            <Trash2 size={12}/> Archivar
          </button>
        </div>
        {cl.length > 0 && (
          <div className="pn-panel">
            <div className="pn-panel-header"><span className="pn-panel-title"><DollarSign size={14}/> Historial de préstamos</span></div>
            <div className="table-scroll">
              <table className="pn-table">
                <thead><tr><th>REFERENCIA</th><th>CAPITAL</th><th>CUOTAS</th><th>ESTADO</th><th></th></tr></thead>
                <tbody>
                  {cl.map(l => (
                    <tr key={l.id}>
                      <td className="mono pn-td-muted">{l.id}</td>
                      <td className="pn-td-money"><Money value={l.principal}/></td>
                      <td>
                        <div className="pn-progress-cell">
                          <span>{l.paid}/{l.installments}</span>
                          <div className="pn-progress-bar"><div className="pn-progress-fill" style={{ width:`${l.installments>0?(l.paid/l.installments)*100:0}%` }}/></div>
                        </div>
                      </td>
                      <td><Status status={l.status}/></td>
                      <td>
                        <button className="pn-btn-icon" title="Comprobante" onClick={() => onComprobanteDocx(l, payments.filter(p=>p.loanId===l.id), 'completo', null)}>
                          <FileSignature size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Users size={11}/> CLIENTES</div>
          <h2 className="pn-section-title">Clientes activos</h2>
          <p className="pn-section-desc">Tocá un cliente para ver su ficha.</p>
        </div>
        <motion.button className="pn-hero-btn pn-hero-btn-green" onClick={() => onNew(null)} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
          <Plus size={15}/> Nuevo préstamo
        </motion.button>
      </div>
      <div className="pn-search-bar">
        <label className="pn-searchbox"><Search size={14}/><input placeholder="Buscar cliente…" value={q} onChange={e=>setQ(e.target.value)}/></label>
      </div>
      {loading
        ? <div className="pn-client-grid">{[1,2,3,4,5,6].map(i=><div key={i} className="pn-client-card pn-client-sk"><div className="pn-sk-av"/><div className="pn-sk-ln"/><div className="pn-sk-ln pn-sk-sm"/></div>)}</div>
        : grouped.length === 0
          ? <motion.div className="pn-empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="pn-empty-icon"><Users size={28}/></div><h3>Sin clientes</h3>
              <p>Los clientes aparecen al crear un préstamo.</p>
            </motion.div>
          : <div className="pn-client-grid">
              {grouped.map((c,i) => {
                const { score, label, cls } = calcScore(c.client)
                const pendiente = payments.filter(p=>p.client===c.client&&p.status!=='Pagado').reduce((s,p)=>s+Number(p.amount),0)
                return (
                  <motion.article key={c.client} className="pn-client-card"
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:i*.05, type:'spring', stiffness:260, damping:22 }}
                    whileHover={{ y:-4 }}>
                    <div className="pn-client-card-top">
                      <div className={`pn-client-avatar pn-score-bg-${cls}`}>
                        {c.client.split(' ').map(x=>x[0]).slice(0,2).join('')}
                      </div>
                      <button className="pn-btn-icon" onClick={() => onEdit(c)} title="Editar"><Edit3 size={13}/></button>
                    </div>
                    <h3 className="pn-client-name">{c.client}</h3>
                    <p className="pn-client-meta">DNI {c.dni||'—'} · {c.phone||'—'}</p>
                    <div className="pn-score-row">
                      <span className="pn-score-number">{score}<span className="pn-score-denom">/850</span></span>
                      <span className={`pn-score-chip pn-score-${cls}`}>{label}</span>
                    </div>
                    <div className="pn-client-metrics">
                      <div><small>Capital</small><b><Money value={c.principal}/></b></div>
                      <div><small>Cuotas</small><b>{c.paid}/{c.installments}</b></div>
                    </div>
                    {pendiente>0 && <div className="pn-client-debt"><Money value={pendiente}/> pendiente</div>}
                    <div className="pn-client-actions">
                      <button className="pn-btn-outline pn-btn-sm" style={{flex:1}} onClick={()=>setSel(c)}>
                        <FileText size={12}/> Ver ficha
                      </button>
                      {c.phone && <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={13}/></a>}
                    </div>
                    <button className="pn-represtamo" onClick={() => onNew({ prefill:{ client:c.client, phone:c.phone, dni:c.dni, address:c.address, risk:c.risk } })}>
                      <RefreshCcw size={11}/> Volver a prestar
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

# ═══════════════════════════════════════════════════════════
# PRESTAMOS INICIO
# ═══════════════════════════════════════════════════════════
replace('PrestamosInicio', r"""
function PrestamosInicio({ totals = {}, loans = [], payments = [], ledger = [], monthBars = [], loading = false, go, onNew, onPay }) {
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
          <h1 className="pn-hero-title">Panel de Resumen</h1>
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
""")

# ═══════════════════════════════════════════════════════════
# VENTAS INICIO
# ═══════════════════════════════════════════════════════════
replace('VentasInicio', r"""
function VentasInicio({ ventas = [], totals = {}, loading = false, go }) {
  const totalVendido  = ventas.reduce((s,v) => s+Number(v.montoTotal),      0)
  const totalAnticipo = ventas.reduce((s,v) => s+Number(v.anticipo),        0)
  const totalFinanc   = ventas.reduce((s,v) => s+Number(v.montoFinanciado), 0)

  const kpis = [
    { label:'Total vendido',    value:totalVendido,      icon:ShoppingCart, color:'purple' },
    { label:'Anticipo cobrado', value:totalAnticipo,     icon:Check,        color:'green'  },
    { label:'Financiado activo',value:totalFinanc,       icon:Clock,        color:'amber'  },
    { label:'Caja ventas',      value:totals.caja || 0, icon:Wallet,       color:'teal'   },
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
          <h1 className="pn-hero-title">Resumen de Ventas</h1>
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
                {ventas.slice(0,6).map((v,i) => (
                  <motion.tr key={v.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.4+i*.04 }}>
                    <td className="pn-td-main">{v.client}</td>
                    <td className="mono pn-td-muted">{v.referencia}</td>
                    <td className="pn-td-money"><Money value={v.montoTotal}/></td>
                    <td className="pn-td-green"><Money value={v.anticipo}/></td>
                    <td><Status status={v.estado==='activo'?'Activo':v.estado==='pagado'?'Pagado':'Cancelado'}/></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </div>
  )
}
""")

with open(APP, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Done! Lines: {len(lines)}")
