from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management import call_command
from rest_framework.test import APIClient, APITestCase

from Dicom.models import DicomFile, DicomImage, DicomThumbnail, Patient, Series, Study, UserRecentStudies
from FileManager.models import FileRole


def _make_image(sop_uid, study_uid, patient_id, role_slug=None, series_uid=None):
    """Builds the Patient -> Study -> Series -> DicomImage chain, optionally
    attaching a role-tagged DicomFile too -- needed for any test asserting on
    side/frontal_sop_instance_uid, since that's now derived via DicomFile.role
    (Dicom/v1/utils/session_images.py), not a stored FK on UserRecentStudies.
    Callers needing role_slug must call
    `call_command('create_xray_file_roles_if_not_exists', verbosity=0)` first
    (e.g. in setUp) so the FileRole row exists."""
    patient = Patient.objects.create(patient_id=patient_id, name='Jane Doe')
    study = Study.objects.create(study_instance_uid=study_uid, patient=patient)
    series = Series.objects.create(series_instance_uid=series_uid or f'{study_uid}-SE1', study=study)
    image = DicomImage.objects.create(sop_instance_uid=sop_uid, series=series)
    if role_slug:
        role = FileRole.objects.get(slug=role_slug)
        DicomFile.objects.create(
            image=image, series=series, role=role, name=f'{sop_uid}.dcm', size=0, hash='0' * 128,
        )
    return image


