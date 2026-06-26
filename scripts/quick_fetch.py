#!/usr/bin/env python3
"""
墨渊阅读 - 快速单本爬取
用法: python3 quick_fetch.py <书名> [作者]
示例: python3 quick_fetch.py 斗罗大陆 唐家三少
      python3 quick_fetch.py 完美世界

一行命令自动搜索+爬取+保存。
分类自动从书名和正文内容判断，无需手动指定。
"""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from book_crawler import auto_fetch

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python3 quick_fetch.py <书名> [作者]')
        print('示例: python3 quick_fetch.py 斗罗大陆 唐家三少')
        print('      python3 quick_fetch.py 完美世界')
        print('说明: 分类自动判断，无需手动指定')
        sys.exit(1)

    book_name = sys.argv[1]
    author = sys.argv[2] if len(sys.argv) > 2 else ''
    category = None  # 自动判断

    path = auto_fetch(book_name, author, category)
    if path:
        print(f'\n💡 下一步：在 src/lib/db.ts 中注册此书即可在书城看到。')