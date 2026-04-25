import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Badge, SLABadge, Spinner, Button, Card, MetricCard, ErrorBox, Textarea } from '../components/UI';

const STATE_TABS = [
  { label: 'Queue', value: null, desc: 'submitted + under_review + more_info' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function ReviewerDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => { fetchQueue(); fetchMetrics(); }, [tab]);

  const fetchQueue = async () => {
    setLoading(true);
    try { const res = await api.getQueue(tab); setQueue(res.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchMetrics = async () => {
    try { const res = await api.getDashboard(); setMetrics(res.data); } catch {}
  };

  const selectSubmission = async (sub) => {
    setSelected(sub);
    setDetail(null);
    setNote('');
    setActionError('');
    setDetailLoading(true);
    try {
      const res = await api.getReviewerSubmission(sub.id);
      setDetail(res.data);
    } catch (e) { setActionError(e.message); }
    finally { setDetailLoading(false); }
  };

  const doTransition = async (newState) => {
    if (!detail) return;
    if (['rejected', 'more_info_requested'].includes(newState) && !note.trim()) {
      setActionError('Please add a note before proceeding.'); return;
    }
    setTransitioning(true); setActionError('');
    try {
      const res = await api.transitionSubmission(detail.id, { new_state: newState, note });
      setDetail(res.data);
      setQueue(q => q.map(s => s.id === res.data.id ? { ...s, state: res.data.state } : s));
      fetchMetrics();
      setNote('');
    } catch (e) { setActionError(e.message); }
    finally { setTransitioning(false); }
  };

  const renderActions = () => {
    if (!detail) return null;
    const state = detail.state;
    return (
      <div className="space-y-3">
        <Textarea label="Reviewer Note" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Add context for the merchant or your team…" />
        <ErrorBox message={actionError} />
        <div className="flex flex-wrap gap-2">
          {state === 'submitted' && (
            <Button variant="secondary" loading={transitioning} onClick={() => doTransition('under_review')}>
              Start Review
            </Button>
          )}
          {state === 'under_review' && (
            <>
              <Button variant="success" loading={transitioning} onClick={() => doTransition('approved')}>✓ Approve</Button>
              <Button variant="secondary" loading={transitioning} onClick={() => doTransition('more_info_requested')}>⟳ Request Info</Button>
              <Button variant="danger" loading={transitioning} onClick={() => doTransition('rejected')}>✗ Reject</Button>
            </>
          )}
          {state === 'more_info_requested' && (
            <p className="text-sm text-zinc-400 italic">Waiting for merchant to resubmit.</p>
          )}
          {['approved', 'rejected'].includes(state) && (
            <p className="text-sm text-zinc-400 italic">This submission is in a terminal state.</p>
          )}
        </div>
      </div>
    );
  };

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
          <span className="text-sm text-zinc-500">Reviewer Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">🔍 {user.username}</span>
          <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="In Queue" value={metrics.queue.total_in_queue} accent />
            <MetricCard label="SLA At Risk" value={metrics.queue.at_risk_count}
              sub="Submitted >24hrs ago" />
            <MetricCard label="Approval Rate" value={metrics.last_7_days.approval_rate_pct != null ? `${metrics.last_7_days.approval_rate_pct}%` : null}
              sub="Last 7 days" />
            <MetricCard label="Avg Queue Time"
              value={metrics.sla.average_time_in_queue_minutes != null ? `${Math.round(metrics.sla.average_time_in_queue_minutes / 60)}h` : null}
              sub="Last 7 days" />
          </div>
        )}

        <div className="flex gap-6">
          {/* Queue list */}
          <div className="w-80 shrink-0 space-y-3">
            {/* Tabs */}
            <div className="flex overflow-x-auto gap-1 pb-1">
              {STATE_TABS.map(t => (
                <button key={String(t.value)} onClick={() => { setTab(t.value); setSelected(null); setDetail(null); }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                    ${tab === t.value ? 'bg-orange-500 text-white' : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <ErrorBox message={error} />

            {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
              queue.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">No submissions here.</div>
              ) : queue.map(s => (
                <button key={s.id} onClick={() => selectSubmission(s)}
                  className={`w-full text-left rounded-xl border p-3 transition
                    ${selected?.id === s.id ? 'border-orange-300 bg-orange-50' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs text-zinc-400 font-mono">#{s.id}</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge state={s.state} />
                      {s.is_at_risk && <SLABadge isAtRisk />}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 truncate">{s.business_name || '—'}</p>
                  <p className="text-xs text-zinc-400 truncate">{s.merchant_username}</p>
                  {s.submitted_at && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {s.time_in_queue_minutes != null ? `${Math.round(s.time_in_queue_minutes / 60)}h in queue` : ''}
                    </p>
                  )}
                </button>
              ))
            }
          </div>

          {/* Detail panel */}
          <div className="flex-1">
            {!detail && !detailLoading && (
              <div className="flex items-center justify-center h-64 rounded-2xl border-2 border-dashed border-zinc-200 bg-white text-center">
                <p className="text-zinc-400 text-sm">Select a submission to review</p>
              </div>
            )}
            {detailLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
            {detail && !detailLoading && (
              <Card className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-black text-zinc-900">{detail.business_name || 'Unnamed Business'}</h2>
                      <Badge state={detail.state} />
                      <SLABadge isAtRisk={detail.is_at_risk} />
                    </div>
                    <p className="text-sm text-zinc-500">Submitted by <span className="font-semibold">{detail.merchant_username}</span></p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">#{detail.id}</span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Full Name', detail.full_name],
                    ['Email', detail.email],
                    ['Phone', detail.phone],
                    ['Business Type', detail.business_type?.replace(/_/g, ' ')],
                    ['Monthly Volume', detail.expected_monthly_volume_usd ? `$${Number(detail.expected_monthly_volume_usd).toLocaleString()}` : null],
                    ['Submitted', detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : null],
                    ['Time in Queue', detail.time_in_queue_minutes != null ? `${Math.round(detail.time_in_queue_minutes / 60)}h ${detail.time_in_queue_minutes % 60}m` : null],
                    ['Reviewer', detail.reviewer_username || null],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-zinc-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-zinc-400">{k}</p>
                      <p className="font-semibold text-zinc-800">{v || <span className="text-zinc-300 font-normal">—</span>}</p>
                    </div>
                  ))}
                </div>

                {/* Documents */}
                <div>
                  <h3 className="text-sm font-bold text-zinc-700 mb-2">Documents</h3>
                  {detail.documents?.length > 0 ? (
                    <div className="space-y-2">
                      {detail.documents.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 w-28">{doc.doc_type.replace(/_/g, ' ')}</span>
                          <a href={doc.file_url} target="_blank" rel="noreferrer"
                            className="text-sm text-orange-600 hover:underline truncate flex-1">{doc.original_filename}</a>
                          <span className="text-xs text-zinc-400">{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No documents uploaded</p>
                  )}
                </div>

                {/* Prev reviewer note */}
                {detail.reviewer_note && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-1">Previous Note</p>
                    <p className="text-sm text-amber-800">{detail.reviewer_note}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-zinc-100 pt-4">
                  <h3 className="text-sm font-bold text-zinc-700 mb-3">Actions</h3>
                  {renderActions()}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
