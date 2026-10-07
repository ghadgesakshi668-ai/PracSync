import { useNavigate } from 'react-router-dom'
import { ExamStateBadge, SeverityBadge, SubmissionBadge } from './Badge'
import { timeAgo } from '../utils/format'

export default function MonitorTable({ rows, examId, emptyText = 'No students found.' }) {
  const nav = useNavigate()
  if (!rows.length) return <p className="text-sm text-slate-500 text-center py-10">{emptyText}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <th className="th">Student</th>
            <th className="th">Experiment</th>
            <th className="th">Exam status</th>
            <th className="th">Anomaly status</th>
            <th className="th">Submission</th>
            <th className="th">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.student_id}
              tabIndex={0}
              onClick={() => nav(`/faculty/students/${examId}/${r.student_id}`)}
              onKeyDown={(e) => e.key === 'Enter' && nav(`/faculty/students/${examId}/${r.student_id}`)}
              className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50/60 focus:outline-none"
            >
              <td className="td">
                <div className="font-medium text-ink-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.email}</div>
              </td>
              <td className="td text-slate-700">{r.experiment_title || <span className="text-slate-400">—</span>}</td>
              <td className="td"><ExamStateBadge state={r.exam_state} /></td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={r.anomaly_severity} reviewed={r.anomaly_reviewed} />
                  {r.anomaly_score > 0 && <span className="mono text-xs text-slate-500 tabular-nums">{r.anomaly_score}</span>}
                </div>
              </td>
              <td className="td"><SubmissionBadge status={r.submission_status} /></td>
              <td className="td text-xs text-slate-500 whitespace-nowrap">
                {r.online ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />Online</span>
                ) : (
                  timeAgo(r.last_seen)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
