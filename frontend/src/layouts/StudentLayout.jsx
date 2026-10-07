import { Outlet } from 'react-router-dom'
import AppShell from './AppShell'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/student', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/student/exam', label: 'My Exam', icon: 'play' },
  { to: '/student/submission', label: 'My Submission', icon: 'file' },
]

export default function StudentLayout() {
  const { user } = useAuth()
  return (
    <AppShell nav={NAV} roleLabel="Student" topbar={<span className="text-sm text-slate-600">Welcome, <b className="text-ink-900">{user?.name}</b></span>}>
      <Outlet />
    </AppShell>
  )
}
