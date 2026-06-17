# Backend integration

Today, **100% of the diagnostic pipeline runs without ever touching a backend.** Every API call and the WebSocket hookup the frontend was built for are present in the code but commented out. This doc records what the frontend expects, what currently exists on the backend, and exactly what's blocking the gap from closing.

## What the frontend expects (commented-out code)

In `src/lib/features/dicomParser.ts`:
- `POST /api/dsl/select/` — query for an existing `ref_points` result by `sop_uid`, to skip re-running segmentation on a file already processed server-side.
- `POST /api/dcm/parse/` — upload the raw DICOM file (multipart `FormData`) to trigger server-side segmentation.

In `src/lib/stores/websocket/xraysockets.store.ts` (`createProjectionSocket`):
- `wss://{PUBLIC_DOMAIN}/ws/dcm/segment/{sopInstanceUID}/` — a WebSocket the frontend opens after upload, expecting JSON messages shaped `{ data: { status, ref_points } }` with `status` cycling through `image.processing` → `segmentation.processing` → `saving` → `done`. On `done`, the frontend calls `formatJson2Polygons(data.data.ref_points)` (`dicomParser.ts`) to turn the server's result into the app's `Polygon[]` shape and populate an `autoPolygons` store.

`src/lib/core/network/csrf.ts` (`getCSRFToken()`) reads `window.CSRF_TOKEN` or the `csrftoken` cookie — correctly designed to attach to the POSTs above, but currently unused since those calls are commented out.

## What actually exists on the backend (briefly verified for this audit)

The backend (`backend/Mainland`, outside this frontend audit's main scope) is a real Django 6.0 + Django-ADRF + Channels/Daphne + Celery/Redis + MySQL stack with a working `compose.yaml`/`Dockerfile`. Routes roughly matching the frontend's expectations exist: a `DcmViewSet` exposing `POST /api/dcm/parse/`, and a WebSocket route at `ws/dcm/v1/segment/{uid}/`.

**Both currently crash.** `Dicom/utils/parse.py` and the `Dicom/utils/segmentation/*` modules — imported by `views/dcmparse.py` and `tasks/segmentation.py` respectively — were deleted from disk as unstaged working-tree changes (not yet committed), while the import statements that depend on them remain. This is a **P0 blocker** for any integration work: restoring or rewriting those files is a backend-side task, outside this frontend audit, but it must happen before the frontend's commented-out calls could be safely re-enabled.

A standalone `classify/` module exists at the repo root (outside both `SpineSeg/` and `backend/Mainland/`): scikit-learn KNN/RandomForest code for pathology classification from geometric features. It is **not wired into Django** as an app and is not called from any view or Celery task. See [clinical-rules-reference.md](clinical-rules-reference.md) for why a deterministic rule-based approach is the faster near-term path to a first diagnosis, with this ML module as a plausible v2.

## A frontend-side integration bug, found during this audit

`xraysockets.store.ts` itself has a broken import: `import { autoPolygons } from "../study/study.store"`, but no `src/lib/stores/study/study.store.ts` file exists anywhere in the repo. This is currently silent because nothing imports `xraysockets.store.ts` (the call site in `dicomParser.ts` is commented out too) — but the moment either is re-enabled, the build breaks until this store is created or the import path is corrected.

## Net effect

The intended user journey is upload → AI auto-segmentation → manual correction → measure → report. Today, the AI-segmentation step simply doesn't run: every vertebra polygon must be hand-drawn in `edit`. Re-enabling the integration requires, in order: (1) the backend's deleted segmentation utilities restored, (2) the frontend's broken `study.store.ts` import fixed, (3) the commented-out `fetch`/WebSocket code in `dicomParser.ts` un-commented and tested end-to-end.
