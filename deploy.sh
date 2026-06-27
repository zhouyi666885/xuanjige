#!/usr/bin/env bash
# ============================================================
# 玄机阁 - 一键独立部署脚本
# 适用于 Ubuntu 20.04 / 22.04 / 24.04 / Debian 11+ / CentOS 8+
# 也兼容其他 Linux 发行版（手动装 Node.js 24 后跳过环境步骤）
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_REQUIRED_MAJOR=24

cd "$APP_DIR"
echo "=========================================="
echo "  玄机阁 - 独立部署脚本"
echo "  工作目录：$APP_DIR"
echo "=========================================="

# 1. 检查 Node.js
echo ""
echo "[1/6] 检查 Node.js 环境..."
if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ 未检测到 node。请先安装 Node.js ${NODE_REQUIRED_MAJOR}+："
  echo "     curl -fsSL https://deb.nodesource.com/setup_${NODE_REQUIRED_MAJOR}.x | sudo bash -"
  echo "     sudo apt install -y nodejs"
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
if [ "$NODE_MAJOR" -lt "$NODE_REQUIRED_MAJOR" ]; then
  echo "  ❌ Node.js 版本过低（当前 v$NODE_MAJOR，需要 v$NODE_REQUIRED_MAJOR+）"
  exit 1
fi
echo "  ✅ Node.js $(node -v)"

# 2. 检查 / 安装 pnpm
echo ""
echo "[2/6] 检查 pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  📦 安装 pnpm..."
  npm install -g pnpm
fi
echo "  ✅ pnpm $(pnpm -v)"

# 3. 配置 .env
echo ""
echo "[3/6] 配置环境变量..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "  📝 已从 .env.example 生成 .env"
    echo "  ⚠️  请编辑 .env 填入真实的 API Key："
    echo "     - LLM_API_KEY    （阿里云百炼 / 豆包 / DeepSeek / OpenAI）"
    echo "     - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "     - SUPABASE_SERVICE_ROLE_KEY"
    echo "     - SEARCH_API_KEY （可选，用于自动录入新书）"
    echo ""
    echo "  填完后重跑：bash deploy.sh"
    exit 0
  else
    echo "  ❌ 未找到 .env.example，请检查代码完整性"
    exit 1
  fi
fi
# 校验必填项
if ! grep -qE '^LLM_API_KEY=.+' .env || grep -qE '^LLM_API_KEY=你的' .env; then
  echo "  ❌ .env 里 LLM_API_KEY 未配置或仍是占位符，请先填真实 Key"
  exit 1
fi
echo "  ✅ .env 已就绪"

# 4. 安装依赖
echo ""
echo "[4/6] 安装依赖..."
pnpm install --frozen-lockfile || pnpm install
echo "  ✅ 依赖安装完成"

# 5. 构建生产版本
echo ""
echo "[5/6] 构建生产版本..."
pnpm run build
echo "  ✅ 构建完成"

# 6. 启动服务
echo ""
echo "[6/6] 启动服务..."
PORT=${PORT:-5000}
echo "  🚀 服务将监听端口 $PORT"
echo ""
echo "  推荐用 PM2 守护进程："
echo "    npm install -g pm2"
echo "    PORT=$PORT pm2 start \"pnpm run start\" --name xuanjige"
echo "    pm2 save && pm2 startup"
echo ""
echo "  或直接前台运行："
echo "    PORT=$PORT pnpm run start"
echo ""
echo "=========================================="
echo "  ✅ 部署准备完成！"
echo "=========================================="
