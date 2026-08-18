import React, { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Auth from './Auth.jsx'
import Planner from './Planner.jsx'

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) return (
      <div style={{ fontFamily: 'system-ui', padding: 40, maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ color: '#102C22' }}>Something went wrong loading the planner</h2>
        <p style={{ color: '#5C665C' }}>Try reloading. If it keeps happening, send this message to whoever maintains the app:</p>
        <pre style={{ background: '#F4F5F1', border: '1px solid #D6DAD0', borderRadius: 8, padding: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.err && (this.state.err.message || this.state.err))}</pre>
        <button style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#1E4B3A', color: '#fff', fontWeight: 700, cursor: 'pointer' }} onClick={() => location.reload()}>Reload</button>
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!supabase) { setReady(true); return }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user || null); setReady(true) })
  }, [])
  if (!ready) return null
  if (supabase && !user) return <Auth supa={supabase} onUser={setUser} />
  const signOut = async () => { await supabase.auth.signOut(); setUser(null) }
  return <Boundary><Planner supa={supabase} user={user} onSignOut={signOut} /></Boundary>
}
