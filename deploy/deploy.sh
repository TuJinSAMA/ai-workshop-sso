#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.prod.yml}"
APP_SERVICE="${APP_SERVICE:-app}"
IMAGE_NAME="${IMAGE_NAME:-ai-workshop-sso}"
GHCR_OWNER="${GHCR_OWNER:?GHCR_OWNER is required}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
APP_ENV_FILE="${APP_ENV_FILE:-/opt/ai-workshop-sso/.env.production}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-20}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-3}"

APP_IMAGE="ghcr.io/${GHCR_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"
export APP_IMAGE APP_ENV_FILE

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[deploy] Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$APP_ENV_FILE" ]]; then
  echo "[deploy] Missing env file: $APP_ENV_FILE" >&2
  exit 1
fi

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_PAT:-}" ]]; then
  echo "[deploy] Login to ghcr.io as ${GHCR_USERNAME}"
  echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
else
  echo "[deploy] Skip docker login (GHCR_USERNAME / GHCR_PAT not provided)"
fi

previous_container_id="$(compose ps -q "$APP_SERVICE" || true)"
previous_image=""
if [[ -n "$previous_container_id" ]]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$previous_container_id" || true)"
fi

echo "[deploy] Pull image: $APP_IMAGE"
compose pull "$APP_SERVICE"

echo "[deploy] Run DB migrations on target image"
compose run --rm "$APP_SERVICE" pnpm prisma migrate deploy

echo "[deploy] Start target container"
compose up -d --remove-orphans "$APP_SERVICE"

container_id="$(compose ps -q "$APP_SERVICE")"
if [[ -z "$container_id" ]]; then
  echo "[deploy] Failed to resolve target container id" >&2
  exit 1
fi

echo "[deploy] Wait for healthcheck"
is_healthy="false"
for ((i=1; i<=HEALTHCHECK_RETRIES; i++)); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  echo "[deploy] health($i/$HEALTHCHECK_RETRIES): $status"
  if [[ "$status" == "healthy" || "$status" == "running" ]]; then
    is_healthy="true"
    break
  fi
  if [[ "$status" == "exited" || "$status" == "dead" || "$status" == "unhealthy" ]]; then
    break
  fi
  sleep "$HEALTHCHECK_SLEEP_SECONDS"
done

if [[ "$is_healthy" != "true" ]]; then
  echo "[deploy] New version failed healthcheck" >&2
  if [[ -n "$previous_image" ]]; then
    echo "[deploy] Rollback to: $previous_image"
    export APP_IMAGE="$previous_image"
    compose up -d --remove-orphans "$APP_SERVICE"
  fi
  exit 1
fi

echo "[deploy] Success: $APP_IMAGE"
