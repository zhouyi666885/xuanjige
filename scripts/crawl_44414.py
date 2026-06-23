#!/usr/bin/env python3
"""
44414.cn 批量爬虫 v5：修复正文提取 - 使用 div.wenzbody 选择器
"""
import json, os, re, sys, time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

OUTPUT_DIR = "/workspace/projects/public/book-content"
PROGRESS_FILE = "/workspace/projects/public/book-content/_progress.json"

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    return {"completed": {}, "failed": []}

def save_progress(progress):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, ensure_ascii=False)

def fetch_page(session, url, retries=2):
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 500:
                return None
            resp.raise_for_status()
            resp.encoding = 'utf-8'
            return resp.text
        except:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                return None

def discover_books(session):
    """Discover all books on 44414.cn"""
    all_books = {}
    for section in ['jing', 'shi', 'zi', 'ji']:
        try:
            url = f"https://www.44414.cn/{section}/index.htm"
            html = fetch_page(session, url)
            if not html:
                continue
            soup = BeautifulSoup(html, 'lxml')
            for a in soup.find_all('a', href=True):
                href = a.get('href', '')
                text = a.get_text(strip=True)
                if not text or not href or text in ['首页', '经', '史', '子', '集', '上一页', '下一页', '']:
                    continue
                match = re.match(r'\.\./([^/]+)/index\.htm', href)
                if match:
                    path = match.group(1)
                    full_url = f"https://www.44414.cn/{path}/index.htm"
                    all_books[text] = full_url
        except Exception as e:
            print(f"Error discovering {section}: {e}", file=sys.stderr)
    return all_books

def extract_chapter_links(index_html, index_url):
    """Extract chapter links from 44414.cn index page"""
    soup = BeautifulSoup(index_html, 'lxml')
    chapters = []
    seen = set()
    
    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        text = a.get_text(strip=True)
        if not text or not href:
            continue
        # Match: ../1234567890.html or /1234567890.html or just 1234567890.html
        if re.search(r'\d{5,}\.html$', href):
            if href.startswith('../'):
                full_url = f"https://www.44414.cn/{href.replace('../', '')}"
            elif href.startswith('/'):
                full_url = f"https://www.44414.cn{href}"
            elif href.startswith('http'):
                full_url = href
            else:
                # Relative to index URL path
                base_path = '/'.join(index_url.split('/')[:-1]) + '/'
                full_url = base_path + href
            
            if full_url not in seen and full_url != index_url:
                seen.add(full_url)
                chapters.append((text, full_url))
    
    return chapters

