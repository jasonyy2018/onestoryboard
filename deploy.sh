#!/bin/bash
set -euo pipefail

# =============================================================
# AI 短剧生成器 · 一键部署脚本（Ubuntu + Docker）
# 用法：bash deploy.sh [--pull]
# =============================================================

COMPOSE="docker compose"
ENV_FILE=".env"

echo "🎬 AI 短剧生成器 · 部署开始"

# 检查 .env
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 未找到 .env 文件，请先复制 .env.example 并填入配置："
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# 检查必须的环境变量
required_vars=(
  "POSTGRES_PASSWORD"
  "VOLCENGINE_ARK_API_KEY"
  "TENCENT_SECRET_ID"
  "TENCENT_SECRET_KEY"
  "TENCENT_VOD_SUB_APP_ID"
  "ALIBABA_DASHSCOPE_API_KEY"
  "NEXT_PUBLIC_APP_URL"
)

missing=()
for var in "${required_vars[@]}"; do
  val=$(grep -E "^${var}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  if [ -z "$val" ] || [[ "$val" == *"your_"* ]]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ 以下环境变量未配置："
  for v in "${missing[@]}"; do echo "   - $v"; done
  echo "请编辑 .env 后重新运行"
  exit 1
fi

# 检查 NEXT_PUBLIC_APP_URL 是否为 localhost（Seedance 需要公网访问图片）
APP_URL=$(grep -E "^NEXT_PUBLIC_APP_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [[ "$APP_URL" == *"localhost"* ]]; then
  echo "⚠️  警告：NEXT_PUBLIC_APP_URL 为 localhost，Seedance 云端无法访问本地图片"
  echo "   请设置为服务器公网域名，例如：NEXT_PUBLIC_APP_URL=https://your-domain.com"
  echo "   继续？(y/N)"
  read -r ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
fi

# 拉取代码（可选）
if [[ "${1:-}" == "--pull" ]]; then
  echo "📥 拉取最新代码..."
  git pull
fi

# 创建本地目录（bind mount 需要预先存在）
echo "📁 创建本地目录..."
mkdir -p assets/projects
mkdir -p data/postgres
mkdir -p data/redis

# 设置目录权限（postgres 容器以 uid 999 运行）
chown -R 999:999 data/postgres 2>/dev/null || true

echo "🔨 构建镜像..."
$COMPOSE build --no-cache

echo "🛑 停止旧服务..."
$COMPOSE down --remove-orphans

echo "🚀 启动服务..."
$COMPOSE up -d

echo "⏳ 等待服务就绪..."
sleep 15

echo "🔄 运行 Prisma 生成客户端..."
$COMPOSE exec -T app npx prisma generate || echo "⚠️  prisma generate 失败（可手动重试）"

echo "🔄 同步数据库 Schema..."
$COMPOSE exec -T app npx prisma db push || echo "⚠️  prisma db push 失败（可手动重试：npx prisma db push）"

echo "✅ 部署完成！"
echo ""
echo "服务状态："
$COMPOSE ps

echo ""
echo "项目目录结构："
echo "  ./assets/       — 生成的图片和视频文件"
echo "  ./data/postgres — 数据库数据"
echo "  ./data/redis    — Redis 持久化数据"
echo "  ./prompts/      — 提示词模板（修改后无需重建镜像）"
echo ""
echo "常用命令："
echo "  $COMPOSE logs -f app     # 查看应用日志"
echo "  $COMPOSE logs -f worker  # 查看 Worker 日志"
echo "  $COMPOSE restart app     # 重启应用"
echo "  ls -lh assets/projects/  # 查看生成的素材文件"
