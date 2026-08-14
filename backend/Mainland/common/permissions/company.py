from rest_framework.permissions import BasePermission

from common.utils.company import get_user_company


class IsOwnCompanyPermission(BasePermission):
    """Object-level check for a view whose object *is* a Company (not an entity
    that merely belongs to one). Bypassed by holders of `any_company_perm`
    (set as a class attribute on a subclass, e.g.
    `any_company_perm = 'Company.view_company_any_company'`); otherwise the
    object must be the caller's own company, via their Profile."""

    any_company_perm: str = ""

    def has_object_permission(self, request, view, obj):
        if self.any_company_perm and request.user.has_perm(self.any_company_perm):
            return True
        company = get_user_company(request.user)
        return company is not None and obj.pk == company.pk
