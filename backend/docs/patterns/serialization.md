# Serialization

Serialization is a `from_model(cls, obj, ...) -> Schema` classmethod on the response schema class
itself, in `<App>/v1/schemas/` — no separate serializer function or DRF serializer class. The
schema *is* the serializer: constructing it validates the shape, and the view/pagination call site
does `.model_dump()` on the result to get the response dict.

**Ref-vs-full is expressed as one `from_model` calling another, not a parallel function pair:**

```python
class User_Ref_Schema(BaseModel):
    id: int
    email: str
    is_active: bool

    @classmethod
    def from_model(cls, user: "User", profile=None) -> "User_Ref_Schema":
        return cls(id=user.pk, email=user.email, is_active=user.is_active)


class User_Item_Schema(User_Ref_Schema):
    company: Optional[Union[Company_Ref_Schema, Company_Item_Schema]] = None  # ?extend=company -- see extend.md
    role: Optional[Union[Role_Ref_Schema, Role_Item_Schema]] = None
    permissions: List[str] = Field(default_factory=list)

    @classmethod
    def from_model(cls, user: "User", *, permissions: Optional[List[str]] = None,
                    extend: frozenset = frozenset()) -> "User_Item_Schema":
        ref = User_Ref_Schema.from_model(user)
        company = get_user_company(user)
        role = get_user_role(user)
        company_schema = Company_Item_Schema if 'company' in extend else Company_Ref_Schema
        role_schema = Role_Item_Schema if 'role' in extend else Role_Ref_Schema
        return cls(
            **ref.model_dump(),
            company=company_schema.from_model(company) if company is not None else None,
            role=role_schema.from_model(role) if role is not None else None,
            permissions=permissions if permissions is not None else [],
        )
```

(Real example, `common/schemas/v1/domain/user.py`.)

- **Access pre-fetched relations via `getattr` to avoid N+1**: `getattr(obj, '_prefetched_x', [])`,
  not `obj.x_set.all()`, whenever the view's queryset already `.prefetch_related()`d it.
- Datetime: `obj.created_at.strftime(settings.DATETIME_FORMAT)`.
- Annotated query fields: access directly as `obj._annotation_name`
  (e.g. `obj._file_count` from `.annotate(_file_count=Count('files'))`).
- Translated fields: `role.safe_translation_getter('name', any_language=True)`, not `.name` — see
  `Role_Ref_Schema.from_model` (`common/schemas/v1/domain/role.py`).

A `from_model` that grows a new field reading a lazy relation (a reverse FK manager, an
un-prefetched `getattr`) becomes DB-touching — any `async def` caller must then wrap it in
`sync_to_async`. When adding such a field, grep every call site of the schema *and* its callers'
callers, not just the one you're adding a field for — see `docs/gotchas.md`.
