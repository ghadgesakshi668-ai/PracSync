import { describeEvent, eventTone, fmtTime } from '../utils/format'

const DOT = {
  danger: 'bg-rose-500', warn: 'bg-amber-500', good: 'bg-emerald-500', info: 'bg-sky-500', muted: 'bg-slate-300',
}
const TEXT = {
  danger: 'text-rose-700', warn: 'text-amber-800', good: 'text-emerald-700', info: 'text-sky-700', muted: 'text-slate-500',
}

export default function ActivityTimeline({ events, empty = 'No activity recorded yet.' }) {
  if (!events?.length) return <p className="text-sm text-slate-500 py-4">{empty}</p>
  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-3 py-1">
      {events.map((e) => {
        const tone = eventTone(e)
        return (
          <li key={e.id} className="ml-4 relative">
            <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT[tone]}`} />
            <div className="flex items-baseline gap-3">
              <span className="mono text-xs text-slate-500 tabular-nums shrink-0">{fmtTime(e.timestamp)}</span>
              <span className={`text-sm ${TEXT[tone]}`}>{describeEvent(e)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
