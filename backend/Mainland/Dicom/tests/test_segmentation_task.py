import types
import warnings
from unittest.mock import patch

import numpy as np
from django.core.files.base import ContentFile
from django.test import TestCase

from Dicom.models import DicomFile, DicomImage, Patient, Projection, Series, Study
from Dicom.tasks.segmentation import segment_vertebraes
from Dicom.utils.constants import DICOM_XRAY_SAGITTAL_ROLE_SLUG, SEGMENTATION_PIPELINE_VERSION
from FileManager.models import FileRole


def _vertebra(name):
    return types.SimpleNamespace(name=name, reference_points=[(1.0, 2.0), (3.0, 4.0)])


class SegmentVertebraesStampingTests(TestCase):
    """Covers the pipeline-version provenance segment_vertebraes stamps onto the
    DicomImage row -- the real detection model, pixel decode, channel-layer
    broadcast and CAS storage read are all mocked (verified by hand / by
    SegmentSpineFromS1ToC2Tests), leaving just the save-and-stamp behaviour."""

    def setUp(self):
        warnings.filterwarnings('ignore', category=UserWarning, module='pydicom')
        patient = Patient.objects.create(patient_id='PAT-SEG')
        study = Study.objects.create(study_instance_uid='STUDY-SEG', patient=patient)
        self.series = Series.objects.create(series_instance_uid='SERIES-SEG', study=study)
        self.frontal = Projection.objects.create(slug='frontal')

        self._patches = [
            patch('Dicom.tasks.segmentation._advance_status'),
            patch('Dicom.tasks.segmentation._get_model'),
            patch('Dicom.tasks.segmentation.pydicom.dcmread', return_value=object()),
            patch('Dicom.tasks.segmentation.dicom_to_windowed_float32', return_value=np.zeros((4, 4))),
            patch('Dicom.tasks.segmentation.segment_spine_from_S1_to_C2',
                  return_value=[_vertebra('L5'), _vertebra('L4')]),
            patch('common.storages.PrivateMediaStorage._open', return_value=ContentFile(b'fake-dicom')),
        ]
        mocks = [p.start() for p in self._patches]
        self.addCleanup(patch.stopall)
        self.mock_advance = mocks[0]
        self.mock_get_model = mocks[1]
        self.mock_segment = mocks[4]

    def _make_image(self, sop_uid, projection, role=None):
        image = DicomImage.objects.create(
            sop_instance_uid=sop_uid, series=self.series, projection=projection,
        )
        file_record = DicomFile(
            image=image, series=self.series, name=f'{sop_uid}.dcm', size=0, hash='0' * 128, role=role,
        )
        file_record.file.name = f'private/dicom_files/{sop_uid}.dcm'
        file_record.save()
        return image

    def test_success_stamps_current_version_and_segmented_at(self):
        self._make_image('SOP-OK', self.frontal)

        segment_vertebraes('SOP-OK')

        row = DicomImage.objects.get(sop_instance_uid='SOP-OK')
        self.assertEqual(row.segmentation_model_version, SEGMENTATION_PIPELINE_VERSION)
        self.assertIsNotNone(row.segmented_at)
        self.assertEqual(row.reference_points['vertebraes'][0]['name'], 'L5')

    def test_version_stamped_before_done_broadcast(self):
        self._make_image('SOP-ORDER', self.frontal)
        seen = {}

        def record(channel_layer, image_instance, slug, ref_points=None):
            seen[slug] = image_instance.segmentation_model_version

        self.mock_advance.side_effect = record

        segment_vertebraes('SOP-ORDER')

        self.assertEqual(seen['done'], SEGMENTATION_PIPELINE_VERSION)

    def test_error_path_stamps_version_and_records_error(self):
        self._make_image('SOP-ERR', self.frontal)
        self.mock_segment.side_effect = RuntimeError('boom')

        with self.assertRaises(RuntimeError):
            segment_vertebraes('SOP-ERR')

        row = DicomImage.objects.get(sop_instance_uid='SOP-ERR')
        self.assertEqual(row.segmentation_error, 'boom')
        self.assertEqual(row.segmentation_model_version, SEGMENTATION_PIPELINE_VERSION)
        self.assertIsNotNone(row.segmented_at)
        # last _advance_status call was the 'error' transition
        self.assertEqual(self.mock_advance.call_args[0][2], 'error')

    def test_null_projection_with_no_role_errors_without_guessing_a_model(self):
        # An unresolved projection must NOT fall through to some default model
        # (routing a sagittal film through the frontal model, or vice versa,
        # yields plausible-looking but wrong landmarks). It errors instead --
        # and still stamps the version so an identical re-upload doesn't loop.
        self._make_image('SOP-NOPROJ', None, role=None)

        with self.assertRaises(ValueError):
            segment_vertebraes('SOP-NOPROJ')

        row = DicomImage.objects.get(sop_instance_uid='SOP-NOPROJ')
        self.assertIn('projection', row.segmentation_error)
        self.assertEqual(row.segmentation_model_version, SEGMENTATION_PIPELINE_VERSION)
        self.assertIsNotNone(row.segmented_at)
        self.assertEqual(self.mock_advance.call_args[0][2], 'error')
        self.mock_segment.assert_not_called()

    def test_null_projection_falls_back_to_persisted_xray_role(self):
        # A row stored before parse's role fallback existed can have projection
        # NULL; a stale-version re-dispatch re-runs only this task (not parse),
        # so the task recovers the projection from the persisted X-ray role.
        role = FileRole.objects.create(slug=DICOM_XRAY_SAGITTAL_ROLE_SLUG)
        self._make_image('SOP-ROLE-FB', None, role=role)

        segment_vertebraes('SOP-ROLE-FB')

        self.mock_get_model.assert_called_once_with('sagittal')
        row = DicomImage.objects.get(sop_instance_uid='SOP-ROLE-FB')
        self.assertEqual(row.reference_points['vertebraes'][0]['name'], 'L5')
        self.assertEqual(row.segmentation_model_version, SEGMENTATION_PIPELINE_VERSION)
