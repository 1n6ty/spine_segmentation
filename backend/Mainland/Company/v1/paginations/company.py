from common.paginations.base import BaseAsyncPagination
from common.schemas.v1.domain.company import Company_Item_Schema


class Companies_Pagination(BaseAsyncPagination):
    page_size = 50
    max_page_size = 200
    items_key = 'companies'

    async def serialize_page(self, data) -> list:
        return [Company_Item_Schema.from_model(c).model_dump() for c in data]
