#!/usr/bin/env python3
"""
从zhonghuashu.com批量下载古籍完整全文
使用urllib获取HTML，正则提取正文内容
"""
import urllib.request
import re
import os
import sys
import time
import json
from html import unescape

OUTPUT_DIR = "/workspace/projects/public/book-content"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

def fetch_page(url):
    """获取网页HTML"""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None

def extract_content(html_text):
    """从HTML中提取正文内容"""
    # Try to find mw-parser-output content
    # The content is within <section> tags inside mw-parser-output
    sections = re.findall(r'<section[^>]*>(.*?)</section>', html_text, re.DOTALL)
    
    if not sections:
        # Try finding content between mw-parser-output div
        match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)</div>\s*(?:<!--|<div)', html_text, re.DOTALL)
        if match:
            sections = [match.group(1)]
    
    if not sections:
        # Last resort: find all paragraph text
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html_text, re.DOTALL)
        if paragraphs:
            sections = [''.join(paragraphs)]
    
    if not sections:
        return ""
    
    full_text = '\n'.join(sections)
    
    # Clean HTML
    # Remove images
    full_text = re.sub(r'<img[^>]*/?>', '', full_text)
    # Remove links but keep text
    full_text = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', full_text)
    # Remove all other HTML tags
    full_text = re.sub(r'<[^>]+>', '', full_text)
    # Decode HTML entities
    full_text = unescape(full_text)
    # Clean whitespace
    full_text = re.sub(r'[ \t]+', ' ', full_text)
    full_text = re.sub(r'\n\s*\n', '\n\n', full_text)
    
    return full_text.strip()

def get_toc(book_name_encoded):
    """获取书籍目录页，找到所有卷的链接"""
    url = f"https://www.zhonghuashu.com/wiki/{book_name_encoded}"
    html = fetch_page(url)
    if not html:
        return []
    
    # Find volume links in the TOC
    # Format: /wiki/书名/卷名
    pattern = rf'/wiki/{book_name_encoded}/([^"\'>]+)'
    volumes = re.findall(pattern, html)
    
    # Deduplicate while preserving order
    seen = set()
    unique_volumes = []
    for v in volumes:
        if v not in seen:
            seen.add(v)
            unique_volumes.append(v)
    
    return unique_volumes

def download_book(book_name):
    """下载一整本书的所有卷"""
    # URL encode the book name
    book_encoded = urllib.request.quote(book_name)
    
    print(f"Downloading: {book_name}")
    
    # First get the TOC page
    url = f"https://www.zhonghuashu.com/wiki/{book_encoded}"
    html = fetch_page(url)
    if not html:
        print(f"  Failed to fetch TOC page")
        return False
    
    # Extract intro content from TOC page
    intro_content = extract_content(html)
    
    # Find volume links
    volume_links = []
    # Look for links like /wiki/书名/卷X
    vol_pattern = rf'href="/wiki/{book_encoded}/([^"\'>]+)"'
    vol_matches = re.findall(vol_pattern, html)
    
    # Deduplicate
    seen = set()
    for v in vol_matches:
        decoded_v = urllib.request.unquote(v)
        if decoded_v not in seen:
            seen.add(decoded_v)
            volume_links.append(decoded_v)
    
    print(f"  Found {len(volume_links)} volumes: {volume_links}")
    
    # Download each volume
    all_text = f"{book_name}\n\n"
    
    # Add intro content if any meaningful text
    if intro_content and len(intro_content) > 50:
        all_text += intro_content + "\n\n"
    
    for vol in volume_links:
        vol_encoded = urllib.request.quote(vol)
        vol_url = f"https://www.zhonghuashu.com/wiki/{book_encoded}/{vol_encoded}"
        print(f"  Fetching volume: {vol}")
        
        vol_html = fetch_page(vol_url)
        if not vol_html:
            print(f"  Warning: Failed to fetch volume {vol}")
            continue
        
        vol_content = extract_content(vol_html)
        if vol_content:
            all_text += f"【{vol}】\n\n{vol_content}\n\n"
        else:
            print(f"  Warning: No content extracted for volume {vol}")
        
        time.sleep(0.5)  # Be polite
    
    # If no volumes found, the book might be single-page
    if not volume_links and intro_content:
        print(f"  Single-page book")
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(all_text.strip())
    
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size} bytes, {len(all_text)} chars)")
    
    return True

# === Books to download ===
BOOKS = [
    # 风水类
    "青囊經",
    "青囊奧語", 
    "天玉經",
    "催官篇",
    "博山篇",
    "撼龍經",
    "疑龍經",
    "葬書",
    "發微論",
    "平砂玉尺經",
    
    # 丹道/内丹类
    "周易參同契",
    "悟真篇",
    "太乙金華宗旨",
    "性命圭旨",
    "黃庭經",
    "陰符經",
    
    # 占卜类
    "黃金策",
    "蔔筮全書",
    
    # 相学类
    "太清神鑒",
    "人倫大統賦",
    "麻衣相法",
    
    # 五行/命理
    "協紀辨方書",
    "星學大成",
    
    # 哲学/心学
    "明心寶鑒",
    "呻吟語",
    "圍爐夜話",
    "小窗幽記",
    "菜根譚",
    "增廣賢文",
    
    # 易学
    "焦氏易林",
    "易傳",
]

if __name__ == '__main__':
    # Can specify specific books or download all
    if len(sys.argv) > 1:
        books_to_download = sys.argv[1:]
    else:
        books_to_download = BOOKS
    
    success = 0
    failed = []
    
    for book in books_to_download:
        # Check if already exists
        output_path = os.path.join(OUTPUT_DIR, f"{book}.txt")
        if os.path.exists(output_path):
            existing_size = os.path.getsize(output_path)
            if existing_size > 1000:
                print(f"SKIP: {book} already exists ({existing_size} bytes)")
                success += 1
                continue
        
        try:
            if download_book(book):
                success += 1
            else:
                failed.append(book)
        except Exception as e:
            print(f"  Error: {e}")
            failed.append(book)
        
        time.sleep(1)
    
    print(f"\n=== Summary ===")
    print(f"Success: {success}")
    print(f"Failed: {len(failed)}")
    if failed:
        print(f"Failed books: {failed}")
