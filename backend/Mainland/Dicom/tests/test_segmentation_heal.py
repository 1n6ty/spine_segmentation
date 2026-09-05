import types
from unittest.mock import patch

import numpy as np
from django.test import SimpleTestCase

from Dicom.utils.segmentation.elements import Vertebrae
from Dicom.utils.segmentation.heal.unstick import _cut_vertebrae
from Dicom.utils.segmentation.instances import get_instances


def _quad(x0=10, y0=10, w=10, h=10):
    return np.array([[x0, y0], [x0, y0 + h], [x0 + w, y0 + h], [x0 + w, y0]], dtype=np.int32)


class OrderReferencePointsGuardTests(SimpleTestCase):
    """order_reference_points assumes a 4-point quad -- a degenerate input used to
    surface as an opaque 'kth(=2) out of bounds' from np.argpartition."""

    def test_raises_clear_error_on_fewer_than_four_points(self):
        v = Vertebrae(reference_points=np.array([[0, 0], [1, 1]], dtype=np.int32))
        nearest = Vertebrae(reference_points=_quad())

        with self.assertRaisesRegex(ValueError, r">=4-point quad"):
            v.order_reference_points(nearest, "down")

    def test_accepts_a_proper_quad(self):
        v = Vertebrae(reference_points=_quad(0, 0))
        nearest = Vertebrae(reference_points=_quad(0, 20))

        v.order_reference_points(nearest, "down")  # must not raise

        self.assertEqual(v.reference_points.shape, (4, 2))


class CutVertebraeDegenerateGuardTests(SimpleTestCase):
    """_cut_vertebrae intersects a cut quad with the original mask; when that overlap
    is empty / a sliver the contour has < 4 points and can't become a quad. It must
    leave the vertebra uncut instead of propagating a broken mask."""

    def test_returns_original_uncut_when_cut_quad_is_degenerate(self):
        init = Vertebrae(_quad(10, 10))
        # mode 'up' builds the cut quad from [ref[0], cut[0], cut[1], ref[3]];
        # these collapse it to a line -> fillConvexPoly fills nothing -> empty
        # intersection -> no contour.
        cut = np.array([[10, 10], [20, 10]], dtype=np.int32)

        result = _cut_vertebrae(init, cut, "up")

        self.assertIsInstance(result, Vertebrae)
        self.assertEqual(result.reference_points.shape, (4, 2))
        self.assertIsNot(result, init)
        np.testing.assert_array_equal(np.sort(result.reference_points, axis=0),
                                     np.sort(init.reference_points, axis=0))


class GetInstancesDegenerateFilterTests(SimpleTestCase):
    """get_instances must drop a mask that contours to fewer than 4 points -- a stray
    1-2px blob is not a vertebra and blows up the ordering geometry downstream."""

    @staticmethod
    def _prediction(bool_mask):
        return types.SimpleNamespace(
            mask=types.SimpleNamespace(bool_mask=bool_mask),
            score=types.SimpleNamespace(value=0.9),
            category=types.SimpleNamespace(id=0),
        )

    def test_skips_sub_quad_masks_keeps_real_ones(self):
        sliver = np.zeros((6, 6), dtype=bool)
        sliver[3, 1:3] = True  # 2px horizontal segment -> <4-point contour

        blob = np.zeros((6, 6), dtype=bool)
        blob[1:4, 1:4] = True  # 3x3 square -> proper 4-point contour

        result = types.SimpleNamespace(
            object_prediction_list=[self._prediction(sliver), self._prediction(blob)]
        )

        with patch("Dicom.utils.segmentation.instances.get_sliced_prediction", return_value=result):
            instances = get_instances(np.zeros((6, 6), dtype=np.float32), detection_model=object())

        self.assertEqual(len(instances), 1)
        self.assertGreaterEqual(instances[0]["polygon"].shape[0], 4)
