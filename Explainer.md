# EXPLAINER.md

---

## 1. The State Machine

The state machine lives in `backend/kyc/models.py`. I put it in a class called `KYCState` so everything is in one place — the states, the valid transitions, and the validation logic. That way if I ever need to add a new state I only touch one file.

```python
class KYCState:
    DRAFT = 'draft'
    SUBMITTED = 'submitted'
    UNDER_REVIEW = 'under_review'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    MORE_INFO_REQUESTED = 'more_info_requested'

    TRANSITIONS = {
        DRAFT: {SUBMITTED},
        SUBMITTED: {UNDER_REVIEW},
        UNDER_REVIEW: {APPROVED, REJECTED, MORE_INFO_REQUESTED},
        MORE_INFO_REQUESTED: {SUBMITTED},
        APPROVED: set(),
        REJECTED: set(),
    }

    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        return to_state in cls.TRANSITIONS.get(from_state, set())

    @classmethod
    def validate_transition(cls, from_state: str, to_state: str) -> None:
        if not cls.can_transition(from_state, to_state):
            allowed = cls.TRANSITIONS.get(from_state, set())
            if not allowed:
                raise ValueError(
                    f"Submission in '{from_state}' state cannot be transitioned further. "
                    f"This is a terminal state."
                )
            raise ValueError(
                f"Cannot transition from '{from_state}' to '{to_state}'. "
                f"Allowed transitions from '{from_state}': {sorted(allowed)}."
            )
```

Every state change goes through `transition_to()` on the model, which calls `validate_transition()` before doing anything:

```python
def transition_to(self, new_state: str, reviewer=None, note: str = '') -> None:
    KYCState.validate_transition(self.state, new_state)

    old_state = self.state
    self.state = new_state

    if new_state == KYCState.SUBMITTED:
        self.submitted_at = timezone.now()

    if new_state in (KYCState.APPROVED, KYCState.REJECTED, KYCState.MORE_INFO_REQUESTED):
        self.reviewed_at = timezone.now()
        if reviewer:
            self.reviewer = reviewer
        if note:
            self.reviewer_note = note

    self.save()
    return old_state
```

If the transition is illegal it raises a `ValueError` with a clear message, the view catches it and returns a 400. `APPROVED` and `REJECTED` map to empty sets so nothing can move out of them — they're terminal.

One thing I'd probably improve with more time is adding a history/audit log so you can see every state change that happened on a submission, not just the current state. Right now you can only see where it ended up, not how it got there.

---

## 2. The Upload

Validation is in `backend/kyc/serializers.py` inside `DocumentUploadSerializer.validate_file()`.

```python
def validate_file(self, file):
    max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 5 * 1024 * 1024)
    allowed_extensions = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', ['.pdf', '.jpg', '.jpeg', '.png'])

    # Size check first — fast and cheap
    if file.size > max_size:
        raise serializers.ValidationError(
            f"File size {file.size / (1024*1024):.1f} MB exceeds the 5 MB limit."
        )

    # Extension check
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in allowed_extensions:
        raise serializers.ValidationError(
            f"File extension '{ext}' is not allowed. "
            f"Accepted types: {', '.join(allowed_extensions)}."
        )

    # MIME sniffing — read the actual file header, don't trust the client
    file.seek(0)
    header = file.read(2048)
    file.seek(0)

    try:
        detected_mime = magic.from_buffer(header, mime=True)
    except Exception:
        mime_map = {'.pdf': 'application/pdf', '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg', '.png': 'image/png'}
        detected_mime = mime_map.get(ext, 'application/octet-stream')

    allowed_mimes = getattr(
        settings, 'ALLOWED_UPLOAD_TYPES',
        ['application/pdf', 'image/jpeg', 'image/png']
    )
    if detected_mime not in allowed_mimes:
        raise serializers.ValidationError(
            f"Detected file type '{detected_mime}' is not allowed. "
            f"Only PDF, JPG, and PNG files are accepted."
        )

    file._detected_mime = detected_mime
    return file
```

If someone sends a 50 MB file, the size check fires right away before the file is read or saved anywhere, and they get back a 400 with a message saying how big it was vs the limit. Three things are checked in order — size, then extension from the filename, then actual MIME type by reading the binary header with `python-magic`. The MIME check is the important one because without it someone could just rename a `.exe` to `.pdf` and the first two checks would pass.

One honest gap here — I'm not doing any virus scanning. For a real fintech product you'd want something like ClamAV in the pipeline before the file hits storage. Didn't have time to set that up but it's something I'm aware of.

---

