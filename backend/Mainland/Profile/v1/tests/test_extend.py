from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Profile.models import Profile, Role

# Fields that only ever appear on the full (Item) shape, never on the ref shape --
# see docs/patterns/extend.md.
_COMPANY_ITEM_ONLY_FIELDS = ('id', 'email', 'created_at')
_ROLE_ITEM_ONLY_FIELDS = ('id',)


class ProfilesExtendTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        call_command('create_admin_role_if_not_exists', verbosity=0)
        call_command('create_viewer_role_if_not_exists', verbosity=0)
        call_command('create_doctor_role_if_not_exists', verbosity=0)

        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.role = Role.objects.get(slug='doctor')

        cls.manager = User.objects.create_user(username='manager', password='pw')
        cls.manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=cls.manager, company=cls.company, role=cls.role)

        cls.list_url = reverse('Profile-list')
        cls.me_url = reverse('Profile-me')
        cls.detail_url = reverse('Profile-detail', kwargs={'user_id': cls.manager.pk})

    # ── list ─────────────────────────────────────────────────────────────

    def test_list_default_company_is_ref_shape(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200, response.content)
        user = next(u for u in response.json()['data']['users'] if u['id'] == self.manager.pk)
        for field in _COMPANY_ITEM_ONLY_FIELDS:
            self.assertNotIn(field, user['company'], f'Unexpected full-shape field: {field}')
        for field in _ROLE_ITEM_ONLY_FIELDS:
            self.assertNotIn(field, user['role'], f'Unexpected full-shape field: {field}')

    def test_list_extend_company_and_role_return_full_shape(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'extend': 'company,role'})
        self.assertEqual(response.status_code, 200, response.content)
        user = next(u for u in response.json()['data']['users'] if u['id'] == self.manager.pk)
        for field in _COMPANY_ITEM_ONLY_FIELDS:
            self.assertIn(field, user['company'], f'Missing full-shape field: {field}')
        for field in _ROLE_ITEM_ONLY_FIELDS:
            self.assertIn(field, user['role'], f'Missing full-shape field: {field}')

    def test_list_extend_unknown_field_is_400(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url, {'extend': 'not_a_real_field'})
        self.assertEqual(response.status_code, 400, response.content)

    # ── get_me ───────────────────────────────────────────────────────────

    def test_me_default_company_is_ref_shape(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, 200, response.content)
        for field in _COMPANY_ITEM_ONLY_FIELDS:
            self.assertNotIn(field, response.json()['data']['company'], f'Unexpected full-shape field: {field}')

    def test_me_extend_company_returns_full_shape(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.me_url, {'extend': 'company'})
        self.assertEqual(response.status_code, 200, response.content)
        for field in _COMPANY_ITEM_ONLY_FIELDS:
            self.assertIn(field, response.json()['data']['company'], f'Missing full-shape field: {field}')

    def test_me_extend_unknown_field_is_400(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.me_url, {'extend': 'not_a_real_field'})
        self.assertEqual(response.status_code, 400, response.content)

    # ── partial_update ───────────────────────────────────────────────────

    def test_partial_update_extend_role_returns_full_shape(self):
        self.client.force_login(self.manager)
        response = self.client.patch(f'{self.detail_url}?extend=role', {'patronymic': 'Ivanovich'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        for field in _ROLE_ITEM_ONLY_FIELDS:
            self.assertIn(field, response.json()['data']['role'], f'Missing full-shape field: {field}')

    def test_partial_update_default_role_is_ref_shape(self):
        self.client.force_login(self.manager)
        response = self.client.patch(self.detail_url, {'patronymic': 'Ivanovich'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        for field in _ROLE_ITEM_ONLY_FIELDS:
            self.assertNotIn(field, response.json()['data']['role'], f'Unexpected full-shape field: {field}')

    def test_partial_update_extend_unknown_field_is_400(self):
        self.client.force_login(self.manager)
        response = self.client.patch(f'{self.detail_url}?extend=not_a_real_field', {'patronymic': 'Ivanovich'}, format='json')
        self.assertEqual(response.status_code, 400, response.content)
