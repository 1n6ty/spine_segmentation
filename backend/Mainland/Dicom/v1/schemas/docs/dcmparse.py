"""Documentation-only DRF serializer for Dicom's multipart parse endpoint -- never
instantiated or used to validate/serialize anything at runtime, only to
describe the multipart wire shape for swagger-ui (drf-spectacular's request=
needs a DRF serializer for multipart bodies; it can't introspect Pydantic for
that content type the way it can for JSON). Mirrors Dicom/v1/views/dcmparse.py --
see docs/patterns/schemas.md.

Auto-derived from Parse_POST_schema via request_serializer_from_schema() so it
can't drift from what actually validates the request -- see
common/schemas/v1/openapi_request.py.

`file` correctly renders as a real file-upload field (not a JSON-string
placeholder) because Parse_POST_schema.file is typed UploadFile -- see
common/schemas/v1/fields.py and openapi_request.py's upload-field detection."""

from common.schemas.v1.openapi_request import request_serializer_from_schema
from Dicom.v1.schemas.dcmparse import Parse_POST_schema

DCMParse_POST_RequestSerializer = request_serializer_from_schema(
    Parse_POST_schema,
    name='DCMParse_POST_RequestSerializer',
    overrides={
        'file': {'description': "DICOM file to parse (.dcm/.dicom)."},
        'file_role_slug': {
            'required': False,
            'description': "FileRole slug to file this DICOM under (e.g. 'DICOM_XRAY_FRONTAL', "
                            "'DICOM_XRAY_SAGITTAL') -- enforces that role's max_count=1-per-Study "
                            "limit. Omit/null to default to 'DICOM_XRAY_SAGITTAL'.",
        },
    },
)
