from common.permissions.company import IsOwnCompanyPermission

class CompanyRetrievePermission(IsOwnCompanyPermission):
    """Object-level check for CompanyViewSet.retrieve -- own company or
    Company.view_company_any_company (the same permission CompanyViewSet's
    get_permissions() gates 'list' with, via HasPermCodename, at the view level)."""
    any_company_perm = 'Company.view_company_any_company'
