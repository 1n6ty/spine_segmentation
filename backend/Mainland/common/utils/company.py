from Company.models import Company


def get_user_company(user):
    """Returns the Company the given user's Profile belongs to, or None if the
    user has no Profile (e.g. a superuser created outside the normal signup
    flow) or is anonymous."""
    profile = getattr(user, 'profile', None)
    return profile.company if profile else None


def get_user_role(user):
    """Returns the Role the given user's Profile carries, or None if the user
    has no Profile or the Profile has no role assigned."""
    profile = getattr(user, 'profile', None)
    return profile.role if profile else None


def resolve_company_slug_filter(user, slug, *, any_company_perm):
    """Resolves a `company_slug` request filter against the caller's permissions.
    Holders of `any_company_perm` may filter by any company; everyone else may
    only filter by their own company.

    Raises:
        Company.DoesNotExist: if no company matches `slug`.
        PermissionError: if the caller isn't allowed to filter by `slug`.
    """
    company = Company.objects.get(slug=slug)
    if user.has_perm(any_company_perm):
        return company

    own_company = get_user_company(user)
    if own_company is None or own_company.pk != company.pk:
        raise PermissionError("You may only filter by your own company.")
    return company
