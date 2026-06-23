#!/usr/bin/env python3
"""
术数古籍多源批量爬虫 v2.0
从识典古籍(shidianguji.com)批量爬取术数命理古籍全文
支持从URL列表文件批量处理
"""
import os
import re
import sys
import json
import time
import argparse
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

OUTPUT_DIR = os.environ.get('BOOK_OUTPUT_DIR', '/workspace/projects/public/book-content')
LOG_FILE = '/tmp/shushi_crawl.log'

# 识典古籍已知书籍 slug 映射
SHIDIANGUJI_BOOKS = {
    # 六爻
    '增删卜易': 'SL1050',
    '卜筮正宗': 'HY1439',
    '易隐': 'SL1056',
    '易林': 'SL1042',
    '火珠林': 'SL1047',
    '断易天机': 'SL1055',
    '黄金策': 'SL1053',
    '天玄赋': 'SL1052',
    
    # 梅花易数
    '梅花易数': 'SL1058',
    
    # 八字命理
    '三命通会': 'SL1070',
    '渊海子平': 'SL1062',
    '子平真诠': 'SL1065',
    '滴天髓': 'SL1063',
    '穷通宝鉴': 'SL1067',
    '神峰通考': 'SL1069',
    '命理约言': 'SL1071',
    '星平会海': 'SL1066',
    '星学大成': 'SL1064',
    '兰台妙选': 'SL1068',
    
    # 紫微斗数
    '紫微斗数全书': 'SL1080',
    '十八飞星': 'SL1081',
    
    # 奇门遁甲
    '奇门遁甲': 'SL1090',
    '奇门旨归': 'SL1092',
    '遁甲演义': 'SL1091',
    '烟波钓叟歌': 'SL1093',
    
    # 六壬
    '六壬大全': 'SL1100',
    '大六壬指南': 'SL1102',
    
    # 风水
    '撼龙经': 'SL1110',
    '疑龙经': 'SL1111',
    '葬经': 'SL1112',
    '雪心赋': 'SL1115',
    '地理五诀': 'SL1113',
    '阳宅三要': 'SL1114',
    
    # 面相手相
    '麻衣相法': 'SL1120',
    '柳庄相法': 'SL1121',
    '神相全编': 'SL1122',
    '太清神鉴': 'SL1123',
    '冰鉴': 'SL1124',
    '月波洞中记': 'SL1125',
    '人伦大统赋': 'SL1126',
    
    # 周易相关
    '周易参同契': 'SL1030',
    '京氏易传': 'SL1032',
    '皇极经世': 'SL1035',
    
    # 太乙
    '太乙神数': 'SL1095',
    
    # 预言
    '推背图': 'SL1097',
    '烧饼歌': 'SL1098',
}

