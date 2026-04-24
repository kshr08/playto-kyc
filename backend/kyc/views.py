import os
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import KYCSubmission, KYCDocument, KYCState, NotificationEvent, UserProfile
from .notifications import log_notification
from .permissions import (
    IsMerchant, IsReviewer, IsSubmissionOwnerOrReviewer, IsMerchantOrReviewer
)
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    KYCSubmissionListSerializer, KYCSubmissionDetailSerializer,
    KYCSubmissionSaveSerializer, StateTransitionSerializer,
    DocumentUploadSerializer, KYCDocumentSerializer, NotificationEventSerializer,
)


def success(data=None, message=None, status_code=200):
    body = {'error': False}
    if message:
        body['message'] = message
    if data is not None:
        body['data'] = data
    return Response(body, status=status_code)


def error(message, detail=None, status_code=400):
    body = {'error': True, 'message': message}
    if detail is not None:
        body['detail'] = detail
    return Response(body, status=status_code)


# ─── Auth Views ───────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error("Registration failed.", serializer.errors)

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return success(
            {'token': token.key, 'user': UserSerializer(user).data},
            "Account created successfully.",
            status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error("Invalid input.", serializer.errors)

        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if not user:
            return error("Invalid username or password.", status_code=401)

        token, _ = Token.objects.get_or_create(user=user)
        return success(
            {'token': token.key, 'user': UserSerializer(user).data},
            "Login successful."
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success(UserSerializer(request.user).data)


# ─── Merchant: KYC Submission ─────────────────────────────────────────────────

class MerchantSubmissionListView(APIView):
    """Merchant sees only their own submissions."""
    permission_classes = [IsMerchant]

    def get(self, request):
        submissions = KYCSubmission.objects.filter(merchant=request.user)
        serializer = KYCSubmissionListSerializer(submissions, many=True, context={'request': request})
        return success(serializer.data)

    def post(self, request):
        """Create a new draft submission."""
        # Prevent duplicate active drafts
        existing_draft = KYCSubmission.objects.filter(
            merchant=request.user, state=KYCState.DRAFT
        ).first()
        if existing_draft:
            return success(
                KYCSubmissionDetailSerializer(existing_draft, context={'request': request}).data,
                "Existing draft returned.",
            )

        submission = KYCSubmission.objects.create(merchant=request.user)
        serializer = KYCSubmissionDetailSerializer(submission, context={'request': request})
        return success(serializer.data, "Draft created.", status.HTTP_201_CREATED)


class MerchantSubmissionDetailView(APIView):
    permission_classes = [IsMerchant, IsSubmissionOwnerOrReviewer]

    def get_object(self, pk, user):
        try:
            sub = KYCSubmission.objects.get(pk=pk, merchant=user)
        except KYCSubmission.DoesNotExist:
            return None
        return sub

    def get(self, request, pk):
        sub = self.get_object(pk, request.user)
        if not sub:
            return error("Submission not found.", status_code=404)
        serializer = KYCSubmissionDetailSerializer(sub, context={'request': request})
        return success(serializer.data)

    def patch(self, request, pk):
        """Save draft progress — only allowed in draft or more_info_requested."""
        sub = self.get_object(pk, request.user)
        if not sub:
            return error("Submission not found.", status_code=404)

        if sub.state not in (KYCState.DRAFT, KYCState.MORE_INFO_REQUESTED):
            return error(
                f"Cannot edit a submission in '{sub.state}' state. "
                "Only draft or more_info_requested submissions can be edited."
            )

        serializer = KYCSubmissionSaveSerializer(sub, data=request.data, partial=True)
        if not serializer.is_valid():
            return error("Validation failed.", serializer.errors)

        serializer.save()
        return success(
            KYCSubmissionDetailSerializer(sub, context={'request': request}).data,
            "Progress saved."
        )


class MerchantSubmitView(APIView):
    """Merchant submits their KYC for review."""
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        try:
            sub = KYCSubmission.objects.get(pk=pk, merchant=request.user)
        except KYCSubmission.DoesNotExist:
            return error("Submission not found.", status_code=404)

        # Basic completeness check
        missing = []
        for field in ('full_name', 'email', 'phone', 'business_name', 'business_type'):
            if not getattr(sub, field):
                missing.append(field)
        if sub.expected_monthly_volume_usd is None:
            missing.append('expected_monthly_volume_usd')
        if not sub.documents.exists():
            missing.append('documents (at least one required)')

        if missing:
            return error(
                f"Submission is incomplete. Missing: {', '.join(missing)}."
            )

        old_state = sub.state
        try:
            sub.transition_to(KYCState.SUBMITTED)
        except ValueError as e:
            return error(str(e))

        log_notification(sub, KYCState.SUBMITTED, old_state)
        return success(
            KYCSubmissionDetailSerializer(sub, context={'request': request}).data,
            "KYC submitted for review."
        )


# ─── Document Upload ──────────────────────────────────────────────────────────

class DocumentUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        try:
            sub = KYCSubmission.objects.get(pk=pk, merchant=request.user)
        except KYCSubmission.DoesNotExist:
            return error("Submission not found.", status_code=404)

        if sub.state not in (KYCState.DRAFT, KYCState.MORE_INFO_REQUESTED):
            return error(
                f"Documents can only be uploaded when submission is in draft or "
                f"more_info_requested state. Current state: '{sub.state}'."
            )

        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return error("File upload failed.", serializer.errors)

        file = serializer.validated_data['file']
        doc_type = serializer.validated_data['doc_type']

        # Replace existing doc of same type
        sub.documents.filter(doc_type=doc_type).delete()

        detected_mime = getattr(file, '_detected_mime', 'application/octet-stream')

        doc = KYCDocument.objects.create(
            submission=sub,
            doc_type=doc_type,
            file=file,
            original_filename=file.name,
            file_size_bytes=file.size,
            mime_type=detected_mime,
        )
        return success(
            KYCDocumentSerializer(doc, context={'request': request}).data,
            "Document uploaded.",
            status.HTTP_201_CREATED,
        )

    def delete(self, request, pk, doc_id):
        try:
            sub = KYCSubmission.objects.get(pk=pk, merchant=request.user)
        except KYCSubmission.DoesNotExist:
            return error("Submission not found.", status_code=404)

        if sub.state not in (KYCState.DRAFT, KYCState.MORE_INFO_REQUESTED):
            return error("Cannot delete documents in current state.")

        try:
            doc = sub.documents.get(pk=doc_id)
        except KYCDocument.DoesNotExist:
            return error("Document not found.", status_code=404)

        doc.file.delete(save=False)
        doc.delete()
        return success(message="Document deleted.")


# ─── Reviewer Views ───────────────────────────────────────────────────────────

class ReviewerQueueView(APIView):
    """Returns paginated review queue, oldest submitted first."""
    permission_classes = [IsReviewer]

    def get(self, request):
        state_filter = request.query_params.get('state', None)
        qs = KYCSubmission.objects.select_related('merchant', 'reviewer').prefetch_related('documents')

        if state_filter:
            qs = qs.filter(state=state_filter)
        else:
            # Default queue: actionable states
            qs = qs.filter(state__in=[
                KYCState.SUBMITTED, KYCState.UNDER_REVIEW, KYCState.MORE_INFO_REQUESTED
            ])

        serializer = KYCSubmissionListSerializer(qs, many=True, context={'request': request})
        return success(serializer.data)


class ReviewerSubmissionDetailView(APIView):
    """Reviewer views full submission detail."""
    permission_classes = [IsReviewer]

    def get(self, request, pk):
        try:
            sub = KYCSubmission.objects.select_related('merchant', 'reviewer').prefetch_related('documents').get(pk=pk)
        except KYCSubmission.DoesNotExist:
            return error("Submission not found.", status_code=404)

        serializer = KYCSubmissionDetailSerializer(sub, context={'request': request})
        return success(serializer.data)


class ReviewerTransitionView(APIView):
    """
    Reviewer transitions a submission state.
    Enforces legal transitions via the KYCState state machine.
    """
    permission_classes = [IsReviewer]

    def post(self, request, pk):
        try:
            sub = KYCSubmission.objects.get(pk=pk)
        except KYCSubmission.DoesNotExist:
            return error("Submission not found.", status_code=404)

        serializer = StateTransitionSerializer(data=request.data)
        if not serializer.is_valid():
            return error("Invalid input.", serializer.errors)

        new_state = serializer.validated_data['new_state']
        note = serializer.validated_data.get('note', '')

        # Reviewers can only set reviewer-specific states
        reviewer_allowed = {
            KYCState.UNDER_REVIEW,
            KYCState.APPROVED,
            KYCState.REJECTED,
            KYCState.MORE_INFO_REQUESTED,
        }
        if new_state not in reviewer_allowed:
            return error(
                f"Reviewers cannot set state to '{new_state}'. "
                f"Allowed: {sorted(reviewer_allowed)}."
            )

        if new_state in (KYCState.REJECTED, KYCState.MORE_INFO_REQUESTED) and not note:
            return error("A note is required when rejecting or requesting more information.")

        old_state = sub.state
        try:
            sub.transition_to(new_state, reviewer=request.user, note=note)
        except ValueError as e:
            return error(str(e))

        log_notification(sub, new_state, old_state, {'reviewer': request.user.username})

        return success(
            KYCSubmissionDetailSerializer(sub, context={'request': request}).data,
            f"Submission moved to '{new_state}'."
        )


class ReviewerDashboardView(APIView):
    """Metrics for the reviewer dashboard."""
    permission_classes = [IsReviewer]

    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        queue_states = [KYCState.SUBMITTED, KYCState.UNDER_REVIEW, KYCState.MORE_INFO_REQUESTED]
        in_queue = KYCSubmission.objects.filter(state__in=queue_states).count()

        # At-risk: in queue and submitted > 24 hours ago
        sla_cutoff = now - timedelta(hours=24)
        at_risk = KYCSubmission.objects.filter(
            state__in=queue_states,
            submitted_at__lt=sla_cutoff,
        ).count()

        # Average time in queue (minutes) for submissions reviewed in last 7 days
        reviewed_recently = KYCSubmission.objects.filter(
            reviewed_at__gte=seven_days_ago,
            submitted_at__isnull=False,
            reviewed_at__isnull=False,
        )
        avg_minutes = None
        if reviewed_recently.exists():
            total_minutes = sum(
                (s.reviewed_at - s.submitted_at).total_seconds() / 60
                for s in reviewed_recently
            )
            avg_minutes = round(total_minutes / reviewed_recently.count())

        # Approval rate over last 7 days
        decided = KYCSubmission.objects.filter(
            state__in=[KYCState.APPROVED, KYCState.REJECTED],
            reviewed_at__gte=seven_days_ago,
        )
        total_decided = decided.count()
        approved_count = decided.filter(state=KYCState.APPROVED).count()
        approval_rate = round((approved_count / total_decided * 100), 1) if total_decided else None

        # Recent activity
        recent_submissions = KYCSubmission.objects.filter(
            submitted_at__gte=seven_days_ago
        ).count()

        return success({
            'queue': {
                'total_in_queue': in_queue,
                'at_risk_count': at_risk,
            },
            'sla': {
                'average_time_in_queue_minutes': avg_minutes,
            },
            'last_7_days': {
                'total_submitted': recent_submissions,
                'total_decided': total_decided,
                'approved': approved_count,
                'rejected': total_decided - approved_count,
                'approval_rate_pct': approval_rate,
            },
        })


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationListView(APIView):
    """
    Reviewers see all notifications.
    Merchants see only their own.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            return error("User profile not found.", status_code=400)

        if profile.is_reviewer:
            events = NotificationEvent.objects.select_related('merchant', 'submission').all()[:100]
        else:
            events = NotificationEvent.objects.filter(merchant=request.user).select_related('submission')[:50]

        serializer = NotificationEventSerializer(events, many=True)
        return success(serializer.data)
