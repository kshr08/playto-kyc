import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import KYCForm from '../components/KYCForm';
import { Badge, Spinner, Card, Button, ErrorBox } from '../components/UI';

export default function MerchantDashboard() {
  const { user, logout } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchSubmissions(); }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await api.listSubmissions();
      setSubmissions(res.data);
      if (res.data.length > 0 && !active) setActive(res.data[0]);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const createNew = async () => {
    setCreating(true); setError('');
    try {
      const res = await api.createSubmission();
      await fetchSubmissions();
      setActive(res.data);
    } catch (e) { setError(e.message); }
    finally { setCreating(false); }
  };

  const handleSaved = async (updated) => {
    setActive(updated);
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="text-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm" style={{ color: '#555550' }}>Loading your applications...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <header style={{ background: '#0F0F0F', borderBottom: '1px solid #1E1E1E' }}
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-white text-sm"
            style={{ background: 'var(--brand)' }}>P</div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold" style={{ color: '#F5F5F0' }}>Playto</span>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span className="text-sm" style={{ color: '#555550' }}>KYC Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: '#181818', border: '1px solid #2A2A2A' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: '#FF5C0022', color: '#FF5C00' }}>
              {user.username[0].toUpperCase()}
            </div>
            <span className="text-sm" style={{ color: '#888880' }}>{user.username}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: '#444440' }}>Applications</p>
            <Button size="sm" variant="secondary" loading={creating} onClick={createNew}>+ New</Button>
          </div>

          {submissions.length === 0 && (
            <div className="text-center py-10 rounded-2xl" style={{ border: '1px dashed #2A2A2A' }}>
              <p className="text-sm" style={{ color: '#444440' }}>No applications yet</p>
            </div>
          )}

          {submissions.map(s => (
            <button key={s.id} onClick={() => setActive(s)}
              className="w-full text-left rounded-2xl p-4 transition-all duration-150 group"
              style={{
                background: active?.id === s.id ? '#1A0E00' : '#141414',
                border: `1px solid ${active?.id === s.id ? '#FF5C0044' : '#222222'}`,
              }}
              onMouseEnter={e => { if (active?.id !== s.id) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.background = '#181818'; }}}
              onMouseLeave={e => { if (active?.id !== s.id) { e.currentTarget.style.borderColor = '#222222'; e.currentTarget.style.background = '#141414'; }}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono" style={{ color: '#444440' }}>#{s.id}</span>
                <Badge state={s.state} />
              </div>
              <p className="text-sm font-medium truncate mb-1" style={{ color: '#F5F5F0' }}>
                {s.business_name || s.full_name || 'Untitled Application'}
              </p>
              <p className="text-xs" style={{ color: '#444440' }}>{new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <ErrorBox message={error} />
          {active ? (
            <div className="rounded-2xl p-8" style={{ background: '#141414', border: '1px solid #222222' }}>
              <KYCForm submission={active} onSaved={handleSaved} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 rounded-2xl text-center space-y-5"
              style={{ border: '1px dashed #2A2A2A' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: '#181818', border: '1px solid #2A2A2A' }}>📋</div>
              <div>
                <p className="font-display font-bold text-lg mb-1" style={{ color: '#F5F5F0' }}>Start your KYC</p>
                <p className="text-sm" style={{ color: '#555550' }}>Complete verification to collect international payments</p>
              </div>
              <Button loading={creating} onClick={createNew} size="lg">Begin KYC →</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}