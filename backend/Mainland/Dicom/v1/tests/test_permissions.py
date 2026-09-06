from django.contrib.auth.models import Permission, User
from django.core.management import call_command
from rest_framework.test import APIClient, APITestCase

from Dicom.models import DicomFile, DicomImage, Patient, Series, Study, UserRecentStudies
from Dicom.v1.tests.base import create_doctor_user


def _create_admin_user(username):
    """An Admin-role-equivalent user: holds no Dicom.* permission at all, same
    as Profile.management.commands.sync_roles' 'admin' role definition (the
    matrix's "Admin is strictly prohibited from viewing studies or DICOM
    files"). Direct permission grant, not via the Admin group, to keep this
    test independent of sync_roles' exact role composition."""
    return User.objects.create_user(username=username, password='pw')


class DicomAccessStudiesPermissionTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)

        cls.doctor = create_doctor_user('doctor', password='pw')
        cls.admin = _create_admin_user('admin')

        patient = Patient.objects.create(patient_id='P1')
        study = Study.objects.create(study_instance_uid='S1', patient=patient)
        series = Series.objects.create(series_instance_uid='SE1', study=study)
        cls.image = DicomImage.objects.create(sop_instance_uid='SOP1', series=series)
        file_record = DicomFile(image=cls.image, series=series, name='SOP1.dcm', size=0, hash='0' * 128)
        file_record.file.name = 'private/dicom_files/SOP1.dcm'
        file_record.save()

    def setUp(self):
        self.client = APIClient()

    def test_admin_forbidden_from_parse(self):
        self.client.force_login(self.admin)
        response = self.client.post('/api/dcm/parse/', {}, format='multipart')
        self.assertEqual(response.status_code, 403, response.content)

    def test_doctor_allowed_to_reach_parse(self):
        # Not asserting 200 here -- an empty multipart body 400s on schema
        # validation before ever reaching parse_and_store_dicom. What's under
        # test is that the permission gate itself doesn't block the doctor.
        self.client.force_login(self.doctor)
        response = self.client.post('/api/dcm/parse/', {}, format='multipart')
        self.assertNotEqual(response.status_code, 403, response.content)

    def test_admin_forbidden_from_file_retrieve(self):
        self.client.force_login(self.admin)
        response = self.client.get(f'/api/dcm/{self.image.pk}/file/')
        self.assertEqual(response.status_code, 403, response.content)

    def test_doctor_allowed_file_retrieve(self):
        self.client.force_login(self.doctor)
        response = self.client.get(f'/api/dcm/{self.image.pk}/file/')
        self.assertEqual(response.status_code, 200, response.content)

    def test_admin_forbidden_from_segment_events(self):
        self.client.force_login(self.admin)
        response = self.client.get(f'/api/dcm/{self.image.pk}/segment/events/')
        self.assertEqual(response.status_code, 403, response.content)

    def test_admin_forbidden_from_recent_studies_list(self):
        self.client.force_login(self.admin)
        response = self.client.get('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 403, response.content)

    def test_doctor_allowed_recent_studies_list(self):
        self.client.force_login(self.doctor)
        response = self.client.get('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 200, response.content)

    def test_admin_forbidden_from_recent_studies_create(self):
        self.client.force_login(self.admin)
        response = self.client.post('/api/dcm/recent-studies/')
        self.assertEqual(response.status_code, 403, response.content)
        self.assertFalse(UserRecentStudies.objects.filter(owner=self.admin).exists())
