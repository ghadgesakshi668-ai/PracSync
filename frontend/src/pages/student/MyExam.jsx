import { Navigate, useNavigate } from 'react-router-dom'
import usePolling from '../../hooks/usePolling'
import * as studentApi from '../../services/student'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../../components/PageState'
import { ExamCard } from './Dashboard'

export default function MyExam() {
  const navigate = useNavigate()
  const toast = useToast()
  const start = async (card) => {
    try { await studentApi.startExam(card.exam.id); navigate(`/student/exams/${card.exam.id}`) }
    catch (e) { toast.error(getErrorMessage(e)); refresh() }
  }
  const { data, error, loading, refresh } = usePolling(() => studentApi.getDashboard(), { interval: 8000 })
  if (loading && !data) return <Spinner />
  const inProgress = data?.exams.find((c) => c.state === 'IN_PROGRESS')
  if (inProgress) return <Navigate to={`/student/exams/${inProgress.exam.id}`} replace />
  return (
    <div>
      <PageHeader title="My Exam" subtitle="You have no examination in progress." />
      <ErrorBanner message={error} onRetry={refresh} />
      {data?.exams.length ? (
        <div className="grid gap-4">{data.exams.map((c) => <ExamCard key={c.exam.id} card={c} onStart={start} />)}</div>
      ) : (
        <div className="card"><EmptyState title="Nothing to do right now" text="When your faculty starts an examination it will appear here." /></div>
      )}
    </div>
  )
}
