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
# OpenSSL 供 Prisma schema engine 使用
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
# 明确告知 Prisma 生成 linux-musl-openssl-3.0.x 二进制（Alpine + OpenSSL 3）
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"
# NEXT_PUBLIC_APP_URL 在构建时烘焙进 JS bundle，运行时 .env 无效
# 构建时必须传入：docker build --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN mkdir -p public
RUN pnpm prisma generate
RUN pnpm build

# ---------- app（Next.js + Worker 合并单容器）----------
FROM node:22-alpine AS app
ENV NODE_ENV=production
# OpenSSL + ffmpeg + wget（Prisma 运行时 + 视频合成 + 健康检查）
RUN apk add --no-cache openssl ffmpeg wget
WORKDIR /app

# Next.js standalone 产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema（迁移用）
COPY --from=builder /app/prisma ./prisma

# Prisma CLI 配置（v7 必需）
COPY --from=builder /app/prisma.config.ts ./

# Worker 源码 + 完整 node_modules（含 tsx + Prisma 二进制）
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# 提示词模板（可通过 volume 覆盖）
COPY --from=builder /app/prompts ./prompts

# 运维脚本
COPY --from=builder /app/scripts ./scripts

# 本地资产目录
RUN mkdir -p .local-assets

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
