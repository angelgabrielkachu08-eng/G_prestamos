function PapeleraClientes({ papelera = [], onRestaurar }) {
  return (
    <div className="pn-section">
      <div className="pn-section-header">
        <div>
          <div className="pn-eyebrow"><Trash2 size={11}/> CLIENTES</div>
          <h2 className="pn-section-title">Papelera</h2>
          <p className="pn-section-desc">Clientes archivados. Restauralos cuando quieras.</p>
        </div>
      </div>
      {papelera.length === 0 ? (
        <motion.div className="pn-empty" initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }}>
          <div className="pn-empty-icon pn-empty-icon-green"><ArchiveRestore size={28}/></div>
          <h3>Papelera vacía</h3>
          <p>Los clientes archivados aparecen aquí con su historial intacto.</p>
        </motion.div>
      ) : (
        <div className="pn-client-grid">
          {papelera.map((c, i) => (
            <motion.div key={c.id} className="pn-client-card pn-client-card-archived"
              initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*.05, type:'spring', stiffness:260, damping:22 }}>
              <div className="pn-client-avatar pn-client-avatar-dim">
                {c.nombre_completo?.split(' ').map(x=>x[0]).slice(0,2).join('')}
              </div>
              <div className="pn-client-info">
                <h3 className="pn-client-name">{c.nombre_completo}</h3>
                <p className="pn-client-meta">{c.telefono || '—'}</p>
                <p className="pn-client-meta">Archivado {c.eliminado_at ? new Date(c.eliminado_at).toLocaleDateString('es-AR') : '—'}</p>
              </div>
              <motion.button className="pn-restore-btn"
                onClick={() => onRestaurar(c.id, c.nombre_completo)}
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
