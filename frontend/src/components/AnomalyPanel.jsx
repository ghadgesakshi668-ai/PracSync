import { SeverityBadge } from './Badge'

const BAR = { NORMAL: 'bg-emerald-500', WARNING: 'bg-amber-500', SUSPICIOUS: 'bg-rose-500' }

export default function AnomalyPanel({ anomaly }) {
  const { score, severity, reasons, disclaimer } = anomaly
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">Anomaly score</div>
          <div className="mono text-4xl font-semibold text-ink-900 tabular-nums">
            {score}<span className="text-lg text-slate-400">/100</span>
          </div>
        </div>
        <SeverityBadge severity={severity} reviewed={anomaly.reviewed} />
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${BAR[severity]}`} style={{ width: `${score}%` }} />
        <span className="absolute top-0 bottom-0 w-px bg-slate-400/60" style={{ left: '30%' }} />
        <span className="absolute top-0 bottom-0 w-px bg-slate-400/60" style={{ left: '60%' }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 mono"><span>0</span><span className="ml-[22%]">30</span><span className="ml-[22%]">60</span><span>100</span></div>

      <div className="mt-4">
        <div className="text-xs font-medium text-slate-500 mb-1.5">Reasons</div>
        {reasons.length === 0 ? (
          <p className="text-sm text-slate-500">No unusual behaviour detected.</p>
        ) : (
          <ul className="space-y-1.5">
            {reasons.map((r) => (
              <li key={r.code} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />{r.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">{disclaimer}</p>
    </div>
  )
}
