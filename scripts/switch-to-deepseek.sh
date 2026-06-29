#!/bin/bash
# 一键切换玄机阁 LLM 到 DeepSeek（不限流、免费额度）
# 用法：bash scripts/switch-to-deepseek.sh

set -e

cd "$(dirname "$0")/.."

echo "==================================="
echo "  玄机阁 - 切换 LLM 到 DeepSeek"
echo "==================================="
echo ""
echo "请先注册 DeepSeek 账号并创建密钥："
echo "  网址：https://platform.deepseek.com/api_keys"
echo ""
read -p "请粘贴你的 DeepSeek 密钥（sk- 开头）然后回车: " MY_KEY

if [ -z "$MY_KEY" ]; then
  echo "❌ 密钥不能为空，已退出"
  exit 1
fi

# 备份
BACKUP_FILE=".env.bak.$(date +%s)"
cp .env "$BACKUP_FILE" 2>/dev/null || touch .env
echo "✅ 已备份原 .env 到 $BACKUP_FILE"

# 移除旧的 LLM 配置行
grep -v -E '^(LLM_API_KEY|LLM_BASE_URL|LLM_MODEL_ID)=' .env > .env.tmp 2>/dev/null || true
mv .env.tmp .env

# 写入新配置
{
  echo ""
  echo "# === DeepSeek 配置（自动生成）==="
  echo "LLM_BASE_URL=https://api.deepseek.com/v1"
  echo "LLM_API_KEY=$MY_KEY"
  echo "LLM_MODEL_ID=deepseek-chat"
} >> .env

echo "✅ .env 已更新"
echo ""
echo "==================================="
echo "  下一步：重启服务"
echo "==================================="
echo ""
echo "请运行："
echo "  pm2 restart 0 --update-env"
echo ""
