from __future__ import annotations

from rest_framework.response import Response

from django.http.response import JsonResponse
from django.conf import settings

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, Self, Any, List, Dict
from datetime import datetime

class Issue(BaseModel):
    status: Literal["info", "warning", "error"] = "info"
    code: int = 200
    message: str = Field(..., max_length=256)
    field: Optional[str] = Field(None, max_length=256)
    hint: Optional[str] = Field(None, max_length=256)

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

class Details(BaseModel):
    issues: List[Issue] = Field(default_factory=list)

class ApiResponse(BaseModel):
    version: str = "v1.0"
    status: Literal["ok", "error"] = "ok"
    code: int = 200
    message: Optional[str] = Field(None, max_length=256)
    data: Optional[Dict[str, Any]] = None
    details: Optional[Details] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime(settings.DATETIME_FORMAT))

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
        """Sets status of the response."""
        self.code = self.validate_http_code(code)
        if status == "error" and code < 400:
            raise ValueError("Error status requires HTTP code >= 400")
        self.status = status
        return self

    def merge(self, obj: ApiResponse) -> Self:
        """Merges `ApiResponse` object with another object's issues and data (error propagation included)."""
        if obj.data is not None:
            if self.data is None:
                self.data = obj.data.copy()
            else:
                self.data.update(obj.data)
        if obj.details is not None and obj.details.issues:
            if self.details is None:
                self.details = Details(issues=obj.details.issues.copy())
            else:
                self.details.issues.extend(obj.details.issues)

        if obj.status == "error":
            self.status = "error"
            if obj.message and obj.code >= self.code:
                self.message = obj.message
            self.code = max(self.code, obj.code)

        return self

    def set_message(self: Self, message: str) -> Self:
        """Sets message in the response."""
        self.message = message
        return self

    def update_data(self: Self, d: dict[str, Any]) -> Self:
        """Updates data in the response."""
        if self.data is None:
            self.data = dict()

        self.data.update(d)
        return self
    
    def add_issue(self: Self, issue: Issue) -> Self:
        """Adds an issue to the response."""
        if self.details is None:
            self.details = Details()
        
        self.details.issues.append(issue)
        return self

    @property
    def drf_response(self: Self) -> Response:
        """Returns `rest_framework.response.Response` object."""
        return Response(
            data=self.model_dump(exclude={"code"}, exclude_none=True),
            status=self.code
        )
    
    @property
    def dict_response(self: Self) -> dict[str, Any]:
        """Returns `dict` object."""
        return self.model_dump(exclude={"code"}, exclude_none=True)

    @property
    def json_response(self: Self) -> JsonResponse:
        """Returns `django.http.response.JsonResponse` object."""
        return JsonResponse(
            data=self.model_dump(exclude={"code"}, exclude_none=True),
            status=self.code
        )
    
class ApiResponse_Exception(Exception):
    def __init__(self, response: ApiResponse) -> None:
        self.response = response
        super().__init__(response)