import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as studentApi from '../../services/student'
import { getErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useCountdown from '../../hooks/useCountdown'
import useExamMonitor from '../../hooks/useExamMonitor'
import Logo from '../../components/Logo'
import Modal from '../../components/Modal'
import { DifficultyBadge } from '../../components/Badge'
import { Spinner } from '../../components/PageState'
import { fmtClock, fmtDateTime } from '../../utils/format'

const NOTICE = {
  TAB_SWITCH: 'Tab switch recorded.',
  WINDOW_BLUR: 'Leaving the exam window was recorded.',
  COPY_ATTEMPT: 'A copy attempt was recorded.',
  PASTE_ATTEMPT: 'A paste attempt was recorded.',
}

function TimerBox({ remaining }) {
  const low = remaining != null && remaining <= 600
  const critical = remaining != null && remaining <= 120
  const tone = critical ? 'bg-rose-600 text-white' : low ? 'bg-amber-100 text-amber-900' : 'bg-ink-800 text-white'
  return (
    <div className={`rounded-xl px-4 py-2 text-center ${tone}`} role="timer" aria-live="off">
      <div className="text-[10px] uppercase tracking-wider opacity-70">Time remaining</div>
      <div className="mono text-3xl font-medium tabular-nums leading-tight">{remaining == null ? '--:--' : fmtClock(remaining)}</div>
    </div>
  )
}

export default function ExamWorkspace() {
  const { examId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [summary, setSummary] = useState(null)
  const [notice, setNotice] = useState('')
  const [text, setText] = useState('')
  const [saveState, setSaveState] = useState('saved')   // saved | dirty | saving | error
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [justSubmitted, setJustSubmitted] = useState(false)
  const fileInput = useRef(null)
  const noticeTimer = useRef(null)
  const lastExperiment = useRef(null)
  const dirty = useRef(false)
  const textRef = useRef('')
  textRef.current = text

  const load = useCallback(async () => {
    try {
      const s = await studentApi.getSession(examId)
      setSession(s)
      setSummary(s.activity_summary)
      setLoadError('')
      return s
    } catch (e) {
      if (e.response?.status === 409) { navigate('/student', { replace: true }); return null }
      setLoadError(getErrorMessage(e))
      return null
    }
  }, [examId, navigate])

  const { remaining, sync } = useCountdown(() => { load() })

  useEffect(() => {
    load().then((s) => {
      if (!s) return
      setText(s.draft_text || '')
      lastExperiment.current = { id: s.experiment.id, count: s.reassigned_count }
      sync(s.remaining_seconds)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId])

  const active = session?.state === 'IN_PROGRESS' && remaining !== 0

  const onResponse = useCallback((res) => {
    if (res.summary) setSummary(res.summary)
    sync(res.remaining_seconds)                       // re-anchor the clock to the server on every heartbeat
    if (res.state && res.state !== 'IN_PROGRESS') load()
    if (lastExperiment.current && (res.experiment_id !== lastExperiment.current.id || res.reassigned_count !== lastExperiment.current.count)) {
      load().then((s) => {
        if (s) { lastExperiment.current = { id: s.experiment.id, count: s.reassigned_count }; toast.info('Your faculty has reassigned your experiment. Please read the new instructions.') }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const onLocalEvent = useCallback((type, data) => {
    if (data?.context === 'file_dialog' || !NOTICE[type]) return
    setNotice(NOTICE[type])
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 12000)
  }, [])

  const monitor = useExamMonitor({ examId, enabled: !!active, onResponse, onLocalEvent })

  // Autosave the workspace draft (debounced).
  useEffect(() => {
    if (!active || !dirty.current) return undefined
    setSaveState('dirty')
    const t = setTimeout(async () => {
      setSaveState('saving')
      try { await studentApi.saveDraft(examId, textRef.current); dirty.current = false; setSaveState('saved') }
      catch { setSaveState('error') }
    }, 1500)
    return () => clearTimeout(t)
  }, [text, active, examId])

  const onTextChange = (e) => { dirty.current = true; setText(e.target.value) }

  const pickFile = (e) => {
    monitor.endFileDialog()
    const f = e.target.files?.[0]
    setFileError('')
    if (!f) return
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!session.allowed_extensions.includes(ext)) { setFileError(`Unsupported type. Allowed: ${session.allowed_extensions.join(', ')}`); e.target.value = ''; return }
    if (f.size > session.max_upload_mb * 1024 * 1024) { setFileError(`File is larger than ${session.max_upload_mb} MB.`); e.target.value = ''; return }
    setFile(f)
  }

  const doSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    monitor.setSubmitting(true)         // do not record anything caused by the submit itself
    try {
      await studentApi.submitExam(examId, { file, answerText: text })
      setConfirmOpen(false)
      setJustSubmitted(true)
      await load()
    } catch (e) {
      monitor.setSubmitting(false)
      setConfirmOpen(false)
      setSubmitError(getErrorMessage(e))
      if (e.response?.status === 403 || e.response?.status === 409) load()
    } finally { setSubmitting(false) }
  }

  // ----------------------------------------------------------- render ---
  if (loadError && !session) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="card card-pad max-w-md text-center">
          <p className="text-sm text-rose-700 mb-4">{loadError}</p>
          <div className="flex gap-2 justify-center"><button className="btn-primary" onClick={load}>Retry</button><Link className="btn-secondary" to="/student">Dashboard</Link></div>
        </div>
      </div>
    )
  }
  if (!session) return <Spinner label="Loading your examination…" />

  const { exam, experiment, state, submission } = session

  if (state === 'SUBMITTED') {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="card card-pad max-w-lg w-full text-center fade-up">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h1 className="text-xl font-semibold">Practical submitted successfully.</h1>
          <p className="text-sm text-slate-500 mt-2">{justSubmitted ? 'Your work has been recorded.' : 'You have already submitted this examination.'}</p>
          <dl className="mt-6 text-left text-sm bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
            <div className="flex justify-between px-4 py-2.5"><dt className="text-slate-500">Examination</dt><dd className="font-medium text-right">{exam.title}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-slate-500">Experiment</dt><dd className="font-medium text-right">{experiment.title}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-slate-500">File</dt><dd className="font-medium text-right break-all">{submission?.file_name}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-slate-500">Submitted at</dt><dd className="font-medium">{fmtDateTime(submission?.submitted_at)}</dd></div>
          </dl>
          <Link to="/student" className="btn-primary mt-6">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  if (state === 'EXPIRED' || remaining === 0) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="card card-pad max-w-lg w-full text-center fade-up">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-amber-700 text-2xl mono">0:00</div>
          <h1 className="text-xl font-semibold">Time is up</h1>
          <p className="text-sm text-slate-500 mt-2">This examination has ended and can no longer be submitted. Your autosaved work has been kept for your faculty to see.</p>
          <Link to="/student" className="btn-primary mt-6">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const savedLabel = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Could not autosave — will retry' }[saveState]

  return (
    <div className="min-h-full flex flex-col bg-canvas">
      <header className="bg-ink-900 text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-8 gap-y-3 justify-between">
          <div className="flex items-center gap-6 min-w-0">
            <Logo />
            <div className="hidden md:block border-l border-white/15 pl-6 min-w-0">
              <div className="text-[11px] text-slate-400">Practical examination</div>
              <div className="font-medium truncate">{exam.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-slate-400">Student</div>
              <div className="text-sm">{user?.name}</div>
            </div>
            <TimerBox remaining={remaining} />
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2 text-emerald-700 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />Monitoring active</span>
          <span>Tab switches: <b className="mono text-slate-800">{summary?.tab_switches ?? 0}</b></span>
          <span>Focus losses: <b className="mono text-slate-800">{summary?.window_blurs ?? 0}</b></span>
          <span>Copy / paste: <b className="mono text-slate-800">{(summary?.copy_attempts ?? 0) + (summary?.paste_attempts ?? 0)}</b></span>
          <span className="ml-auto text-slate-400 hidden md:inline">Browser activity is recorded and reviewed by faculty</span>
        </div>
      </div>

      {notice && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm" role="alert">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3">
            <span><b>{notice}</b> Please stay on this page until you submit.</span>
            <button className="text-amber-700 hover:text-amber-900 text-xs underline" onClick={() => setNotice('')}>Dismiss</button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-6 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
        <section className="card card-pad">
          <div className="text-xs font-medium text-slate-500">Your assigned experiment</div>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h1 className="text-xl font-semibold">{experiment.title}</h1>
            <DifficultyBadge difficulty={experiment.difficulty} />
          </div>
          {experiment.description && <p className="text-sm text-slate-600 mt-2">{experiment.description}</p>}
          <div className="text-xs font-semibold text-slate-500 mt-5 mb-1.5">Instructions</div>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[60vh] overflow-y-auto">{experiment.instructions}</pre>
        </section>

        <div className="space-y-5">
          <section className="card card-pad">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="workspace" className="text-sm font-semibold">Practical workspace</label>
              <span className={`text-xs ${saveState === 'error' ? 'text-rose-600' : 'text-slate-400'}`}>{savedLabel}</span>
            </div>
            <textarea
              id="workspace" value={text} onChange={onTextChange} spellCheck={false} rows={16}
              placeholder="Write your queries, code or answer here. It is autosaved and submitted together with your uploaded file."
              className="input mono !text-[13px] leading-relaxed resize-y min-h-[260px]"
            />
          </section>

          <section className="card card-pad">
            <div className="text-sm font-semibold mb-2">Upload solution</div>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileInput} type="file" className="hidden" accept={session.allowed_extensions.join(',')} onChange={pickFile} onCancel={monitor.endFileDialog} />
              <button className="btn-secondary" onClick={() => { monitor.beginFileDialog(); fileInput.current?.click() }}>Choose file</button>
              <span className="text-sm text-slate-600 break-all">{file ? file.name : 'No file selected'}</span>
              {file && <button className="btn-ghost btn-sm" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}>Remove</button>}
            </div>
            <p className="text-xs text-slate-500 mt-2">Allowed: {session.allowed_extensions.map((e) => e.replace('.', '').toUpperCase()).join(', ')} · max {session.max_upload_mb} MB. You may also submit only the workspace text.</p>
            {fileError && <p className="text-sm text-rose-600 mt-2">{fileError}</p>}
          </section>

          {submitError && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3" role="alert">{submitError}</div>}

          <button
            className="btn-primary w-full !py-3 !text-base"
            disabled={submitting || (!file && !text.trim())}
            onClick={() => { setSubmitError(''); setConfirmOpen(true) }}
          >
            Submit examination
          </button>
          {!file && !text.trim() && <p className="text-xs text-slate-500 text-center -mt-3">Add some work in the workspace or upload a file to enable submission.</p>}
        </div>
      </main>

      <Modal open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} size="sm" title="Submit examination?"
        footer={<><button className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>Keep working</button><button className="btn-primary" onClick={doSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Yes, submit'}</button></>}>
        <p className="text-sm text-slate-600 leading-relaxed">
          You can only submit once. {file ? <>Your file <b>{file.name}</b>{text.trim() ? ' and workspace text' : ''} will be sent.</> : 'Your workspace text will be sent.'} Time remaining: <b className="mono">{fmtClock(remaining)}</b>.
        </p>
      </Modal>
    </div>
  )
}
