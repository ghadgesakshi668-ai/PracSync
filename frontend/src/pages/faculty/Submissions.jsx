import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFaculty } from '../../layouts/FacultyLayout'
import usePolling from '../../hooks/usePolling'
import * as facultyApi from '../../services/faculty'
import api, { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import Badge, { SeverityBadge } from '../../components/Badge'
import { EmptyState, ErrorBanner, LiveIndicator, PageHeader, Spinner } from '../../components/PageState'
import { downloadSubmission, fmtDateTime } from '../../utils/format'

export default function Submissions() {
  const { examId } = useFaculty()
  const toast = useToast()
  const [viewing, setViewing] = useState(null)
  const { data, error, loading, updatedAt, refresh } = usePolling(() => facultyApi.getSubmissions(examId), {
    interval: 6000, enabled: !!examId, deps: [examId],
  })
  if (loading && !data) return <Spinner />
  const items = data?.items || []

  const download = async (s) => {
    try { await downloadSubmission(api, s) } catch (e) { toast.error(getErrorMessage(e, 'Download failed.')) }
  }

  return (
    <div>
      <PageHeader title="Submissions" subtitle={data?.exam?.title} actions={<LiveIndicator updatedAt={updatedAt} error={!!error} />} />
      <ErrorBanner message={error} onRetry={refresh} />
      <div className="card overflow-x-auto mt-3">
        {items.length === 0 ? <EmptyState title="No submissions yet" text="Submitted practicals will appear here as students finish." /> : (
          <table className="w-full min-w-[820px]">
            <thead><tr><th className="th">Student</th><th className="th">Experiment</th><th className="th">File name</th><th className="th">Submitted</th><th className="th">Status</th><th className="th">Anomaly</th><th className="th text-right">Actions</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="td"><Link className="font-medium text-ink-900 hover:underline" to={`/faculty/students/${s.exam_id}/${s.student_id}`}>{s.student_name}</Link><div className="text-xs text-slate-500">{s.student_email}</div></td>
                  <td className="td">{s.experiment_title}</td>
                  <td className="td mono text-xs break-all max-w-[220px]">{s.file_name}</td>
                  <td className="td text-slate-600 whitespace-nowrap">{fmtDateTime(s.submitted_at)}</td>
                  <td className="td"><Badge tone="green">Submitted</Badge></td>
                  <td className="td"><SeverityBadge severity={s.anomaly_severity} /></td>
                  <td className="td text-right whitespace-nowrap">
                    {s.answer_text && <button className="btn-ghost btn-sm" onClick={() => setViewing(s)}>View answer</button>}
                    <button className="btn-secondary btn-sm" onClick={() => download(s)}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={`${viewing?.student_name} — workspace answer`} footer={<button className="btn-secondary" onClick={() => setViewing(null)}>Close</button>}>
        <pre className="text-[13px] mono bg-slate-50 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap max-h-[60vh] overflow-auto">{viewing?.answer_text}</pre>
      </Modal>
    </div>
  )
}
