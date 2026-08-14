from common.schemas.v1.response import ApiResponse, Issue
from pydantic import Field
from typing import Literal, List

# ==========================================
# 401 Unauthorized Definitions
# ==========================================
class _UnauthorizedIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[401] = Field(401, description="Always 401 for this issue.", examples=[401])
    message: str = Field("User wasn't authenticated.", description="Fixed message for unauthenticated requests.", examples=["User wasn't authenticated."])

class UnauthorizedResponse(ApiResponse):
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
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[403] = Field(403, description="Always 403 for this response.", examples=[403])
    details: List[_PermissionDeniedIssue] = Field(default_factory=lambda: [_PermissionDeniedIssue()], description="The single permission-denied issue.")


# ==========================================
# 405 Method Not Allowed Definitions
# ==========================================
class _MethodNotAllowedIssue(Issue):
    status: Literal["error"] = Field("error", description="Always 'error' for this issue.", examples=["error"])
    code: Literal[405] = Field(405, description="Always 405 for this issue.", examples=[405])
    message: str = Field("Non-operable HTTP method was received.", description="Fixed message for disallowed HTTP methods.", examples=["Non-operable HTTP method was received."])

class MethodNotAllowedResponse(ApiResponse):
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
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[404] = Field(404, description="Always 404 for this response.", examples=[404])
    details: List[_NotFoundIssue] = Field(default_factory=lambda: [_NotFoundIssue()], description="The single not-found issue.")


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
    status: Literal["error"] = Field("error", description="Always 'error' for this response.", examples=["error"])
    code: Literal[400] = Field(400, description="Always 400 for this response.", examples=[400])
    details: List[_BadRequestIssue] = Field(default_factory=lambda: [_BadRequestIssue()], description="One or more validation issues.")
