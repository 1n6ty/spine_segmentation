import numpy as np
import cv2
from asgiref.sync import sync_to_async
from django.core.files.base import ContentFile

from Dicom.utils.pixels import dicom_to_windowed_float32
from Dicom.models import DicomImage, DicomThumbnail
from FileManager.models import CasFile
from FileManager.utils import build_cas_path, compute_hash

_THUMBNAIL_SIZE = 128
_THUMBNAIL_QUALITY = 30


def _render_thumbnail_jpeg(dcm) -> bytes:
    """Renders dcm's pixel data as a centered, letterboxed 128x128 grayscale
    JPEG -- same fit-and-center math as the frontend's own local preview
    (frontend/src/lib/core/session/session.svelte.ts), so the two look
    identical."""
    pixel_array = dicom_to_windowed_float32(dcm)

    normalized = pixel_array - pixel_array.min()
    max_val = normalized.max()
    if max_val > 0:
        normalized = normalized / max_val
    img = (normalized * 255).astype(np.uint8)

    h, w = img.shape[:2]
    scale = min(_THUMBNAIL_SIZE / w, _THUMBNAIL_SIZE / h)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    canvas = np.zeros((_THUMBNAIL_SIZE, _THUMBNAIL_SIZE), dtype=np.uint8)
    x_off, y_off = (_THUMBNAIL_SIZE - new_w) // 2, (_THUMBNAIL_SIZE - new_h) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized

    ok, buf = cv2.imencode('.jpg', canvas, [cv2.IMWRITE_JPEG_QUALITY, _THUMBNAIL_QUALITY])
    if not ok:
        raise ValueError("Failed to encode thumbnail JPEG")
    return buf.tobytes()


async def generate_and_store_thumbnail(image: DicomImage, dcm) -> None:
    """Renders and CAS-stores a 128x128 JPEG preview of dcm's pixel data,
    replacing any previous DicomThumbnail for this image. Never re-points an
    existing row's `.file` at a different CAS path in place -- same
    delete+recreate invariant as DicomFile's own CAS write, since
    CasFileMixin's ref-counting only fires on post_save(created=True) /
    post_delete. Content-addressing (build_cas_path(thumbnail_hash) +
    checking for an existing CasFile at that path first) is what gives this
    dedup for free: two DicomImages sharing identical pixel bytes render a
    byte-identical JPEG and end up pointing at the same physical file."""
    thumbnail_bytes = await sync_to_async(_render_thumbnail_jpeg)(dcm)
    thumbnail_hash = compute_hash(thumbnail_bytes)

    existing = await DicomThumbnail.objects.filter(image=image).afirst()
    if existing is not None:
        if existing.hash == thumbnail_hash:
            return
        await existing.adelete()

    path = build_cas_path(thumbnail_hash)
    thumbnail_record = DicomThumbnail(
        image=image, name=f"{image.pk}-thumbnail.jpg",
        content_type='image/jpeg', size=len(thumbnail_bytes), hash=thumbnail_hash,
    )
    if await CasFile.objects.filter(path=path).aexists():
        thumbnail_record.file.name = path
        await thumbnail_record.asave()
    else:
        await sync_to_async(thumbnail_record.file.save)(
            path, ContentFile(thumbnail_bytes), save=True
        )
