from common.schemas.v1.response import OkResponse
from common.schemas.v1.domain.user import User_Item_Schema
from common.schemas.v1.errors import NotFoundResponse, _NotFoundIssue
from common.schemas.v1.pagination import Pagination_Meta_Schema
from common.utils.extend import extendable_fields, parse_extend_param

from Core.v1.schemas.auth import EMAIL_REGEX

from drf_spectacular.utils import extend_schema_serializer
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal, Optional

class Profiles_GET_Schema(BaseModel):
    page: Optional[int] = None
    page_size: Optional[int] = None
    company_slug: Optional[str] = Field(None, examples=["acme-corp"])
    role_slug: Optional[str] = Field(None, examples=["doctor,viewer"])
    is_active: Optional[bool] = None
    q: Optional[str] = Field(None, examples=["jane.doe@example.com"])
    extend: Optional[str] = Field(None, examples=["company,role"])

    @field_validator('extend')
    @classmethod
    def validate_extend(cls, value):
        if value is None:
            return value
        parse_extend_param(value, extendable_fields(User_Item_Schema))
        return value

    def extend_set(self) -> frozenset:
        return parse_extend_param(self.extend, extendable_fields(User_Item_Schema))


class Profile_DETAIL_GET_Schema(BaseModel):
    extend: Optional[str] = Field(None, examples=["company,role"])

    @field_validator('extend')
    @classmethod
    def validate_extend(cls, value):
        if value is None:
            return value
        parse_extend_param(value, extendable_fields(User_Item_Schema))
        return value

    def extend_set(self) -> frozenset:
        return parse_extend_param(self.extend, extendable_fields(User_Item_Schema))


class Profiles_GET_GetMe_Response(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: User_Item_Schema


class _Profile_DESTROY_NotFoundIssue(_NotFoundIssue):
    field: str = Field('user_id', description="Always 'user_id' for this issue.", examples=['user_id'])
    message: str = Field(
        "No company user with this id exists.",
        description="Fixed not-found message for this resource.",
        examples=["No company user with this id exists."],
    )


class Profile_DESTROY_NotFound_Response(NotFoundResponse):
    details: List[_Profile_DESTROY_NotFoundIssue] = Field(
        default_factory=lambda: [_Profile_DESTROY_NotFoundIssue()],
        description="The single user-not-found issue.",
    )


class Profiles_LIST_Data_Schema(BaseModel):
    meta: Pagination_Meta_Schema
    users: List[User_Item_Schema] = Field(description="Users for this page.")


@extend_schema_serializer(many=False)
class Profiles_LIST_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: Profiles_LIST_Data_Schema


class Profile_PATCH_Request(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=150, description="New first name, if changing.", examples=["Jane"])
    last_name: Optional[str] = Field(None, min_length=1, max_length=150, description="New last name, if changing.", examples=["Doe"])
    patronymic: Optional[str] = Field(None, max_length=150, description="New patronymic, if changing.", examples=["Ivanovna"])
    email: Optional[str] = Field(None, max_length=150, description="New email address, if changing.", examples=["jane.doe@example.com"])
    password: Optional[str] = Field(None, min_length=8, description="New password, if changing.", examples=["hunter22"])
    role_slug: Optional[str] = Field(None, description="New role slug, if changing. Requires Profile.change_sensitive_profile_data.", examples=["doctor"])
    company_slug: Optional[str] = Field(None, description="New company slug, if changing. Requires Profile.change_sensitive_profile_data.", examples=["acme"])

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned_value = value.strip()
        if not EMAIL_REGEX.match(cleaned_value):
            raise ValueError("The provided string is not a valid email address format.")
        return cleaned_value


class Profiles_PATCH_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: User_Item_Schema
