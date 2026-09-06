from unittest.mock import patch

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from common.schemas.v1.domain.user import User_Item_Schema
from common.testing.schema_parity import assert_matches_schema
from Company.models import Company
from Profile.models import Profile, Role


class ListProfilesTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        # Django's TestCase.setUpClass() calls setUpTestData() *during*
        # super().setUpClass() -- this must run first, before the group
        # lookup below.
        call_command('sync_roles', verbosity=0)

        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.other_company = Company.objects.create(name='Globex', slug='globex')

        # Created directly (not via one of the create_<role>_role_if_not_exists
        # commands) with a slug unique to this test class, and via
        # translations.update_or_create (not set_current_language()+save(),
        # which leaves stale/empty parler cache state across TestCase
        # savepoints -- see docs/gotchas.md).
        role_group, _ = Group.objects.get_or_create(name='ListProfilesTestRole')
        cls.role = Role.objects.create(slug='list-profiles-test-role', group=role_group)
        cls.role.translations.update_or_create(language_code='en-us', defaults={'name': 'Nurse'})

        # Admin group manager -- Profile.view_profile is managed_companies-scoped
        # with no unscoped bypass tier, so its list is restricted to cls.company
        # (seeded to {cls.company} at Profile creation).
        cls.manager = User.objects.create_user(username='manager', email='manager@example.com', password='pw')
        cls.manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=cls.manager, company=cls.company)

        # An Admin managing BOTH companies -- there is no "any company" tier
        # left; seeing more than one company's users is purely a function of
        # how many companies are in Profile.managed_companies.
        cls.multi_company_manager = User.objects.create_user(
            username='multi_company_manager', email='multi_company_manager@example.com', password='pw',
        )
        cls.multi_company_manager.groups.add(Group.objects.get(name='Admin'))
        multi_profile = Profile.objects.create(user=cls.multi_company_manager, company=cls.company)
        multi_profile.managed_companies.add(cls.other_company)

        cls.plain_user = User.objects.create_user(username='plain', email='plain@example.com', password='pw')
        plain_profile = Profile.objects.create(user=cls.plain_user, company=cls.company)
        plain_profile.roles.set([cls.role])

        cls.other_company_user = User.objects.create_user(
            username='other_plain', email='other_plain@example.com', password='pw',
        )
        Profile.objects.create(user=cls.other_company_user, company=cls.other_company)

        cls.inactive_user = User.objects.create_user(
            username='inactive', email='inactive@example.com', password='pw', is_active=False,
        )
        Profile.objects.create(user=cls.inactive_user, company=cls.company)

        # A user with no Profile at all (e.g. Admin staff) -- with no unscoped
        # tier left, this user can never appear in ANY list() response, since
        # scope_queryset_to_managed_companies filters on profile__company,
        # which requires a Profile to exist at all. Kept here only to confirm
        # it never leaks into any result set below.
        cls.no_profile_user = User.objects.create_user(
            username='noprofile', email='noprofile@example.com', password='pw',
        )

        cls.list_url = reverse('Profile-list')

    def _emails(self, response):
        return {u['email'] for u in response.json()['data']['users']}

    def test_url_shape(self):
        self.assertEqual(self.list_url, '/api/profiles/')

    def test_manager_lists_only_users_in_managed_companies(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            self._emails(response),
            {
                self.manager.email, self.plain_user.email, self.inactive_user.email,
                self.multi_company_manager.email,
            },
        )

    def test_multi_company_manager_lists_users_in_every_managed_company(self):
        self.client.force_login(self.multi_company_manager)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            self._emails(response),
            {
                self.manager.email, self.plain_user.email, self.inactive_user.email,
                self.multi_company_manager.email, self.other_company_user.email,
            },
        )

    def test_manager_company_slug_filter_rejected_for_other_company(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'company_slug': 'globex'})
        self.assertEqual(response.status_code, 403, response.content)

    def test_plain_user_gets_403(self):
        self.client.force_login(self.plain_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 403, response.content)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 401)

    def test_row_matches_user_schema(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url)
        users = {u['email']: u for u in response.json()['data']['users']}
        row = users[self.plain_user.email]

        self.assertEqual(row['company'], {"slug": "acme", "name": "Acme"})
        self.assertEqual(row['roles'], [{"slug": "list-profiles-test-role", "name": "Nurse"}])
        assert_matches_schema(row, User_Item_Schema)

    def test_filter_by_company_slug(self):
        self.client.force_login(self.multi_company_manager)
        response = self.client.get(self.list_url, {'company_slug': 'globex'})
        self.assertEqual(self._emails(response), {self.other_company_user.email})

    def test_filter_by_role_slug(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'role_slug': 'list-profiles-test-role'})
        self.assertEqual(self._emails(response), {self.plain_user.email})

    def test_filter_by_is_active(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'is_active': 'false'})
        self.assertEqual(self._emails(response), {self.inactive_user.email})

    @patch('Profile.v1.filters.profiles.search_users')
    def test_q_search_composes_with_filters(self, mock_search):
        mock_search.return_value = [
            self.plain_user.id, self.other_company_user.id, self.inactive_user.id,
        ]
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'q': 'something', 'company_slug': 'acme'})
        # other_company_user is in the ES results but filtered out by company_slug
        self.assertEqual(self._emails(response), {self.plain_user.email, self.inactive_user.email})
