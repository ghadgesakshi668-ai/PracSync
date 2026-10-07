import { useEffect, useState } from 'react'
import * as facultyApi from '../../services/faculty'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { DifficultyBadge } from '../../components/Badge'
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../../components/PageState'

const BLANK = { title: '', description: '', instructions: '', difficulty: 'MEDIUM' }

export default function Experiments() {
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(undefined)   // undefined closed | null new | experiment
  const [formError, setFormError] = useState('')
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => facultyApi.listExperiments().then((d) => { setItems(d); setError('') }).catch((e) => setError(getErrorMessage(e)))
  useEffect(() => { load() }, [])

  const openForm = (exp) => {
    setFormError('')
    setForm(exp ? { title: exp.title, description: exp.description, instructions: exp.instructions, difficulty: exp.difficulty } : BLANK)
    setEditing(exp)
  }

  const save = async () => {
    setFormError('')
    if (form.title.trim().length < 3) return setFormError('Enter a title (at least 3 characters).')
    if (!form.instructions.trim()) return setFormError('Add instructions so students know what to do.')
    setBusy(true)
    try {
      if (editing) await facultyApi.updateExperiment(editing.id, form)
      else await facultyApi.createExperiment(form)
      toast.success(editing ? 'Experiment updated.' : 'Experiment created.')
      setEditing(undefined)
      load()
    } catch (e) { setFormError(getErrorMessage(e)) } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try { await facultyApi.deleteExperiment(deleting.id); toast.success('Experiment deleted.'); load() }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setBusy(false); setDeleting(null) }
  }

  return (
    <div>
      <PageHeader title="Experiments" subtitle="The question bank. Add experiments to an exam and PracSync assigns one at random to each student."
        actions={<button className="btn-primary" onClick={() => openForm(null)}>+ New experiment</button>} />
      <ErrorBanner message={error} onRetry={load} />
      {!items ? <Spinner /> : items.length === 0 ? (
        <div className="card"><EmptyState title="No experiments" text="Create your first experiment." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Title</th><th className="th">Description</th><th className="th">Difficulty</th><th className="th">Used in</th><th className="th text-right">Actions</th></tr></thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-ink-900">
                    <button className="text-left hover:underline" onClick={() => setViewing(x)}>{x.title}</button>
                  </td>
                  <td className="td text-slate-600 max-w-md"><span className="line-clamp-2">{x.description}</span></td>
                  <td className="td"><DifficultyBadge difficulty={x.difficulty} /></td>
                  <td className="td text-xs text-slate-500">{x.exams_count} exam{x.exams_count === 1 ? '' : 's'} · {x.assigned_count} assigned</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setViewing(x)}>View</button>
                    <button className="btn-ghost btn-sm" onClick={() => openForm(x)}>Edit</button>
                    <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(x)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} size="lg" title={editing ? 'Edit experiment' : 'New experiment'}
        footer={<><button className="btn-secondary" onClick={() => setEditing(undefined)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save experiment'}</button></>}>
        {formError && <div className="mb-4 text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2" role="alert">{formError}</div>}
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_160px] gap-4">
            <div><label className="label" htmlFor="xp-title">Title</label><input id="xp-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label" htmlFor="xp-diff">Difficulty</label>
              <select id="xp-diff" className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
              </select></div>
          </div>
          <div><label className="label" htmlFor="xp-desc">Description</label><textarea id="xp-desc" rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label" htmlFor="xp-ins">Instructions (shown to the student)</label><textarea id="xp-ins" rows={8} className="input mono !text-[13px]" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={viewing?.title}
        footer={<button className="btn-secondary" onClick={() => setViewing(null)}>Close</button>}>
        {viewing && <>
          <div className="mb-3"><DifficultyBadge difficulty={viewing.difficulty} /></div>
          <p className="text-sm text-slate-600 mb-4">{viewing.description}</p>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Instructions</div>
          <pre className="whitespace-pre-wrap text-sm bg-slate-50 border border-slate-200 rounded-lg p-4 font-sans leading-relaxed">{viewing.instructions}</pre>
        </>}
      </Modal>

      <ConfirmDialog open={!!deleting} danger title="Delete experiment?" confirmLabel="Delete" busy={busy}
        message={`“${deleting?.title}” will be removed from the question bank and from any exam that uses it. Experiments already assigned to students cannot be deleted.`}
        onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
