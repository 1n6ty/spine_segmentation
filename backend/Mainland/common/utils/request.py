def as_plain_dict(data) -> dict:
    """Normalize request.data to a plain dict before **-unpacking into a Pydantic
    schema. For a JSON body, request.data is already a plain dict. For
    multipart/form-data, it's a QueryDict -- **-unpacking a QueryDict directly
    yields list-wrapped values (its dict storage is list-valued internally), so
    it must go through .dict() first, which collapses each key to its last
    scalar value."""
    return data.dict() if hasattr(data, 'dict') else data
