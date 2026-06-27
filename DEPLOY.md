# 玄机阁 - 完全独立部署文档

> 本项目已**彻底脱离扣子平台**，可部署在任意云服务器，运行成本只包含你自己的服务器 + LLM API Key + Supabase 免费配额。

---

## 一、改造完成清单

| 原扣子能力 | 替换方案 | 状态 |
|---|---|---|
| `coze-coding-dev-sdk.LLMClient` | `openai` SDK + OpenAI 兼容协议（通义千问/豆包/DeepSeek/OpenAI 通用） | ✅ |
| `coze-coding-dev-sdk.SearchClient` | Serper / Bing / Tavily Search API（默认 Serper） | ✅ |
| `coze-coding-dev-sdk.FetchClient` | `axios + cheerio + pdf-parse + mammoth` | ✅ |
| `coze-coding-dev-sdk.KnowledgeClient` | 本地 fulltext-search 接管全文检索 | ✅ |
| `coze-coding-dev-sdk.S3Storage` | `@aws-sdk/client-s3`（AWS / 阿里云 OSS / MinIO 通用） | ✅ |
| `coze-coding-dev-sdk.HeaderUtils` | stub no-op | ✅ |
| `coze_workload_identity`（扣子注入环境变量） | 标准 `.env` + `dotenv` | ✅ |
| `COZE_SUPABASE_*` / `COZE_BUCKET_*` 硬编码命名 | 兼容标准命名（`NEXT_PUBLIC_SUPABASE_*` / `S3_*`） | ✅ |

替换层位置：`src/lib/coze-replacement/`

`package.json` 已移除 `coze-coding-dev-sdk` 依赖，`grep -rn coze-coding-dev-sdk src/ scripts/` 结果应为空。

---

## 二、准备工作

### 2.1 你需要准备的账号 / Key

| 项 | 必填 | 说明 |
|---|---|---|
| **LLM API Key** | ✅ 必填 | 阿里云百炼 / 豆包 / DeepSeek / OpenAI 任选一个。本项目默认对接**阿里云百炼（通义千问）**。在 https://bailian.console.aliyun.com/ 创建 API Key |
| **Supabase** | ✅ 必填 | 注册 https://supabase.com 免费项目，获取 `URL` + `anon key` + `service role key` |
| **Serper Search API** | 选填 | https://serper.dev 注册（每月 2500 次免费）。**不填则"自动录入新书"功能不可用，已有 1291 本书完全不受影响** |
| **对象存储** | 选填 | 阿里云 OSS / AWS S3 / MinIO。不填走本地文件兜底，单机部署完全够用 |

### 2.2 服务器要求

- 操作系统：Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / 其他 Linux 均可
- CPU：1 核起步（推荐 2 核+）
- 内存：2GB 起步（推荐 4GB+，因为有 1291 本书索引）
- 磁盘：5GB+
- Node.js：**24.x**（必须）
- 网络：能访问阿里云百炼（或你选用的 LLM 供应商）

---

## 三、部署方案

### 方案 A：一键脚本（最简单）

```bash
# 1. 拉代码
git clone <your-repo-url> /opt/xuanjige
cd /opt/xuanjige

# 2. 跑一键脚本（首次会生成 .env 模板并提示你填 Key）
bash deploy.sh

# 3. 编辑 .env 填入真实 Key
vim .env
#   LLM_API_KEY=sk-xxxxxxxxxxxxx   # 阿里云百炼 Key
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SEARCH_API_KEY=...             # 选填

# 4. 再跑一次脚本完成安装/构建
bash deploy.sh

# 5. 用 PM2 守护进程后台运行
npm install -g pm2
PORT=80 pm2 start "pnpm run start" --name xuanjige
pm2 save
pm2 startup    # 跟着提示再执行一行 systemctl 命令即可开机自启
```

打开浏览器访问 `http://你的服务器IP` 即可。

### 方案 B：手动 4 步（更可控）

