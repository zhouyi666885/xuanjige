#!/usr/bin/env python3
"""
Crawl books from shidianguji.com (识典古籍)
This site has reliable full-text content for Chinese classics.
"""
import requests
import re
import html
import os
import sys
import json
import time

BASE_URL = "https://www.shidianguji.com"

# Book configs: (display_name, book_slug, chapter_ids)
# chapter_ids are from the table of contents page
BOOKS = {
    "增删卜易": {
        "slug": "XYXZSBY",
        "chapters": [
            ("序", "1lfn5zr93jw27"),
            ("自序", "1lfn5zr93k8pb"),
            ("增删卜易总目", "1lfn5zr93klcf"),
            ("增删卜易卷之一", "1laba3s8ovar2"),
            ("增删卜易卷之二", "1laba3uso1vza"),
            ("卷三", "1laba3x9svcby"),
            ("增删卜易卷四", "1laba40qqjnka"),
            ("增删卜易卷五", "1laba43ti5hye"),
            ("卷六", "1laba46qlsgm3"),
            ("增删卜易卷七", "1laba495sv2ur"),
            ("增删卜易卷八", "1laba4acxp6vu"),
            ("增删卜易卷九", "1laba4brkmdyr"),
            ("增删卜易卷十", "1laba4dqh16h6"),
            ("增删卜易卷十一", "1laba4fl56z2y"),
            ("增删卜易卷十二", "1laba4hurr0uy"),
        ],
    },
    "卜筮正宗": {
        "slug": "SDZJ0627",
        "chapters": []  # Will be auto-discovered
    },
}

OUTPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "public/book-content"

def extract_text_from_html(html_text):
    """Extract readable text from shidianguji HTML page"""
    # Remove script and style tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    # Remove image tags
    text = re.sub(r'<img[^>]*/?>', '', text)
    # Convert <br> and block elements to newlines
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?(p|div|h[1-6]|li|tr|td|th|table|ul|ol|span|section|article|main|header|footer|nav|aside)[^>]*>', '\n', text)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    # Clean up whitespace
    lines = [line.strip() for line in text.split('\n')]
    # Filter out empty and non-content lines
    content_lines = []
    for line in lines:
        if not line:
            content_lines.append('')
            continue
        # Skip very short lines that are navigation/UI
        if len(line) < 3:
            continue
        # Skip common UI text
        skip_patterns = ['识典古籍', '登录', '注册', '搜索', '收藏', '分享', '下载', '设置', 
                        '精校译文', '原典', '对照', '阅读模式', '上一章', '下一章',
                        '复制', '举报', '反馈', '目录']
        if any(p in line for p in skip_patterns) and len(line) < 20:
            continue
        content_lines.append(line)
    
    text = '\n'.join(content_lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def fetch_chapter(book_slug, chapter_id, session):
    """Fetch a single chapter from shidianguji"""
    url = f"{BASE_URL}/book/{book_slug}/chapter/{chapter_id}"
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        resp = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        
        content = extract_text_from_html(resp.text)
        
        # Check for meaningful Chinese content
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', content)
        if len(chinese_chars) < 50:
            return None, f"Too short ({len(chinese_chars)} chars)"
        
        return content, None
        
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        return None, str(e)[:80]

def discover_chapters(book_slug, session):
    """Try to discover chapters from the book's main page"""
    url = f"{BASE_URL}/book/{book_slug}"
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        }
        resp = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            return []
        
        # Find chapter links
        chapter_pattern = rf'href="/book/{book_slug}/chapter/([^"]+)"[^>]*>([^<]+)</a>'
        chapters = re.findall(chapter_pattern, resp.text)
        
        # Deduplicate while preserving order
        seen = set()
        result = []
        for chap_id, chap_title in chapters:
            if chap_id not in seen:
                seen.add(chap_id)
                result.append((chap_title.strip(), chap_id))
        
        return result
        
    except Exception as e:
        print(f"Error discovering chapters for {book_slug}: {e}")
        return []

def search_book(book_name, session):
    """Search for a book on shidianguji and return its slug"""
    url = f"{BASE_URL}/search"
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        }
        params = {'q': book_name}
        resp = session.get(url, headers=headers, params=params, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            return None
        
        # Find book links in search results
        book_pattern = r'href="/book/([^/"]+)"'
        slugs = re.findall(book_pattern, resp.text)
        
        return slugs[0] if slugs else None
        
    except:
        return None

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    existing = set()
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.txt'):
            existing.add(f.replace('.txt', ''))
    
    session = requests.Session()
    total_saved = 0
    
    for book_name, config in BOOKS.items():
        if book_name in existing:
            print(f"[SKIP] {book_name} (already exists)")
            continue
        
        slug = config["slug"]
        chapters = config["chapters"]
        
        # If no chapters defined, try to discover them
        if not chapters:
            print(f"\nDiscovering chapters for {book_name}...")
            chapters = discover_chapters(slug, session)
            if not chapters:
                print(f"No chapters found for {book_name}, trying search...")
                found_slug = search_book(book_name, session)
                if found_slug:
                    print(f"Found slug: {found_slug}")
                    slug = found_slug
                    chapters = discover_chapters(slug, session)
        
        if not chapters:
            print(f"No chapters found for {book_name}, skipping")
            continue
        
        print(f"\n=== Fetching: {book_name} ({len(chapters)} chapters) ===")
        all_content = []
        
        for i, (chap_title, chap_id) in enumerate(chapters):
            print(f"  [{i+1}/{len(chapters)}] {chap_title}...", end=" ", flush=True)
            content, error = fetch_chapter(slug, chap_id, session)
            if content:
                all_content.append(f"## {chap_title}\n\n{content}")
                print(f"OK ({len(content)} chars)")
            else:
                print(f"FAIL ({error})")
            time.sleep(0.5)
        
        if all_content:
            full_text = f"# {book_name}\n\n" + "\n\n".join(all_content)
            filepath = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_text)
            total_saved += 1
            print(f"  => Saved {book_name}.txt ({len(full_text)} chars)")
        else:
            print(f"  => No content for {book_name}")
    
    print(f"\n=== Total saved: {total_saved} books ===")

if __name__ == "__main__":
    main()
