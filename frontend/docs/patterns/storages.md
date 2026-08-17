# Storages

DICOM files and their annotations no longer live only in the browser. The backend's
`UserRecentStudies` model (`backend/Mainland/Dicom/models.py`) is the single source of truth for
a user's recent studies — persistent across devices/browsers, scoped to the logged-in account by
`owner=request.user` on every endpoint under `/api/dcm/recent-studies/`, not by anything
client-side. This was a deliberate change from the old "stays in the browser by design" stance —
see `backend/docs/patterns/media-serving.md` for the general private-media convention the backend
side of this reuses (private bucket, X-Accel-Redirect, never presigned URLs).

The frontend deliberately does **not** keep a durable local copy of DICOM bytes or polygons
(no IndexedDB, no Cache Storage) — both were removed. PHI sitting in browser storage on a shared
clinical workstation, or as a standing target for any future XSS bug, wasn't worth the perf win of
a local cache once the backend became authoritative. Reopening a session always re-fetches from
the backend.

| Store | What | Notes |
|---|---|---|
| In-memory (`SessionService`, `core/session/session.svelte.ts`) | Current tab's DICOM bytes, parsed patient/study/series, polygons, the current session id | Lives only for the tab's lifetime — refetched from the backend on every load/reopen, never persisted |
| `localStorage` | Nothing | See below — there's no id to remember client-side at all |

## `SessionService` (`core/session/session.svelte.ts`)

Backed entirely by the backend now:

- `uploadFile()` — parses the file client-side (still needed to render the bitmap — the backend
  never sends pixel data back), then persists it: creates a `UserRecentStudies` row if none exists
  yet (`POST /api/dcm/recent-studies/`), uploads via the existing `POST /api/dcm/parse/` (which
  also kicks off AI segmentation server-side, unconditionally — see `patterns/auth.md`-adjacent
  note below), then attaches the resulting image
  (`PATCH /api/dcm/recent-studies/{id}/projections/{slug}/`). Every upload goes through this now —
  there's no local-only mode left.
- `requestSave()` — same 500ms-debounce trigger as before, but PATCHes the changed projection's
  polygons and the regenerated thumbnail to the backend instead of writing to IndexedDB.
- `restoreFromServer()` — takes `SessionUIDArg = string | 'latest' | null`. A real id fetches
  `GET /api/dcm/recent-studies/{id}/` (used when reactivating a specific session from the
  recent-studies list, e.g. `Card.svelte`'s `makeActive`); `'latest'` fetches
  `GET /api/dcm/recent-studies/latest/` instead — the requesting user's most-recently-accessed row,
  with no id needed at all — used on app load (`project.svelte.ts`). Either way, once the detail
  response comes back, `GET /api/dcm/{sop}/file/` (unchanged, X-Accel-Redirect-served) per populated
  slot gets the raw bytes, parsed client-side exactly as before. A `'latest'` 404 (no recent studies
  yet — the ordinary first-visit case) or any other failure just starts an empty session rather than
  surfacing an error; an explicit known id that 404s does throw, since that's an unexpected state
  worth surfacing.

**AI segmentation now runs automatically on every upload**, not just on an explicit "Autofill"
click — `parse_and_store_dicom` (backend) always triggers it when content changes, and every
upload goes through that path now. The "Autofill" button (`components/ui/editor/EditorCanvas.svelte`)
is repurposed accordingly: it no longer uploads or re-triggers segmentation, it only watches the
already-running pipeline's status (`features/autofill/autofill.ts`'s `watchAutofillStatus`, reusing
the existing SSE endpoint) and, once done, lets the user explicitly load the AI's points — a manual
edit made while segmentation was still running is never silently overwritten.

## `localStorage`

Holds nothing at all — not even a session id. Resuming "wherever I left off" on reload goes through
`GET /api/dcm/recent-studies/latest/` (`Dicom/v1/views/user_recent_studies.py`'s `latest` action)
instead of reading a remembered id: ownership (`owner=request.user`, via the auth session cookie) is
what identifies "my" session, so there's nothing left to store client-side once the backend can
answer "what's my most recent one" directly. An earlier version of this design kept one opaque id
(`lastActiveSessionUID`) in `localStorage` for the same purpose — removed once it became clear the
backend could serve the same answer without it. See `patterns/auth.md` for the unrelated flag that
used to live in `localStorage` and why it was removed even earlier.
