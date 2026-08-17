from asgiref.sync import sync_to_async
from rest_framework.pagination import NotFound, PageNumberPagination

from common.schemas.v1.errors import NotFoundResponse
from common.schemas.v1.pagination import Pagination_GET_Schema
from common.schemas.v1.response import ApiResponse

_PAGE_PARAM, _PAGE_SIZE_PARAM = Pagination_GET_Schema.model_fields.keys()


class BaseAsyncPagination(PageNumberPagination):
    """Shared shape for every list endpoint's async pagination class -- subclasses
    set page_size/max_page_size, items_key, and serialize_page()

    page_query_param/page_size_query_param are derived from Pagination_GET_Schema's
    field names -- that schema is the single source of truth for these wire names,
    for both docs (params_from_schema) and runtime (this class)."""

    page_size_query_param = _PAGE_SIZE_PARAM
    page_query_param = _PAGE_PARAM
    items_key: str = None

    async def paginate_queryset(self, queryset, request, view=None):
        try:
            return await sync_to_async(super().paginate_queryset)(queryset, request, view)
        except NotFound:
            page_number = request.query_params.get(self.page_query_param) or 1
            self.custom_error = NotFoundResponse.single(
                field="page", message=f"Page {page_number} does not exist."
            ).drf_response
            return None

    async def serialize_page(self, data) -> list:
        """Override to turn a page of model instances into a list of dicts.
        Default is the identity -- for endpoints whose view already hands
        pre-serialized dicts to get_paginated_response()."""
        return data

    async def get_paginated_response(self, data):
        items = await self.serialize_page(data)
        return ApiResponse().update_data({
            "meta": {
                "total_items": self.page.paginator.count,
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "page_size": self.get_page_size(self.request),
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
            },
            self.items_key: items,
        }).drf_response
