# OpenAPI / drf-spectacular

## Tagging and Per-Method Decoration

Tag at the class level to group a viewset's operations in Swagger UI; every action method still
needs its own `summary`/`description`/`responses`/`parameters`:

```python
from drf_spectacular.utils import extend_schema

@extend_schema(tags=['Profile Management'])
class ProfilesViewSet(StdViewSetMixin):

    @extend_schema(
        summary="List all users",
        description="Returns every User in the system with full profile detail (phone, company, role).",
        parameters=Profiles_LIST_Parameters,
        responses={200: Profiles_LIST_Response_OK, 400: BadRequestResponse, 401: UnauthorizedResponse, 403: PermissionDeniedResponse},
    )
    async def list(self, request: Request) -> Response: ...
```

| Field | What to put |
|---|---|
| `summary` | Short action title (≤ 10 words) |
| `description` | What it does, what callers must know |
| `responses` | `{200: ..., 400: BadRequestResponse, 401: UnauthorizedResponse, 403: PermissionDeniedResponse, 404: ...}` from `common/schemas/v1/errors.py` |
| `parameters` | Query params — see below |

**Class-level `@extend_schema` can break async dispatch on inherited mixin methods.**
drf-spectacular's `isolate_view_method` wraps inherited methods in a sync wrapper when it processes
a class-level decorator — the view would still run, but synchronously, raising
`SynchronousOnlyOperation` the moment it touches the ORM. Every real ViewSet here
(`AuthViewSet`/`CompanyViewSet`/`DcmViewSet`/`ProfilesViewSet`) only inherits from
`StdViewSetMixin` and tags at the class level with no issue — this hasn't actually been hit in this
codebase yet, since none of them combine `StdViewSetMixin` with a second mixin that contributes its
own action methods. If a future ViewSet does, and hits `SynchronousOnlyOperation` from a
class-tagged inherited method, re-assign that method in the subclass body so
`isolate_view_method` treats it as native:

```python
@extend_schema(tags=["Example Management"])
class ExampleViewSet(SomeSharedActionsMixin, StdViewSetMixin):
    shared_action = SomeSharedActionsMixin.shared_action  # prevents isolate_view_method wrapping
```

---

## Query Parameters

A GET-schema-backed param is auto-derived via `params_from_schema()`/`params_from_extendable()` —
see `patterns/schemas.md`. Every query param currently documented anywhere in the codebase has a
real Pydantic field backing it this way, including params that are ultimately consumed by a
django-filter `FilterSet` rather than validated by the schema itself (`Profiles_GET_Schema.company_slug`/
`.role_slug`/`.is_active`/`.q` exist purely so `params_from_schema` can pick them up — the actual
filtering logic still lives in `ProfileFilterSet`).

Hand-declaring a raw `OpenApiParameter` is only for the day a param genuinely has no Pydantic field
anywhere to derive from — grep for `OpenApiParameter(` outside
`common/schemas/v1/openapi_params.py` before adding a new hand-declared one; if that comes back
empty (it does today), the codebase-wide convention is to add the param to a GET-schema first,
even one whose only consumer is a `FilterSet`, rather than reach for this:

```python
from drf_spectacular.utils import OpenApiParameter

@extend_schema(
    parameters=[
        OpenApiParameter(name='some_param', type=str, required=False,
                          description="..."),
    ],
)
async def some_action(self, request): ...
```

---

## Examples

Every example has exactly one home, chosen by what it's an example *of*.

**1. A field's realistic value → `Field(examples=[...])`, paired with `description=`.** Composes
automatically into Swagger UI's "Example Value" frontend and pre-fills "Try it out" for request
fields — see `patterns/schemas.md`'s "every field gets `description` and `examples`" rule. Pass
exactly one value for response/request-*body* fields — Swagger UI's sample engine only reads
`examples[0]` when synthesizing a full object; a second item is dead weight there (query params are
the exception, rule 4):

```python
class Login_Request(BaseModel):
    email: str = Field(examples=["user@example.com"])
    password: str
```

**2. The same field shape repeated across 2+ schemas → a shared `Annotated` type in
`common/schemas/v1/fields.py`.** Don't hand-copy `Field(description=..., examples=[...])` a second
time:

```python
DatetimeStr = Annotated[str, Field(
    description="Datetime in DD.MM.YYYYThh:mm format.",
    examples=["26.06.2026T14:30"],
)]
```

Only extract once real duplication exists (2+ sites).

**3. Don't hand-maintain a whole-model example via `model_config=ConfigDict(json_schema_extra=...)`.**
Once every nested schema's own fields carry `Field(examples=...)`, Swagger UI composes a full
nested example automatically — through `Optional`/`List[Model]` fields too, no depth limit.
**Known, accepted limitation:** every reference to the same `$ref`'d schema in one response renders
with *identical* data (two different `User_Ref_Schema` slots show the same name) — an inherent
`$ref`-composition trade-off, not a bug. Only reach for a hand-maintained whole-object override
(guarded by `common/testing/schema_parity.py::assert_example_matches_schema`) when that's genuinely
disruptive for one specific schema.

**4. Query params inherit their examples automatically from the backing field**, but unlike body
fields (rule 1), *every* item in a multi-value `examples=[...]` list matters — `params_from_schema`
turns it into a set of separately named, individually selectable options in "Try it out":

```python
class Profiles_GET_Schema(BaseModel):
    role_slug: Optional[str] = Field(None, examples=["doctor,viewer"])
```

Reach for a second value whenever one example doesn't show the field's range (e.g. single-key vs.
multi-key sort).

