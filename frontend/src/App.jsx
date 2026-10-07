import { Link, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { homeFor } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import FacultyLayout from './layouts/FacultyLayout'
import StudentLayout from './layouts/StudentLayout'
import Login from './pages/Login'
import FacultyDashboard from './pages/faculty/Dashboard'
import Exams from './pages/faculty/Exams'
import Experiments from './pages/faculty/Experiments'
import Students from './pages/faculty/Students'
import StudentDetail from './pages/faculty/StudentDetail'
import Submissions from './pages/faculty/Submissions'
import Anomalies from './pages/faculty/Anomalies'
import StudentDashboard from './pages/student/Dashboard'
import MyExam from './pages/student/MyExam'
import MySubmission from './pages/student/MySubmission'
import ExamWorkspace from './pages/student/ExamWorkspace'

function Root() {
  const { user, checking } = useAuth()
  if (checking) return null
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
      <div className="text-5xl font-semibold mono text-slate-300">404</div>
      <p className="text-slate-600">That page does not exist.</p>
      <Link to="/" className="btn-primary">Go to my dashboard</Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />

      <Route path="/faculty" element={<ProtectedRoute role="FACULTY"><FacultyLayout /></ProtectedRoute>}>
        <Route index element={<FacultyDashboard />} />
        <Route path="exams" element={<Exams />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:examId/:studentId" element={<StudentDetail />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="anomalies" element={<Anomalies />} />
      </Route>

      <Route path="/student" element={<ProtectedRoute role="STUDENT"><StudentLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="exam" element={<MyExam />} />
        <Route path="submission" element={<MySubmission />} />
      </Route>
      <Route path="/student/exams/:examId" element={<ProtectedRoute role="STUDENT"><ExamWorkspace /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
