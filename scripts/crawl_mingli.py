#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
命理书籍专用爬虫 - 从多个来源获取命理术数经典
"""

import re
import os
import sys
import json
import time
import argparse
from urllib.parse import quote

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Need: pip install requests beautifulsoup4 lxml")
    sys.exit(1)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

def clean_text(html_content):
    """Clean HTML to plain text"""
    soup = BeautifulSoup(html_content, 'lxml')
    # Remove script and style
    for tag in soup(['script', 'style', 'nav', 'header', 'footer']):
        tag.decompose()
    text = soup.get_text(separator='\n')
    # Clean up
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if line:
            lines.append(line)
    text = '\n'.join(lines)
    # Remove excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def fetch_url(url, timeout=15):
    """Fetch URL content"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.encoding = resp.apparent_encoding or 'utf-8'
        return resp.text
    except Exception as e:
        print(f"  Fetch error: {e}")
        return None


def crawl_xinzidian_book(book_url, output_dir):
    """Crawl a book from xinzidian.com"""
    print(f"  Fetching book page: {book_url}")
    html = fetch_url(book_url)
    if not html:
        return None
    
    soup = BeautifulSoup(html, 'lxml')
    
    # Find title
    title_tag = soup.find('h1') or soup.find('h2')
    title = title_tag.get_text(strip=True) if title_tag else "unknown"
    print(f"  Book: {title}")
    
    # Find chapter links - xinzidian uses different patterns
    chapter_links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        text = a.get_text(strip=True)
        if href.endswith('.html') and len(text) > 1:
            if not href.startswith('http'):
                base = book_url.rsplit('/', 1)[0]
                href = base + '/' + href
            chapter_links.append((text, href))
    
    if not chapter_links:
        # Try getting content directly from this page
        content_div = soup.find('div', class_='content') or soup.find('div', class_='article') or soup.find('div', id='content')
        if content_div:
            text = clean_text(str(content_div))
            return title, text
        return None
    
    print(f"  Found {len(chapter_links)} chapters")
    
    # Fetch each chapter
    all_text = []
    for i, (ch_title, ch_url) in enumerate(chapter_links):
        if i > 0 and i % 10 == 0:
            print(f"  Progress: {i}/{len(chapter_links)}")
            time.sleep(0.3)
        
        ch_html = fetch_url(ch_url)
        if not ch_html:
            continue
        
        ch_soup = BeautifulSoup(ch_html, 'lxml')
        content_div = (ch_soup.find('div', class_='content') or 
                      ch_soup.find('div', class_='article') or 
                      ch_soup.find('div', id='content') or
                      ch_soup.find('div', class_='wenzbody'))
        
        if content_div:
            ch_text = clean_text(str(content_div))
            all_text.append(f"## {ch_title}\n\n{ch_text}")
        time.sleep(0.2)
    
    return title, '\n\n'.join(all_text)


def crawl_guoxue_book(book_url, output_dir):
    """Crawl from guoxue.com"""
    print(f"  Fetching: {book_url}")
    html = fetch_url(book_url)
    if not html:
        return None
    
    soup = BeautifulSoup(html, 'lxml')
    title_tag = soup.find('h1') or soup.find('h2')
    title = title_tag.get_text(strip=True) if title_tag else "unknown"
    
    content_div = soup.find('div', class_='content') or soup.find('div', id='content')
    if content_div:
        text = clean_text(str(content_div))
        return title, text
    
    return None


