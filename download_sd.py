#!/usr/bin/env python3
"""
从shidianguji.com下载古籍 - 改进版
通过给定chapter_id列表，逐章下载_ROUTER_DATA中的结构化文本
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

def find_paragraph_list(obj, depth=0):
    """Recursively find paragraphList in nested dict"""
    if depth > 10:
        return None
    if isinstance(obj, dict):
        if 'paragraphList' in obj:
            return obj['paragraphList']
        for v in obj.values():
            result = find_paragraph_list(v, depth+1)
            if result:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = find_paragraph_list(item, depth+1)
            if result:
                return result
    return None

def extract_text_from_chapter(chapter_url, chapter_name):
    """Extract text from a chapter page"""
    html = fetch_html(chapter_url)
    if not html:
        return ""
    
    router_data = extract_router_data(html)
    if not router_data:
        return ""
    
    paragraphs = find_paragraph_list(router_data)
    if not paragraphs:
        return ""
    
    texts = []
    for para in paragraphs:
        if isinstance(para, dict) and para.get('lineType') == 1:
            content = para.get('content', '').strip()
            if content:
                texts.append(content)
    
    if texts:
        return f"【{chapter_name}】\n\n" + '\n'.join(texts) + "\n\n"
    return ""

def download_book(book_name, chapters):
    """
    Download a book given its name and chapter list.
    chapters: list of (chapter_id, chapter_name) tuples
    """
    print(f"Downloading: {book_name} ({len(chapters)} chapters)")
    
    all_text = f"{book_name}\n\n"
    
    for i, (ch_id, ch_name) in enumerate(chapters):
        ch_url = ch_id  # ch_id is actually the full URL
        if not ch_url.startswith('http'):
            # Relative URL - prepend base
            ch_url = BASE_URL + ch_url if ch_url.startswith('/') else BASE_URL + '/' + ch_url
        
        print(f"  Chapter {i+1}/{len(chapters)}: {ch_name}")
        content = extract_text_from_chapter(ch_url, ch_name)
        all_text += content
        time.sleep(0.3)
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(all_text.strip())
    
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size} bytes, {len(all_text)} chars)")
    return True

if __name__ == '__main__':
    # Use web_fetch to get the TOC first, then pass chapter URLs
    if len(sys.argv) < 3:
        print("Usage: python download_sd.py <book_name> <chapter_url1> [<chapter_url2> ...]")
        print("   or: python download_sd.py <book_name> --chapters '<json: [{url, name}, ...]>'")
        sys.exit(1)
    
    book_name = sys.argv[1]
    
    if sys.argv[2] == '--chapters' and len(sys.argv) > 3:
        # Parse JSON chapter list
        import ast
        chapters_raw = ast.literal_eval(sys.argv[3])
        chapters = [(c['url'], c['name']) for c in chapters_raw]
    else:
        # Simple URL list, names auto-generated
        chapters = [(url, f"卷{i+1}") for i, url in enumerate(sys.argv[2:])]
    
    download_book(book_name, chapters)
