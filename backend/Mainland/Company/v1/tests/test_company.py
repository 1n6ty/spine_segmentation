from django.contrib import admin
from django.db import IntegrityError, transaction
from django.test import TestCase
from parler.admin import TranslatableAdmin

from Company.models import Company


class CompanyModelTests(TestCase):
    def test_create_and_str(self):
        company = Company.objects.create(name='Lambumiz')
        self.assertEqual(str(company), 'Lambumiz')

    def test_name_uniqueness_enforced(self):
        Company.objects.create(name='Lambumiz')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Company.objects.create(name='Lambumiz')

    def test_company_admin_registered_as_translatable(self):
        self.assertIsInstance(admin.site._registry[Company], TranslatableAdmin)

    def test_multiple_companies_allowed(self):
        Company.objects.create(name='Acme', slug='acme')
        Company.objects.create(name='Globex', slug='globex')