**5. Multiple named response scenarios for one endpoint → `OpenApiExample` via
`@extend_schema(examples=[...])`.** `patterns/schemas.md` bans response shapes that branch on
*data* — so this isn't for that. It's for the one real exception: `?extend=`-eligible endpoints
(`patterns/extend.md`), where a field's shape changes based on a *request parameter*, not response
data. `extend_examples(response_schema_cls)` (`common/schemas/v1/openapi_params.py`) builds both
scenarios — `"Default (ref shapes)"` / `"Extended (full shapes)"` — from the response envelope's own
field examples via `sample_value(schema_cls, full=...)`, so no endpoint hand-writes example JSON:

```python
from common.schemas.v1.openapi_params import extend_examples

@extend_schema(
    examples=extend_examples(Profiles_GET_GetMe_Response),
    responses={200: Profiles_GET_GetMe_Response, 401: UnauthorizedResponse},
)
async def get_me(self, request): ...
```

(Real example, `Profile/v1/views/profiles.py`'s `ProfilesViewSet.get_me`.)

This is a genuinely different mechanism from rule 1 (writes `content.application/json.examples`, a
sibling of `schema`, rather than composing through it) and from the Schema tab's own `anyOf` toggle
(`patterns/extend.md`) — that shows *structure*, this shows a complete literal *response body*.
Don't reach for it outside `extend`-eligible endpoints; a genuine data-branching response shape
still shouldn't exist per `schemas.md`.

**6. Multipart request bodies are the one place none of the above reaches** — see below.

**Don't embed "e.g. ..." inside `description=` prose once a field has a structured `examples=`.**
It duplicates what the examples frontend already shows and is the first thing to go stale.

---

## Multipart Request Body

File upload endpoints document their shape via a DRF `Serializer` passed to `request=` (Pydantic
isn't introspectable for `multipart/form-data`), so Swagger UI renders the upload widget. Never
hand-write that serializer's field list — auto-derive it from the real Pydantic schema via
`request_serializer_from_schema()` (`common/schemas/v1/openapi_request.py`), same "don't
hand-declare twice" principle as query params (`patterns/schemas.md`). A field typed
`common/schemas/v1/fields.py`'s `UploadFile` is detected automatically and rendered as a real
file-upload widget, not a JSON-string placeholder:

```python
# Dicom/v1/schemas/dcmparse.py
class Parse_POST_schema(BaseModel):
    file: UploadFile

# Dicom/v1/schemas/docs/dcmparse.py
DCMParse_POST_RequestSerializer = request_serializer_from_schema(
    Parse_POST_schema,
    name='DCMParse_POST_RequestSerializer',
    overrides={'file': {'description': "The DICOM file to upload and parse."}},
)

# Dicom/v1/views/dcmparse.py
@extend_schema(request={'multipart/form-data': DCMParse_POST_RequestSerializer}, responses={200: ApiResponse, 400: ApiResponse})
async def parse(self, request) -> Response: ...
```

`overrides` supplies curated per-field prose the same way `params_from_schema`'s does — there's no
source of truth to derive descriptions from. A field's alias, when it has one (e.g. a repeated
`files[]` field on a hypothetical multi-file endpoint — no current endpoint needs one), becomes the
generated serializer's field key instead of the Python attribute name, matching what a multipart
client actually sends over the wire.

---

## Documenting WebSocket Consumers

No app currently registers a WS consumer (`Mainland/ws_urls.py` is an empty list — Channels/ASGI
routing is wired but dormant; see `docs/patterns/websockets.md`), so nothing below has a real
example in this codebase yet. Kept for when one exists again.

`SPECTACULAR_SETTINGS['DEFAULT_GENERATOR_CLASS']` is
`drf_spectacular_websocket.schemas.WsSchemaGenerator`, which walks `Mainland/ws_urls.py`'s routes for
consumer methods decorated with `extend_ws_schema` — an undecorated consumer contributes nothing to
`/api/schema/`:

```python
from drf_spectacular_websocket.decorators import extend_ws_schema

@extend_ws_schema(
    type='receive',                       # or 'send' -- no third option
    summary='New/updated message pushed to the thread',
    request=None,                          # 'send' interactions pass a Serializer here instead
    responses=ChatMessagePush_Serializer,
    tags=['Order-Messages Management'],    # match the app's own REST message endpoints' tag
)
async def chat_message(self, event): ...
```

- `type='send'` = client sends and gets a response; `type='receive'` = server pushes unprompted.
- **`request`/`responses` must be real DRF `Serializer` classes, not Pydantic.** WS-only serializers
  live in `<App>/v1/schemas/ws.py`, never used to validate/serialize at runtime — keep them
  hand-in-sync with the real dict-building function they document (see `docs/gotchas.md`, nothing
  else catches drift).
- Decorate the specific handler method (e.g. `chat_message`), not the generic `receive` dispatcher —
  its Python name becomes the operation's event key.
- A decorator's `tags=[...]` attaches to the function object, not per-subclass — each concrete
  consumer redefines the method purely to attach its own `tags=[...]`, delegating to `super()`.
- These are documentation-only entries, not real HTTP routes — "Try it out"/"Execute" are suppressed
  for them via a plugin in `templates/drf_spectacular/swagger_ui.js` (see `docs/gotchas.md`).
- The schema generator instantiates each consumer **bare** (no `connect()`, no `scope`) — any
  property reading connection-time state must tolerate being accessed unbound:
  `getattr(self, 'thread_ref', None)`, not `self.thread_ref`.

See `patterns/websockets.md` for the routing setup this documents.
