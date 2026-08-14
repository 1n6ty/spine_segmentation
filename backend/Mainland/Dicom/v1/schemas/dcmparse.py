from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Any, Optional

from django.core.files.uploadedfile import UploadedFile

from common.schemas.v1.fields import UploadFile

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
