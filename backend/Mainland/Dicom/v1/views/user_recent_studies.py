from common.schemas.v1.response import OkResponse
from common.schemas.v1.errors import BadRequestResponse, UnauthorizedResponse
from common.mixins.v1.viewset import StdViewSetMixin
from common.permissions.base import HasPermCodename

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import ValidationError
from drf_spectacular.utils import extend_schema

from Dicom.models import DicomImage, UserRecentStudies
from Dicom.utils.constants import FRONTAL_PROJECTION_SLUG, SIDE_PROJECTION_SLUG
from Dicom.v1.paginations.user_recent_studies import UserRecentStudies_Pagination
from Dicom.v1.schemas.docs.user_recent_studies import UserRecentStudies_LIST_Parameters
from Dicom.v1.schemas.user_recent_studies import (
    UserRecentStudies_CREATE_Response_OK,
    UserRecentStudies_GET_Schema,
    UserRecentStudies_LIST_Response_OK,
    UserRecentStudies_NoneExist_Response,
    UserRecentStudies_NotFound_Response,
    UserRecentStudies_Projection_PATCH_Schema,
    UserRecentStudies_RETRIEVE_Response_OK,
)
from Dicom.v1.utils.session_images import resolve_session_images
from Dicom.v1.utils.thumbnail import thumbnail_data_uri


_POLYGONS_FIELDS = {
    SIDE_PROJECTION_SLUG: 'side_polygons',
    FRONTAL_PROJECTION_SLUG: 'frontal_polygons',
}

_SEGMENTS_FIELDS = {
    SIDE_PROJECTION_SLUG: 'side_segments',
    FRONTAL_PROJECTION_SLUG: 'frontal_segments',
}

_SELECT_RELATED = ('study__patient',)


