from common.paginations.base import BaseAsyncPagination
from FileManager.v1.schemas.file_role import FileRole_Item_Schema


class FileRole_Pagination(BaseAsyncPagination):
    page_size = 50
    max_page_size = 200
    items_key = 'roles'

    async def serialize_page(self, data) -> list:
        return [FileRole_Item_Schema.from_model(r).model_dump() for r in data]
