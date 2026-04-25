import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Select, ErrorBox } from '../components/UI';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', email: '', role: 'merchant' });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.username, form.password);
      else await register({ username: form.username, password: form.password, email: form.email, role: form.role });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: '#0A0A0A', borderRight: '1px solid #1A1A1A' }}>

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Accent glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FF5C00, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-xl text-white"
              style={{ background: 'var(--brand)' }}>P</div>
            <span className="font-display font-bold text-xl" style={{ color: '#F5F5F0' }}>Playto</span>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#FF5C00' }}>KYC Platform</p>
              <h1 className="font-display font-bold leading-tight" style={{ fontSize: 48, color: '#F5F5F0', lineHeight: 1.1 }}>
                Get verified.<br />Go global.
              </h1>
            </div>
            <p className="text-base leading-relaxed max-w-xs" style={{ color: '#555550' }}>
              Complete your KYC onboarding and start collecting international payments in days, not months.
            </p>
          </div>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: '⚡', label: 'Fast Review', desc: 'Average 24hr turnaround' },
            { icon: '🔒', label: 'Secure', desc: 'Bank-grade document handling' },
            { icon: '🌍', label: 'Global Ready', desc: 'Accept payments from 180+ countries' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#141414', border: '1px solid #222' }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#F5F5F0' }}>{label}</p>
                <p className="text-xs" style={{ color: '#555550' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-white" style={{ background: 'var(--brand)' }}>P</div>
            <span className="font-display font-bold text-lg" style={{ color: '#F5F5F0' }}>Playto</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display font-bold text-2xl mb-1" style={{ color: '#F5F5F0' }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm" style={{ color: '#555550' }}>
              {mode === 'login' ? 'Sign in to your KYC portal' : 'Start your verification journey'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-8 gap-1" style={{ background: '#141414', border: '1px solid #222' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 capitalize"
                style={{
                  background: mode === m ? '#FF5C00' : 'transparent',
                  color: mode === m ? 'white' : '#666660',
                  fontFamily: 'Syne, sans-serif',
                }}>
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-4" onKeyDown={handleKey}>
            <ErrorBox message={error} />
            <Input label="Username" value={form.username} onChange={set('username')} placeholder="your_username" />
            {mode === 'register' && (
              <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
            )}
            <Input label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
            {mode === 'register' && (
              <Select label="I am a..." value={form.role} onChange={set('role')}>
                <option value="merchant">Merchant — Agency / Freelancer</option>
                <option value="reviewer">Reviewer — Playto Team</option>
              </Select>
            )}
          </div>

          <Button className="w-full mt-6" size="lg" loading={loading} onClick={handleSubmit}>
            {mode === 'login' ? 'Sign in →' : 'Create account →'}
          </Button>

          {mode === 'login' && (
            <div className="mt-6 rounded-xl p-4 space-y-2" style={{ background: '#111', border: '1px solid #222' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#444440' }}>Demo credentials</p>
              {[
                ['Reviewer', 'reviewer', 'reviewer123'],
                ['Merchant', 'merchant1', 'password123'],
              ].map(([role, user, pass]) => (
                <button key={user} onClick={() => setForm(f => ({ ...f, username: user, password: pass }))}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 text-left"
                  style={{ background: '#181818', border: '1px solid #2A2A2A' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#FF5C0044'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}>
                  <span className="text-xs font-medium" style={{ color: '#888880' }}>{role}</span>
                  <span className="text-xs font-mono" style={{ color: '#555550' }}>{user} / {pass}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}