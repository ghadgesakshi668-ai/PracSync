import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import usePolling from '../../hooks/usePolling'
import * as studentApi from '../../services/student'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { ExamStateBadge, ExamStatusBadge } from '../../components/Badge'
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../../components/PageState'
import ConfirmDialog from '../../components/ConfirmDialog'
import { fmtClock } from '../../utils/format'

export function ExamCard({ card, onStart }) {
  const { exam, state, experiment, submission } = card
  const navigate = useNavigate()
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1" style={{ minWidth: 240 }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">{exam.title}</h2>
            <ExamStatusBadge status={exam.status} />
          </div>
          {exam.description && <p className="text-sm text-slate-500 mt-1.5 max-w-xl">{exam.description}</p>}
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Duration</dt><dd className="font-medium mono">{exam.duration_minutes} min</dd></div>
            <div><dt className="text-xs text-slate-500">Your status</dt><dd className="mt-0.5"><ExamStateBadge state={state} /></dd></div>
            <div><dt className="text-xs text-slate-500">Assigned experiment</dt><dd className="font-medium">{experiment ? experiment.title : <span className="text-slate-400 font-normal">Assigned when you start</span>}</dd></div>
            <div><dt className="text-xs text-slate-500">Submission</dt><dd className="font-medium">{submission ? <span className="text-emerald-700">Submitted</span> : <span className="text-slate-400 font-normal">{state === 'EXPIRED' ? 'Not submitted' : 'Pending'}</span>}</dd></div>
          </dl>
          {state === 'IN_PROGRESS' && card.remaining_seconds != null && (
            <div className="mt-4 text-sm text-slate-600">Time remaining: <span className="mono font-semibold text-ink-900">{fmtClock(card.remaining_seconds)}</span></div>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {card.can_start && <button className="btn-primary !py-2.5 !px-5" onClick={() => onStart(card)}>Start exam</button>}
          {state === 'IN_PROGRESS' && <button className="btn-primary !py-2.5 !px-5" onClick={() => navigate(`/student/exams/${exam.id}`)}>Continue exam</button>}
          {(state === 'SUBMITTED' || state === 'EXPIRED') && <button className="btn-secondary" onClick={() => navigate(`/student/exams/${exam.id}`)}>View</button>}
          {!card.can_start && state === 'NOT_STARTED' && <span className="text-xs text-slate-500">Not available right now</span>}
        </div>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, error, loading, refresh } = usePolling(() => studentApi.getDashboard(), { interval: 8000 })

  const start = async () => {
    setBusy(true)
    try {
      await studentApi.startExam(confirm.exam.id)
      navigate(`/student/exams/${confirm.exam.id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
      setConfirm(null); refresh()
    } finally { setBusy(false) }
  }

  if (loading && !data) return <Spinner />
  return (
    <div>
      <PageHeader title="My Dashboard" subtitle="Your available examinations and their status." />
      <ErrorBanner message={error} onRetry={refresh} />
      {data && data.exams.length === 0 ? (
        <div className="card"><EmptyState title="No examination available" text="Your faculty has not started an examination yet. This page refreshes automatically." /></div>
      ) : (
        <div className="grid gap-4 mt-3">{data?.exams.map((c) => <ExamCard key={c.exam.id} card={c} onStart={setConfirm} />)}</div>
      )}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 leading-relaxed">
        <b className="text-slate-700">Before you start:</b> this platform records tab switches, window focus changes, copy/paste events and submission timing
        during the exam. Flags are reviewed by faculty and are not an automatic accusation.{' '}
        <Link to="/student/submission" className="text-brand-700 hover:underline">View my submissions</Link>
      </div>

      <ConfirmDialog open={!!confirm} title="Start examination?" confirmLabel="Start now" busy={busy} onCancel={() => setConfirm(null)} onConfirm={start}
        message={`Your ${confirm?.exam.duration_minutes}-minute timer begins immediately and an experiment is assigned to you at random. Stay on the exam page — switching tabs or windows is recorded.`} />
    </div>
  )
}
