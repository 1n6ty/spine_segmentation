from asgiref.sync import sync_to_async
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction

from common.schemas.v1.response import ApiResponse, Issue
from common.mixins.v1.viewset import StdViewSetMixin
from common.permissions.base import HasPermCodename
from common.schemas.v1.domain.user import User_Item_Schema
from common.utils.user import aget_current_user

from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated

from common.schemas.v1.errors import BadRequestResponse, PermissionDeniedResponse, UnauthorizedResponse

from pydantic import ValidationError

from Company.models import Company
from Profile.v1.utils.constants import USER_ID_URL_KWARG, USER_ID_URL_REGEX
from Profile.models import Profile, Role
from Profile.permissions import CanChangeProfilePermission
from Profile.v1.filters.profiles import ProfileFilterSet
from Profile.v1.paginations.profiles import Profiles_Pagination
from Profile.v1.schemas.docs.profiles import Profile_DETAIL_Parameters, Profiles_LIST_Parameters
from Profile.v1.schemas.profiles import (
    Profile_DESTROY_NotFound_Response,
    Profile_DETAIL_GET_Schema,
    Profile_PATCH_Request,
    Profiles_GET_GetMe_Response,
    Profiles_GET_Schema,
    Profiles_LIST_Response_OK,
    Profiles_PATCH_Response_OK,
)

from drf_spectacular.utils import extend_schema
from common.schemas.v1.openapi_params import extend_examples

