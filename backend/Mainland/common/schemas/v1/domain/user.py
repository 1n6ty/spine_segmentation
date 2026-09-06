from typing import List, Optional, TYPE_CHECKING, Union

from pydantic import BaseModel, Field

from common.schemas.v1.domain.company import Company_Item_Schema, Company_Ref_Schema
from common.schemas.v1.domain.role import Role_Item_Schema, Role_Ref_Schema
from common.utils.company import get_user_company, get_user_roles
from common.utils.extend import extend_field_description

if TYPE_CHECKING:
    from django.contrib.auth.models import User


class User_Ref_Schema(BaseModel):
    id: int = Field(description="User's primary key.", examples=[3])
    first_name: str = Field(description="Given name.", examples=["Alex"])
    last_name: str = Field(description="Family name.", examples=["Lee"])
    patronymic: str = Field('', description="Patronymic/middle name, if set on the user's Profile.", examples=[""])
    email: str = Field(description="User's email address (also the login username).", examples=["alex@example.com"])
    is_active: bool = Field(description="Whether the account can currently authenticate.", examples=[True])

    @classmethod
    def from_model(cls, user: "User", profile=None) -> "User_Ref_Schema":
        if profile is None:
            profile = getattr(user, 'profile', None)
        return cls(
            id=user.pk,
            first_name=user.first_name,
            last_name=user.last_name,
            patronymic=profile.patronymic if profile else '',
            email=user.email,
            is_active=user.is_active,
        )


class User_Item_Schema(User_Ref_Schema):
    phone: Optional[str] = Field(None, description="Contact phone number, from the user's Profile.", examples=["+79991234567"])
    company: Optional[Union[Company_Ref_Schema, Company_Item_Schema]] = Field(
        None, description=extend_field_description('company'),
    )
    roles: List[Union[Role_Ref_Schema, Role_Item_Schema]] = Field(
        default_factory=list, description=extend_field_description('roles'),
    )
    permissions: List[str] = Field(
        default_factory=list,
        description="Effective Django permission codenames (user + group-inherited). Only populated on /profiles/me.",
        examples=[["Order.add_order", "Product.view_product"]],
    )

    @classmethod
    def from_model(
        cls, user: "User", profile=None, *, permissions: Optional[List[str]] = None,
        extend: frozenset = frozenset(),
    ) -> "User_Item_Schema":
        if profile is None:
            profile = getattr(user, 'profile', None)
        company = get_user_company(user)
        roles = get_user_roles(user)
        company_schema = Company_Item_Schema if 'company' in extend else Company_Ref_Schema
        role_schema = Role_Item_Schema if 'roles' in extend else Role_Ref_Schema
        ref = User_Ref_Schema.from_model(user, profile=profile)
        return cls(
            **ref.model_dump(),
            phone=str(profile.phone) if profile and profile.phone else None,
            company=company_schema.from_model(company) if company is not None else None,
            roles=[role_schema.from_model(role) for role in roles] if roles is not None else [],
            permissions=permissions if permissions is not None else [],
        )
