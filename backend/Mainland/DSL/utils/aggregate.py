from django.db.models import Sum, Min, Max, F, Value, Count, Aggregate, CharField, JSONField

class _GroupConcat(Aggregate):
    function = "GROUP_CONCAT"
    allow_distinct = True
    output_field = CharField()

    def __init__(self, expression, separator=",", distinct=False, **extra):
        self.separator = separator
        super().__init__(expression, distinct=distinct, **extra)

    def as_sql(self, compiler, connection, **extra_context):
        extra_context["separator"] = f"'{self.separator}'"
        return super().as_sql(compiler, connection, **extra_context)

class _JSONArrayAgg(Aggregate):
    function = "JSON_ARRAYAGG"
    template = "%(function)s(%(expressions)s)"
    output_field = JSONField()

AGGREGATE_OP = {
    'sum': lambda field, args: Sum(F(field) if field else Value(1)),
    'count': lambda field, args: Count(F(field) if field else Value(1)),
    'avg': lambda field, args: Sum(F(field) if field else Value(1)) / Count(F(field) if field else Value(1)),
    'min': lambda field, args: Min(F(field)),
    'max': lambda field, args: Max(F(field)),
    "group_concat": lambda field, args: _GroupConcat(F(field), args[0], distinct=("distinct" in args)),
    "json_concat": lambda field, args: _JSONArrayAgg(F(field), distinct=("distinct" in args))
}

def apply_aggregate(queryset, aggregates_json):
    agg_annotations = {}
    for name, agg_def in aggregates_json.items():
        field = agg_def.get("field")
        op = agg_def.get('op')
        args = agg_def.get('args', []) or []
        
        if not op:
            raise ValueError(f"Operator must be provided")
        if not (op in list(AGGREGATE_OP.keys())):
            raise ValueError(f"Unsupported aggregate {op}")
        
        agg_annotations[name] = AGGREGATE_OP[op](field, args)
        
    if agg_annotations:
        queryset = queryset.annotate(**agg_annotations)
    
    return queryset