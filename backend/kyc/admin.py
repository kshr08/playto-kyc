from django.contrib import admin
from .models import UserProfile, KYCSubmission, KYCDocument, NotificationEvent


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role']
    list_filter = ['role']


@admin.register(KYCSubmission)
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant', 'state', 'full_name', 'business_name', 'submitted_at', 'created_at']
    list_filter = ['state']
    search_fields = ['full_name', 'business_name', 'merchant__username']
    readonly_fields = ['created_at', 'updated_at', 'submitted_at', 'reviewed_at']


@admin.register(KYCDocument)
class KYCDocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'submission', 'doc_type', 'original_filename', 'uploaded_at']


@admin.register(NotificationEvent)
class NotificationEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant', 'event_type', 'timestamp']
    list_filter = ['event_type']