def crawl_free_read(url, output_dir):
    """Generic crawl from any free reading site"""
    print(f"  Fetching: {url}")
    html = fetch_url(url)
    if not html:
        return None
    
    soup = BeautifulSoup(html, 'lxml')
    title_tag = soup.find('h1') or soup.find('h2')
    title = title_tag.get_text(strip=True) if title_tag else "unknown"
    print(f"  Page: {title}")
    
    # Find chapter links
    chapter_links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        text = a.get_text(strip=True)
        # Filter for chapter-like links
        if text and len(text) > 2 and len(text) < 50:
            if '章' in text or '篇' in text or '卷' in text or '论' in text:
                if not href.startswith('http'):
                    base = url.rsplit('/', 1)[0]
                    href = base + '/' + href.lstrip('./')
                    if not href.startswith('http'):
                        href = 'https://' + href
                chapter_links.append((text, href))
    
    if chapter_links:
        print(f"  Found {len(chapter_links)} chapters")
        all_text = []
        for i, (ch_title, ch_url) in enumerate(chapter_links[:200]):
            if i > 0 and i % 10 == 0:
                print(f"  Progress: {i}/{min(len(chapter_links), 200)}")
                time.sleep(0.3)
            
            ch_html = fetch_url(ch_url)
            if not ch_html:
                continue
            ch_soup = BeautifulSoup(ch_html, 'lxml')
            # Try various content containers
            content_div = (ch_soup.find('div', class_='content') or 
                         ch_soup.find('div', id='content') or
                         ch_soup.find('div', class_='article-content') or
                         ch_soup.find('article'))
            if content_div:
                ch_text = clean_text(str(content_div))
                all_text.append(f"## {ch_title}\n\n{ch_text}")
            time.sleep(0.2)
        
        return title, '\n\n'.join(all_text)
    
    # No chapters found - try getting content from this page directly
    content_div = (soup.find('div', class_='content') or 
                  soup.find('div', id='content') or
                  soup.find('article') or
                  soup.find('div', class_='article-content'))
    if content_div:
        text = clean_text(str(content_div))
        return title, text
    
    return None


def save_book(title, content, output_dir):
    """Save book content to file"""
    # Clean filename
    safe_title = re.sub(r'[\\/:*?"<>|]', '', title)
    filepath = os.path.join(output_dir, f"{safe_title}.txt")
    
    # Add header
    full_content = f"# {title}\n\n{content}"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(full_content)
    
    print(f"  Saved: {filepath} ({len(full_content)} chars)")
    return filepath


def main():
    parser = argparse.ArgumentParser(description='命理书籍爬虫')
    parser.add_argument('--output', default='public/book-content', help='输出目录')
    parser.add_argument('--source', choices=['xinzidian', 'guoxue', 'all'], default='all')
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    # Define books to crawl from various sources
    books = {
        'xinzidian': [
            # 命理经典
            ('https://www.xinzidian.com/guwen/zipingzhenquan/', '子平真诠'),
            ('https://www.xinzidian.com/guwen/qiongtongbaojian/', '穷通宝鉴'),
            ('https://www.xinzidian.com/guwen/mingliyaoyan/', '命理约言'),
            ('https://www.xinzidian.com/guwen/xingpinghuihai/', '星平会海'),
            # 易学经典
            ('https://www.xinzidian.com/guwen/zhouyi/', '周易正义'),
            ('https://www.xinzidian.com/guwen/yijing/', '易经'),
            ('https://www.xinzidian.com/guwen/meihuayishu/', '梅花易数'),
            ('https://www.xinzidian.com/guwen/liuyao/', '六爻'),
            # 堪舆风水
            ('https://www.xinzidian.com/guwen/xuankongfeixing/', '玄空飞星'),
            ('https://www.xinzidian.com/guwen/bazhaifa/', '八宅法'),
        ],
        'guoxue': [],
    }
    
    # Also try some direct-URL books
    direct_books = [
        # 子平真诠 - try multiple sources
        ('https://www.xinzidian.com/guwen/zipingzhenquan/', '子平真诠', 'xinzidian'),
    ]
    
    results = {'success': [], 'failed': []}
    
    sources = [args.source] if args.source != 'all' else ['xinzidian', 'guoxue']
    
    for source in sources:
        if source in books:
            for url, expected_title in books[source]:
                print(f"\n[{source}] Crawling: {expected_title}")
                
                # Check if already exists
                existing = os.path.join(args.output, f"{expected_title}.txt")
                if os.path.exists(existing):
                    print(f"  Already exists: {existing}")
                    results['success'].append(expected_title)
                    continue
                
                if source == 'xinzidian':
                    result = crawl_xinzidian_book(url, args.output)
                else:
                    result = crawl_guoxue_book(url, args.output)
                
                if result and len(result[1]) > 200:
                    title, content = result
                    save_book(expected_title, content, args.output)
                    results['success'].append(expected_title)
                else:
                    print(f"  FAILED: {expected_title}")
                    results['failed'].append((expected_title, url))
    
    print(f"\n{'='*60}")
    print(f"Results: {len(results['success'])} success, {len(results['failed'])} failed")
    if results['failed']:
        print("Failed:")
        for title, url in results['failed']:
            print(f"  - {title}: {url}")


if __name__ == '__main__':
    main()
