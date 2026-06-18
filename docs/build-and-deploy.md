# Build & deploy

Both projects build and deploy together, orchestrated by the repo-root `manage.sh` and Docker Compose. There is no CI/CD configured anywhere in the repo — all of this is run by hand.

## `manage.sh`

A thin wrapper around `docker compose`, always invoked as `./manage.sh <action> [options]` from the repo root.

| Action | What it does |
|---|---|
| `build` | Ensures the `spine-segmentation-net` Docker network exists, builds the SvelteKit static output and assembles it into `./static`/`./templates` (see below), then `docker compose build`s the images. |
| `up` | Same build steps, then `docker compose up -d --build --force-recreate`, copies the freshly built static files into the running `mainland` container, restarts it. `--watch` additionally runs `docker compose up --watch` (file-sync + restart on backend changes, dev only). |
| `fcopy` | Rebuilds the frontend and re-copies static files into the **already running** container, without touching the rest of the stack — the fast path for "I only changed frontend code." |
| `test` | Runs `npm run test` in `SpineSeg/`, then brings up the backend and runs `manage.py makemigrations --check --dry-run` + `manage.py test`, then tears the stack down (`--rmi local -v`). |
| `start` / `stop` / `down` / `rm` | Plain compose lifecycle (`rm` also drops volumes and removes the network). |
| `logs` | `docker compose logs -f`. |

Options: `--dev` sets `DJANGO_ENV=dev` and selects `compose.dev.yaml` as the overlay (also implies `--watch`); without it, `DJANGO_ENV=prod` and `compose.prod.yaml` is used. `--env-path=PATH` points at a different env file (default `.env`, **not checked into this repo** — copy `example.env` and fill in real values).

### `build_statics()` — how the two projects actually get glued together
```sh
npm install --prefix ./SpineSeg
npm run build --prefix ./SpineSeg
rm -rf ./static ./templates && mkdir -p static templates
cp -r ./backend/Mainland/templates/. ./templates/   # if present
cp -r ./backend/Mainland/static/. ./static/          # if present
cp -r ./SpineSeg/dist/*.html ./templates/
cp -r ./SpineSeg/dist/static/. ./static/
```
`SpineSeg` builds as a static SPA (`@sveltejs/adapter-static`, SPA `fallback: 'index.html'`, see `SpineSeg/svelte.config.js`) — there is no SvelteKit server running in production. The build output's HTML goes into Django's `templates/` (served by `Mainland/pages.py:index` for any recognized `<lang>` path) and its static assets go into Django's `static/`. `copy_to_container()` then `docker cp`s both into the running `mainland` container's `/home/Mainland/{static,templates}` and restarts it — this is why `fcopy` doesn't need a full rebuild of the backend image. This pipeline is unchanged by the infra work below — the frontend still isn't baked into the Docker image as a build stage (unlike lambumiz-plus's `frontend-builder` stage), which would be a separate, larger change.

## Docker Compose

Four files: `compose.yaml` (base — the Django app services, plus `include: [./dev/compose.yaml]` pulling in all infra), `compose.dev.yaml`/`compose.prod.yaml` (select `target: development`/`target: production` per service, selected by `manage.sh`'s `--dev` flag), and `dev/compose.yaml` (includes every service in `dev/<Service>/compose.yaml` — see [dev-infrastructure.md](dev-infrastructure.md) for what's in there and why).

All services share the external `spine-segmentation-net` network (created by `manage.sh net`/`ensure_net`).

App-level services (defined in root `compose.yaml`, via the `x-django-base` anchor):

- **`migration`** — one-shot: `manage.py migrate`, `run_init`, `create_superuser_if_not_exists`, `collectstatic`. Everything else (`mainland`, `mainland-celery`, `mainland-cron`) waits on `migration: condition: service_completed_successfully` before starting, instead of each re-running migrations on every restart like before. **`restart: "no"` is set explicitly** — it inherits everything else from the `x-django-base` anchor, which sets `restart: always` for the long-running services; without the override, `migration` would re-run forever (Docker restarts a container regardless of exit code under `always`), found during live verification.
- **`mainland`** — the Django app, built from `backend/Mainland/Dockerfile`. Just runs `gunicorn Mainland.asgi:application -k uvicorn_worker.UvicornWorker` now (ASGI, so HTTP and WebSocket share the same process/port `8080`). Healthcheck hits `/api/health/`.
- **`mainland-celery`** — same image/build, command `celery -A Mainland worker -Q broadcast_ws,broadcast_db,segmentation`. Runs `segment_vertebraes` (queue `segmentation`); the YOLO models load into this process's memory at import time (`Dicom/tasks/segmentation.py` module level), not the web process.
- **`mainland-cron`** *(new)* — runs `compile-cron.py` then `supercronic /tmp/crontab.txt`. Replaces the old inline `manage.py crontab add`/`crontab remove` calls, which depended on an OS `crontab` binary that was never actually installed in the image — dormant only because `CRONJOBS` happens to be empty today. **Found during live verification**: Supercronic crashes (`Failed to fork exec: no such file or directory`) when handed a genuinely 0-byte crontab file (which is what an empty `CRONJOBS` compiles down to) — `compile-cron.py` now writes a harmless `# no CRONJOBS configured` comment line instead of leaving the file empty.
- **`nginx`** — built from `backend/Nginx`, reverse-proxies `/`, `/ws/`, `/media/public/` (now `proxy_pass` to `minio-proxy`, not a local volume `alias`), and a new internal-only `/internal/media-private/` location used by the new authenticated DICOM-file endpoint's `X-Accel-Redirect`. Serves `/static/` from a shared volume, same as before. `nginx` is now fronted by Traefik (`dev/Traefik/`) rather than being the outermost layer itself.

All four Django-based services now talk to `proxysql`/`redis-proxy`/`minio-proxy` instead of `mysql`/`redis` directly — see [dev-infrastructure.md](dev-infrastructure.md).

`mainland`'s Dockerfile (`backend/Mainland/Dockerfile`) is still a 4-stage build (`base` → `builder` → `development`/`production`), with one addition: `base` now downloads the Supercronic binary (pinned release, no OS cron daemon needed) for the `mainland-cron` service above.

## What's missing

No CI/CD pipeline exists (no `.github/workflows`, no other CI config found) — this was explicitly out of scope for the dev-infrastructure/backend-structure work described above. `manage.sh test` is the closest thing to an automated check, and it's run manually. There's also no automated deploy step beyond `manage.sh up` — promoting to a real environment means running that command there directly with `--env-path` pointed at that environment's secrets.
