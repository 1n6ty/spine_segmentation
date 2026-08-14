# Architecture

Module layout, `common/` structure, and placement rules only. See `AGENTS.md`'s "Where things
live" for how this fits with the rest of `docs/` and the vault.

## Module Layout

Each module below can be a single file. Once a module outgrows one file, turn it into a
same-named directory and split it into per-resource files — that's how every `v{num}/` submodule
below (`views/`, `schemas/`, `filters/`, ...) already works.

```
<App>/
├── urls                  # app-root route aggregator across versions (only if the app owns URL-mounted endpoints)
├── ws_urls                # same, for Channels (only if the app has WS consumers)
├── admin                   # registers models in django-admin
├── models                   # django models — migrations must follow expand-contract, checked by django-migration-linter
├── apps                      # AppConfig
├── permissions                 # app-specific permission classes
├── tasks                        # Celery @shared_task functions, autodiscovered (only if the app has any)
├── documents                     # django-elasticsearch-dsl Document classes — unversioned: it maps to a model, not an API version (only if the app indexes something)
├── management/commands/           # idempotent seeder commands, one file per command — see Management commands below
├── migrations/                     # django migrations
├── utils/                           # pure app-wide helpers, used by 2+ of this app's version directories
│   └── constants                     # app-wide constants
└── v{num}/                           # one directory per API version
    ├── filters                        # django-filter FilterSet subclasses
    ├── paginations                     # BaseAsyncPagination subclasses, one per list endpoint
    ├── schemas/                         # Pydantic: request validation + response shape; `from_model(...)` builds the response instance from an ORM object
    │   └── docs                          # drf-spectacular response envelope classes
    ├── utils/                             # pure helpers used only within this app+version
    │   └── constants                       # app+version constants
    ├── views                                # adrf async ViewSet subclasses
    ├── urls                                  # routes for this version
    ├── ws_urls                                # Channels routes for this version (only if the app has WS consumers)
    ├── consumers                               # Channels AsyncWebsocketConsumer subclasses (only if the app has any)
    └── tests/                                   # integration tests, one file per views/ module minimum
        └── base                                  # shared fixtures for the app
```

```
common/
├── mixins/v1/          # cross-app mixins (viewset, ws consumer bases) — versioned like an app's v{num}/
├── permissions/          # cross-app permission classes
├── schemas/v1/             # cross-app Pydantic schemas — response envelope, domain/ for shared entity refs
├── exceptions/               # cross-app exception → ApiResponse mapping
├── paginations/                 # BaseAsyncPagination (page-number) and BaseCursorPagination (limit/before)
├── storages                       # custom Storage backends
├── testing/                         # cross-app test helpers
└── utils/                             # cross-app pure helpers
    └── constants                       # cross-app constants (create only once 2+ apps need one)
```
`common/` never owns a URL-mounted endpoint or a concrete Django model.

## Placement rules

- **2+ apps need it → `common/`**, under the submodule matching what it is (a permission class →
  `common/permissions/`, a utility function → `common/utils/`, etc).
- **2+ modules of the same app need it → the nearest shared ancestor directory.** Code needed by
  both a `v1/views/` file and `v1/consumers.py` moves to `v1/utils/`, not either module; code
  needed by both `v1/` and a future `v2/` moves to `<App>/utils/`.
- **A module outgrows one file → same-named directory.** Split further into separate files only
  when the pieces are meaningfully distinct concerns; otherwise keep one file per resource inside
  the directory (the existing convention throughout `v{num}/`).
- **`Core/management/commands/` owns deploy-time bootstrap logic → may import any app's models
  directly.**

## Cross-App dependencies

`FileManager.CasFileMixin` is this codebase's only abstract-base-app pattern — an abstract model
another app's concrete model subclasses to inherit fields/behavior (CAS dedup + ref-counting; see
`docs/patterns/media-serving.md`). Every other app's models are concrete with no such inheritance.
Real cross-app dependencies today:

- `Profile.Profile.company` → `Company.Company` (`on_delete=PROTECT`)
- `Profile.Profile.user` → `django.contrib.auth.User` (built-in, via `backends.EmailBackend`)
- `Dicom.DicomFile` subclasses `FileManager.CasFileMixin`; `Dicom.DicomFile.role` →
  `FileManager.FileRole`; `Dicom.DicomFile.cas_file` → `FileManager.CasFile` (all via the mixin)

## Management commands

Naming pattern: `create_<entity>_if_not_exists.py`. See `docs/patterns/management_commands.md`
for the code pattern behind this convention.

**Idempotency:** default run (no flag) is a true no-op if the row already exists; `--force`
resyncs every field back to canonical, undoing manual DB drift.

**Call order:** `init_spine_segmentation` runs every seeder in `commands_to_run` in dependency
order — superuser → Profile roles (admin, doctor, viewer) → Dicom statuses/projections →
Dicom's `DICOM_XRAY_FRONTAL`/`DICOM_XRAY_SAGITTAL` `FileRole`s (each capped at `max_count=1` per
Study). Admin and Doctor's seeders own their group's `.permissions.set(...)` (kept resynced to
every Permission in the system on every bootstrap, via `_ALWAYS_RESYNC`); Viewer is intentionally
granted none. The X-ray `FileRole`s are create-once like Viewer (`max_count` doesn't grow over
time the way the permission set does).
