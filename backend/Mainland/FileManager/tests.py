from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from FileManager.models import FileRole
from FileManager.tasks import clean_orphaned_files


class FileRoleListTests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='pw')
        self.url = reverse('FileRole-list')

        self.preview_role, _ = FileRole.objects.update_or_create(
            slug='PREVIEW',
            defaults={
                'allowed_content_types': ['image/jpeg', 'image/png'],
                'allowed_extensions': ['.jpg', '.png'],
                'max_count': None,
            },
        )
        self.preview_role.translations.update_or_create(
            language_code='en-us',
            defaults={'name': 'Preview'},
        )

        self.receipt_role, _ = FileRole.objects.update_or_create(
            slug='RECEIPT',
            defaults={
                'allowed_content_types': ['application/pdf'],
                'allowed_extensions': ['.pdf'],
                'max_count': 1,
            },
        )
        self.receipt_role.translations.update_or_create(
            language_code='en-us',
            defaults={'name': 'Receipt'},
        )

    def test_unauthenticated_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_authenticated_returns_200(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.content)

    def test_response_structure(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        data = response.json()['data']
        self.assertIn('meta', data)
        self.assertIn('roles', data)
        for key in ('total_items', 'total_pages', 'current_page', 'page_size'):
            self.assertIn(key, data['meta'])

    def test_role_item_fields(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        roles = response.json()['data']['roles']
        self.assertTrue(len(roles) > 0)
        item = roles[0]
        for field in ('slug', 'name', 'allowed_content_types', 'allowed_extensions', 'max_count_per_entity'):
            self.assertIn(field, item, f'Missing field: {field}')

    def test_roles_include_both_seeded_records(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        slugs = [r['slug'] for r in response.json()['data']['roles']]
        self.assertIn('PREVIEW', slugs)
        self.assertIn('RECEIPT', slugs)

    def test_role_content_types_and_extensions_are_lists(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        roles = {r['slug']: r for r in response.json()['data']['roles']}
        preview = roles.get('PREVIEW', {})
        self.assertIsInstance(preview.get('allowed_content_types'), list)
        self.assertIsInstance(preview.get('allowed_extensions'), list)
        self.assertIn('image/jpeg', preview['allowed_content_types'])
        self.assertIn('.jpg', preview['allowed_extensions'])

    def test_role_name_is_returned(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        roles = {r['slug']: r for r in response.json()['data']['roles']}
        self.assertEqual(roles['PREVIEW']['name'], 'Preview')
        self.assertEqual(roles['RECEIPT']['name'], 'Receipt')

    def test_max_count_per_entity_reflects_model_value(self):
        self.client.force_login(self.user)
        response = self.client.get(self.url)
        roles = {r['slug']: r for r in response.json()['data']['roles']}
        self.assertIsNone(roles['PREVIEW']['max_count_per_entity'])
        self.assertEqual(roles['RECEIPT']['max_count_per_entity'], 1)


class CleanOrphanedFilesTaskTests(TestCase):
    """clean_orphaned_files (the Celery task) is a thin wrapper around the
    clean_orphaned_files management command -- scheduled weekly via
    Mainland.settings.modules.celery.CELERY_BEAT_SCHEDULE's 'clean-orphaned-files'
    entry. Only the wiring is tested here; the command's own sweep logic isn't
    (unchanged by this task, out of scope)."""

    @patch('FileManager.tasks.call_command')
    def test_delegates_to_management_command(self, mock_call_command):
        clean_orphaned_files.run()
        mock_call_command.assert_called_once_with('clean_orphaned_files', verbosity=0)
