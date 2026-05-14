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
# 构建阶段跳过环境变量验证（运行时由 docker-compose 注入真实值）
ENV SKIP_ENV_VALIDATION=1
RUN pnpm prisma generate
RUN pnpm build

# ---------- app (Next.js standalone) ----------
FROM node:22-alpine AS app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg wget
WORKDIR /app

# standalone 产物已包含运行所需的 node_modules（含 .prisma 客户端）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prompts ./prompts

# 本地资产目录（由 docker-compose volume 挂载）
RUN mkdir -p .local-assets

# 启动时自动运行数据库迁移，再启动应用
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]

# ---------- worker (BullMQ) ----------
FROM node:22-alpine AS worker
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prompts ./prompts

RUN mkdir -p .local-assets

CMD ["pnpm", "start:worker"]
