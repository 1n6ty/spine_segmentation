from asgiref.sync import sync_to_async
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction

from common.mixins.v1.viewset import StdViewSetMixin
from common.permissions.base import HasPermCodename
from common.permissions.company import ManagedCompanyPermission
from common.utils.company import scope_queryset_to_managed_companies
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
            return [HasPermCodename('Profile.view_profile')]
        elif self.action == "destroy":
            return [HasPermCodename('Profile.delete_profile'), ManagedCompanyPermission()]
        elif self.action == "partial_update":
            return [CanChangeProfilePermission()]
        return [AllowAny()]

    @extend_schema(
        summary="List all users",
        description="Returns every User whose company is in the caller's "
                    "Profile.managed_companies, with full profile detail "
                    "(phone, company, roles). Requires Profile.view_profile. "
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
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response
        extend = query.extend_set()

        qs = User.objects.select_related(
            'profile', 'profile__company'
        ).prefetch_related(
            'profile__company__translations', 'profile__roles', 'profile__roles__translations'
        ).order_by('email')
        qs = await sync_to_async(scope_queryset_to_managed_companies)(
            request.user, qs, company_field='profile__company'
        )

        try:
            filtered_qs = await sync_to_async(
                lambda: ProfileFilterSet(request.query_params, queryset=qs, request=request).qs.distinct()
            )()
        except PermissionError as e:
            return PermissionDeniedResponse.single(field="company_slug", message=str(e)).drf_response
        except Company.DoesNotExist:
            return BadRequestResponse.single(
                field="company_slug",
                message=f"Company '{request.query_params.get('company_slug')}' does not exist.",
            ).drf_response

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
            400: BadRequestResponse,
            401: UnauthorizedResponse,
        },
    )
    @action(detail=False, methods=["get"], url_path="me", url_name="me")
    async def get_me(self, request: Request) -> Response:
        try:
            query = Profile_DETAIL_GET_Schema(**request.query_params.dict())
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response
        extend = query.extend_set()

        return Profiles_GET_GetMe_Response(data=await aget_current_user(request, extend=extend)).drf_response

    @extend_schema(
        summary="Deactivate a company user",
        description="Requires Profile.delete_profile, and the target profile's company "
                    "to be in the caller's Profile.managed_companies. Deactivates the "
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
            return Profile_DESTROY_NotFound_Response.from_pk(user_id).drf_response

        await sync_to_async(self.check_object_permissions)(request, profile)

        profile.user.is_active = False
        await profile.user.asave(update_fields=['is_active'])

        return Response(status=204)

    @extend_schema(
        summary="Edit a user's name/email/password/roles/company",
        description="Self-edit: any authenticated user may PATCH their own user_id to "
                    "change first_name, last_name, patronymic, email, password -- always "
                    "allowed, no permission needed. Editing another profile's basic fields "
                    "requires Profile.change_profile. Changing role_slugs (on any profile, "
                    "including your own -- no self-promotion) requires "
                    "Profile.change_profile_role, and every requested slug must be in the "
                    "caller's own roles' assignable set. Changing company_slug requires "
                    "Profile.change_profile_company, and the new company must be in the "
                    "caller's own managed_companies. Resetting someone else's password "
                    "requires Profile.reset_profile_password. Resubmitting a profile's "
                    "current role_slugs/company_slug unchanged does not require any "
                    "permission. role_slugs is a full-replacement set (Profile.roles is "
                    "M2M -- a profile may hold several at once). is_active is out of scope "
                    "here -- see destroy.",
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
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response
        extend = query.extend_set()

        try:
            profile = await Profile.objects.select_related('user', 'company').aget(user_id=user_id)
        except Profile.DoesNotExist:
            return Profile_DESTROY_NotFound_Response.from_pk(user_id).drf_response

        try:
            payload = Profile_PATCH_Request(**request.data)
        except ValidationError as e:
            return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response

        is_self = profile.user_id == request.user.pk

        def _current_role_slugs():
            return set(profile.roles.values_list('slug', flat=True))

        current_role_slugs = await sync_to_async(_current_role_slugs)()
        role_slugs_changing = payload.role_slugs is not None and set(payload.role_slugs) != current_role_slugs
        company_slug_changing = payload.company_slug is not None and payload.company_slug != profile.company.slug
        resetting_other_password = payload.password is not None and not is_self
        editing_other_basic_fields = not is_self and any(
            v is not None for v in (payload.first_name, payload.last_name, payload.patronymic, payload.email)
        )

        if role_slugs_changing:
            if not await sync_to_async(request.user.has_perm)('Profile.change_profile_role'):
                return PermissionDeniedResponse.single(
                    field="role_slugs",
                    message="Changing roles requires the change_profile_role permission.",
                ).drf_response

            def _assignable_slugs():
                actor_profile = getattr(request.user, 'profile', None)
                if actor_profile is None:
                    return set()
                assignable_ids = set()
                for role in actor_profile.roles.all():
                    assignable_ids.update(role.assignable.values_list('pk', flat=True))
                return set(Role.objects.filter(pk__in=assignable_ids).values_list('slug', flat=True))

            assignable_slugs = await sync_to_async(_assignable_slugs)()
            disallowed = set(payload.role_slugs) - assignable_slugs
            if disallowed:
                return PermissionDeniedResponse.single(
                    field="role_slugs",
                    message=f"You may not assign role(s): {', '.join(sorted(disallowed))}.",
                ).drf_response

        if company_slug_changing:
            if not await sync_to_async(request.user.has_perm)('Profile.change_profile_company'):
                return PermissionDeniedResponse.single(
                    field="company_slug",
                    message="Changing company requires the change_profile_company permission.",
                ).drf_response
            in_scope = await sync_to_async(
                lambda: request.user.profile.managed_companies.filter(slug=payload.company_slug).exists()
                if getattr(request.user, 'profile', None) is not None else False
            )()
            if not in_scope:
                return PermissionDeniedResponse.single(
                    field="company_slug",
                    message="You may only reassign a profile to a company within your own managed_companies.",
                ).drf_response

        if resetting_other_password and not await sync_to_async(request.user.has_perm)('Profile.reset_profile_password'):
            return PermissionDeniedResponse.single(
                field="password",
                message="Resetting another profile's password requires the reset_profile_password permission.",
            ).drf_response

        if editing_other_basic_fields and not await sync_to_async(request.user.has_perm)('Profile.change_profile'):
            return PermissionDeniedResponse.single(message="You may only edit your own profile.").drf_response

        if payload.email is not None:
            if await User.objects.filter(email__iexact=payload.email).exclude(pk=profile.user_id).aexists():
                return BadRequestResponse.single(field="email", message="A user with this email already exists.").drf_response

        new_roles = None
        if payload.role_slugs is not None:
            new_roles = [r async for r in Role.objects.select_related('group').filter(slug__in=payload.role_slugs)]
            missing = set(payload.role_slugs) - {r.slug for r in new_roles}
            if missing:
                return BadRequestResponse.single(
                    field="role_slugs", message=f"Role(s) do not exist: {', '.join(sorted(missing))}.",
                ).drf_response

        new_company = None
        if payload.company_slug is not None:
            try:
                new_company = await Company.objects.aget(slug=payload.company_slug)
            except Company.DoesNotExist:
                return BadRequestResponse.single(
                    field="company_slug", message=f"Company '{payload.company_slug}' does not exist.",
                ).drf_response

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
                if new_roles is not None:
                    profile.roles.set(new_roles)
                    user.groups.set([r.group for r in new_roles])
                if new_company is not None:
                    profile.company = new_company
                profile.save()
                return user

        try:
            user = await sync_to_async(_update)()
        except IntegrityError:
            return BadRequestResponse.single(field="email", message="A user with this email already exists.").drf_response

        if password_changed and profile.user_id == request.user.pk:
            await sync_to_async(update_session_auth_hash)(request, user)

        user = await User.objects.select_related(
            'profile', 'profile__company'
        ).prefetch_related(
            'profile__company__translations', 'profile__roles', 'profile__roles__translations'
        ).aget(pk=user.pk)

        return Profiles_PATCH_Response_OK.from_model(user, extend=extend).drf_response
