from django.core.management import call_command
from django.test import TestCase

from Profile.management.commands.sync_roles import ROLE_DEFINITIONS
from Profile.models import Role


class SyncRolesCommandTests(TestCase):

    def test_seeds_every_role_definition(self):
        call_command('sync_roles', verbosity=0)
        self.assertCountEqual(
            Role.objects.values_list('slug', flat=True), ROLE_DEFINITIONS.keys(),
        )

    def test_viewer_gets_no_permissions(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.select_related('group').get(slug='viewer')
        self.assertEqual(role.group.permissions.count(), 0)

    def test_doctor_gets_dicom_access_but_not_profile_management(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.select_related('group').get(slug='doctor')
        codenames = set(role.group.permissions.values_list('codename', flat=True))
        self.assertIn('access_studies', codenames)
        self.assertNotIn('change_profile_role', codenames)
        self.assertNotIn('change_profile_company', codenames)
        self.assertNotIn('reset_profile_password', codenames)

    def test_admin_gets_profile_management_but_not_dicom_access(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.select_related('group').get(slug='admin')
        codenames = set(role.group.permissions.values_list('codename', flat=True))
        self.assertIn('change_profile', codenames)
        self.assertIn('change_profile_role', codenames)
        self.assertIn('change_profile_company', codenames)
        self.assertIn('reset_profile_password', codenames)
        self.assertIn('view_profile', codenames)
        self.assertIn('delete_profile', codenames)
        self.assertNotIn('access_studies', codenames)

    def test_admin_assignable_includes_every_role(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.get(slug='admin')
        self.assertCountEqual(
            role.assignable.values_list('slug', flat=True), ['viewer', 'doctor', 'admin'],
        )

    def test_doctor_and_viewer_have_no_assignable_roles(self):
        call_command('sync_roles', verbosity=0)
        for slug in ('doctor', 'viewer'):
            role = Role.objects.get(slug=slug)
            self.assertEqual(role.assignable.count(), 0)

    def test_is_idempotent_without_force(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.select_related('group').get(slug='admin')
        role.group.permissions.clear()  # simulate manual DB drift

        call_command('sync_roles', verbosity=0)  # no --force: should skip, not resync
        role.refresh_from_db()
        self.assertEqual(role.group.permissions.count(), 0)

    def test_force_resyncs_permissions(self):
        call_command('sync_roles', verbosity=0)
        role = Role.objects.select_related('group').get(slug='admin')
        role.group.permissions.clear()

        call_command('sync_roles', '--force', verbosity=0)
        role.refresh_from_db()
        self.assertGreater(role.group.permissions.count(), 0)
