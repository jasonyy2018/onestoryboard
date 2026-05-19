#!/bin/sh

echo "[entrypoint] Applying database schema..."

# 项目使用 prisma db push（无 migrations 目录）
# --skip-generate: 镜像里已预先生成 client，无需重复
RETRIES=12
COUNT=0
until node_modules/.bin/prisma db push --skip-generate; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $RETRIES ]; then
    echo "[entrypoint] Schema push failed after $RETRIES attempts, aborting."
    exit 1
  fi
  echo "[entrypoint] Schema push failed (attempt $COUNT/$RETRIES), retrying in 5s..."
  sleep 5
done

echo "[entrypoint] Schema ready."

echo "[entrypoint] Starting Next.js app..."
HOSTNAME=0.0.0.0 node server.js &
APP_PID=$!

echo "[entrypoint] Starting BullMQ worker..."
node_modules/.bin/tsx src/lib/queue/workers/index.ts &
WORKER_PID=$!

echo "[entrypoint] Running. App PID=$APP_PID Worker PID=$WORKER_PID"

# Alpine busybox sh 不支持 wait -n，轮询检查进程存活
while true; do
  sleep 5
  if ! kill -0 $APP_PID 2>/dev/null; then
    echo "[entrypoint] Next.js process exited, shutting down worker..."
    kill $WORKER_PID 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 $WORKER_PID 2>/dev/null; then
    echo "[entrypoint] Worker process exited, restarting worker..."
    # Worker 崩溃时只重启 worker，不影响 Next.js
    node_modules/.bin/tsx src/lib/queue/workers/index.ts &
    WORKER_PID=$!
    echo "[entrypoint] Worker restarted. New PID=$WORKER_PID"
  fi
done
