#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

PROJECT_NAME=$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
export PROJECT_NAME=$PROJECT_NAME

# Default Variables
ENV_PATH=".env"
DJANGO_ENV="dev"
ACTION=""
WATCH=false
NETWORK_NAME="spine-segmentation-net"

# ----------------------------------------
# Helper Functions
# ----------------------------------------

print_help() {
  cat << EOF
Usage: $0 <action> [options]

Actions:
  create-net      Creates multi-host overlay network
  remove-net      Removes multi-host overlay network
  build           Build panel, and backend Docker images
  up/update       Start the application (builds panel, deploys containers)
  test            Run frontend and backend tests
  down            Stop and remove containers (preserve volumes)
  rm              Stop and remove containers and volumes
  logs            Show container logs
  help            Show this help message

Options:
  --env-path=PATH          Environment file path (default: .env)
  --watch                  Use in-time synchronization
EOF
}

# Ensure the custom network exists
ensure_net() {
  if ! docker network ls | grep -q "$NETWORK_NAME"; then
    echo "Creating network: $NETWORK_NAME"
    docker network create "$NETWORK_NAME"
  else
    echo "Network $NETWORK_NAME already exists."
  fi
}

# Safely remove the network
remove_net() {
  if docker network ls --format '{{.Name}}' | grep -wq "$NETWORK_NAME"; then
    echo "Removing network: $NETWORK_NAME"
    docker network rm "$NETWORK_NAME" || echo "Network $NETWORK_NAME is still in use, skipping removal."
  else
    echo "Network $NETWORK_NAME does not exist."
  fi
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
    create-net|remove-net|build|restore|up|update|test|down|rm|logs|help)
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
  DJANGO_ENV="test"
fi

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
    ensure_net
    echo "Executing frontend unit test suites..."
    docker run --rm \
      -v "$(pwd)/SpineSeg:/app/SpineSeg" \
      -v "/app/SpineSeg/node_modules" \
      -w /app/SpineSeg \
      node:26-alpine \
      sh -c "npm ci && npm run test:unit -- --run"

    echo "Initializing isolated test runtime atmosphere..."
    dc up -d --build --force-recreate --wait --no-deps api

    echo "Verifying migration state schema integrity..."
    dc exec api .venv/bin/python3 manage.py makemigrations --check --dry-run

    echo "Executing test suites..."
    dc exec api bash -ec ".venv/bin/coverage run manage.py test && .venv/bin/coverage report"

    echo "Tearing down test environment..."
    dc down --rmi local -v
    remove_net
    ;;

  down)
    dc down --rmi local
    ;;

  rm)
    read -p "DANGER: Purging all persistent data volumes... Are you sure? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] then
      dc down --rmi local -v
        
      echo "Cleanup complete: Persistent storage purged."
    fi
    ;;

  logs)
    dc logs -f
    ;;
esac
