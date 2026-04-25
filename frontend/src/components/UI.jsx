export function Badge({ state }) {
  const map = {
    draft:               { label: 'Draft',           dot: '#888880', cls: 'bg-[#1E1E1E] text-[#888880] border-[#2A2A2A]' },
    submitted:           { label: 'Submitted',        dot: '#4488FF', cls: 'bg-[#0D1829] text-[#4488FF] border-[#1A3050]' },
    under_review:        { label: 'Under Review',     dot: '#FFAA00', cls: 'bg-[#1A1400] text-[#FFAA00] border-[#2A2000]' },
    approved:            { label: 'Approved',         dot: '#00C875', cls: 'bg-[#001A0D] text-[#00C875] border-[#003020]' },
    rejected:            { label: 'Rejected',         dot: '#FF4444', cls: 'bg-[#1A0A0A] text-[#FF4444] border-[#2A1010]' },
    more_info_requested: { label: 'More Info Needed', dot: '#AA88FF', cls: 'bg-[#120D1A] text-[#AA88FF] border-[#1E1530]' },
  };
  const { label, dot, cls } = map[state] || { label: state, dot: '#888', cls: 'bg-[#1E1E1E] text-[#888]' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border tracking-wide ${cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function SLABadge({ isAtRisk }) {
  if (!isAtRisk) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#1A0A0A] text-[#FF4444] border-[#FF444433] animate-pulse-brand">
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF4444', display: 'inline-block' }} />
      SLA At Risk
    </span>
  );
}

export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <div className={`${s} rounded-full animate-spin`}
      style={{ border: '2px solid #2A2A2A', borderTopColor: 'var(--brand)' }} />
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-[#FF444422] bg-[#1A0A0A] px-4 py-3 text-sm text-[#FF6666] flex items-start gap-2.5 slide-up">
      <span style={{ marginTop: 1, flexShrink: 0 }}>✕</span>
      <span>{message}</span>
    </div>
  );
}

export function SuccessBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-[#00C87522] bg-[#001A0D] px-4 py-3 text-sm text-[#00C875] flex items-start gap-2.5 slide-up">
      <span style={{ marginTop: 1, flexShrink: 0 }}>✓</span>
      <span>{message}</span>
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-[#2A2A2A] bg-[#181818] ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', disabled, loading, onClick, type = 'button', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none active:scale-[0.98] font-display tracking-wide';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };
  const variants = {
    primary: 'bg-[#FF5C00] hover:bg-[#FF7722] text-white shadow-lg shadow-[#FF5C0033]',
    secondary: 'bg-[#222222] hover:bg-[#2A2A2A] text-[#AAAAAA] border border-[#333333] hover:border-[#444444]',
    danger: 'bg-[#FF444422] hover:bg-[#FF444433] text-[#FF6666] border border-[#FF444433]',
    success: 'bg-[#00C87522] hover:bg-[#00C87533] text-[#00C875] border border-[#00C87533]',
    ghost: 'hover:bg-[#222222] text-[#888880]',
  };
  return (
    <button type={type} disabled={disabled || loading} onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#888880] uppercase tracking-widest">{label}</label>}
      <input
        className={`w-full rounded-xl border px-4 py-3 text-sm bg-[#111111] text-[#F5F5F0] placeholder-[#444440] transition-all duration-150
          focus:outline-none focus:border-[#FF5C00] focus:bg-[#0F0F0F]
          ${error ? 'border-[#FF444444] bg-[#1A0A0A]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'}`}
        {...props}
      />
      {error && <p className="text-xs text-[#FF6666]">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#888880] uppercase tracking-widest">{label}</label>}
      <select
        className={`w-full rounded-xl border px-4 py-3 text-sm bg-[#111111] text-[#F5F5F0] transition-all duration-150
          focus:outline-none focus:border-[#FF5C00]
          ${error ? 'border-[#FF444444]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#FF6666]">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#888880] uppercase tracking-widest">{label}</label>}
      <textarea
        rows={3}
        className={`w-full rounded-xl border px-4 py-3 text-sm bg-[#111111] text-[#F5F5F0] placeholder-[#444440] transition-all duration-150 resize-none
          focus:outline-none focus:border-[#FF5C00]
          ${error ? 'border-[#FF444444]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'}`}
        {...props}
      />
      {error && <p className="text-xs text-[#FF6666]">{error}</p>}
    </div>
  );
}

export function MetricCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all duration-200 hover:border-[#3A3A3A]
      ${accent
        ? 'bg-[#1A0E00] border-[#FF5C0033]'
        : 'bg-[#181818] border-[#2A2A2A]'}`}>
      <p className="text-xs font-medium uppercase tracking-widest mb-3"
        style={{ color: accent ? '#FF7722' : '#555550' }}>{label}</p>
      <p className="text-3xl font-display font-bold"
        style={{ color: accent ? '#FF5C00' : '#F5F5F0' }}>{value ?? '—'}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: '#555550' }}>{sub}</p>}
    </div>
  );
}