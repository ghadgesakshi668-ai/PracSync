export default function Logo({ light = true, size = 'md' }) {
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <div className="flex items-center gap-2.5">
      <svg className={box} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? '#12293F' : '#0C1D2E'} />
        <path d="M9 22V10h7a4 4 0 010 8h-3" fill="none" stroke="#3FA6B8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="22" r="2" fill="#3FA6B8" />
      </svg>
      <span className={`font-semibold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-lg'} ${light ? 'text-white' : 'text-ink-900'}`}>PracSync</span>
    </div>
  )
}
