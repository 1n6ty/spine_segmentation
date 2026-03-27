from common.schema.v1 import ApiResponse, Issue
from common.viewsets.v1 import StdViewSet

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import serializers

from pydantic import ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer

from Dicom.v1.schemas.dcmparse import Parse_POST_schema, Info_GET_schema
from Dicom.utils.parse import parse_and_store_dicom
from Dicom.models import Patient, Study, Series, DicomImage

class DcmViewSet(StdViewSet):

    @extend_schema(
        summary="Method to parse a dicom file",
        description="Creates or updates specific tables with info from dicom file. It also triggers computing of reference points.",
        request={
            "multipart/form-data": inline_serializer(
                name="DCMParseRequest",
                fields={
                    "file": serializers.FileField(required=True)
                }
            )
        },
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

        await parse_and_store_dicom(parse_data.file)

        return response.set_status(
            status="ok",
            code=200
        ).drf_response
