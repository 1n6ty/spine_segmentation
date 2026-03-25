from common.schema.v1 import ApiResponse, Issue
from common.viewsets.v1 import StdViewSet

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request

from django.contrib.auth import authenticate, login, logout
from django.conf import settings

from Core.v1.schemas.auth import Login_POST_schema

from pydantic import ValidationError
from asgiref.sync import sync_to_async
from drf_spectacular.utils import extend_schema

class AuthViewSet(StdViewSet):

    @extend_schema(
        summary="User Login",
        description="Authenticates a user via username/password in the request body or via a service token in the Authorization header.",
        request=Login_POST_schema,
        responses={
            200: ApiResponse,
            400: ApiResponse,
            401: ApiResponse,
        },
    )
    @action(detail=False, methods=["post"], url_path="login", url_name="login")
    async def login(self, request: Request) -> Response:
        response: ApiResponse = ApiResponse()
        try:
            login_data = Login_POST_schema(**request.data, token=request.headers.get("Authorization"))
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

        user = await sync_to_async(authenticate)(request, username=login_data.username, password=login_data.password)

        if user is None:
            return ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=401,
                    message="Invalid credentials."
                )
            ).set_status(
                status="error",
                code=401
            ).drf_response

        await sync_to_async(login)(request, user)

        if login_data.remember_me == "true":
            request.session.set_expiry(settings.API_MANIFEST["session"]["extended_expiration_time"])

        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="User Logout",
        description="Logs out the current user and clears the session.",
        request=None,
        responses={200: ApiResponse},
    )
    @action(detail=False, methods=["post"], url_path="logout", url_name="logout")
    async def logout(self, request: Request) -> Response:

        await sync_to_async(logout)(request)

        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response