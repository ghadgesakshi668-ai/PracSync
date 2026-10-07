const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
}

export default function Badge({ tone = 'slate', dot = false, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const EXAM_STATE = {
  NOT_STARTED: ['slate', 'Not started'],
  IN_PROGRESS: ['blue', 'Active'],
  SUBMITTED: ['green', 'Submitted'],
  EXPIRED: ['amber', 'Time expired'],
}
export const ExamStateBadge = ({ state }) => {
  const [tone, label] = EXAM_STATE[state] || ['slate', state]
  return <Badge tone={tone} dot>{label}</Badge>
}

const SEVERITY = { NORMAL: ['green', 'Normal'], WARNING: ['amber', 'Warning'], SUSPICIOUS: ['red', 'Suspicious'] }
export const SeverityBadge = ({ severity, reviewed }) => {
  const [tone, label] = SEVERITY[severity] || ['slate', severity]
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone} dot>{label}</Badge>
      {reviewed && severity !== 'NORMAL' && <Badge tone="slate">Reviewed</Badge>}
    </span>
  )
}

const SUBMISSION = { SUBMITTED: ['green', 'Submitted'], PENDING: ['slate', 'Pending'], NOT_SUBMITTED: ['red', 'Not submitted'] }
export const SubmissionBadge = ({ status }) => {
  const [tone, label] = SUBMISSION[status] || ['slate', status]
  return <Badge tone={tone}>{label}</Badge>
}

const EXAM_STATUS = { DRAFT: ['slate', 'Draft'], ACTIVE: ['green', 'Active'], COMPLETED: ['brand', 'Completed'] }
export const ExamStatusBadge = ({ status }) => {
  const [tone, label] = EXAM_STATUS[status] || ['slate', status]
  return <Badge tone={tone} dot={status === 'ACTIVE'}>{label}</Badge>
}

const DIFF = { EASY: ['green', 'Easy'], MEDIUM: ['amber', 'Medium'], HARD: ['red', 'Hard'] }
export const DifficultyBadge = ({ difficulty }) => {
  const [tone, label] = DIFF[difficulty] || ['slate', difficulty]
  return <Badge tone={tone}>{label}</Badge>
}
