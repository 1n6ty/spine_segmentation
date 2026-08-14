from common.paginations.base import BaseAsyncPagination
from common.schemas.v1.domain.user import User_Item_Schema


class Profiles_Pagination(BaseAsyncPagination):
    page_size = 50
    max_page_size = 200
    items_key = 'users'
    extend: frozenset = frozenset()

    async def serialize_page(self, data) -> list:
        return [
            User_Item_Schema.from_model(u, profile=getattr(u, 'profile', None), extend=self.extend).model_dump()
            for u in data
        ]
