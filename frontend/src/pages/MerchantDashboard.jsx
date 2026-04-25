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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <span className="text-white font-black">P</span>
          </div>
          <span className="font-black text-zinc-900">Playto</span>
          <span className="text-zinc-300 mx-2">|</span>
          <span className="text-sm text-zinc-500">KYC Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">👤 {user.username}</span>
          <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Applications</h2>
            <Button size="sm" variant="secondary" loading={creating} onClick={createNew}>+ New</Button>
          </div>
          {submissions.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">No applications yet.</p>
          )}
          {submissions.map(s => (
            <button key={s.id} onClick={() => setActive(s)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${active?.id === s.id ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-zinc-400">#{s.id}</span>
                <Badge state={s.state} />
              </div>
              <p className="text-sm font-semibold text-zinc-800 truncate">{s.business_name || s.full_name || 'Untitled'}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1">
          <ErrorBox message={error} />
          {active ? (
            <Card className="p-6">
              <KYCForm submission={active} onSaved={handleSaved} />
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-zinc-200 bg-white text-center space-y-3">
              <p className="text-4xl">📋</p>
              <p className="font-semibold text-zinc-700">Start your KYC application</p>
              <p className="text-sm text-zinc-400">Complete verification to start collecting international payments</p>
              <Button loading={creating} onClick={createNew}>Begin KYC</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
