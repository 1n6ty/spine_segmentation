from typing import Literal

from pydantic import Field

from common.schemas.v1.response import ApiResponse, Details, Issue

"""
Pre-typed error response envelopes for `@extend_schema(responses={...})`, so
OpenAPI documentation for the standard error shapes (401/403/405/400) doesn't
have to be hand-rolled per view. Messages match the ones `StdViewSet` already
raises in `common/mixins/v1/viewset.py`.
"""

class UnauthorizedResponse(ApiResponse):
    status: Literal["error"] = "error"
    code: int = 401
    details: Details = Field(default_factory=lambda: Details(issues=[
        Issue(status="error", code=401, message="User wasn't authenticated.")
    ]))

class PermissionDeniedResponse(ApiResponse):
    status: Literal["error"] = "error"
    code: int = 403
    details: Details = Field(default_factory=lambda: Details(issues=[
        Issue(status="error", code=403, message="Presented user has not enough permissions.")
    ]))

class MethodNotAllowedResponse(ApiResponse):
    status: Literal["error"] = "error"
    code: int = 405
    details: Details = Field(default_factory=lambda: Details(issues=[
        Issue(status="error", code=405, message="Non-operable HTTP method was received.")
    ]))

class BadRequestResponse(ApiResponse):
    status: Literal["error"] = "error"
    code: int = 400
    details: Details = Field(default_factory=lambda: Details(issues=[
        Issue(status="error", code=400, message="The request could not be processed.")
    ]))
