# Schemas

**Request schemas** — Pydantic `BaseModel` with validators:

```python
from pydantic import BaseModel, field_validator

class Login_Request(BaseModel):
    email: str = Field(description="Account email address.", examples=["user@example.com"])
    password: str = Field(description="Account password.")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value):
        cleaned = value.strip()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("The provided string is not a valid email address format.")
        return cleaned
```

**Response schemas** — Pydantic `BaseModel` subclasses that are both the drf-spectacular type hint
*and* the serializer: a `from_model(cls, obj, ...) -> Schema` classmethod builds the instance
directly from the ORM object. See `serialization.md` for that inner-schema convention.

**The envelope class (`X_..._Response_OK`/`X_NotFound_Response`/etc.) owns its own construction
too — a view never hand-assembles `ApiResponse()/Issue()` inline.** The same class declared in
`@extend_schema(responses={...})` is what the view actually returns, so the documented shape and
the wire response can't drift apart. Pick the constructor that matches the case:

- **Success, no data** — instantiate directly:
  ```python
  return OkResponse().drf_response
  ```
- **Success, with data tied to an ORM object** — the envelope gets its own `.from_model(obj, ...)`
  classmethod, which wraps the inner data schema's own `from_model` and returns `cls(data=...)`:
  ```python
  class Company_RETRIEVE_Response_OK(OkResponse):
      code: Literal[200] = Field(200, ...)
      data: Company_Item_Schema

      @classmethod
      def from_model(cls, company) -> "Company_RETRIEVE_Response_OK":
          return cls(data=Company_Item_Schema.from_model(company))
  ```
  Call site: `return Company_RETRIEVE_Response_OK.from_model(company).drf_response`.
- **Error keyed to an id that doesn't exist** — the envelope gets a `.from_pk(pk)` classmethod:
  ```python
  class Company_NotFound_Response(NotFoundResponse):
      @classmethod
      def from_pk(cls, company_id) -> "Company_NotFound_Response":
          return cls(details=[_CompanyNotFoundIssue(message=f"Company {company_id} does not exist.")])
  ```
  Call site: `return Company_NotFound_Response.from_pk(company_id).drf_response`.
- **Error, hand-raised single issue** (a business-rule check, not pydantic validation):
  `BadRequestResponse.single(field="email", message="A user with this email already exists.")` /
  `PermissionDeniedResponse.single(field=..., message=...)` / `NotFoundResponse.single(...)`
  (`field` is optional on the latter two — not every permission/not-found failure is field-scoped).
- **Error, from a pydantic `ValidationError`**:
  `except ValidationError as e: return BadRequestResponse.from_pydantic_errors(e.errors()).drf_response`.
- **Error, from an `Issue` already built by internal (non-pydantic) logic** (e.g. a helper function
  that returns an `Issue` instead of raising): `BadRequestResponse.from_issue(issue)`.

`ApiResponse.dict_response`/`.drf_response` dump the envelope's own fields with `exclude_none=True`,
but dump a `data` field that's itself a nested `BaseModel` *without* `exclude_none`
(`common/schemas/v1/response.py`) — pydantic v2's `exclude_none` otherwise recurses into nested
models and silently drops their own None-valued fields (e.g. a client expecting `"role": null` to
stay present as a key would see the key vanish instead). This is handled once, centrally — never
work around it by hand-flattening a schema to a dict before assigning it to `data`.

**Domain schemas — two patterns, not one.** Shared identity/value concepts (Company, User, Role)
live in `common/schemas/v1/domain/`, one file per concept, both `Ref` and `Item` together. A
resource one app *owns* but another app also embeds directly stays in the owning app's own schema
file. Don't move an owned resource into `common/` just because a second app needs
it — only genuinely shared identity/value concepts belong there.

**Every field of Ref/Full schema gets both `description` and `examples` — no exceptions.** A client should never have
to guess a field's meaning or shape from its name alone:

```python
class Role_Ref_Schema(BaseModel):
    slug: str = Field(description="Machine-readable role identifier.", examples=["doctor"])
    name: str = Field(description="Translated display name.", examples=["Doctor"])
```

