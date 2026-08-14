from rest_framework.test import APIClient, APITestCase


class HealthTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    def test_health_returns_ok(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status'], 'ok')
