from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from Company.models import Company


class Company_Ref_Schema(BaseModel):
    slug: str = Field(description="Machine-readable company identifier.", examples=["acme-corp"])
    name: str = Field(description="Translated display name.", examples=["Acme Corp"])

    @classmethod
    def from_model(cls, company: "Company") -> "Company_Ref_Schema":
        return cls(
            slug=company.slug,
            name=company.safe_translation_getter('name', any_language=True),
        )


class Company_Item_Schema(Company_Ref_Schema):
    id: int = Field(description="Company's primary key.", examples=[2])
    email: Optional[str] = Field(None, description="Company contact email.", examples=["contact@acme-corp.com"])
    created_at: datetime = Field(description="When the company was created.")

    @classmethod
    def from_model(cls, company: "Company") -> "Company_Item_Schema":
        ref = Company_Ref_Schema.from_model(company)
        return cls(
            **ref.model_dump(),
            id=company.pk,
            email=company.email,
            created_at=company.created_at,
        )
