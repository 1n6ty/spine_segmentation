# Pagination

Every list endpoint's pagination class subclasses `common/paginations/base.py`'s
`BaseAsyncPagination`, which carries the shared `paginate_queryset`/`get_paginated_response`
boilerplate. A concrete class sets `page_size`/`max_page_size`/`items_key` (the response
envelope's data key, e.g. `"orders"`) and overrides `serialize_page()`:

```python
from asgiref.sync import sync_to_async

from common.paginations.base import BaseAsyncPagination
from common.schemas.v1.domain.user import User_Item_Schema

class Profiles_Pagination(BaseAsyncPagination):
    page_size = 10
    max_page_size = 100
    items_key = 'profiles'
    extend: frozenset = frozenset()  # threaded in by the view, see extend.md

    async def serialize_page(self, data) -> list:
        return await sync_to_async(
            lambda: [User_Item_Schema.from_model(u, extend=self.extend).model_dump() for u in data]
        )()
```

(Real example, adapted from `Profile/v1/paginations/profiles.py`'s `Profiles_Pagination` —
`Company/v1/paginations/company.py`'s `Companies_Pagination` is the other real instance.)

`serialize_page()` defaults to the identity — only override it if the view doesn't already hand
`get_paginated_response()` pre-serialized dicts. Wrap it in `sync_to_async` when `from_model`
touches lazy relations (see `serialization.md`'s N+1 note); a plain sync list comprehension is fine
when every field is already prefetched/annotated.

- One paginator class per list endpoint in `<App>/v1/paginations/`
- Response includes `meta` key: `total_items`, `total_pages`, `current_page`, `page_size`, `next`,
  `previous`
- Out-of-range pages already return a custom 404 `ApiResponse` via the base class — no
  per-subclass handling needed

## Cursor pagination

`common/paginations/cursor.py`'s `BaseCursorPagination` exists but has zero real subclasses in
this codebase today — no list endpoint currently needs "give me the latest N" / "give me items
older than X" semantics instead of numbered pages. Kept for the day one does. It carries the same
shape of contract as `BaseAsyncPagination` (an `extend` attribute, a `serialize_page()` hook, a
`meta` + `items_key` envelope) but paginates via `limit`/`before` (a PK cursor) rather than page
number:

```python
from common.paginations.cursor import BaseCursorPagination

class Example_Cursor_Pagination(BaseCursorPagination):
    items_key = 'items'
    default_limit = 20
    max_limit = 100

    async def serialize_page(self, data) -> list:
        return [Example_Item_Schema.from_model(o, extend=self.extend).model_dump() for o in data]
```

- A concrete class sets `items_key` and `max_limit` (or overrides `get_max_limit()`) and
  overrides `serialize_page()` — `default_limit` defaults to 20 unless overridden.
- Response `meta` key is `limit`, `has_more`, `next_before` (the PK to pass as the next page's
  `before`) — not `total_items`/`total_pages`/`current_page`/`next`/`previous`, since cursor
  pagination has no concept of a total count or page number.
- `paginate_queryset(queryset, limit, before)` takes `limit`/`before` directly rather than DRF's
  `(request, view)` — the calling view instantiates the paginator and calls it explicitly, same as
  `BaseAsyncPagination` callers do, rather than relying on DRF's automatic list-pagination hook.
