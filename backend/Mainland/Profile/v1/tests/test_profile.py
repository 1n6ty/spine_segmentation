from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.test import TestCase

from Company.models import Company
from Profile.models import Profile


class ProfileModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='plain', password='pw')
        cls.company = Company.objects.create(name='Acme')

    def test_company_is_required_no_default(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(user=self.user)

    def test_explicit_company_is_persisted(self):
        profile = Profile.objects.create(user=self.user, company=self.company)
        self.assertEqual(profile.company_id, self.company.id)

    def test_user_is_one_to_one(self):
        Profile.objects.create(user=self.user, company=self.company)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(user=self.user, company=self.company)

    def test_deleting_company_with_profiles_is_protected(self):
        Profile.objects.create(user=self.user, company=self.company)
        with self.assertRaises(ProtectedError):
            self.company.delete()
