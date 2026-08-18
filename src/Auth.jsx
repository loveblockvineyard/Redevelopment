import React, { useState } from 'react'

export default function Auth({ supa, onUser }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supa.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) setErr(error.message)
    else onUser(data.user)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#E8EAE3', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #D6DAD0', borderRadius: 14, padding: '34px 36px', width: 340, boxShadow: '0 8px 30px rgba(16,44,34,.08)' }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#102C22', marginBottom: 4 }}>Vineyard Planner</div>
        <div style={{ fontSize: 13, color: '#5C665C', marginBottom: 20 }}>Sign in with your team account</div>
        <input style={inp} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={inp} placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        {err && <div style={{ color: '#8A322C', fontSize: 12.5, margin: '6px 0' }}>{err}</div>}
        <button style={btn} disabled={busy || !email || !pw} onClick={go}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </div>
    </div>
  )
}
const inp = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '0 0 10px', padding: '10px 12px', border: '1px solid #D6DAD0', borderRadius: 9, fontSize: 14 }
const btn = { width: '100%', padding: '11px 0', border: 'none', borderRadius: 9, background: '#1E4B3A', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 6 }
