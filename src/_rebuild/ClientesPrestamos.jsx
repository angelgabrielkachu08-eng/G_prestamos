function ClientesPrestamos({ loans = [], allLoans = [], receipts = [], loading = false, onNew, onEdit, onArchivar, onComprobanteDocx, payments = [] }) {
  const [q,       setQ]   = useState('')
  const [selected, setSel] = useState(null)

  const calcScore = useCallback((clientName) => {
    const cl = (allLoans.length > 0 ? allLoans : loans).filter(l => l.client === clientName)
    if (!cl.length) return { score:700, label:'Sin historial', cls:'medio' }
    const totalQ  = cl.reduce((s,l) => s + Number(l.installments||0), 0)
    const pagadas = cl.reduce((s,l) => s + Number(l.paid||0), 0)
    const enMora  = cl.some(l => l.status === 'En mora')
    const completados = cl.filter(l => l.status === 'Pagado').length
    let score = Math.round(300 + (totalQ > 0 ? pagadas/totalQ : 0)*450 + completados*20)
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
    const cl = allLoans.filter(l => l.client === selected.client)
    const pays = payments.filter(p => p.client === selected.client && p.status !== 'Pagado')
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
            <p>{selected.phone || '—'} · DNI {selected.dni || '—'}</p>
            <p className="pn-ficha-addr">{selected.address || 'Sin dirección'}</p>
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
          <div><small>Préstamos históricos</small><b>{cl.length}</b></div>
          <div><small>Cuotas pagadas</small><b>{cl.reduce((s,l)=>s+Number(l.paid||0),0)}</b></div>
        </div>
        <div className="pn-ficha-btns-row">
          <button className="pn-btn-secondary pn-btn-sm" onClick={() => onNew({ prefill:{ client:selected.client, phone:selected.phone, dni:selected.dni, address:selected.address, risk:selected.risk } })}>
            <RefreshCcw size={12}/> Volver a prestar
          </button>
          {selected.phone && (
            <a className="pn-btn-wa" href={`https://wa.me/${sanitizePhone(selected.phone)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={13}/>
            </a>
          )}
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
                          <div className="pn-progress-bar">
                            <div className="pn-progress-fill" style={{ width:`${l.installments>0?(l.paid/l.installments)*100:0}%` }}/>
                          </div>
                        </div>
                      </td>
                      <td><Status status={l.status}/></td>
                      <td>
                        <button className="pn-btn-icon" title="Comprobante"
                          onClick={() => onComprobanteDocx(l, payments.filter(p=>p.loanId===l.id), 'completo', null)}>
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
          <p className="pn-section-desc">Tocá un cliente para ver su ficha completa.</p>
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
              <div className="pn-empty-icon"><Users size={28}/></div>
              <h3>Sin clientes</h3>
              <p>Los clientes aparecen al crear un préstamo.</p>
            </motion.div>
          : <div className="pn-client-grid">
              {grouped.map((c, i) => {
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
                    {pendiente > 0 && <div className="pn-client-debt"><Money value={pendiente}/> pendiente</div>}
                    <div className="pn-client-actions">
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
