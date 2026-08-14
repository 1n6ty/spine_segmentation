# Dev Infrastructure

Local dev stack and settings layout. Design rationale lives in the vault; coding conventions live
in `docs/patterns/`.

## CI

No CI pipeline is configured in this repo yet (no `.gitlab-ci.yml`, no `.github/workflows/`).
`manage.sh`'s `test`/`test-compat`/`test-e2e` actions are written to be CI-ready (isolated
per-run Compose project via `JOB_PREFIX`, self-teardown on exit) but are currently run manually.
`.claude/hooks/` (repo root, gitignored — local only, not shared via git) has a `Stop` hook
(`run-e2e-after-plan.sh`) that runs `test-e2e` once after a Claude Code plan is approved and its
implementation work finishes, gated by a marker `on-plan-approved.sh` drops on `PostToolUse:
ExitPlanMode`; see those two scripts and `.claude/settings.json` for the exact mechanism.

## Local stack

`manage.sh` wraps Docker Compose: `./manage.sh help` for the full command list (`up`, `up --watch`,
`down`, `rm`, `build`, `test`, `test-compat`, `test-e2e`, `logs`). `test`/`test-compat`/`test-e2e`
each run in their own isolated Compose project (`$JOB_PREFIX-<action>`), never the bare `up` dev
stack — see root `AGENTS.md`'s Command Safety section.

- `compose.yml` — prod image build only: `api`, `nginx` (registry tags; not used by any local
  `manage.sh` action)
- `compose.dev.yml` — dev: `migration`, `api`, `api-celery`, `api-celery-beat`, `nginx`, `traefik`,
  plus every service under `dev/`
- `dev/<Service>/compose.yml` — `MySql`, `Redis` (cache/broker/session/channels) + `RedisProxy`,
  `MinIO` + `MinIOProxy`, `ElasticSearch` + `ElasticSearchProxy`, `ProxySql`, `Traefik`
- `backend/Mainland/Dockerfile`, `backend/Nginx/Dockerfile` — the two built images
- Dependencies: `backend/Mainland/req.static.txt` (runtime core), `req.nn.txt` (torch/ultralytics/
  onnxruntime — only installed where DICOM inference actually runs, see `req.nn.txt`'s own header
  and `Dockerfile`'s stage comments), `req.dev.txt` (dev/test extras)

## Settings (`Mainland/Mainland/settings/`)

`DJANGO_ENV` selects the entry module: `base.py` (shared) + one of `dev.py` / `prod.py` / `test.py`
/ `test_docker.py` / `test_mocked.py`. Per-concern config lives under `settings/modules/`: `auth`,
`celery`, `database`, `logging`, `search`, `security`, `storage`.
