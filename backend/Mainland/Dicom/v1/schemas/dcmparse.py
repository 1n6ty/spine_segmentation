import json

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Any, Optional

from django.core.files.uploadedfile import UploadedFile

from common.schemas.v1.fields import UploadFile
from common.schemas.v1.response import ApiResponse

class Parse_POST_schema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    file: UploadFile
    file_role_slug: Optional[str] = Field(
        None,
        description="FileRole slug to file this DICOM under (e.g. 'DICOM_XRAY_FRONTAL', "
                     "'DICOM_XRAY_SAGITTAL') -- enforces that role's max_count=1-per-Study "
                     "limit. Omit/null to default to 'DICOM_XRAY_SAGITTAL'.",
        examples=["DICOM_XRAY_SAGITTAL"],
    )

    @field_validator("file")
    @classmethod
    def check_file_type(cls, v: Any):
        if not isinstance(v, UploadedFile):
            raise ValueError("The 'file' field must contain an uploaded file.")
        
        if not v.name.lower().endswith(('.dcm', '.dicom')):
            raise ValueError("Only DICOM files are allowed.")

        return v


class SegmentationEvent_schema(BaseModel):
    """Wire shape of one SSE message on `GET .../segment/events`. Built both from
    the persisted DicomImage row (on connect/reconnect) and from a Channels
    broadcast payload (Dicom.tasks.segmentation._advance_status) -- both sources
    produce this same {status, ref_points} shape, so validating through one
    schema keeps them from silently drifting apart."""

    status: str = Field(..., description="Wire-mapped segmentation status.", examples=["done"])
    ref_points: Optional[dict[str, Any]] = Field(
        None, description="AI-produced reference points; present only once status is 'done'."
    )

    def to_sse_bytes(self) -> bytes:
        payload = ApiResponse().update_data(self.model_dump(exclude_none=True)).dict_response
        return f"data: {json.dumps(payload)}\n\n".encode("utf-8")
