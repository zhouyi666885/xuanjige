#!/usr/bin/env python3
"""
Crawl zhonghuashu.com books with sub-pages (volumes/chapters).
Uses web_fetch-style approach via requests library.
Focuses on books that have multiple volumes (卷).
"""
import requests
import re
import os
import sys
import time
from urllib.parse import quote

# Books with known volume structure on zhonghuashu.com
# Format: (display_name, wiki_path, volume_prefix, num_volumes)
BOOKS_WITH_VOLUMES = [
    ("卜筮正宗", "卜筮正宗（河潞武子龄校本）", "卷", 14, "卷前"),
    ("增删卜易", "增删卜易", "卷", 10, None),
    ("神峰通考", "神峰通考", "卷", 8, None),
    ("三命通会", "三命通会", "卷", 12, None),
]

# Additional single-page books to try
SINGLE_BOOKS = [
    "麻衣相法",
    "柳庄相法",
    "冰鉴",
    "公笃相法",
    "太清神鉴",
    "水镜神相",
    "葬经",
    "撼龙经",
    "疑龙经",
    "青囊经",
    "青囊序",
    "天玉经",
    "都天宝照经",
    "雪心赋",
    "发微论",
    "阳宅三要",
    "八宅明镜",
    "皇极经世",
    "京氏易传",
    "焦氏易林",
    "协纪辨方书",
    "鳌头通书",
    "大六壬金口诀",
    "壬归",
    "六壬大全",
    "奇门旨归",
    "奇门法窍",
    "飞星赋",
    "沈氏玄空学",
    "地理五诀",
    "阳宅爱众篇",
    "玉井奥诀",
    "兰台妙选",
    "五行精纪",
    "人鉴命理存验",
    "命理探源",
    "断易天机",
    "易冒",
    "太乙金镜式",
    "人伦大统赋",
    "月波洞中记",
    "神相全编",
]

OUTPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "public/book-content"

def clean_text(raw):
    """Clean zhonghuashu wiki content"""
    # Remove markdown links
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', raw)
    # Remove image refs
    content = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', content)
    # Remove "中华文库"
    content = content.replace('中华文库', '')
    # Remove URL/Token lines
    content = re.sub(r'^URL:.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Token:.*$', '', content, flags=re.MULTILINE)
    # Remove section numbers
    content = re.sub(r'^\s*\d+\.\d+(\.\d+)*', '', content, flags=re.MULTILINE)
    # Remove navigation links like "→ 卷01"
    content = re.sub(r'→.*$', '', content, flags=re.MULTILINE)
    # Remove horizontal rules
    content = re.sub(r'^---+$', '', content, flags=re.MULTILINE)
    # Clean up whitespace
    content = re.sub(r'\n{4,}', '\n\n', content)
    lines = [line.strip() for line in content.split('\n')]
    content = '\n'.join(lines)
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content.strip()

def fetch_page(url, session):
    """Fetch a single page from zhonghuashu"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        }
        resp = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        
        text = resp.text
        
        # Try to extract content from the wiki page
        # Method 1: wiki-content div
        content_match = re.search(r'<div[^>]*class="[^"]*wiki-content[^"]*"[^>]*>(.*?)</div>\s*<div', text, re.DOTALL)
        if not content_match:
            content_match = re.search(r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>', text, re.DOTALL)
        if not content_match:
            # Try getting the main text area
            content_match = re.search(r'<div[^>]*id="mw-content-text"[^>]*>(.*?)</div>', text, re.DOTALL)
        
        html_content = content_match.group(1) if content_match else text
        
        # Strip HTML
        clean = re.sub(r'<[^>]+>', '', html_content)
        clean = re.sub(r'&nbsp;', ' ', clean)
        clean = re.sub(r'&amp;', '&', clean)
        clean = re.sub(r'&lt;', '<', clean)
        clean = re.sub(r'&gt;', '>', clean)
        clean = re.sub(r'&quot;', '"', clean)
        
        # Check for meaningful Chinese content
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', clean)
        if len(chinese_chars) < 100:
            return None, f"Too short ({len(chinese_chars)} chars)"
        
        return clean_text(clean), None
        
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
    
    # Process books with volumes
    for display_name, wiki_path, vol_prefix, num_vols, preface in BOOKS_WITH_VOLUMES:
        if display_name in existing:
            print(f"[SKIP] {display_name} (already exists)")
            continue
        
        print(f"\n=== Fetching: {display_name} ({wiki_path}) ===")
        all_content = []
        
        # Fetch preface if specified
        if preface:
            url = f"https://www.zhonghuashu.com/wiki/{quote(wiki_path)}/{quote(preface)}"
            print(f"  Preface: {preface}...", end=" ", flush=True)
            content, error = fetch_page(url, session)
            if content:
                all_content.append(f"## {preface}\n\n{content}")
                print(f"OK ({len(content)} chars)")
            else:
                print(f"FAIL ({error})")
            time.sleep(0.3)
        
        # Fetch each volume
        for vol_num in range(1, num_vols + 1):
            vol_label = f"{vol_prefix}{vol_num:02d}" if num_vols >= 10 else f"{vol_prefix}{vol_num}"
            url = f"https://www.zhonghuashu.com/wiki/{quote(wiki_path)}/{quote(vol_label)}"
            print(f"  {vol_label}...", end=" ", flush=True)
            content, error = fetch_page(url, session)
            if content:
                all_content.append(f"## {vol_label}\n\n{content}")
                print(f"OK ({len(content)} chars)")
            else:
                print(f"FAIL ({error})")
            time.sleep(0.3)
        
        if all_content:
            full_text = f"# {display_name}\n\n" + "\n\n".join(all_content)
            filepath = os.path.join(OUTPUT_DIR, f"{display_name}.txt")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_text)
            total_saved += 1
            print(f"  => Saved {display_name}.txt ({len(full_text)} chars)")
        else:
            print(f"  => No content fetched for {display_name}")
    
    # Process single-page books
    print(f"\n=== Fetching single-page books ===")
    for i, book in enumerate(SINGLE_BOOKS):
        if book in existing:
            print(f"[{i+1}/{len(SINGLE_BOOKS)}] {book}: SKIP (exists)")
            continue
        
        url = f"https://www.zhonghuashu.com/wiki/{quote(book)}"
        print(f"[{i+1}/{len(SINGLE_BOOKS)}] {book}...", end=" ", flush=True)
        content, error = fetch_page(url, session)
        
        if content:
            full_text = f"# {book}\n\n{content}"
            filepath = os.path.join(OUTPUT_DIR, f"{book}.txt")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_text)
            total_saved += 1
            print(f"OK ({len(content)} chars)")
        else:
            print(f"FAIL ({error})")
        
        time.sleep(0.3)
    
    print(f"\n=== Total saved: {total_saved} books ===")

if __name__ == "__main__":
    main()
