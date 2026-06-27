# 玄机阁书籍录入工具（独立 SQLite 版）

> 完全脱离扣子的本地化书籍录入方案。零外部依赖，所有数据存在你自己的服务器上。

## 何时使用本工具

- 当扣子搜索 API 失效 / 没填 Serper Key 时
- 想把书籍数据彻底本地化，不依赖 Supabase 也能用
- 需要批量录入大量书籍，命令行操作效率更高
- 需要断点续录、完整性校验等高级功能

## 前置准备

服务器需要装 Python 3.8+（绝大多数 Linux 自带）：

```bash
python3 --version  # 应输出 3.8 以上
```

不需要 pip 安装任何包，脚本只用 Python 标准库。

## 完整使用流程（5 个步骤）

### 1. 初始化数据库

```bash
cd /opt/xuanjige  # 你部署玄机阁的目录
python3 scripts/book-entry/db_manager.py init --db ./xuanjige.db
```

执行后会在当前目录生成 `xuanjige.db` 文件，里面预创建 `books` 表和 `chapters` 表。

### 2. 添加一本书的元数据

```bash
python3 scripts/book-entry/db_manager.py add-book \
  --db ./xuanjige.db \
  --title "三命通会" \
  --author "万民英" \
  --language "zh" \
  --description "明代命理学集大成之作，十二卷"
```

返回 JSON 里包含 `book_id`，记下这个 ID。

### 3. 录入章节内容

每个章节单独入库（也可写脚本批量循环）：

```bash
python3 scripts/book-entry/db_manager.py add-chapter \
  --db ./xuanjige.db \
  --book-id 1 \
  --chapter-num 1 \
  --title "卷一·原造化之始" \
  --content "天地未判，其名混沌；乾坤未分..."
```

**铁律**：
- 章节顺序必须严格从第 1 章到最后一章，不能跳号
- 一字不漏，从第一字到最后一字
- 同一章多来源时取最完整版本

### 4. 检查录入进度

```bash
python3 scripts/book-entry/db_manager.py book-status \
  --db ./xuanjige.db \
  --book-id 1
```

返回已录入章节数、总字数、最后章节号。

### 5. 导出完整书籍

```bash
python3 scripts/book-entry/db_manager.py get-full \
  --db ./xuanjige.db \
  --book-id 1 \
  --output ./output/三命通会.txt
```

## 其他命令

| 命令 | 作用 |
|---|---|
| `list-books` | 列出数据库里所有书 |
| `get-book` | 看某本书的章节列表 |
| `get-chapter` | 看某一章的全文 |
| `delete-book` | 删除整本书（连同所有章节级联删除）|
| `update-status` | 更新书籍状态（`pending` / `in_progress` / `completed`）|

补录某一章时，直接重新执行 `add-chapter --chapter-num <要补的章号>`，脚本会按 `UNIQUE(book_id, chapter_num)` 自动覆盖更新，不需要手动先删后加。

完整参数说明：

```bash
python3 scripts/book-entry/db_manager.py --help
```

## 自动化录入示例脚本

如果你的章节正文已经爬到本地文件（每章一个 .txt），可以写个 shell 一键批量入库：

```bash
#!/bin/bash
DB="./xuanjige.db"
BOOK_ID=1
CHAPTERS_DIR="./tmp/三命通会-章节"

for txt in $(ls $CHAPTERS_DIR/*.txt | sort); do
  # 从文件名解析章节号（如 ch001-卷一原造化之始.txt → 1）
  num=$(echo $(basename "$txt") | grep -oE '[0-9]+' | head -1)
  title=$(basename "$txt" .txt | sed 's/^ch[0-9]*-//')
  content=$(cat "$txt")
  python3 scripts/book-entry/db_manager.py add-chapter \
    --db "$DB" \
    --book-id "$BOOK_ID" \
    --chapter-num "$num" \
    --title "$title" \
    --content "$content"
  echo "[已入库] 第${num}章 $title"
done

echo "全书录入完成。验证完整性："
python3 scripts/book-entry/db_manager.py book-status --db "$DB" --book-id "$BOOK_ID"
```

## 数据库 schema

```sql
-- 书籍表
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  language TEXT DEFAULT 'zh',
  description TEXT,
  total_chapters INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 章节表
CREATE TABLE chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter_num INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  char_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (book_id, chapter_num),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

## 集成到玄机阁后端（进阶）

后续如果想让 `/api/add-book` 直接调这个工具，可以在 Next.js 后端用 `child_process.spawn('python3', ['scripts/book-entry/db_manager.py', 'add-chapter', ...])` 调用。已经预留接入点，等你确认需要时我再帮你接。

目前先作为**命令行备用工具**：扣子接口不可用 / 网络搜不到时，你可以手动从任何来源拿到章节文本，用这个工具入库。
