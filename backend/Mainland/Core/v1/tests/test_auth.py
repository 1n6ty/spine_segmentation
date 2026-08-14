from django.conf import settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase


class AuthTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='doctor', email='doctor@example.com', password='pw')

    def test_login_with_valid_credentials_succeeds(self):
        response = self.client.post('/api/login/', {'email': 'doctor@example.com', 'password': 'pw'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status'], 'ok')

    def test_login_is_case_insensitive_on_email(self):
        response = self.client.post('/api/login/', {'email': 'DOCTOR@EXAMPLE.COM', 'password': 'pw'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)

    def test_login_with_invalid_credentials_returns_401(self):
        response = self.client.post('/api/login/', {'email': 'doctor@example.com', 'password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, 401, response.content)

    def test_login_with_malformed_email_returns_400(self):
        response = self.client.post('/api/login/', {'email': 'not-an-email', 'password': 'pw'}, format='json')
        self.assertEqual(response.status_code, 400, response.content)

    def test_login_with_missing_password_returns_400(self):
        response = self.client.post('/api/login/', {'email': 'doctor@example.com'}, format='json')
        self.assertEqual(response.status_code, 400, response.content)

    def test_remember_me_extends_session_expiry(self):
        response = self.client.post(
            '/api/login/',
            {'email': 'doctor@example.com', 'password': 'pw', 'remember_me': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            self.client.session.get_expiry_age(),
            settings.API_MANIFEST["session"]["extended_expiration_time"],
        )

    def test_logout_clears_session(self):
        self.client.force_login(self.user)
        response = self.client.post('/api/logout/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_me_without_a_session_returns_401(self):
        response = self.client.get('/api/me/')
        self.assertEqual(response.status_code, 401, response.content)

    def test_me_with_a_valid_session_returns_the_authenticated_user(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/me/')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()['data']
        self.assertEqual(data['id'], self.user.id)
        self.assertEqual(data['email'], 'doctor@example.com')

    def test_me_after_logout_returns_401(self):
        self.client.force_login(self.user)
        self.client.post('/api/logout/')
        response = self.client.get('/api/me/')
        self.assertEqual(response.status_code, 401, response.content)
