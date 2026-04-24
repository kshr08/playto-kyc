from .models import NotificationEvent, KYCState

# Maps state transitions to event types
STATE_TO_EVENT = {
    KYCState.SUBMITTED: 'kyc_submitted',
    KYCState.UNDER_REVIEW: 'kyc_under_review',
    KYCState.APPROVED: 'kyc_approved',
    KYCState.REJECTED: 'kyc_rejected',
    KYCState.MORE_INFO_REQUESTED: 'kyc_more_info_requested',
}

# When a merchant re-submits after more_info, use a distinct event
RESUBMIT_EVENT = 'kyc_resubmitted'


def log_notification(submission, new_state: str, old_state: str = None, extra_payload: dict = None):
    """
    Logs a notification event to the DB.
    Does not send emails — purely records what should be sent.
    """
    # Determine event type
    if new_state == KYCState.SUBMITTED and old_state == KYCState.MORE_INFO_REQUESTED:
        event_type = RESUBMIT_EVENT
    else:
        event_type = STATE_TO_EVENT.get(new_state)

    if not event_type:
        return  # No notification for draft state

    payload = {
        'submission_id': submission.id,
        'merchant_email': submission.merchant.email,
        'merchant_name': submission.full_name or submission.merchant.username,
        'business_name': submission.business_name,
        'new_state': new_state,
        'old_state': old_state,
    }
    if extra_payload:
        payload.update(extra_payload)
    if submission.reviewer_note:
        payload['reviewer_note'] = submission.reviewer_note

    NotificationEvent.objects.create(
        merchant=submission.merchant,
        submission=submission,
        event_type=event_type,
        payload=payload,
    )
