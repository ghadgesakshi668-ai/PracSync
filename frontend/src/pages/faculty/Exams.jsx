import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFaculty } from '../../layouts/FacultyLayout'
import * as facultyApi from '../../services/faculty'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { DifficultyBadge, ExamStatusBadge } from '../../components/Badge'
import { EmptyState, PageHeader, Spinner } from '../../components/PageState'
import { fmtDateTime } from '../../utils/format'

const BLANK = { title: '', description: '', duration_minutes: 60, experiment_ids: [] }

function ExamForm({ open, exam, experiments, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = !!exam
  const locked = editing && exam.status !== 'DRAFT'

  useEffect(() => {
    if (open) {
      setError('')
      setForm(exam ? { title: exam.title, description: exam.description, duration_minutes: exam.duration_minutes, experiment_ids: exam.experiment_ids } : BLANK)
    }
  }, [open, exam])

  const toggle = (id) => setForm((f) => ({
    ...f, experiment_ids: f.experiment_ids.includes(id) ? f.experiment_ids.filter((x) => x !== id) : [...f.experiment_ids, id],
  }))

  const save = async () => {
    setError('')
    if (form.title.trim().length < 3) return setError('Enter an exam title (at least 3 characters).')
    const dur = Number(form.duration_minutes)
    if (!Number.isInteger(dur) || dur < 5 || dur > 300) return setError('Duration must be a whole number between 5 and 300 minutes.')
    setBusy(true)
    try {
      const body = { ...form, duration_minutes: dur }
      const saved = editing ? await facultyApi.updateExam(exam.id, body) : await facultyApi.createExam(body)
      toast.success(editing ? 'Examination updated.' : 'Examination created.')
      onSaved(saved)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? 'Edit examination' : 'Create examination'}
      footer={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save examination'}</button></>}>
      {error && <div className="mb-4 text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2" role="alert">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ex-title">Exam title</label>
          <input id="ex-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. DBMS Practical Examination" />
        </div>
        <div>
          <label className="label" htmlFor="ex-desc">Description</label>
          <textarea id="ex-desc" rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown to students before they start" />
        </div>
        <div className="max-w-[200px]">
          <label className="label" htmlFor="ex-dur">Duration (minutes)</label>
          <input id="ex-dur" type="number" min={5} max={300} className="input" value={form.duration_minutes} disabled={locked}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          {locked && <p className="text-xs text-slate-500 mt-1">Locked once the exam has started.</p>}
        </div>
        <div>
          <div className="label">Experiments in this exam <span className="text-slate-400 font-normal">({form.experiment_ids.length} selected — one is randomly assigned to each student)</span></div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {experiments.length === 0 && <p className="p-4 text-sm text-slate-500">No experiments yet. Create some on the Experiments page.</p>}
            {experiments.map((x) => (
              <label key={x.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-[#0F7488]" checked={form.experiment_ids.includes(x.id)} onChange={() => toggle(x.id)} />
                <span className="flex-1 text-sm">{x.title}</span>
                <DifficultyBadge difficulty={x.difficulty} />
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Exams() {
  const { exams, refreshExams, setExamId } = useFaculty()
  const toast = useToast()
  const navigate = useNavigate()
  const [experiments, setExperiments] = useState([])
  const [formFor, setFormFor] = useState(undefined) // undefined=closed, null=new, exam=edit
  const [confirm, setConfirm] = useState(null)      // {type, exam}
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    facultyApi.listExperiments().then(setExperiments).catch((e) => toast.error(getErrorMessage(e))).finally(() => setLoaded(true))
    refreshExams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runConfirm = async () => {
    const { type, exam } = confirm
    setBusy(true)
    try {
      if (type === 'start') { await facultyApi.startExam(exam.id); toast.success('Examination started. Students can now begin.'); setExamId(exam.id) }
      if (type === 'end') { await facultyApi.endExam(exam.id); toast.success('Examination ended.') }
      if (type === 'delete') { await facultyApi.deleteExam(exam.id); toast.success('Examination deleted.') }
      await refreshExams()
      setConfirm(null)
    } catch (e) {
      toast.error(getErrorMessage(e))
      setConfirm(null)
    } finally { setBusy(false) }
  }

  const CONFIRM = {
    start: (e) => ({ title: 'Start examination?', label: 'Start now', danger: false, msg: `“${e.title}” will become visible to students, and each student's ${e.duration_minutes}-minute timer starts when they begin.` }),
    end: (e) => ({ title: 'End examination?', label: 'End exam', danger: true, msg: `This stops “${e.title}” for everyone. Students who have not submitted will be locked out immediately.` }),
    delete: (e) => ({ title: 'Delete examination?', label: 'Delete', danger: true, msg: `“${e.title}” and all its assignments, activity logs and submissions will be permanently removed.` }),
  }
  const c = confirm ? CONFIRM[confirm.type](confirm.exam) : null

  return (
    <div>
      <PageHeader title="Examinations" subtitle="Create exams, choose their experiments, and control when they run."
        actions={<button className="btn-primary" onClick={() => setFormFor(null)}>+ New examination</button>} />
      {!loaded ? <Spinner /> : exams.length === 0 ? (
        <div className="card"><EmptyState title="No examinations yet" text="Create an examination and select the experiments students may receive." /></div>
      ) : (
        <div className="grid gap-4">
          {exams.map((e) => (
            <div key={e.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold">{e.title}</h2>
                    <ExamStatusBadge status={e.status} />
                  </div>
                  {e.description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{e.description}</p>}
                  <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    <span><b className="text-slate-700">{e.duration_minutes}</b> min</span>
                    <span><b className="text-slate-700">{e.experiments.length}</b> experiments</span>
                    <span><b className="text-slate-700">{e.assigned_count}</b> started</span>
                    <span><b className="text-slate-700">{e.submitted_count}</b> submitted</span>
                    {e.start_time && <span>Started {fmtDateTime(e.start_time)}</span>}
                    {e.end_time && <span>Ended {fmtDateTime(e.end_time)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {e.experiments.map((x) => <span key={x.id} className="text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-1">{x.title}</span>)}
                    {e.experiments.length === 0 && <span className="text-xs text-amber-700">No experiments selected yet</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.status !== 'DRAFT' && <button className="btn-secondary btn-sm" onClick={() => { setExamId(e.id); navigate('/faculty') }}>Monitor</button>}
                  {e.status === 'ACTIVE'
                    ? <button className="btn-danger btn-sm" onClick={() => setConfirm({ type: 'end', exam: e })}>End exam</button>
                    : <button className="btn-primary btn-sm" onClick={() => setConfirm({ type: 'start', exam: e })}>{e.status === 'COMPLETED' ? 'Reopen' : 'Start exam'}</button>}
                  <button className="btn-secondary btn-sm" onClick={() => setFormFor(e)}>Edit</button>
                  <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" onClick={() => setConfirm({ type: 'delete', exam: e })} disabled={e.status === 'ACTIVE'} title={e.status === 'ACTIVE' ? 'End the exam first' : ''}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExamForm open={formFor !== undefined} exam={formFor || null} experiments={experiments}
        onClose={() => setFormFor(undefined)} onSaved={async () => { setFormFor(undefined); await refreshExams() }} />
      <ConfirmDialog open={!!confirm} title={c?.title} message={c?.msg} confirmLabel={c?.label} danger={c?.danger} busy={busy}
        onConfirm={runConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
