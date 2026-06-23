#!/usr/bin/env python3
"""
Batch fetch books from zhonghuashu.com via web_fetch style requests.
Since direct HTTP returns 502, we use the requests library with proper headers.
Some pages return content (like 穷通宝鉴, 滴天髓阐微), others don't.
We try each book and save the ones that work.
"""
import requests
import re
import os
import sys
import time
from urllib.parse import quote

# Books to try fetching from zhonghuashu.com
BOOKS = [
    # 命理核心
    "命理约言",
    "星平会海", 
    "八字精微",
    "神峰通考",
    "渊海子平",
    "三命通会",
    "李虚中命书",
    "五行精纪",
    "兰台妙选",
    "玉井奥诀",
    "人鉴命理存验",
    "命理探源",
    
    # 六爻/梅花
    "增删卜易",
    "卜筮正宗",
    "梅花易数",
    "易隐",
    "易冒",
    "火珠林",
    "断易天机",
    "天机大要",
    
    # 奇门/六壬
    "奇门遁甲",
    "奇门旨归",
    "奇门法窍",
    "大六壬",
    "六壬大全",
    "壬归",
    "大六壬金口诀",
    
    # 紫微斗数
    "紫微斗数",
    "紫微斗数全书",
    "紫微斗数全集",
    "太微赋",
    
    # 风水
    "地理五诀",
    "沈氏玄空学",
    "飞星赋",
    "阳宅三要",
    "阳宅爱众篇",
    "八宅明镜",
    "葬经",
    "撼龙经",
    "疑龙经",
    "青囊经",
    "青囊序",
    "天玉经",
    "都天宝照经",
    "雪心赋",
    "发微论",
    
    # 面相/手相
    "麻衣相法",
    "柳庄相法",
    "神相全编",
    "水镜神相",
    "冰鉴",
    "公笃相法",
    "太清神鉴",
    "人伦大统赋",
    "月波洞中记",
    
    # 道家/术数
    "太乙金镜式",
    "铁板神数",
    
    # 易学
    "周易",
    "易传",
    "京氏易传",
    "焦氏易林",
    "梅花易数",
    "皇极经世",
    "梅花心易",
    
    # 其他经典
    "协纪辨方书",
    "择吉会要",
    "鳌头通书",
    "象吉通书",
    "永宁通书",
]

OUTPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "public/book-content"

def clean_content(raw_text):
    """Clean HTML and markdown from zhonghuashu content"""
    # Remove markdown links
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', raw_text)
    # Remove image references
    content = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', content)
    # Remove "中华文库"
    content = content.replace('中华文库', '')
    # Remove section numbers like "2.1"
    content = re.sub(r'^\s*\d+\.\d+(\.\d+)*', '', content, flags=re.MULTILINE)
    # Remove URL/Token lines
    content = re.sub(r'^URL:.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Token:.*$', '', content, flags=re.MULTILINE)
    # Clean up multiple blank lines
    content = re.sub(r'\n{4,}', '\n\n', content)
    lines = content.split('\n')
    cleaned = [line.strip() for line in lines]
    content = '\n'.join(cleaned)
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content.strip()

def fetch_book(name, session):
    """Fetch a single book from zhonghuashu.com"""
    url = f"https://www.zhonghuashu.com/wiki/{quote(name)}"
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        resp = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        
        text = resp.text
        
        # Check if we actually got book content (not just a redirect or empty page)
        # zhonghuashu pages with content have actual Chinese text paragraphs
        # Extract just the content portion
        content_match = re.search(r'<div[^>]*class="[^"]*wiki-content[^"]*"[^>]*>(.*?)</div>', text, re.DOTALL)
        if not content_match:
            # Try another pattern
            content_match = re.search(r'<div[^>]*id="content"[^>]*>(.*?)</div>', text, re.DOTALL)
        if not content_match:
            # Try yet another pattern - the main article body
            content_match = re.search(r'<article[^>]*>(.*?)</article>', text, re.DOTALL)
        
        if content_match:
            html_content = content_match.group(1)
        else:
            html_content = text
        
        # Strip HTML tags
        clean = re.sub(r'<[^>]+>', '', html_content)
        clean = re.sub(r'&nbsp;', ' ', clean)
        clean = re.sub(r'&amp;', '&', clean)
        clean = re.sub(r'&lt;', '<', clean)
        clean = re.sub(r'&gt;', '>', clean)
        clean = re.sub(r'&quot;', '"', clean)
        
        # Check for meaningful Chinese content (at least 500 chars)
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', clean)
        if len(chinese_chars) < 500:
            return None, f"Content too short ({len(chinese_chars)} Chinese chars)"
        
        # Clean and add title
        clean = clean_content(clean)
        result = f"# {name}\n\n{clean}"
        
        return result, None
        
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        return None, str(e)[:100]

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Check which books we already have
    existing = set()
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.txt'):
            existing.add(f.replace('.txt', ''))
    
    session = requests.Session()
    
    success = 0
    failed = 0
    skipped = 0
    
    for i, book in enumerate(BOOKS):
        if book in existing:
            print(f"[{i+1}/{len(BOOKS)}] {book}: SKIP (already exists)")
            skipped += 1
            continue
        
        print(f"[{i+1}/{len(BOOKS)}] Fetching: {book}...", end=" ", flush=True)
        content, error = fetch_book(book, session)
        
        if content:
            filepath = os.path.join(OUTPUT_DIR, f"{book}.txt")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            char_count = len(content)
            print(f"OK ({char_count} chars)")
            success += 1
        else:
            print(f"FAIL ({error})")
            failed += 1
        
        # Small delay to be polite
        time.sleep(0.5)
    
    print(f"\n=== Results: {success} success, {failed} failed, {skipped} skipped ===")

if __name__ == "__main__":
    main()
