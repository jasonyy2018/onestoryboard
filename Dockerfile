# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN mkdir -p public
RUN pnpm prisma generate
RUN pnpm build

# ---------- app（Next.js + Worker 合并单容器）----------
FROM base AS app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg wget
WORKDIR /app

# Next.js standalone 产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema（迁移用）
COPY --from=builder /app/prisma ./prisma

# Worker 源码 + 依赖（tsx 运行）
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# 提示词模板（可通过 volume 覆盖）
COPY --from=builder /app/prompts ./prompts

# 本地资产目录
RUN mkdir -p .local-assets

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
