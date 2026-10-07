export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500 text-sm">
      <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3 flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14" /></svg>
      </div>
      <div className="font-medium text-slate-700">{title}</div>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function LiveIndicator({ updatedAt, error }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${error ? 'bg-rose-500' : 'bg-emerald-500 pulse-dot'}`} />
      {error ? 'Connection problem' : 'Live'}
      {updatedAt && !error && <span className="text-slate-400">· updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
    </span>
  )
}
