#!/usr/bin/env python3
"""
从shidianguji.com下载古籍完整全文
使用_ROUTER_DATA提取结构化文本
"""
import urllib.request
import re
import json
import os
import sys
import time

OUTPUT_DIR = "/workspace/projects/public/book-content"
BASE_URL = "https://www.shidianguji.com"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None

def extract_router_data(html_text):
    """Extract window._ROUTER_DATA from HTML"""
    match = re.search(r'window\._ROUTER_DATA\s*=\s*', html_text)
    if not match:
        return None
    
    start = match.end()
    json_str = html_text[start:]
    
    try:
        decoder = json.JSONDecoder()
        data, end = decoder.raw_decode(json_str)
        return data
    except json.JSONDecodeError as e:
        print(f"  JSON decode error: {e}")
        return None

def extract_paragraphs(router_data):
    """Extract text from paragraphList"""
    try:
        # Navigate the nested structure
        loader = router_data.get('loaderData', {})
        # Try different key patterns
        for key, value in loader.items():
            if isinstance(value, dict) and 'paragraphList' in value:
                paragraphs = value['paragraphList']
                texts = []
                for para in paragraphs:
                    if isinstance(para, dict) and para.get('lineType') == 1:
                        content = para.get('content', '').strip()
                        if content:
                            texts.append(content)
                return texts
            elif isinstance(value, dict):
                # Try deeper nesting
                for k2, v2 in value.items():
                    if isinstance(v2, dict) and 'paragraphList' in v2:
                        paragraphs = v2['paragraphList']
                        texts = []
                        for para in paragraphs:
                            if isinstance(para, dict) and para.get('lineType') == 1:
                                content = para.get('content', '').strip()
                                if content:
                                    texts.append(content)
                        return texts
    except Exception as e:
        print(f"  Error extracting paragraphs: {e}")
    return []

def get_chapter_ids(book_id, html_text):
    """Try to extract chapter IDs from the book's TOC page"""
    # Look for chapter links in the HTML
    # Pattern: /book/{book_id}/chapter/{chapter_id}
    pattern = rf'/book/{book_id}/chapter/([a-zA-Z0-9]+)'
    matches = re.findall(pattern, html_text)
    
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            unique.append(m)
    return unique

def download_book_from_shidianguji(book_id, book_name):
    """Download a complete book from shidianguji.com"""
    print(f"Downloading from shidianguji.com: {book_name} (ID: {book_id})")
    
    # First, fetch the book's main page to find chapters
    main_url = f"{BASE_URL}/book/{book_id}"
    main_html = fetch_html(main_url)
    if not main_html:
        print(f"  Failed to fetch main page")
        return False
    
    # Get chapter IDs
    chapter_ids = get_chapter_ids(book_id, main_html)
    print(f"  Found {len(chapter_ids)} chapters from TOC")
    
    # Also try to get chapters from _ROUTER_DATA
    router_data = extract_router_data(main_html)
    if router_data:
        # Look for chapter list in router data
        loader = router_data.get('loaderData', {})
        for key, value in loader.items():
            if isinstance(value, dict) and 'chapterList' in value:
                for ch in value['chapterList']:
                    ch_id = ch.get('id', '')
                    if ch_id and ch_id not in chapter_ids:
                        chapter_ids.append(ch_id)
    
    if not chapter_ids:
        print(f"  No chapters found")
        return False
    
    # Download each chapter
    all_text = f"{book_name}\n\n"
    
    for i, ch_id in enumerate(chapter_ids):
        ch_url = f"{BASE_URL}/book/{book_id}/chapter/{ch_id}"
        print(f"  Chapter {i+1}/{len(chapter_ids)}: {ch_id}")
        
        ch_html = fetch_html(ch_url)
        if not ch_html:
            continue
        
        ch_router = extract_router_data(ch_html)
        if ch_router:
            paragraphs = extract_paragraphs(ch_router)
            if paragraphs:
                # Try to get chapter name
                ch_name = f"卷{i+1}"
                all_text += f"【{ch_name}】\n\n" + '\n'.join(paragraphs) + "\n\n"
        
        time.sleep(0.3)
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(all_text.strip())
    
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size} bytes)")
    return True

# Books available on shidianguji.com with their IDs
SHIDIANGUJI_BOOKS = {
    "催官篇": "SK1594",
    "發微論": "SK1596",  # Guessed - may need verification
    "博山篇": "SK1595",  # Guessed
    "太清神鑒": "SK1597",  # Guessed
    "葬經": "SK1598",  # Guessed
    "青囊奧語": "SK1599",  # Guessed
}

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        book_name = sys.argv[1]
        book_id = sys.argv[2]
        download_book_from_shidianguji(book_id, book_name)
    else:
        print("Usage: python download_shidianguji.py <book_name> <book_id>")
        print("\nAvailable books:")
        for name, bid in SHIDIANGUJI_BOOKS.items():
            print(f"  {name}: {bid}")
