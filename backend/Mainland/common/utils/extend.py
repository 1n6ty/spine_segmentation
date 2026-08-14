from typing import Union, get_args, get_origin

from pydantic import BaseModel
from pydantic_core import PydanticUndefined


def _is_extendable_union(annotation) -> bool:
    """True if annotation is Union[XRef_Schema, XItem_Schema] (or Optional[...] wrapping
    one) -- two BaseModel subclasses, one a subclass of the other."""
    if get_origin(annotation) is not Union:
        return False
    args = [a for a in get_args(annotation) if a is not type(None)]
    if len(args) != 2:
        return False
    a, b = args
    if not (isinstance(a, type) and issubclass(a, BaseModel) and isinstance(b, type) and issubclass(b, BaseModel)):
        return False
    return issubclass(b, a) or issubclass(a, b)


def _list_item(annotation):
    """Returns the item annotation inside a List[...] field, or None."""
    if get_origin(annotation) is list:
        (item,) = get_args(annotation)
        return item
    return None


def _nested_model(annotation):
    """Returns the bare BaseModel class inside Optional[SomeModel] (or SomeModel itself),
    or None if the annotation isn't a single nested model (e.g. it's a Union, a list, or a
    scalar)."""
    if get_origin(annotation) is Union:
        args = [a for a in get_args(annotation) if a is not type(None)]
        if len(args) == 1 and isinstance(args[0], type) and issubclass(args[0], BaseModel):
            return args[0]
        return None
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    return None


def extendable_fields(schema_cls: type[BaseModel]) -> frozenset[str]:
    """Every field name on `schema_cls` that `extend` can resolve to a full shape -- see
    docs/patterns/extend.md. Covers three shapes:
    - `Union[XRef_Schema, XItem_Schema]` (or `Optional[...]` of one) directly on the field.
    - `List[Union[XRef_Schema, XItem_Schema]]`.
    - A field that's itself a plain (non-extendable) nested model whose OWN fields include
      extendable ones -- reported as "field.subfield". 
      Recurses naturally through the schema graph -- no depth cap, bounded by
      how deep the actual schemas nest."""
    fields = set()
    for name, info in schema_cls.model_fields.items():
        annotation = info.annotation
        list_item = _list_item(annotation)
        target = list_item if list_item is not None else annotation
        if _is_extendable_union(target):
            fields.add(name)
            continue
        nested = _nested_model(annotation)
        if nested is not None and nested is not schema_cls and hasattr(nested, 'model_fields'):
            for sub in extendable_fields(nested):
                fields.add(f"{name}.{sub}")
    return frozenset(fields)


def parse_extend_param(raw: str | None, allowed: frozenset[str]) -> frozenset[str]:
    """Parses `extend`'s comma-separated value into a validated set of field names.
    Missing/empty -> empty set. An unknown field name raises ValueError -- call this from
    inside a Pydantic @field_validator so it becomes a 400 the same way every other
    request-validation error does."""
    if not raw:
        return frozenset()
    requested = frozenset(s.strip() for s in raw.split(',') if s.strip())
    unknown = requested - allowed
    if unknown:
        raise ValueError(
            f"Unknown extend field(s): {', '.join(sorted(unknown))}. "
            f"Allowed: {', '.join(sorted(allowed)) or '(none)'}."
        )
    return requested


def sub_extend(extend: frozenset[str], prefix: str) -> frozenset[str]:
    """Slices the portion of a parsed extend set that applies one level deeper, under
    `prefix`."""
    needle = f"{prefix}."
    return frozenset(path[len(needle):] for path in extend if path.startswith(needle))


def sample_value(schema_cls: type[BaseModel], *, full: bool = False):
    """Recursively builds a plain JSON-safe example value from a schema's own
    Field(examples=[...]) declarations -- for composing a literal example on a
    *different* field (e.g. Field(examples=[[...]]) on a List[Union[Ref, Item]]
    field, working around the Swagger UI array-sampling artifact, or a whole response envelope's example (see
    extend_examples() below) -- without hand-duplicating values that are already
    documented on the nested schemas themselves. `full=False` (default) samples
    the Ref variant of any Union[Ref, Item] field, matching the ref-by-default
    behavior; `full=True` samples the Item variant
    instead, and propagates through every nested call so an "extended" example is
    extended all the way down, not just at the top level. Fields with no example,
    no static default, and no nested model to recurse into are omitted from the
    result."""
    sample = {}
    for name, info in schema_cls.model_fields.items():
        if info.examples:
            sample[name] = info.examples[0]
            continue
        annotation = info.annotation
        is_list = get_origin(annotation) is list
        target = _list_item(annotation) if is_list else annotation
        if _is_extendable_union(target):
            args = [a for a in get_args(target) if a is not type(None)]
            a, b = args
            base, item = (a, b) if issubclass(b, a) else (b, a)
            model = item if full else base
        else:
            model = _nested_model(target)
        if model is not None and model is not schema_cls:
            value = sample_value(model, full=full)
            if value:
                sample[name] = [value] if is_list else value
                continue
        if info.default is not PydanticUndefined:
            sample[name] = info.default
    return sample


def extend_field_description(field_name: str) -> str:
    """Field-level doc string for a Union[Ref, Item]-typed (or List[Union[...]]-typed)
    response field -- put this on the field itself via Field(description=...). The `anyOf`
    drf-spectacular generates from the Union type alone doesn't say anything about *when*
    each variant appears; this makes that explicit right where a reader is already looking,
    without duplicating the endpoint-level allowed-field list params_from_extendable()
    already documents on the `extend` query param."""
    return (
        f"Ref shape by default. Full shape when '{field_name}' is included in the "
        f"request's ?extend= parameter -- see docs/patterns/extend.md."
    )