```bash
# 1. 装 Node.js 24 + pnpm
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm pm2

# 2. 代码 + 配置
git clone <your-repo-url> /opt/xuanjige && cd /opt/xuanjige
cp .env.example .env && vim .env   # 填 Key

# 3. 装依赖 + 构建
pnpm install
pnpm run build

# 4. 启动
PORT=80 pm2 start "pnpm run start" --name xuanjige
pm2 save && pm2 startup
```

---

## 四、配置文件说明（.env）

只需填这一个文件就能切换 LLM 供应商：

```bash
# ===== LLM API（必填）—— 默认对接阿里云百炼 =====
LLM_API_KEY=sk-你的Key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus

# 想切到豆包？把上面 3 行换成：
# LLM_API_KEY=你的火山方舟Key
# LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
# LLM_MODEL=doubao-seed-1-6-pro

# 想切到 DeepSeek？
# LLM_API_KEY=sk-xxx
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_MODEL=deepseek-chat

# 想切到 OpenAI？
# LLM_API_KEY=sk-xxx
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_MODEL=gpt-4o-mini

# ===== Supabase（必填，存书籍/任务/录入历史）=====
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# ===== 搜索 API（可选）=====
SEARCH_PROVIDER=serper
SEARCH_API_KEY=你的serper-key

# ===== 对象存储（可选）=====
S3_ENDPOINT_URL=
S3_REGION=cn-beijing
S3_BUCKET_NAME=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# ===== 服务端口 =====
PORT=5000
```

**核心要点：换 LLM 只需要改 3 行（KEY / BASE_URL / MODEL），代码一行不用动。**

---

## 五、验证部署

```bash
# 1. 静态接口
curl http://localhost:80/api/knowledge-base | head -c 500

# 2. AI 问答（流式 SSE）
curl -N -X POST http://localhost:80/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"什么是八字","mode":"casual"}'

# 3. 没有任何 coze SDK 残留
grep -rn "from 'coze-coding-dev-sdk'" src/ scripts/   # 应输出空
ls node_modules/coze-coding-dev-sdk 2>&1              # 应 No such file
```

---

## 六、Nginx + HTTPS（可选，生产推荐）

```nginx
# /etc/nginx/sites-available/xuanjige
server {
  listen 80;
  server_name 你的域名.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name 你的域名.com;
  ssl_certificate     /etc/letsencrypt/live/你的域名.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;          # SSE 流式必须关
    proxy_read_timeout 600s;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/xuanjige /etc/nginx/sites-enabled/
sudo certbot --nginx -d 你的域名.com
sudo nginx -t && sudo systemctl reload nginx
```

---

## 七、运行成本估算

| 项 | 月成本 |
|---|---|
| 云服务器（2C4G） | ¥60-100 |
| 阿里云百炼 qwen-plus | 按量计费，¥0.0008/千 input tokens、¥0.002/千 output tokens（轻量使用 < ¥20/月） |
| Supabase 免费档 | ¥0（500MB 数据库 + 5GB 流量足够个人使用） |
| Serper（选填） | 2500 次/月免费，超出 ¥0.001/次 |
| **扣子平台费** | **¥0**（已完全脱离） |

总计：个人使用约 **¥80-150/月**，零平台抽成。

---

## 八、常见问题

**Q：换 LLM 供应商代码要不要改？**
A：不用。只改 `.env` 里的 3 个变量（KEY / BASE_URL / MODEL）即可，所有 LLM 调用走统一的 OpenAI 兼容协议。

**Q：能不能完全离线部署？**
A：LLM 调用必须联网（除非自建 vLLM/Ollama 本地模型，把 `LLM_BASE_URL` 指向 `http://localhost:11434/v1` 即可）。数据库可以自建 PostgreSQL 替代 Supabase。

**Q：知识库的 1291 本书在哪？**
A：`public/book-content/` 目录下，每本书一个 JSON 文件，部署时一起带上即可。

**Q：扣子时代留下的 `COZE_SUPABASE_URL` 等环境变量名还能用吗？**
A：能。代码做了向后兼容——优先读标准名，回退到 `COZE_*` 旧名，存量配置不用改。

---

✅ **改造已完成**。你现在拥有一个 100% 独立、零平台依赖、可移植到任意服务器的"玄机阁"。
