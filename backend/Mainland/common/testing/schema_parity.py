import types
import typing

from pydantic import BaseModel


def _unwrap_optional(annotation):
    """Returns the inner type of Optional[X]/X | None -- otherwise the annotation
    unchanged. Handles both typing.Optional and the `|` union syntax."""
    origin = typing.get_origin(annotation)
    if origin is typing.Union or origin is types.UnionType:
        args = [a for a in typing.get_args(annotation) if a is not type(None)]
        if len(args) == 1:
            return args[0]
    return annotation


def assert_matches_schema(data: dict, schema: type[BaseModel], *, path: str = "") -> None:
    """Asserts a real response dict's shape matches a pydantic schema's declared
    fields. Catches drift between what a view actually returns over HTTP and what
    its schema's `from_model(...)` -- e.g. a view hand-building part of a dict instead of going through `from_model`.

    Two checks, run bidirectionally:
    1. Every key in `data` must be a declared field on `schema` -- catches the
       schema being missing a field the real dict has.
    2. Every required (no default) schema field must be present in `data` with a
       non-null value -- catches the inverse.

    Recurses into nested BaseModel and List[BaseModel] fields using the schema's
    own type annotations -- no per-schema hardcoding needed. Union/discriminated-
    union fields beyond Optional are not supported; none exist in the schemas
    this is used against today."""
    label = path or schema.__name__
    field_names = set(schema.model_fields.keys())
    extra = set(data.keys()) - field_names
    assert not extra, (
        f"{label}: response has field(s) {sorted(extra)} not declared on {schema.__name__} -- "
        f"either the schema is missing them, or they shouldn't be in the response"
    )

    for name, field in schema.model_fields.items():
        field_path = f"{path}.{name}" if path else name

        if name not in data or data[name] is None:
            assert not field.is_required(), (
                f"{field_path}: {schema.__name__} requires this field but the response "
                f"is missing it (or has it as null)"
            )
            continue

        value = data[name]
        annotation = _unwrap_optional(field.annotation)
        origin = typing.get_origin(annotation)

        if origin is list:
            (item_type,) = typing.get_args(annotation)
            item_type = _unwrap_optional(item_type)
            if isinstance(item_type, type) and issubclass(item_type, BaseModel):
                assert isinstance(value, list), f"{field_path}: expected a list, got {type(value).__name__}"
                for i, item in enumerate(value):
                    assert_matches_schema(item, item_type, path=f"{field_path}[{i}]")
        elif isinstance(annotation, type) and issubclass(annotation, BaseModel):
            assert isinstance(value, dict), f"{field_path}: expected a nested object, got {type(value).__name__}"
            assert_matches_schema(value, annotation, path=field_path)


def assert_example_matches_schema(schema: type[BaseModel]) -> None:
    """Asserts a schema's own `model_config = ConfigDict(json_schema_extra={"example": {...}})`
    matches its declared fields -- same drift risk as
    assert_matches_schema above, except the "response dict" being checked is the hand-written
    example instead of real serializer output. Use this instead of json_schema_extra examples
    going unchecked whenever a schema is complex/nested enough to need a whole-object example
    rather than per-field `Field(examples=[...])`."""
    extra = schema.model_config.get('json_schema_extra')
    example = extra.get('example') if isinstance(extra, dict) else None
    assert example is not None, (
        f"{schema.__name__} has no model_config json_schema_extra 'example' to check -- "
        f"either add one or don't call this helper for it"
    )
    assert_matches_schema(example, schema)
