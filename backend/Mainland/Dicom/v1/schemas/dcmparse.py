from pydantic import BaseModel, field_validator, ConfigDict
from typing import Any

from django.core.files.uploadedfile import UploadedFile

class Parse_POST_schema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    file: UploadedFile

    @field_validator("file")
    @classmethod
    def check_file_type(cls, v: Any):
        if not isinstance(v, UploadedFile):
            raise ValueError("The 'file' field must contain an uploaded file.")
        
        if not v.name.lower().endswith(('.dcm', '.dicom')):
            raise ValueError("Only DICOM files are allowed.")
            
        return v