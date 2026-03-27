from django.db.models import F, Value, ExpressionWrapper, Func, CharField, DateTimeField
from django.db.models.functions import TruncHour, TruncDay, TruncMonth, TruncYear

from typing import Any

class _DateFormat(Func):
    function = "DATE_FORMAT"
    output_field = CharField()

TRUNC_MAP = {
    "hour": TruncHour,
    "day": TruncDay,
    "month": TruncMonth,
    "year": TruncYear,
}

COMPUTE_OP = {
    "mul": lambda expr, a: expr * a,
    "add": lambda expr, a: expr + a,
    "sub": lambda expr, a: expr - a,
    "div": lambda expr, a: expr / a,

    "trunc": lambda field, interval: _DateFormat(
        TRUNC_MAP[interval](field),
        Value("%d.%m.%YT%H:%i")
    )
}

# --- Build computed field ---
def build_computed_field(field_def: dict[str, Any]) -> ExpressionWrapper:
    op = field_def.get("op")
    if not (op in list(COMPUTE_OP.keys())):
        raise ValueError(f"Unsupported operator {op}")

    args = field_def.get("args", [])
    orm_args = []

    for arg in args:
        if isinstance(arg, dict):
            if "op" in arg:
                orm_args.append(build_computed_field(arg))
            elif "field" in arg:
                orm_args.append(F(arg["field"]))
        else:
            if op == "trunc":
                orm_args.append(arg)
            else:
                orm_args.append(Value(arg))

    if op == "trunc":
        expr = COMPUTE_OP[op](orm_args[0], orm_args[1])
    else:
        # simple math operators
        expr = orm_args[0]
        for a in orm_args[1:]:
            expr = COMPUTE_OP[op](expr, a)

    return ExpressionWrapper(expr, output_field=expr.output_field)

def extract_dependencies(field_def, computed_field_names):
    deps = set()

    for arg in field_def.get("args", []):
        if isinstance(arg, dict):
            if "field" in arg and arg["field"] in computed_field_names:
                deps.add(arg["field"])
            elif "op" in arg:
                deps |= extract_dependencies(arg, computed_field_names)

    return deps

def topo_sort_computed_fields(computed_fields):
    field_names = set(computed_fields.keys())
    deps = {
        name: extract_dependencies(defn, field_names)
        for name, defn in computed_fields.items()
    }

    resolved = []
    while deps:
        ready = [k for k, v in deps.items() if not v]
        if not ready:
            raise ValueError("Circular dependency in computed_fields")

        for name in ready:
            resolved.append(name)
            deps.pop(name)
            for v in deps.values():
                v.discard(name)

    return resolved

def apply_computed_fields(queryset, computed_fields):
    if computed_fields:
        order = topo_sort_computed_fields(computed_fields)

        for name in order:
            expr = build_computed_field(computed_fields[name])
            queryset = queryset.annotate(**{name: expr})

    return queryset