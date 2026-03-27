from django.db.models import Q, F

from typing import Any
from datetime import datetime

_DT_FORMATS = [
    "%d.%m.%YT%H:%M",
    "%d.%m.%YT%H",
    "%d.%m.%Y"
]

def _is_datetime(value):
    for dt in _DT_FORMATS:
        try:
            return datetime.strptime(value, dt)
        except ValueError:
            pass
    return value

OP_MAP = {
    "eq": lambda field, value: Q(**{field: value}),
    "neq": lambda field, value: ~Q(**{field: value}),
    "gt": lambda field, value: Q(**{f"{field}__gt": value}),
    "gte": lambda field, value: Q(**{f"{field}__gte": value}),
    "lt": lambda field, value: Q(**{f"{field}__lt": value}),
    "lte": lambda field, value: Q(**{f"{field}__lte": value}),
    "in": lambda field, value: Q(**{f"{field}__in": value}),
    "not_in": lambda field, value: ~Q(**{f"{field}__in": value}),
}

# --- Build filter recursively (and/or/not) ---
def build_filter(f_json: dict[str, Any]) -> Q:
    if "and_" in f_json:
        q = Q()
        for sub in f_json["and_"]:
            q &= build_filter(sub)
        return q
    elif "or_" in f_json:
        q = Q()
        for sub in f_json["or_"]:
            q |= build_filter(sub)
        return q
    else:
        # simple comparison
        value = f_json["value"]

        if isinstance(value, dict) and "field" in value:
            value = F(value["field"])
        else:
            value = _is_datetime(value)

        return OP_MAP[f_json["op"]](f_json["field"], value)