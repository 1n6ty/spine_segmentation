from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

UserModel = get_user_model()


class AuthUserEmailUniquenessTestCase(TestCase):
    """Verifies the DB-level constraint added in Profile/migrations/0002_auth_user_email_ci_unique.py."""

    def test_duplicate_email_same_case_rejected(self):
        UserModel.objects.create_user(username="user1", email="dup@example.com", password="pw")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserModel.objects.create_user(username="user2", email="dup@example.com", password="pw")

    def test_duplicate_email_different_case_rejected(self):
        UserModel.objects.create_user(username="user1", email="dup@example.com", password="pw")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserModel.objects.create_user(username="user2", email="DUP@EXAMPLE.COM", password="pw")

    def test_distinct_emails_allowed(self):
        UserModel.objects.create_user(username="user1", email="one@example.com", password="pw")
        UserModel.objects.create_user(username="user2", email="two@example.com", password="pw")
        self.assertEqual(UserModel.objects.filter(email__in=["one@example.com", "two@example.com"]).count(), 2)
