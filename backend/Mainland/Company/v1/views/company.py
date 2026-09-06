from asgiref.sync import sync_to_async
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from common.mixins.v1.viewset import StdViewSetMixin
from common.permissions.company import ManagedCompanyPermission
from common.schemas.v1.errors import BadRequestResponse, PermissionDeniedResponse, UnauthorizedResponse
from common.utils.company import scope_queryset_to_managed_companies
from Company.v1.utils.constants import COMPANY_ID_URL_KWARG, COMPANY_ID_URL_REGEX
from Company.models import Company
from Company.v1.filters.company import CompanyFilterSet
from Company.v1.paginations.company import Companies_Pagination
from Company.v1.schemas.docs.company import Company_LIST_Parameters
from Company.v1.schemas.company import (
    Company_GET_Schema,
    Company_LIST_Response_OK,
    Company_NotFound_Response,
    Company_RETRIEVE_Response_OK,
)


@extend_schema(tags=["Company Management"])
class CompanyViewSet(StdViewSetMixin):

    lookup_url_kwarg = COMPANY_ID_URL_KWARG
    lookup_value_regex = COMPANY_ID_URL_REGEX
    pagination_class = Companies_Pagination

    def get_permissions(self):
        if self.action == 'retrieve':
            return [IsAuthenticated(), ManagedCompanyPermission(is_company_row=True)]
        return [IsAuthenticated()]

    @extend_schema(
        summary="List all companies",
        description="Returns companies in the requesting user's managed_companies -- "
                    "scoped purely by managed_companies membership, no bypass tier.",
        parameters=Company_LIST_Parameters,
        responses={
            200: Company_LIST_Response_OK,
            400: BadRequestResponse,
            401: UnauthorizedResponse,
            403: PermissionDeniedResponse,
        },
    )
    async def list(self, request: Request) -> Response:
        try:
            Company_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response

        qs = Company.objects.prefetch_related('translations').order_by('id')
        qs = await sync_to_async(scope_queryset_to_managed_companies)(request.user, qs, company_field='pk')
        filtered_qs = await sync_to_async(
            lambda: CompanyFilterSet(request.query_params, queryset=qs, request=request).qs
        )()
        paginator = self.pagination_class()
        page = await paginator.paginate_queryset(filtered_qs, request, view=self)
        if page is None:
            return paginator.custom_error
        return await paginator.get_paginated_response(page)

    @extend_schema(
        summary="Retrieve a company",
        description="Returns the full detail of a single company. Requires the "
                    "company to be in the requesting user's managed_companies.",
        responses={
            200: Company_RETRIEVE_Response_OK,
            401: UnauthorizedResponse,
            403: PermissionDeniedResponse,
            404: Company_NotFound_Response,
        },
    )
    async def retrieve(self, request: Request, company_id=None) -> Response:
        try:
            company = await Company.objects.prefetch_related('translations').aget(pk=company_id)
        except Company.DoesNotExist:
            return Company_NotFound_Response.from_pk(company_id).drf_response

        await sync_to_async(self.check_object_permissions)(request, company)

        return Company_RETRIEVE_Response_OK.from_model(company).drf_response
