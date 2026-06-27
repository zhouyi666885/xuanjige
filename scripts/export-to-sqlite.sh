#!/bin/bash
# ============================================================================
# 玄机阁 → 本地 SQLite 知识库一键导出脚本
#
# 用途：把 public/book-content/ 下 1291 本书全部灌进本地 SQLite + FTS5 全文索引
#       从此玄机阁可以完全不依赖 Supabase 也能跑（数据本地化双备份）
#
# 依赖：
#   - Python 3.8+
#   - book-knowledge-base 技能脚本（位置：/skills/user/book-knowledge-base/scripts/）
#
# 用法：
#   bash scripts/export-to-sqlite.sh                # 默认输出 ./books.db
#   bash scripts/export-to-sqlite.sh /path/books.db # 指定路径
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${1:-${PROJECT_ROOT}/books.db}"
KB_SCRIPTS="/skills/user/book-knowledge-base/scripts"
CONTENT_DIR="${PROJECT_ROOT}/public/book-content"

# 颜色
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'

echo -e "${G}=== 玄机阁本地 SQLite 知识库导出 ===${N}"
echo "项目根目录: ${PROJECT_ROOT}"
echo "输出 DB:    ${DB_PATH}"
echo "书籍源目录: ${CONTENT_DIR}"
echo

# 1. 检查依赖
if ! command -v python3 &>/dev/null; then
  echo -e "${R}[ERR] 未找到 python3，请先安装 Python 3.8+${N}"; exit 1
fi
if [ ! -d "${KB_SCRIPTS}" ]; then
  echo -e "${R}[ERR] 未找到 book-knowledge-base 技能：${KB_SCRIPTS}${N}"
  echo "      请确认技能已在工作区中加载。"
  exit 1
fi
if [ ! -d "${CONTENT_DIR}" ]; then
  echo -e "${Y}[WARN] 未找到 ${CONTENT_DIR}，只会初始化空 DB${N}"
fi

# 2. 初始化 DB
echo -e "${G}[1/3] 初始化 SQLite + FTS5 索引...${N}"
python3 "${KB_SCRIPTS}/init_db.py" --db-path "${DB_PATH}"
echo

# 3. 遍历 public/book-content/ 下所有 .json 书籍文件，逐本导入
echo -e "${G}[2/3] 导入书籍元数据 + 章节全文...${N}"
total=0; ok=0; fail=0
if [ -d "${CONTENT_DIR}" ]; then
  for book_file in "${CONTENT_DIR}"/*.json; do
    [ -f "${book_file}" ] || continue
    total=$((total + 1))
    book_name="$(basename "${book_file}" .json)"

    # 提取元数据：title / author / category（容错：缺字段时用文件名）
    title=$(python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    print(d.get('name') or d.get('title') or sys.argv[2])
except Exception:
    print(sys.argv[2])
" "${book_file}" "${book_name}")
    author=$(python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    print(d.get('author', '') or '')
except Exception:
    print('')
" "${book_file}")
    category=$(python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    print(d.get('category', '') or '')
except Exception:
    print('')
" "${book_file}")

    # 添加书籍元数据
    book_id=$(python3 "${KB_SCRIPTS}/book_ops.py" --db-path "${DB_PATH}" add \
      --title "${title}" \
      --author "${author}" \
      --category "${category}" \
      --description "玄机阁导入: ${book_name}" 2>/dev/null \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null) || book_id=""

    if [ -z "${book_id}" ]; then
      fail=$((fail + 1))
      echo -e "  ${Y}[skip]${N} ${title}（元数据已存在或失败）"
      continue
    fi

    # 导入章节全文
    python3 "${KB_SCRIPTS}/content_ops.py" --db-path "${DB_PATH}" import-chapters \
      --book-id "${book_id}" --file "${book_file}" >/dev/null 2>&1 \
      && { ok=$((ok + 1)); echo -e "  ${G}[ok]${N}   ${title} (id=${book_id})"; } \
      || { fail=$((fail + 1)); echo -e "  ${R}[fail]${N} ${title}（章节导入失败）"; }
  done
fi
echo

# 4. 输出统计
echo -e "${G}[3/3] 导出完成${N}"
echo "  总扫描: ${total}"
echo "  成功:   ${ok}"
echo "  跳过/失败: ${fail}"
echo
python3 "${KB_SCRIPTS}/book_ops.py" --db-path "${DB_PATH}" stats || true
echo
echo -e "${G}✓ SQLite 文件已生成：${DB_PATH}${N}"
echo
echo "后续可直接使用本地全文检索（不再依赖 Supabase）："
echo "  python3 ${KB_SCRIPTS}/search_books.py --db-path ${DB_PATH} content-search --query \"印星\""
