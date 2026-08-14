# WebSockets / Presence

**No app currently registers a WS consumer** — `Mainland/ws_urls.py`'s `websocket_urlpatterns` is
an empty list. Channels/ASGI infrastructure is wired and real (below), just dormant; Dicom's
segmentation-status push was migrated from a WS consumer to SSE (`Dicom/v1/views/dcmparse.py`'s
`events` action) — see `docs/gotchas.md` and `patterns/celery.md` for how that actually works
today. Everything below is real infrastructure ready for the next consumer, not a documented
in-use pattern.

`common/mixins/v1/ws_consumer.py`'s `WSConsumer` is the base class any future Channels consumer
needing per-user connection limits and presence tracking would subclass. It stores two real Redis
**sets**, reached via `django_redis.get_redis_connection("default")` — the connection already
configured for `CACHES["default"]`, not a separately maintained client:

| Purpose | Key | Ops |
|---|---|---|
| Groups a user is currently connected to (enforces `API_MANIFEST["limits"]["ws_connections_count_max"]` via `SCARD`) | `ws:user:{uid}:groups` | `SADD`/`SREM`/`SCARD` |
| Users currently present in a group | `{group_name}:presence` | `SADD`/`SREM`/`SMEMBERS`/`SCARD`/`SISMEMBER` |

`django_redis`'s client is synchronous, so every call is wrapped in `sync_to_async`. Presence is
exact set membership (not a TTL heartbeat) — it relies on Channels always calling `disconnect()`.

**Auth**: `Mainland/asgi.py`'s websocket route is plain `AuthMiddlewareStack(URLRouter(...))` —
session-cookie auth only, no custom token bridge.

**A consumer that needs its own pre-accept validation** (auth, lookup, permission checks) should do
that in a plain `connect()` method and only call into a separate
`@WSConsumer.connect_wrapper()`-decorated helper once every check passes — the wrapper itself
unconditionally registers presence and calls `self.accept()`.

**Lazy imports required in `asgi.py`/`ws_urls.py`:** both files are imported by an ASGI server
before `get_asgi_application()` runs (which is what triggers `django.setup()`), so anything they
import at module level — including transitively — must not touch Django models at import time.

**WS URL routing convention (once an app has one)**: `/ws/` prefix mirroring REST's `/api/`
prefix, plus the same app-ownership + `v1/`-and-bare double-mount as `patterns/urls.md` describes
for REST, using Channels' nested-`URLRouter` prefix mechanism — add one
`re_path(r'^<entity>/', URLRouter(<app>_ws_urlpatterns))` line to `Mainland/ws_urls.py`, exactly
like adding one line to `Mainland/urls.py`'s `api_urlpatterns`.

**Nginx must terminate the WS Upgrade handshake for `/ws/` to work through the proxy** —
`backend/Nginx/templates/api.conf.template` has a dedicated `location /ws/` block with
`proxy_http_version 1.1;` and the `Upgrade`/`Connection` headers. Without this, every WS connection
through the proxy silently breaks.

**Test-tier note:** both the Mocked and Docker tiers keep `CACHES["default"]["BACKEND"]` on
`django_redis.cache.RedisCache` — Mocked backs it with an in-process `fakeredis`
(`common/testing/redis.py::FakeConnectionFactory`), Docker with real Redis — so
`get_redis_connection("default")` works, and presence/set assertions would run, in both tiers. See
`docs/testing.md`'s Test Tiers table.

**Swagger docs for WS methods** — see `docs/openapi.md`'s "Documenting WebSocket Consumers"
section (also currently no real example, same reason).
