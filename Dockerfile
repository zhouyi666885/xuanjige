# ===== Stage 1: Build =====
FROM node:24-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@9

# 先复制依赖描述文件，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig.json next.config.* postcss.config.* .babelrc* ./

RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码并构建
COPY src ./src
COPY public ./public
COPY scripts ./scripts

RUN pnpm run build

# ===== Stage 2: Runtime =====
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9

# 复制 production 必要文件
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.* ./

EXPOSE 5000

# 端口由 PORT / DEPLOY_RUN_PORT 决定（兼容原沙箱变量）
CMD ["sh", "-c", "PORT=${PORT:-5000} DEPLOY_RUN_PORT=${PORT:-5000} pnpm exec next start -p ${PORT:-5000}"]
