import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './PageState'

export const homeFor = (role) => (role === 'FACULTY' ? '/faculty' : '/student')

export default function ProtectedRoute({ role, children }) {
  const { user, checking } = useAuth()
  const loc = useLocation()
  if (checking) return <Spinner label="Checking your session…" />
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />
  return children
}
