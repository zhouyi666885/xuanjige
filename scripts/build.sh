#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

# 排除大文件目录，避免部署包过大
echo "Removing large content directories from public/ before build..."
rm -rf public/book-content/ public/book-content-en-backup/ public/book-tasks.json public/book-learn-status.json public/book-s3-index.json 2>/dev/null || true

echo "Building the Next.js project..."
pnpm next build

echo "Stripping sourcemaps from .next/server to keep Netlify function under 50MB limit..."
find .next/server -name "*.map" -type f -delete 2>/dev/null || true
find .next/standalone -name "*.map" -type f -delete 2>/dev/null || true
echo "Sourcemap cleanup done. Remaining .next size:"
du -sh .next/server 2>/dev/null || true

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
