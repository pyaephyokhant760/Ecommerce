#!/bin/sh
# ---------------------------------------------------------------------------
# Container entrypoint for the API.
#
# `mongod` is started as a single-node replica set by docker-compose, so the
# healthcheck only proves the process is up - it does NOT prove the node has
# been elected PRIMARY yet. Prisma cannot write until it has, so we retry
# `prisma db push` until it succeeds instead of crashing on boot.
# ---------------------------------------------------------------------------
set -e

if [ "${SKIP_DB_PUSH:-0}" != "1" ]; then
  echo "==> Syncing Prisma schema with MongoDB (prisma db push)..."

  attempt=1
  max_attempts="${DB_PUSH_MAX_ATTEMPTS:-40}"

  until npx prisma db push --skip-generate; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "!! Could not sync the database schema after $attempt attempts." >&2
      echo "!! Is the 'mongo' service running with --replSet rs0?" >&2
      exit 1
    fi

    echo "   MongoDB is not PRIMARY yet (attempt $attempt/$max_attempts) - retrying in 3s..."
    attempt=$((attempt + 1))
    sleep 3
  done

  echo "==> Database schema is in sync."
fi

exec "$@"
