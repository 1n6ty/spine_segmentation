from common.schemas.v1.response import ApiResponse, Issue
from common.schemas.v1.errors import UnauthorizedResponse
from common.mixins.v1.viewset import StdViewSetMixin

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.permissions import IsAuthenticated

from django.http import HttpResponse, StreamingHttpResponse

import json
from channels.layers import get_channel_layer

from pydantic import ValidationError
from drf_spectacular.utils import extend_schema

from Dicom.v1.schemas.docs.dcmparse import DCMParse_POST_RequestSerializer
from Dicom.v1.schemas.dcmparse import Parse_POST_schema
from Dicom.utils.parse import parse_and_store_dicom
from Dicom.utils.constants import SEGMENTATION_GROUP, SEGMENTATION_STATUS_WIRE
from Dicom.models import Patient, Study, Series, DicomImage, DicomFile
from FileManager.utils import serve_file_response

_TERMINAL_WIRE_STATUSES = {"done", "error"}

def _sse_event(data: dict) -> bytes:
    payload = ApiResponse().update_data(data).dict_response
    return f"data: {json.dumps(payload)}\n\n".encode("utf-8")

async def _segmentation_event_stream(sop_instance_uid: str):
    """Self-hydrates from the persisted DicomImage.segmentation_status on every connect
    (including reconnects), then live-tails the same Channels group the Celery task
    publishes to. A DB write always precedes the matching broadcast (see
    Dicom.tasks.segmentation._advance_status), so a client that (re)connects mid-run
    never sees stale state — the first line here is always ground truth, not a guess
    at whether a broadcast was missed."""
    try:
        image = await DicomImage.objects.select_related('segmentation_status').aget(
            sop_instance_uid=sop_instance_uid
        )
    except DicomImage.DoesNotExist:
        yield _sse_event({"status": "error", "ref_points": None})
        return

    current_slug = image.segmentation_status.slug if image.segmentation_status else None
    if current_slug:
        wire_status = SEGMENTATION_STATUS_WIRE.get(current_slug, current_slug)
        yield _sse_event({
            "status": wire_status,
            "ref_points": image.reference_points if wire_status == "done" else None,
        })
        if wire_status in _TERMINAL_WIRE_STATUSES:
            return

    channel_layer = get_channel_layer()
    channel_name = await channel_layer.new_channel()
    group_name = SEGMENTATION_GROUP.format(sop_instance_uid)
    await channel_layer.group_add(group_name, channel_name)
    try:
        while True:
            event = await channel_layer.receive(channel_name)
            data = event.get("data", {})
            yield _sse_event(data)
            if data.get("status") in _TERMINAL_WIRE_STATUSES:
                break
    finally:
        await channel_layer.group_discard(group_name, channel_name)

class DcmViewSet(StdViewSetMixin):

    # DicomImage's primary key is `sop_instance_uid` (a dotted OID string, e.g.
    # "1.2.840.10008.5.1.4.1.1.7.1.99.887..."), not a plain int/slug -- DRF's
    # router defaults `lookup_value_regex` to `[^/.]+`, which excludes `.` and
    # so silently fails to match any real SOP Instance UID (the URL 404s before
    # `file`/`events` ever runs). `[^/]+` is safe since UIDs never contain `/`.
    lookup_value_regex = r'[^/]+'

    @extend_schema(
        summary="Method to parse a dicom file",
        description="Creates or updates specific tables with info from dicom file. It also triggers computing of reference points.",
        request={"multipart/form-data": DCMParse_POST_RequestSerializer},
        responses={
            200: ApiResponse,
            400: ApiResponse
        },
    )
    @action(detail=False, methods=["post"], url_path="parse", url_name="parse")
    async def parse(self, request: Request) -> Response:
        response: ApiResponse = ApiResponse()
        try:
            parse_data = Parse_POST_schema(**request.data.dict())
        except ValidationError as e:
            for err in e.errors():
                response.add_issue(
                    Issue(
                        status="error",
                        code=400,
                        message=err['msg']
                    )
                )
            return response.set_status(
                status="error",
                code=400
            ).drf_response

        result = await parse_and_store_dicom(parse_data.file, file_role_slug=parse_data.file_role_slug)
        if isinstance(result, Issue):
            return response.add_issue(result).set_status(
                status="error",
                code=result.code
            ).drf_response

        return response.set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="Retrieve a previously uploaded DICOM file",
        description=(
            "Streams the raw DICOM file for a given SOP Instance UID. The file lives in the "
            "private MinIO bucket and is never exposed via a direct or presigned URL — this view "
            "checks authentication, then hands the actual byte-streaming off to nginx via "
            "X-Accel-Redirect to an internal-only location."
        ),
        responses={
            401: UnauthorizedResponse,
            404: ApiResponse,
        },
    )
    @action(detail=True, methods=["get"], url_path="file", url_name="file", permission_classes=[IsAuthenticated])
    async def file(self, request: Request, pk=None) -> Response | HttpResponse:
        try:
            image = await DicomImage.objects.aget(sop_instance_uid=pk)
        except DicomImage.DoesNotExist:
            return ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=404,
                    message="DICOM image not found."
                )
            ).set_status(
                status="error",
                code=404
            ).drf_response

        file_record = await DicomFile.objects.filter(image=image).afirst()
        if file_record is None:
            return ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=404,
                    message="No file stored for this image."
                )
            ).set_status(
                status="error",
                code=404
            ).drf_response

        # serve_file_response builds the same X-Accel-Redirect shape this view used
        # to construct by hand -- must still match Nginx/templates/api.conf.template's
        # actual internal location, `^/internal/private/(?<object_key>.+)$` -- nginx
        # itself prepends the `media-private` bucket name when building the upstream
        # MinIO URL, so it must not also appear in the path Django redirects to here.
        return serve_file_response(file_record)

    @extend_schema(
        summary="Stream segmentation status for a DICOM image",
        description=(
            "Server-Sent Events stream of segmentation progress for a given SOP Instance UID. "
            "On connect (including reconnects), immediately emits the currently persisted status "
            "from the DicomImage row, then live-tails the same Channels group the segmentation "
            "Celery task publishes to until a terminal status (done/error) closes the stream. "
            "Replaces the previous WebSocket-based push — no missed-event or silent-hang failure "
            "modes, since the DB row is always the source of truth, not the broadcast alone."
        ),
        responses={
            401: UnauthorizedResponse,
        },
    )
    @action(detail=True, methods=["get"], url_path="segment/events", url_name="segment-events",
            permission_classes=[IsAuthenticated])
    async def events(self, request: Request, pk=None) -> StreamingHttpResponse:
        response = StreamingHttpResponse(
            _segmentation_event_stream(pk),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
