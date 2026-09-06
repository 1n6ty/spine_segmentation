from django.contrib.auth.models import User
from django.test import TestCase

from Company.models import Company
from common.utils.company import scope_queryset_to_managed_companies
from Profile.models import Profile


class ManagedCompaniesSeedingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.other_company = Company.objects.create(name='Globex', slug='globex')

    def test_seeded_to_home_company_on_creation(self):
        user = User.objects.create_user(username='plain', password='pw')
        profile = Profile.objects.create(user=user, company=self.company)
        self.assertEqual(list(profile.managed_companies.all()), [self.company])

    def test_not_re_pinned_on_later_save(self):
        """Editing managed_companies after creation must stick -- there is no
        ongoing invariant re-syncing it back to {company} on every save."""
        user = User.objects.create_user(username='plain2', password='pw')
        profile = Profile.objects.create(user=user, company=self.company)
        profile.managed_companies.add(self.other_company)

        profile.patronymic = 'Changed'
        profile.save()

        self.assertCountEqual(profile.managed_companies.all(), [self.company, self.other_company])


class ScopeQuerysetToManagedCompaniesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.other_company = Company.objects.create(name='Globex', slug='globex')

    def test_scopes_to_managed_companies(self):
        user = User.objects.create_user(username='scoped', password='pw')
        Profile.objects.create(user=user, company=self.company)

        in_scope = User.objects.create_user(username='in_scope', password='pw')
        Profile.objects.create(user=in_scope, company=self.company)

        out_of_scope = User.objects.create_user(username='out_of_scope', password='pw')
        Profile.objects.create(user=out_of_scope, company=self.other_company)

        qs = scope_queryset_to_managed_companies(user, User.objects.all(), company_field='profile__company')
        self.assertCountEqual(qs, [user, in_scope])

    def test_no_profile_returns_empty_queryset(self):
        user = User.objects.create_user(username='noprofile', password='pw')
        qs = scope_queryset_to_managed_companies(user, User.objects.all(), company_field='profile__company')
        self.assertFalse(qs.exists())

    def test_cache_is_invalidated_when_managed_companies_changes(self):
        user = User.objects.create_user(username='cacheduser', password='pw')
        profile = Profile.objects.create(user=user, company=self.company)

        # Populates the cache with just {self.company}.
        scope_queryset_to_managed_companies(user, User.objects.all(), company_field='profile__company')

        profile.managed_companies.add(self.other_company)

        other_company_user = User.objects.create_user(username='othercompanyuser', password='pw')
        Profile.objects.create(user=other_company_user, company=self.other_company)

        qs = scope_queryset_to_managed_companies(user, User.objects.all(), company_field='profile__company')
        self.assertIn(other_company_user, qs)
