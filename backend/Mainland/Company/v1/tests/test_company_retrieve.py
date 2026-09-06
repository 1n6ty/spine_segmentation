from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from Company.models import Company
from Company.v1.tests.base import create_company_user


class CompanyRetrieveTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Acme', slug='acme')
        cls.other_company = Company.objects.create(name='Globex', slug='globex')

        cls.manager = create_company_user('manager', cls.company, also_manages=[cls.other_company])
        cls.plain_user = create_company_user('plain', cls.company)
        cls.other_company_user = create_company_user('other', cls.other_company)

        cls.url = reverse('Company-detail', kwargs={'company_id': cls.company.pk})

    def test_url_shape(self):
        self.assertEqual(self.url, f'/api/company/{self.company.pk}/')

    def test_manager_can_retrieve_every_managed_company(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], self.company.pk)

        other_url = reverse('Company-detail', kwargs={'company_id': self.other_company.pk})
        response = self.client.get(other_url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], self.other_company.pk)

    def test_plain_user_can_retrieve_own_company(self):
        self.client.force_login(self.plain_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], self.company.pk)

    def test_plain_user_gets_403_for_other_company(self):
        self.client.force_login(self.plain_user)
        other_url = reverse('Company-detail', kwargs={'company_id': self.other_company.pk})
        response = self.client.get(other_url)
        self.assertEqual(response.status_code, 403, response.content)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_nonexistent_returns_404(self):
        self.client.force_login(self.manager)
        url = reverse('Company-detail', kwargs={'company_id': 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_response_contains_full_detail(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.url)
        data = response.json()['data']
        for field in ('id', 'slug', 'name', 'email', 'created_at'):
            self.assertIn(field, data, f'Missing field: {field}')
