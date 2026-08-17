#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Default Variables
ENV_PATH=".env"
DJANGO_ENV="dev"
ACTION=""
WATCH=false
NO_FRONTEND=false
NO_BACKEND=false
RUN_MOCKED=false
RUN_DOCKER=false

# ----------------------------------------
# Helper Functions
# ----------------------------------------

print_help() {
  cat << EOF
Usage: $0 <action> [options]

Actions:
  create-net      Creates multi-host overlay network
  remove-net      Removes multi-host overlay network
  build           Build frontend, and backend Docker images
  up/update       Start the application (builds frontend, deploys containers)
  test            Run frontend and backend tests
  test-compat     Backward-compat check: does the release branch's code still run
                  correctly against the schema this branch's migrations produce
  test-e2e        Brings up the real dev stack, seeds it, and runs the frontend's
                  real-backend e2e suite (npm run test:e2e:live) against it
  down            Stop and remove containers (preserve volumes)
  rm              Stop and remove containers and volumes
  logs            Show container logs
  help            Show this help message

Options:
  --env-path=PATH          Environment file path (default: .env)
  --watch                  Use in-time synchronization
  --no-frontend            (test) Skip the frontend/frontend test suite
  --no-backend             (test) Skip the backend test suite
  --mocked                 (test) Run only the mocked-tier backend tests (single container,
                            no external services). Combine with --docker to run both explicitly;
                            with neither flag, both tiers run.
  --docker                 (test) Run only the docker-tier backend tests (full compose stack,
                            real MySQL/Redis/Elasticsearch/MinIO).

Environment:
  JOB_PREFIX                Drives PROJECT_NAME/NETWORK_NAME for every action -- defaults to
                             the repo dirname if unset. Set directly as an env var, or via
                             JOB_PREFIX=... in the env file (--env-path). up/build/down/rm/logs
                             use it bare; test/test-compat/test-e2e each get their own
                             \$JOB_PREFIX-<action> suffix automatically, so a real dev stack
                             from \`up\` and a test/test-e2e run never share containers, volumes,
                             or a network -- one can't tear down or rebuild over the other.
EOF
}

# Ensure the custom network exists
ensure_net() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Creating network: $NETWORK_NAME"
    docker network create "$NETWORK_NAME"
  else
    echo "Network $NETWORK_NAME already exists."
  fi
}

# Safely remove the network
remove_net() {
  if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Removing network: $NETWORK_NAME"
    docker network rm "$NETWORK_NAME" || echo "Network $NETWORK_NAME is still in use, skipping removal."
  else
    echo "Network $NETWORK_NAME does not exist."
  fi
}

cleanup_test_runtime() {
  local exit_code=$?

  trap - EXIT INT TERM
  set +e
  echo "Tearing down test environment..."
  dc down --rmi local -v
  remove_net
  exit "$exit_code"
}

# Docker Compose Wrapper to keep commands clean
dc() {
  docker compose -f "compose.dev.yml" --env-file "${ENV_PATH}" "$@"
}

# ----------------------------------------
# Argument Parsing
# ----------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-path=*)
      ENV_PATH="${1#*=}"
      ;;
    --watch)
      WATCH=true
      ;;
    --no-frontend)
      NO_FRONTEND=true
      ;;
    --no-backend)
      NO_BACKEND=true
      ;;
    --mocked)
      RUN_MOCKED=true
      ;;
    --docker)
      RUN_DOCKER=true
      ;;
    create-net|remove-net|build|restore|up|update|test|test-compat|test-e2e|down|rm|logs|help)
      if [[ -n "$ACTION" ]]; then
        echo "Error: Only one action can be specified (found '$ACTION' and '$1')."
        exit 1
      fi
      ACTION="$1"
      ;;
  esac
  shift
done

# Default action fallback
if [[ -z "$ACTION" || "$ACTION" == "help" ]]; then
  print_help
  exit 0
fi

if [[ "$ACTION" == "test" ]]; then
  # Default to running both backend test tiers if neither was named explicitly.
  if [[ "$RUN_MOCKED" != true && "$RUN_DOCKER" != true ]]; then
    RUN_MOCKED=true
    RUN_DOCKER=true
  fi
fi

if [[ -z "${JOB_PREFIX:-}" && -f "$ENV_PATH" ]]; then
  JOB_PREFIX="$(grep -m1 '^JOB_PREFIX=' "$ENV_PATH" 2>/dev/null | cut -d= -f2-)"
fi
JOB_PREFIX="${JOB_PREFIX:-$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")}"
export JOB_PREFIX

# test/test-compat/test-e2e each get their own isolated Compose project +
# network -- a concurrently-running `up` dev stack (bare $JOB_PREFIX) is a
# completely separate set of containers/volumes/network, so a test run's
# --build --force-recreate or its teardown's `dc down -v` can never touch it.
case "$ACTION" in
  test|test-compat|test-e2e)
    PROJECT_NAME="${JOB_PREFIX}-${ACTION}"
    ;;
  *)
    PROJECT_NAME="$JOB_PREFIX"
    ;;
esac
export PROJECT_NAME
export COMPOSE_PROJECT_NAME="$PROJECT_NAME"
export NETWORK_NAME="${PROJECT_NAME}-net"

export DJANGO_ENV=$DJANGO_ENV

# ----------------------------------------
# Action Execution
# ----------------------------------------

case "$ACTION" in
  create-net)
    ensure_net
    ;;

  remove-net)
    remove_net
    ;;

  build)
    ensure_net
    echo "Building Docker images..."
    dc build --pull
    ;;

  up|update)
    ensure_net

    echo "Launching web and background worker infrastructure layers..."
    dc up -d
    echo "Success! Application stack fully initialized!"

    if [[ "$WATCH" == true ]]; then
      echo "Enabling file watching system synchronization..."
      dc up --watch
    fi
    ;;

  test)
    if [[ "$NO_FRONTEND" != true ]]; then
      echo "Executing frontend test suites..."
      docker run --rm \
        -v "$(pwd)/frontend:/app/frontend" \
        -v "/app/frontend/node_modules" \
        -w /app/frontend \
        node:24-alpine \
        sh -c "npm ci && npm run test"
    fi

    if [[ "$NO_BACKEND" != true ]]; then
      if [[ "$RUN_MOCKED" == true ]]; then
        echo "Executing mocked-tier backend tests (single container, no external services)..."
        MOCKED_IMAGE_TAG="${PROJECT_NAME}-mocked-image"

        docker build \
          -f backend/Mainland/Dockerfile --target development \
          -t "$MOCKED_IMAGE_TAG" .

        docker run --rm \
          --env-file "$ENV_PATH" \
          -e DJANGO_ENV=test \
          "$MOCKED_IMAGE_TAG" \
          bash -ec ".venv/bin/python3 manage.py makemigrations --check --dry-run && \
                     .venv/bin/coverage run manage.py test --parallel=auto && \
                     .venv/bin/coverage combine && \
                     .venv/bin/coverage report"
      fi

      if [[ "$RUN_DOCKER" == true ]]; then
        export DJANGO_ENV="test_docker"

        ensure_net
        trap cleanup_test_runtime EXIT
        trap 'exit 130' INT
        trap 'exit 143' TERM

        echo "Initializing isolated test runtime atmosphere..."
        dc up -d --build --force-recreate --wait api

        echo "Verifying migration state schema integrity..."
        dc exec api .venv/bin/python3 manage.py makemigrations --check --dry-run

        echo "Executing test suites..."
        dc exec api bash -ec ".venv/bin/coverage run manage.py test && .venv/bin/coverage combine && .venv/bin/coverage report"
      fi
    fi
    ;;

  test-compat)
    ensure_net

    RELEASE_WORKTREE="/tmp/${PROJECT_NAME}-release-worktree"
    RELEASE_IMAGE="${PROJECT_NAME}-release-image"

    cleanup_compat_test_runtime() {
      local exit_code=$?
      trap - EXIT INT TERM
      set +e
      echo "Tearing down test-compat environment..."
      dc down --rmi local -v
      remove_net
      git worktree remove --force "$RELEASE_WORKTREE" 2>/dev/null || true
      docker rmi "$RELEASE_IMAGE" 2>/dev/null || true
      exit "$exit_code"
    }
    trap cleanup_compat_test_runtime EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM

    echo "Fetching latest release..."
    git fetch origin release
    git worktree remove --force "$RELEASE_WORKTREE" 2>/dev/null || true
    git worktree add --detach "$RELEASE_WORKTREE" origin/release

    export DJANGO_ENV="test_docker"

    echo "Bringing up dev stack from current branch's infra..."
    dc up -d --build --force-recreate --wait api

    echo "Phase 1 (current): creating+migrating the shared test DB, running current's own tests..."
    dc exec api .venv/bin/python3 manage.py test --keepdb

    echo "Building release's application image (current build recipe, release's own source+deps)..."
    docker build -f backend/Mainland/Dockerfile --target development \
      --build-arg USER_ID=1000 --build-arg GROUP_ID=1000 \
      -t "$RELEASE_IMAGE" "$RELEASE_WORKTREE"

    echo "Phase 2 (release): release's own test suite against the current-migrated schema..."
    docker run --rm --network "$NETWORK_NAME" \
      --env-file "$ENV_PATH" -e DJANGO_ENV=test_docker \
      -e PROXYSQL_HOST=proxysql -e REDIS_HOST=redis-proxy \
      -e ES_PROXY_HOST=es-proxy -e MINIO_PROXY_HOST=minio-proxy \
      "$RELEASE_IMAGE" \
      .venv/bin/python3 manage.py test --keepdb

    echo "Backward-compatibility check passed: release's code runs cleanly against current's migrated schema."
    ;;

  test-e2e)
    ensure_net

    MANIFEST_HOST_PATH="$(pwd)/frontend/e2e/live/.manifest/seed-manifest.json"
    mkdir -p "$(dirname "$MANIFEST_HOST_PATH")"
    LIVE_RESULTS_HOST_PATH="$(pwd)/frontend/.cache/playwright-live-results"
    mkdir -p "$LIVE_RESULTS_HOST_PATH"
    E2E_IMAGE="${PROJECT_NAME}-live-image"

    cleanup_e2e_runtime() {
      local exit_code=$?
      trap - EXIT INT TERM
      set +e
      echo "Tearing down e2e environment..."
      dc down --rmi local -v
      remove_net
      docker rmi "$E2E_IMAGE" 2>/dev/null || true
      rm -f "$MANIFEST_HOST_PATH"
      exit "$exit_code"
    }
    trap cleanup_e2e_runtime EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM

    export DJANGO_ENV="dev"
    # Unset keeps hot reload for normal development (compose.dev.yml's
    # ${UVICORN_RELOAD_ARG---reload} falls back to --reload); e2e explicitly
    # disables it here so a file-watcher-triggered API restart mid-suite
    # can't cause spurious connection failures during a long autofill request.
    export UVICORN_RELOAD_ARG=""

    echo "Bringing up dev stack..."
    # nginx depends ON api (and traefik ON nginx), not the reverse -- `--wait
    # api` alone never pulls either in, so they'd either not start or (if
    # already running from a stale prior build) serve an index.html/
    # static-asset mismatch against this run's fresh api build. Name all
    # three explicitly, api/nginx both --build, so they come from the exact
    # same frontend source snapshot.
    #
    # api-celery is not a dependency of api/nginx/traefik at all (compose
    # would never pull it in implicitly) but autofill fundamentally needs it:
    # segment_vertebraes runs as an async Celery task, and without a live
    # worker consuming the queue, the SSE status stream just sits on
    # "segmentation.processing" forever -- the frontend has no way to
    # distinguish "still computing" from "nothing is consuming this at all".
    dc up -d --build --force-recreate --wait api nginx traefik api-celery

    echo "Seeding dev data + writing seed manifest..."
    dc exec api .venv/bin/python3 manage.py seed_dev_data --manifest-path=/tmp/seed-manifest.json
    docker cp "$(dc ps -q api):/tmp/seed-manifest.json" "$MANIFEST_HOST_PATH"

    echo "Building real-backend e2e image..."
    # Data/ is ~3GB total -- only copy the specific fixture(s) the live spec
    # actually reads (Data/spine-segmentation/dicom/side/2.dcm), preserving
    # its path so e2e/live/autofill-workflow.test.ts's path.join(...) still
    # resolves, rather than copying the whole directory in. The seed manifest
    # is mounted at run time below instead of COPY'd in here, so rerunning
    # against freshly-seeded data never needs an image rebuild.
    docker build -f - -t "$E2E_IMAGE" . <<'DOCKERFILE'
FROM mcr.microsoft.com/playwright:v1.58.0-noble
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY Data/spine-segmentation/dicom/side/2.dcm /app/Data/spine-segmentation/dicom/side/2.dcm
DOCKERFILE

    echo "Running real-backend e2e suite..."
    # https://traefik, not http://nginx: originally required because the old
    # FileCache (frontend/src/lib/core/storage/file-cache.ts, removed -- DICOM
    # bytes/polygons are no longer cached client-side at all, see
    # frontend/docs/patterns/storages.md) used the Cache Storage API, which
    # browsers only expose in a secure context. That constraint no longer
    # applies, but this still routes through Traefik's dev router (matches any
    # Host header, dev/Traefik/dynamic.yml) over real (self-signed, hence
    # ignoreHTTPSErrors in playwright.live.config.ts) TLS -- kept as-is rather
    # than switched to http://nginx without verifying that change live.
    #
    # --ipc=host: Chromium can crash under Docker's default 64MB /dev/shm
    # once a page holds enough tabs/large buffers -- standard Playwright
    # Docker guidance, cheap insurance even though this suite is single-page.
    #
    # Manifest mounted read-only rather than baked into the image via COPY:
    # SEED_MANIFEST_PATH points straight at the mount target, independent of
    # the frontend source's own directory layout.
    docker run --rm --ipc=host --network "$NETWORK_NAME" \
      -e E2E_BASE_URL=https://traefik \
      -e SEED_MANIFEST_PATH=/tmp/seed-manifest.json \
      -v "$MANIFEST_HOST_PATH:/tmp/seed-manifest.json:ro" \
      -v "$LIVE_RESULTS_HOST_PATH:/app/frontend/test-results" \
      "$E2E_IMAGE" \
      npm run test:e2e:live
    ;;

  down)
    dc down --rmi local
    ;;

  rm)
    read -p "DANGER: Purging all persistent data volumes... Are you sure? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      dc down --rmi local -v
        
      echo "Cleanup complete: Persistent storage purged."
    fi
    ;;

  logs)
    dc logs -f
    ;;
esac
