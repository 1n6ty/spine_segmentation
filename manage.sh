#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

PROJECT_NAME=$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
export PROJECT_NAME=$PROJECT_NAME

# Default Variables
ENV_PATH=".env"
MODE="prod"
SETTINGS_FILE="Mainland.settings"
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
  build           Build SpineSeg, panel, and backend Docker images
  up              Start the application (builds SpineSegs, deploys containers)
  fcopy           Rebuild SpineSeg/panel and copy static files to running container
  test            Run SpineSeg and backend tests
  start           Start existing containers
  stop            Stop running containers
  down            Stop and remove containers (preserve volumes)
  rm              Stop and remove containers and volumes
  logs            Show container logs
  help            Show this help message

Options:
  --build-postfix=POSTFIX  Build postfix for SpineSeg (default: base)
  --env-path=PATH          Environment file path (default: .env)
  --dev                    Use development settings
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
  docker compose -f "compose.yaml" -f "compose.${MODE}.yaml" --env-file "${ENV_PATH}" "$@"
}

# Consolidate the SpineSeg/panel build logic
build_statics() {
  echo "Building SpineSeg..."
  npm install --prefix ./SpineSeg
  npm run build --prefix ./SpineSeg

  echo "Assembling static files and templates..."
  rm -rf ./static ./templates || true
  mkdir -p static templates

  if [[ -d ./backend/Mainland/templates ]]; then
    cp -r ./backend/Mainland/templates/. ./templates/
  fi
  if [[ -d ./backend/Mainland/static ]]; then
    cp -r ./backend/Mainland/static/. ./static/
  fi

  cp -r ./SpineSeg/dist/*.html ./templates/ 2>/dev/null || true
  cp -r ./SpineSeg/dist/static/. ./static/
}

# Consolidate container copy logic
copy_to_container() {
  echo "Copying static files to container..."
  dc exec --user root mainland bash -c "rm -rf /home/Mainland/static/* /home/Mainland/templates/*"
  dc cp ./static/. mainland:/home/Mainland/static
  dc cp ./templates/. mainland:/home/Mainland/templates
  rm -rf ./static ./templates || true
  dc restart mainland
}

# ----------------------------------------
# Argument Parsing
# ----------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-path=*)
      ENV_PATH="${1#*=}"
      ;;
    --dev)
      SETTINGS_FILE="Mainland.settings_dev"
      MODE="dev"
      WATCH=true
      ;;
    --watch)
      WATCH=true
      ;;
    net|build|up|fcopy|test|start|stop|down|rm|logs|help)
      if [[ -n "$ACTION" ]]; then
        echo "Error: Only one action can be specified (found '$ACTION' and '$1')."
        exit 1
      fi
      ACTION="$1"
      ;;
    *)
      echo "Unknown option: $1"
      print_help
      exit 1
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
  SETTINGS_FILE="Mainland.settings_test"
fi

export DJANGO_SETTINGS_MODULE="${SETTINGS_FILE}"

# ----------------------------------------
# Action Execution
# ----------------------------------------

case "$ACTION" in
  net)
    ensure_net
    ;;
  
  build)
    ensure_net
    build_statics
    echo "Building Docker images..."
    dc build
    ;;
    
  fcopy)
    build_statics
    copy_to_container
    ;;
    
  up)
    ensure_net
    build_statics
    echo "Starting backend..."
    dc up -d --build --force-recreate
    copy_to_container
    echo "Success! Server started!"
    
    if [[ "$WATCH" == true ]]; then
      echo "Enabling watching mode..."
      dc up --watch
    fi
    ;;
    
  test)
    ensure_net
    echo "Running SpineSeg tests..."
    npm install --prefix ./SpineSeg
    npm run test --prefix ./SpineSeg

    echo "Starting backend for testing..."
    dc up -d --build --force-recreate
    
    echo "Running backend tests..."
    dc exec mainland .venv/bin/python3 manage.py makemigrations --check --dry-run
    dc exec mainland .venv/bin/python3 manage.py test
    
    echo "Cleaning up test environment..."
    dc down --rmi local -v
    ;;
    
  start)
    dc start
    ;;
    
  stop)
    dc stop
    ;;
    
  down)
    dc down --rmi local
    ;;
    
  rm)
    dc down --rmi local -v
    remove_net
    ;;
    
  logs)
    dc logs -f
    ;;
esac