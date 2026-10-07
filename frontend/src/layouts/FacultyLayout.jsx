import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppShell from './AppShell'
import usePolling from '../hooks/usePolling'
import * as facultyApi from '../services/faculty'
import { ExamStatusBadge } from '../components/Badge'

const NAV = [
  { to: '/faculty', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/faculty/exams', label: 'Exams', icon: 'exams' },
  { to: '/faculty/experiments', label: 'Experiments', icon: 'flask' },
  { to: '/faculty/students', label: 'Students', icon: 'users' },
  { to: '/faculty/submissions', label: 'Submissions', icon: 'inbox' },
  { to: '/faculty/anomalies', label: 'Anomalies', icon: 'alert' },
]

const FacultyContext = createContext(null)
export const useFaculty = () => useContext(FacultyContext)

export default function FacultyLayout() {
  const { data: exams, refresh } = usePolling(() => facultyApi.listExams(), { interval: 10000 })
  const [examId, setExamId] = useState(() => {
    const v = sessionStorage.getItem('pracsync_exam')
    return v ? Number(v) : null
  })

  // Pick a sensible default (first ACTIVE exam, otherwise newest) and recover if the chosen exam was deleted.
  useEffect(() => {
    if (!exams) return
    if (exams.length === 0) { setExamId(null); return }
    if (!examId || !exams.some((e) => e.id === examId)) {
      const pick = exams.find((e) => e.status === 'ACTIVE') || exams[0]
      setExamId(pick.id)
    }
  }, [exams, examId])

  useEffect(() => {
    if (examId) sessionStorage.setItem('pracsync_exam', String(examId))
  }, [examId])

  const value = useMemo(() => ({ exams: exams || [], examId, setExamId, refreshExams: refresh }), [exams, examId, refresh])
  const current = exams?.find((e) => e.id === examId)

  const topbar = (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-xs font-medium text-slate-500">Exam</span>
      <select
        className="input !py-1.5 !w-auto max-w-[260px] sm:max-w-sm"
        value={examId ?? ''}
        onChange={(e) => setExamId(Number(e.target.value))}
        disabled={!exams?.length}
        aria-label="Select examination"
      >
        {!exams?.length && <option value="">No examinations</option>}
        {exams?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
      {current && <ExamStatusBadge status={current.status} />}
    </div>
  )

  return (
    <FacultyContext.Provider value={value}>
      <AppShell nav={NAV} roleLabel="Faculty" topbar={topbar}>
        <Outlet />
      </AppShell>
    </FacultyContext.Provider>
  )
}
