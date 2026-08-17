import base64
import mimetypes
from typing import Optional

from asgiref.sync import sync_to_async
from django.db.models.fields.files import FieldFile


def _read_data_uri(field_file: FieldFile) -> Optional[str]:
    if not field_file:
        return None
    field_file.open('rb')
    try:
        data = field_file.read()
    finally:
        field_file.close()
    content_type = mimetypes.guess_type(field_file.name)[0] or 'image/jpeg'
    return f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"


async def thumbnail_data_uri(field_file: FieldFile) -> Optional[str]:
    """Reads a UserRecentStudies.thumbnail ImageField from private storage and
    inlines it as a base64 data URI -- thumbnails are tiny (128x128 JPEGs), so a
    dedicated X-Accel-served route isn't worth it here, unlike raw DICOM files
    (large, never inlined -- see docs/patterns/media-serving.md), which keep
    streaming through the existing X-Accel-Redirect `file` action."""
    return await sync_to_async(_read_data_uri)(field_file)
