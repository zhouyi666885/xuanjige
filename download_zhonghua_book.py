#!/usr/bin/env python3
"""Download books from zhonghuashu.com by fetching each volume via web_fetch-style HTTP requests and extracting text from HTML."""
import urllib.request
import re
import html as htmlmod
import sys
import os

def fetch_page(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    })
    resp = urllib.request.urlopen(req, timeout=30)
    return resp.read().decode('utf-8', errors='replace')

def extract_text(raw_html):
    """Extract readable text from zhonghuashu.com HTML page, focusing on mw-parser-output content."""
    # Find the main content area
    # Try mw-parser-output first
    match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)</div>\s*(?:<!--|<div)', raw_html, re.DOTALL)
    if not match:
        match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)$', raw_html, re.DOTALL)
    
    if match:
        content = match.group(1)
    else:
        # Fallback: find content between navigation tables
        # Remove everything before the first h2/h3 that looks like content
        content = raw_html
    
    # Remove HTML tags but preserve text
    # First, replace <br> and <p> with newlines
    content = re.sub(r'<br\s*/?>', '\n', content)
    content = re.sub(r'</p>', '\n', content)
    content = re.sub(r'<p[^>]*>', '', content)
    
    # Remove images
    content = re.sub(r'<img[^>]*/>', '', content)
    content = re.sub(r'<img[^>]*>.*?</img>', '', content)
    
    # Remove links but keep text
    content = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', content, flags=re.DOTALL)
    
    # Remove all remaining HTML tags
    content = re.sub(r'<[^>]+>', '', content)
    
    # Decode HTML entities
    content = htmlmod.unescape(content)
    
    # Clean up whitespace
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
    
    return content.strip()

def download_book(book_name, volumes):
    """Download a book with multiple volumes from zhonghuashu.com"""
    all_text = []
    
    for vol_url, vol_title in volumes:
        print(f"  Fetching {vol_title}...")
        try:
            raw = fetch_page(vol_url)
            text = extract_text(raw)
            if len(text) < 50:
                print(f"  WARNING: {vol_title} only has {len(text)} chars, might be empty")
            all_text.append(f"【{vol_title}】\n\n{text}")
            print(f"  Got {len(text)} chars")
        except Exception as e:
            print(f"  ERROR fetching {vol_title}: {e}")
    
    # Save combined text
    output = f"{book_name}\n\n" + "\n\n".join(all_text)
    outpath = f"/workspace/projects/public/book-content/{book_name}.txt"
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(output)
    print(f"Saved {book_name}.txt: {len(output)} chars, {output.count(chr(10))} lines")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python download_zhonghua_book.py <book_name> [volume_urls...]")
        sys.exit(1)
    
    book_name = sys.argv[1]
    
    if book_name == "太清神鉴":
        base = "https://www.zhonghuashu.com/wiki/%E5%A4%AA%E6%B8%85%E7%A5%9E%E9%91%91_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)"
        volumes = [
            (f"{base}/%E5%8D%B71", "卷一"),
            (f"{base}/%E5%8D%B72", "卷二"),
            (f"{base}/%E5%8D%B73", "卷三"),
            (f"{base}/%E5%8D%B74", "卷四"),
            (f"{base}/%E5%8D%B75", "卷五"),
            (f"{base}/%E5%8D%B76", "卷六"),
        ]
        download_book(book_name, volumes)
    
    elif book_name == "人伦大统赋":
        base = "https://www.zhonghuashu.com/wiki/%E4%BA%BA%E5%80%AB%E5%A4%A7%E7%B5%B1%E8%B3%A6_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)"
        volumes = [
            (f"{base}/%E4%B8%8A%E5%8D%B7", "上卷"),
            (f"{base}/%E4%B8%8B%E5%8D%B7", "下卷"),
        ]
        download_book(book_name, volumes)
    
    elif book_name == "协纪辨方书":
        base = "https://www.zhonghuashu.com/wiki/%E5%8D%94%E7%B4%80%E8%BE%A8%E6%96%B9%E6%9B%B8"
        # This book has 36 volumes, too many to list. Just get the main content page
        volumes = [
            (base, "提要"),
        ]
        download_book(book_name, volumes)
    
    else:
        print(f"Unknown book: {book_name}")
        sys.exit(1)
