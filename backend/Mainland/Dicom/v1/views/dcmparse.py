from common.schema.v1 import ApiResponse, Issue
from common.viewsets.v1 import StdViewSet

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request

from django.conf import settings

from pydantic import ValidationError
from asgiref.sync import sync_to_async
from drf_spectacular.utils import extend_schema

from Dicom.v1.schemas.dcmparse import Parse_POST_schema

class DcmViewSet(StdViewSet):

    @extend_schema(
        summary="Method to parse a dicom file",
        description="Creates or updates specific tables with info from dicom file. It also triggers computing of reference points.",
        request=Parse_POST_schema,
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

        

        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response
