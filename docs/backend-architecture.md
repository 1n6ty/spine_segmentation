# Backend architecture

Django 6 project at `backend/Mainland`, served by Gunicorn with the Uvicorn ASGI worker (so both regular HTTP views and WebSocket consumers run in the same process). Three Django apps matter for the frontend integration: `Core` (auth), `Dicom` (DICOM ingestion + AI segmentation), `DSL` (a generic, schema-driven query API). MySQL is the database, Redis backs both Channels (WebSocket pub/sub) and Celery (the task queue), and a separate `mainland-celery` container runs the actual segmentation worker.

All paths below are grounded by reading the source directly — except `Dicom/utils/`, which contains the DICOM-parsing and YOLO postprocessing internals and was deliberately left unread per repo policy. Where a view or task imports from `Dicom.utils`, only the import/call site is described, not the implementation.

## Apps

### `Core` — auth
- `POST /api/login` (`Core/v1/views/auth.py`, `AuthViewSet.login`): validates `{username, password, remember_me}` (`Core/v1/schemas/auth.py`, a pydantic model — both fields must be present together or both absent), then calls Django's `authenticate()`/`login()`. `remember_me: "true"` extends the session to `API_MANIFEST["session"]["extended_expiration_time"]`. No richer profile model exists — this is the stock Django `User` table.
- `POST /api/logout`: calls Django's `logout()`, clearing the session.
- `GET /api/health`: liveness check, used by the `mainland` container's Docker healthcheck.
- `REST_FRAMEWORK` doesn't set `DEFAULT_PERMISSION_CLASSES`, so every endpoint defaults to DRF's `AllowAny` unless a view explicitly overrides it. As of the media-storage work below, exactly one does: `Dicom`'s new `GET /api/dcm/<sop_uid>/file/` requires `IsAuthenticated`. Everything else (`Core`, `Dicom`'s other endpoints, `DSL`) is still open.

