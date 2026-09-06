from django.contrib.auth.models import User

from Profile.models import Profile


def create_company_user(username, company, *, also_manages=()):
    """Creates a User with a Profile scoped to `company` (managed_companies
    seeded to {company} at creation). `also_manages` adds further companies to
    managed_companies -- there is no unscoped "any company" tier, so seeing
    more than one company's data is purely a function of managed_companies
    membership. Shared by every Company test module that needs a
    company-scoped user."""
    user = User.objects.create_user(username=username, password='pw')
    profile = Profile.objects.create(user=user, company=company)
    if also_manages:
        profile.managed_companies.add(*also_manages)
    return user
