# Extend (ref → full expansion)

Embedded resources default to their **ref** shape (see `schemas.md`'s "Ref vs full"). A client that
needs the **full** shape for a specific embedded field requests it via the `extend` query
parameter — comma-separated field names:

```
GET /api/profiles/me/?extend=company,role
GET /api/profiles/?extend=company
```

Every occurrence of that field in the response — including every row of a list response — resolves
to the full `Item` shape instead of the ref for that request. `extend` is opt-in per request; it
never changes an endpoint's *declared* OpenAPI shape, only which of the two already-declared
variants a given field resolves to (see "Typing", below).

## Which fields are extendable

Every field on an `Item` schema that embeds another resource by reference — no exceptions. There is
no field that's hardcoded to always return the full shape. If a specific caller needs the full shape on every request, that
caller always passes `extend` — it doesn't get a different, harder-coded schema contract.

## Typing

An extendable field is typed as a union of its two declared shapes, not a single fixed type — the
schema class itself doesn't change per request, only which branch `from_model` populates:

```python
class User_Item_Schema(User_Ref_Schema):
    company: Optional[Union[Company_Ref_Schema, Company_Item_Schema]] = None
    role: Optional[Union[Role_Ref_Schema, Role_Item_Schema]] = None

    @classmethod
    def from_model(cls, user: "User", *, extend: frozenset[str] = frozenset()) -> "User_Item_Schema":
        company_schema = Company_Item_Schema if 'company' in extend else Company_Ref_Schema
        company = company_schema.from_model(get_user_company(user))
        ...
```

(Real example, `common/schemas/v1/domain/user.py`'s `User_Item_Schema`.)

This keeps the class OpenAPI-documentable as a single, static declared shape (an `anyOf` per
extendable field — confirmed against the real generated schema; pydantic's `Union[X, Y]` always
renders as `anyOf`, never `oneOf`) — consistent with "one endpoint, one fixed *declared* shape": the
declared shape covers both variants, the *response* picks one per request.

Two separate Swagger UI frontends need two separate mechanisms, since they're driven by different
underlying data: the *structure* (`anyOf` on the schema, the OAS 3.1 toggle above) vs. a *complete
literal response body* (what the "Example Value" frontend / "Try it out" shows before you execute).
Every `?extend=`-eligible endpoint's `@extend_schema(...)` also carries
`examples=extend_examples(X_Response_OK)` (`common/schemas/v1/openapi_params.py`) — two named,
selectable scenarios, `"Default (ref shapes)"` and `"Extended (?extend=... -- full shapes)"`, built
via `common/utils/extend.py::sample_value(schema_cls, full=...)` from the response envelope's own
field examples rather than hand-written per endpoint. See `docs/openapi.md`'s Examples section, rule 5.

## Parsing and validation

Views parse `extend` via a shared helper — `common/utils/extend.py` — something like
`parse_extend_param(raw: str | None, allowed: frozenset[str]) -> frozenset[str]`, given the set of
field names the endpoint's own schema actually declares as extendable. **An unknown field name in
`extend` is a 400**, not a silent no-op. The parsed set threads through to `from_model(..., extend=...)`.

## List endpoints

`extend` applies once per request, to every row. A list view parses it the same way a detail view
does, then passes the same `extend` set into every row's `from_model(..., extend=extend)` call
inside `serialize_page()` (see `pagination.md`) — not re-parsed per row.

## N+1: the view owns the queryset cost, not the schema

Extending a field to full can require additional `select_related`/`prefetch_related` the base
queryset doesn't already do. `from_model` must never lazily fetch to satisfy an extend request —
same N+1 risk `serialization.md`'s N+1 note already warns about, just triggered by a query param
instead of a new field. **The view builds its queryset conditionally on the parsed `extend` set**
(only pay for the extra join/prefetch when a client actually asks for that field) — never
unconditionally, just because a field happens to be extendable.

## OpenAPI documentation

Follows `schemas.md`'s existing "don't hand-declare twice" principle — the same one
`params_from_schema`/`params_from_pagination` already established for GET-schema and pagination
params. `params_from_extendable(item_schema_cls)` (`common/schemas/v1/openapi_params.py`) derives
the `extend` parameter's description (which field names are valid) straight from the schema's own
`Union`-typed fields — append it to every extend-eligible endpoint's `parameters=` list, never
hand-copy the field-name list into prose.

## List-typed and nested fields

`List[Union[Ref, Item]]` works the same way, one shape for the whole list per request — no
extendable field in this codebase is list-typed yet, but the mechanism is
`some_list: List[Union[X_Ref_Schema, X_Item_Schema]]`, `?extend=some_list`. A field nested under an
embedded resource would extend via a dotted path (e.g. `?extend=company.some_nested_field`),
resolved with `sub_extend(extend, 'company')` before threading into that nested `from_model` call —
also not currently needed by any real field here (`company`/`role` are both flat).
