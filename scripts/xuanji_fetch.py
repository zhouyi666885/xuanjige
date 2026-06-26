#!/usr/bin/env python3
"""
玄机阁 - 书籍搜索与内容爬取
用法: python3 xuanji_fetch.py <书名> [作者]
输出: JSON格式，包含搜索到的书籍内容和章节信息
{
  "success": true/false,
  "source": "来源网站名",
  "book_name": "书名",
  "author": "作者",
  "total_chapters": 数字,
  "chapter_titles": ["章节1", "章节2", ...],
  "chapters": [
    {"order": 1, "title": "章节标题", "content": "正文内容"},
    ...
  ],
  "full_text": "完整文本（所有章节拼接）",
  "error": "错误信息（仅失败时）"
}
"""

import json, os, sys, re, time
from urllib.parse import quote
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 复用 book-crawler 的核心函数
from book_crawler import (
    search_qq_read, search_dingdian, search_guidaye, search_25zw,
    fetch_chapter_content_qq, fetch_chapter_content,
    auto_fetch, HEADERS, fetch_url, fetch_content, clean_text
)

def search_and_fetch(book_name, author=''):
    """搜索并爬取书籍内容，返回JSON格式结果"""
    
    # 搜索顺序：QQ阅读 → 顶点小说 → 鬼大爷 → 25zw
    search_functions = [
        ('QQ阅读', search_qq_read),
        ('顶点小说', search_dingdian),
        ('鬼大爷', search_guidaye),
        ('25zw', search_25zw),
    ]
    
    all_search_results = []
    
    for source_name, search_fn in search_functions:
        try:
            results = search_fn(book_name)
            if results:
                for r in results:
                    r['source_name'] = source_name
                    all_search_results.append(r)
        except Exception as e:
            print(f"[搜索] {source_name} 搜索失败: {e}", file=sys.stderr)
            continue
    
    if not all_search_results:
        return {
            'success': False,
            'error': f'未在任何来源找到《{book_name}》',
            'searched_sources': [s[0] for s in search_functions],
        }
    
    # 按来源优先级排序，尝试爬取
    for result in all_search_results:
        source = result.get('source', '')
        source_name = result.get('source_name', '未知')
        book_id = result.get('book_id', '')
        url = result.get('url', '')
        name = result.get('name', book_name)
        
        try:
            chapters_data = []
            chapter_titles = []
            
            # QQ阅读
            if source == 'qq_read' and book_id:
                # 获取章节列表
                chapter_list_url = f'https://ubook.reader.qq.com/book-chapter/{book_id}'
                html = fetch_url(chapter_list_url)
                if html:
                    import re as _re
                    m = _re.search(r'window\.__NUXT__\s*=\s*(\{.+?\});', html, _re.DOTALL)
                    if m:
                        try:
                            nuxt = json.loads(m.group(1))
                            ch_list = nuxt.get('data', {}).get('chapterList', [])
                            for ch in ch_list:
                                chapter_titles.append(ch.get('title', ''))
                        except:
                            pass
                    
                    # 如果没找到NUXT数据，尝试从HTML提取
                    if not chapter_titles:
                        from bs4 import BeautifulSoup
                        s = BeautifulSoup(html, 'lxml')
                        for a in s.find_all('a', href=_re.compile(r'/book-read/')):
                            title = a.get_text(strip=True)
                            if title:
                                chapter_titles.append(title)
                    
                    # 爬取章节内容
                    for i, title in enumerate(chapter_titles[:200]):  # 最多200章
                        try:
                            ch_url = f'https://ubook.reader.qq.com/book-read/{book_id}/{i+1}'
                            content = fetch_content(ch_url)
                            if content and len(content) > 100:
                                chapters_data.append({
                                    'order': i + 1,
                                    'title': title,
                                    'content': content,
                                })
                                print(f"[{i+1}/{len(chapter_titles)}] {title} ... {len(content)}字 ✓", file=sys.stderr)
                            time.sleep(0.5)
                        except:
                            continue
                
            # 其他来源（顶点/鬼大爷/25zw等）
            elif url:
                html = fetch_url(url)
                if not html:
                    continue
                    
                from bs4 import BeautifulSoup
                s = BeautifulSoup(html, 'lxml')
                
                # 获取章节列表
                ch_links = []
                for a in s.find_all('a', href=True):
                    href = a.get('href', '')
                    title = a.get_text(strip=True)
                    if title and ('第' in title or '章' in title or '卷' in title or '回' in title or '篇' in title or '卦' in title):
                        full_url = href if href.startswith('http') else url.rstrip('/') + '/' + href.lstrip('./')
                        ch_links.append((title, full_url))
                
                # 去重
                seen = set()
                unique_links = []
                for title, link in ch_links:
                    if link not in seen:
                        seen.add(link)
                        unique_links.append((title, link))
                        chapter_titles.append(title)
                
                # 爬取章节内容
                for i, (title, ch_url) in enumerate(unique_links[:200]):
                    try:
                        content = fetch_content(ch_url)
                        if content and len(content) > 100:
                            chapters_data.append({
                                'order': i + 1,
                                'title': title,
                                'content': content,
                            })
                            print(f"[{i+1}/{len(unique_links)}] {title} ... {len(content)}字 ✓", file=sys.stderr)
                        time.sleep(0.5)
                    except:
                        continue
            
            if chapters_data:
                # 拼接完整文本
                full_text_parts = []
                for ch in chapters_data:
                    full_text_parts.append(f"【{ch['title']}】\n\n{ch['content']}")
                full_text = '\n\n'.join(full_text_parts)
                
                return {
                    'success': True,
                    'source': source_name,
                    'book_name': name,
                    'author': result.get('author', author or ''),
                    'total_chapters': len(chapter_titles),
                    'chapter_titles': chapter_titles,
                    'fetched_chapters': len(chapters_data),
                    'chapters': chapters_data,
                    'full_text': full_text,
                }
        except Exception as e:
            print(f"[爬取] {source_name} 爬取失败: {e}", file=sys.stderr)
            continue
    
    return {
        'success': False,
        'error': f'找到 {len(all_search_results)} 个搜索结果，但所有来源爬取均失败',
        'search_results_count': len(all_search_results),
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python3 xuanji_fetch.py <书名> [作者]', file=sys.stderr)
        sys.exit(1)
    
    book_name = sys.argv[1]
    author = sys.argv[2] if len(sys.argv) > 2 else ''
    
    result = search_and_fetch(book_name, author)
    print(json.dumps(result, ensure_ascii=False, indent=2))
