import numpy as np
from pydicom.pixels import apply_voi_lut


def dicom_to_windowed_float32(dcm) -> np.ndarray:
    """DICOM dataset -> VOI-LUT-windowed float32 pixels, polarity normalized.

    Mirrors the first two steps of model/train.py's ``load_dicom_uint8`` so the
    contrast the segmentation model is served matches what it trained on:

        apply_voi_lut -> MONOCHROME1 polarity fix

    Per-image min-max + uint8 cast stay at the individual call sites (e.g.
    Dicom.utils.segmentation.instances.get_instances), which already own them.

    MONOCHROME1 stores white-on-black inverted relative to MONOCHROME2; without
    the flip, lateral films stored as MONOCHROME1 hit the model with inverted
    contrast. Modality rescale (RescaleSlope/Intercept) is deliberately omitted
    to match training exactly -- it is identity for the CR/DX spine films here.
    """
    arr = apply_voi_lut(dcm.pixel_array, dcm).astype(np.float32)

    if str(getattr(dcm, "PhotometricInterpretation", "")).upper() == "MONOCHROME1":
        arr = arr.max() - arr

    return arr
