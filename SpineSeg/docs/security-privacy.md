# Security & privacy

This app handles patient DICOM imagery and demographics (PHI). The autofill flow now sends DICOM bytes to, and queries results from, a real backend (see [../../docs/autofill-integration.md](../../docs/autofill-integration.md)) — manual-only sessions still keep everything client-side. The browser-side storage story below still applies regardless; the access-control section has been updated to reflect both the new frontend login and a real backend-side gap it surfaced.

## PHI storage today

Two separate browser storage mechanisms hold PHI (see [architecture.md](architecture.md) for full detail):

1. **Cache Storage API** (`features/dicom/cache.ts`, `FileCache`) — raw DICOM file bytes, keyed by content hash.
2. **IndexedDB** (`core/session/registry.svelte.ts`, `registry`) — session metadata: patient name/birthdate, thumbnail, polygon annotations. Swept after a 24-hour TTL (`cleanupOldSessions()`).

**Retention bug found during this audit:** the 24-hour TTL sweep (`cleanupOldSessions()`) deletes expired rows from IndexedDB via a cursor, but does **not** call `FileCache.delete()` for the corresponding file hashes. Compare this to `RegistryService.delete()` and `.clearAll()`, which both explicitly delete from `FileCache` after removing the IndexedDB row. The result: a session's raw DICOM file can outlive its 24-hour TTL indefinitely in the Cache Storage API, orphaned with no remaining reference to clean it up. This is a real PHI-retention gap, not just a documentation gap, and should be fixed by having `cleanupOldSessions()` also call `FileCache.delete()` for each expired session's hashes before deleting the row.

Neither storage mechanism encrypts at rest — both are plain browser storage, readable by anything with script execution in the app's origin (i.e. an XSS bug would expose all locally-cached patient data) or by local device/profile access.

## Access control

**Frontend-side, this is now real**, not a no-op: the `login` page submits to the backend's actual session auth, and `(authenticated)/+layout.svelte` redirects to `/login` client-side if no `sessionid` cookie is present (necessarily client-side — this is a static SPA with no server at request time; see [../../docs/doctor-profile.md](../../docs/doctor-profile.md)).

**But this is a UX gate, not a security boundary, and most of the gap underneath it is still open.** Reading the backend directly: `REST_FRAMEWORK` has no `DEFAULT_PERMISSION_CLASSES` override, so every endpoint defaults to DRF's `AllowAny` unless a view overrides it — and as of the MinIO media-storage migration, exactly one does (`GET /api/dcm/<sop_uid>/file/`, the new authenticated DICOM-file endpoint — see [../../docs/backend-architecture.md](../../docs/backend-architecture.md)). The segmentation WebSocket is still wrapped in Channels' `AuthMiddlewareStack` without actually checking `is_authenticated` (`common/mixins/v1/ws_consumer.py`), and **`POST /api/dsl/select/` can still be called directly by anyone and will return `DicomImage.reference_points` and other fields without any login at all.** This remains the highest-priority item before any use with real patient data — it's a precisely-located backend change (add real `permission_classes`/`IsAuthenticated` checks to the remaining open endpoints and the WS consumer), and there's now a working example of exactly that pattern to copy. See [../../docs/backend-architecture.md](../../docs/backend-architecture.md) and [../../docs/doctor-profile.md](../../docs/doctor-profile.md) for the full detail.

## Network/transmission

PHI now does cross the network, for the autofill flow (see [../../docs/autofill-integration.md](../../docs/autofill-integration.md)). Two things worth confirming, both backend/infra-side and outside this audit's direct scope:
- TLS is actually enforced end-to-end (not just configured as an option) for both the HTTP API and the WebSocket — `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE` are unconditionally `True` in `settings.py`, so over plain HTTP the session cookie silently never gets set/sent at all (login looks like it succeeds; nothing persists).
- The access-control gap above (no `IsAuthenticated` anywhere) is closed before this matters for any real patient data.

The CSRF token plumbing in `core/network/csrf.ts` is now actually used — every state-changing request added in this pass (`login`, `logout`, `/api/dcm/parse`, `/api/dsl/select/`) sends `X-CSRFToken` via it.

## What's already done right

The static `report` page (see [diagnostic-pipeline.md](diagnostic-pipeline.md)) carries a clear disclaimer: the report is automatically generated, for educational/screening purposes only, and does not replace a qualified radiologist's or orthopedist's diagnosis. This is good practice and should be preserved — and probably extended to the `measure` page too — once the report becomes dynamic.

## Recommendations before any clinical pilot

1. Fix the `FileCache` orphan-on-TTL-expiry bug above.
2. Add real server-side authorization (`permission_classes`) to the backend's `Core`/`Dicom`/`DSL` viewsets and the segmentation WebSocket consumer — frontend login/route-guarding is done, but every API endpoint is currently `AllowAny` regardless.
3. Define an explicit data-retention policy: how long PHI may live client-side at all, and whether any of it should ever be allowed to outlive the browser session.
4. Confirm TLS is enforced end-to-end once backend transmission resumes.
5. Consider encrypting at rest if PHI is going to persist client-side beyond a single working session, given there is no current encryption layer.
