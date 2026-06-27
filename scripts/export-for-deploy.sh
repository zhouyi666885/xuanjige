#!/bin/bash
# ============================================================================
# 玄机阁 → 一键导出 + 部署到自己 Linux 服务器
#
# 用途：基于 project-export-deploy 技能，一条命令完成：
#   1. 项目打包成 tar.gz
#   2. 生成 deploy.sh（含 Nginx 反向代理 + Systemd 守护）
#   3. 提示用户上传到服务器执行
#
# 用法：
#   bash scripts/export-for-deploy.sh
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="${PROJECT_ROOT}/export"
EXPORT_SCRIPTS="/skills/user/project-export-deploy/scripts"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'

echo -e "${G}=== 玄机阁一键导出 + 部署包生成 ===${N}"
echo "项目根目录: ${PROJECT_ROOT}"
echo "导出目录:   ${EXPORT_DIR}"
echo

# 1. 检查依赖
if ! command -v python3 &>/dev/null; then
  echo -e "${R}[ERR] 未找到 python3${N}"; exit 1
fi
if [ ! -d "${EXPORT_SCRIPTS}" ]; then
  echo -e "${R}[ERR] 未找到 project-export-deploy 技能：${EXPORT_SCRIPTS}${N}"
  exit 1
fi

mkdir -p "${EXPORT_DIR}"

# 2. 项目分析 + 打包
echo -e "${G}[1/3] 分析项目并打包...${N}"
python3 "${EXPORT_SCRIPTS}/export_project.py" \
  --source "${PROJECT_ROOT}" \
  --output "${EXPORT_DIR}/xuanjige.tar.gz" \
  --exclude "node_modules" ".next" "data" "logs" ".git" "books.db" "export" \
  || { echo -e "${R}[ERR] 打包失败${N}"; exit 1; }
echo

# 3. AI 配置模板（默认通义千问，可在服务器上改 .env）
echo -e "${G}[2/3] 生成 AI 配置模板（默认通义千问）...${N}"
python3 "${EXPORT_SCRIPTS}/modify_ai_config.py" \
  --config-file "${EXPORT_DIR}/ai_config.yaml" \
  --provider qwen \
  --api-key "YOUR_QWEN_API_KEY" \
  --model "qwen-plus" \
  --with-env \
  2>/dev/null || true
echo

# 4. 生成一键部署脚本
echo -e "${G}[3/3] 生成服务器端 deploy.sh...${N}"
python3 "${EXPORT_SCRIPTS}/generate_deploy.py" \
  --project-name xuanjige \
  --project-type nodejs \
  --port 5000 \
  --output-dir "${EXPORT_DIR}/deploy-scripts" \
  --with-nginx \
  --with-systemd \
  || { echo -e "${R}[ERR] 生成部署脚本失败${N}"; exit 1; }
echo

# 5. 输出操作指引
echo -e "${G}=========================================${N}"
echo -e "${G}  导出完成！${N}"
echo -e "${G}=========================================${N}"
echo
echo "产物清单（位于 ${EXPORT_DIR}/）："
echo "  - xuanjige.tar.gz       项目代码包"
echo "  - ai_config.yaml        AI 配置模板（默认通义千问）"
echo "  - deploy-scripts/       一键部署脚本（含 Nginx + Systemd）"
echo
echo -e "${Y}部署到你自己的 Linux 服务器（4 步）：${N}"
echo
echo "  1. 上传文件："
echo "     scp ${EXPORT_DIR}/xuanjige.tar.gz root@<SERVER_IP>:/opt/"
echo "     scp -r ${EXPORT_DIR}/deploy-scripts root@<SERVER_IP>:/opt/"
echo
echo "  2. SSH 登录服务器："
echo "     ssh root@<SERVER_IP>"
echo
echo "  3. 解压 + 一键部署（在服务器上执行）："
echo "     cd /opt && tar -xzf xuanjige.tar.gz && cd xuanjige"
echo "     cp /opt/deploy-scripts/deploy.sh ."
echo "     bash deploy.sh"
echo
echo "  4. deploy.sh 执行完会自动输出访问地址："
echo "     http://<SERVER_IP>  (走 Nginx 80 端口)"
echo
echo -e "${Y}部署前请编辑 .env，填入你的 LLM_API_KEY${N}"
