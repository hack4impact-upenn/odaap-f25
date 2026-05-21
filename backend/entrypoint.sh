#!/bin/sh
# Cloud Run entrypoint: run migrations (best-effort, time-boxed) then start gunicorn.
# Migrate failures are logged but do not block startup — gunicorn must bind to PORT
# within Cloud Run's startup window or the deploy fails.

echo "[entrypoint] Running migrations (90s timeout)..."
if timeout 90s python manage.py migrate --noinput 2>&1; then
  echo "[entrypoint] Migrations OK."
else
  echo "[entrypoint] WARNING: migrate exited non-zero or timed out. Continuing to gunicorn." >&2
fi

echo "[entrypoint] Starting gunicorn on port ${PORT:-8080}"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers 2 \
  --threads 4 \
  --timeout 60
