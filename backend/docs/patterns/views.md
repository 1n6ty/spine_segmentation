# Views

All viewsets inherit `StdViewSetMixin` from `common/mixins/v1/viewset.py`, which itself extends
`adrf.viewsets.ViewSet`. Every action method is `async def`.

```python
from common.mixins.v1.viewset import StdViewSetMixin

class CompanyViewSet(StdViewSetMixin):
    async def list(self, request: Request) -> Response: ...
    async def retrieve(self, request: Request, company_id=None) -> Response: ...
```

**Permissions** — declared per-action in `get_permissions()`, never at class level — see
`permissions.md`.

**Request validation** — parse the *whole* payload via Pydantic in one call (`**request.data`,
never field-by-field `request.data.get(...)`); catch `ValidationError` and convert to 400:

```python
from pydantic import ValidationError

try:
    login_data = Login_Request(**request.data)
except ValidationError as exc:
    response = ApiResponse()
    for err in exc.errors():
        response.add_issue(Issue(status="error", code=400,
                                 field=str(err['loc'][-1]) if err['loc'] else None, message=err['msg']))
    return response.set_status("error", 400).drf_response
```

(Real example, `Core/v1/views/auth.py`'s `AuthViewSet.login`.)

**Multipart endpoints** (file uploads) still end in one Pydantic pass, but `request.data.dict()`
(not `**request.data` directly — a `QueryDict`'s `**`-unpacking yields list-wrapped values) and
files come from `request.FILES`/get merged in the same way if the schema needs more than one file
field:

```python
# Dicom/v1/schemas/dcmparse.py
class Parse_POST_schema(BaseModel):
    file: UploadFile

# Dicom/v1/views/dcmparse.py
try:
    parse_data = Parse_POST_schema(**request.data.dict())
except ValidationError as e:
    ...
await parse_and_store_dicom(parse_data.file)
```

A JSON-string multipart field (not currently needed by any endpoint here) would parse itself via a
`field_validator(mode='before')` on the schema rather than by hand in the view — see
`docs/openapi.md`'s Multipart Request Body section.

**Response** — always use `ApiResponse` builder:

```python
return ApiResponse().update_data({"data": ...}).set_status("ok", 200).drf_response
return ApiResponse().set_status("ok", 201).drf_response
```

**Async ORM** — never call synchronous ORM from async views:

| Use | Never use |
|---|---|
| `.aget()` | `.get()` |
| `.afirst()` | `.first()` |
| `.aexists()` | `.exists()` |
| `.acount()` | `.count()` |
| `.acreate()` | `.create()` |
| `.aupdate_or_create()` | `.update_or_create()` |
| `async for obj in qs:` | `list(qs)` / `qs[:]` |
| `await sync_to_async(fn)(args)` | calling sync functions directly |

A multi-statement transactional write (several related creates/updates that must succeed or fail
together) doesn't fit a single async ORM call — wrap it in a plain `def _update(): ...` closure
with `with transaction.atomic():` inside, and call `await sync_to_async(_update)()` once for the
whole block, rather than awaiting each statement separately. See `Profile/v1/views/profiles.py`'s
`ProfilesViewSet.partial_update` for the real pattern (updates `User` fields, then the `Profile`
row, in one atomic closure).

**Object permission check** is not automatic in async views — call explicitly:

```python
company = await Company.objects.prefetch_related('translations').aget(pk=company_id)
await sync_to_async(self.check_object_permissions)(request, company)
```

(Real example, `Company/v1/views/company.py`'s `CompanyViewSet.retrieve`.)
