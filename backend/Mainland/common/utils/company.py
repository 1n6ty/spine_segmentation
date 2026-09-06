from django.core.cache import cache

from Company.models import Company

_MANAGED_COMPANIES_CACHE_KEY = 'Profile:{}:managed_companies'
_MANAGED_COMPANIES_CACHE_TTL = 300


def _managed_companies_cache_key(profile_id):
    return _MANAGED_COMPANIES_CACHE_KEY.format(profile_id)


def invalidate_managed_companies_cache(profile_id):
    """Called from Profile.models' m2m_changed receiver on
    Profile.managed_companies.through -- whenever that relation is edited, the
    cached id list below is stale and must be dropped, not patched in place."""
    cache.delete(_managed_companies_cache_key(profile_id))


def get_user_company(user):
    """Returns the Company the given user's Profile belongs to, or None if the
    user has no Profile (e.g. a superuser created outside the normal signup
    flow) or is anonymous."""
    profile = getattr(user, 'profile', None)
    return profile.company if profile else None


def get_user_roles(user):
    """Returns the Roles the given user's Profile holds (M2M -- a profile can
    hold several at once), or None if the user has no Profile."""
    profile = getattr(user, 'profile', None)
    return profile.roles.all() if profile else None


def resolve_managed_company_slug_filter(user, slug):
    """Resolves a `company_slug` request filter against the caller's
    Profile.managed_companies -- the sole company-scoping mechanism, no
    unscoped bypass tier. Checked before Company.DoesNotExist so a caller
    can't use this to probe which slugs exist.

    Raises:
        Company.DoesNotExist: if no company matches `slug` (only reached once
            the caller is confirmed to have access -- see above).
        PermissionError: if the caller has no Profile, or `slug` isn't among
            their managed_companies.
    """
    profile = getattr(user, 'profile', None)
    if profile is None:
        raise PermissionError("You do not have permission to filter by company.")
    try:
        return profile.managed_companies.get(slug=slug)
    except Company.DoesNotExist:
        raise PermissionError("You do not have permission to filter by another company.")


def scope_queryset_to_managed_companies(user, qs, company_field='company'):
    """Restricts qs to rows whose company is among the caller's
    Profile.managed_companies. Returns an empty queryset if the user has no
    Profile.

    The managed-company id list is cached per profile (see
    _MANAGED_COMPANIES_CACHE_KEY) rather than re-querying the M2M on every
    call -- invalidated by Profile.models' m2m_changed receiver whenever
    managed_companies is actually edited, not by a timeout race."""
    profile = getattr(user, 'profile', None)
    if profile is None:
        return qs.none()

    key = _managed_companies_cache_key(profile.pk)
    company_ids = cache.get(key)
    if company_ids is None:
        company_ids = list(profile.managed_companies.values_list('pk', flat=True))
        cache.set(key, company_ids, _MANAGED_COMPANIES_CACHE_TTL)

    return qs.filter(**{f'{company_field}__in': company_ids})
