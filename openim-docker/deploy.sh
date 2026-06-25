#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "Please edit SPACE_ADMIN_PASSWORD, SPACE_ADMIN_SESSION_SECRET, and MINIO_EXTERNAL_ADDRESS, then rerun ./deploy.sh"
  exit 0
fi

if grep -q '^SPACE_ADMIN_PASSWORD=password123$' .env; then
  echo "Warning: SPACE_ADMIN_PASSWORD is still the default value."
fi

if grep -q '^SPACE_ADMIN_SESSION_SECRET=change-me$' .env; then
  echo "Warning: SPACE_ADMIN_SESSION_SECRET is still the default value."
fi

if grep -q '^MINIO_EXTERNAL_ADDRESS=http://your-domain-or-ip:10005$' .env; then
  echo "Warning: MINIO_EXTERNAL_ADDRESS still points to the placeholder host."
fi

docker compose up -d --build
docker compose ps
