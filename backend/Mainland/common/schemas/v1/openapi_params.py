from typing import Union, get_args, get_origin

from drf_spectacular.utils import OpenApiExample, OpenApiParameter

from common.utils.extend import extendable_fields, sample_value

_TYPE_MAP = {int: int, str: str, float: float, bool: bool}


def _unwrap_optional(annotation):
    if get_origin(annotation) is Union:
        args = [a for a in get_args(annotation) if a is not type(None)]
        if args:
            return args[0]
    return annotation


def _openapi_examples(name: str, raw_examples: list | None) -> list[OpenApiExample] | None:
    """Wraps a Pydantic FieldInfo.examples list (plain values) into the
    OpenApiExample objects OpenApiParameter.examples expects."""
    if not raw_examples:
        return None
    return [
        OpenApiExample(name=f"{name}_{i}" if len(raw_examples) > 1 else name, value=v)
        for i, v in enumerate(raw_examples)
    ]


def params_from_schema(
    schema_cls, overrides: dict[str, dict] = None, exclude: set[str] = None
) -> list[OpenApiParameter]:
    """Auto-derive OpenApiParameter name/type/required/examples from a Pydantic
    GET-schema's fields, so renaming/retyping a query param only needs editing
    once. `overrides` supplies the hand-written prose (description) and any other
    per-field OpenApiParameter kwargs keyed by field name -- descriptions have no
    source of truth to derive from, so they stay curated. Scope: GET-schema/
    pagination fields only. Params sourced from a django-filter FilterSet (status,
    q, *_count__gt, ...) are unrelated to this helper and stay hand-declared.
    `exclude` skips fields handled by a different helper instead -- 
    e.g. `extend`, which gets its allowed-field-list description
    from params_from_extendable()."""
    overrides = overrides or {}
    exclude = exclude or set()
    params = []
    for name, info in schema_cls.model_fields.items():
        if name in exclude:
            continue
        py_type = _TYPE_MAP.get(_unwrap_optional(info.annotation), str)
        extra = overrides.get(name, {})
        params.append(OpenApiParameter(
            name=name,
            type=extra.get('type', py_type),
            required=extra.get('required', info.is_required()),
            description=extra.get('description', ''),
            examples=extra.get('examples', _openapi_examples(name, info.examples)),
        ))
    return params


def params_from_pagination(pagination_cls, overrides: dict[str, dict] = None) -> list[OpenApiParameter]:
    """Auto-derive the page/page_size OpenApiParameters from a pagination class's
    own attrs -- for list endpoints with no Pydantic GET-schema (e.g. plain
    page-number-only listings). `overrides` works like params_from_schema's."""
    overrides = overrides or {}
    page_param = pagination_cls.page_query_param
    size_param = pagination_cls.page_size_query_param
    max_size = getattr(pagination_cls, 'max_page_size', None)
    default_size = getattr(pagination_cls, 'page_size', None)

    page_extra = overrides.get(page_param, {})
    size_extra = overrides.get(size_param, {})
    default_size_desc = (
        f"Items per page (1-{max_size}, default {default_size})." if max_size else "Items per page."
    )
    return [
        OpenApiParameter(
            name=page_param, type=int, required=False,
            description=page_extra.get('description', "1-indexed page number."),
        ),
        OpenApiParameter(
            name=size_param, type=int, required=False,
            description=size_extra.get('description', default_size_desc),
        ),
    ]


def params_from_extendable(item_schema_cls, *, description: str = None) -> OpenApiParameter:
    """Auto-derive the `extend` query param's description from `item_schema_cls`'s own
    Union-typed fields, instead of hand-copying the field list per endpoint."""
    allowed = sorted(extendable_fields(item_schema_cls))
    default_desc = (
        f"Comma-separated field names to return in full instead of ref shape. "
        f"Allowed: {', '.join(allowed)}." if allowed
        else "No extendable fields on this endpoint's response."
    )
    return OpenApiParameter(
        name='extend', type=str, required=False,
        description=description or default_desc,
    )


def extend_examples(response_schema_cls) -> list[OpenApiExample]:
    """Two named example scenarios for an extend-eligible endpoint's response
    envelope -- "Default (ref shapes)" and "Extended (full shapes)" -- rendered by
    Swagger UI as a selectable dropdown in the "Example Value" panel."""
    return [
        OpenApiExample('Default (ref shapes)', value=sample_value(response_schema_cls), response_only=True),
        OpenApiExample('Extended (?extend=... -- full shapes)', value=sample_value(response_schema_cls, full=True), response_only=True),
    ]
