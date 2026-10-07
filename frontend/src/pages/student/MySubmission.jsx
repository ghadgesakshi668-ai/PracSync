import usePolling from '../../hooks/usePolling'
import * as studentApi from '../../services/student'
import api, { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../../components/PageState'
import { downloadSubmission, fmtDateTime } from '../../utils/format'
import Badge from '../../components/Badge'

export default function MySubmission() {
  const toast = useToast()
  const { data, error, loading, refresh } = usePolling(() => studentApi.getMySubmissions(), { interval: 15000 })
  if (loading && !data) return <Spinner />
  const download = async (s) => {
    try { await downloadSubmission(api, s) } catch (e) { toast.error(getErrorMessage(e, 'Download failed.')) }
  }
  return (
    <div>
      <PageHeader title="My Submission" subtitle="Practicals you have submitted." />
      <ErrorBanner message={error} onRetry={refresh} />
      {!data?.items.length ? (
        <div className="card"><EmptyState title="No submissions yet" text="Once you submit an examination, the confirmation appears here." /></div>
      ) : (
        <div className="grid gap-4">
          {data.items.map((s) => (
            <div key={s.id} className="card card-pad flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3"><h2 className="font-semibold">{s.exam_title}</h2><Badge tone="green" dot>Submitted</Badge></div>
                <div className="text-sm text-slate-600 mt-1">Experiment: <b>{s.experiment_title}</b></div>
                <div className="text-xs text-slate-500 mt-1">{s.file_name} · {fmtDateTime(s.submitted_at)}</div>
                <p className="text-sm text-emerald-700 mt-2">Practical submitted successfully.</p>
              </div>
              <button className="btn-secondary" onClick={() => download(s)}>Download my file</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
