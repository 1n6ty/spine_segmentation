from asgiref.sync import sync_to_async
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from common.mixins.v1.viewset import StdViewSetMixin
from common.schemas.v1.errors import BadRequestResponse, UnauthorizedResponse
from FileManager.models import FileRole
from FileManager.v1.filters.file_role import FileRoleFilterSet
from FileManager.v1.paginations.file_role import FileRole_Pagination
from FileManager.v1.schemas.docs.file_role import FileRole_LIST_Parameters
from FileManager.v1.schemas.file_role import FileRole_GET_Schema, FileRole_LIST_Response_OK


@extend_schema(tags=["File Management"])
class FileRoleViewSet(StdViewSetMixin):
    pagination_class = FileRole_Pagination

    def get_permissions(self):
        return [IsAuthenticated()]

    @extend_schema(
        summary="List file roles",
        description="Returns a paginated list of all FileRoles with their allowed content types "
                    "and extensions. Use slug + constraints to pre-validate file picks before uploading, "
                    "max_count_per_entity field null - unlimited.",
        parameters=FileRole_LIST_Parameters,
        responses={200: FileRole_LIST_Response_OK, 400: BadRequestResponse, 401: UnauthorizedResponse},
    )
    async def list(self, request: Request) -> Response:
        try:
            FileRole_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response

        qs = FileRole.objects.prefetch_related('translations')
        filtered_qs = await sync_to_async(
            lambda: FileRoleFilterSet(request.query_params, queryset=qs, request=request).qs
        )()
        paginator = self.pagination_class()
        page = await paginator.paginate_queryset(filtered_qs, request, view=self)
        if page is None:
            return paginator.custom_error
        return await paginator.get_paginated_response(page)
