from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from .models import KYCSubmission, KYCState, UserProfile


def make_user(username, role='merchant'):
    user = User.objects.create_user(username=username, password='testpass123', email=f'{username}@test.com')
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.save()
    return user


def auth_client(user):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client


class StateTransitionTests(TestCase):
    """
    Tests covering legal and illegal KYC state transitions.
    The state machine must enforce:
      draft → submitted → under_review → approved/rejected/more_info_requested
      more_info_requested → submitted
      approved and rejected are terminal (no further transitions allowed)
    """

    def setUp(self):
        self.merchant = make_user('merchant1', role='merchant')
        self.reviewer = make_user('reviewer1', role='reviewer')
        self.merchant_client = auth_client(self.merchant)
        self.reviewer_client = auth_client(self.reviewer)

    def _make_submission(self, state=KYCState.DRAFT):
        return KYCSubmission.objects.create(
            merchant=self.merchant,
            full_name='Test User',
            email='test@example.com',
            phone='+91 99999 99999',
            business_name='Test Co',
            business_type='freelancer',
            expected_monthly_volume_usd=5000,
            state=state,
        )

    # ── Legal transition tests ────────────────────────────────────────────────

    def test_draft_to_submitted_is_legal(self):
        """KYCState.can_transition should allow draft → submitted."""
        self.assertTrue(KYCState.can_transition(KYCState.DRAFT, KYCState.SUBMITTED))

    def test_submitted_to_under_review_is_legal(self):
        self.assertTrue(KYCState.can_transition(KYCState.SUBMITTED, KYCState.UNDER_REVIEW))

    def test_under_review_to_approved_is_legal(self):
        self.assertTrue(KYCState.can_transition(KYCState.UNDER_REVIEW, KYCState.APPROVED))

    def test_under_review_to_rejected_is_legal(self):
        self.assertTrue(KYCState.can_transition(KYCState.UNDER_REVIEW, KYCState.REJECTED))

    def test_under_review_to_more_info_is_legal(self):
        self.assertTrue(KYCState.can_transition(KYCState.UNDER_REVIEW, KYCState.MORE_INFO_REQUESTED))

    def test_more_info_to_submitted_is_legal(self):
        self.assertTrue(KYCState.can_transition(KYCState.MORE_INFO_REQUESTED, KYCState.SUBMITTED))

    # ── Illegal transition tests (unit level) ─────────────────────────────────

    def test_draft_cannot_skip_to_under_review(self):
        """Skipping the submitted state is not allowed."""
        self.assertFalse(KYCState.can_transition(KYCState.DRAFT, KYCState.UNDER_REVIEW))

    def test_draft_cannot_jump_to_approved(self):
        self.assertFalse(KYCState.can_transition(KYCState.DRAFT, KYCState.APPROVED))

    def test_approved_is_terminal(self):
        """No transition is allowed out of approved."""
        for target in [KYCState.DRAFT, KYCState.SUBMITTED, KYCState.UNDER_REVIEW,
                       KYCState.REJECTED, KYCState.MORE_INFO_REQUESTED]:
            with self.subTest(target=target):
                self.assertFalse(KYCState.can_transition(KYCState.APPROVED, target))

    def test_rejected_is_terminal(self):
        """No transition is allowed out of rejected."""
        for target in [KYCState.DRAFT, KYCState.SUBMITTED, KYCState.UNDER_REVIEW,
                       KYCState.APPROVED, KYCState.MORE_INFO_REQUESTED]:
            with self.subTest(target=target):
                self.assertFalse(KYCState.can_transition(KYCState.REJECTED, target))

    def test_submitted_cannot_go_back_to_draft(self):
        self.assertFalse(KYCState.can_transition(KYCState.SUBMITTED, KYCState.DRAFT))

    def test_validate_transition_raises_for_illegal_move(self):
        """validate_transition raises ValueError with a descriptive message."""
        with self.assertRaises(ValueError) as ctx:
            KYCState.validate_transition(KYCState.DRAFT, KYCState.APPROVED)
        self.assertIn('draft', str(ctx.exception))
        self.assertIn('approved', str(ctx.exception))

    def test_validate_transition_raises_for_terminal_state(self):
        """Error message should mention 'terminal' for approved/rejected."""
        with self.assertRaises(ValueError) as ctx:
            KYCState.validate_transition(KYCState.APPROVED, KYCState.SUBMITTED)
        self.assertIn('terminal', str(ctx.exception))

    # ── Model-level transition_to() tests ─────────────────────────────────────

    def test_transition_to_sets_submitted_at(self):
        """Moving to SUBMITTED should stamp submitted_at."""
        sub = self._make_submission(state=KYCState.DRAFT)
        self.assertIsNone(sub.submitted_at)
        sub.transition_to(KYCState.SUBMITTED)
        self.assertIsNotNone(sub.submitted_at)

    def test_transition_to_illegal_move_does_not_save(self):
        """An illegal transition must raise ValueError and not persist the change."""
        sub = self._make_submission(state=KYCState.DRAFT)
        original_state = sub.state
        with self.assertRaises(ValueError):
            sub.transition_to(KYCState.APPROVED)
        # State must not have changed in the DB
        sub.refresh_from_db()
        self.assertEqual(sub.state, original_state)

    def test_transition_to_approved_sets_reviewed_at(self):
        """Moving to APPROVED should stamp reviewed_at."""
        sub = self._make_submission(state=KYCState.UNDER_REVIEW)
        self.assertIsNone(sub.reviewed_at)
        sub.transition_to(KYCState.APPROVED, reviewer=self.reviewer, note='All good.')
        self.assertIsNotNone(sub.reviewed_at)
        self.assertEqual(sub.reviewer, self.reviewer)
        self.assertEqual(sub.reviewer_note, 'All good.')

    # ── API-level transition tests ─────────────────────────────────────────────

    def test_reviewer_api_rejects_illegal_transition(self):
        """The reviewer transition endpoint must return 400 for illegal moves."""
        sub = self._make_submission(state=KYCState.SUBMITTED)
        # Trying to approve directly from submitted (must be under_review first)
        response = self.reviewer_client.post(
            f'/api/v1/reviewer/submissions/{sub.id}/transition/',
            {'new_state': 'approved'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data.get('error'))

    def test_reviewer_api_requires_note_for_rejection(self):
        """Rejecting without a note must return 400."""
        sub = self._make_submission(state=KYCState.UNDER_REVIEW)
        response = self.reviewer_client.post(
            f'/api/v1/reviewer/submissions/{sub.id}/transition/',
            {'new_state': 'rejected'},  # no note
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_reviewer_api_can_approve_from_under_review(self):
        """A valid transition from under_review → approved must succeed."""
        sub = self._make_submission(state=KYCState.UNDER_REVIEW)
        response = self.reviewer_client.post(
            f'/api/v1/reviewer/submissions/{sub.id}/transition/',
            {'new_state': 'approved', 'note': 'Documents verified.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(sub.state, KYCState.APPROVED)

    def test_merchant_cannot_access_reviewer_transition_endpoint(self):
        """Merchants must be forbidden from the reviewer transition endpoint."""
        sub = self._make_submission(state=KYCState.UNDER_REVIEW)
        response = self.merchant_client.post(
            f'/api/v1/reviewer/submissions/{sub.id}/transition/',
            {'new_state': 'approved'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    # ── Cross-merchant isolation test ─────────────────────────────────────────

    def test_merchant_cannot_access_other_merchants_submission(self):
        """Merchant B must not be able to retrieve merchant A's submission."""
        other_merchant = make_user('merchant2', role='merchant')
        other_client = auth_client(other_merchant)

        sub = self._make_submission()  # belongs to self.merchant

        response = other_client.get(f'/api/v1/submissions/{sub.id}/')
        # Must be 404 (not 403) — we don't even confirm the submission exists
        self.assertEqual(response.status_code, 404)