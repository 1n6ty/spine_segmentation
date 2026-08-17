from common.schemas.v1.response import ApiResponse, Issue
from pydantic import Field
from typing import Literal, List, Optional

# ==========================================
# 401 Unauthorized Definitions
# ==========================================
class _UnauthorizedIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[401] = Field(401, description="Always 401 for this issue.", examples=[401])
    message: str = Field("User wasn't authenticated.", description="Fixed message for unauthenticated requests.", examples=["User wasn't authenticated."])

class UnauthorizedResponse(ApiResponse):
    """Invariant response -- no field/message ever varies, so instantiate it
    directly at the call site: `UnauthorizedResponse().drf_response`."""
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[401] = Field(401, description="Always 401 for this response.", examples=[401])
    details: List[_UnauthorizedIssue] = Field(default_factory=lambda: [_UnauthorizedIssue()], description="The single unauthenticated-request issue.")


# ==========================================
# 403 Permission Denied Definitions
# ==========================================
class _PermissionDeniedIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[403] = Field(403, description="Always 403 for this issue.", examples=[403])
    message: str = Field("Presented user has not enough permissions.", description="Fixed message for permission-denied requests.", examples=["Presented user has not enough permissions."])

class PermissionDeniedResponse(ApiResponse):
    """Doubles as the actual runtime response builder -- call
    PermissionDeniedResponse() directly for the invariant case, or
    .single(field=, message=) for a hand-raised 403 with a specific reason."""
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[403] = Field(403, description="Always 403 for this response.", examples=[403])
    details: List[_PermissionDeniedIssue] = Field(default_factory=lambda: [_PermissionDeniedIssue()], description="The single permission-denied issue.")

    @classmethod
    def single(cls, *, field: Optional[str] = None, message: str) -> "PermissionDeniedResponse":
        """One-issue convenience constructor for a hand-raised 403 with a
        specific reason -- `field` is optional (unlike BadRequestResponse.single)
        since not every permission failure is scoped to one request field."""
        return cls(details=[_PermissionDeniedIssue(field=field, message=message)])


# ==========================================
# 405 Method Not Allowed Definitions
# ==========================================
class _MethodNotAllowedIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[405] = Field(405, description="Always 405 for this issue.", examples=[405])
    message: str = Field("Non-operable HTTP method was received.", description="Fixed message for disallowed HTTP methods.", examples=["Non-operable HTTP method was received."])

class MethodNotAllowedResponse(ApiResponse):
    """Invariant response -- no field/message ever varies, so instantiate it
    directly at the call site: `MethodNotAllowedResponse().drf_response`."""
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[405] = Field(405, description="Always 405 for this response.", examples=[405])
    details: List[_MethodNotAllowedIssue] = Field(default_factory=lambda: [_MethodNotAllowedIssue()], description="The single method-not-allowed issue.")

# ==========================================
# 404 Not Found Definitions
# ==========================================
class _NotFoundIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[404] = Field(404, description="Always 404 for this issue.", examples=[404])
    message: str = Field("The requested resource could not be found.", description="Fixed message for not-found requests.", examples=["The requested resource could not be found."])

class NotFoundResponse(ApiResponse):
    """Doubles as the actual runtime response builder -- call
    .single(field=, message=) for an ad-hoc 404 that isn't a single named
    resource's own X_NotFound_Response.from_pk() case (e.g. a page number
    or an action with more than one distinct not-found reason)."""
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[404] = Field(404, description="Always 404 for this response.", examples=[404])
    details: List[_NotFoundIssue] = Field(default_factory=lambda: [_NotFoundIssue()], description="The single not-found issue.")

    @classmethod
    def single(cls, *, field: Optional[str] = None, message: str) -> "NotFoundResponse":
        return cls(details=[_NotFoundIssue(field=field, message=message)])


# ==========================================
# 400 Bad Request Definitions
# ==========================================
class _BadRequestIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[400] = Field(400, description="Always 400 for this issue.", examples=[400])
    message: str = Field(
        "The server cannot process the request due to a client error (e.g., malformed request syntax, invalid data validation).",
        description="Human-readable validation failure message.",
        examples=["This field is required."],
    )
    field: str = Field("The issued field.", description="Name of the request field that failed validation.", examples=["email"])

class BadRequestResponse(ApiResponse):
    """Doubles as the actual runtime response builder (not just the OpenAPI doc
    declaration) -- call .from_pydantic_errors(...)/.single(...) at the call
    site instead of hand-building an equivalent ApiResponse/Issue pair, so the
    documented shape and the wire response can never drift apart."""
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[400] = Field(400, description="Always 400 for this response.", examples=[400])
    details: List[_BadRequestIssue] = Field(default_factory=lambda: [_BadRequestIssue()], description="One or more validation issues.")

    @classmethod
    def from_pydantic_errors(cls, errors) -> "BadRequestResponse":
        """Builds the real response from a pydantic ValidationError's .errors()
        -- one _BadRequestIssue per error, `field` set to the dotted loc path.
        For a view that validates a request body/params against a pydantic
        schema: `except ValidationError as e: return
        BadRequestResponse.from_pydantic_errors(e.errors()).drf_response`."""
        return cls(details=[
            _BadRequestIssue(field=".".join(map(str, err["loc"])), message=err["msg"])
            for err in errors
        ])

    @classmethod
    def single(cls, *, field: str, message: str) -> "BadRequestResponse":
        """One-issue convenience constructor for a hand-raised (non-pydantic)
        400, e.g. a business-rule check that isn't itself request-schema
        validation."""
        return cls(details=[_BadRequestIssue(field=field, message=message)])

    @classmethod
    def from_issue(cls, issue: Issue) -> "BadRequestResponse":
        """Wraps an already-built Issue -- e.g. from internal business logic
        that returns an Issue rather than raising a pydantic ValidationError
        (Dicom.utils.parse.parse_and_store_dicom is the reference case) --
        into this response's shape."""
        return cls(details=[_BadRequestIssue(**issue.model_dump())])
