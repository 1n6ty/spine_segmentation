import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from common.schemas.v1.domain.user import User_Item_Schema
from common.schemas.v1.errors import _UnauthorizedIssue, UnauthorizedResponse
from common.schemas.v1.response import OkResponse

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class Login_Request(BaseModel):
    email: str = Field(description="Account email address.", examples=["user@example.com"])
    password: str = Field(description="Account password.", examples=["hunter22"])

    remember_me: bool = Field(False, description="Whether to extend the session lifetime.", examples=[False])

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: Optional[str]) -> Optional[str]:
        cleaned_value = value.strip()
        if not EMAIL_REGEX.match(cleaned_value):
            raise ValueError("The provided string is not a valid email address format.")
        return cleaned_value


class Login_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])


class _Login_InvalidCredentials_Issue(_UnauthorizedIssue):
    message: str = Field("Invalid credentials.", description="Fixed message for a failed login attempt.", examples=["Invalid credentials."])


class Login_InvalidCredentials_Response(UnauthorizedResponse):
    details: List[_Login_InvalidCredentials_Issue] = Field(
        default_factory=lambda: [_Login_InvalidCredentials_Issue()],
        description="The single invalid-credentials issue.",
    )


class Logout_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])


class Me_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: User_Item_Schema
