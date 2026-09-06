from unittest.mock import AsyncMock, patch

from django.contrib.auth.models import Group, Permission, User
from django.core.management import call_command
from django.db.models.query import QuerySet
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient

from common.schemas.v1.domain.user import User_Item_Schema
from common.testing.schema_parity import assert_matches_schema
from Company.models import Company
from Profile.models import Profile, Role
from Profile.v1.views.profiles import ProfilesViewSet



class TestProfilesViewSet(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.viewset = ProfilesViewSet()

    # ==========================================
    # CURRENT PROFILE ENDPOINT TEST CASES
    # ==========================================

    def test_url_shape(self):
        self.assertEqual(reverse('Profile-me'), '/api/profiles/me/')
        self.assertEqual(reverse('Profile-detail', kwargs={'user_id': 1}), '/api/profiles/1/')

    def test_me_success(self):
        """Test /me returns 200 and current user data."""
        email = "testuser@example.com"
        password = "secure_password123"

        # Create user where username matches email to align with view logic
        user = User.objects.create_user(username=email, email=email, password=password)

        self.client.force_login(user)

        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["status"], "ok")
        self.assertEqual(response_json["data"]["email"], email)
        self.assertEqual(response_json["data"]["roles"], [])
        # This user has no Profile at all -- both fields must default cleanly.
        self.assertEqual(response_json["data"]["patronymic"], "")
        self.assertIsNone(response_json["data"]["phone"])
        # User_Ref_Schema consolidation: /me now includes id (it didn't before).
        self.assertEqual(response_json["data"]["id"], user.pk)
        self.assertEqual(response_json["data"]["permissions"], [])
        self.assertEqual(response_json["data"]["managed_companies"], [])
        self.assertIsNotNone(response_json["data"]["date_joined"])
        assert_matches_schema(response_json["data"], User_Item_Schema)

    def test_me_includes_patronymic_and_phone(self):
        """Test /me returns patronymic and phone from the user's Profile."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='fulluser', email='fulluser@example.com', password='pw')
        Profile.objects.create(
            user=user, company=company, patronymic='Ivanovich', phone='+15551234567',
        )

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["patronymic"], "Ivanovich")
        self.assertEqual(response_json["data"]["phone"], "+15551234567")

    def test_me_includes_date_joined_and_last_login(self):
        """Test /me's date_joined is always present, and last_login reflects the most
        recent login (both force_login and client.login() trigger Django's
        user_logged_in signal, which populates last_login)."""
        user = User.objects.create_user(username='joineduser', email='joineduser@example.com', password='pw12345678')
        self.assertIsNone(user.last_login)

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response_json["data"]["date_joined"])
        self.assertIsNotNone(response_json["data"]["last_login"])

    def test_me_includes_managed_companies(self):
        """Test /me's managed_companies reflects Profile.managed_companies (seeded to
        {company} at creation)."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='manageduser', email='manageduser@example.com', password='pw')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["managed_companies"], [{"slug": "acme", "name": "Acme"}])

    def test_me_managed_companies_empty_when_cleared(self):
        """Test managed_companies serializes as [] (not null/omitted) when cleared."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='clearedcompanies', email='clearedcompanies@example.com', password='pw')
        profile = Profile.objects.create(user=user, company=company)
        profile.managed_companies.clear()

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))

        self.assertEqual(response.json()["data"]["managed_companies"], [])

    def test_me_includes_role(self):
        """Test /me returns the user's roles (slug + translated name) via Profile.roles."""
        call_command('sync_roles', verbosity=0)
        role = Role.objects.get(slug='doctor')

        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='roleduser', email='roleduser@example.com', password='pw')
        profile = Profile.objects.create(user=user, company=company)
        profile.roles.set([role])

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["roles"], [{"slug": "doctor", "name": "Doctor"}])

    def test_me_includes_direct_permission(self):
        """Test /me's permissions field includes a permission assigned directly to the user."""
        user = User.objects.create_user(username='directperm', email='directperm@example.com', password='pw')
        perm = Permission.objects.get(codename='view_company', content_type__app_label='Company')
        user.user_permissions.add(perm)

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn('Company.view_company', response_json["data"]["permissions"])

    def test_me_includes_group_inherited_permission(self):
        """Test /me's permissions field includes a permission held only via a group."""
        call_command('sync_roles', verbosity=0)
        user = User.objects.create_user(username='groupperm', email='groupperm@example.com', password='pw')
        user.groups.add(Group.objects.get(name='Admin'))

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        # This user was never assigned any permission directly -- everything in
        # the response must have come from the group.
        self.assertEqual(user.user_permissions.count(), 0)
        self.assertIn('Company.view_company', response_json["data"]["permissions"])

    def test_me_superuser_sees_all_permissions(self):
        """Test /me's permissions field includes every permission in the system for a superuser."""
        user = User.objects.create_superuser(username='super', email='super@example.com', password='pw')

        self.client.force_login(user)
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        total_perms = Permission.objects.count()
        self.assertEqual(len(response_json["data"]["permissions"]), total_perms)

    def test_list_permissions_stays_empty(self):
        """Test GET /profiles/ list response items carry an empty `permissions` list -- User_Item_Schema
        declares the field with a `[]` default, and only the /me action's from_model call ever
        populates it, so list rows get the (present but empty) default instead of a real lookup."""
        call_command('sync_roles', verbosity=0)
        company = Company.objects.create(name='Acme', slug='acme')
        manager = User.objects.create_user(username='listmanager', email='listmanager@example.com', password='pw')
        manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=manager, company=company)

        self.client.force_login(manager)
        response = self.client.get(reverse("Profile-list"))
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        for user_data in response_json["data"]["users"]:
            self.assertEqual(user_data['permissions'], [])

    def test_me_unauthorized(self):
        """Test /me returns 401 Unauthorized."""
        email = "testuser@example.com"
        password = "secure_password123"
        
        # Create user where username matches email to align with view logic
        User.objects.create_user(username=email, email=email, password=password)
        
        response = self.client.get(reverse("Profile-me"))
        response_json = response.json()
        
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response_json["status"], "error")

    # ==========================================
    # PATCH /profiles/<user_id>/ TEST CASES
    # ==========================================

    def test_patch_self_edit_success(self):
        """Self-edit of name/patronymic/email is allowed with no special permission."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='selfedit@example.com', email='selfedit@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company, patronymic='Old')

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {
                'first_name': 'New',
                'last_name': 'Name',
                'patronymic': 'Newovich',
                'email': 'selfedit-new@example.com',
            },
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["first_name"], "New")
        self.assertEqual(response_json["data"]["last_name"], "Name")
        self.assertEqual(response_json["data"]["patronymic"], "Newovich")
        self.assertEqual(response_json["data"]["email"], "selfedit-new@example.com")
        assert_matches_schema(response_json["data"], User_Item_Schema)

        user.refresh_from_db()
        self.assertEqual(user.username, "selfedit-new@example.com")

    def test_patch_self_edit_phone_success(self):
        """Self-edit of phone is allowed with no special permission."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='phoneedit@example.com', email='phoneedit@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'phone': '+15551234567'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response_json["data"]["phone"], "+15551234567")

    def test_patch_other_user_phone_rejected_without_permission(self):
        """A plain user cannot change another user's phone without Profile.change_profile
        -- regression test: phone must be included in editing_other_basic_fields."""
        company = Company.objects.create(name='Acme', slug='acme')
        actor = User.objects.create_user(username='phoneactor@example.com', email='phoneactor@example.com', password='pw12345678')
        Profile.objects.create(user=actor, company=company)
        target = User.objects.create_user(username='phonetarget@example.com', email='phonetarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company, phone='+15550000000')

        self.client.force_login(actor)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'phone': '+15559999999'},
            format='json',
        )

        self.assertEqual(response.status_code, 403, response.content)
        target.refresh_from_db()
        self.assertEqual(str(target.profile.phone), '+15550000000')

    def test_patch_change_profile_permission_allows_phone_edit(self):
        """A holder of Profile.change_profile can edit another user's phone."""
        company = Company.objects.create(name='Acme', slug='acme')
        actor = User.objects.create_user(username='phoneeditor@example.com', email='phoneeditor@example.com', password='pw12345678')
        actor.user_permissions.add(Permission.objects.get(codename='change_profile', content_type__app_label='Profile'))
        Profile.objects.create(user=actor, company=company)
        target = User.objects.create_user(username='phoneeditortarget@example.com', email='phoneeditortarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(actor)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'phone': '+15551112222'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["phone"], "+15551112222")

    def test_patch_self_edit_password_keeps_session_alive(self):
        """Changing your own password must not log you out mid-request."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='pwchange@example.com', email='pwchange@example.com', password='oldpassword1')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'password': 'newpassword1'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        me_response = self.client.get(reverse('Profile-me'))
        self.assertEqual(me_response.status_code, 200)

        user.refresh_from_db()
        self.assertTrue(user.check_password('newpassword1'))

    def test_patch_self_edit_role_rejected_without_sensitive_permission(self):
        """A plain user cannot change their own role_slug/company_slug."""
        call_command('sync_roles', verbosity=0)
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='noselfrole@example.com', email='noselfrole@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'role_slugs': ['doctor']},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response_json["status"], "error")

    def test_patch_self_edit_unchanged_role_and_company_does_not_require_sensitive_permission(self):
        """Resubmitting your own current role_slugs/company_slug unchanged (e.g. from
        a form or Swagger's pre-filled example values) must not be treated as a
        role/company change -- it shouldn't require change_profile_role/change_profile_company."""
        call_command('sync_roles', verbosity=0)
        role = Role.objects.get(slug='doctor')
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='sameval@example.com', email='sameval@example.com', password='pw12345678')
        profile = Profile.objects.create(user=user, company=company)
        profile.roles.set([role])

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {
                'first_name': 'Same',
                'role_slugs': ['doctor'],
                'company_slug': 'acme',
            },
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["first_name"], "Same")
        self.assertEqual(response_json["data"]["roles"], [{"slug": "doctor", "name": "Doctor"}])
        self.assertEqual(response_json["data"]["company"]["slug"], "acme")

    def test_patch_self_edit_role_change_rejected_without_sensitive_permission_even_with_existing_role(self):
        """A user who already has a role cannot self-promote/demote to a DIFFERENT
        role without change_profile_role -- only resubmitting the same
        value is exempt from the gate."""
        call_command('sync_roles', verbosity=0)
        viewer_role = Role.objects.get(slug='viewer')
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='rolechange@example.com', email='rolechange@example.com', password='pw12345678')
        profile = Profile.objects.create(user=user, company=company)
        profile.roles.set([viewer_role])

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'role_slugs': ['doctor']},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response_json["status"], "error")

    def test_patch_other_user_rejected_without_sensitive_permission(self):
        """A plain user cannot edit another user's profile at all."""
        company = Company.objects.create(name='Acme', slug='acme')
        actor = User.objects.create_user(username='actor@example.com', email='actor@example.com', password='pw12345678')
        Profile.objects.create(user=actor, company=company)
        target = User.objects.create_user(username='target@example.com', email='target@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(actor)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'first_name': 'Hacked'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        target.refresh_from_db()
        self.assertNotEqual(target.first_name, 'Hacked')

    def test_patch_manager_can_edit_other_user_including_role_and_company(self):
        """Profile.change_profile_role/change_profile_company let a manager edit any user
        in their managed_companies, including role/company, and role reassignment swaps
        Django group membership. The new role must be in the manager's own roles'
        assignable set, and the new company must be in the manager's managed_companies."""
        call_command('sync_roles', verbosity=0)

        old_company = Company.objects.create(name='Acme', slug='acme')
        new_company = Company.objects.create(name='Beta', slug='beta')
        admin_role = Role.objects.select_related('group').get(slug='admin')
        viewer_role = Role.objects.select_related('group').get(slug='viewer')
        doctor_role = Role.objects.select_related('group').get(slug='doctor')

        manager = User.objects.create_user(username='manager@example.com', email='manager@example.com', password='pw12345678')
        manager.groups.add(Group.objects.get(name='Admin'))
        manager_profile = Profile.objects.create(user=manager, company=old_company)
        manager_profile.roles.set([admin_role])
        manager_profile.managed_companies.add(new_company)

        target = User.objects.create_user(username='target2@example.com', email='target2@example.com', password='pw12345678')
        target_profile = Profile.objects.create(user=target, company=old_company)
        target_profile.roles.set([viewer_role])
        target.groups.add(viewer_role.group)

        self.client.force_login(manager)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {
                'email': 'target2-new@example.com',
                'role_slugs': ['doctor'],
                'company_slug': 'beta',
            },
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_json["data"]["email"], "target2-new@example.com")
        self.assertEqual(response_json["data"]["roles"], [{"slug": "doctor", "name": "Doctor"}])
        self.assertEqual(response_json["data"]["company"]["slug"], "beta")

        target.refresh_from_db()
        target_profile.refresh_from_db()
        self.assertEqual(target_profile.company_id, new_company.id)
        self.assertEqual(list(target_profile.roles.values_list('pk', flat=True)), [doctor_role.pk])
        self.assertFalse(target.groups.filter(pk=viewer_role.group_id).exists())
        self.assertTrue(target.groups.filter(pk=doctor_role.group_id).exists())

    def test_patch_change_profile_permission_allows_basic_fields_but_not_password_reset(self):
        """A holder of only Profile.change_profile (not reset_profile_password) can edit
        another user's basic fields but not reset their password -- the two permissions
        are independently checked."""
        company = Company.objects.create(name='Acme', slug='acme')
        actor = User.objects.create_user(username='basiceditor@example.com', email='basiceditor@example.com', password='pw12345678')
        actor.user_permissions.add(Permission.objects.get(codename='change_profile', content_type__app_label='Profile'))
        Profile.objects.create(user=actor, company=company)

        target = User.objects.create_user(username='basictarget@example.com', email='basictarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(actor)

        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'first_name': 'Edited'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'password': 'newpassword123'},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.content)

    def test_patch_reset_profile_password_permission_allows_password_but_not_basic_fields(self):
        """A holder of only Profile.reset_profile_password (not change_profile) can reset
        another user's password but not edit their basic fields."""
        company = Company.objects.create(name='Acme', slug='acme')
        actor = User.objects.create_user(username='resetter@example.com', email='resetter@example.com', password='pw12345678')
        actor.user_permissions.add(Permission.objects.get(codename='reset_profile_password', content_type__app_label='Profile'))
        Profile.objects.create(user=actor, company=company)

        target = User.objects.create_user(username='resettarget@example.com', email='resettarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(actor)

        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'password': 'newpassword123'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        target.refresh_from_db()
        self.assertTrue(target.check_password('newpassword123'))

        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'first_name': 'Edited'},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.content)

    def test_patch_not_found(self):
        """A manager PATCHing a nonexistent user_id gets 404 (not 403 -- the profile
        lookup itself 404s before any permission-body checks run)."""
        call_command('sync_roles', verbosity=0)
        manager = User.objects.create_user(username='manager404@example.com', email='manager404@example.com', password='pw12345678')
        manager.groups.add(Group.objects.get(name='Admin'))

        self.client.force_login(manager)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': 999999}),
            {'first_name': 'X'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response_json["status"], "error")

    def test_patch_invalid_payload_returns_400(self):
        """A PATCH body that fails Profile_PATCH_Request's own validation (password
        shorter than the min_length=8) returns 400, not a 500/silent accept."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='shortpw@example.com', email='shortpw@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'password': 'short'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response_json["status"], "error")

    def test_patch_manager_unassignable_role_slug_returns_403(self):
        """A role slug not in the manager's own assignable set -- including one that
        doesn't exist at all -- is rejected as "not assignable" before the view ever
        checks whether the role exists, since a nonexistent slug can never be in
        anyone's assignable set (assignable only ever holds real Role rows)."""
        call_command('sync_roles', verbosity=0)
        company = Company.objects.create(name='Acme', slug='acme')
        admin_role = Role.objects.select_related('group').get(slug='admin')

        manager = User.objects.create_user(username='rolemanager@example.com', email='rolemanager@example.com', password='pw12345678')
        manager.groups.add(Group.objects.get(name='Admin'))
        manager_profile = Profile.objects.create(user=manager, company=company)
        manager_profile.roles.set([admin_role])

        target = User.objects.create_user(username='roletarget@example.com', email='roletarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(manager)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'role_slugs': ['does-not-exist']},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 403, response.content)
        self.assertEqual(response_json["status"], "error")

    def test_patch_manager_unmanaged_company_slug_returns_403(self):
        """A company_slug outside the manager's managed_companies -- including one that
        doesn't exist at all -- is rejected as "not in managed_companies" before the
        view ever checks whether the company exists, same rationale as
        resolve_managed_company_slug_filter: never leak slug existence to a caller
        who wouldn't be allowed to use it anyway."""
        call_command('sync_roles', verbosity=0)
        company = Company.objects.create(name='Acme', slug='acme')

        manager = User.objects.create_user(username='companymanager@example.com', email='companymanager@example.com', password='pw12345678')
        manager.groups.add(Group.objects.get(name='Admin'))
        Profile.objects.create(user=manager, company=company)

        target = User.objects.create_user(username='companytarget@example.com', email='companytarget@example.com', password='pw12345678')
        Profile.objects.create(user=target, company=company)

        self.client.force_login(manager)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': target.pk}),
            {'company_slug': 'does-not-exist'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 403, response.content)
        self.assertEqual(response_json["status"], "error")

    def test_patch_duplicate_email_rejected(self):
        """PATCHing an email already used by another user returns 400."""
        company = Company.objects.create(name='Acme', slug='acme')
        User.objects.create_user(username='taken@example.com', email='taken@example.com', password='pw12345678')
        user = User.objects.create_user(username='dupetest@example.com', email='dupetest@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'email': 'taken@example.com'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response_json["status"], "error")

    def test_patch_duplicate_email_race_returns_400_not_500(self):
        """DB-level uniqueness (Profile/migrations/0002_auth_user_email_ci_unique.py) is the
        real backstop for partial_update's check-then-save on email -- simulate the race by
        forcing the pre-check to report "no match" while a duplicate already exists, so the
        actual UPDATE is what has to reject it. The view must convert that IntegrityError into
        the same 400 response, not let it bubble up as a 500."""
        company = Company.objects.create(name='Acme', slug='acme')
        User.objects.create_user(username='raced@example.com', email='raced@example.com', password='pw12345678')
        user = User.objects.create_user(username='racer@example.com', email='racer@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        self.client.force_login(user)
        with patch.object(QuerySet, 'aexists', new=AsyncMock(return_value=False)):
            response = self.client.patch(
                reverse('Profile-detail', kwargs={'user_id': user.pk}),
                {'email': 'raced@example.com'},
                format='json',
            )

        self.assertEqual(response.status_code, 400, response.content)
        user.refresh_from_db()
        self.assertEqual(user.email, 'racer@example.com')

    def test_patch_unauthenticated(self):
        """PATCH without authentication returns 401."""
        company = Company.objects.create(name='Acme', slug='acme')
        user = User.objects.create_user(username='anon-target@example.com', email='anon-target@example.com', password='pw12345678')
        Profile.objects.create(user=user, company=company)

        response = self.client.patch(
            reverse('Profile-detail', kwargs={'user_id': user.pk}),
            {'first_name': 'X'},
            format='json',
        )
        response_json = response.json()

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response_json["status"], "error")
