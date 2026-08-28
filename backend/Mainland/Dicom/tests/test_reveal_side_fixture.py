import os
from pathlib import Path

import pydicom
from django.conf import settings
from django.test import SimpleTestCase

from Dicom.utils.pixels import dicom_to_windowed_float32
from Dicom.utils.constants import SEGMENTATION_MODEL_WEIGHTS
from Dicom.utils.segmentation.compose import MAX_VERTEBRAE, segment_spine_from_S1_to_C2

_FIXTURE_ENV = "SEGMENTATION_TEST_FIXTURE"


class RevealSideFixtureTests(SimpleTestCase):
    """Exercises the real unstick/reveal geometry pipeline (not mocked, unlike
    test_segmentation_compose.py) against a real DICOM -- guards the bug where
    reveal() over-inserted a clean detection under MAX_VERTEBRAE into 41 final
    vertebraes (see heal/reveal.py's get_missing_t_estimates/reveal).

    Skipped unless SEGMENTATION_TEST_FIXTURE points at a real .dcm file --
    Data/ isn't part of the image (see manage.sh / Dockerfile), so this only
    runs when the fixture is explicitly mounted in."""

    def test_reveal_stays_within_max_vertebrae_on_real_fixture(self):
        fixture_path = os.environ.get(_FIXTURE_ENV)
        if not fixture_path or not Path(fixture_path).is_file():
            self.skipTest(f"{_FIXTURE_ENV} not set to an existing file, skipping real-fixture reveal check.")

        from sahi import AutoDetectionModel

        dcm = pydicom.dcmread(fixture_path)
        pixel_array = dicom_to_windowed_float32(dcm)

        detection_model = AutoDetectionModel.from_pretrained(
            model_type="ultralytics",
            model_path=str(settings.BASE_DIR / SEGMENTATION_MODEL_WEIGHTS["sagittal"]),
            confidence_threshold=0.3,
            device="cpu",
        )

        vertebraes = segment_spine_from_S1_to_C2(pixel_array=pixel_array, detection_model=detection_model)

        print(f"[reveal fixture check] final vertebrae count: {len(vertebraes)}")
        print(f"[reveal fixture check] names: {[v.name for v in vertebraes]}")

        self.assertLessEqual(len(vertebraes), MAX_VERTEBRAE)
