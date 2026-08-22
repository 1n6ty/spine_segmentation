from unittest.mock import patch

import numpy as np
from django.test import SimpleTestCase

from Dicom.utils.segmentation.compose import MAX_VERTEBRAE, segment_spine_from_S1_to_C2


def _instance(confidence, tag):
    return {
        "mask": None,
        "polygon": np.array([[tag, 0], [tag, 1], [tag + 1, 1], [tag + 1, 0]]),
        "confidence": confidence,
        "class_id": 0,
    }


class SegmentSpineFromS1ToC2Tests(SimpleTestCase):
    """Covers only the confidence-sort-and-cap step segment_spine_from_S1_to_C2 adds
    around get_instances/segment_spine_from_S1_to_C2_masks -- both mocked out, since
    exercising the real detection model or the unstick/reveal geometry pipeline needs a
    real image and is verified by hand (see e2e/live/helpers.ts's SIDE_FIXTURE)."""

    @patch("Dicom.utils.segmentation.compose.segment_spine_from_S1_to_C2_masks")
    @patch("Dicom.utils.segmentation.compose.get_instances")
    def test_caps_to_max_vertebrae_keeping_highest_confidence_first(self, mock_get_instances, mock_masks):
        # Confidence ascending, i.e. NOT list order -- a naive positional [:24] slice
        # would keep the 24 *least* confident instances instead of the best ones.
        mock_get_instances.return_value = [_instance(confidence=i, tag=i) for i in range(30)]
        mock_masks.return_value = []

        segment_spine_from_S1_to_C2(pixel_array=np.zeros((10, 10)), detection_model=object())

        passed_polygons = mock_masks.call_args[0][0]
        self.assertEqual(len(passed_polygons), MAX_VERTEBRAE)
        kept_tags = [int(p[0][0]) for p in passed_polygons]
        self.assertEqual(kept_tags, list(range(29, 29 - MAX_VERTEBRAE, -1)))

    @patch("Dicom.utils.segmentation.compose.segment_spine_from_S1_to_C2_masks")
    @patch("Dicom.utils.segmentation.compose.get_instances")
    def test_passes_through_unchanged_when_at_or_under_the_cap(self, mock_get_instances, mock_masks):
        mock_get_instances.return_value = [_instance(confidence=i, tag=i) for i in range(22)]
        mock_masks.return_value = []

        segment_spine_from_S1_to_C2(pixel_array=np.zeros((10, 10)), detection_model=object())

        passed_polygons = mock_masks.call_args[0][0]
        self.assertEqual(len(passed_polygons), 22)
