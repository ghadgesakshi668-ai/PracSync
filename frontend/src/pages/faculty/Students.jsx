import { useMemo, useState } from 'react'
import { useFaculty } from '../../layouts/FacultyLayout'
import usePolling from '../../hooks/usePolling'
import * as facultyApi from '../../services/faculty'
import MonitorTable from '../../components/MonitorTable'
import { ErrorBanner, LiveIndicator, PageHeader, Spinner } from '../../components/PageState'

const FILTERS = [
  ['ALL', 'All'], ['IN_PROGRESS', 'Active'], ['SUBMITTED', 'Submitted'], ['NOT_STARTED', 'Not started'], ['FLAGGED', 'Flagged'],
]

export default function Students() {
  const { examId } = useFaculty()
  const { data, error, loading, updatedAt, refresh } = usePolling(() => facultyApi.getOverview(examId), {
    interval: 5000, enabled: !!examId, deps: [examId],
  })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('ALL')

  const rows = useMemo(() => {
    let r = data?.students || []
    if (q.trim()) {
      const s = q.toLowerCase()
      r = r.filter((x) => x.name.toLowerCase().includes(s) || x.email.toLowerCase().includes(s) || (x.experiment_title || '').toLowerCase().includes(s))
    }
    if (filter === 'FLAGGED') r = r.filter((x) => x.anomaly_severity !== 'NORMAL')
    else if (filter !== 'ALL') r = r.filter((x) => x.exam_state === filter)
    return r
  }, [data, q, filter])

  if (loading && !data) return <Spinner />
  return (
    <div>
      <PageHeader title="Students" subtitle={data?.exam?.title} actions={<LiveIndicator updatedAt={updatedAt} error={!!error} />} />
      <ErrorBanner message={error} onRetry={refresh} />
      <div className="card overflow-hidden mt-3">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-slate-200">
          <input className="input !w-64" placeholder="Search name, email or experiment" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`btn btn-sm ${filter === k ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-500">{rows.length} student{rows.length === 1 ? '' : 's'}</span>
        </div>
        <MonitorTable rows={rows} examId={data?.exam?.id} emptyText="No students match your filters." />
      </div>
    </div>
  )
}
