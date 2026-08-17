from typing import List, Literal, Optional

from drf_spectacular.utils import extend_schema_serializer
from pydantic import BaseModel, Field

from common.schemas.v1.domain.company import Company_Item_Schema
from common.schemas.v1.errors import NotFoundResponse, _NotFoundIssue
from common.schemas.v1.pagination import Pagination_Meta_Schema
from common.schemas.v1.response import OkResponse


class Company_GET_Schema(BaseModel):
    page: Optional[int] = None
    page_size: Optional[int] = None
    slug: Optional[str] = Field(None, examples=["acme-corp"])


class _CompanyNotFoundIssue(_NotFoundIssue):
    field: str = Field('company_id', description="Always 'company_id' for this issue.", examples=['company_id'])
    message: str = Field(
        "Company 123 does not exist.",
        description="Fixed not-found message for this resource.",
        examples=["Company 123 does not exist."],
    )


class Company_NotFound_Response(NotFoundResponse):
    """Doubles as the actual runtime response builder -- call
    .from_pk(company_id).drf_response at the call site."""
    details: List[_CompanyNotFoundIssue] = Field(
        default_factory=lambda: [_CompanyNotFoundIssue()],
        description="The single company-not-found issue.",
    )

    @classmethod
    def from_pk(cls, company_id) -> "Company_NotFound_Response":
        return cls(details=[_CompanyNotFoundIssue(message=f"Company {company_id} does not exist.")])


class Company_LIST_Data_Schema(BaseModel):
    meta: Pagination_Meta_Schema
    companies: List[Company_Item_Schema] = Field(description="Companies for this page.")


@extend_schema_serializer(many=False)
class Company_LIST_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: Company_LIST_Data_Schema


@extend_schema_serializer(many=False)
class Company_RETRIEVE_Response_OK(OkResponse):
    """Doubles as the actual runtime response builder -- call
    .from_model(company).drf_response at the call site."""
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: Company_Item_Schema

    @classmethod
    def from_model(cls, company) -> "Company_RETRIEVE_Response_OK":
        return cls(data=Company_Item_Schema.from_model(company))