def extract_chapter_content(html):
    """Extract main text from 44414.cn chapter page using div.wenzbody"""
    if not html:
        return ""
    soup = BeautifulSoup(html, 'lxml')
    
    # Primary: div.wenzbody (the actual book text)
    wenzbody = soup.find('div', class_='wenzbody')
    if wenzbody:
        text = wenzbody.get_text(separator='\n', strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
    
    # Fallback: div.xscontent
    xscontent = soup.find('div', class_='xscontent')
    if xscontent:
        text = xscontent.get_text(separator='\n', strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
    
    # Last resort: div.bodyleft
    bodyleft = soup.find('div', class_='bodyleft')
    if bodyleft:
        text = bodyleft.get_text(separator='\n', strip=True)
        # Remove navigation noise
        text = re.sub(r'当前位置：.*?正文\s*>>', '', text)
        text = re.sub(r'← 上一章.*?下一章 →', '', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
    
    return ""

def crawl_book(session, book_name, index_url):
    """Crawl all chapters of a book"""
    try:
        index_html = fetch_page(session, index_url)
        if not index_html:
            return {"name": book_name, "status": "error", "error": "Failed to fetch index"}
        
        chapters = extract_chapter_links(index_html, index_url)
        
        all_content = []
        total_chars = 0
        
        for title, url in chapters:
            chapter_html = fetch_page(session, url)
            if chapter_html:
                chapter_content = extract_chapter_content(chapter_html)
                if len(chapter_content) > 10:
                    all_content.append(f"## {title}\n\n{chapter_content}\n\n")
                    total_chars += len(chapter_content)
        
        # If no chapters found, try extracting from index page
        if not all_content:
            index_content = extract_chapter_content(index_html)
            if len(index_content) > 30:
                all_content.append(index_content)
                total_chars = len(index_content)
        
        if total_chars < 20:
            return {"name": book_name, "status": "empty"}
        
        content = ''.join(all_content)
        
        # Save
        safe_name = re.sub(r'[《》\s/\\:*?"<>|]', '', book_name)
        output_file = os.path.join(OUTPUT_DIR, f"{safe_name}.txt")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"# {book_name}\n# 来源: {index_url}\n# 爬取时间: {datetime.now().isoformat()}\n# 章节数: {len(chapters)}\n\n{content}")
        
        return {
            "name": book_name,
            "status": "success",
            "chapters": len(chapters),
            "content_length": total_chars,
            "file": output_file,
            "source": "44414.cn"
        }
    except Exception as e:
        return {"name": book_name, "status": "error", "error": str(e)}

def main():
    # Load our book list
    with open('/tmp/book_urls.json', 'r', encoding='utf-8') as f:
        our_books = [b['name'] for b in json.load(f)]
    
    print(f"Our books: {len(our_books)}", flush=True)
    
    session = requests.Session()
    session.headers.update(HEADERS)
    
    # Discover available books
    print("Discovering books on 44414.cn...", flush=True)
    site_books = discover_books(session)
    print(f"Found {len(site_books)} books on site", flush=True)
    
    # Match our books to site URLs
    matched = {}
    unmatched = []
    
    for book_name in our_books:
        clean = book_name.replace('《', '').replace('》', '')
        if clean in site_books:
            matched[book_name] = site_books[clean]
            continue
        found = False
        for site_name, site_url in site_books.items():
            if clean in site_name or site_name in clean:
                matched[book_name] = site_url
                found = True
                break
        if not found:
            unmatched.append(book_name)
    
    print(f"Matched: {len(matched)}, Unmatched: {len(unmatched)}", flush=True)
    
    # Load progress
    progress = load_progress()
    already_done = set(progress["completed"].keys())
    
    results = {"success": 0, "empty": 0, "error": 0}
    
    for i, (book_name, book_url) in enumerate(matched.items()):
        if book_name in already_done:
            continue
        
        print(f"[{i+1}/{len(matched)}] {book_name}", flush=True)
        result = crawl_book(session, book_name, book_url)
        
        if result["status"] == "success":
            results["success"] += 1
            progress["completed"][book_name] = {
                "source": "44414.cn",
                "content_length": result["content_length"],
                "chapters": result["chapters"],
                "file": result.get("file", "")
            }
            print(f"  OK: {result['chapters']} chapters, {result['content_length']} chars", flush=True)
        elif result["status"] == "empty":
            results["empty"] += 1
            progress["failed"].append(book_name)
            print(f"  EMPTY", flush=True)
        else:
            results["error"] += 1
            progress["failed"].append({"name": book_name, "error": result.get("error", "")})
            print(f"  ERROR: {result.get('error', '')}", flush=True)
        
        if (i + 1) % 5 == 0:
            save_progress(progress)
            print(f"  [Progress] success={results['success']}, empty={results['empty']}, error={results['error']}", flush=True)
    
    save_progress(progress)
    print(f"\n=== 44414.cn Results ===", flush=True)
    print(f"Success: {results['success']}", flush=True)
    print(f"Empty: {results['empty']}", flush=True)
    print(f"Error: {results['error']}", flush=True)
    print(f"Unmatched books: {len(unmatched)}", flush=True)

if __name__ == "__main__":
    main()
