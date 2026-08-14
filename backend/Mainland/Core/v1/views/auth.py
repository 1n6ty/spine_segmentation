from common.schemas.v1.response import ApiResponse, Issue
from common.schemas.v1.errors import BadRequestResponse, UnauthorizedResponse
from common.mixins.v1.viewset import StdViewSetMixin
from common.utils.user import aget_current_user

from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.request import Request

from django.contrib.auth import authenticate, login, logout
from django.conf import settings

from Core.v1.schemas.auth import (
    Login_Request,
    Login_Response_OK,
    Login_InvalidCredentials_Response,
    Logout_Response_OK,
    Me_Response_OK,
)

from pydantic import ValidationError
from asgiref.sync import sync_to_async

from drf_spectacular.utils import extend_schema

@extend_schema(tags=['Auth Management'])
class AuthViewSet(StdViewSetMixin):

    def get_permissions(self):
        if self.action == 'me':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        summary="User Login",
        description="Authenticates a user via email and password in the request body.",
        request=Login_Request,
        responses={
            200: Login_Response_OK,
            400: BadRequestResponse,
            401: Login_InvalidCredentials_Response,
        },
    )
    @action(detail=False, methods=["post"], url_path="login", url_name="login")
    async def login(self, request: Request) -> Response:
        response: ApiResponse = ApiResponse()
        try:
            login_data = Login_Request(**request.data)
        except ValidationError as e:
            for err in e.errors():
                response.add_issue(
                    Issue(
                        status="error",
                        code=400,
                        message=err['msg'],
                        field=str(err['loc'][-1]) if err['loc'] else None
                    )
                )
            return response.set_status(
                status="error",
                code=400
            ).drf_response

        user = await sync_to_async(authenticate)(request, email=login_data.email, password=login_data.password)

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

        if login_data.remember_me:
            request.session.set_expiry(settings.API_MANIFEST["session"]["extended_expiration_time"])

        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="User Logout",
        description="Logs out the current user and clears the session.",
        request=None,
        responses={
            200: Logout_Response_OK
        },
    )
    @action(detail=False, methods=["post"], url_path="logout", url_name="logout")
    async def logout(self, request: Request) -> Response:

        await sync_to_async(logout)(request)

        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="Get the current authenticated user",
        description="Returns the currently authenticated user's id/name/email plus role and permissions.",
        request=None,
        responses={
            200: Me_Response_OK,
            401: UnauthorizedResponse,
        },
    )
    @action(detail=False, methods=["get"], url_path="me", url_name="me")
    async def me(self, request: Request) -> Response:
        return ApiResponse().update_data(
            (await aget_current_user(request)).model_dump()
        ).set_status(
            status="ok",
            code=200
        ).drf_response
