import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position:'fixed', inset:0, background:'#0f1115',
          color:'#ff6080', fontFamily:'monospace',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'32px', gap:'16px', textAlign:'center'
        }}>
          <div style={{ fontSize:32 }}>💥</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#ff9a9e' }}>Error de runtime detectado</div>
          <div style={{
            background:'rgba(255,77,109,.08)', border:'1px solid rgba(255,77,109,.3)',
            borderRadius:10, padding:'16px 24px', maxWidth:700,
            fontSize:13, color:'#ffb3b3', whiteSpace:'pre-wrap', textAlign:'left'
          }}>
            {this.state.error.toString()}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop:8, padding:'8px 24px', borderRadius:8, border:'1px solid rgba(255,77,109,.4)', background:'transparent', color:'#ff9a9e', cursor:'pointer', fontSize:13 }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
