from django.test import SimpleTestCase
from django.urls import Resolver404, resolve, reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Company.v1.tests.base import create_company_user


class CompanyVersionedUrlsTests(SimpleTestCase):
    """Every Company/v1/ route is double-mounted -- bare (/api/company/...) and
    v1-prefixed (/api/company/v1/...), see Company/urls.py and docs/patterns/urls.md.
    `reverse()` only ever returns the bare form -- this confirms the v1-prefixed
    alias actually resolves to the identical view for every registered name.
    """

    _ROUTES = [
        ('Company-list', {}),
        ('Company-detail', {'company_id': 1}),
    ]

    def test_every_route_is_double_mounted_identically(self):
        for name, kwargs in self._ROUTES:
            with self.subTest(name=name):
                bare = reverse(name, kwargs=kwargs)
                self.assertTrue(
                    bare.startswith('/api/company/') and not bare.startswith('/api/company/v1/'),
                    f'{name} did not reverse to the expected bare form: {bare}',
                )
                versioned = bare.replace('/api/company/', '/api/company/v1/', 1)

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
            resolve('/api/company/v1/this-route-does-not-exist/')


class CompanyVersionedUrlsEndToEndTests(APITestCase):
    """Belt-and-suspenders real HTTP check beyond the routing-table-only
    assertions above -- confirms the v1-prefixed mount actually serves a
    response through it, not just resolves to the right view on paper."""

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.manager = create_company_user('manager', cls.company, can_view_any_company=True)

    def test_versioned_list_url_serves_real_response(self):
        self.client.force_login(self.manager)
        response = self.client.get('/api/company/v1/')
        self.assertEqual(response.status_code, 200, response.content)

    def test_versioned_detail_url_serves_real_response(self):
        self.client.force_login(self.manager)
        response = self.client.get(f'/api/company/v1/{self.company.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], self.company.pk)
