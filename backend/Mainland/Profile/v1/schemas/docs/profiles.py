"""Documentation-only query params for Profile's list endpoint -- never
instantiated or used to validate/serialize anything at runtime, only to
describe the wire shape for swagger-ui. Mirrors Profile/v1/views/profiles.py --
see docs/patterns/schemas.md.

Auto-derived from Profiles_GET_Schema via params_from_schema() so it can't
drift from what actually validates the request -- see
common/schemas/v1/openapi_params.py."""

from common.schemas.v1.domain.user import User_Item_Schema
from common.schemas.v1.openapi_params import params_from_extendable, params_from_schema
from Profile.v1.paginations.profiles import Profiles_Pagination
from Profile.v1.schemas.profiles import Profiles_GET_Schema

Profiles_LIST_Parameters = params_from_schema(Profiles_GET_Schema, overrides={
    'page': {'description': "1-indexed page number."},
    'page_size': {'description': f"Items per page (1-{Profiles_Pagination.max_page_size}, "
                                  f"default {Profiles_Pagination.page_size})."},
    'company_slug': {'description': "Filter by company slug."},
    'role_slug': {'description': "Filter by role slug(s), comma-separated."},
    'is_active': {'description': "Filter by active status."},
    'q': {'description': "Elasticsearch full-text query across email/first_name/last_name/patronymic."},
}, exclude={'extend'}) + [params_from_extendable(User_Item_Schema)]

Profile_DETAIL_Parameters = [params_from_extendable(User_Item_Schema)]
