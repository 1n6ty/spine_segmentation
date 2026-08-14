from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from Profile.models import Role


class Role_Ref_Schema(BaseModel):
    slug: str = Field(description="Machine-readable role identifier.", examples=["doctor"])
    name: str = Field(description="Translated display name.", examples=["Orderer"])

    @classmethod
    def from_model(cls, role: "Role") -> "Role_Ref_Schema":
        return cls(
            slug=role.slug,
            name=role.safe_translation_getter('name', any_language=True),
        )


class Role_Item_Schema(Role_Ref_Schema):
    id: int = Field(description="Role's primary key.", examples=[2])

    @classmethod
    def from_model(cls, role: "Role") -> "Role_Item_Schema":
        ref = Role_Ref_Schema.from_model(role)
        return cls(**ref.model_dump(), id=role.pk)