## 3. The Queue

The queue query is in `backend/kyc/views.py` in `ReviewerQueueView`:

```python
def get(self, request):
    state_filter = request.query_params.get('state', None)
    qs = KYCSubmission.objects.select_related('merchant', 'reviewer').prefetch_related('documents')

    if state_filter:
        qs = qs.filter(state=state_filter)
    else:
        qs = qs.filter(state__in=[
            KYCState.SUBMITTED, KYCState.UNDER_REVIEW, KYCState.MORE_INFO_REQUESTED
        ])
```

The default queue only shows actionable states — submitted, under review, and more info requested. Reviewers don't need to see approved/rejected submissions in their work queue, those just add noise.

The SLA flag is a `@property` on the model rather than a stored field:

```python
@property
def is_at_risk(self) -> bool:
    threshold_hours = getattr(settings, 'SLA_THRESHOLD_HOURS', 24)
    if self.state not in (KYCState.SUBMITTED, KYCState.UNDER_REVIEW):
        return False
    if not self.submitted_at:
        return False
    elapsed = timezone.now() - self.submitted_at
    return elapsed.total_seconds() > threshold_hours * 3600
```

I wrote it this way because if it were a stored boolean it could go stale — you'd need a background job to keep updating it. As a property it's always computed fresh from `submitted_at`. The threshold comes from settings so you can change it without a redeploy.

The `select_related` and `prefetch_related` are there to avoid N+1 queries. Without them serializing 50 submissions fires a separate DB query for each merchant and document set, which adds up fast.

---

## 4. The Auth

Two layers. First, role-level permissions in `backend/kyc/permissions.py`:

```python
class IsMerchant(BasePermission):
    message = "Only merchants can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.is_merchant
        )
```

Second — and more important — object-level isolation in the views. Merchant A can't see Merchant B's submission because every query is scoped to `merchant=request.user`:

```python
def get_object(self, pk, user):
    try:
        sub = KYCSubmission.objects.get(pk=pk, merchant=user)
    except KYCSubmission.DoesNotExist:
        return None
    return sub
```

The filter is in the database query itself, not checked afterwards in Python. So if Merchant A guesses that submission ID 7 exists and belongs to Merchant B, the query just comes back empty and they get a 404. They don't even learn whether that ID exists.

I return 404 instead of 403 deliberately — 403 would confirm "this submission exists but you can't see it", which is a small information leak. 404 gives them nothing.

---

## 5. The AI Audit

The most annoying bug I hit was in `KYCForm.jsx`. The AI-generated code used `useState(initialSub)` to initialize form state from the submission prop:

```jsx
// What the AI wrote
export default function KYCForm({ submission: initialSub, onSaved }) {
  const [sub, setSub] = useState(initialSub);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // ... no reset logic anywhere
```

This looks fine at first. The problem is `useState(initialSub)` only runs once — on the first render. React doesn't re-initialize state just because a prop changed. So when you clicked a different submission in the sidebar, the component got a new `initialSub` prop but `sub`, `step`, `error`, and `success` all stayed exactly as they were from the previous submission.

What this looked like in practice: click merchant1's application, fill in a couple fields, then click merchant2's application — and you'd see merchant1's data still sitting in the form. The step counter would be wherever you left it. Error messages from before were still visible. It was basically showing you the wrong submission's data with no indication anything was wrong.

I didn't catch it immediately because in testing I usually just refreshed the page between submissions. It only became obvious when I started clicking between submissions without refreshing.

The fix was a `useEffect` that resets state whenever the submission ID changes:

```jsx
useEffect(() => {
  setSub(initialSub);
  setStep(0);
  setError('');
  setSuccess('');
  setStepErrors({});
}, [initialSub.id]);
```

The dependency is `initialSub.id` not the whole object — if I used the full object it would re-run on every autosave (since each save returns a new object reference) which would reset the step back to 0 while the user was typing. Using the ID means it only resets when you actually switch to a different submission.

I also had to fix the business type select. The AI used `defaultValue` which is the uncontrolled React pattern and has the same problem — it only reads the prop once on mount:

```jsx
// Before — broken
<select defaultValue={sub.business_type} onChange={...}>

// After — actually reactive
<select value={sub.business_type || ''} onChange={...}>
```

With `defaultValue`, switching submissions never updated what was shown in the dropdown even though `sub.business_type` had changed. Switching to `value` makes it a controlled input that stays in sync with state.

Both are the same class of bug — React props don't automatically flow into state, you have to explicitly handle updates. The AI-generated code treated props like they were reactive when they're not.