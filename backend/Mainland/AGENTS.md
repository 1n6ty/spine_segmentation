# Backend — Agent Reference

Django async REST API. Read `backend/docs/` for authoritative patterns before writing code.

## App Map

| App | Responsibility |
|---|---|
| `Core` | Session login/logout/me, healthcheck, deploy-time bootstrap commands (`init_spine_segmentation`, `seed_dev_data`) |
| `Company` | `Company` model (translated name, slug) |
| `Profile` | Extends `django.contrib.auth.User` with per-company `Profile` (patronymic, phone, `Role` FK); `Role` model (admin/doctor/viewer, each wrapping a `Group`) |
| `Dicom` | `Patient`/`Study`/`Series`/`DicomImage` models, `DicomFile` (CAS-backed raw file, one per Image), DICOM upload+parse, async YOLO/onnxruntime vertebra segmentation (Celery), SSE segmentation-status stream |
| `backends` | Custom Django authentication backend (`EmailBackend` — login is by email, not username) |
| `common` | Shared exceptions, mixins, permissions, Pydantic schemas, utils |
| `FileManager` | Content-addressable file storage (`CasFile` registry + ref-counting, `CasFileMixin` abstract base, `FileRole` for per-role `max_count` caps) — see `docs/patterns/media-serving.md` |
| `Mainland` | Django settings (`prod`/`dev`/`test`/`test_docker`/`test_mocked`), ASGI entry (Channels wired but currently no app registers a WS consumer — see `docs/patterns/websockets.md`), root URLs |

`Dicom.DicomFile` is this codebase's first cross-app model subclass — it subclasses
`FileManager.CasFileMixin` to get SHA-512 content-addressed dedup, storing the raw DICOM file on
MinIO/S3, served privately via nginx `X-Accel-Redirect` (`FileManager.utils.serve_file_response`,
used by `Dicom/v1/views/dcmparse.py`'s `file` action).

**Cross-app rule:** anything used by 2+ apps → `common/`. Shared Pydantic types →
`common/schemas/v1/domain/`; utilities → `common/utils/`; permissions → `common/permissions/`.

## Commands

Run from `backend/Mainland/` with the venv active (`source ../../.venv/bin/activate` — the venv
is at the repo root, not under `backend/`).

```bash
# Run one app's tests
DJANGO_ENV=test python manage.py test <App> --verbosity=2

# Full test suite with coverage (must stay ≥ 80%)
DJANGO_ENV=test coverage run manage.py test && coverage report

# Create migrations
DJANGO_ENV=test python manage.py makemigrations

# CI guard — fails if any migration is missing
DJANGO_ENV=test python manage.py makemigrations --check --dry-run
```

`DJANGO_ENV=test` (not `test_mocked` — that module is for the fully-isolated Docker `migration`
build, see `docs/testing.md`) already resolves to SQLite `:memory:` + fake Redis, so this runs
with no external services.

**Real-environment tests** — from the repo root (requires Docker), prefer the wrapper:

```bash
./manage.sh test --no-frontend --docker
```

This runs in its own isolated Compose project/network (`$JOB_PREFIX-test`, never the bare `up`
dev stack — see root `AGENTS.md`'s Command Safety), against real MySQL/Redis/Elasticsearch/MinIO
via nginx, and tears itself down after. Local (mocked) tests use SQLite and local filesystem
storage — they cannot cover Elasticsearch indexing, S3 uploads, or Redis cache behaviour. Both
tiers must pass before a feature is done.

`DJANGO_ENV` selects settings: `prod` / `dev` / `test` →
`Mainland/settings/{prod,dev,test}.py`.

**Discover Celery tasks** (no worker needed, run from `backend/Mainland/`):

```bash
# All registered tasks
DJANGO_ENV=dev python manage.py shell -c "
from Mainland.celery import app; app.loader.import_default_modules()
for t in sorted(k for k in app.tasks if not k.startswith('celery.')): print(t)"

# Beat-scheduled tasks
DJANGO_ENV=dev python manage.py shell -c "
from django.conf import settings
for n, c in settings.CELERY_BEAT_SCHEDULE.items(): print(f'{n}: {c[\"task\"]} @ {c[\"schedule\"]}')"
```

## Keeping docs up to date

`backend/AGENTS.md` and all files in `backend/docs/` are the authoritative reference for
this codebase. **Update them whenever you change a pattern, add a new concern, or discover
a non-obvious failure.** Specifically:

- New app or cross-app shared code → update `docs/architecture.md`
- New management command → add it to `docs/architecture.md`'s Management Commands section and,
  if it's a seeder, to `init_spine_segmentation.py`'s `commands_to_run` (see
  `docs/patterns/management_commands.md`)
- New coding pattern, convention, or utility → update the relevant file under `docs/patterns/`
- New `@extend_schema` rule or OpenAPI behaviour → update `docs/openapi.md`
- New test requirement or fixture pattern → update `docs/testing.md`
- New non-obvious failure found → add a row to `docs/gotchas.md`
- New Celery task or queue → update `docs/patterns/celery.md`

Stale docs are worse than no docs — a future agent will follow them and produce broken code.

**`backend/docs/` must stay as simple and short as possible — architecture facts and non-obvious
gotchas only.** Any explanation, rationale, or narrative ("why this shape," the history of a
design decision, investigation notes) belongs in the Obsidian vault (see below), not here. If
you catch yourself writing more than 2-3 sentences of justification for something in `docs/`,
that's a signal it belongs in the vault's `<App>/Design Notes.md` instead — add it there and leave
a one-line pointer in `docs/`.

## Detailed docs

**Where things live:** module layout and management-command inventory → `docs/architecture.md`;
coding conventions (how to write a view/schema/permission) → `docs/patterns/`; dev infrastructure
→ `docs/dev.md`; design rationale and "why" decisions → the Obsidian vault's `<App>/Design
Notes.md` pages (see below).

- [architecture.md](docs/architecture.md) — module layout, `common/` structure, placement rules, management commands
- [patterns/](docs/patterns/) — coding conventions, one file per topic: views, urls, permissions,
  schemas, serialization, extend, websockets, translations, media-serving, celery,
  management_commands, pagination
- [openapi.md](docs/openapi.md) — `@extend_schema` tagging, required fields, async wrapping rule
- [testing.md](docs/testing.md) — philosophy, base fixtures, local vs Docker tests, parler pattern
- [gotchas.md](docs/gotchas.md) — non-obvious failure table
- [dev.md](docs/dev.md) — local Docker stack, settings layout

A companion Obsidian vault at `~/Documents/Spine-Segmentation` holds
per-endpoint/permission/schema reference notes plus `<App>/Design Notes.md` pages with the full
design rationale behind non-obvious decisions — check there for "why" questions this repo's docs
don't answer. Not every environment has access to it; skip if absent.
