import asyncio

from common.paginations.base import BaseAsyncPagination
from Dicom.v1.schemas.user_recent_studies import UserRecentStudies_Ref_Schema
from Dicom.v1.utils.session_images import resolve_session_images
from Dicom.v1.utils.thumbnail import thumbnail_data_uri


class UserRecentStudies_Pagination(BaseAsyncPagination):
    page_size = 20
    max_page_size = 100
    items_key = 'recent_studies'

    async def serialize_page(self, data) -> list:
        rows = list(data)
        # Thumbnail reads depend on the FieldFile resolve_session_images finds
        # (the row's side/frontal DicomImage's own DicomThumbnail) -- resolve
        # images for every row first, then read every resolved thumbnail,
        # each phase parallelized across rows rather than serially awaited.
        images = await asyncio.gather(*(resolve_session_images(row.study) for row in rows))
        uris = await asyncio.gather(*(thumbnail_data_uri(img.thumbnail_field_file) for img in images))
        return [
            UserRecentStudies_Ref_Schema.from_model(
                row, thumbnail_data_uri=uri,
                side_sop_instance_uid=img.side_sop_instance_uid,
                frontal_sop_instance_uid=img.frontal_sop_instance_uid,
            ).model_dump()
            for row, uri, img in zip(rows, uris, images)
        ]
