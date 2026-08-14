from __future__ import annotations

from rest_framework.response import Response
from django.conf import settings
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, Self, Any, List, Dict
from datetime import datetime

class Issue(BaseModel):
    status: Literal["info", "warning", "error"] = Field(
        "info", description="Severity of this issue.", examples=["error"],
    )
    code: int = Field(200, description="HTTP status code this issue corresponds to.", examples=[400])
    message: str = Field(..., max_length=256, description="Human-readable issue description.", examples=["This field is required."])
    field: Optional[str] = Field(None, max_length=256, description="Name of the request field this issue applies to, if any.", examples=["email"])
    hint: Optional[str] = Field(None, max_length=256, description="Optional suggestion for resolving the issue.", examples=["Check the field format."])

    @field_validator("code")
    def validate_http_code(cls, value):
        if not (100 <= value <= 599):
            raise ValueError("HTTP status code must be between 100 and 599")
        return value

    @model_validator(mode="after")
    def validate_status_logic(self):
        if self.status == "error" and self.code < 400:
            raise ValueError("Error status requires HTTP code >= 400")
        return self


class ApiResponse(BaseModel):
    version: str = Field("v1.0", description="API response envelope version.", examples=["v1.0"])
    status: Literal["ok", "error"] = Field("ok", description="Overall outcome of the request.", examples=["ok"])
    code: int = Field(200, description="HTTP status code of the response.", examples=[200])
    message: Optional[str] = Field(None, max_length=256, description="Optional human-readable summary message.", examples=["Request completed successfully."])
    data: Optional[Dict[str, Any]] = Field(None, description="Endpoint-specific response payload.")

    details: Optional[List[Issue]] = Field(None, description="Per-field or general issues, present on validation errors.")

    timestamp: str = Field(
        default_factory=lambda: datetime.now().strftime(settings.DATETIME_FORMAT),
        description="Server time the response was generated.",
        examples=["26.06.2026T14:30"],
    )

    @field_validator("code")
    def validate_http_code(cls, value):
        if not (100 <= value <= 599):
            raise ValueError("HTTP status code must be between 100 and 599")
        return value

    @model_validator(mode="after")
    def validate_status_logic(self):
        if self.status == "error" and self.code < 400:
            raise ValueError("Error status requires HTTP code >= 400")
        return self

    def set_status(self: Self, status: Literal["ok", "error"], code: int = 200) -> Self:
        self.code = self.validate_http_code(code)
        if status == "error" and code < 400:
            raise ValueError("Error status requires HTTP code >= 400")
        self.status = status
        return self

    def merge(self, obj: ApiResponse) -> Self:
        """Merges another ApiResponse object's data and flattened issues."""
        if obj.data is not None:
            if self.data is None:
                self.data = obj.data.copy()
            else:
                self.data.update(obj.data)

        if obj.details:
            if self.details is None:
                self.details = obj.details.copy()
            else:
                self.details.extend(obj.details)

        if obj.status == "error":
            self.status = "error"
            if obj.message and obj.code >= self.code:
                self.message = obj.message
            self.code = max(self.code, obj.code)

        return self

    def set_message(self: Self, message: str) -> Self:
        self.message = message
        return self

    def update_data(self: Self, d: dict[str, Any]) -> Self:
        if self.data is None:
            self.data = dict()
        self.data.update(d)
        return self

    def add_issue(self: Self, issue: Issue) -> Self:
        """Appends an issue directly to the flat array list."""
        if self.details is None:
            self.details = []

        self.details.append(issue)
        return self

    @property
    def drf_response(self: Self) -> Response:
        return Response(
            data=self.model_dump(exclude={"code"}, exclude_none=True),
            status=self.code
        )

    @property
    def dict_response(self: Self) -> dict[str, Any]:
        return self.model_dump(exclude={"code"}, exclude_none=True)


class OkResponse(ApiResponse):
    status: Literal["ok"] = Field("ok", description="Overall outcome of the request.", examples=["ok"])