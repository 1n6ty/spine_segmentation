from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Company.v1.tests.base import create_company_user


class CompanyListTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.other_company = Company.objects.create(name='Globex', slug='globex')

        cls.manager = create_company_user('manager', cls.company, can_view_any_company=True)
        cls.plain_user = create_company_user('plain', cls.company)

        cls.list_url = reverse('Company-list')

    def test_url_shape(self):
        self.assertEqual(self.list_url, '/api/company/')

    def test_manager_sees_all_companies(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()['data']
        self.assertIn('companies', data)
        self.assertEqual(len(data['companies']), 2)
        slugs = {c['slug'] for c in data['companies']}
        self.assertEqual(slugs, {'acme', 'globex'})

    def test_non_manager_gets_403(self):
        self.client.force_login(self.plain_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 403, response.content)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 401)
