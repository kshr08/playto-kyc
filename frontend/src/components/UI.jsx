export function Badge({ state }) {
  const map = {
    draft:                { label: 'Draft',              cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
    submitted:            { label: 'Submitted',          cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    under_review:         { label: 'Under Review',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved:             { label: 'Approved',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected:             { label: 'Rejected',           cls: 'bg-red-50 text-red-700 border-red-200' },
    more_info_requested:  { label: 'More Info Needed',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  };
  const { label, cls } = map[state] || { label: state, cls: 'bg-zinc-100 text-zinc-500' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

export function SLABadge({ isAtRisk }) {
  if (!isAtRisk) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
      ⚠ SLA At Risk
    </span>
  );
}

export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <div className={`${s} border-2 border-orange-500 border-t-transparent rounded-full animate-spin`} />
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SuccessBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', disabled, loading, onClick, type = 'button', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-500',
    secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 focus:ring-zinc-400',
    danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-500',
    ghost: 'hover:bg-zinc-100 text-zinc-600 focus:ring-zinc-400',
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-zinc-700">{label}</label>}
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-400
          ${error ? 'border-red-300 bg-red-50' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-zinc-700">{label}</label>}
      <select
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-400
          ${error ? 'border-red-300 bg-red-50' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-zinc-700">{label}</label>}
      <textarea
        rows={3}
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-400
          ${error ? 'border-red-300 bg-red-50' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function MetricCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-orange-50 border-orange-200' : 'bg-white border-zinc-200'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-orange-600' : 'text-zinc-900'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
