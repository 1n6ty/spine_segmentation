"""Shared Pydantic field types for concepts repeated across 2+ schemas."""

from typing import Annotated

from django.core.files.uploadedfile import UploadedFile
from pydantic import Field, PlainValidator, WithJsonSchema

DatetimeStr = Annotated[str, Field(
    description="Datetime in YYYY.MM.DDThh:mm format.",
    examples=["2026.06.26T14:30"],
)]

UnreadCount = Annotated[int, Field(
    description="Messages from other participants since the requesting user's last read.",
    examples=[3],
)]


def _validate_upload(v):
    if not isinstance(v, UploadedFile):
        raise ValueError("must be a file upload")
    return v


UploadFile = Annotated[
    UploadedFile,
    PlainValidator(_validate_upload),
    WithJsonSchema({"type": "string", "format": "binary"}),
]
