from unittest.mock import patch

from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from backends.authentication.email import EmailBackend

UserModel = get_user_model()

class EmailBackendTestCase(TestCase):
    """Test cases for EmailBackend authentication."""

    @classmethod
    def setUpTestData(cls):
        """Set up non-modified objects used by all test methods."""
        cls.backend = EmailBackend()
        cls.factory = RequestFactory()
        cls.valid_password = "SecureP@ss123!"
        cls.email = "user@example.com"

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.request = self.factory.get("/")  # Minimal request object

    def _create_user(self, email, password=None, **extra_fields):
        """Helper to create a user with the given email."""
        user = UserModel.objects.create_user(
            username=extra_fields.pop("username", email.split("@")[0]),
            email=email,
            password=password or self.valid_password,
            **extra_fields
        )
        return user

    # === authenticate() Method Tests ===

    def test_authenticate_request_none_returns_none(self):
        """Test authenticate returns None when request is None."""
        user = self._create_user(self.email)
        result = self.backend.authenticate(
            request=None,
            username=self.email,
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_email_none_returns_none(self):
        """Test authenticate returns None when email/username is None."""
        result = self.backend.authenticate(
            request=self.request,
            username=None,
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_password_none_returns_none(self):
        """Test authenticate returns None when password is None."""
        self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=None
        )
        self.assertIsNone(result)

    def test_authenticate_empty_string_email_returns_none(self):
        """Test authenticate returns None when email is empty string."""
        result = self.backend.authenticate(
            request=self.request,
            username="",
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_empty_string_password_returns_none(self):
        """Test authenticate returns None when password is empty string."""
        self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=""
        )
        self.assertIsNone(result)

    def test_authenticate_user_not_found_returns_none(self):
        """Test authenticate returns None when no user matches email."""
        result = self.backend.authenticate(
            request=self.request,
            username="nonexistent@example.com",
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_wrong_password_returns_none(self):
        """Test authenticate returns None when password is incorrect."""
        self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password="WrongPassword123"
        )
        self.assertIsNone(result)

    def test_authenticate_inactive_user_returns_none(self):
        """Test authenticate returns None when user is inactive."""
        user = self._create_user(self.email, is_active=False)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_valid_credentials_returns_user(self):
        """Test authenticate returns user when credentials are valid."""
        user = self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=self.valid_password
        )
        self.assertEqual(result, user)
        self.assertTrue(result.is_authenticated)

    def test_authenticate_email_case_insensitive(self):
        """Test authenticate matches email case-insensitively."""
        user = self._create_user(self.email)
        
        # Test various case combinations
        for email_variant in [
            "USER@EXAMPLE.COM",
            "User@Example.Com",
            "user@EXAMPLE.com",
            "USER@example.COM"
        ]:
            with self.subTest(email_variant=email_variant):
                result = self.backend.authenticate(
                    request=self.request,
                    username=email_variant,
                    password=self.valid_password
                )
                self.assertEqual(result, user)

    def test_authenticate_email_via_kwarg(self):
        """Test authenticate accepts email via kwargs instead of username."""
        user = self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            email=self.email,  # Passed as kwarg, not username
            password=self.valid_password
        )
        self.assertEqual(result, user)

    def test_authenticate_email_kwarg_takes_precedence(self):
        """Test email kwarg takes precedence over username parameter."""
        user = self._create_user(self.email)
        # username is wrong, but email kwarg is correct
        result = self.backend.authenticate(
            request=self.request,
            username="wrong@example.com",
            email=self.email,  # This should be used
            password=self.valid_password
        )
        self.assertEqual(result, user)

    def test_authenticate_unusable_password_returns_none(self):
        """Test authenticate returns None for user with unusable password."""
        user = self._create_user(self.email, password=None)
        user.set_unusable_password()
        user.save()
        
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=self.valid_password
        )
        self.assertIsNone(result)

    def test_authenticate_with_extra_kwargs_ignored(self):
        """Test authenticate ignores extra kwargs not related to auth."""
        user = self._create_user(self.email)
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=self.valid_password,
            extra_param="ignored",
            another_param=123
        )
        self.assertEqual(result, user)

    # === get_user() Method Tests ===

    def test_get_user_valid_id_returns_user(self):
        """Test get_user returns user for valid user ID."""
        user = self._create_user(self.email)
        result = self.backend.get_user(user.pk)
        self.assertEqual(result, user)
        self.assertTrue(result.is_authenticated)

    def test_get_user_nonexistent_id_returns_none(self):
        """Test get_user returns None for non-existent user ID."""
        # Get a PK that definitely doesn't exist
        max_pk = UserModel.objects.order_by("pk").last()
        nonexistent_id = (max_pk.pk if max_pk else 0) + 999999
        
        result = self.backend.get_user(nonexistent_id)
        self.assertIsNone(result)

    def test_get_user_inactive_user_returns_none(self):
        """Test get_user returns None for inactive user."""
        user = self._create_user(self.email, is_active=False)
        result = self.backend.get_user(user.pk)
        self.assertIsNone(result)

    def test_get_user_zero_id_returns_none(self):
        """Test get_user returns None for invalid ID (0)."""
        result = self.backend.get_user(0)
        self.assertIsNone(result)

    def test_get_user_negative_id_returns_none(self):
        """Test get_user returns None for negative ID."""
        result = self.backend.get_user(-1)
        self.assertIsNone(result)

    def test_get_user_string_id_returns_none(self):
        """Test get_user handles non-integer ID gracefully."""
        # Django's get() will raise ValueError for non-integer pk
        # but our backend should handle it by returning None
        result = self.backend.get_user("not-an-int")
        self.assertIsNone(result)

    # === Integration Tests ===

    def test_full_auth_flow_active_user(self):
        """Test complete authentication flow with active user."""
        user = self._create_user(self.email, first_name="Test", last_name="User")
        
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=self.valid_password
        )
        
        self.assertIsNotNone(result)
        self.assertEqual(result.email, self.email)
        self.assertEqual(result.first_name, "Test")
        self.assertEqual(result.last_name, "User")
        self.assertTrue(result.is_active)

    def test_multiple_users_different_emails(self):
        """Test authentication works correctly with multiple users."""
        user1 = self._create_user("user1@example.com")
        user2 = self._create_user("user2@example.com")
        
        # Authenticate as user1
        result1 = self.backend.authenticate(
            request=self.request,
            username="user1@example.com",
            password=self.valid_password
        )
        self.assertEqual(result1, user1)
        
        # Authenticate as user2
        result2 = self.backend.authenticate(
            request=self.request,
            username="user2@example.com",
            password=self.valid_password
        )
        self.assertEqual(result2, user2)

    def test_email_with_plus_addressing(self):
        """Test authentication with email plus addressing (user+tag@example.com)."""
        # Create user with base email
        user = self._create_user("user@example.com")
        
        # Plus addressing should NOT match (exact iexact match only)
        result = self.backend.authenticate(
            request=self.request,
            username="user+newsletter@example.com",
            password=self.valid_password
        )
        self.assertIsNone(result)
        
        # Base email should still work
        result = self.backend.authenticate(
            request=self.request,
            username="user@example.com",
            password=self.valid_password
        )
        self.assertEqual(result, user)

    def test_unicode_email_handling(self):
        """Test authentication with unicode characters in email."""
        unicode_email = "tëst@exämple.com"
        user = self._create_user(unicode_email)
        
        result = self.backend.authenticate(
            request=self.request,
            username=unicode_email,
            password=self.valid_password
        )
        self.assertEqual(result, user)

    def test_email_with_whitespace_stripped_by_db(self):
        """Test that emails with surrounding whitespace don't match (DB handles stripping)."""
        user = self._create_user(self.email)
        
        # Email with spaces shouldn't match (unless DB auto-strips, which it doesn't by default)
        result = self.backend.authenticate(
            request=self.request,
            username="  user@example.com  ",
            password=self.valid_password
        )
        # This will be None because "  user@example.com  " != "user@example.com" (iexact)
        # If you want to support stripping, modify the backend
        self.assertIsNone(result)

    # === Edge Cases ===

    def test_authenticate_email_with_special_chars(self):
        """Test authentication with special characters in email."""
        special_email = "user+tag_name@example-domain.co.uk"
        user = self._create_user(special_email)
        
        result = self.backend.authenticate(
            request=self.request,
            username=special_email,
            password=self.valid_password
        )
        self.assertEqual(result, user)

    def test_authenticate_after_password_change(self):
        """Test authentication fails with old password after password change."""
        user = self._create_user(self.email)
        old_password = self.valid_password
        new_password = "NewSecureP@ss456!"
        
        # Authenticate with old password - should work
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=old_password
        )
        self.assertEqual(result, user)
        
        # Change password
        user.set_password(new_password)
        user.save()
        
        # Old password should now fail
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=old_password
        )
        self.assertIsNone(result)
        
        # New password should work
        result = self.backend.authenticate(
            request=self.request,
            username=self.email,
            password=new_password
        )
        self.assertEqual(result, user)

    def test_authenticate_multiple_objects_returned_returns_none(self):
        """Test authenticate denies login instead of crashing if get() ever finds >1 match."""
        with patch.object(
            UserModel.objects, "get", side_effect=UserModel.MultipleObjectsReturned
        ):
            result = self.backend.authenticate(
                request=self.request,
                username=self.email,
                password=self.valid_password,
            )
        self.assertIsNone(result)

    def test_authenticate_concurrent_requests(self):
        """Test backend handles concurrent authentication attempts."""
        user = self._create_user(self.email)
        
        # Simulate multiple auth attempts (not truly concurrent, but tests reusability)
        for _ in range(5):
            result = self.backend.authenticate(
                request=self.request,
                username=self.email,
                password=self.valid_password
            )
            self.assertEqual(result, user)