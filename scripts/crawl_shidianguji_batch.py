#!/usr/bin/env python3
"""
Crawl books from shidianguji.com - batch version.
Uses requests to fetch HTML and extract text content.
"""
import requests
import re
import html
import os
import sys
import time

BASE_URL = "https://www.shidianguji.com"

# Book configs: (display_name, book_slug, chapter_list)
# Format: [(title, chapter_id), ...]
BOOKS = {
    "卜筮正宗": {
        "slug": "HY1439",
        "chapters": [
            ("叙", "1ll1oz4wztu03"),
            ("卜筮正宗卷之一", "1l5kyah79jq5g"),
            ("卷二", "1koiop3nkeebt"),
            ("卷四", "1koioq4pmw5yd"),
            ("卷五", "1koioq6t6cbom"),
            ("卜筮正宗卷之四", "1l8g7jpysbaxw"),
            ("卜筮正宗卷之五", "1l70b5ell9fk9"),
            ("卷八", "1koioqbyi21wl"),
            ("卷九", "1koioqbyixnol"),
            ("卷十", "1koioqdbzfa5h"),
            ("卷十一", "1koioqgd2yn8l"),
            ("卷十二", "1koioqh1poopy"),
            ("卜筮正宗卷之十一", "1koioqk5dju3e"),
            ("卷十四", "1koioql2gwftx"),
            ("卷十五", "1koioqnaleoei"),
            ("卜筮正宗卷之十四", "1koioqovh3fuy"),
        ],
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
        if len(line) < 2:
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
        
        if not chapters:
            print(f"No chapters for {book_name}, skipping")
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
