def postprocess_schema_nullable(result, generator, **kwargs):
    """
    Convert Pydantic v2's anyOf:[{$ref/$type}, {type:null}] pattern to
    OpenAPI 3.0.3 nullable:true form that Swagger UI can expand properly.

    Pydantic v2 always emits Optional[X] as anyOf:[X, {type:null}].
    That is valid in OpenAPI 3.1 but not 3.0.3, where nullable is expressed via
    the nullable:true keyword.  Swagger UI's legacy (pre-3.1) renderer renders
    the anyOf form as unexpandable, which is why this hook exists at all.

    No-op under OAS_VERSION 3.1 (see SPECTACULAR_SETTINGS in settings/base.py):
    pydantic's native anyOf:[X, {type:null}] form is already correct, idiomatic
    JSON Schema 2020-12 there, and Swagger UI's isOAS31()-gated renderer (the
    same one that gives Union[Ref, Item] fields an interactive expand/collapse
    toggle -- see docs/gotchas.md) understands it natively. Rewriting to
    nullable:true under 3.1 would produce a non-compliant document instead.
    """
    from drf_spectacular.settings import spectacular_settings
    if spectacular_settings.OAS_VERSION.startswith('3.1'):
        return result

    _NULL = {'type': 'null'}

    def _fix(node):
        if isinstance(node, list):
            for item in node:
                _fix(item)
            return

        if not isinstance(node, dict):
            return

        # Recurse into children before rewriting this node so inner Optional
        # fields (e.g. inside ApprovedVersion_Item_Schema) are fixed first.
        for val in list(node.values()):
            _fix(val)

        any_of = node.get('anyOf')
        if not isinstance(any_of, list):
            return

        null_variants = [i for i in any_of if i == _NULL]
        non_null_variants = [i for i in any_of if i != _NULL]

        if not null_variants or not non_null_variants:
            return

        # Build replacement without anyOf key
        replacement = {k: v for k, v in node.items() if k != 'anyOf'}
        replacement['nullable'] = True

        if len(non_null_variants) == 1:
            solo = non_null_variants[0]
            if '$ref' in solo:
                replacement['allOf'] = [solo]
                # Remove default:null so Swagger UI resolves the $ref example
                # instead of short-circuiting to the null literal.
                replacement.pop('default', None)
            else:
                replacement.update(solo)
        else:
            replacement['anyOf'] = non_null_variants

        node.clear()
        node.update(replacement)

    _fix(result)
    return result
