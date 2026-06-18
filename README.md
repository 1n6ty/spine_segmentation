# Spine Segmentation

A spine-deformity diagnostics tool: a doctor uploads a spine DICOM X-ray, an AI model proposes vertebra outlines (or the doctor draws them by hand), and the app computes clinical parameters and a rule-based first-pass diagnosis from the result.

Two parts, built and deployed together:
- **`SpineSeg/`** — the SvelteKit frontend (editor, parameter calculators, diagnosis report). Has its own [README](SpineSeg/README.md) and `docs/` covering the frontend in detail.
- **`backend/Mainland/`** — the Django backend (auth, DICOM ingestion, the Celery-driven YOLO segmentation pipeline, a generic dataset query API).

`Data/` and `classify/` are separate research/training artifacts (datasets, standalone training/classification scripts) — not part of the deployed application, not covered here.

## Quick start

```sh
cp example.env .env     # fill in real values first
./manage.sh up --dev    # builds both projects, starts the full stack (MySQL/ProxySQL, Redis x3/RedisProxy, MinIO, Traefik, Django, Celery, nginx) with file-watch
./manage.sh test        # frontend + backend test suites
./manage.sh fcopy       # rebuild just the frontend and push it into the running container
```

See [docs/build-and-deploy.md](docs/build-and-deploy.md) for what each `manage.sh` action and Compose service actually does.

## Docs

- [Backend architecture](docs/backend-architecture.md) — Django apps, models, the segmentation Celery task and WebSocket, media storage, routing, and what's (not) authenticated.
- [Dev infrastructure](docs/dev-infrastructure.md) — the `dev/` services (ProxySQL, Redis x3 + RedisProxy, MinIO + proxy, Traefik) and why each exists.
- [Doctor profile](docs/doctor-profile.md) — current auth model, what login/logout wiring exists, and a correction about what it actually gates today.
- [Autofill integration](docs/autofill-integration.md) — the "magic button" flow end to end: DSL cache-check, upload, WebSocket, and why every AI result is re-normalized before use.
- [Build & deploy](docs/build-and-deploy.md) — `manage.sh`, Docker Compose services, the Dockerfile's build stages, nginx, and the (current lack of) CI/CD.

For frontend-specific topics (component architecture, the parameter calculators, the diagnosis rule engine, frontend testing strategy), see [SpineSeg/docs](SpineSeg/docs).
