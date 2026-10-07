import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../services/api'
import { homeFor } from '../components/ProtectedRoute'
import Logo from '../components/Logo'

const DEMO = [
  { label: 'Faculty', email: 'faculty@pracsync.com' },
  { label: 'Student', email: 'student@pracsync.com' },
]

export default function Login() {
  const { user, login, checking } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const expired = new URLSearchParams(location.search).get('expired')

  if (!checking && user) return <Navigate to={homeFor(user.role)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(email, password)
      navigate(homeFor(u.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign in.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-ink-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="relative"><Logo size="lg" /></div>
        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight !text-white">Laboratory practicals, organised and transparent.</h1>
          <p className="mt-4 text-slate-300 leading-relaxed">
            Random experiment allocation, a server-enforced exam timer, browser activity monitoring and explainable
            anomaly scoring — with faculty always making the final call.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {['Each student gets one randomly assigned experiment', 'Timer is enforced by the server, not the browser', 'Every flag comes with the reasons behind it'].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400 max-w-md leading-relaxed">
          Browser-based prototype: it records tab and focus activity, but cannot control other applications on the student&apos;s computer.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo light={false} size="lg" /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Use your PracSync account to continue.</p>

          {expired && <div className="mt-4 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">Your session expired. Please sign in again.</div>}
          {error && <div className="mt-4 text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2" role="alert">{error}</div>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@college.edu" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary w-full !py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">Demo accounts — click to fill</div>
            <div className="flex gap-2">
              {DEMO.map((d) => (
                <button key={d.email} type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setEmail(d.email); setPassword('password123'); setError('') }}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2.5">Password for all demo accounts: <span className="mono">password123</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
