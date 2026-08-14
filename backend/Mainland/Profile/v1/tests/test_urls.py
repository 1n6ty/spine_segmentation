from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.test import SimpleTestCase
from django.urls import Resolver404, resolve, reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Profile.models import Profile


class ProfileVersionedUrlsTests(SimpleTestCase):
    """Every Profile/v1/ route is double-mounted -- bare (/api/profiles/...) and
    v1-prefixed (/api/profiles/v1/...), see Profile/urls.py and docs/patterns/urls.md.
    `reverse()` only ever returns the bare form (see docs/testing.md's URL-shape
    rule) -- this confirms the v1-prefixed alias actually resolves to the
    identical view for every registered name. Mirrors Order/v1/tests/test_urls.py.
    """

    _ROUTES = [
        ('Profile-list', {}),
        ('Profile-detail', {'user_id': 1}),
        ('Profile-me', {}),
    ]

    def test_every_route_is_double_mounted_identically(self):
        for name, kwargs in self._ROUTES:
            with self.subTest(name=name):
                bare = reverse(name, kwargs=kwargs)
                self.assertTrue(
                    bare.startswith('/api/profiles/') and not bare.startswith('/api/profiles/v1/'),
                    f'{name} did not reverse to the expected bare form: {bare}',
                )
                versioned = bare.replace('/api/profiles/', '/api/profiles/v1/', 1)

                bare_match = resolve(bare)
                versioned_match = resolve(versioned)
                self.assertEqual(
                    bare_match.func, versioned_match.func,
                    f'{name}: bare and v1 mounts resolve to different views',
                )
                self.assertEqual(
                    bare_match.kwargs, versioned_match.kwargs,
                    f'{name}: bare and v1 mounts resolve with different kwargs',
                )

    def test_route_missing_from_one_mount_would_fail_loudly(self):
        with self.assertRaises(Resolver404):
            resolve('/api/profiles/v1/this-route-does-not-exist/')


class ProfileVersionedUrlsEndToEndTests(APITestCase):
    """Belt-and-suspenders real HTTP check beyond the routing-table-only
    assertions above -- confirms the v1-prefixed mount actually serves a
    response through it, not just resolves to the right view on paper."""

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        call_command('create_admin_role_if_not_exists', verbosity=0)
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.manager = User.objects.create_user(username='manager', password='pw')
        cls.manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=cls.manager, company=cls.company)

    def test_versioned_list_url_serves_real_response(self):
        self.client.force_login(self.manager)
        response = self.client.get('/api/profiles/v1/')
        self.assertEqual(response.status_code, 200, response.content)

    def test_versioned_me_url_serves_real_response(self):
        self.client.force_login(self.manager)
        response = self.client.get('/api/profiles/v1/me/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], self.manager.pk)
