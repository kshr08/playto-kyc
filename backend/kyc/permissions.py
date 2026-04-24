from rest_framework.permissions import BasePermission


class IsMerchant(BasePermission):
    """Only allows users with the merchant role."""
    message = "Only merchants can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.is_merchant
        )


class IsReviewer(BasePermission):
    """Only allows users with the reviewer role."""
    message = "Only reviewers can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.is_reviewer
        )


class IsMerchantOrReviewer(BasePermission):
    """Allows both merchants and reviewers."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile')
        )


class IsSubmissionOwnerOrReviewer(BasePermission):
    """
    Object-level: a merchant can only access their own submissions.
    Reviewers can access all.
    """
    message = "You do not have permission to access this submission."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        try:
            profile = request.user.profile
        except Exception:
            return False

        if profile.is_reviewer:
            return True
        if profile.is_merchant:
            return obj.merchant_id == request.user.id
        return False
