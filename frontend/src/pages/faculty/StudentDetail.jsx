import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import usePolling from '../../hooks/usePolling'
import * as facultyApi from '../../services/faculty'
import api, { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import ActivityTimeline from '../../components/ActivityTimeline'
import AnomalyPanel from '../../components/AnomalyPanel'
import { DifficultyBadge, ExamStateBadge, SubmissionBadge } from '../../components/Badge'
import { ErrorBanner, LiveIndicator, Spinner } from '../../components/PageState'
import { downloadSubmission, fmtClock, fmtDateTime, timeAgo } from '../../utils/format'

export default function StudentDetail() {
  const { examId, studentId } = useParams()
  const toast = useToast()
  const [showBeats, setShowBeats] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pick, setPick] = useState('random')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error, loading, updatedAt, refresh, setData } = usePolling(
    () => facultyApi.getStudentDetail(examId, studentId, showBeats),
    { interval: 5000, deps: [examId, studentId, showBeats] },
  )

  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBanner message={error || 'Could not load this student.'} onRetry={refresh} />

  const { student, exam, assignment, anomaly, submission } = data
  const canReassign = data.state === 'IN_PROGRESS'

  const doReview = async () => {
    setBusy(true)
    try {
      setData(await facultyApi.reviewStudent(examId, studentId, note))
      toast.success('Marked as reviewed.')
      setReviewOpen(false); setNote('')
    } catch (e) { toast.error(getErrorMessage(e)) } finally { setBusy(false) }
  }

  const doReassign = async () => {
    setBusy(true)
    try {
      setData(await facultyApi.reassignStudent(examId, studentId, pick === 'random' ? null : Number(pick)))
      toast.success('Experiment reassigned and logged.')
      setReassignOpen(false); setPick('random')
    } catch (e) { toast.error(getErrorMessage(e)) } finally { setBusy(false) }
  }

  const download = async () => {
    try { await downloadSubmission(api, submission) } catch (e) { toast.error(getErrorMessage(e, 'Download failed.')) }
  }

  return (
    <div>
      <Link to="/faculty/students" className="text-sm text-slate-500 hover:text-slate-800">← Back to students</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{student.name}</h1>
          <div className="text-sm text-slate-500 mt-0.5">{student.email} · {exam.title}</div>
        </div>
        <div className="flex items-center gap-3">
          {data.online && <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />Online now</span>}
          <LiveIndicator updatedAt={updatedAt} error={!!error} />
        </div>
      </div>
      <ErrorBanner message={error} onRetry={refresh} />

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start mt-3">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="text-sm font-semibold mb-4">Examination details</h2>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt className="text-xs text-slate-500 mb-1">Assigned experiment</dt>
                <dd className="font-medium flex items-center gap-2 flex-wrap">
                  {assignment?.experiment ? <>{assignment.experiment.title}<DifficultyBadge difficulty={assignment.experiment.difficulty} /></> : <span className="text-slate-400">Not assigned yet</span>}
                </dd>
                {assignment?.reassigned_count > 0 && <dd className="text-xs text-slate-500 mt-1">Reassigned {assignment.reassigned_count}× by faculty</dd>}</div>
              <div><dt className="text-xs text-slate-500 mb-1">Exam status</dt><dd><ExamStateBadge state={data.state} /></dd></div>
              <div><dt className="text-xs text-slate-500 mb-1">Submission status</dt><dd><SubmissionBadge status={data.submission_status} /></dd></div>
              <div><dt className="text-xs text-slate-500 mb-1">{data.state === 'IN_PROGRESS' ? 'Time remaining' : 'Started'}</dt>
                <dd className="mono">{assignment ? (data.state === 'IN_PROGRESS' ? fmtClock(assignment.remaining_seconds) : fmtDateTime(assignment.assigned_at)) : '—'}</dd></div>
              <div><dt className="text-xs text-slate-500 mb-1">Last activity</dt><dd>{timeAgo(data.last_seen)}</dd></div>
              <div><dt className="text-xs text-slate-500 mb-1">Last login</dt><dd>{data.last_login ? fmtDateTime(data.last_login) : '—'}</dd></div>
            </dl>
            {canReassign && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button className="btn-secondary btn-sm" onClick={() => setReassignOpen(true)}>Reassign experiment</button>
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="text-sm font-semibold mb-3">Submission</h2>
            {submission ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{submission.file_name}</div>
                    <div className="text-xs text-slate-500">Submitted {fmtDateTime(submission.submitted_at)}</div>
                  </div>
                  <button className="btn-primary btn-sm" onClick={download}>Download file</button>
                </div>
                {submission.answer_text && (
                  <div><div className="text-xs font-semibold text-slate-500 mb-1">Workspace answer</div>
                    <pre className="text-[13px] mono bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-64 overflow-auto">{submission.answer_text}</pre></div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">{data.state === 'EXPIRED' ? 'Time expired without a submission.' : 'Nothing submitted yet.'}</p>
                {assignment?.draft_text && (
                  <div className="mt-3"><div className="text-xs font-semibold text-slate-500 mb-1">Latest autosaved workspace draft</div>
                    <pre className="text-[13px] mono bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-64 overflow-auto">{assignment.draft_text}</pre></div>
                )}
              </>
            )}
          </section>

          <section className="card card-pad">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Activity timeline</h2>
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" className="accent-[#0F7488]" checked={showBeats} onChange={(e) => setShowBeats(e.target.checked)} />
                Show heartbeats ({data.heartbeat_count})
              </label>
            </div>
            <div className="max-h-[480px] overflow-y-auto pr-2"><ActivityTimeline events={data.timeline} /></div>
          </section>
        </div>

        <aside className="card card-pad lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold mb-4">Behavioural analysis</h2>
          <AnomalyPanel anomaly={anomaly} />
          <div className="mt-5 pt-4 border-t border-slate-100">
            {anomaly.reviewed ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <div className="font-medium">Reviewed {anomaly.reviewed_at ? fmtDateTime(anomaly.reviewed_at) : ''}</div>
                {anomaly.review_note && <div className="text-emerald-800/80 mt-0.5">“{anomaly.review_note}”</div>}
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={() => setReviewOpen(true)}>Mark as reviewed</button>
            )}
          </div>
        </aside>
      </div>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} size="sm" title="Mark as reviewed"
        footer={<><button className="btn-secondary" onClick={() => setReviewOpen(false)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={doReview} disabled={busy}>{busy ? 'Saving…' : 'Confirm review'}</button></>}>
        <p className="text-sm text-slate-600 mb-3">Confirm that you have looked at this student&apos;s activity. The flag is not a verdict — it only means the behaviour was worth a look.</p>
        <label className="label" htmlFor="rv-note">Note (optional)</label>
        <textarea id="rv-note" rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Student confirmed they looked up syntax; no concern." />
      </Modal>

      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign experiment"
        footer={<><button className="btn-secondary" onClick={() => setReassignOpen(false)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={doReassign} disabled={busy}>{busy ? 'Reassigning…' : 'Reassign'}</button></>}>
        <p className="text-sm text-slate-600 mb-3">The student keeps their remaining time. The change is logged in their activity timeline and their screen updates automatically.</p>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="pick" className="accent-[#0F7488]" checked={pick === 'random'} onChange={() => setPick('random')} />
            <span className="text-sm">Pick another experiment at random</span>
          </label>
          {data.reassign_options.map((o) => {
            const current = o.id === assignment?.experiment?.id
            return (
              <label key={o.id} className={`flex items-center gap-3 px-3 py-2.5 ${current ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input type="radio" name="pick" className="accent-[#0F7488]" disabled={current} checked={pick === String(o.id)} onChange={() => setPick(String(o.id))} />
                <span className="text-sm flex-1">{o.title}</span>{current && <span className="text-xs text-slate-500">current</span>}
              </label>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
