from typing import Optional
from pydantic import BaseModel, Field


class Pagination_GET_Schema(BaseModel):
    page: Optional[int] = Field(None, examples=[1])
    page_size: Optional[int] = Field(None, examples=[20])


class Pagination_Meta_Schema(BaseModel):
    total_items: int = Field(description="Total number of items across all pages.", examples=[42])
    total_pages: int = Field(description="Total number of pages.", examples=[3])
    current_page: int = Field(description="1-indexed current page number.", examples=[1])
    page_size: int = Field(description="Items per page for this response.", examples=[20])
    next: Optional[str] = Field(None, description="URL of the next page, or null if this is the last page.", examples=["/api/orders/?page=2"])
    previous: Optional[str] = Field(None, description="URL of the previous page, or null if this is the first page.", examples=["/api/orders/?page=1"])
