from rest_framework.permissions import BasePermission


class CanChangeProfilePermission(BasePermission):
    """Self-edit always allowed; editing another user's profile, or actually
    changing role/company to a different value on any profile (including
    your own), requires Profile.change_sensitive_profile_data -- checked
    separately in the view since that gate applies per-field, not
    per-request."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        user_id = view.kwargs.get(view.lookup_url_kwarg)
        if str(request.user.pk) == str(user_id):
            return True
        return request.user.has_perm('Profile.change_sensitive_profile_data')
