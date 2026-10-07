import { Link } from 'react-router-dom'
import { useFaculty } from '../../layouts/FacultyLayout'
import usePolling from '../../hooks/usePolling'
import * as facultyApi from '../../services/faculty'
import StatCard from '../../components/StatCard'
import MonitorTable from '../../components/MonitorTable'
import { ErrorBanner, LiveIndicator, PageHeader, Spinner, EmptyState } from '../../components/PageState'
import { describeEvent, eventTone, fmtTime } from '../../utils/format'

const TEXT = { danger: 'text-rose-700', warn: 'text-amber-800', good: 'text-emerald-700', info: 'text-sky-700', muted: 'text-slate-500' }

export default function FacultyDashboard() {
  const { examId, exams } = useFaculty()
  const { data, error, loading, updatedAt, refresh } = usePolling(() => facultyApi.getOverview(examId), {
    interval: 5000, enabled: !!examId, deps: [examId],
  })

  if (exams.length === 0) {
    return (
      <div className="card"><EmptyState title="No examinations yet" text="Create your first examination, add experiments, and start it for students."
        action={<Link to="/faculty/exams" className="btn-primary">Create an examination</Link>} /></div>
    )
  }
  if (loading && !data) return <Spinner />
  const stats = data?.stats
  const exam = data?.exam

  return (
    <div>
      <PageHeader
        title="Faculty Dashboard"
        subtitle={exam ? <>{exam.title} · {exam.duration_minutes} min</> : null}
        actions={<LiveIndicator updatedAt={updatedAt} error={!!error} />}
      />
      <ErrorBanner message={error} onRetry={refresh} />

      {exam?.status === 'DRAFT' && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-sm px-4 py-3 flex items-center justify-between gap-3">
          <span>This examination is still a draft. Students can only see it after you start it.</span>
          <Link to="/faculty/exams" className="btn-primary btn-sm">Go to Exams</Link>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total students" value={stats.total_students} />
          <StatCard label="Active students" value={stats.active_students} tone="blue" hint={`${stats.online_students} online now`} />
          <StatCard label="Submitted" value={stats.submitted} tone="green" />
          <StatCard label="Not submitted" value={stats.not_submitted} tone="amber" hint={`${stats.not_started} not started`} />
          <StatCard label="Flagged" value={stats.flagged} tone={stats.flagged ? 'red' : 'slate'} highlight={stats.flagged > 0} hint="suspicious, awaiting review" />
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_320px] gap-5 items-start">
        <section className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Student monitoring</h2>
            <span className="text-xs text-slate-500">Click a student for details</span>
          </div>
          <MonitorTable rows={data?.students || []} examId={exam?.id} />
        </section>

        <section className="card">
          <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-semibold text-sm">Recent activity</h2></div>
          <div className="p-4 space-y-3 max-h-[560px] overflow-y-auto">
            {(data?.recent_events || []).length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
            {(data?.recent_events || []).map((e) => (
              <div key={e.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <Link to={`/faculty/students/${exam.id}/${e.student_id}`} className="font-medium text-ink-900 hover:underline">{e.student_name}</Link>
                  <span className="mono text-xs text-slate-400 tabular-nums">{fmtTime(e.timestamp)}</span>
                </div>
                <div className={`${TEXT[eventTone(e)]} text-[13px]`}>{describeEvent(e)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
