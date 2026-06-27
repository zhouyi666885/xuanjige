#!/usr/bin/env python3
"""书籍录入知识库 - SQLite 数据库管理脚本"""

import argparse
import json
import sqlite3
import sys
import os
from datetime import datetime


def get_connection(db_path):
    """获取数据库连接"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(args):
    """初始化数据库，创建表结构"""
    conn = get_connection(args.db)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT DEFAULT '',
                isbn TEXT DEFAULT '',
                language TEXT DEFAULT 'zh',
                description TEXT DEFAULT '',
                total_chapters INTEGER DEFAULT 0,
                status TEXT DEFAULT 'in_progress',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chapters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                chapter_number INTEGER NOT NULL,
                chapter_title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                word_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                UNIQUE(book_id, chapter_number)
            );

            CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
            CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(book_id, chapter_number);
            CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
        """)
        conn.commit()
        result = {
            "status": "success",
            "message": "数据库初始化完成",
            "db_path": os.path.abspath(args.db)
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def add_book(args):
    """添加书籍记录"""
    conn = get_connection(args.db)
    try:
        now = datetime.now().isoformat()
        cursor = conn.execute(
            """INSERT INTO books (title, author, isbn, language, description, total_chapters, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, 'in_progress', ?, ?)""",
            (args.title, args.author or '', args.isbn or '', args.language or 'zh',
             args.description or '', now, now)
        )
        conn.commit()
        book_id = cursor.lastrowid
        result = {
            "status": "success",
            "message": "书籍添加成功",
            "book_id": book_id,
            "title": args.title,
            "author": args.author or ''
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def add_chapter(args):
    """添加章节内容"""
    conn = get_connection(args.db)
    try:
        # 检查书籍是否存在
        book = conn.execute("SELECT id, status FROM books WHERE id = ?", (args.book_id,)).fetchone()
        if not book:
            print(json.dumps({"status": "error", "message": f"书籍ID {args.book_id} 不存在"}, ensure_ascii=False))
            sys.exit(1)

        now = datetime.now().isoformat()
        content = args.content
        word_count = len(content)

        # 检查章节是否已存在
        existing = conn.execute(
            "SELECT id FROM chapters WHERE book_id = ? AND chapter_number = ?",
            (args.book_id, args.chapter_num)
        ).fetchone()

        if existing:
            # 更新已有章节
            conn.execute(
                """UPDATE chapters SET chapter_title = ?, content = ?, word_count = ?, created_at = ?
                   WHERE book_id = ? AND chapter_number = ?""",
                (args.title, content, word_count, now, args.book_id, args.chapter_num)
            )
            action = "updated"
        else:
            # 插入新章节
            conn.execute(
                """INSERT INTO chapters (book_id, chapter_number, chapter_title, content, word_count, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (args.book_id, args.chapter_num, args.title, content, word_count, now)
            )
            action = "added"

        # 更新书籍的章节总数和时间
        chapter_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM chapters WHERE book_id = ?", (args.book_id,)
        ).fetchone()["cnt"]
        conn.execute(
            "UPDATE books SET total_chapters = ?, updated_at = ? WHERE id = ?",
            (chapter_count, now, args.book_id)
        )
        conn.commit()

        result = {
            "status": "success",
            "message": f"章节{action}成功",
            "book_id": args.book_id,
            "chapter_number": args.chapter_num,
            "chapter_title": args.title,
            "word_count": word_count,
            "total_chapters_in_db": chapter_count
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def list_books(args):
    """列出所有书籍"""
    conn = get_connection(args.db)
    try:
        rows = conn.execute(
            "SELECT id, title, author, language, total_chapters, status, created_at, updated_at FROM books ORDER BY id"
        ).fetchall()
        books = []
        for row in rows:
            books.append({
                "id": row["id"],
                "title": row["title"],
                "author": row["author"],
                "language": row["language"],
                "total_chapters": row["total_chapters"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        result = {
            "status": "success",
            "total": len(books),
            "books": books
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def get_book(args):
    """获取书籍元数据及章节列表"""
    conn = get_connection(args.db)
    try:
        book = conn.execute("SELECT * FROM books WHERE id = ?", (args.book_id,)).fetchone()
        if not book:
            print(json.dumps({"status": "error", "message": f"书籍ID {args.book_id} 不存在"}, ensure_ascii=False))
            sys.exit(1)

        chapters = conn.execute(
            "SELECT chapter_number, chapter_title, word_count, created_at FROM chapters WHERE book_id = ? ORDER BY chapter_number",
            (args.book_id,)
        ).fetchall()

        chapter_list = []
        for ch in chapters:
            chapter_list.append({
                "chapter_number": ch["chapter_number"],
                "chapter_title": ch["chapter_title"],
                "word_count": ch["word_count"],
                "created_at": ch["created_at"]
            })

        # 检查章节连续性
        expected_numbers = set(range(1, len(chapter_list) + 1))
        actual_numbers = set(ch["chapter_number"] for ch in chapters)
        missing = sorted(expected_numbers - actual_numbers)
        extra = sorted(actual_numbers - expected_numbers)

        result = {
            "status": "success",
            "book": {
                "id": book["id"],
                "title": book["title"],
                "author": book["author"],
                "isbn": book["isbn"],
                "language": book["language"],
                "description": book["description"],
                "total_chapters": book["total_chapters"],
                "status": book["status"],
                "created_at": book["created_at"],
                "updated_at": book["updated_at"]
            },
            "chapters": chapter_list,
            "completeness": {
                "total_in_db": len(chapter_list),
                "missing_chapters": missing,
                "extra_chapters": extra,
                "is_complete": len(missing) == 0 and len(extra) == 0
            }
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def get_chapter(args):
    """获取单章内容"""
    conn = get_connection(args.db)
    try:
        chapter = conn.execute(
            "SELECT chapter_number, chapter_title, content, word_count, created_at FROM chapters WHERE book_id = ? AND chapter_number = ?",
            (args.book_id, args.chapter_num)
        ).fetchone()
        if not chapter:
            print(json.dumps({"status": "error", "message": f"第{args.chapter_num}章不存在"}, ensure_ascii=False))
            sys.exit(1)

        result = {
            "status": "success",
            "chapter": {
                "chapter_number": chapter["chapter_number"],
                "chapter_title": chapter["chapter_title"],
                "content": chapter["content"],
                "word_count": chapter["word_count"],
                "created_at": chapter["created_at"]
            }
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def get_full(args):
    """导出完整书籍内容"""
    conn = get_connection(args.db)
    try:
        book = conn.execute("SELECT * FROM books WHERE id = ?", (args.book_id,)).fetchone()
        if not book:
            print(json.dumps({"status": "error", "message": f"书籍ID {args.book_id} 不存在"}, ensure_ascii=False))
            sys.exit(1)

        chapters = conn.execute(
            "SELECT chapter_number, chapter_title, content FROM chapters WHERE book_id = ? ORDER BY chapter_number",
            (args.book_id,)
        ).fetchall()

        if not chapters:
            print(json.dumps({"status": "error", "message": "该书暂无章节内容"}, ensure_ascii=False))
            sys.exit(1)

        # 组装完整文本
        lines = []
        lines.append(f"书名: {book['title']}")
        if book['author']:
            lines.append(f"作者: {book['author']}")
        lines.append(f"章节数: {len(chapters)}")
        lines.append("=" * 50)
        lines.append("")

        for ch in chapters:
            lines.append(f"--- 第{ch['chapter_number']}章 {ch['chapter_title']} ---")
            lines.append("")
            lines.append(ch['content'])
            lines.append("")

        full_text = "\n".join(lines)

        if args.output:
            # 确保输出目录存在
            output_dir = os.path.dirname(args.output)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(full_text)
            result = {
                "status": "success",
                "message": "书籍导出成功",
                "output_file": os.path.abspath(args.output),
                "total_chapters": len(chapters),
                "total_chars": len(full_text)
            }
        else:
            result = {
                "status": "success",
                "book_title": book["title"],
                "total_chapters": len(chapters),
                "total_chars": len(full_text),
                "content": full_text
            }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def book_status(args):
    """查看书籍录入进度"""
    conn = get_connection(args.db)
    try:
        book = conn.execute("SELECT * FROM books WHERE id = ?", (args.book_id,)).fetchone()
        if not book:
            print(json.dumps({"status": "error", "message": f"书籍ID {args.book_id} 不存在"}, ensure_ascii=False))
            sys.exit(1)

        chapters = conn.execute(
            "SELECT chapter_number, chapter_title, word_count FROM chapters WHERE book_id = ? ORDER BY chapter_number",
            (args.book_id,)
        ).fetchall()

        chapter_numbers = [ch["chapter_number"] for ch in chapters]
        total_words = sum(ch["word_count"] for ch in chapters)

        # 分析连续性
        if chapter_numbers:
            max_num = max(chapter_numbers)
            expected = set(range(1, max_num + 1))
            actual = set(chapter_numbers)
            missing = sorted(expected - actual)
            first_chapter = min(chapter_numbers)
            last_chapter = max(chapter_numbers)
        else:
            missing = []
            first_chapter = 0
            last_chapter = 0

        result = {
            "status": "success",
            "book_id": args.book_id,
            "title": book["title"],
            "author": book["author"],
            "db_status": book["status"],
            "progress": {
                "chapters_recorded": len(chapters),
                "first_chapter": first_chapter,
                "last_chapter": last_chapter,
                "missing_chapters": missing,
                "total_missing": len(missing),
                "total_words": total_words,
                "is_complete": len(missing) == 0 and len(chapters) > 0
            }
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def delete_book(args):
    """删除书籍及其所有章节"""
    conn = get_connection(args.db)
    try:
        book = conn.execute("SELECT id, title FROM books WHERE id = ?", (args.book_id,)).fetchone()
        if not book:
            print(json.dumps({"status": "error", "message": f"书籍ID {args.book_id} 不存在"}, ensure_ascii=False))
            sys.exit(1)

        chapter_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM chapters WHERE book_id = ?", (args.book_id,)
        ).fetchone()["cnt"]

        conn.execute("DELETE FROM books WHERE id = ?", (args.book_id,))
        conn.commit()

        result = {
            "status": "success",
            "message": "书籍删除成功",
            "book_id": args.book_id,
            "title": book["title"],
            "chapters_deleted": chapter_count
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def update_book_status(args):
    """更新书籍状态"""
    conn = get_connection(args.db)
    try:
        now = datetime.now().isoformat()
        conn.execute(
            "UPDATE books SET status = ?, updated_at = ? WHERE id = ?",
            (args.status, now, args.book_id)
        )
        conn.commit()
        result = {
            "status": "success",
            "message": f"书籍状态已更新为: {args.status}",
            "book_id": args.book_id
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="书籍录入知识库 - SQLite 数据库管理")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # init
    p_init = subparsers.add_parser("init", help="初始化数据库")
    p_init.add_argument("--db", required=True, help="数据库文件路径")

    # add-book
    p_add = subparsers.add_parser("add-book", help="添加书籍")
    p_add.add_argument("--db", required=True, help="数据库文件路径")
    p_add.add_argument("--title", required=True, help="书名")
    p_add.add_argument("--author", help="作者")
    p_add.add_argument("--isbn", help="ISBN")
    p_add.add_argument("--language", help="语言(zh/en)", default="zh")
    p_add.add_argument("--description", help="书籍简介")

    # add-chapter
    p_ch = subparsers.add_parser("add-chapter", help="添加章节")
    p_ch.add_argument("--db", required=True, help="数据库文件路径")
    p_ch.add_argument("--book-id", type=int, required=True, help="书籍ID")
    p_ch.add_argument("--chapter-num", type=int, required=True, help="章节序号")
    p_ch.add_argument("--title", required=True, help="章节标题")
    p_ch.add_argument("--content", required=True, help="章节正文内容")

    # list-books
    p_list = subparsers.add_parser("list-books", help="列出所有书籍")
    p_list.add_argument("--db", required=True, help="数据库文件路径")

    # get-book
    p_get = subparsers.add_parser("get-book", help="获取书籍详情及章节列表")
    p_get.add_argument("--db", required=True, help="数据库文件路径")
    p_get.add_argument("--book-id", type=int, required=True, help="书籍ID")

    # get-chapter
    p_gch = subparsers.add_parser("get-chapter", help="获取单章内容")
    p_gch.add_argument("--db", required=True, help="数据库文件路径")
    p_gch.add_argument("--book-id", type=int, required=True, help="书籍ID")
    p_gch.add_argument("--chapter-num", type=int, required=True, help="章节序号")

    # get-full
    p_full = subparsers.add_parser("get-full", help="导出完整书籍")
    p_full.add_argument("--db", required=True, help="数据库文件路径")
    p_full.add_argument("--book-id", type=int, required=True, help="书籍ID")
    p_full.add_argument("--output", help="输出文件路径(不指定则输出到stdout)")

    # book-status
    p_stat = subparsers.add_parser("book-status", help="查看录入进度")
    p_stat.add_argument("--db", required=True, help="数据库文件路径")
    p_stat.add_argument("--book-id", type=int, required=True, help="书籍ID")

    # delete-book
    p_del = subparsers.add_parser("delete-book", help="删除书籍及所有章节")
    p_del.add_argument("--db", required=True, help="数据库文件路径")
    p_del.add_argument("--book-id", type=int, required=True, help="书籍ID")

    # update-status
    p_ust = subparsers.add_parser("update-status", help="更新书籍状态")
    p_ust.add_argument("--db", required=True, help="数据库文件路径")
    p_ust.add_argument("--book-id", type=int, required=True, help="书籍ID")
    p_ust.add_argument("--status", required=True, choices=["in_progress", "completed", "paused"], help="状态")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "init": init_db,
        "add-book": add_book,
        "add-chapter": add_chapter,
        "list-books": list_books,
        "get-book": get_book,
        "get-chapter": get_chapter,
        "get-full": get_full,
        "book-status": book_status,
        "delete-book": delete_book,
        "update-status": update_book_status,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
