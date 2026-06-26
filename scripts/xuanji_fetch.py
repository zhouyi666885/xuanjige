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
import requests
from urllib.parse import quote
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 复用 book-crawler 的核心函数
from book_crawler import (
    search_qq_read, search_dingdian, search_guidaye, search_25zw,
    fetch_qq_chapter, fetch_dingdian_chapter, fetch_guidaye_chapter, fetch_25zw_chapter,
    auto_fetch, fetch_url, fetch_content, clean_text
)

def search_ctext(book_name):
    """搜索中国哲学书电子化计划(CText)——古籍首选来源"""
    try:
        url = f'https://ctext.org/search?searchu={quote(book_name)}'
        html = fetch_url(url)
        if not html:
            return []
        
        from bs4 import BeautifulSoup
        s = BeautifulSoup(html, 'lxml')
        results = []
        
        for a in s.find_all('a', href=True):
            href = a.get('href', '')
            title = a.get_text(strip=True)
            if '/wiki.pl?' in href and title and book_name in title:
                full_url = f'https://ctext.org{href}' if not href.startswith('http') else href
                results.append({
                    'source': 'ctext',
                    'url': full_url,
                    'name': title,
                    'book_id': href.split('=')[-1] if '=' in href else '',
                })
        
        return results[:10]
    except Exception as e:
        print(f"[搜索] CText 搜索失败: {e}", file=sys.stderr)
        return []


def search_guoxue_sites(book_name):
    """搜索国学网站——古籍专用来源（古诗文网、汉典古籍、国学大师等）"""
    results = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    # 1. 古诗文网 (gushiwen.cn)
    try:
        url = f'https://so.gushiwen.cn/guwen/search?title={quote(book_name)}&value={quote(book_name)}'
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200 and book_name in r.text:
            from bs4 import BeautifulSoup
            s = BeautifulSoup(r.text, 'lxml')
            for a in s.find_all('a', href=True):
                href = a.get('href', '')
                title = a.get_text(strip=True)
                if '/guwen/' in href and title and book_name in title:
                    full_url = f'https://so.gushiwen.cn{href}' if not href.startswith('http') else href
                    results.append({'source': 'gushiwen', 'url': full_url, 'name': title})
    except Exception as e:
        print(f"[搜索] 古诗文网搜索失败: {e}", file=sys.stderr)
    
    # 2. 国学导航 (guoxuedashi.net)
    try:
        url = f'https://www.guoxuedashi.net/s?q={quote(book_name)}'
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200 and book_name in r.text:
            from bs4 import BeautifulSoup
            s = BeautifulSoup(r.text, 'lxml')
            for a in s.find_all('a', href=True):
                href = a.get('href', '')
                title = a.get_text(strip=True)
                if title and book_name in title:
                    full_url = href if href.startswith('http') else f'https://www.guoxuedashi.net{href}'
                    results.append({'source': 'guoxuedashi', 'url': full_url, 'name': title})
    except Exception as e:
        print(f"[搜索] 国学大师搜索失败: {e}", file=sys.stderr)
    
    # 3. 词典网 (cidianwang.com) - 古籍全文
    try:
        url = f'https://www.cidianwang.com/search?q={quote(book_name)}'
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200 and book_name in r.text:
            from bs4 import BeautifulSoup
            s = BeautifulSoup(r.text, 'lxml')
            for a in s.find_all('a', href=True):
                href = a.get('href', '')
                title = a.get_text(strip=True)
                if title and book_name in title:
                    full_url = href if href.startswith('http') else f'https://www.cidianwang.com{href}'
                    results.append({'source': 'cidianwang', 'url': full_url, 'name': title})
    except Exception as e:
        print(f"[搜索] 词典网搜索失败: {e}", file=sys.stderr)
    
    return results[:10]


def search_gutenberg(book_name):
    """搜索Project Gutenberg——英文公版书来源"""
    try:
        url = f'https://gutendex.com/books?search={quote(book_name)}'
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        
        data = resp.json()
        results = []
        for book in data.get('results', [])[:5]:
            results.append({
                'source': 'gutenberg',
                'url': book.get('formats', {}).get('text/html', ''),
                'name': book.get('title', ''),
                'book_id': str(book.get('id', '')),
                'author': book.get('authors', [{}])[0].get('name', '') if book.get('authors') else '',
            })
        return results
    except Exception as e:
        print(f"[搜索] Gutenberg 搜索失败: {e}", file=sys.stderr)
        return []


