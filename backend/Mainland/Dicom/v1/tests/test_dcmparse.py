import asyncio
import warnings
from unittest.mock import patch

import numpy as np
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from common.schemas.v1.response import Issue
from Dicom.models import (
    DicomFile, DicomImage, DicomThumbnail, Patient, Projection, Series, SegmentationStatus, Study,
)
from Dicom.utils.parse import parse_and_store_dicom
from FileManager.models import CasFile


async def _drain(async_iterable) -> bytes:
    return b"".join([chunk async for chunk in async_iterable])


class DcmParseTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='doctor', password='pw')

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        upload = _fake_upload("scan.dcm", b"dummy dicom bytes")
        response = self.client.post('/api/dcm/parse/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 401)

    def test_parse_rejects_non_dicom_file(self):
        upload = _fake_upload("scan.txt", b"not a dicom file")
        response = self.client.post('/api/dcm/parse/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 400, response.content)

    @patch('Dicom.v1.views.dcmparse.parse_and_store_dicom')
    def test_parse_accepts_dicom_file_and_delegates(self, mock_parse):
        upload = _fake_upload("scan.dcm", b"dummy dicom bytes")
        response = self.client.post('/api/dcm/parse/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status'], 'ok')
        mock_parse.assert_awaited_once()
        self.assertIsNone(mock_parse.call_args.kwargs.get('file_role_slug'))

    @patch('Dicom.v1.views.dcmparse.parse_and_store_dicom')
    def test_parse_forwards_file_role_slug(self, mock_parse):
        upload = _fake_upload("scan.dcm", b"dummy dicom bytes")
        response = self.client.post(
            '/api/dcm/parse/', {'file': upload, 'file_role_slug': 'DICOM_XRAY_FRONTAL'}, format='multipart'
        )
        self.assertEqual(response.status_code, 200, response.content)
        mock_parse.assert_awaited_once()
        self.assertEqual(mock_parse.call_args.kwargs.get('file_role_slug'), 'DICOM_XRAY_FRONTAL')


class DcmFileTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='doctor', password='pw')
        patient = Patient.objects.create(patient_id='P1')
        study = Study.objects.create(study_instance_uid='S1', patient=patient)
        series = Series.objects.create(series_instance_uid='SE1', study=study)
        cls.image = DicomImage.objects.create(sop_instance_uid='SOP1', series=series)
        # Sets the FieldFile's name directly rather than .save()-ing real bytes
        # through it -- the `file` action only ever reads `.xray_file.file.name` to
        # build the X-Accel-Redirect header, so no actual storage I/O is needed
        # here, and this avoids requiring a reachable S3/MinIO endpoint in tests.
        cls.file_record = DicomFile(image=cls.image, series=series, name='SOP1.dcm', size=0, hash='0' * 128)
        cls.file_record.file.name = 'private/dicom_files/SOP1.dcm'
        cls.file_record.save()

    def test_unauthenticated_returns_401(self):
        response = self.client.get(f'/api/dcm/{self.image.pk}/file/')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_gets_x_accel_redirect(self):
        self.client.force_login(self.user)
        response = self.client.get(f'/api/dcm/{self.image.pk}/file/')
        self.assertEqual(response.status_code, 200, response.content)
        # Exact match, not just assertIn -- must match Nginx/templates/api.conf.template's
        # real internal location (^/internal/private/(?<object_key>.+)$) exactly, or nginx
        # 404s the redirect target. A substring check alone previously let a wrong prefix
        # (/internal/media-private/... instead of /internal/private/...) pass silently.
        self.assertEqual(
            response['X-Accel-Redirect'], f'/internal/private/{self.file_record.file.name}'
        )

    def test_unknown_sop_uid_returns_404(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/dcm/does-not-exist/file/')
        self.assertEqual(response.status_code, 404)

    def test_dotted_sop_uid_still_matches_the_route(self):
        # Real SOP Instance UIDs are dotted OID strings -- DRF's default router
        # lookup regex ([^/.]+) excludes '.', so this would 404 from routing
        # alone (never even reaching the view) without `lookup_value_regex`
        # overridden on DcmViewSet.
        dotted_uid = '1.2.840.10008.5.1.4.1.1.7.1.99.887.1'
        patient = Patient.objects.create(patient_id='P2')
        study = Study.objects.create(study_instance_uid='S2', patient=patient)
        series = Series.objects.create(series_instance_uid='SE2', study=study)
        image = DicomImage.objects.create(sop_instance_uid=dotted_uid, series=series)
        file_record = DicomFile(image=image, series=series, name=f'{dotted_uid}.dcm', size=0, hash='1' * 128)
        file_record.file.name = f'private/dicom_files/{dotted_uid}.dcm'
        file_record.save()

        self.client.force_login(self.user)
        response = self.client.get(f'/api/dcm/{dotted_uid}/file/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn('X-Accel-Redirect', response)


class DcmSegmentEventsTests(APITransactionTestCase):
    """Only exercises the terminal-status case (pre-set segmentation_status ==
    'done', immediate hydration + stream close) -- the non-terminal live-tail
    path requires driving the Channels layer's async group_add/receive cycle
    from a test, which needs the async test client rather than APIClient and
    is left for a live/manual check per the plan's Verification section.

    Uses APITransactionTestCase (not APITestCase) because draining the async
    SSE generator hands control to a separate thread via sync_to_async, which
    needs its own real DB connection -- SQLite can't share TestCase's wrapping
    transaction across threads without deadlocking ('database table is
    locked')."""

    def setUp(self):
        self.client = APIClient()
        # APITransactionTestCase has no setUpTestData -- each test truncates
        # tables rather than rolling back a transaction, so fixtures are
        # created fresh per-test here instead of once per-class.
        self.user = User.objects.create_user(username='doctor', password='pw')
        done = SegmentationStatus.objects.create(slug='done')
        patient = Patient.objects.create(patient_id='P1')
        study = Study.objects.create(study_instance_uid='S1', patient=patient)
        series = Series.objects.create(series_instance_uid='SE1', study=study)
        self.image = DicomImage.objects.create(
            sop_instance_uid='SOP1',
            series=series,
            segmentation_status=done,
            reference_points={'vertebraes': []},
        )

    def test_unauthenticated_returns_401(self):
        response = self.client.get(f'/api/dcm/{self.image.pk}/segment/events/')
        self.assertEqual(response.status_code, 401)

    def test_terminal_status_hydrates_and_closes(self):
        self.client.force_login(self.user)
        response = self.client.get(f'/api/dcm/{self.image.pk}/segment/events/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/event-stream')
        body = asyncio.run(_drain(response.streaming_content)).decode()
        self.assertIn('"status": "done"', body)

    def test_unknown_sop_uid_emits_error_and_closes(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/dcm/does-not-exist/segment/events/')
        self.assertEqual(response.status_code, 200)
        body = asyncio.run(_drain(response.streaming_content)).decode()
        self.assertIn('"status": "error"', body)

    def test_dotted_sop_uid_still_matches_the_route(self):
        # Same routing concern as DcmFileTests.test_dotted_sop_uid_still_matches_the_route,
        # exercised here for the `segment/events` detail route too.
        dotted_uid = '1.2.840.10008.5.1.4.1.1.7.1.99.887.2'
        # setUp() already created the 'done' SegmentationStatus row -- reuse it
        # rather than create() a second one (slug is unique).
        done = SegmentationStatus.objects.get(slug='done')
        patient = Patient.objects.create(patient_id='P2')
        study = Study.objects.create(study_instance_uid='S2', patient=patient)
        series = Series.objects.create(series_instance_uid='SE2', study=study)
        DicomImage.objects.create(
            sop_instance_uid=dotted_uid,
            series=series,
            segmentation_status=done,
            reference_points={'vertebraes': []},
        )

        self.client.force_login(self.user)
        response = self.client.get(f'/api/dcm/{dotted_uid}/segment/events/')
        self.assertEqual(response.status_code, 200)
        body = asyncio.run(_drain(response.streaming_content)).decode()
        self.assertIn('"status": "done"', body)


class DcmParseDedupAndRoleTests(APITransactionTestCase):
    """Exercises parse_and_store_dicom() directly against a fake pydicom Dataset --
    avoids needing a real .dcm file on disk while still running the actual CAS
    write/dedup/max-count logic end-to-end. Only the physical storage write/delete
    are mocked (at the PrivateMediaStorage boundary, not higher up), so the real
    CasFile ref-counting signals still fire for real, same as in production.

    Uses APITransactionTestCase (not APITestCase), same reason as
    DcmSegmentEventsTests above: parse_and_store_dicom's async ORM calls hand off
    to a separate thread via sync_to_async, which needs its own real DB connection
    -- SQLite can't share TestCase's wrapping transaction across threads without
    deadlocking ('database table is locked'). This also means DicomFile's
    post_delete signal's transaction.on_commit(...) fires for real here (no
    captureOnCommitCallbacks needed) since there's no outer transaction to roll
    back -- every write commits immediately, same as production."""

    def setUp(self):
        # pydicom validates UI (UID) VR format against real OID syntax -- the
        # short human-readable fake UIDs used below (e.g. 'STUDY-A') aren't valid
        # OIDs and would otherwise spam every test with UserWarnings.
        warnings.filterwarnings('ignore', category=UserWarning, module='pydicom')
        call_command('create_xray_file_roles_if_not_exists', verbosity=0)
        Projection.objects.get_or_create(slug='frontal')
        Projection.objects.get_or_create(slug='sagittal')

        self.mock_save = patch(
            'common.storages.PrivateMediaStorage._save', side_effect=lambda name, content: name
        ).start()
        self.addCleanup(patch.stopall)
        patch('common.storages.PrivateMediaStorage.exists', return_value=False).start()
        self.mock_delete = patch('common.storages.PrivateMediaStorage.delete').start()
        self.mock_delay = patch('Dicom.utils.parse.segment_vertebraes.delay').start()

    @staticmethod
    def _dataset(sop_uid, study_uid, view_position='AP', series_uid=None, patient_id='PAT1'):
        ds = Dataset()
        ds.PatientID = patient_id
        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid or f'{study_uid}-SE1'
        ds.SOPInstanceUID = sop_uid
        ds.ViewPosition = view_position
        ds.Rows = 4
        ds.Columns = 4
        return ds

    def _upload(self, ds, content, file_role_slug=None):
        upload = SimpleUploadedFile(f'{ds.SOPInstanceUID}.dcm', content)
        with patch('Dicom.utils.parse.pydicom.dcmread', return_value=ds):
            return asyncio.run(parse_and_store_dicom(upload, file_role_slug=file_role_slug))

    def test_identical_content_dedupes_to_one_casfile(self):
        result_a = self._upload(self._dataset('SOP-A', 'STUDY-A'), b'same-bytes')
        result_b = self._upload(self._dataset('SOP-B', 'STUDY-B'), b'same-bytes')

        self.assertNotIsInstance(result_a, Issue)
        self.assertNotIsInstance(result_b, Issue)
        self.assertEqual(CasFile.objects.count(), 1)
        self.assertEqual(CasFile.objects.get().ref_count, 2)
        # Second upload found the CasFile already registered for this hash and
        # skipped the physical write entirely -- only the first upload actually
        # called through to storage.
        self.assertEqual(self.mock_save.call_count, 1)

    def test_reuploading_identical_content_for_same_image_is_noop(self):
        ds = self._dataset('SOP-C', 'STUDY-C')
        self._upload(ds, b'same-again')
        self.assertEqual(self.mock_delay.call_count, 1)

        self._upload(ds, b'same-again')

        self.assertEqual(DicomFile.objects.filter(image_id='SOP-C').count(), 1)
        self.assertEqual(CasFile.objects.get().ref_count, 1)
        # Content unchanged -- no redundant segmentation re-run.
        self.assertEqual(self.mock_delay.call_count, 1)

    def test_reuses_completed_segmentation_for_identical_content_under_a_different_sop_uid(self):
        # Simulates a physical image re-exported under a new SOPInstanceUID --
        # byte-identical content (same hash), genuinely different image
        # identity (own SOP UID, own Study). The AI's output is a pure
        # function of the pixel bytes, so this must reuse the completed
        # result instead of re-running the model.
        self._upload(self._dataset('SOP-REUSE-1', 'STUDY-REUSE-1'), b'shared-bytes')
        self.assertEqual(self.mock_delay.call_count, 1)

        done = SegmentationStatus.objects.create(slug='done')
        original = DicomImage.objects.get(sop_instance_uid='SOP-REUSE-1')
        original.segmentation_status = done
        original.reference_points = {
            'vertebraes': [{'name': 'L5', 'points': [[0, 0], [0, 1], [1, 1], [1, 0]]}]
        }
        original.save()

        self._upload(self._dataset('SOP-REUSE-2', 'STUDY-REUSE-2'), b'shared-bytes')

        # No second AI run -- the existing done result was reused instead.
        self.assertEqual(self.mock_delay.call_count, 1)

        reused = DicomImage.objects.get(sop_instance_uid='SOP-REUSE-2')
        self.assertEqual(reused.segmentation_status_id, done.pk)
        self.assertEqual(reused.reference_points, original.reference_points)

    def test_does_not_reuse_a_not_yet_completed_segmentation(self):
        # The matching-hash image's segmentation is still in progress (no
        # 'done' status yet) -- borrowing that state would leave the new
        # image stuck, since only the *other* SOP instance's own Celery task
        # ever advances it further. Must fall through to a real, independent
        # segmentation run instead.
        self._upload(self._dataset('SOP-PENDING-1', 'STUDY-PENDING-1'), b'still-processing-bytes')
        self.assertEqual(self.mock_delay.call_count, 1)

        self._upload(self._dataset('SOP-PENDING-2', 'STUDY-PENDING-2'), b'still-processing-bytes')

        self.assertEqual(self.mock_delay.call_count, 2)

    def test_second_distinct_frontal_upload_same_series_is_rejected(self):
        # FileRole.max_count=1 for the seeded X-ray roles (see
        # create_xray_file_roles_if_not_exists.py), scoped per Series (not
        # Study) -- a Series can hold at most one frontal-role file, so a
        # second, genuinely different frontal image landing in the *same*
        # Series is correctly rejected.
        study_uid = 'STUDY-D'
        series_uid = 'STUDY-D-SE1'
        self._upload(
            self._dataset('SOP-D1', study_uid, series_uid=series_uid), b'first',
            file_role_slug='DICOM_XRAY_FRONTAL',
        )

        result = self._upload(
            self._dataset('SOP-D2', study_uid, series_uid=series_uid), b'second',
            file_role_slug='DICOM_XRAY_FRONTAL',
        )

        self.assertIsInstance(result, Issue)
        self.assertEqual(result.code, 400)
        self.assertFalse(DicomImage.objects.filter(sop_instance_uid='SOP-D2').exists())

    def test_second_distinct_frontal_upload_same_study_different_series_is_allowed(self):
        # The cap is per (series, role), not per (study, role) -- Study is
        # shared content-addressed infra any number of UserRecentStudies
        # sessions (same user or different users) can reference, so a second,
        # genuinely different frontal image sharing a real DICOM
        # StudyInstanceUID but landing in a *different* Series (not unusual
        # with templated/synthetic test data) must not be rejected.
        study_uid = 'STUDY-DS'
        self._upload(
            self._dataset('SOP-DS1', study_uid, series_uid='STUDY-DS-SE1'), b'first',
            file_role_slug='DICOM_XRAY_FRONTAL',
        )

        result = self._upload(
            self._dataset('SOP-DS2', study_uid, series_uid='STUDY-DS-SE2'), b'second',
            file_role_slug='DICOM_XRAY_FRONTAL',
        )

        self.assertNotIsInstance(result, Issue)
        self.assertTrue(DicomImage.objects.filter(sop_instance_uid='SOP-DS2').exists())
        self.assertEqual(
            DicomFile.objects.filter(
                series__study__study_instance_uid=study_uid, role__slug='DICOM_XRAY_FRONTAL',
            ).count(), 2,
        )

    def test_second_sagittal_upload_same_study_is_allowed(self):
        # Second upload omits file_role_slug entirely -- exercises the
        # default-to-sagittal fallback landing in a *different* role bucket
        # than the first (explicitly frontal) upload, so neither trips the
        # other's max_count=1.
        study_uid = 'STUDY-E'
        self._upload(self._dataset('SOP-E1', study_uid), b'frontal-bytes', file_role_slug='DICOM_XRAY_FRONTAL')

        result = self._upload(self._dataset('SOP-E2', study_uid), b'sagittal-bytes')

        self.assertNotIsInstance(result, Issue)
        file_record = DicomFile.objects.get(image_id='SOP-E2')
        self.assertEqual(file_record.role.slug, 'DICOM_XRAY_SAGITTAL')

    def test_unknown_file_role_slug_returns_400_issue(self):
        result = self._upload(
            self._dataset('SOP-G', 'STUDY-G'), b'bytes', file_role_slug='NOT_A_REAL_ROLE'
        )

        self.assertIsInstance(result, Issue)
        self.assertEqual(result.code, 400)
        self.assertEqual(result.field, 'file_role_slug')
        self.assertFalse(DicomImage.objects.filter(sop_instance_uid='SOP-G').exists())

    def test_deleting_image_decrements_and_cleans_up_casfile(self):
        self._upload(self._dataset('SOP-F', 'STUDY-F'), b'to-be-deleted')
        cas_path = CasFile.objects.get().path
        self.assertEqual(CasFile.objects.get().ref_count, 1)

        DicomImage.objects.get(sop_instance_uid='SOP-F').delete()

        self.assertFalse(CasFile.objects.filter(path=cas_path).exists())
        self.mock_delete.assert_called_once_with(cas_path)

    def test_second_upload_of_identical_bytes_skips_ai_and_sse_serves_existing_result(self):
        """Ties together two mechanisms to prove the actual user-visible
        property: re-uploading byte-identical content -- by the same or a
        different user/session, e.g. Dicom.v1.views.user_recent_studies's
        `projection` action attaching a second UserRecentStudies row to an
        already-processed DicomImage -- never re-runs AI segmentation, and the
        already-computed result is served immediately over the same SSE
        endpoint a fresh upload would use, with no new Celery run needed."""
        ds = self._dataset('SOP-DEDUP', 'STUDY-DEDUP')
        self._upload(ds, b'identical-bytes')
        self.assertEqual(self.mock_delay.call_count, 1)

        # Simulate the Celery task having completed for the first upload --
        # segment_vertebraes itself is mocked away in this test entirely.
        done = SegmentationStatus.objects.create(slug='done')
        image = DicomImage.objects.get(sop_instance_uid='SOP-DEDUP')
        image.segmentation_status = done
        image.reference_points = {
            'vertebraes': [{'name': 'L5', 'points': [[0, 0], [0, 1], [1, 1], [1, 0]]}]
        }
        image.save()

        # A second "upload" of the byte-identical file -- same SOP Instance UID,
        # since it's embedded in the bytes themselves -- must not re-trigger AI.
        self._upload(self._dataset('SOP-DEDUP', 'STUDY-DEDUP'), b'identical-bytes')
        self.assertEqual(self.mock_delay.call_count, 1)

        # And the SSE endpoint -- what a second session's frontend watches --
        # immediately self-hydrates the already-computed result.
        user = User.objects.create_user(username='doctor-dedup', password='pw')
        client = APIClient()
        client.force_login(user)
        response = client.get('/api/dcm/SOP-DEDUP/segment/events/')
        self.assertEqual(response.status_code, 200)
        body = asyncio.run(_drain(response.streaming_content)).decode()
        self.assertIn('"status": "done"', body)
        self.assertIn('"L5"', body)

    @staticmethod
    def _dataset_with_pixels(sop_uid, study_uid, seed=0):
        # A bare Dataset() (what _dataset() builds) has no PixelData, which is
        # fine for every other test here -- thumbnail generation is wholly
        # best-effort (wrapped in try/except in parse_and_store_dicom) and
        # simply no-ops without it. This variant adds the minimum real,
        # decodable pixel content pydicom's own .pixel_array/apply_voi_lut
        # need, to actually exercise Dicom.utils.thumbnail's render+CAS path.
        ds = DcmParseDedupAndRoleTests._dataset(sop_uid, study_uid)
        ds.file_meta = FileMetaDataset()
        ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = 'MONOCHROME2'
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 0
        ds.is_little_endian = True
        ds.is_implicit_VR = False
        ds.PixelData = (np.arange(16, dtype=np.uint16) + seed).reshape(4, 4).tobytes()
        return ds

    def test_generates_and_cas_dedupes_thumbnail_for_identical_pixel_content(self):
        self._upload(self._dataset_with_pixels('SOP-THUMB-1', 'STUDY-THUMB-1'), b'thumb-bytes-1')
        thumb_1 = DicomThumbnail.objects.get(image_id='SOP-THUMB-1')

        # A different SOP Instance UID, different Study -- but the exact same
        # pixel content -- must render a byte-identical JPEG and therefore
        # CAS-dedupe to the same physical file, same as DicomFile's own dedup.
        self._upload(self._dataset_with_pixels('SOP-THUMB-2', 'STUDY-THUMB-2'), b'thumb-bytes-2')
        thumb_2 = DicomThumbnail.objects.get(image_id='SOP-THUMB-2')

        self.assertEqual(thumb_1.hash, thumb_2.hash)
        self.assertEqual(thumb_1.file.name, thumb_2.file.name)
        self.assertEqual(CasFile.objects.filter(path=thumb_1.file.name).get().ref_count, 2)

    def test_no_thumbnail_row_when_dataset_has_no_pixel_data(self):
        # _dataset() (used by every other test in this class) has no
        # PixelData -- generate_and_store_thumbnail's failure there must be
        # swallowed (best-effort), never surfaced as a failed upload.
        result = self._upload(self._dataset('SOP-NOPIX', 'STUDY-NOPIX'), b'no-pixel-data')
        self.assertNotIsInstance(result, Issue)
        self.assertFalse(DicomThumbnail.objects.filter(image_id='SOP-NOPIX').exists())


def _fake_upload(name: str, content: bytes):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, content)
