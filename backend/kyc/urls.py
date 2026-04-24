from django.urls import path
from .views import (
    RegisterView, LoginView, MeView,
    MerchantSubmissionListView, MerchantSubmissionDetailView,
    MerchantSubmitView, DocumentUploadView,
    ReviewerQueueView, ReviewerSubmissionDetailView,
    ReviewerTransitionView, ReviewerDashboardView,
    NotificationListView,
)

urlpatterns = [
    # ── Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/me/', MeView.as_view(), name='me'),

    # ── Merchant: submissions
    path('submissions/', MerchantSubmissionListView.as_view(), name='submission-list'),
    path('submissions/<int:pk>/', MerchantSubmissionDetailView.as_view(), name='submission-detail'),
    path('submissions/<int:pk>/submit/', MerchantSubmitView.as_view(), name='submission-submit'),

    # ── Merchant: documents
    path('submissions/<int:pk>/documents/', DocumentUploadView.as_view(), name='document-upload'),
    path('submissions/<int:pk>/documents/<int:doc_id>/', DocumentUploadView.as_view(), name='document-delete'),

    # ── Reviewer
    path('reviewer/queue/', ReviewerQueueView.as_view(), name='reviewer-queue'),
    path('reviewer/submissions/<int:pk>/', ReviewerSubmissionDetailView.as_view(), name='reviewer-submission-detail'),
    path('reviewer/submissions/<int:pk>/transition/', ReviewerTransitionView.as_view(), name='reviewer-transition'),
    path('reviewer/dashboard/', ReviewerDashboardView.as_view(), name='reviewer-dashboard'),

    # ── Notifications
    path('notifications/', NotificationListView.as_view(), name='notifications'),
]
