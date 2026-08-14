from typing import List, Literal, Optional, TYPE_CHECKING

from drf_spectacular.utils import extend_schema_serializer
from pydantic import BaseModel, Field

from common.schemas.v1.response import OkResponse
from common.schemas.v1.pagination import Pagination_Meta_Schema

if TYPE_CHECKING:
    from FileManager.models import FileRole


class FileRole_GET_Schema(BaseModel):
    page: Optional[int] = Field(None, examples=[1])
    page_size: Optional[int] = Field(None, examples=[10])
    slug: Optional[str] = Field(None, examples=["PREVIEW"])


class FileRole_Item_Schema(BaseModel):
    slug: str = Field(description="Machine-readable file role identifier.", examples=["PREVIEW"])
    name: Optional[str] = Field(None, description="Translated display name.", examples=["Preview"])
    allowed_content_types: List[str] = Field(default_factory=list, description="MIME types this role accepts, empty means no restriction.", examples=[["image/png", "image/jpeg"]])
    allowed_extensions: List[str] = Field(default_factory=list, description="File extensions this role accepts, empty means no restriction.", examples=[[".png", ".jpg"]])
    max_count_per_entity: Optional[int] = Field(None, description="Maximum number of files with this role per entity, or null for unlimited.", examples=[5])

    @classmethod
    def from_model(cls, role: "FileRole") -> "FileRole_Item_Schema":
        """Single source of truth for both the documented shape (this class) and the
        actual response dict -- replaces a separate serialize_file_role() function.
        Field-by-field (not model_validate(from_attributes=True)) because `name` needs
        safe_translation_getter (parler), not a plain attribute read, and max_count_per_entity
        renames the model's max_count."""
        return cls(
            slug=role.slug,
            name=role.safe_translation_getter('name', any_language=True),
            allowed_content_types=role.allowed_content_types,
            allowed_extensions=role.allowed_extensions,
            max_count_per_entity=role.max_count,
        )


class FileRole_LIST_Data_Schema(BaseModel):
    meta: Pagination_Meta_Schema
    roles: List[FileRole_Item_Schema] = Field(description="Every file role.")


@extend_schema_serializer(many=False)
class FileRole_LIST_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: FileRole_LIST_Data_Schema
