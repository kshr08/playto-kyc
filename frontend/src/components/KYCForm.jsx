import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Button, Input, Select, ErrorBox, SuccessBox, Badge, Spinner } from '../components/UI';

const STEPS = ['Personal', 'Business', 'Documents', 'Review'];
const DOC_TYPES = [
  { value: 'pan', label: 'PAN Card' },
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'bank_statement', label: 'Bank Statement' },
];
const BUSINESS_TYPES = [
  'sole_proprietorship', 'partnership', 'private_limited',
  'public_limited', 'llp', 'freelancer', 'other'
];

export default function KYCForm({ submission: initialSub, onSaved }) {
  const [sub, setSub] = useState(initialSub);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(null);
  const fileRefs = useRef({});

  const isReadonly = !['draft', 'more_info_requested'].includes(sub.state);
  const docs = sub.documents || [];
  const getDoc = (type) => docs.find(d => d.doc_type === type);

  const save = async (data) => {
    setSaving(true); setError('');
    try {
      const res = await api.saveSubmission(sub.id, data);
      setSub(res.data);
      onSaved?.(res.data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleField = async (field, value) => {
    if (isReadonly) return;
    await save({ [field]: value });
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) { setError('Only PDF, JPG, PNG allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return; }
    setUploading(docType); setError('');
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('file', file);
    try {
      const res = await api.uploadDocument(sub.id, fd);
      setSub(prev => ({
        ...prev,
        documents: [
          ...(prev.documents || []).filter(d => d.doc_type !== docType),
          res.data
        ]
      }));
      setSuccess('Document uploaded.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) { setError(e.message); }
    finally { setUploading(null); }
  };

  const handleDeleteDoc = async (docId, docType) => {
    try {
      await api.deleteDocument(sub.id, docId);
      setSub(prev => ({ ...prev, documents: (prev.documents || []).filter(d => d.id !== docId) }));
    } catch (e) { setError(e.message); }
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const res = await api.submitKYC(sub.id);
      setSub(res.data);
      onSaved?.(res.data);
      setSuccess("KYC submitted for review! We'll get back to you shortly.");
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Step nav */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition
                ${step === i ? 'text-orange-600 bg-orange-50' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step === i ? 'bg-orange-500 text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-zinc-200 mx-1" />}
          </div>
        ))}
      </div>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Step 0: Personal */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800">Personal Details</h3>
          <FieldInput label="Full Name" defaultValue={sub.full_name} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('full_name', v)} placeholder="As on your PAN card" />
          <FieldInput label="Email" type="email" defaultValue={sub.email} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('email', v)} placeholder="you@example.com" />
          <FieldInput label="Phone" defaultValue={sub.phone} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('phone', v)} placeholder="+91 98765 43210" />
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Next: Business →</Button>
          </div>
        </div>
      )}

      {/* Step 1: Business */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800">Business Details</h3>
          <FieldInput label="Business Name" defaultValue={sub.business_name} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('business_name', v)} placeholder="Your agency or freelance name" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">Business Type</label>
            <select disabled={isReadonly}
              defaultValue={sub.business_type}
              onChange={(e) => handleField('business_type', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Select type...</option>
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <FieldInput label="Expected Monthly Volume (USD)" type="number" defaultValue={sub.expected_monthly_volume_usd}
            disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('expected_monthly_volume_usd', v)} placeholder="5000" />
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
            <Button onClick={() => setStep(2)}>Next: Documents →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Documents */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800">Document Upload</h3>
          <p className="text-sm text-zinc-500">Upload PDF, JPG, or PNG. Max 5 MB each.</p>
          {DOC_TYPES.map(({ value, label }) => {
            const existing = getDoc(value);
            return (
              <div key={value} className="rounded-xl border border-zinc-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-700">{label}</span>
                  {existing && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✓ Uploaded</span>
                  )}
                </div>
                {existing ? (
                  <div className="flex items-center gap-3">
                    <a href={existing.file_url} target="_blank" rel="noreferrer"
                      className="text-xs text-orange-600 hover:underline truncate max-w-xs">
                      {existing.original_filename}
                    </a>
                    <span className="text-xs text-zinc-400">({(existing.file_size_bytes / 1024).toFixed(0)} KB)</span>
                    {!isReadonly && (
                      <button onClick={() => handleDeleteDoc(existing.id, value)}
                        className="text-xs text-red-500 hover:text-red-700 ml-auto">Remove</button>
                    )}
                  </div>
                ) : !isReadonly ? (
                  <div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      ref={el => fileRefs.current[value] = el}
                      onChange={(e) => handleUpload(value, e.target.files[0])} />
                    <Button size="sm" variant="secondary" loading={uploading === value}
                      onClick={() => fileRefs.current[value]?.click()}>
                      Choose file
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No document uploaded</p>
                )}
              </div>
            );
          })}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => setStep(3)}>Review →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-800">Review & Submit</h3>
            <Badge state={sub.state} />
          </div>

          {sub.state === 'more_info_requested' && sub.reviewer_note && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-500 mb-1">Reviewer Note</p>
              <p className="text-sm text-purple-800">{sub.reviewer_note}</p>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 text-sm">
            {[
              ['Full Name', sub.full_name],
              ['Email', sub.email],
              ['Phone', sub.phone],
              ['Business', sub.business_name],
              ['Business Type', sub.business_type?.replace(/_/g, ' ')],
              ['Monthly Volume', sub.expected_monthly_volume_usd ? `$${Number(sub.expected_monthly_volume_usd).toLocaleString()}` : null],
              ['Documents', docs.map(d => d.doc_type.replace(/_/g, ' ')).join(', ') || 'None'],
            ].map(([k, v]) => (
              <div key={k} className="flex px-4 py-2.5 gap-4">
                <span className="w-36 text-zinc-400 shrink-0">{k}</span>
                <span className="text-zinc-800 font-medium">{v || <span className="text-zinc-300">—</span>}</span>
              </div>
            ))}
          </div>

          {sub.state === 'approved' && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-bold text-emerald-800">Your KYC is approved!</p>
              <p className="text-sm text-emerald-600">You can now start collecting international payments.</p>
            </div>
          )}

          {sub.state === 'rejected' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="font-bold text-red-700 mb-1">KYC Rejected</p>
              <p className="text-sm text-red-600">{sub.reviewer_note || 'Please contact support for details.'}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            {['draft', 'more_info_requested'].includes(sub.state) && (
              <Button onClick={handleSubmit} loading={submitting}>
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Autosave field component
function FieldInput({ label, defaultValue, onBlur, saving, disabled, type = 'text', placeholder }) {
  const [val, setVal] = useState(defaultValue || '');
  useEffect(() => setVal(defaultValue || ''), [defaultValue]);
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input type={type} value={val} disabled={disabled} placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { if (val !== (defaultValue || '')) onBlur(val); }}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-zinc-50 disabled:text-zinc-500" />
    </div>
  );
}
