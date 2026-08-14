"""Documentation-only query params for FileManager's list endpoint -- never
instantiated or used to validate/serialize anything at runtime, only to
describe the wire shape for swagger-ui. Mirrors FileManager/v1/views/file_role.py --
see docs/patterns/schemas.md.

Auto-derived from FileRole_GET_Schema via params_from_schema() so it can't
drift from what actually validates the request -- see
common/schemas/v1/openapi_params.py."""

from common.schemas.v1.openapi_params import params_from_schema
from FileManager.v1.paginations.file_role import FileRole_Pagination
from FileManager.v1.schemas.file_role import FileRole_GET_Schema

FileRole_LIST_Parameters = params_from_schema(FileRole_GET_Schema, overrides={
    'page': {'description': "1-indexed page number."},
    'page_size': {'description': f"Items per page (1-{FileRole_Pagination.max_page_size}, "
                                  f"default {FileRole_Pagination.page_size})."},
    'slug': {'description': "Filter by exact FileRole slug."},
})