# 古籍关键词判断
ANCIENT_KEYWORDS = ['易', '经', '传', '论', '注', '疏', '诀', '鉴', '赋', '纲', '志', '卦', '命', '卜', '风水', '相', '紫微', '六爻', '奇门', '六壬', '八字', '梅花', '遁甲', '阴阳', '五行', '天干', '地支', '黄帝', '老子', '庄子', '列子', '管子', '鬼谷', '孙', '墨', '韩非', '滴天髓', '渊海子平', '三命通会', '子平真诠', '穷通宝鉴', '神峰通考', '紫微斗数', '卜筮正宗', '增删卜易', '梅花易数', '皇极经世', '太乙神数', '铁板神数']

def is_ancient_book(book_name):
    """判断是否为中国古籍"""
    for kw in ANCIENT_KEYWORDS:
        if kw in book_name:
            return True
    return False


def search_and_fetch(book_name, author=''):
    """搜索并爬取书籍内容，返回JSON格式结果
    
    搜索顺序根据书籍类型自动调整：
    - 中国古籍：CText优先（中国哲学书电子化计划）
    - 英文公版书：Gutenberg优先
    - 中文小说：QQ阅读 → 顶点小说 → 鬼大爷 → 25zw
    """
    
    # 古籍用CText优先
    if is_ancient_book(book_name):
        search_functions = [
            ('CText古籍', search_ctext),
            ('QQ阅读', search_qq_read),
            ('顶点小说', search_dingdian),
            ('鬼大爷', search_guidaye),
            ('25zw', search_25zw),
            ('Gutenberg', search_gutenberg),
            ('国学网站', search_guoxue_sites),
        ]
    else:
        search_functions = [
            ('CText古籍', search_ctext),
            ('国学网站', search_guoxue_sites),
            ('QQ阅读', search_qq_read),
            ('顶点小说', search_dingdian),
            ('鬼大爷', search_guidaye),
            ('25zw', search_25zw),
            ('Gutenberg', search_gutenberg),
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
                
            # CText古籍来源
            elif source == 'ctext' and url:
                html = fetch_url(url)
                if html:
                    from bs4 import BeautifulSoup
                    s = BeautifulSoup(html, 'lxml')
                    
                    # CText章节列表
                    ch_links = []
                    for a in s.find_all('a', href=True):
                        href = a.get('href', '')
                        title = a.get_text(strip=True)
                        if title and '/wiki.pl?' in href and href != url:
                            full_url = f'https://ctext.org{href}' if not href.startswith('http') else href
                            ch_links.append((title, full_url))
                    
                    # 如果没找到章节链接，尝试直接提取页面内容
                    if not ch_links:
                        content_div = s.find('div', class_='ctext') or s.find('div', id='content3')
                        if content_div:
                            content = content_div.get_text(strip=True)
                            if content and len(content) > 100:
                                chapter_titles = [name]
                                chapters_data = [{
                                    'order': 1,
                                    'title': name,
                                    'content': content,
                                }]
                    
                    # 爬取每个章节
                    for i, (title, ch_url) in enumerate(ch_links[:200]):
                        try:
                            ch_html = fetch_url(ch_url)
                            if ch_html:
                                cs = BeautifulSoup(ch_html, 'lxml')
                                content_div = cs.find('div', class_='ctext') or cs.find('div', id='content3')
                                if content_div:
                                    content = content_div.get_text(strip=True)
                                    if content and len(content) > 50:
                                        chapter_titles.append(title)
                                        chapters_data.append({
                                            'order': len(chapter_titles),
                                            'title': title,
                                            'content': content,
                                        })
                                        print(f"[{len(chapter_titles)}/{len(ch_links)}] {title} ... {len(content)}字 ✓", file=sys.stderr)
                            time.sleep(0.3)
                        except:
                            continue
            
            # Gutenberg英文公版书
            elif source == 'gutenberg' and url:
                try:
                    content = fetch_url(url)
                    if content and len(content) > 200:
                        from bs4 import BeautifulSoup
                        gs = BeautifulSoup(content, 'lxml')
                        text = gs.get_text(strip=True)
                        if text and len(text) > 200:
                            chapter_titles = [name]
                            chapters_data = [{
                                'order': 1,
                                'title': name,
                                'content': text,
                            }]
                except:
                    pass
            
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
