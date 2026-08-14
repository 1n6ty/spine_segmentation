from django.contrib.auth.models import Permission, User

from Profile.models import Profile


def create_company_user(username, company, *, can_view_any_company=False):
    """Creates a User with a Profile scoped to `company`, optionally holding the
    `view_company_any_company` permission -- the one codename CompanyViewSet's
    `list` (view-level) and `retrieve` (object-level bypass) actually check.
    Shared by every Company test module that needs a company-scoped user."""
    user = User.objects.create_user(username=username, password='pw')
    Profile.objects.create(user=user, company=company)
    if can_view_any_company:
        permission = Permission.objects.get(
            codename='view_company_any_company',
            content_type__app_label='Company',
        )
        user.user_permissions.add(permission)
    return user
