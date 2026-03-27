from django.db.models import Q

from DSL.utils.aggregate import apply_aggregate
from DSL.utils.compute import apply_computed_fields
from DSL.utils.filter import build_filter

def build_queryset_from_json_dsl(queryset, query_json, dataset_sources):
    computed_fields_json = query_json.get("computed_fields", {}) or {}
    aggregates_json = query_json.get("aggregates", {}) or {}
    select_fields = query_json.get("select") or []
    agg_keys = set(aggregates_json.keys())

    # -------------------------
    # 0. Filter null rows (Optimized)
    # -------------------------
    null_filter_paths = set()
    source_list = select_fields if select_fields else dataset_sources
    
    for field in source_list:
        if field in agg_keys:
            continue
            
        parts = field.split('__')
        for i in range(1, len(parts)):
            path = '__'.join(parts[:i])
            null_filter_paths.add(f"{path}__isnull")

    if null_filter_paths:
        null_filters = {path: False for path in null_filter_paths}
        queryset = queryset.filter(**null_filters)

    # -------------------------
    # 1. Computed fields
    # -------------------------
    queryset = apply_computed_fields(queryset, computed_fields_json)

    # -------------------------
    # 2. WHERE
    # -------------------------
    if query_json.get("filter"):
        queryset = queryset.filter(build_filter(query_json["filter"]))

    if query_json.get("exclude"):
        queryset = queryset.exclude(build_filter(query_json["exclude"]))

    # -------------------------
    # 3. SELECT
    # -------------------------
    if select_fields:
        queryset = queryset.values(*[s for s in select_fields if s not in agg_keys])
    else:
        queryset = queryset.values(
            *dataset_sources,
            *computed_fields_json.keys()
        )

    # -------------------------
    # 4. AGGREGATES (annotate ONLY)
    # -------------------------
    if aggregates_json:
        queryset = apply_aggregate(
            queryset,
            aggregates_json
        )

    # -------------------------
    # 5. HAVING (filter after annotate)
    # -------------------------
    if query_json.get("having"):
        having_q = Q()
        having = query_json["having"]

        if isinstance(having, list):
            for h in having:
                having_q &= build_filter(h)
        else:
            having_q = build_filter(having)

        queryset = queryset.filter(having_q)
    
    # -------------------------
    # 6. ORDER BY
    # -------------------------
    if query_json.get("sort"):
        order_by_fields = []
        for s in query_json["sort"]:
            prefix = "-" if s["direction"] == "desc" else ""
            order_by_fields.append(prefix + s["field"])
        queryset = queryset.order_by(*order_by_fields)

    return queryset