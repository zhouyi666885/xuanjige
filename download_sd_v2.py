#!/usr/bin/env python3
"""
从shidianguji.com下载古籍完整全文 v2
content字段是嵌套JSON字符串，需要二次解析
lineType: 1=正文, 3=页面标记, 4=卷标题, 7=作者, 8=篇标题, 9=节标题, 10=注释
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

def extract_text_from_chapter(chapter_url, chapter_name):
    """Extract text from a chapter page using nested JSON parsing"""
    html = fetch_html(chapter_url)
    if not html:
        return ""
    
    router_data = extract_router_data(html)
    if not router_data:
        return ""
    
    # Navigate to paragraphList
    loader = router_data.get('loaderData', {})
    book_data = loader.get('__session/(lang$)/book/$', {})
    if not book_data:
        # Try other key patterns
        for k, v in loader.items():
            if isinstance(v, dict) and 'paragraphList' in v:
                book_data = v
                break
    
    paragraph_list = book_data.get('paragraphList', [])
    
    all_lines = []
    for para in paragraph_list:
        content_str = para.get('content', '')
        if not content_str:
            continue
        try:
            content_data = json.loads(content_str)
        except:
            continue
        
        lines = content_data.get('lines', [])
        for line in lines:
            line_type = line.get('lineType')
            text = line.get('content', '').strip()
            if not text:
                continue
            
            if line_type == 1:  # 正文
                all_lines.append(text)
            elif line_type == 4:  # 卷标题
                all_lines.append(f"\n【{text}】\n")
            elif line_type == 7:  # 作者
                all_lines.append(f"\n{text}\n")
            elif line_type == 8:  # 篇标题
                all_lines.append(f"\n◇ {text} ◇\n")
            elif line_type == 9:  # 节标题
                all_lines.append(f"\n◆ {text} ◆\n")
            elif line_type == 10:  # 注释
                all_lines.append(f"  （{text}）")
            elif line_type == 3:  # 页面标记，跳过
                pass
            else:
                all_lines.append(text)
    
    if all_lines:
        text = '\n'.join(all_lines)
        # Clean up excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return f"【{chapter_name}】\n\n{text}\n\n"
    return ""

def download_book(book_name, chapters):
    """
    Download a book given its name and chapter list.
    chapters: list of (chapter_url, chapter_name) tuples
    """
    print(f"Downloading: {book_name} ({len(chapters)} chapters)")
    
    all_text = f"{book_name}\n\n"
    
    for i, (ch_url, ch_name) in enumerate(chapters):
        if not ch_url.startswith('http'):
            ch_url = BASE_URL + ch_url if ch_url.startswith('/') else BASE_URL + '/' + ch_url
        
        print(f"  Chapter {i+1}/{len(chapters)}: {ch_name}")
        content = extract_text_from_chapter(ch_url, ch_name)
        if content:
            all_text += content
        else:
            print(f"    Warning: no content extracted")
        time.sleep(0.3)
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(all_text.strip())
    
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size} bytes, {len(all_text)} chars)")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python download_sd_v2.py <book_name> <url1> [<url2> ...]")
        sys.exit(1)
    
    book_name = sys.argv[1]
    urls = sys.argv[2:]
    chapters = [(url, f"卷{i+1}") for i, url in enumerate(urls)]
    
    download_book(book_name, chapters)
