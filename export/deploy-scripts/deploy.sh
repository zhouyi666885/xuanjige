#!/bin/bash
# ================================================================
#  一键部署脚本 - xuanjige (Node.js)
#  使用方式: 上传项目文件到 /opt/xuanjige 后执行 bash deploy.sh
# ================================================================
set -e

WORK_DIR="/opt/xuanjige"
PROJECT_NAME="xuanjige"
PORT=5000

echo "=========================================="
echo "  一键部署: $PROJECT_NAME (Node.js)"
echo "=========================================="

# ---------- 环境准备 ----------

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    echo "[INFO] 操作系统: $OS $VERSION_ID"
else
    echo "[ERROR] 无法检测操作系统"
    exit 1
fi

echo "[1/5] 更新系统包..."
case "$OS" in
    ubuntu|debian)
        apt-get update -y -qq
        ;;
    centos|rhel|rocky|almalinux)
        yum update -y -q || dnf update -y -q
        ;;
esac

echo "[2/5] 安装 Node.js 20.x..."
case "$OS" in
    ubuntu|debian)
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs curl
        ;;
    centos|rhel|rocky|almalinux)
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y -q nodejs curl || dnf install -y -q nodejs curl
        ;;
esac

npm install -g pm2 -q 2>/dev/null

# ---------- 项目部署 ----------

echo "[3/5] 准备项目..."
mkdir -p $WORK_DIR

if [ ! -f "$WORK_DIR/package.json" ]; then
    echo "[ERROR] 未找到 package.json: $WORK_DIR"
    exit 1
fi

cd $WORK_DIR
echo "[4/5] 安装依赖并构建..."
if [ -f "package-lock.json" ]; then
    npm ci --production -q
else
    npm install --production -q
fi

if grep -q '"build"' package.json 2>/dev/null; then
    npm run build
fi

# 加载配置
if [ -f "$WORK_DIR/../ai_config.yaml" ]; then
    cp $WORK_DIR/../ai_config.yaml $WORK_DIR/ai_config.yaml
fi
if [ -f "$WORK_DIR/../.env" ]; then
    cp $WORK_DIR/../.env $WORK_DIR/.env
fi

echo "[5/5] 启动服务..."
export PORT=$PORT
if pm2 describe $PROJECT_NAME > /dev/null 2>&1; then
    pm2 restart $PROJECT_NAME
else
    pm2 start package.json --name $PROJECT_NAME
fi
pm2 save 2>/dev/null
pm2 startup 2>/dev/null || true

sleep 3

# ============================================
# 获取访问地址
# ============================================
PUBLIC_IP=""
# 尝试多种方式获取公网 IP
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 https://ifconfig.me 2>/dev/null || \
                curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null || \
                curl -s --connect-timeout 3 https://ipinfo.io/ip 2>/dev/null || \
                echo "")
fi

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="YOUR_SERVER_IP"
fi

echo ""
echo "=========================================="
echo "  部署成功!"
echo "=========================================="
echo ""
echo "  访问地址: http://${PUBLIC_IP}:${PORT}"
echo ""
echo "  如果无法访问，请检查:"
echo "  1. 服务器安全组/防火墙是否已开放 ${PORT} 端口"
echo "  2. 服务是否正常运行: ps aux | grep ${PROJECT_NAME}"
echo "  3. 查看日志: tail -50 ${WORK_DIR}/app.log"
echo ""
echo "=========================================="
