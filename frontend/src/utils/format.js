const pad = (n) => String(n).padStart(2, '0')

export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function timeAgo(iso) {
  if (!iso) return 'never'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Human-readable text for an activity-log event. */
export function describeEvent(e) {
  const d = e.event_data || {}
  const benign = d.context === 'file_dialog' ? ' — file dialog, not scored' : ''
  switch (e.event_type) {
    case 'EXAM_START': return `Exam started${d.experiment ? ` — assigned “${d.experiment}”` : ''}`
    case 'TAB_SWITCH': return `Switched away from the exam tab${benign}`
    case 'VISIBILITY_CHANGE': return `Returned to the exam tab${d.away_seconds != null ? ` (away ${d.away_seconds}s)` : ''}${benign}`
    case 'WINDOW_BLUR': return `Exam window lost focus${benign}`
    case 'WINDOW_FOCUS': return `Exam window regained focus${benign}`
    case 'COPY_ATTEMPT': return `Copy attempt${d.action === 'cut' ? ' (cut)' : ''}`
    case 'PASTE_ATTEMPT': return `Paste attempt${d.chars != null ? ` (${d.chars} characters)` : ''}`
    case 'HEARTBEAT': return `Heartbeat${d.interactions != null ? ` — ${d.interactions} interactions` : ''}`
    case 'SUBMISSION': return `Submitted practical${d.file_name ? ` (${d.file_name})` : ''}`
    case 'EXPERIMENT_REASSIGNED': return `Experiment reassigned: ${d.from ?? '?'} → ${d.to ?? '?'}${d.by ? ` (by ${d.by})` : ''}`
    case 'LOGIN': return 'Logged in'
    default: return e.event_type
  }
}

/** Visual tone of an event: 'danger' | 'warn' | 'good' | 'info' | 'muted' */
export function eventTone(e) {
  if (e.event_data?.context === 'file_dialog') return 'muted'
  switch (e.event_type) {
    case 'TAB_SWITCH': case 'COPY_ATTEMPT': case 'PASTE_ATTEMPT': return 'danger'
    case 'WINDOW_BLUR': return 'warn'
    case 'SUBMISSION': return 'good'
    case 'EXAM_START': case 'EXPERIMENT_REASSIGNED': return 'info'
    default: return 'muted'
  }
}

export async function downloadSubmission(api, submission) {
  const res = await api.get(`/api/submissions/${submission.id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = submission.file_name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
