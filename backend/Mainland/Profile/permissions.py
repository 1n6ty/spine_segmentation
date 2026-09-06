from rest_framework.permissions import BasePermission


class CanChangeProfilePermission(BasePermission):
    """Coarse view-level gate: self-edit always allowed; editing another
    profile requires at least one of the granular Profile.change_profile*
    permissions below. The *specific* permission needed for a given PATCH
    depends on which fields actually changed (basic fields vs role vs
    company vs password) -- checked separately in the view, since that gate
    applies per-field, not per-request."""

    SENSITIVE_PERMS = (
        'Profile.change_profile_role',
        'Profile.change_profile_company',
        'Profile.reset_profile_password',
    )

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        user_id = view.kwargs.get(view.lookup_url_kwarg)
        if str(request.user.pk) == str(user_id):
            return True
        return (
            request.user.has_perm('Profile.change_profile')
            or any(request.user.has_perm(perm) for perm in self.SENSITIVE_PERMS)
        )
