import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Select, ErrorBox } from '../components/UI';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', email: '', role: 'merchant' });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await register({ username: form.username, password: form.password, email: form.email, role: form.role });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <span className="text-white font-black text-lg">P</span>
          </div>
          <span className="text-2xl font-black tracking-tight text-zinc-900">Playto</span>
        </div>
        <p className="text-sm text-zinc-500">International Payments for Indian Creators</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 space-y-6">
        {/* Tabs */}
        <div className="flex rounded-lg bg-zinc-100 p-1 gap-1">
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition capitalize
                ${mode === m ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <ErrorBox message={error} />
          <Input label="Username" value={form.username} onChange={set('username')} placeholder="your_username" />
          {mode === 'register' && (
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          )}
          <Input label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
          {mode === 'register' && (
            <Select label="I am a..." value={form.role} onChange={set('role')}>
              <option value="merchant">Merchant (Agency / Freelancer)</option>
              <option value="reviewer">Reviewer (Playto Team)</option>
            </Select>
          )}
        </div>

        <Button className="w-full" loading={loading} onClick={handleSubmit}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>

        {mode === 'login' && (
          <div className="text-xs text-zinc-400 text-center space-y-1">
            <p>Demo: <code>reviewer / reviewer123</code></p>
            <p>Demo: <code>merchant1 / password123</code></p>
          </div>
        )}
      </div>
    </div>
  );
}
