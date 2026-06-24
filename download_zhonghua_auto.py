#!/usr/bin/env python3
"""Generic book downloader from zhonghuashu.com - auto-discovers volumes from TOC page."""
import urllib.request
import urllib.parse
import re
import html as htmlmod
import sys
import os
import time

def fetch_page(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    })
    resp = urllib.request.urlopen(req, timeout=30)
    return resp.read().decode('utf-8', errors='replace')

def extract_text(raw_html):
    """Extract readable text from zhonghuashu.com HTML page."""
    # Find mw-parser-output content
    match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)</div>\s*(?:<!--|<div\s+class="(?:printfooter|catlinks))', raw_html, re.DOTALL)
    if not match:
        match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)$', raw_html, re.DOTALL)
    
    if match:
        content = match.group(1)
    else:
        # Try section-based extraction
        sections = re.findall(r'<section[^>]*>(.*?)</section>', raw_html, re.DOTALL)
        if sections:
            content = ''.join(sections)
        else:
            content = raw_html
    
    # Replace structural HTML with newlines
    content = re.sub(r'<br\s*/?>', '\n', content)
    content = re.sub(r'</p>', '\n', content)
    content = re.sub(r'<p[^>]*>', '', content)
    content = re.sub(r'</h[1-6]>', '\n', content)
    content = re.sub(r'<h[1-6][^>]*>', '\n', content)
    
    # Remove images
    content = re.sub(r'<img[^>]*/?>', '', content)
    
    # Remove links but keep text
    content = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', content, flags=re.DOTALL)
    
    # Remove all remaining HTML tags
    content = re.sub(r'<[^>]+>', '', content)
    
    # Decode HTML entities
    content = htmlmod.unescape(content)
    
    # Clean up whitespace
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
    
    # Remove navigation artifacts
    content = re.sub(r'◄上一卷|下一卷▶|↑返回顶部|全书始|全书终', '', content)
    content = re.sub(r'目录\s*\|', '', content)
    
    return content.strip()

def discover_volumes(toc_url):
    """Discover volume links from a book's table of contents page."""
    raw = fetch_page(toc_url)
    
    # Find all links that point to sub-pages (volumes)
    # Pattern: href="/wiki/BookName/VolumeName"
    parsed = urllib.parse.urlparse(toc_url)
    base_path = parsed.path  # e.g., /wiki/BookName
    
    # Find volume links
    vol_links = re.findall(rf'href="({re.escape(base_path)}/[^"]+)"', raw)
    
    # Also check for #anchor links on the same page (single-page books)
    anchor_links = re.findall(rf'href="({re.escape(base_path)}#[^"]+)"', raw)
    
    # Deduplicate volume links
    seen = set()
    volumes = []
    for link in vol_links:
        full_url = f"https://www.zhonghuashu.com{link}" if link.startswith('/') else link
        if full_url not in seen:
            seen.add(full_url)
            # Extract volume title from URL
            vol_title = urllib.parse.unquote(link.split('/')[-1])
            volumes.append((full_url, vol_title))
    
    return volumes, raw

def download_book(book_name, book_url=None):
    """Download a complete book from zhonghuashu.com."""
    if book_url is None:
        encoded = urllib.parse.quote(book_name)
        book_url = f"https://www.zhonghuashu.com/wiki/{encoded}"
    
    print(f"Downloading: {book_name}")
    print(f"TOC URL: {book_url}")
    
    # Try fetching the TOC page
    try:
        volumes, toc_raw = discover_volumes(book_url)
    except Exception as e:
        print(f"Error fetching TOC: {e}")
        return None
    
    all_text = []
    
    if volumes:
        print(f"Found {len(volumes)} volumes")
        # Download each volume
        for vol_url, vol_title in volumes:
            print(f"  Fetching {vol_title}...")
            try:
                raw = fetch_page(vol_url)
                text = extract_text(raw)
                if len(text) < 30:
                    print(f"  WARNING: {vol_title} only has {len(text)} chars")
                all_text.append(f"【{vol_title}】\n\n{text}")
                print(f"  Got {len(text)} chars")
                time.sleep(0.3)  # Be nice to the server
            except Exception as e:
                print(f"  ERROR: {e}")
    else:
        # Single-page book - extract from TOC page
        print("Single-page book, extracting from TOC page")
        text = extract_text(toc_raw)
        if len(text) > 100:
            all_text.append(text)
        else:
            print(f"WARNING: Only {len(text)} chars extracted, might be incomplete")
    
    if not all_text:
        print("No content extracted!")
        return None
    
    # Combine all text
    output = f"{book_name}\n\n" + "\n\n".join(all_text)
    outpath = f"/workspace/projects/public/book-content/{book_name}.txt"
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(output)
    print(f"Saved {book_name}.txt: {len(output)} chars")
    return outpath

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python download_zhonghua_auto.py <book_name> [book_url]")
        print("  If book_url not provided, will use https://www.zhonghuashu.com/wiki/<book_name>")
        sys.exit(1)
    
    book_name = sys.argv[1]
    book_url = sys.argv[2] if len(sys.argv) > 2 else None
    download_book(book_name, book_url)
