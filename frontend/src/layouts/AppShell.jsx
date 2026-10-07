import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

const ICONS = {
  dashboard: 'M3 3h7v7H3zM12 3h7v4h-7zM12 9h7v8h-7zM3 12h7v5H3z',
  exams: 'M5 3h10a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM7 7h6M7 10h6M7 13h3',
  flask: 'M8 3h4M9 3v5l-4.5 8a1 1 0 00.9 1.5h9.2a1 1 0 00.9-1.5L11 8V3M7 13h6',
  users: 'M7 9a3 3 0 100-6 3 3 0 000 6zM1.5 17a5.5 5.5 0 0111 0M14 4.5a2.5 2.5 0 010 5M15 12a4.5 4.5 0 014 5',
  inbox: 'M3 12l2-7h10l2 7M3 12v4h14v-4M3 12h4l1 2h4l1-2h4',
  alert: 'M10 3l8 14H2zM10 8v4M10 14.5v.01',
  file: 'M6 3h6l4 4v10H6zM12 3v4h4',
  play: 'M6 4l10 6-10 6z',
}

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

export default function AppShell({ nav, roleLabel, topbar, children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const doLogout = () => { logout(); navigate('/login', { replace: true }) }

  const sidebar = (
    <aside className="w-60 shrink-0 bg-ink-900 text-slate-300 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10"><Logo /></div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`
            }
          >
            <Icon name={n.icon} />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-sm text-white font-medium truncate">{user?.name}</div>
        <div className="text-xs text-slate-400 mb-3">{roleLabel}</div>
        <button onClick={doLogout} className="w-full btn bg-white/10 text-white hover:bg-white/20 text-xs">Log out</button>
      </div>
    </aside>
  )

  return (
    <div className="h-full flex">
      <div className="hidden lg:block h-full sticky top-0">{sidebar}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="h-full">{sidebar}</div>
          <div className="flex-1 bg-ink-950/50" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto">
        <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center gap-3">
          <button className="lg:hidden btn-ghost p-1.5" onClick={() => setOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
          </button>
          <div className="flex-1 min-w-0">{topbar}</div>
        </header>
        <main className="px-4 sm:px-8 py-6 max-w-[1280px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
