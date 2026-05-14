#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Starting Next.js app..."
node server.js &
APP_PID=$!

echo "[entrypoint] Starting BullMQ worker..."
node_modules/.bin/tsx src/lib/queue/workers/index.ts &
WORKER_PID=$!

echo "[entrypoint] Both processes running. App PID=$APP_PID, Worker PID=$WORKER_PID"

# 任意一个进程退出则整体退出（避免僵尸状态）
wait -n
EXIT_CODE=$?
echo "[entrypoint] A process exited (code=$EXIT_CODE), shutting down..."
kill $APP_PID $WORKER_PID 2>/dev/null || true
exit $EXIT_CODE
