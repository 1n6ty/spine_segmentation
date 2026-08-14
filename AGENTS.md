# Agent Instructions

## Purpose

This file defines repository-wide guidance for agents and automated edits. Keep changes small, grounded in the current codebase, and easy to review.

## Scope And Precedence

- These rules apply to the whole repository.
- More specific `AGENTS.md` files override this file for their directory tree.
- For work inside `frontend/`, read `frontend/AGENTS.md` before editing code.
- For work inside `backend/`, read `backend/AGENTS.md` before editing code.
- User instructions in the active task take precedence over this file.

## Repository Map

- `backend/` - Django backend, ASGI entrypoint, API routes, modular settings, static API manifest, templates, backend tests and Nginx config for serving API/static/media. See `backend/AGENTS.md` and `backend/docs/`.
- `dev/` - development infrastructure mirroring production-like dependencies (ElasticSearch + sidecar-proxy, MinIO + sidecar-proxy, Mysql + ProxySQL, Redis + sidecar-proxy, Traefik).
- `frontend/` - SvelteKit 5 (runes) SPA frontend. See `frontend/AGENTS.md` and `frontend/docs/`.
- `Data/` - large local DICOM fixtures (several GB); only specific files under it are ever copied into an image (e.g. `manage.sh test-e2e`'s live fixture), never the whole directory.
- `compose.yml` - production image build definitions for `api` and `nginx` only (registry tags, no dev services) - not used for local dev.
- `compose.dev.yml` (plus `dev/*/compose.yml` includes) - the full local dev/test stack: `api`, `api-celery`, `api-celery-beat`, `nginx`, `traefik`, `migration`, `proxysql`, `mysql`, `redis-*`, `es*`, `minio*`.
- `manage.sh` - dev local orchestration script for network, build, up/update, test, test-compat, test-e2e, down/rm, and logs workflows. Run `./manage.sh help` for the full action/option list.

## Sources Of Truth

- Use existing code and local config as the first source of truth.
- For API discovery, prefer the local schema endpoints `GET /api/schema/` and `GET /api/schema/swagger-ui/` when the backend is running.
- For frontend behavior and constraints, use `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/routes/[lang]/layout.css`, and `frontend/AGENTS.md`.
- For backend behavior, use `backend/Mainland/Mainland/settings/`, urls, models, schemas, views, tests, and `backend/Mainland/static/api.manifest.json` if it exists in the current checkout.
- Backend dependencies live in `backend/Mainland/req.static.txt` (core) and `backend/Mainland/req.nn.txt` (torch/ultralytics/onnxruntime, only installed where DICOM inference actually runs); dev-only tooling is `backend/Mainland/req.dev.txt`.
- For Docker/runtime behavior, use `manage.sh` and `compose*.yml` together; do not infer runtime wiring from one file alone.
- Do not invent API contracts. Verify backend routes and DTO shapes before changing consumers or mocks.

## Environment And Secrets

- `example.env` is the environment template; `.env` is local and secret.
- Do not print `.env` contents, tokens, passwords, private keys, or local secrets in logs, commits, reports, or messages.
- If a new environment variable is required, update `example.env` and verify that the relevant `compose*.yml` services pass it through.
- Prefer placeholders and environment variable names over real secret values in documentation and examples.

## Working Rules

- Inspect current files before proposing or implementing changes.
- Keep diffs focused on the requested task; avoid opportunistic refactors.
- Do not edit generated outputs or dependency folders such as `dist/`, `node_modules/`, `backend/Mainland/static/`, `backend/Mainland/templates/`, or local tool output directories.
- Do not expose secrets from `.env` or local config in logs, commits, or messages.
- If a command may remove data, recreate containers, install dependencies, or rewrite Git history, explain the impact before running it.
- If the worktree is dirty, preserve unrelated changes. Do not revert or overwrite files you did not intentionally edit.
- If a task requires installing new npm or pip packages, confirm that explicitly before running the install.

## Git And Review Hygiene

- Do not create commits unless explicitly asked.
- Before committing, inspect the diff and split unrelated purposes into separate commits.
- Use English Conventional Commit messages: `<type>(<area>/<scope>): <summary>`.
- Allowed commit types are `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, and `build`.
- Use an explicit area prefix when subsystem names can collide across the repo, for example `frontend/auth`, `backend/auth`, `shared/api`, `ci`, `docker`, or `repo`.
- Use `<type>(<area>): <summary>` only for area-wide changes where a narrower subsystem scope would be misleading.
- If a commit body is useful, use `- ` bullet lines without blank lines between bullets.
- Do not commit local agent state, temporary screenshots, logs, browser/tool artifacts, or factory files unless the task explicitly asks for them.

## Main Commands

Run commands from the repository root unless noted otherwise.

- Show project help: `./manage.sh help`
- Create/remove the shared Docker network: `./manage.sh create-net` / `./manage.sh remove-net`
- Build Docker images: `./manage.sh build`
- Start or update the default development stack: `./manage.sh up` or `./manage.sh update`
- Start with compose watch synchronization: `./manage.sh up --watch`
- Use a custom environment file: add `--env-path=PATH` to commands that read compose env values.
- Stop containers while preserving volumes: `./manage.sh down`
- Stop containers and remove volumes: `./manage.sh rm`
- Run full managed checks: `./manage.sh test` (add `--mocked` and/or `--docker` to run only one backend tier, `--no-frontend`/`--no-backend` to skip a whole suite)
- Backward-compat check (does `origin/release` still run against this branch's migrated schema): `./manage.sh test-compat`
- Real-backend e2e (brings up the stack, seeds it, runs the frontend's `test:e2e:live` suite against it): `./manage.sh test-e2e`
- Show container logs: `./manage.sh logs`

Use focused package commands for frontend-only changes; see `frontend/AGENTS.md`.
Use focused package commands for backend-only changes; see `backend/AGENTS.md`.

## Command Safety

- `./manage.sh` derives `PROJECT_NAME`/`NETWORK_NAME` from `JOB_PREFIX` (env var, or a `JOB_PREFIX=...` line in the env file; defaults to the repo dirname). `up`/`build`/`down`/`rm`/`logs` use it bare; `test`/`test-compat`/`test-e2e` each get their own `$JOB_PREFIX-<action>` project and network, so a real dev stack from `up` and any test run never share containers, volumes, or a network — one can't tear down, rebuild over, or seed data into the other. `test-e2e`'s Traefik still binds host ports 80/443 directly, though, so it can't run concurrently with an already-running `up` stack's Traefik regardless of project isolation.
- `./manage.sh up` / `./manage.sh update` creates the Docker network if needed and starts the compose stack from `compose.dev.yml` (not `compose.yml` — that file is prod image build definitions only, unused by any local `manage.sh` action).
- `./manage.sh up --watch` starts the stack and then runs compose watch synchronization.
- `./manage.sh down` stops containers and removes local compose images for the current environment.
- `./manage.sh test` runs frontend tests via `docker run node:24-alpine`, runs the mocked-tier backend suite (single container, SQLite) and/or the docker-tier suite (full compose stack, real MySQL/Redis/Elasticsearch/MinIO) depending on `--mocked`/`--docker`, then tears down that tier's isolated project.
- `./manage.sh test-compat` and `./manage.sh test-e2e` each build one or more throwaway Docker images and an isolated compose project, and always tear both down (including volumes) on exit — success, failure, or interrupt.
- `./manage.sh rm` removes compose volumes and local compose images. Treat it as destructive because MySQL/Redis data can be lost.

## Verification

- Run the narrowest useful verification first.
- For frontend-only work, prefer targeted tests, then `npm --prefix ./frontend run lint`, then `npm --prefix ./frontend run build` when the change can affect compilation or bundling.
- For backend changes, run Django checks/tests in the same environment the project uses.
- If verification cannot be run or hangs, report the exact command and observed behavior.
