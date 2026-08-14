from common.schemas.v1.response import ApiResponse


class BaseCursorPagination:
    """Shared shape for limit/before cursor-paginated list endpoints -- mirrors
    BaseAsyncPagination's contract (extend attribute, serialize_page() hook,
    meta+items_key envelope) for feeds that page by "before: pk" rather than
    page number. Subclasses set default_limit/max_limit/items_key and override
    serialize_page()."""

    default_limit = 20
    max_limit: int = None
    items_key: str = None

    def __init__(self):
        self.limit = self.default_limit
        self.has_more = False
        self.extend: frozenset = frozenset()

    def get_max_limit(self) -> int:
        return self.max_limit

    async def paginate_queryset(self, queryset, limit, before):
        max_limit = self.get_max_limit()
        self.limit = min(limit, max_limit) if limit else self.default_limit
        if before is not None:
            queryset = queryset.filter(pk__lt=before)
        # Fetch one extra row to know whether there's more before the oldest returned row.
        rows = [row async for row in queryset[: self.limit + 1]]
        self.has_more = len(rows) > self.limit
        return rows[: self.limit]

    async def serialize_page(self, data) -> list:
        """Override to turn a page of model instances into a list of dicts.
        Default is the identity."""
        return data

    async def get_paginated_response(self, data):
        items = await self.serialize_page(data)
        return ApiResponse().update_data({
            "meta": {
                "limit": self.limit,
                "has_more": self.has_more,
                "next_before": data[-1].pk if data and self.has_more else None,
            },
            self.items_key: items,
        }).drf_response
