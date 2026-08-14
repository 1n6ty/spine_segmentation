"""Documentation-only query params for Company's list endpoint -- never
instantiated or used to validate/serialize anything at runtime, only to
describe the wire shape for swagger-ui. Mirrors Company/v1/views/company.py --
see docs/patterns/schemas.md.

Auto-derived from Company_GET_Schema via params_from_schema() so it can't
drift from what actually validates the request -- see
common/schemas/v1/openapi_params.py."""

from common.schemas.v1.openapi_params import params_from_schema
from Company.v1.paginations.company import Companies_Pagination
from Company.v1.schemas.company import Company_GET_Schema

Company_LIST_Parameters = params_from_schema(Company_GET_Schema, overrides={
    'page': {'description': "1-indexed page number."},
    'page_size': {'description': f"Items per page (1-{Companies_Pagination.max_page_size}, "
                                  f"default {Companies_Pagination.page_size})."},
    'slug': {'description': "Filter by exact company slug."},
})
