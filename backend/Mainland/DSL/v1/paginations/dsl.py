from common.schemas.v1.response import ApiResponse, Issue
from DSL.datasets.schema import DatasetSpec

from django.conf import settings

from rest_framework.pagination import PageNumberPagination, NotFound

from asgiref.sync import sync_to_async

class DSL_Pagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    page_query_param = 'page'

    def get_page_number(self, request, paginator):
        # Try POST body
        if request.method == "POST" and isinstance(request.data, dict):
            pagination_d = request.data.get('pagination', None)
            if pagination_d and self.page_query_param in pagination_d and pagination_d[self.page_query_param]:
                return pagination_d[self.page_query_param]

        # Fallback to query params
        return super().get_page_number(request, paginator)

    def get_page_size(self, request):
        # Try POST body
        if request.method == "POST" and isinstance(request.data, dict):
            pagination_d = request.data.get('pagination', None)

            size = None
            if pagination_d and self.page_size_query_param in pagination_d:
                size = pagination_d[self.page_size_query_param]
            
            if size is not None:
                try:
                    size = int(size)
                except (TypeError, ValueError):
                    return self.page_size
                return min(size, self.max_page_size)

        # Fallback to query params
        return super().get_page_size(request)

    async def paginate_queryset(self, queryset, request, view=None):
        try:
            return await sync_to_async(super().paginate_queryset)(queryset, request, view)
        except NotFound as e:
            page_number = request.query_params.get(self.page_query_param)
            page_number = page_number if page_number else 1
            self.custom_error = ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=404,
                    field="page",
                    message=f"Page {page_number} does not exist."
                )
            ).set_status(
                status="error",
                code=404
            ).drf_response
            return None

    def _transform_model(self, obj: dict, spec: DatasetSpec):
        for field, val in spec.fields.items():
            if val.source in obj:
                if val.type == "url":
                    obj[field] = settings.MEDIA_URL + obj[val.source]
                elif val.type == "date/time":
                    obj[field] = obj[val.source].strftime(settings.DATETIME_FORMAT)
                else:
                    obj[field] = obj[val.source]
                if field != val.source:
                    del obj[val.source]
        return obj

    async def get_paginated_response(self, data: dict, spec: DatasetSpec):
        transformed_rows = [self._transform_model(d, spec) for d in data]

        return ApiResponse().update_data(
            {
                "meta": {
                    "total_items": self.page.paginator.count,
                    "total_pages": self.page.paginator.num_pages,
                    "current_page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "next": self.get_next_link(),
                    "previous": self.get_previous_link()
                },
                "result": transformed_rows
            }
        ).drf_response
