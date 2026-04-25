import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Button, ErrorBox, SuccessBox, Badge } from '../components/UI';

const STEPS = ['Personal', 'Business', 'Documents', 'Review'];
const DOC_TYPES = [
  { value: 'pan', label: 'PAN Card', desc: 'Permanent Account Number card' },
  { value: 'aadhaar', label: 'Aadhaar Card', desc: '12-digit government ID' },
  { value: 'bank_statement', label: 'Bank Statement', desc: 'Last 3 months statement' },
];
const BUSINESS_TYPES = [
  'sole_proprietorship', 'partnership', 'private_limited',
  'public_limited', 'llp', 'freelancer', 'other'
];

function isStepComplete(step, sub) {
  const docs = sub.documents || [];
  switch (step) {
    case 0: return !!(sub.full_name && sub.email && sub.phone);
    case 1: return !!(sub.business_name && sub.business_type && sub.expected_monthly_volume_usd);
    case 2: return docs.length > 0;
    case 3: return true;
    default: return false;
  }
}

export default function KYCForm({ submission: initialSub, onSaved }) {
  const [sub, setSub] = useState(initialSub);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(null);
  const [stepErrors, setStepErrors] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    setSub(initialSub);
    setStep(0);
    setError('');
    setSuccess('');
    setStepErrors({});
  }, [initialSub.id]);

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

  const goToStep = (nextStep) => {
    if (nextStep > step && !isReadonly) {
      const rules = {
        0: { fields: ['full_name', 'email', 'phone'], label: 'Please fill in all personal details before continuing.' },
        1: { fields: ['business_name', 'business_type', 'expected_monthly_volume_usd'], label: 'Please fill in all business details before continuing.' },
        2: { check: () => docs.length > 0, label: 'Please upload at least one document before continuing.' },
      };
      const rule = rules[step];
      if (rule) {
        const failed = rule.fields ? rule.fields.some(f => !sub[f]) : !rule.check();
        if (failed) { setStepErrors(prev => ({ ...prev, [step]: rule.label })); return; }
      }
    }
    setStepErrors(prev => ({ ...prev, [step]: '' }));
    setStep(nextStep);
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setError('Only PDF, JPG, PNG allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return; }
    setUploading(docType); setError('');
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('file', file);
    try {
      const res = await api.uploadDocument(sub.id, fd);
      setSub(prev => ({ ...prev, documents: [...(prev.documents || []).filter(d => d.doc_type !== docType), res.data] }));
      setSuccess('Document uploaded successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
    finally { setUploading(null); }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await api.deleteDocument(sub.id, docId);
      setSub(prev => ({ ...prev, documents: (prev.documents || []).filter(d => d.id !== docId) }));
    } catch (e) { setError(e.message); }
  };

  const handleSubmit = async () => {
    const missing = [];
    if (!sub.full_name) missing.push('Full Name');
    if (!sub.email) missing.push('Email');
    if (!sub.phone) missing.push('Phone');
    if (!sub.business_name) missing.push('Business Name');
    if (!sub.business_type) missing.push('Business Type');
    if (!sub.expected_monthly_volume_usd) missing.push('Monthly Volume');
    if (docs.length === 0) missing.push('At least one document');
    if (missing.length > 0) { setError(`Missing: ${missing.join(', ')}.`); return; }
    setSubmitting(true); setError('');
    try {
      const res = await api.submitKYC(sub.id);
      setSub(res.data); onSaved?.(res.data);
      setSuccess("KYC submitted! We'll review and get back to you shortly.");
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-8 slide-up">
      {/* Step header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#FF5C00' }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="font-display font-bold text-2xl" style={{ color: '#F5F5F0' }}>{STEPS[step]}</h2>
          </div>
          <Badge state={sub.state} />
        </div>

        {/* Progress tabs */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => {
            const completed = i < step && isStepComplete(i, sub);
            const active = i === step;
            return (
              <button key={s} onClick={() => goToStep(i)} className="flex-1 text-left" title={s}>
                <div className="h-0.5 rounded-full mb-2 transition-all duration-300"
                  style={{ background: active ? '#FF5C00' : completed ? '#FF5C0055' : '#2A2A2A' }} />
                <span className="text-xs transition-colors duration-150"
                  style={{ color: active ? '#FF5C00' : completed ? '#FF5C0088' : '#444440' }}>
                  {completed ? '✓ ' : ''}{s}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Step 0: Personal */}
      {step === 0 && (
        <div className="space-y-5 fade-in">
          <FieldInput label="Full Name" defaultValue={sub.full_name} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('full_name', v)} placeholder="As on your PAN card" />
          <FieldInput label="Email Address" type="email" defaultValue={sub.email} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('email', v)} placeholder="you@example.com" />
          <FieldInput label="Phone Number" defaultValue={sub.phone} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('phone', v)} placeholder="+91 98765 43210" />
          {stepErrors[0] && <p className="text-sm" style={{ color: '#FF6666' }}>{stepErrors[0]}</p>}
          <div className="flex justify-end pt-2">
            <Button onClick={() => goToStep(1)}>Next: Business →</Button>
          </div>
        </div>
      )}

      {/* Step 1: Business */}
      {step === 1 && (
        <div className="space-y-5 fade-in">
          <FieldInput label="Business Name" defaultValue={sub.business_name} disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('business_name', v)} placeholder="Your agency or freelance name" />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest" style={{ color: '#888880' }}>Business Type</label>
            <select disabled={isReadonly} value={sub.business_type || ''}
              onChange={(e) => handleField('business_type', e.target.value)}
              style={{ background: '#111111', border: '1px solid #2A2A2A', color: sub.business_type ? '#F5F5F0' : '#444440' }}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all duration-150">
              <option value="" style={{ background: '#111' }}>Select business type...</option>
              {BUSINESS_TYPES.map(t => (
                <option key={t} value={t} style={{ background: '#111' }}>
                  {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <FieldInput label="Expected Monthly Volume (USD)" type="number" defaultValue={sub.expected_monthly_volume_usd}
            disabled={isReadonly} saving={saving}
            onBlur={(v) => handleField('expected_monthly_volume_usd', v)} placeholder="5000" />
          {stepErrors[1] && <p className="text-sm" style={{ color: '#FF6666' }}>{stepErrors[1]}</p>}
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => goToStep(0)}>← Back</Button>
            <Button onClick={() => goToStep(2)}>Next: Documents →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Documents */}
      {step === 2 && (
        <div className="space-y-4 fade-in">
          <p className="text-sm" style={{ color: '#555550' }}>PDF, JPG, or PNG only · Max 5 MB each · At least one required</p>
          {DOC_TYPES.map(({ value, label, desc }) => {
            const existing = getDoc(value);
            return (
              <div key={value} className="rounded-2xl p-5 transition-all duration-200"
                style={{ background: existing ? '#001A0D' : '#141414', border: `1px solid ${existing ? '#00C87533' : '#222222'}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F5F5F0' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#444440' }}>{desc}</p>
                  </div>
                  {existing && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: '#00C87522', color: '#00C875', border: '1px solid #00C87533' }}>✓ Uploaded</span>
                  )}
                </div>
                {existing ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: '#0A1A0F', border: '1px solid #00C87522' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                      style={{ background: '#00C87522' }}>
                      {existing.mime_type === 'application/pdf' ? '📄' : '🖼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={existing.file_url} target="_blank" rel="noreferrer"
                        className="text-xs font-medium hover:underline truncate block" style={{ color: '#00C875' }}>
                        {existing.original_filename}
                      </a>
                      <p className="text-xs mt-0.5" style={{ color: '#444440' }}>{(existing.file_size_bytes / 1024).toFixed(0)} KB</p>
                    </div>
                    {!isReadonly && (
                      <button onClick={() => handleDeleteDoc(existing.id)}
                        className="text-xs px-2.5 py-1 rounded-lg transition-all duration-150"
                        style={{ color: '#FF6666', background: '#FF444411', border: '1px solid #FF444422' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ) : !isReadonly ? (
                  <div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      ref={el => fileRefs.current[value] = el}
                      onChange={(e) => handleUpload(value, e.target.files[0])} />
                    <Button size="sm" variant="secondary" loading={uploading === value}
                      onClick={() => fileRefs.current[value]?.click()}>
                      {uploading === value ? 'Uploading...' : 'Choose file'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: '#444440' }}>No document uploaded</p>
                )}
              </div>
            );
          })}
          {stepErrors[2] && <p className="text-sm" style={{ color: '#FF6666' }}>{stepErrors[2]}</p>}
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => goToStep(1)}>← Back</Button>
            <Button onClick={() => goToStep(3)}>Review →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-6 fade-in">
          {sub.state === 'more_info_requested' && sub.reviewer_note && (
            <div className="rounded-2xl p-5" style={{ background: '#120D1A', border: '1px solid #AA88FF33' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#AA88FF' }}>Reviewer Note</p>
              <p className="text-sm leading-relaxed" style={{ color: '#CCBBFF' }}>{sub.reviewer_note}</p>
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #222222' }}>
            {[
              ['Full Name', sub.full_name],
              ['Email', sub.email],
              ['Phone', sub.phone],
              ['Business Name', sub.business_name],
              ['Business Type', sub.business_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
              ['Monthly Volume', sub.expected_monthly_volume_usd ? `$${Number(sub.expected_monthly_volume_usd).toLocaleString()}` : null],
              ['Documents', docs.length > 0 ? `${docs.length} file${docs.length > 1 ? 's' : ''} uploaded` : null],
            ].map(([k, v], idx) => (
              <div key={k} className="flex items-center px-5 py-3.5"
                style={{ borderBottom: idx < 6 ? '1px solid #1E1E1E' : 'none', background: idx % 2 === 0 ? '#141414' : '#121212' }}>
                <span className="w-40 text-xs font-medium uppercase tracking-wide shrink-0" style={{ color: '#444440' }}>{k}</span>
                <span className="text-sm font-medium" style={{ color: v ? '#F5F5F0' : '#FF4444' }}>{v || '— missing'}</span>
              </div>
            ))}
          </div>
          {sub.state === 'approved' && (
            <div className="rounded-2xl p-6 text-center" style={{ background: '#001A0D', border: '1px solid #00C87533' }}>
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-display font-bold text-lg mb-1" style={{ color: '#00C875' }}>KYC Approved!</p>
              <p className="text-sm" style={{ color: '#00C87599' }}>You can now start collecting international payments.</p>
            </div>
          )}
          {sub.state === 'rejected' && (
            <div className="rounded-2xl p-5" style={{ background: '#1A0A0A', border: '1px solid #FF444433' }}>
              <p className="font-display font-bold mb-1" style={{ color: '#FF6666' }}>KYC Rejected</p>
              <p className="text-sm" style={{ color: '#FF666699' }}>{sub.reviewer_note || 'Please contact support for details.'}</p>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => goToStep(2)}>← Back</Button>
            {['draft', 'more_info_requested'].includes(sub.state) && (
              <Button onClick={handleSubmit} loading={submitting} size="lg">Submit for Review →</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, defaultValue, onBlur, saving, disabled, type = 'text', placeholder }) {
  const [val, setVal] = useState(defaultValue || '');
  useEffect(() => setVal(defaultValue || ''), [defaultValue]);
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-widest" style={{ color: '#888880' }}>{label}</label>
      <input type={type} value={val} disabled={disabled} placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onBlur={e => { e.target.style.borderColor = '#2A2A2A'; if (val !== (defaultValue || '')) onBlur(val); }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = '#FF5C00'; }}
        style={{ background: disabled ? '#0D0D0D' : '#111111', border: '1px solid #2A2A2A', color: disabled ? '#444440' : '#F5F5F0', width: '100%', borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', transition: 'border-color 0.15s', fontFamily: 'DM Sans, sans-serif' }}
      />
    </div>
  );
}