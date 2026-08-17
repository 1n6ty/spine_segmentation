"""Documentation-only query params and multipart serializer for
UserRecentStudies endpoints -- never instantiated or used to validate/serialize
anything at runtime, only to describe the wire shape for swagger-ui. Mirrors
Dicom/v1/views/user_recent_studies.py -- see docs/patterns/schemas.md.

Auto-derived from the real Pydantic schemas via params_from_schema() /
request_serializer_from_schema() so they can't drift from what actually
validates the request -- see common/schemas/v1/openapi_params.py and
common/schemas/v1/openapi_request.py."""

from common.schemas.v1.openapi_params import params_from_schema
from Dicom.v1.paginations.user_recent_studies import UserRecentStudies_Pagination
from Dicom.v1.schemas.user_recent_studies import UserRecentStudies_GET_Schema

UserRecentStudies_LIST_Parameters = params_from_schema(UserRecentStudies_GET_Schema, overrides={
    'page': {'description': "1-indexed page number."},
    'page_size': {'description': f"Items per page (1-{UserRecentStudies_Pagination.max_page_size}, "
                                  f"default {UserRecentStudies_Pagination.page_size})."},
})