@extend_schema(tags=['Profile Management'])
class ProfilesViewSet(StdViewSetMixin):

    lookup_field = 'user_id'
    lookup_url_kwarg = USER_ID_URL_KWARG
    lookup_value_regex = USER_ID_URL_REGEX
    pagination_class = Profiles_Pagination

    def get_permissions(self):
        if self.action == "get_me":
            return [IsAuthenticated()]
        elif self.action == "list":
            return [HasPermCodename('Profile.view_profile_any_company')]
        elif self.action == "destroy":
            return [HasPermCodename('Profile.delete_profile_any_company')]
        elif self.action == "partial_update":
            return [CanChangeProfilePermission()]
        return [AllowAny()]

    @extend_schema(
        summary="List all users",
        description="Returns every User in the system with full profile detail "
                    "(phone, company, role). Requires Profile.view_profile_any_company. "
                    "Filterable by company_slug, role_slug, is_active, q "
                    "(Elasticsearch-backed, across email/first_name/last_name/patronymic).",
        parameters=Profiles_LIST_Parameters,
        examples=extend_examples(Profiles_LIST_Response_OK),
        responses={
            200: Profiles_LIST_Response_OK,
            400: BadRequestResponse,
            401: UnauthorizedResponse,
            403: PermissionDeniedResponse,
        },
    )
    async def list(self, request: Request) -> Response:
        try:
            query = Profiles_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            response = ApiResponse()
            for err in e.errors():
                response.add_issue(Issue(
                    status="error", code=400,
                    field=".".join(map(str, err["loc"])),
                    message=err["msg"],
                ))
            return response.set_status(status="error", code=400).drf_response
        extend = query.extend_set()

        qs = User.objects.select_related(
            'profile', 'profile__company', 'profile__role'
        ).prefetch_related(
            'profile__company__translations', 'profile__role__translations'
        ).order_by('email')

        try:
            filtered_qs = await sync_to_async(
                lambda: ProfileFilterSet(request.query_params, queryset=qs, request=request).qs
            )()
        except PermissionError as e:
            return ApiResponse().add_issue(
                Issue(status="error", code=403, field="company_slug", message=str(e))
            ).set_status(status="error", code=403).drf_response
        except Company.DoesNotExist:
            return ApiResponse().add_issue(
                Issue(status="error", code=400, field="company_slug",
                      message=f"Company '{request.query_params.get('company_slug')}' does not exist.")
            ).set_status(status="error", code=400).drf_response

        paginator = self.pagination_class()
        paginator.extend = extend
        page = await paginator.paginate_queryset(filtered_qs, request, view=self)
        if page is None:
            return paginator.custom_error
        return await paginator.get_paginated_response(page)

    @extend_schema(
        summary="Get current user's profile.",
        description="Get current authenticated user's profile.",
        request=None,
        parameters=Profile_DETAIL_Parameters,
        examples=extend_examples(Profiles_GET_GetMe_Response),
        responses={
            200: Profiles_GET_GetMe_Response,
            401: UnauthorizedResponse,
        },
    )
    @action(detail=False, methods=["get"], url_path="me", url_name="me")
    async def get_me(self, request: Request) -> Response:
        try:
            query = Profile_DETAIL_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            response = ApiResponse()
            for err in e.errors():
                response.add_issue(Issue(
                    status="error", code=400,
                    field=".".join(map(str, err["loc"])),
                    message=err["msg"],
                ))
            return response.set_status(status="error", code=400).drf_response
        extend = query.extend_set()

        return ApiResponse().update_data(
            (await aget_current_user(request, extend=extend)).model_dump()
        ).set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="Deactivate a company user",
        description="Requires Profile.delete_profile_any_company. Deactivates the "
                    "account (is_active=False); the row is kept.",
        request=None,
        responses={
            204: None,
            401: UnauthorizedResponse,
            403: PermissionDeniedResponse,
            404: Profile_DESTROY_NotFound_Response,
        },
    )
    async def destroy(self, request: Request, user_id=None) -> Response:
        try:
            profile = await Profile.objects.select_related('user').aget(user_id=user_id)
        except Profile.DoesNotExist:
            return ApiResponse().add_issue(
                Issue(status="error", code=404, field="user_id", message=f"No company user with id {user_id} exists.")
            ).set_status(status="error", code=404).drf_response

        profile.user.is_active = False
        await profile.user.asave(update_fields=['is_active'])

        return Response(status=204)

    @extend_schema(
        summary="Edit a user's name/email/password/role/company",
        description="Self-edit: any authenticated user may PATCH their own user_id to "
                    "change first_name, last_name, patronymic, email, password. Editing "
                    "someone else's profile, or actually changing role_slug/company_slug "
                    "to a different value on any profile (including your own), requires "
                    "Profile.change_sensitive_profile_data -- resubmitting the profile's "
                    "current role_slug/company_slug unchanged does not require it. "
                    "is_active is out of scope here -- see destroy.",
        request=Profile_PATCH_Request,
        parameters=Profile_DETAIL_Parameters,
        examples=extend_examples(Profiles_PATCH_Response_OK),
        responses={
            200: Profiles_PATCH_Response_OK,
            400: BadRequestResponse,
            401: UnauthorizedResponse,
            403: PermissionDeniedResponse,
            404: Profile_DESTROY_NotFound_Response,
        },
    )
    async def partial_update(self, request: Request, user_id=None) -> Response:
        try:
            query = Profile_DETAIL_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            response = ApiResponse()
            for err in e.errors():
                response.add_issue(Issue(
                    status="error", code=400,
                    field=".".join(map(str, err["loc"])),
                    message=err["msg"],
                ))
            return response.set_status(status="error", code=400).drf_response
        extend = query.extend_set()

        try:
            profile = await Profile.objects.select_related(
                'user', 'company', 'role', 'role__group'
            ).aget(user_id=user_id)
        except Profile.DoesNotExist:
            return ApiResponse().add_issue(
                Issue(status="error", code=404, field="user_id", message=f"No company user with id {user_id} exists.")
            ).set_status(status="error", code=404).drf_response

        try:
            payload = Profile_PATCH_Request(**request.data)
        except ValidationError as e:
            response = ApiResponse()
            for err in e.errors():
                response.add_issue(Issue(
                    status="error", code=400,
                    field=".".join(map(str, err["loc"])),
                    message=err["msg"],
                ))
            return response.set_status(status="error", code=400).drf_response

        has_sensitive_perm = await sync_to_async(request.user.has_perm)('Profile.change_sensitive_profile_data')

        role_slug_changing = payload.role_slug is not None and (profile.role_id is None or payload.role_slug != profile.role.slug)
        company_slug_changing = payload.company_slug is not None and payload.company_slug != profile.company.slug

        if (role_slug_changing or company_slug_changing) and not has_sensitive_perm:
            return ApiResponse().add_issue(
                Issue(status="error", code=403,
                      field="role_slug" if role_slug_changing else "company_slug",
                      message="Changing role or company requires the change_sensitive_profile_data permission.")
            ).set_status(status="error", code=403).drf_response

        if profile.user_id != request.user.pk and not has_sensitive_perm:
            return ApiResponse().add_issue(
                Issue(status="error", code=403, message="You may only edit your own profile.")
            ).set_status(status="error", code=403).drf_response

        if payload.email is not None:
            if await User.objects.filter(email__iexact=payload.email).exclude(pk=profile.user_id).aexists():
                return ApiResponse().add_issue(
                    Issue(status="error", code=400, field="email", message="A user with this email already exists.")
                ).set_status(status="error", code=400).drf_response

        new_role = None
        if payload.role_slug is not None:
            try:
                new_role = await Role.objects.select_related('group').aget(slug=payload.role_slug)
            except Role.DoesNotExist:
                return ApiResponse().add_issue(
                    Issue(status="error", code=400, field="role_slug",
                          message=f"Role '{payload.role_slug}' does not exist.")
                ).set_status(status="error", code=400).drf_response

        new_company = None
        if payload.company_slug is not None:
            try:
                new_company = await Company.objects.aget(slug=payload.company_slug)
            except Company.DoesNotExist:
                return ApiResponse().add_issue(
                    Issue(status="error", code=400, field="company_slug",
                          message=f"Company '{payload.company_slug}' does not exist.")
                ).set_status(status="error", code=400).drf_response

        password_changed = False

        def _update():
            nonlocal password_changed
            with transaction.atomic():
                user = profile.user
                if payload.first_name is not None:
                    user.first_name = payload.first_name
                if payload.last_name is not None:
                    user.last_name = payload.last_name
                if payload.email is not None:
                    user.email = payload.email
                    user.username = payload.email
                if payload.password is not None:
                    user.set_password(payload.password)
                    password_changed = True
                user.save()

                if payload.patronymic is not None:
                    profile.patronymic = payload.patronymic
                if new_role is not None:
                    if profile.role_id and profile.role.group_id:
                        user.groups.remove(profile.role.group)
                    user.groups.add(new_role.group)
                    profile.role = new_role
                if new_company is not None:
                    profile.company = new_company
                profile.save()
                return user

        try:
            user = await sync_to_async(_update)()
        except IntegrityError:
            return ApiResponse().add_issue(
                Issue(status="error", code=400, field="email", message="A user with this email already exists.")
            ).set_status(status="error", code=400).drf_response

        if password_changed and profile.user_id == request.user.pk:
            await sync_to_async(update_session_auth_hash)(request, user)

        user = await User.objects.select_related(
            'profile', 'profile__company', 'profile__role'
        ).prefetch_related(
            'profile__company__translations', 'profile__role__translations'
        ).aget(pk=user.pk)

        return ApiResponse().update_data(
            User_Item_Schema.from_model(user, extend=extend).model_dump()
        ).set_status(status="ok", code=200).drf_response
