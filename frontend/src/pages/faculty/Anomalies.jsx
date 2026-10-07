import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFaculty } from '../../layouts/FacultyLayout'
import usePolling from '../../hooks/usePolling'
import * as facultyApi from '../../services/faculty'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { ExamStateBadge, SeverityBadge } from '../../components/Badge'
import { EmptyState, ErrorBanner, LiveIndicator, PageHeader, Spinner } from '../../components/PageState'

export default function Anomalies() {
  const { examId } = useFaculty()
  const toast = useToast()
  const [filter, setFilter] = useState('FLAGGED')
  const [busyId, setBusyId] = useState(null)
  const { data, error, loading, updatedAt, refresh } = usePolling(() => facultyApi.getAnomalies(examId), {
    interval: 5000, enabled: !!examId, deps: [examId],
  })
  if (loading && !data) return <Spinner />
  const all = data?.items || []
  const items = all.filter((a) => {
    if (filter === 'FLAGGED') return a.severity !== 'NORMAL'
    if (filter === 'PENDING') return a.severity !== 'NORMAL' && !a.reviewed
    return true
  })

  const review = async (a) => {
    setBusyId(a.student_id)
    try { await facultyApi.reviewStudent(data.exam.id, a.student_id); toast.success(`${a.student_name} marked as reviewed.`); refresh() }
    catch (e) { toast.error(getErrorMessage(e)) } finally { setBusyId(null) }
  }

  return (
    <div>
      <PageHeader title="Anomalies" subtitle="Behavioural flags that need a human decision. A flag is not proof of misconduct."
        actions={<LiveIndicator updatedAt={updatedAt} error={!!error} />} />
      <ErrorBanner message={error} onRetry={refresh} />
      <div className="flex gap-1.5 my-3">
        {[['FLAGGED', 'Warning & suspicious'], ['PENDING', 'Awaiting review'], ['ALL', 'All students with activity']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="card"><EmptyState title="Nothing to review" text="No students match this filter right now." /></div>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.student_id} className="card card-pad flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1" style={{ minWidth: 260 }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link className="font-semibold text-ink-900 hover:underline" to={`/faculty/students/${data.exam.id}/${a.student_id}`}>{a.student_name}</Link>
                  <SeverityBadge severity={a.severity} reviewed={a.reviewed} />
                  <ExamStateBadge state={a.exam_state} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{a.experiment_title}</div>
                <ul className="mt-2.5 space-y-1">
                  {a.reasons.map((r) => <li key={r.code} className="text-sm text-slate-700 flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-slate-400 shrink-0" />{r.text}</li>)}
                  {a.reasons.length === 0 && <li className="text-sm text-slate-500">No unusual behaviour.</li>}
                </ul>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><div className="mono text-3xl font-semibold tabular-nums">{a.score}<span className="text-base text-slate-400">/100</span></div></div>
                <div className="flex flex-col gap-1.5">
                  <Link className="btn-secondary btn-sm" to={`/faculty/students/${data.exam.id}/${a.student_id}`}>Open</Link>
                  {!a.reviewed && <button className="btn-primary btn-sm" disabled={busyId === a.student_id} onClick={() => review(a)}>Mark reviewed</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
