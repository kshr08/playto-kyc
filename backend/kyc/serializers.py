import os
import magic  # python-magic for MIME sniffing
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import serializers

from .models import KYCSubmission, KYCDocument, NotificationEvent, UserProfile, KYCState


# ─── Auth Serializers ─────────────────────────────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[('merchant', 'Merchant'), ('reviewer', 'Reviewer')],
        default='merchant'
    )

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data):
        role = validated_data.pop('role', 'merchant')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']

    def get_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return 'merchant'


# ─── Document Serializer ──────────────────────────────────────────────────────

class KYCDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = KYCDocument
        fields = [
            'id', 'doc_type', 'original_filename', 'file_size_bytes',
            'mime_type', 'uploaded_at', 'file_url'
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return None


class DocumentUploadSerializer(serializers.Serializer):
    doc_type = serializers.ChoiceField(choices=KYCDocument.DOC_TYPE_CHOICES)
    file = serializers.FileField()

    def validate_file(self, file):
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 5 * 1024 * 1024)
        allowed_extensions = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', ['.pdf', '.jpg', '.jpeg', '.png'])

        # Size check
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

        # MIME sniffing — don't trust the client
        file.seek(0)
        header = file.read(2048)
        file.seek(0)

        try:
            detected_mime = magic.from_buffer(header, mime=True)
        except Exception:
            # Fallback: infer from extension if magic unavailable
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

        # Attach detected mime for later use
        file._detected_mime = detected_mime
        return file


# ─── KYC Submission Serializers ───────────────────────────────────────────────

class KYCSubmissionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    merchant_username = serializers.CharField(source='merchant.username', read_only=True)
    is_at_risk = serializers.SerializerMethodField()
    time_in_queue_minutes = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = KYCSubmission
        fields = [
            'id', 'merchant_username', 'state', 'full_name', 'business_name',
            'business_type', 'submitted_at', 'created_at', 'updated_at',
            'is_at_risk', 'time_in_queue_minutes', 'document_count',
        ]

    def get_is_at_risk(self, obj):
        return obj.is_at_risk

    def get_time_in_queue_minutes(self, obj):
        return obj.time_in_queue_minutes

    def get_document_count(self, obj):
        return obj.documents.count()


class KYCSubmissionDetailSerializer(serializers.ModelSerializer):
    """Full serializer for detail views."""
    merchant_username = serializers.CharField(source='merchant.username', read_only=True)
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True, allow_null=True)
    documents = KYCDocumentSerializer(many=True, read_only=True)
    is_at_risk = serializers.SerializerMethodField()
    time_in_queue_minutes = serializers.SerializerMethodField()

    class Meta:
        model = KYCSubmission
        fields = [
            'id', 'merchant_username', 'reviewer_username', 'state',
            # Personal
            'full_name', 'email', 'phone',
            # Business
            'business_name', 'business_type', 'expected_monthly_volume_usd',
            # Reviewer
            'reviewer_note',
            # Documents
            'documents',
            # Timestamps
            'submitted_at', 'reviewed_at', 'created_at', 'updated_at',
            # Computed
            'is_at_risk', 'time_in_queue_minutes',
        ]

    def get_is_at_risk(self, obj):
        return obj.is_at_risk

    def get_time_in_queue_minutes(self, obj):
        return obj.time_in_queue_minutes


class KYCSubmissionSaveSerializer(serializers.ModelSerializer):
    """Used by merchants to save draft progress."""

    class Meta:
        model = KYCSubmission
        fields = [
            'full_name', 'email', 'phone',
            'business_name', 'business_type', 'expected_monthly_volume_usd',
        ]


class StateTransitionSerializer(serializers.Serializer):
    """Used by reviewers (and merchants for re-submit) to change state."""
    new_state = serializers.ChoiceField(choices=KYCState.CHOICES)
    note = serializers.CharField(required=False, allow_blank=True, default='')


# ─── Notification Serializer ──────────────────────────────────────────────────

class NotificationEventSerializer(serializers.ModelSerializer):
    merchant_username = serializers.CharField(source='merchant.username', read_only=True)

    class Meta:
        model = NotificationEvent
        fields = ['id', 'merchant_username', 'submission', 'event_type', 'timestamp', 'payload']
