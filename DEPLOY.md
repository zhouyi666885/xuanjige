# 玄机阁 - 独立部署文档

## 已完成的扣子脱离工作

| 原扣子能力 | 替换方案 | 备注 |
|---|---|---|
| `coze-coding-dev-sdk.LLMClient` | `openai` SDK + OpenAI 兼容协议 | 通义/豆包/DeepSeek/OpenAI 都支持 |
| `coze-coding-dev-sdk.SearchClient` | Serper / Bing / Tavily Search API | 默认 Serper |
| `coze-coding-dev-sdk.FetchClient` | `axios + cheerio + pdf-parse + mammoth` | HTML/PDF/DOCX/TXT 全支持 |
| `coze-coding-dev-sdk.KnowledgeClient` | 本地 fulltext-search 接管 | stub 兼容旧接口 |
| `coze-coding-dev-sdk.S3Storage` | `@aws-sdk/client-s3` | 兼容 AWS / 阿里云 OSS / MinIO |
| `coze-coding-dev-sdk.HeaderUtils` | stub no-op | 独立部署不需要 trace 透传 |

替换层位置：`src/lib/coze-replacement/`

## 部署前准备

### 1. 必备账号 / Key
- ✅ **LLM**：阿里云百炼 / 豆包 / DeepSeek / OpenAI 任选一个，准备 API Key
- ✅ **Supabase**：注册 [supabase.com](https://supabase.com) 免费项目，拿 URL + anon key + service role key
- ⚠️ **搜索 API**：[serper.dev](https://serper.dev) 注册（每月 2500 次免费）拿 Key。**不填则录入新书功能不可用，已有书籍仍能正常用**
- ⚠️ **对象存储**：可选。不填走本地文件兜底

### 2. 数据库 Schema
在 Supabase 项目里跑一遍 `src/storage/database/schema.sql`（如有），或第一次启动时会自动同步。
**关键表**：`books`、`book_tasks`、`book_task_tombstones`。

## 部署步骤

### 方式 A：Docker Compose（推荐）

```bash
# 1. 把代码扔到服务器
git clone <your-repo> /opt/xuanjige
cd /opt/xuanjige

# 2. 配置环境变量
cp .env.example .env
vim .env  # 填入真实 Key

# 3. 一键启动
docker compose up -d

# 4. 看日志
docker compose logs -f xuanjige
```

服务起来后访问 `http://你的服务器IP:80`。

### 方式 B：直接在服务器上跑（不用 Docker）

```bash
# 1. 装 Node.js 24 + pnpm
curl -fsSL https://nodejs.org/dist/v24.0.0/node-v24.0.0-linux-x64.tar.xz -o node.tar.xz
tar -xJf node.tar.xz -C /usr/local --strip-components=1
npm install -g pnpm

# 2. 配置 + 构建
cd /opt/xuanjige
cp .env.example .env && vim .env
pnpm install
pnpm run build

# 3. 用 PM2 守护
npm install -g pm2
PORT=80 pm2 start "pnpm run start" --name xuanjige
pm2 save && pm2 startup
```

## 验证

```bash
# AI 问答（流式 SSE）
curl -N -X POST http://localhost:80/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"什么是八字","mode":"casual"}'

# 知识库列表
curl http://localhost:80/api/knowledge-base
```

## 注意事项

- **公网域名**：把 `COZE_PROJECT_DOMAIN_DEFAULT` 改成 `https://你的域名.com`（用于分享链接）
- **HTTPS**：建议前置 Nginx + Let's Encrypt 证书；docker-compose 的 80 端口可改 443 并挂载证书
- **首本书录入**：搜索 API 没配的话会显示"搜不到"。已有的 1291 本书在 `public/book-content/` 不受影响

## 完全脱离扣子的验证

```bash
# 应该没有任何 coze 出现
grep -rn "coze-coding-dev-sdk" src/

# 卸载 coze sdk（如果 package.json 还有）
pnpm remove coze-coding-dev-sdk || true
```

之后 `pnpm install && pnpm run build` 应该完全正常。
