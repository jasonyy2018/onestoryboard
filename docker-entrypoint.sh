#!/bin/sh

echo "[entrypoint] Running database migrations..."

# migrate 失败时重试，最多等 60 秒（db 容器可能还没完全就绪）
RETRIES=12
COUNT=0
until node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $RETRIES ]; then
    echo "[entrypoint] Migration failed after $RETRIES attempts, aborting."
    exit 1
  fi
  echo "[entrypoint] Migration failed (attempt $COUNT/$RETRIES), retrying in 5s..."
  sleep 5
done

echo "[entrypoint] Migrations complete."

echo "[entrypoint] Starting Next.js app..."
node server.js &
APP_PID=$!

echo "[entrypoint] Starting BullMQ worker..."
node_modules/.bin/tsx src/lib/queue/workers/index.ts &
WORKER_PID=$!

echo "[entrypoint] Running. App PID=$APP_PID Worker PID=$WORKER_PID"

# 任意一个进程退出则整体退出
wait -n
EXIT_CODE=$?
echo "[entrypoint] A process exited (code=$EXIT_CODE), shutting down..."
kill $APP_PID $WORKER_PID 2>/dev/null || true
exit $EXIT_CODE