### `Dicom` — ingestion + AI segmentation
Models (`Dicom/models.py`): `Patient` → `Study` → `Series` → `DicomImage`, a denormalized hierarchy mirroring DICOM's own structure. Notable fields:
- `Study.physician_name` is a plain string copied from DICOM metadata — **not** a link to a Django `User`. There is no ownership relationship between logged-in users and patients/studies anywhere in the schema.
- `DicomImage.reference_points` (`JSONField`) stores the AI segmentation result: `{"vertebraes": [{"name": str, "points": [[x, y], ...]}, ...]}`.
- `DicomImage` also carries per-image metadata (`rows`, `cols`, `mm_per_pixel`, `window_center`, `window_width`, `slope`, `intercept`, `is_signed`) and the actual file (`dicom_file`, `file_hash`) — populated by `parse_and_store_dicom()` inside the forbidden `Dicom/utils/parse.py`, not read here.
- `dicom_file` is backed by `storage=storages["private"]` (`common/storages.py`'s `PrivateMediaStorage`, an `S3Boto3Storage` pointed at the `media-private` MinIO bucket) — see "Media storage" below for how this is actually served, since it's never a direct or presigned URL.

Endpoints (`Dicom/v1/views/dcmparse.py`):
- `POST /api/dcm/parse`, multipart field `file`. Validates the upload (`Dicom/v1/schemas/dcmparse.py`'s `Parse_POST_schema`), then awaits `parse_and_store_dicom(file)` — implementation in the forbidden utils, but from the call site this is what creates/updates `Patient`/`Study`/`Series`/`DicomImage` rows and (per the Celery task below) triggers segmentation.
- `GET /api/dcm/<sop_uid>/file/` *(new)* — the only endpoint in this project that actually requires `IsAuthenticated`. Looks up the `DicomImage` by SOP Instance UID, then returns an empty-bodied response with `X-Accel-Redirect: /internal/media-private/<dicom_file.name>` — nginx intercepts this and streams the bytes from MinIO itself; Django never buffers the file. See "Media storage" below.

## Media storage

Two MinIO buckets, both accessed by the Django app at `minio-proxy:9000` (never `minio:9000` directly) — see [dev-infrastructure.md](dev-infrastructure.md) for the MinIO/MinIOProxy services themselves.

- **`media-public`** (`common.storages.PublicMediaStorage`, Django's `default` storage) — served to the browser via `backend/Nginx/nginx.conf`'s `location /media/public/ { proxy_pass http://minio-proxy:9000/media-public/; }`. No auth, same URL shape (`/media/public/...`) as before this bucket existed (it used to be a local volume `alias`).
- **`media-private`** (`common.storages.PrivateMediaStorage`, Django's `private` storage, used by `DicomImage.dicom_file`) — **never** exposed via a direct or presigned MinIO URL. Served exclusively through the new `GET /api/dcm/<sop_uid>/file/` view's `X-Accel-Redirect`, which nginx only honors via an `internal;`-marked location (`/internal/media-private/`) — a request to that path made directly by a client (not via X-Accel-Redirect) is rejected by nginx itself, not just by application-level checks.
- `Dicom/tasks/segmentation.py` reads the DICOM file via `dicom_file.open('rb')`, not `dicom_file.path` — `FieldFile.path` is a local-filesystem-only API that `S3Boto3Storage` doesn't implement.

Background task (`Dicom/tasks/segmentation.py`, queue `segmentation`):
```
segment_vertebraes(sop_instance_uid: str)
```
- Loads the `DicomImage`, reads the `.dcm` file via `pydicom`, normalizes pixel data (rescale slope/intercept, then DICOM windowing or min-max fallback to 8-bit).
- Sends a `{"status": "segmentation.processing", "ref_points": null}` event to the Channels group `Dicom.segment.{sop_instance_uid}`.
- Calls `segment_spine_from_S1_to_C2(...)` from the forbidden `Dicom/utils/segmentation/compose.py`, passing one of two pre-loaded YOLO segmentation models (`yolo26m-seg-sag.pt` for `sagittal`, `yolo26m-seg-fro.pt` for `frontal`) — model selection and postprocessing internals are not read.
- Sends `{"status": "saving", "ref_points": null}`.
- Writes the result to `DicomImage.reference_points` and sends `{"status": "done", "ref_points": {"vertebraes": [...]}}`.
- This task's invocation site (inside `Dicom/utils/parse.py`) wasn't read, but the WebSocket protocol below assumes it fires once per successfully parsed image.

WebSocket (`Dicom/v1/ws_consumers/segmentation.py`, routed in `Dicom/v1/ws_urls.py`):
```
ws/dcm/(?:v1/)?segment/(?P<sop_uid>[\w.]+)/
```
`SegmConsumer` joins the same `Dicom.segment.{sop_uid}` group and just relays whatever the Celery task broadcasts, wrapped in the project's standard `ApiResponse` envelope. The ASGI app (`Mainland/asgi.py`) wraps the WebSocket router in Channels' `AuthMiddlewareStack`, which populates `scope["user"]` — but **the consumer never checks `is_authenticated`**: `WSConsumer.connect_wrapper()` (`common/mixins/v1/ws_consumer.py`) only reads `self.scope["user"].pk` to build Redis presence keys, and `AnonymousUser.pk` is simply `None`. So an anonymous connection is accepted, not rejected — it's tracked under a shared `wb:user:None:groups` bucket instead of a real user's. **In practice, this WebSocket is not actually auth-gated today**, despite being wrapped in `AuthMiddlewareStack`. See [doctor-profile.md](doctor-profile.md) for what this means for the frontend.

### `DSL` — generic dataset query API
`POST /api/dsl/select/` (`DSL/v1/views/dsl.py`) is a schema-driven query endpoint: `{dataset, filter, select, sort, pagination, aggregates, computed_fields, having}`, validated against a per-dataset field allowlist (`DSL/v1/schemas/dsl.py`) and executed via a JSON→ORM query builder (`DSL/utils/dsl.py`). Not a stub — fully implemented, also open (`AllowAny`, dataset `permissions=[]`).

The dataset relevant to autofill is `dicom_images` (`DSL/datasets/dicom_images.py`), a flat view over `DicomImage`:

| DSL field | source column | type |
|---|---|---|
| `sop_uid` | `sop_instance_uid` | string |
| `ref_points` | `reference_points` | json |
| `projection`, `rows`, `cols`, `mm_per_pixel`, `window_center`, `window_width`, `dicom_file_path` | (same name / `dicom_file`) | — |

The frontend's cache-check (see [autofill-integration.md](autofill-integration.md)) queries this with `{dataset: "dicom_images", select: ["ref_points"], filter: {field: "sop_uid", op: "eq", value: <uid>}}`.

## Routing summary

- `backend/Mainland/Mainland/urls.py`: `/api/dsl/`, `/api/dcm/`, and `/api/` (Core, unprefixed) → each app's `v1/urls.py`, which exposes itself at both `/api/<app>/v1/...` and `/api/<app>/...` (i.e. the `v1/` prefix is optional). `/api/schema/` and `/api/schema/swagger-ui/` are drf-spectacular's OpenAPI docs.
- Anything not matching `/api/`, `/admin/`, or static/media is routed to `Mainland/pages.py:index`, which renders the SPA's `index.html` for any `<lang>` path Django's `API_MANIFEST["supported_languages"]` recognizes (404 otherwise) — this is how the Django server hosts the built SvelteKit SPA (see [build-and-deploy.md](build-and-deploy.md)).
- `Mainland/asgi.py` / `Mainland/ws_urls.py` route `ws/dcm/...` to the segmentation consumer above.

## Settings (`Mainland/settings/`)

No longer a single `settings.py` — now a package, selected by `DJANGO_ENV` (`prod`/`dev`/`test`, default `prod`) via `Mainland/settings/__init__.py`:
- `base.py` — apps, middleware, URLs, templates, DRF/Spectacular config; imports everything under `modules/`.
- `dev.py` / `prod.py` / `test.py` — environment-specific overrides (`prod.py` adds `SECURE_HSTS_*` hardening that didn't exist before; `test.py` swaps in in-memory SQLite/cache so tests never touch MySQL/Redis/MinIO).
- `modules/{auth,database,storage,security,logging,celery,cron}.py` — one file per concern. `database.py` holds `DATABASES` (routed through ProxySQL), `CACHES` (`django_redis`, two aliases: `default` and `session_cache`, backing Django's cache and cache-backed sessions respectively — sessions used to be DB-backed), and the real `REDIS`/`SYNC_REDIS` clients + `CHANNEL_LAYERS` (all pointed at the `redis-cache` instance via `redis-proxy`). `storage.py` holds the MinIO/`STORAGES` config from the media-storage section above.

`SESSION_COOKIE_SECURE = True` and `CSRF_COOKIE_SECURE = True` (`modules/security.py`) are set unconditionally — both cookies are only ever sent over HTTPS. Combined with `SESSION_EXPIRE_AT_BROWSER_CLOSE = True` and no `remember_me`, sessions also don't survive closing the browser. Over plain HTTP, login will appear to succeed (200 response) but no session cookie will ever actually be set or sent back on later requests. `modules/security.py` also now sets `SECURE_PROXY_SSL_HEADER`/`USE_X_FORWARDED_HOST`/`USE_X_FORWARDED_PORT` — needed now that Traefik terminates TLS in front of nginx, which didn't exist as a concern before.

## `common/` structure

Restructured from flat files into subpackages, mirroring lambumiz-plus's layout: `schemas/v1/{response.py, errors.py}` (the `ApiResponse`/`Issue` envelope, plus new pre-typed 401/403/405/400 response schemas for OpenAPI docs), `exceptions/{permission.py, http.py}`, `mixins/v1/{viewset.py, ws_consumer.py}` (`StdViewSet` and `WSConsumer`, kept under their original names), `utils/ws_consumer.py` (the plain Redis presence-tracking helper functions, split out from the consumer class itself), `permissions/__init__.py` (`IsStaff`/`CanViewUserPermission`, both still unused anywhere — confirmed via grep, not newly dead), and the new `storages.py` from the media-storage section above.
