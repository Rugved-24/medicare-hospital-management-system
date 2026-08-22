import { useState } from 'react'
import { Activity, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="hero-inner">
          <span className="hero-badge"><Activity size={26} strokeWidth={2.2} /></span>
          <h1>MediCare<br />Hospital Suite</h1>
          <p>Patients, appointments, records, pharmacy and billing — one secure workspace for your whole team.</p>
          <ul className="hero-points">
            <li>Role-based access control</li>
            <li>Audit-logged activity trail</li>
            <li>Real-time stock & ward tracking</li>
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your staff account</p>

          {error && <div className="alert error">{error}</div>}

          <label>Email address
            <input type="email" required autoComplete="username" placeholder="you@hospital.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label>Password
            <div className="password-wrap">
              <input type={show ? 'text' : 'password'} required autoComplete="current-password"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="eye-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>

          <div className="login-hint">
            <strong>Demo accounts</strong>
            <code>admin@hospital.com · Admin@123</code>
            <code>sarah.lin@hospital.com · Doctor@123</code>
            <code>reception@hospital.com · Front@123</code>
          </div>
        </form>
      </div>
    </div>
  )
}
