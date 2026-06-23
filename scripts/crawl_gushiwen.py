#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gushiwen.cn 古籍爬虫
特点：
  - 从 Book.aspx?id=X 获取章节列表
  - 从 bookv_XXXX.aspx 获取正文（div.contson）
  - 支持断点续爬
  - 支持并发
"""

import argparse
import json
import os
import re
import sys
import time
import random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://www.gushiwen.cn'
OUTPUT_DIR = '/workspace/projects/public/book-content'
PROGRESS_FILE = os.path.join(OUTPUT_DIR, '_gushiwen_progress.json')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

MIN_DELAY = 0.5
MAX_DELAY = 1.5


def load_progress():
    """Load progress from file"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'completed': {}, 'failed': []}


def save_progress(progress):
    """Save progress to file"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_session():
    """Create a requests session"""
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def random_delay():
    """Random delay between requests"""
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def fetch_book_catalog(session, book_id):
    """
    Fetch book catalog page and extract chapter links.
    Returns: (book_name, chapter_list) or (None, None) on failure
    """
    url = f'{BASE_URL}/guwen/Book.aspx?id={book_id}'
    try:
        resp = session.get(url, timeout=20)
        resp.encoding = 'utf-8'
        if resp.status_code != 200 or len(resp.text) < 5000:
            return None, None
        
        soup = BeautifulSoup(resp.text, 'lxml')
        
        # Extract book name from title
        title_tag = soup.find('title')
        if title_tag:
            title_text = title_tag.get_text(strip=True)
            book_name = title_text.split('_')[0].split('全文')[0].strip()
        else:
            book_name = f'Book_{book_id}'
        
        # Extract chapter links
        chapter_links = soup.find_all('a', href=re.compile(r'bookv_'))
        chapters = []
        for a in chapter_links:
            href = a['href']
            title = a.get_text(strip=True)
            if href and title:
                full_url = urljoin(BASE_URL, href)
                chapters.append({
                    'title': title,
                    'url': full_url
                })
        
        return book_name, chapters
    
    except Exception as e:
        print(f"  [ERROR] Failed to fetch catalog for book {book_id}: {e}")
        return None, None


def fetch_chapter_content(session, chapter_url, retries=3):
    """
    Fetch a single chapter's content from bookv_ page.
    Returns: text content or empty string on failure
    """
    for attempt in range(retries):
        try:
            random_delay()
            resp = session.get(chapter_url, timeout=20)
            resp.encoding = 'utf-8'
            
            if resp.status_code != 200:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return ''
            
            soup = BeautifulSoup(resp.text, 'lxml')
            
            # Extract content from div.contson
            content_div = soup.find('div', class_='contson')
            if content_div:
                text = content_div.get_text(strip=True)
                return text
            
            # Fallback: try other content selectors
            for sel in ['div.main3 div.sons', 'div#contson', 'div.book']:
                el = soup.select_one(sel)
                if el:
                    return el.get_text(strip=True)
            
            return ''
        
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  [ERROR] Failed to fetch chapter {chapter_url}: {e}")
                return ''


def crawl_book(book_id, output_dir=OUTPUT_DIR, max_retries=3):
    """
    Crawl a complete book from gushiwen.cn.
    Returns: dict with book info
    """
    session = get_session()
    
    # Get catalog
    book_name, chapters = fetch_book_catalog(session, book_id)
    
    if not book_name or not chapters:
        return {
            'book_id': book_id,
            'book_name': book_name or f'Book_{book_id}',
            'status': 'no_chapters',
            'chapter_count': 0,
            'total_chars': 0
        }
    
    print(f"[Book {book_id}] {book_name}: {len(chapters)} chapters")
    
    # Crawl each chapter
    all_content = []
    for i, ch in enumerate(chapters, 1):
        content = fetch_chapter_content(session, ch['url'])
        if content:
            all_content.append(f"=== {ch['title']} ===\n{content}")
        
        if i % 20 == 0:
            print(f"  [Book {book_id}] Progress: {i}/{len(chapters)}")
    
    # Combine and save
    full_text = '\n\n'.join(all_content)
    total_chars = len(full_text)
    
    if total_chars > 0:
        # Save to file
        safe_name = re.sub(r'[^\w\s\u4e00-\u9fff-]', '', book_name)[:50]
        output_file = os.path.join(output_dir, f'{safe_name}.txt')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_text)
        
        print(f"  [Book {book_id}] Saved: {output_file} ({total_chars} chars, {len(chapters)} chapters)")
        
        return {
            'book_id': book_id,
            'book_name': book_name,
            'status': 'success',
            'chapter_count': len(chapters),
            'total_chars': total_chars,
            'output_file': output_file
        }
    else:
        return {
            'book_id': book_id,
            'book_name': book_name,
            'status': 'empty',
            'chapter_count': len(chapters),
            'total_chars': 0
        }


def crawl_book_task(args):
    """Wrapper for parallel execution"""
    book_id, output_dir = args
    return crawl_book(book_id, output_dir)


def main():
    parser = argparse.ArgumentParser(description='gushiwen.cn book crawler')
    parser.add_argument('--start', type=int, default=1, help='Start book ID')
    parser.add_argument('--end', type=int, default=366, help='End book ID (exclusive)')
    parser.add_argument('--parallel', type=int, default=1, help='Parallel workers')
    parser.add_argument('--ids', type=str, help='Comma-separated book IDs to crawl')
    parser.add_argument('--output', type=str, default=OUTPUT_DIR, help='Output directory')
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    # Load progress
    progress = load_progress()
    
    # Determine which book IDs to crawl
    if args.ids:
        book_ids = [int(x.strip()) for x in args.ids.split(',')]
    else:
        book_ids = list(range(args.start, args.end))
    
    # Filter out already completed
    completed_ids = set()
    for v in progress['completed'].values():
        if 'book_id' in v:
            completed_ids.add(v['book_id'])
    
    pending_ids = [bid for bid in book_ids if bid not in completed_ids]
    print(f"Total IDs: {len(book_ids)}, Already done: {len(completed_ids)}, Pending: {len(pending_ids)}")
    
    if not pending_ids:
        print("All books already crawled!")
        return
    
    results = []
    
    if args.parallel > 1:
        task_args = [(bid, args.output) for bid in pending_ids]
        with ThreadPoolExecutor(max_workers=args.parallel) as executor:
            futures = {executor.submit(crawl_book_task, ta): ta[0] for ta in task_args}
            for future in as_completed(futures):
                bid = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                    if result['status'] == 'success':
                        progress['completed'][result['book_name']] = result
                        save_progress(progress)
                except Exception as e:
                    print(f"  [ERROR] Book {bid}: {e}")
                    progress['failed'].append({'book_id': bid, 'error': str(e)})
                    save_progress(progress)
    else:
        for bid in pending_ids:
            try:
                result = crawl_book(bid, args.output)
                results.append(result)
                if result['status'] == 'success':
                    progress['completed'][result['book_name']] = result
                    save_progress(progress)
            except Exception as e:
                print(f"  [ERROR] Book {bid}: {e}")
                progress['failed'].append({'book_id': bid, 'error': str(e)})
                save_progress(progress)
    
    # Summary
    successful = [r for r in results if r['status'] == 'success']
    total_chars = sum(r['total_chars'] for r in successful)
    
    print(f"\n=== Crawl Summary ===")
    print(f"Total processed: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len([r for r in results if r['status'] != 'success'])}")
    print(f"Total characters: {total_chars:,}")


if __name__ == '__main__':
    main()