**Exception to "no exceptions": GET-schema and multipart-body fields.** A field on a `*_GET_Schema`
or a multipart `*_CREATE_Schema`/`*_UPDATE_Schema` never has its `Field(description=...)` read by
drf-spectacular — only `examples` is; `description` comes from that call's `overrides=` dict instead
(see the OpenAPI section below). Putting `description=` there is dead code — omit it. Every other
field (response schemas, and a request schema passed straight as `request=SomeSchema`, is read directly, so keeps `description` inline as normal.

A field shape repeated across 2+ schemas gets its `description`/`examples` factored into a shared
`Annotated` type in `common/schemas/v1/fields.py` instead.

Don't hand-duplicate a nested schema's own field values into a parent field's example — once every
nested schema has its own `examples=[...]`, Swagger UI composes them recursively (`docs/openapi.md`
rule 3). One exception: `List[Union[Ref, Item]]` fields need an explicit
`Field(examples=[[...]])` override (a Swagger display artifact, `docs/gotchas.md`) — build it via
`common/utils/extend.py::sample_value(schema_cls)` rather than typing values twice. Every
extend-eligible field's `description` is likewise generated by `extend_field_description()`, not
hand-written.

**Ref vs full — every resource has at most two shapes.** A resource embedded in *other* responses
gets a slim **ref** schema (`X_Ref_Schema`, only the fields every embedding needs). If it also has
its own endpoint(s), its full shape (`X_Item_Schema`) *subclasses* the ref — `from_model` calls the
ref's `from_model` first, then extends the result — and that one `Item` schema is what *every*
endpoint for that resource returns, list and detail alike:

```python
class Company_Ref_Schema(BaseModel):
    id: int
    slug: str

class Company_Item_Schema(Company_Ref_Schema):
    phone: Optional[str] = None
    created_at: DatetimeStr
    # returned by both GET /companies/ (list) and GET /companies/{id}/ (detail) -- no separate
    # "Company_List_Schema"
```

A resource that's *only* ever a top-level response (never embedded elsewhere) skips the ref
entirely (e.g. `Core/v1/schemas/auth.py`'s `Me_Response_OK`/`Login_Response_OK`).

**A field only one endpoint needs stays on the shared `Item` schema, defaulted, not a new tier.**
`transitions: List[Transition_Schema] = Field(default_factory=list)` is only populated by the
detail view's `from_model(obj, transitions=computed)`; every list call site leaves it at `[]`. Same
for a privileged self-view field like `get_all_permissions()` on `/profiles/me` — a defaulted field
on the one `Item` schema, not a dedicated `Me`-only subclass. This is a *value* difference between
two calls to the same schema, not a shape difference, so it doesn't cost a third tier.

**A response schema's field set never branches on data — one endpoint, one fixed shape — with one
declared exception: `extend` (below).** Outside of `extend`-declared fields, a field's presence
must never be conditional on another field's value — two structurally different representations
get two named schemas behind two named endpoints, not one schema with data-conditional fields.

**Embedded resources default to their ref — a client opts into the full shape via `?extend=`. No
exceptions.** Every field embedding another resource is ref-by-default and extendable.
See `extend.md` for the full mechanism.

Enforce ref-vs-full in tests with `common/testing/schema_parity.py::assert_matches_schema`.

**Every endpoint gets its own named permission decision and its own named response schema — even
where the underlying check/shape is correctly shared.** Group by resource path, ignoring `/v1/` and
`/{id}`-style params, to decide what counts as one "endpoint":

- *Permissions*: every `get_permissions()` names the concrete permission per action, branch-by-branch
  — not hidden behind an action-keyed dict. A bare, un-keyed fallback
  is a gap to fill in, even if the fallback's value happens to be correct.
- *Response schemas*: every `@extend_schema(responses={...})` points at its own named envelope
  class, even when two endpoints' envelopes wrap the identical inner `data` schema.

Sharing the underlying implementation is still encouraged — generic parametrized permission classes
(`HasPermCodename`, `CompanyScopedPermission`) and shared ref schemas are the intended way to reuse
code while keeping each endpoint's decision named and visible.

**Don't subclass a schema (or permission class) purely to rename it.** Only subclass when actually
adding or overriding a field.

**`ApiResponse`/`Issue`** from `common/schemas/v1/response.py`:
- `ApiResponse` is the envelope for every response (success or error)
- `OkResponse(ApiResponse)` narrows `status` to `Literal["ok"]` — subclass this (not `ApiResponse`)
  for per-endpoint `X_..._Response_OK`/`X_..._Response_Created` envelopes
- `Issue` carries error detail: `status`, `code`, `message`, `field`, `hint`
- Pre-built error responses in `common/schemas/v1/errors.py`: `UnauthorizedResponse`,
  `PermissionDeniedResponse`, `BadRequestResponse`, `NotFoundResponse` — `UnauthorizedResponse`/
  `MethodNotAllowedResponse` are invariant (instantiate directly); `BadRequestResponse` has
  `.from_pydantic_errors(errors)`/`.single(field=, message=)`/`.from_issue(issue)`;
  `PermissionDeniedResponse`/`NotFoundResponse` have `.single(field=, message=)` (`field` optional)

**OpenAPI query params for GET-schema/pagination fields are auto-derived, not hand-declared
twice.** `params_from_schema(schema_cls, overrides=...)`/`params_from_pagination(pagination_cls,
overrides=...)` (`common/schemas/v1/openapi_params.py`) introspect the Pydantic fields and build
the matching `OpenApiParameter` list. This applies even to params whose real filtering logic lives
in a django-filter `FilterSet` — `Profiles_GET_Schema.company_slug`/`.role_slug`/`.is_active`/`.q`
exist purely so `params_from_schema` can pick them up; `ProfileFilterSet` does the actual
filtering. The `extend` field gets its own dedicated helper instead of the generic per-field one:

```python
Profiles_LIST_Parameters = params_from_schema(Profiles_GET_Schema, exclude={'extend'}, overrides={
    'role_slug': {'description': "Filter by role slug(s), comma-separated."},
}) + [params_from_extendable(User_Item_Schema)]
```

`overrides` supplies curated prose — no source of truth to derive descriptions from. A raw
`OpenApiParameter(...)` hand-declared alongside the auto-derived list is only for a param with no
Pydantic field anywhere to derive from — grep for `OpenApiParameter(` outside `openapi_params.py`
first; an empty result (true today) means give the param a Pydantic field instead of reaching for
this. See `docs/openapi.md`'s Query Parameters section.

Multipart request bodies (`request=` needs a DRF serializer there; drf-spectacular can't introspect
Pydantic for that content type) go through the equivalent `request_serializer_from_schema(schema_cls,
name=..., overrides=...)` (`common/schemas/v1/openapi_request.py`), same `overrides` convention —
see `docs/openapi.md`'s Multipart Request Body section for the real `Dicom` example (a single-file
upload; a nested `List[SomeInputModel]` multipart field doesn't currently exist in this codebase,
but would render as one JSON-encoded string field the same way).
