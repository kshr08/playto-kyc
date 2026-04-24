from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


# ─── State Machine ────────────────────────────────────────────────────────────
# Single source of truth for all valid KYC state transitions.
# Any attempt to move outside these transitions returns 400.

class KYCState:
    DRAFT = 'draft'
    SUBMITTED = 'submitted'
    UNDER_REVIEW = 'under_review'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    MORE_INFO_REQUESTED = 'more_info_requested'

    CHOICES = [
        (DRAFT, 'Draft'),
        (SUBMITTED, 'Submitted'),
        (UNDER_REVIEW, 'Under Review'),
        (APPROVED, 'Approved'),
        (REJECTED, 'Rejected'),
        (MORE_INFO_REQUESTED, 'More Info Requested'),
    ]

    # Legal transitions: from_state -> set of allowed to_states
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
        """Raises ValueError with a clear message if the transition is illegal."""
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


# ─── User Profile ─────────────────────────────────────────────────────────────

class UserProfile(models.Model):
    ROLE_MERCHANT = 'merchant'
    ROLE_REVIEWER = 'reviewer'
    ROLE_CHOICES = [
        (ROLE_MERCHANT, 'Merchant'),
        (ROLE_REVIEWER, 'Reviewer'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MERCHANT)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

    @property
    def is_merchant(self):
        return self.role == self.ROLE_MERCHANT

    @property
    def is_reviewer(self):
        return self.role == self.ROLE_REVIEWER


# ─── KYC Submission ───────────────────────────────────────────────────────────

class KYCSubmission(models.Model):
    BUSINESS_TYPE_CHOICES = [
        ('sole_proprietorship', 'Sole Proprietorship'),
        ('partnership', 'Partnership'),
        ('private_limited', 'Private Limited'),
        ('public_limited', 'Public Limited'),
        ('llp', 'LLP'),
        ('freelancer', 'Freelancer'),
        ('other', 'Other'),
    ]

    # ── Ownership
    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='kyc_submissions'
    )

    # ── State machine
    state = models.CharField(
        max_length=30, choices=KYCState.CHOICES, default=KYCState.DRAFT, db_index=True
    )

    # ── Personal details
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # ── Business details
    business_name = models.CharField(max_length=255, blank=True)
    business_type = models.CharField(
        max_length=50, choices=BUSINESS_TYPE_CHOICES, blank=True
    )
    expected_monthly_volume_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    # ── Reviewer fields
    reviewer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_submissions'
    )
    reviewer_note = models.TextField(blank=True)

    # ── SLA tracking — submitted_at is set when moving to SUBMITTED
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # ── Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['submitted_at', 'created_at']

    def __str__(self):
        return f"KYC#{self.pk} — {self.merchant.username} [{self.state}]"

    # ── State machine helpers ─────────────────────────────────────────────────

    def transition_to(self, new_state: str, reviewer=None, note: str = '') -> None:
        """
        Validates and applies a state transition.
        Raises ValueError on illegal transitions.
        Sets timestamps and reviewer appropriately.
        """
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

    # ── SLA helper ────────────────────────────────────────────────────────────

    @property
    def is_at_risk(self) -> bool:
        """
        Dynamically computed — never stored, never stale.
        A submission is at-risk if it has been waiting for review > 24 hours.
        """
        from django.conf import settings
        threshold_hours = getattr(settings, 'SLA_THRESHOLD_HOURS', 24)

        if self.state not in (KYCState.SUBMITTED, KYCState.UNDER_REVIEW):
            return False
        if not self.submitted_at:
            return False
        elapsed = timezone.now() - self.submitted_at
        return elapsed.total_seconds() > threshold_hours * 3600

    @property
    def time_in_queue_minutes(self) -> int | None:
        if not self.submitted_at:
            return None
        end = self.reviewed_at or timezone.now()
        delta = end - self.submitted_at
        return int(delta.total_seconds() / 60)


# ─── KYC Document ─────────────────────────────────────────────────────────────

def document_upload_path(instance, filename):
    return f"documents/{instance.submission.merchant.id}/{instance.submission.id}/{filename}"


class KYCDocument(models.Model):
    DOC_TYPE_CHOICES = [
        ('pan', 'PAN Card'),
        ('aadhaar', 'Aadhaar Card'),
        ('bank_statement', 'Bank Statement'),
        ('other', 'Other'),
    ]

    submission = models.ForeignKey(
        KYCSubmission, on_delete=models.CASCADE, related_name='documents'
    )
    doc_type = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to=document_upload_path)
    original_filename = models.CharField(max_length=255)
    file_size_bytes = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.doc_type} for KYC#{self.submission_id}"


# ─── Notification Events ──────────────────────────────────────────────────────

class NotificationEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('kyc_submitted', 'KYC Submitted'),
        ('kyc_under_review', 'KYC Under Review'),
        ('kyc_approved', 'KYC Approved'),
        ('kyc_rejected', 'KYC Rejected'),
        ('kyc_more_info_requested', 'More Info Requested'),
        ('kyc_resubmitted', 'KYC Resubmitted'),
    ]

    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notification_events'
    )
    submission = models.ForeignKey(
        KYCSubmission, on_delete=models.CASCADE, related_name='notification_events'
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField(default=dict)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.event_type} for merchant {self.merchant_id} at {self.timestamp}"


# ─── Signal: auto-create profile ─────────────────────────────────────────────
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