def log(msg):
    ts = time.strftime('%H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def get_chapter_list(slug):
    """Get chapter list from shidianguji.com"""
    url = f'https://www.shidianguji.com/book/{slug}'
    try:
        resp = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        if resp.status_code != 200:
            log(f"  Failed to get chapter list for {slug}: HTTP {resp.status_code}")
            return []
        
        soup = BeautifulSoup(resp.text, 'lxml')
        chapters = []
        
        # Find chapter links
        for a in soup.find_all('a', href=True):
            href = a['href']
            if f'/book/{slug}/chapter/' in href:
                chapter_id = href.split('/chapter/')[-1].strip('/')
                title = a.get_text(strip=True)
                if chapter_id and title:
                    chapters.append((chapter_id, title))
        
        return chapters
    except Exception as e:
        log(f"  Error getting chapters for {slug}: {e}")
        return []

def get_chapter_content(slug, chapter_id):
    """Get content of a single chapter"""
    url = f'https://www.shidianguji.com/book/{slug}/chapter/{chapter_id}'
    try:
        resp = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        if resp.status_code != 200:
            return None
        
        soup = BeautifulSoup(resp.text, 'lxml')
        
        # Try multiple content selectors
        content_div = None
        for selector in ['div.chapter-content', 'div.book-content', 'div.content', 'article']:
            content_div = soup.select_one(selector)
            if content_div:
                break
        
        if not content_div:
            # Fallback: get the main text content
            content_div = soup.find('div', class_=re.compile(r'content|chapter|text'))
        
        if not content_div:
            return None
        
        # Extract text, preserving paragraph breaks
        paragraphs = []
        for p in content_div.find_all(['p', 'br']):
            text = p.get_text(strip=True)
            if text:
                paragraphs.append(text)
        
        if not paragraphs:
            # Try getting all text
            text = content_div.get_text(separator='\n', strip=True)
            if text:
                paragraphs = text.split('\n')
        
        return '\n\n'.join(p for p in paragraphs if p.strip())
    except Exception as e:
        return None

def crawl_book(title, slug):
    """Crawl a complete book from shidianguji.com"""
    log(f"Crawling: {title} (slug: {slug})")
    
    # Get chapter list
    chapters = get_chapter_list(slug)
    if not chapters:
        log(f"  No chapters found for {title}, trying direct content...")
        # Try the book page itself
        url = f'https://www.shidianguji.com/book/{slug}'
        try:
            resp = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            soup = BeautifulSoup(resp.text, 'lxml')
            content_div = soup.select_one('div.book-content, div.content, article')
            if content_div:
                text = content_div.get_text(separator='\n', strip=True)
                if len(text) > 100:
                    output_path = os.path.join(OUTPUT_DIR, f'{title}.txt')
                    with open(output_path, 'w') as f:
                        f.write(f'# {title}\n\n{text}')
                    log(f"  Saved direct content: {len(text)} chars")
                    return True
        except:
            pass
        return False
    
    log(f"  Found {len(chapters)} chapters")
    
    # Crawl each chapter
    all_content = [f'# {title}\n']
    total_chars = 0
    
    for i, (chapter_id, chapter_title) in enumerate(chapters, 1):
        content = get_chapter_content(slug, chapter_id)
        if content:
            all_content.append(f'\n## {chapter_title}\n\n{content}')
            total_chars += len(content)
        else:
            all_content.append(f'\n## {chapter_title}\n\n（本章内容获取失败）')
        
        if i % 5 == 0:
            log(f"  Progress: {i}/{len(chapters)} chapters, {total_chars} chars")
        
        time.sleep(0.3)  # Rate limiting
    
    # Save
    full_text = '\n'.join(all_content)
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', full_text))
    
    if chinese_chars < 50:
        log(f"  Too few Chinese chars ({chinese_chars}), skipping save")
        return False
    
    output_path = os.path.join(OUTPUT_DIR, f'{title}.txt')
    
    # Check if existing file is better
    if os.path.exists(output_path):
        with open(output_path, 'r') as f:
            existing = f.read()
        existing_chinese = len(re.findall(r'[\u4e00-\u9fff]', existing))
        if existing_chinese > chinese_chars:
            log(f"  Existing file is better ({existing_chinese} vs {chinese_chars} Chinese chars), keeping it")
            return True
    
    with open(output_path, 'w') as f:
        f.write(full_text)
    
    log(f"  Saved: {len(full_text)} chars, {chinese_chars} Chinese chars, {len(chapters)} chapters")
    return True

def main():
    parser = argparse.ArgumentParser(description='Crawl 术数古籍 from shidianguji.com')
    parser.add_argument('--books', nargs='*', help='Specific book titles to crawl')
    parser.add_argument('--all', action='store_true', help='Crawl all known books')
    parser.add_argument('--list', action='store_true', help='List known books')
    parser.add_argument('--missing', action='store_true', help='Crawl only books not yet in output dir')
    parser.add_argument('--parallel', type=int, default=1, help='Parallel workers (default 1)')
    args = parser.parse_args()
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if args.list:
        for title, slug in sorted(SHIDIANGUJI_BOOKS.items()):
            exists = os.path.exists(os.path.join(OUTPUT_DIR, f'{title}.txt'))
            status = 'EXISTS' if exists else 'MISSING'
            print(f"  {status:7s} {title:20s} {slug}")
        return
    
    # Determine which books to crawl
    books_to_crawl = {}
    
    if args.books:
        for title in args.books:
            if title in SHIDIANGUJI_BOOKS:
                books_to_crawl[title] = SHIDIANGUJI_BOOKS[title]
            else:
                log(f"Unknown book: {title}")
    elif args.missing:
        for title, slug in SHIDIANGUJI_BOOKS.items():
            path = os.path.join(OUTPUT_DIR, f'{title}.txt')
            if not os.path.exists(path):
                books_to_crawl[title] = slug
            else:
                # Check if existing file has enough content
                with open(path, 'r') as f:
                    content = f.read()
                chinese = len(re.findall(r'[\u4e00-\u9fff]', content))
                if chinese < 1000:
                    log(f"{title} exists but only {chinese} Chinese chars, will re-crawl")
                    books_to_crawl[title] = slug
    elif args.all:
        books_to_crawl = dict(SHIDIANGUJI_BOOKS)
    else:
        # Default: crawl missing books
        for title, slug in SHIDIANGUJI_BOOKS.items():
            path = os.path.join(OUTPUT_DIR, f'{title}.txt')
            if not os.path.exists(path):
                books_to_crawl[title] = slug
    
    if not books_to_crawl:
        log("No books to crawl!")
        return
    
    log(f"Will crawl {len(books_to_crawl)} books")
    
    success = 0
    failed = 0
    
    if args.parallel > 1:
        with ThreadPoolExecutor(max_workers=args.parallel) as executor:
            futures = {}
            for title, slug in books_to_crawl.items():
                future = executor.submit(crawl_book, title, slug)
                futures[future] = title
            
            for future in as_completed(futures):
                title = futures[future]
                try:
                    if future.result():
                        success += 1
                    else:
                        failed += 1
                except Exception as e:
                    log(f"Error crawling {title}: {e}")
                    failed += 1
    else:
        for i, (title, slug) in enumerate(books_to_crawl.items(), 1):
            log(f"\n[{i}/{len(books_to_crawl)}]")
            try:
                if crawl_book(title, slug):
                    success += 1
                else:
                    failed += 1
            except Exception as e:
                log(f"Error crawling {title}: {e}")
                failed += 1
    
    log(f"\nDone! Success: {success}, Failed: {failed}")

if __name__ == '__main__':
    main()