@extend_schema(tags=["Recent Studies"])
class UserRecentStudiesViewSet(StdViewSetMixin):
    """Per-user 'recent studies' list -- the access-control boundary around
    persisted DICOM sessions. Every queryset here is scoped to
    `owner=request.user`; a row that exists but isn't owned by the requester
    404s exactly like a row that doesn't exist at all, so existence is never
    leaked across accounts. Underlying Patient/Study/Series/DicomImage rows
    are shared infra, untouched by any action here except being referenced."""

    pagination_class = UserRecentStudies_Pagination
    
    def get_permissions(self):
        return [HasPermCodename('Dicom.access_studies')]

    @staticmethod
    async def _item_response(row: UserRecentStudies) -> Response:
        """Shared by retrieve/latest: bumps last_accessed (opening a session --
        by any means -- counts as access) and builds the full Item response."""
        await row.asave(update_fields=['last_accessed'])
        images = await resolve_session_images(row.study)
        uri = await thumbnail_data_uri(images.thumbnail_field_file)
        return UserRecentStudies_RETRIEVE_Response_OK.from_model(
            row, thumbnail_data_uri=uri,
            side_sop_instance_uid=images.side_sop_instance_uid,
            frontal_sop_instance_uid=images.frontal_sop_instance_uid,
        ).drf_response

    @extend_schema(
        summary="Start a new recent study",
        description="Creates an empty UserRecentStudies row owned by the requesting user "
                    "and returns its id. Called once, the first time a user starts a new case.",
        request=None,
        responses={201: UserRecentStudies_CREATE_Response_OK, 401: UnauthorizedResponse},
    )
    async def create(self, request: Request) -> Response:
        row = await UserRecentStudies.objects.acreate(owner=request.user)
        return UserRecentStudies_CREATE_Response_OK.from_model(row).drf_response

    @extend_schema(
        summary="List the requesting user's recent studies",
        description="Ordered most-recently-accessed first. Each row is the slim ref shape "
                    "(patient brief + thumbnail); use retrieve for the full detail.",
        parameters=UserRecentStudies_LIST_Parameters,
        responses={200: UserRecentStudies_LIST_Response_OK, 400: BadRequestResponse, 401: UnauthorizedResponse},
    )
    async def list(self, request: Request) -> Response:
        try:
            UserRecentStudies_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response

        qs = UserRecentStudies.objects.filter(owner=request.user).select_related(*_SELECT_RELATED)
        paginator = self.pagination_class()
        page = await paginator.paginate_queryset(qs, request, view=self)
        if page is None:
            return paginator.custom_error
        return await paginator.get_paginated_response(page)

    @extend_schema(
        summary="Retrieve one recent study",
        description="Full detail: per populated projection slot, the SOP Instance UID "
                    "(to fetch the raw DICOM bytes from the existing /api/dcm/{sop}/file/ "
                    "endpoint) and the current (possibly manually edited) polygons. "
                    "Bumps last_accessed, same as opening a session did locally before.",
        responses={
            200: UserRecentStudies_RETRIEVE_Response_OK,
            401: UnauthorizedResponse,
            404: UserRecentStudies_NotFound_Response,
        },
    )
    async def retrieve(self, request: Request, pk=None) -> Response:
        try:
            row = await UserRecentStudies.objects.select_related(*_SELECT_RELATED).aget(pk=pk, owner=request.user)
        except UserRecentStudies.DoesNotExist:
            return UserRecentStudies_NotFound_Response.from_pk(pk).drf_response

        return await self._item_response(row)

    @extend_schema(
        summary="Retrieve the requesting user's most-recently-accessed study",
        description="Full detail of whichever UserRecentStudies row this user touched most "
                    "recently, or 404 if they have none yet. Lets the frontend resume "
                    "'wherever I left off' on load without persisting any id client-side -- "
                    "ownership (owner=request.user) is what identifies 'my' session, not a "
                    "locally-stored id.",
        responses={
            200: UserRecentStudies_RETRIEVE_Response_OK,
            401: UnauthorizedResponse,
            404: UserRecentStudies_NoneExist_Response,
        },
    )
    @action(detail=False, methods=["get"], url_path="latest", url_name="latest")
    async def latest(self, request: Request) -> Response:
        row = await UserRecentStudies.objects.filter(owner=request.user).select_related(
            *_SELECT_RELATED
        ).order_by('-last_accessed').afirst()
        if row is None:
            return UserRecentStudies_NoneExist_Response().drf_response

        return await self._item_response(row)

    @extend_schema(
        summary="Delete one recent study",
        description="Deletes only this UserRecentStudies row. The underlying Patient/Study/"
                    "Series/DicomImage/DicomFile rows are shared infra and are never touched.",
        request=None,
        responses={200: OkResponse, 401: UnauthorizedResponse, 404: UserRecentStudies_NotFound_Response},
    )
    async def destroy(self, request: Request, pk=None) -> Response:
        deleted, _ = await UserRecentStudies.objects.filter(pk=pk, owner=request.user).adelete()
        if not deleted:
            return UserRecentStudies_NotFound_Response.from_pk(pk).drf_response
        return OkResponse().drf_response

    @extend_schema(
        summary="Attach a DICOM image and/or update polygons/segments for one projection slot",
        description="slug is 'side' or 'frontal'. sop_instance_uid attaches an "
                    "already-parsed DicomImage (via the existing /api/dcm/parse/ endpoint) "
                    "to this slot; polygons replaces the slot's current (possibly manually "
                    "edited) Polygon[]; segments replaces the slot's current SegmentDefinition[]. "
                    "Any subset may be supplied. Bumps last_accessed.",
        request=UserRecentStudies_Projection_PATCH_Schema,
        responses={200: OkResponse, 400: BadRequestResponse, 401: UnauthorizedResponse, 404: UserRecentStudies_NotFound_Response},
    )
    @action(
        detail=True, methods=["patch"],
        url_path=rf"projections/(?P<slug>{SIDE_PROJECTION_SLUG}|{FRONTAL_PROJECTION_SLUG})", url_name="projection",
    )
    async def projection(self, request: Request, pk=None, slug=None) -> Response:
        try:
            patch_data = UserRecentStudies_Projection_PATCH_Schema(**request.data)
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response

        try:
            row = await UserRecentStudies.objects.select_related('study').aget(pk=pk, owner=request.user)
        except UserRecentStudies.DoesNotExist:
            return UserRecentStudies_NotFound_Response.from_pk(pk).drf_response

        polygons_field = _POLYGONS_FIELDS.get(slug)
        if polygons_field is None:
            return BadRequestResponse.single(field="slug", message=f"Unknown projection slug '{slug}'.").drf_response
        segments_field = _SEGMENTS_FIELDS[slug]

        if patch_data.sop_instance_uid is not None:
            try:
                image = await DicomImage.objects.select_related('series__study').aget(
                    pk=patch_data.sop_instance_uid
                )
            except DicomImage.DoesNotExist:
                return BadRequestResponse.single(
                    field="sop_instance_uid",
                    message=f"DicomImage {patch_data.sop_instance_uid} does not exist.",
                ).drf_response

            other_slug = FRONTAL_PROJECTION_SLUG if slug == SIDE_PROJECTION_SLUG else SIDE_PROJECTION_SLUG
            other_images = await resolve_session_images(row.study)
            other_sop_uid = (
                other_images.frontal_sop_instance_uid if slug == SIDE_PROJECTION_SLUG
                else other_images.side_sop_instance_uid
            )
            if other_sop_uid is not None:
                other_series_id = await DicomImage.objects.filter(
                    pk=other_sop_uid
                ).values_list('series_id', flat=True).afirst()
                if other_series_id is not None and other_series_id != image.series_id:
                    return BadRequestResponse.single(
                        field="sop_instance_uid",
                        message=(
                            f"The {slug} image must belong to the same DICOM Series as "
                            f"the already-attached {other_slug} image."
                        ),
                    ).drf_response

            row.study = image.series.study

        if patch_data.polygons is not None:
            setattr(row, polygons_field, patch_data.polygons)

        if patch_data.segments is not None:
            setattr(row, segments_field, patch_data.segments)

        await row.asave()
        return OkResponse().drf_response

    @extend_schema(
        summary="Delete all of the requesting user's recent studies",
        description="Bulk equivalent of the 'delete all' affordance in the recent-studies "
                    "list UI. Only deletes rows owned by the requester.",
        request=None,
        responses={200: OkResponse, 401: UnauthorizedResponse},
    )
    @action(detail=False, methods=["delete"], url_path="clear-all", url_name="clear-all")
    async def clear_all(self, request: Request) -> Response:
        await UserRecentStudies.objects.filter(owner=request.user).adelete()
        return OkResponse().drf_response
