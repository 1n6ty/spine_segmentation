# Security & privacy

This app handles patient DICOM imagery and demographics (PHI) entirely client-side today, with no backend wired up (see [backend-integration.md](backend-integration.md)). That makes the browser-side storage and access-control story the whole story, for now.

## PHI storage today

Two separate browser storage mechanisms hold PHI (see [architecture.md](architecture.md) for full detail):

1. **Cache Storage API** (`features/dicom/cache.ts`, `FileCache`) — raw DICOM file bytes, keyed by content hash.
2. **IndexedDB** (`core/session/registry.svelte.ts`, `registry`) — session metadata: patient name/birthdate, thumbnail, polygon annotations. Swept after a 24-hour TTL (`cleanupOldSessions()`).

**Retention bug found during this audit:** the 24-hour TTL sweep (`cleanupOldSessions()`) deletes expired rows from IndexedDB via a cursor, but does **not** call `FileCache.delete()` for the corresponding file hashes. Compare this to `RegistryService.delete()` and `.clearAll()`, which both explicitly delete from `FileCache` after removing the IndexedDB row. The result: a session's raw DICOM file can outlive its 24-hour TTL indefinitely in the Cache Storage API, orphaned with no remaining reference to clean it up. This is a real PHI-retention gap, not just a documentation gap, and should be fixed by having `cleanupOldSessions()` also call `FileCache.delete()` for each expired session's hashes before deleting the row.

Neither storage mechanism encrypts at rest — both are plain browser storage, readable by anything with script execution in the app's origin (i.e. an XSS bug would expose all locally-cached patient data) or by local device/profile access.

## Access control

There is currently no real authentication. `(authenticated)/+layout.server.ts`'s session-check redirect is fully commented out and unconditionally returns a hardcoded user. The `login` page is UI-only (no submit handler). **Any visitor can reach `patient`, `edit`, `measure`, and `report` — all of which display PHI — without logging in.** This is the single highest-priority item to fix before any use with real patient data, let alone a clinical pilot.

## Network/transmission (forward-looking)

Once backend integration resumes (see [backend-integration.md](backend-integration.md)), PHI will cross the network for the first time. Two things to confirm before that happens, both backend-side and outside this audit's direct scope but worth flagging:
- TLS is actually enforced end-to-end (not just configured as an option) for both the HTTP API and the WebSocket.
- The CSRF token plumbing already built in `core/network/csrf.ts` is actually attached to the re-enabled requests in `dicomParser.ts`.

## What's already done right

The static `report` page (see [diagnostic-pipeline.md](diagnostic-pipeline.md)) carries a clear disclaimer: the report is automatically generated, for educational/screening purposes only, and does not replace a qualified radiologist's or orthopedist's diagnosis. This is good practice and should be preserved — and probably extended to the `measure` page too — once the report becomes dynamic.

## Recommendations before any clinical pilot

1. Fix the `FileCache` orphan-on-TTL-expiry bug above.
2. Implement real authentication and re-enable the `(authenticated)` route guard.
3. Define an explicit data-retention policy: how long PHI may live client-side at all, and whether any of it should ever be allowed to outlive the browser session.
4. Confirm TLS is enforced end-to-end once backend transmission resumes.
5. Consider encrypting at rest if PHI is going to persist client-side beyond a single working session, given there is no current encryption layer.
