const ACCENT = {
  slate: 'text-ink-900', blue: 'text-sky-700', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-rose-700',
}
export default function StatCard({ label, value, hint, tone = 'slate', highlight = false }) {
  return (
    <div className={`card p-4 ${highlight ? 'ring-2 ring-rose-200 border-rose-300' : ''}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1.5 text-3xl font-semibold mono tabular-nums ${ACCENT[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