class UserRecentStudiesCRUDTests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='doctor-a', password='pw')
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)

    def test_unauthenticated_returns_401(self):
        response = self.client.get('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 401)

    def test_create_returns_id_owned_by_requester(self):
        self.client.force_login(self.user)
        response = self.client.post('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 201, response.content)
        row_id = response.json()['data']['id']
        row = UserRecentStudies.objects.get(pk=row_id)
        self.assertEqual(row.owner_id, self.user.pk)

    def test_list_returns_only_own_rows_as_ref_shape(self):
        other = User.objects.create_user(username='doctor-b', password='pw')
        UserRecentStudies.objects.create(owner=self.user)
        UserRecentStudies.objects.create(owner=other)

        self.client.force_login(self.user)
        response = self.client.get('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 200, response.content)
        items = response.json()['data']['recent_studies']
        self.assertEqual(len(items), 1)
        # Ref shape -- no polygons/sop_instance_uid fields, those are Item-only.
        self.assertNotIn('side_polygons', items[0])
        self.assertIn('side_present', items[0])

    def test_retrieve_returns_full_item_shape_and_bumps_last_accessed(self):
        image = _make_image('SOP-1', 'STUDY-1', 'PAT-1', role_slug='DICOM_XRAY_SAGITTAL')
        row = UserRecentStudies.objects.create(
            owner=self.user, study=image.series.study,
            side_polygons=[{'uuid': 'u1', 'id': 'L4', 'points': []}],
            side_segments=[{'id': 'cervical', 'topId': 'C2', 'bottomId': 'C7'}],
        )
        original_last_accessed = row.last_accessed

        self.client.force_login(self.user)
        response = self.client.get(f'/api/dcm/recent-studies/{row.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()['data']
        self.assertEqual(data['side_sop_instance_uid'], 'SOP-1')
        self.assertEqual(data['side_polygons'], [{'uuid': 'u1', 'id': 'L4', 'points': []}])
        self.assertEqual(data['side_segments'], [{'id': 'cervical', 'topId': 'C2', 'bottomId': 'C7'}])
        self.assertEqual(data['patient_name'], 'Jane Doe')

        row.refresh_from_db()
        self.assertGreater(row.last_accessed, original_last_accessed)

    def test_retrieve_unknown_id_returns_404(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/dcm/recent-studies/999999/')
        self.assertEqual(response.status_code, 404)

    def test_destroy_deletes_row_but_not_shared_dicom_rows(self):
        image = _make_image('SOP-2', 'STUDY-2', 'PAT-2')
        row = UserRecentStudies.objects.create(owner=self.user, study=image.series.study)

        self.client.force_login(self.user)
        response = self.client.delete(f'/api/dcm/recent-studies/{row.pk}/')
        self.assertEqual(response.status_code, 200, response.content)

        self.assertFalse(UserRecentStudies.objects.filter(pk=row.pk).exists())
        self.assertTrue(DicomImage.objects.filter(pk='SOP-2').exists())

    def test_clear_all_only_deletes_own_rows(self):
        other = User.objects.create_user(username='doctor-c', password='pw')
        UserRecentStudies.objects.create(owner=self.user)
        UserRecentStudies.objects.create(owner=self.user)
        other_row = UserRecentStudies.objects.create(owner=other)

        self.client.force_login(self.user)
        response = self.client.delete('/api/dcm/recent-studies/clear-all/')
        self.assertEqual(response.status_code, 200, response.content)

        self.assertEqual(UserRecentStudies.objects.filter(owner=self.user).count(), 0)
        self.assertTrue(UserRecentStudies.objects.filter(pk=other_row.pk).exists())


class UserRecentStudiesLatestTests(APITestCase):
    """GET /latest/ is what lets the frontend resume 'wherever I left off' on
    load without persisting any session id client-side -- ownership alone
    (owner=request.user) identifies 'my' session."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='doctor-a', password='pw')
        self.client.force_login(self.user)
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        response = self.client.get('/api/dcm/recent-studies/latest/')
        self.assertEqual(response.status_code, 401)

    def test_404_when_user_has_no_recent_studies_yet(self):
        response = self.client.get('/api/dcm/recent-studies/latest/')
        self.assertEqual(response.status_code, 404)

    def test_returns_most_recently_accessed_row_as_full_detail(self):
        image = _make_image('SOP-L1', 'STUDY-L1', 'PAT-L1', role_slug='DICOM_XRAY_SAGITTAL')
        UserRecentStudies.objects.create(owner=self.user)
        newer = UserRecentStudies.objects.create(owner=self.user, study=image.series.study)
        # `newer` was created after the first row -- already the most-recently-
        # accessed one without needing to touch it again.

        response = self.client.get('/api/dcm/recent-studies/latest/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['id'], newer.pk)
        self.assertEqual(response.json()['data']['side_sop_instance_uid'], 'SOP-L1')

    def test_touching_an_older_row_makes_it_latest_again(self):
        first = UserRecentStudies.objects.create(owner=self.user)
        UserRecentStudies.objects.create(owner=self.user)

        # Re-opening `first` via the ordinary retrieve endpoint bumps its
        # last_accessed past the second row's.
        self.client.get(f'/api/dcm/recent-studies/{first.pk}/')

        response = self.client.get('/api/dcm/recent-studies/latest/')
        self.assertEqual(response.json()['data']['id'], first.pk)

    def test_scoped_to_the_requesting_user_only(self):
        other = User.objects.create_user(username='doctor-b', password='pw')
        UserRecentStudies.objects.create(owner=other)

        response = self.client.get('/api/dcm/recent-studies/latest/')
        self.assertEqual(response.status_code, 404)

    def test_bumps_last_accessed(self):
        row = UserRecentStudies.objects.create(owner=self.user)
        original = row.last_accessed

        self.client.get('/api/dcm/recent-studies/latest/')

        row.refresh_from_db()
        self.assertGreater(row.last_accessed, original)


class UserRecentStudiesProjectionPatchTests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='doctor-a', password='pw')
        self.client.force_login(self.user)
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)

    def test_attach_image_and_set_polygons(self):
        image = _make_image('SOP-3', 'STUDY-3', 'PAT-3')
        row = UserRecentStudies.objects.create(owner=self.user)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/side/',
            {'sop_instance_uid': 'SOP-3', 'polygons': [{'uuid': 'u1', 'id': 'L4', 'points': []}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.study.study_instance_uid, 'STUDY-3')
        self.assertEqual(row.side_polygons, [{'uuid': 'u1', 'id': 'L4', 'points': []}])

    def test_patch_updates_segments(self):
        row = UserRecentStudies.objects.create(owner=self.user)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/side/',
            {'segments': [{'id': 'custom', 'topId': 'C4', 'bottomId': 'Th2'}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.side_segments, [{'id': 'custom', 'topId': 'C4', 'bottomId': 'Th2'}])

    def test_segments_only_patch_leaves_polygons_untouched(self):
        row = UserRecentStudies.objects.create(
            owner=self.user, side_polygons=[{'uuid': 'u1', 'id': 'L4', 'points': []}],
        )

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/side/',
            {'segments': []},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.side_polygons, [{'uuid': 'u1', 'id': 'L4', 'points': []}])
        self.assertEqual(row.side_segments, [])

    def test_polygons_only_patch_leaves_study_untouched(self):
        image = _make_image('SOP-4', 'STUDY-4', 'PAT-4')
        row = UserRecentStudies.objects.create(owner=self.user, study=image.series.study)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/side/',
            {'polygons': [{'uuid': 'u2', 'id': 'L5', 'points': []}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.study.study_instance_uid, 'STUDY-4')
        self.assertEqual(row.side_polygons, [{'uuid': 'u2', 'id': 'L5', 'points': []}])

    def test_attaching_a_frontal_from_a_different_series_than_the_attached_side_is_rejected(self):
        # side and frontal must be the same real DICOM acquisition -- i.e.
        # share a Series -- once one of the two is attached; this used to be
        # an accepted edge case (silently overwriting row.study) but is now
        # a hard validation error.
        side_image = _make_image('SOP-5A', 'STUDY-5A', 'PAT-5A', role_slug='DICOM_XRAY_SAGITTAL')
        _make_image('SOP-5B', 'STUDY-5B', 'PAT-5B', role_slug='DICOM_XRAY_FRONTAL')
        row = UserRecentStudies.objects.create(owner=self.user, study=side_image.series.study)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/frontal/',
            {'sop_instance_uid': 'SOP-5B'},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.content)

        row.refresh_from_db()
        # Rejected -- row.study is left exactly as it was.
        self.assertEqual(row.study.study_instance_uid, 'STUDY-5A')

    def test_attaching_a_frontal_from_the_same_series_as_the_attached_side_succeeds(self):
        side_image = _make_image('SOP-6A', 'STUDY-6', 'PAT-6', role_slug='DICOM_XRAY_SAGITTAL')
        frontal_image = DicomImage.objects.create(sop_instance_uid='SOP-6B', series=side_image.series)
        DicomFile.objects.create(
            image=frontal_image, series=side_image.series,
            role=FileRole.objects.get(slug='DICOM_XRAY_FRONTAL'),
            name='SOP-6B.dcm', size=0, hash='1' * 128,
        )
        row = UserRecentStudies.objects.create(owner=self.user, study=side_image.series.study)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/frontal/',
            {'sop_instance_uid': 'SOP-6B'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.study.study_instance_uid, 'STUDY-6')

    def test_first_projection_attached_is_never_checked_against_anything(self):
        # No "other" projection attached yet -- nothing to match against, so
        # any Series is accepted for the first attach.
        image = _make_image('SOP-7', 'STUDY-7', 'PAT-7', role_slug='DICOM_XRAY_SAGITTAL')
        row = UserRecentStudies.objects.create(owner=self.user)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/side/',
            {'sop_instance_uid': 'SOP-7'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        row.refresh_from_db()
        self.assertEqual(row.study.study_instance_uid, 'STUDY-7')

    def test_unknown_sop_instance_uid_returns_400(self):
        row = UserRecentStudies.objects.create(owner=self.user)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{row.pk}/projections/frontal/',
            {'sop_instance_uid': 'does-not-exist'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_patch_on_unowned_row_returns_404(self):
        other = User.objects.create_user(username='doctor-d', password='pw')
        other_row = UserRecentStudies.objects.create(owner=other)

        response = self.client.patch(
            f'/api/dcm/recent-studies/{other_row.pk}/projections/side/',
            {'polygons': []},
            format='json',
        )
        self.assertEqual(response.status_code, 404)


class UserRecentStudiesThumbnailTests(APITestCase):
    """Session thumbnails are resolved at read time from the row's side
    (falling back to frontal) DicomImage's own server-generated DicomThumbnail
    (Dicom.utils.thumbnail) -- there's no client-uploadable thumbnail on
    UserRecentStudies at all anymore. Reading a DicomThumbnail's FieldFile
    triggers real storage I/O (unlike DicomFile's X-Accel-Redirect path,
    which only ever inspects .file.name), so PrivateMediaStorage._open must
    be mocked, same idiom as DcmParseDedupAndRoleTests."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='doctor-a', password='pw')
        self.client.force_login(self.user)
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)
        patch(
            'common.storages.PrivateMediaStorage._open',
            return_value=ContentFile(b'fake-thumbnail-bytes'),
        ).start()
        self.addCleanup(patch.stopall)

    @staticmethod
    def _attach_thumbnail(image):
        thumb = DicomThumbnail(
            image=image, name=f'{image.pk}-thumbnail.jpg', content_type='image/jpeg',
            size=len(b'fake-thumbnail-bytes'), hash='0' * 128,
        )
        thumb.file.name = f'files/{image.pk}-thumb'
        thumb.save()
        return thumb

    def test_retrieve_includes_thumbnail_from_the_sides_dicom_thumbnail(self):
        image = _make_image('SOP-T1', 'STUDY-T1', 'PAT-T1', role_slug='DICOM_XRAY_SAGITTAL')
        self._attach_thumbnail(image)
        row = UserRecentStudies.objects.create(owner=self.user, study=image.series.study)

        response = self.client.get(f'/api/dcm/recent-studies/{row.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['data']['thumbnail'].startswith('data:image/jpeg;base64,'))

    def test_falls_back_to_frontal_thumbnail_when_no_side_is_attached(self):
        image = _make_image('SOP-T2', 'STUDY-T2', 'PAT-T2', role_slug='DICOM_XRAY_FRONTAL')
        self._attach_thumbnail(image)
        row = UserRecentStudies.objects.create(owner=self.user, study=image.series.study)

        response = self.client.get(f'/api/dcm/recent-studies/{row.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['data']['thumbnail'].startswith('data:image/jpeg;base64,'))

    def test_thumbnail_is_null_when_no_dicom_thumbnail_exists_yet(self):
        image = _make_image('SOP-T3', 'STUDY-T3', 'PAT-T3', role_slug='DICOM_XRAY_SAGITTAL')
        UserRecentStudies.objects.create(owner=self.user, study=image.series.study)

        response = self.client.get('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(response.json()['data']['recent_studies'][0]['thumbnail'])


class UserRecentStudiesCrossUserIsolationTests(APITestCase):
    """The core security property of this whole feature: a session ID being
    known/guessable buys an attacker nothing -- every action is scoped to
    owner=request.user, so a non-owned row 404s exactly like a nonexistent one."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username='owner', password='pw')
        self.intruder = User.objects.create_user(username='intruder', password='pw')
        self.row = UserRecentStudies.objects.create(owner=self.owner)

    def test_intruder_cannot_retrieve(self):
        self.client.force_login(self.intruder)
        response = self.client.get(f'/api/dcm/recent-studies/{self.row.pk}/')
        self.assertEqual(response.status_code, 404)

    def test_intruder_cannot_see_it_in_list(self):
        self.client.force_login(self.intruder)
        response = self.client.get('/api/dcm/recent-studies/')
        ids = [item['id'] for item in response.json()['data']['recent_studies']]
        self.assertNotIn(self.row.pk, ids)

    def test_intruder_cannot_patch_polygons(self):
        self.client.force_login(self.intruder)
        response = self.client.patch(
            f'/api/dcm/recent-studies/{self.row.pk}/projections/side/', {'polygons': []}, format='json',
        )
        self.assertEqual(response.status_code, 404)
        self.row.refresh_from_db()
        self.assertEqual(self.row.side_polygons, [])

    def test_intruder_cannot_delete(self):
        self.client.force_login(self.intruder)
        response = self.client.delete(f'/api/dcm/recent-studies/{self.row.pk}/')
        self.assertEqual(response.status_code, 404)
        self.assertTrue(UserRecentStudies.objects.filter(pk=self.row.pk).exists())
