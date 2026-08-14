import json
from decimal import Decimal
from typing import Annotated, Union, get_args, get_origin

from drf_spectacular.utils import inline_serializer
from pydantic import BaseModel, WithJsonSchema
from rest_framework import serializers

_FIELD_MAP = {
    str: serializers.CharField,
    int: serializers.IntegerField,
    float: serializers.FloatField,
    bool: serializers.BooleanField,
}


def _decimal_field_kwargs(info) -> dict:
    """Pydantic's Field(max_digits=..., decimal_places=...) constraints on a
    Decimal field live in FieldInfo.metadata, not as named attributes,
    so the derived DecimalField carries the same precision as what actually
    validates the request."""
    for meta in info.metadata:
        if hasattr(meta, 'max_digits') and hasattr(meta, 'decimal_places'):
            return {'max_digits': meta.max_digits, 'decimal_places': meta.decimal_places}
    return {}


def _unwrap_optional(annotation):
    if get_origin(annotation) is Union:
        args = [a for a in get_args(annotation) if a is not type(None)]
        if args:
            return args[0]
    return annotation


def _is_upload_field(annotation) -> bool:
    """True if annotation is an Annotated[...] type tagged
    WithJsonSchema({'format': 'binary', ...}). Detected via the tag, not the type name, so any
    similarly-tagged type is recognized too."""
    if get_origin(annotation) is not Annotated:
        return False
    return any(
        isinstance(meta, WithJsonSchema) and (meta.json_schema or {}).get('format') == 'binary'
        for meta in get_args(annotation)[1:]
    )


def _list_item_model(annotation):
    """Returns the item BaseModel class if annotation is List[SomeModel], else None."""
    annotation = _unwrap_optional(annotation)
    if get_origin(annotation) is list:
        (item_type,) = get_args(annotation)
        item_type = _unwrap_optional(item_type)
        if isinstance(item_type, type) and issubclass(item_type, BaseModel):
            return item_type
    return None


def _list_item_is_upload(annotation) -> bool:
    """True if annotation is List[UploadFile] (or List of any similarly-tagged type)."""
    annotation = _unwrap_optional(annotation)
    if get_origin(annotation) is list:
        (item_type,) = get_args(annotation)
        return _is_upload_field(item_type)
    return False


def _json_example_for(item_model) -> str | None:
    """Builds a one-item JSON-encoded example list from item_model's own
    Field(examples=[...]) metadata -- so a multipart field's example can't go
    stale relative to the real nested schema it's JSON-encoding."""
    example = {}
    for field_name, info in item_model.model_fields.items():
        if info.examples:
            example[field_name] = info.examples[0]
    return json.dumps([example]) if example else None


def request_serializer_from_schema(schema_cls, *, name: str, overrides: dict = None, extra_fields: dict = None):
    """Auto-derive a documentation-only DRF serializer (for @extend_schema's
    multipart request=) directly from the Pydantic schema that actually
    validates the request, so the two can't drift apart.

    `overrides` supplies per-field {'description': ..., 'required': ...} --
    business-rule prose has no source of truth to derive from. Pass a full
    `serializers.Field` instance instead of a dict to replace a field's
    auto-derivation entirely.

    `extra_fields` adds fields with no Pydantic counterpart at all.

    Field keys in the generated serializer use the Pydantic field's `alias`
    when it has one, not its Python attribute name -- multipart clients send
    the wire name, and docs describing the Python name instead would just be a different flavor
    of the same drift this helper exists to close."""
    overrides = overrides or {}
    extra_fields = extra_fields or {}
    fields = {}

    for field_name, info in schema_cls.model_fields.items():
        wire_name = info.alias or field_name
        extra = overrides.get(field_name, {})
        if isinstance(extra, serializers.Field):
            fields[wire_name] = extra
            continue

        required = extra.get('required', info.is_required())
        description = extra.get('description', '')

        if _is_upload_field(_unwrap_optional(info.annotation)):
            fields[wire_name] = serializers.FileField(required=required, help_text=description)
            continue

        if _list_item_is_upload(info.annotation):
            fields[wire_name] = serializers.ListField(
                child=serializers.FileField(), required=required, help_text=description,
            )
            continue

        item_model = _list_item_model(info.annotation)
        if item_model is not None:
            example = _json_example_for(item_model)
            if example:
                description = f"{description} Example: {example}".strip()
            fields[wire_name] = serializers.CharField(required=required, help_text=description)
            continue

        py_type = _unwrap_optional(info.annotation)
        if not description and info.examples:
            description = f"e.g. {info.examples[0]!r}"

        if py_type is Decimal:
            decimal_kwargs = _decimal_field_kwargs(info)
            if decimal_kwargs:
                fields[wire_name] = serializers.DecimalField(
                    required=required, help_text=description, **decimal_kwargs,
                )
                continue

        drf_field_cls = _FIELD_MAP.get(py_type, serializers.CharField)
        fields[wire_name] = drf_field_cls(required=required, help_text=description)

    fields.update(extra_fields)
    return inline_serializer(name=name, fields=fields)
