from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Profile.models import Profile


class DestroyProfileTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        call_command('create_admin_role_if_not_exists', verbosity=0)

        cls.company = Company.objects.create(name='Acme', slug='acme')

        cls.manager = User.objects.create_user(username='manager', email='manager@example.com', password='pw')
        cls.manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=cls.manager, company=cls.company)

        cls.plain_user = User.objects.create_user(username='plain', email='plain@example.com', password='pw')
        Profile.objects.create(user=cls.plain_user, company=cls.company)

    def _url(self, user_id):
        return reverse('Profile-detail', kwargs={'user_id': user_id})

    def test_manager_deactivates_user(self):
        target = User.objects.create_user(username='target', email='target@example.com', password='pw')
        Profile.objects.create(user=target, company=self.company)

        self.client.force_login(self.manager)
        response = self.client.delete(self._url(target.pk))

        self.assertEqual(response.status_code, 204, response.content)
        target.refresh_from_db()
        self.assertFalse(target.is_active)

    def test_deactivated_user_row_is_kept_not_deleted(self):
        target = User.objects.create_user(username='keptrow', email='keptrow@example.com', password='pw')
        Profile.objects.create(user=target, company=self.company)

        self.client.force_login(self.manager)
        self.client.delete(self._url(target.pk))

        self.assertTrue(User.objects.filter(pk=target.pk).exists())
        self.assertTrue(Profile.objects.filter(user_id=target.pk).exists())

    def test_plain_user_gets_403(self):
        target = User.objects.create_user(username='target2', email='target2@example.com', password='pw')
        Profile.objects.create(user=target, company=self.company)

        self.client.force_login(self.plain_user)
        response = self.client.delete(self._url(target.pk))

        self.assertEqual(response.status_code, 403, response.content)
        target.refresh_from_db()
        self.assertTrue(target.is_active)

    def test_unauthenticated_returns_401(self):
        target = User.objects.create_user(username='target3', email='target3@example.com', password='pw')
        Profile.objects.create(user=target, company=self.company)

        response = self.client.delete(self._url(target.pk))

        self.assertEqual(response.status_code, 401)

    def test_not_found_returns_404(self):
        self.client.force_login(self.manager)
        response = self.client.delete(self._url(999999))

        self.assertEqual(response.status_code, 404, response.content)
