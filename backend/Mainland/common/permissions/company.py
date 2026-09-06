from rest_framework.permissions import BasePermission


class ManagedCompanyPermission(BasePermission):
    """Object-level check scoped to `Profile.managed_companies` -- the sole
    company-scoping mechanism; no role carries scope itself, and there is no
    unscoped "any company" bypass tier.

    `is_company_row=True` checks the object itself (a Company row); otherwise
    the object is assumed to carry a `company_id` FK (e.g. a Profile)."""

    def __init__(self, is_company_row: bool = False):
        self.is_company_row = is_company_row

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            return False
        target_id = obj.pk if self.is_company_row else obj.company_id
        return profile.managed_companies.filter(pk=target_id).exists()
