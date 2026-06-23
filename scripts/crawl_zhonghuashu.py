#!/usr/bin/env python3
"""
zhonghuashu.com 书籍爬虫
从中华文库批量获取古籍全文并保存为知识库文件
"""

import re
import sys
import os
import time
import json
import subprocess

BOOK_DIR = os.environ.get('BOOK_DIR', '/workspace/projects/public/book-content')
LOG_FILE = '/tmp/zhonghuashu_crawl.log'

def log(msg):
    print(msg, flush=True)
    with open(LOG_FILE, 'a') as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")

def clean_text(text):
    """从web_fetch输出中提取纯净的中文文本"""
    # Remove markdown links
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove URLs
    text = re.sub(r'https?://[^\s\]]+', '', text)
    # Remove markdown headings
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove table formatting
    text = re.sub(r'^\s*\|.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'[-+]{3,}', '', text)
    # Remove navigation markers
    text = re.sub(r'[◄►◀▶]', '', text)
    # Remove metadata lines
    text = re.sub(r'^(Token|URL|offset):.*$', '', text, flags=re.MULTILINE)
    # Remove 中华文库 header
    text = re.sub(r'\S+\s+中华文库', '', text)
    # Remove 预览/输出结果 markers
    text = re.sub(r'预览.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'输出结果过大.*$', '', text, flags=re.MULTILINE)
    # Remove TOC bullet items
    text = re.sub(r'^-\s+\d+\.?\d*.*$', '', text, flags=re.MULTILINE)
    # Remove standalone section numbers
    text = re.sub(r'^\s*\d+\.?\d*\s*$', '', text, flags=re.MULTILINE)
    # Remove 目录 header
    text = re.sub(r'^目录\s*$', '', text, flags=re.MULTILINE)
    # Remove empty bullets
    text = re.sub(r'^-\s*$', '', text, flags=re.MULTILINE)
    # Remove persisted output notes
    text = re.sub(r'完整输出保存到:.*$', '', text, flags=re.MULTILINE)
    # Clean up whitespace
    lines = text.split('\n')
    cleaned = []
    prev_empty = False
    for line in lines:
        line = line.strip()
        if not line:
            if not prev_empty:
                cleaned.append('')
            prev_empty = True
        else:
            cleaned.append(line)
            prev_empty = False
    return '\n'.join(cleaned).strip()

def find_content_start(text, book_title):
    """找到实际内容开始的位置（跳过TOC）"""
    # Try to find the actual content after TOC
    # Pattern: "书名卷X\n\n### 章节名"
    patterns = [
        f'{book_title}卷',
        f'{book_title}卷一',
        f'###',
    ]
    for pat in patterns:
        idx = text.find(pat)
        if idx > 0:
            return idx
    return 0

def fetch_url(url):
    """使用curl获取URL内容"""
    try:
        result = subprocess.run(
            ['curl', '-sL', '--max-time', '30', url],
            capture_output=True, text=True, timeout=35
        )
        return result.stdout
    except Exception as e:
        log(f"  fetch error: {e}")
        return ""

def extract_content_from_html(html):
    """从HTML页面提取纯文本内容"""
    # Remove script and style tags
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    # Remove nav, header, footer
    html = re.sub(r'<nav[^>]*>.*?</nav>', '', html, flags=re.DOTALL)
    html = re.sub(r'<header[^>]*>.*?</header>', '', html, flags=re.DOTALL)
    html = re.sub(r'<footer[^>]*>.*?</footer>', '', html, flags=re.DOTALL)
    # Extract content div if exists
    content_match = re.search(r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
    if content_match:
        html = content_match.group(1)
    else:
        # Try wiki-body
        content_match = re.search(r'<div[^>]*class="[^"]*wiki-body[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
        if content_match:
            html = content_match.group(1)
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Decode HTML entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    # Clean up whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    return text.strip()

def save_book(title, content):
    """保存书籍到文件"""
    filepath = os.path.join(BOOK_DIR, f'{title}.txt')
    chinese_count = len(re.findall(r'[\u4e00-\u9fff]', content))
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    log(f"  Saved: {filepath} ({len(content)} chars, {chinese_count} Chinese)")
    return chinese_count

def append_book(title, content):
    """追加内容到已有书籍文件"""
    filepath = os.path.join(BOOK_DIR, f'{title}.txt')
    chinese_count = len(re.findall(r'[\u4e00-\u9fff]', content))
    
    with open(filepath, 'a') as f:
        f.write('\n\n' + content)
    
    log(f"  Appended to: {filepath} (+{chinese_count} Chinese chars)")
    return chinese_count

def crawl_book_volumes(base_url, title, num_volumes, use_traditional=True):
    """爬取有多卷的书籍"""
    all_content = []
    total_chinese = 0
    
    for vol in range(1, num_volumes + 1):
        url = f"{base_url}/{vol}"
        log(f"  Fetching 卷{vol}: {url}")
        
        html = fetch_url(url)
        if not html:
            log(f"  卷{vol}: Empty response, skipping")
            continue
        
        content = extract_content_from_html(html)
        if not content or len(re.findall(r'[\u4e00-\u9fff]', content)) < 50:
            log(f"  卷{vol}: Insufficient content, skipping")
            continue
        
        # Find actual book content start
        vol_title_variants = [
            f'{title}卷{vol}',
            f'{title}巻{vol}',
            f'卷{vol}',
        ]
        for vt in vol_title_variants:
            idx = content.find(vt)
            if idx > 0:
                content = content[idx:]
                break
        
        chinese_in_vol = len(re.findall(r'[\u4e00-\u9fff]', content))
        total_chinese += chinese_in_vol
        all_content.append(f"\n\n{title}卷{vol}\n\n{content}")
        log(f"  卷{vol}: {chinese_in_vol} Chinese chars")
        
        time.sleep(1)  # Be polite
    
    if all_content:
        full_text = ''.join(all_content)
        save_book(title, full_text)
    
    return total_chinese

def crawl_single_page(url, title):
    """爬取单页书籍"""
    log(f"  Fetching: {url}")
    html = fetch_url(url)
    if not html:
        log(f"  Empty response")
        return 0
    
    content = extract_content_from_html(html)
    if not content:
        log(f"  No content extracted")
        return 0
    
    return save_book(title, content)

# ============= 书籍清单 =============

# 从zhonghuashu.com可以获取的术数书籍
BOOKS = {
    # 六壬大全 - 12卷
    '六壬大全': {
        'url': 'https://www.zhonghuashu.com/wiki/六壬大全',
        'type': 'volumes',
        'volumes': 12,
        'traditional_url': 'https://www.zhonghuashu.com/wiki/六壬大全',
    },
    # 紫微斗数全书 - 3卷
    '紫微斗数全书': {
        'url': 'https://www.zhonghuashu.com/wiki/紫微斗數全書',
        'type': 'volumes', 
        'volumes': 3,
        'traditional_url': 'https://www.zhonghuashu.com/wiki/紫微斗數全書',
    },
}

# 其他可以尝试的书籍（单页或少量页面）
SINGLE_BOOKS = {
    '奇門遁甲': 'https://www.zhonghuashu.com/wiki/奇門遁甲',
    '太乙金華宗旨': 'https://www.zhonghuashu.com/wiki/太乙金華宗旨',
    '滴天髓': 'https://www.zhonghuashu.com/wiki/滴天髓',
    '子平真詮': 'https://www.zhonghuashu.com/wiki/子平真詮',
    '窮通寶鑑': 'https://www.zhonghuashu.com/wiki/窮通寶鑑',
    '三命通會': 'https://www.zhonghuashu.com/wiki/三命通會',
    '卜筮正宗': 'https://www.zhonghuashu.com/wiki/卜筮正宗',
    '增刪卜易': 'https://www.zhonghuashu.com/wiki/增刪卜易',
    '淵海子平': 'https://www.zhonghuashu.com/wiki/淵海子平',
    '神峰通考': 'https://www.zhonghuashu.com/wiki/神峰通考',
    '命理約言': 'https://www.zhonghuashu.com/wiki/命理約言',
    '麻衣相法': 'https://www.zhonghuashu.com/wiki/麻衣相法',
    '柳莊相法': 'https://www.zhonghuashu.com/wiki/柳莊相法',
    '水鏡集': 'https://www.zhonghuashu.com/wiki/水鏡集',
    '飛星賦': 'https://www.zhonghuashu.com/wiki/飛星賦',
    '玄空秘旨': 'https://www.zhonghuashu.com/wiki/玄空秘旨',
    '沈氏玄空學': 'https://www.zhonghuashu.com/wiki/沈氏玄空學',
    '梅花易數': 'https://www.zhonghuashu.com/wiki/梅花易數',
    '周易': 'https://www.zhonghuashu.com/wiki/周易',
    '黃帝宅經': 'https://www.zhonghuashu.com/wiki/黃帝宅經',
    '葬書': 'https://www.zhonghuashu.com/wiki/葬書',
    '撼龍經': 'https://www.zhonghuashu.com/wiki/撼龍經',
    '疑龍經': 'https://www.zhonghuashu.com/wiki/疑龍經',
    '青囊序': 'https://www.zhonghuashu.com/wiki/青囊序',
    '天玉經': 'https://www.zhonghuashu.com/wiki/天玉經',
    '雪心賦': 'https://www.zhonghuashu.com/wiki/雪心賦',
    '地理五訣': 'https://www.zhonghuashu.com/wiki/地理五訣',
    '陽宅十書': 'https://www.zhonghuashu.com/wiki/陽宅十書',
    '協紀辨方書': 'https://www.zhonghuashu.com/wiki/協紀辨方書',
    '星曆考原': 'https://www.zhonghuashu.com/wiki/星曆考原',
    '太乙神數': 'https://www.zhonghuashu.com/wiki/太乙神數',
}

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'single'
    
    if mode == 'single':
        # 爬取单页书籍
        log(f"=== 开始爬取单页书籍 ===")
        results = {}
        for title, url in SINGLE_BOOKS.items():
            # Check if already exists with substantial content
            filepath = os.path.join(BOOK_DIR, f'{title}.txt')
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    existing = f.read()
                chinese = len(re.findall(r'[\u4e00-\u9fff]', existing))
                if chinese > 500:
                    log(f"  {title}: 已有 {chinese} 字，跳过")
                    results[title] = chinese
                    continue
            
            log(f"\n--- 爬取: {title} ---")
            count = crawl_single_page(url, title)
            results[title] = count
            time.sleep(2)
        
        log(f"\n=== 爬取结果汇总 ===")
        total = 0
        for title, count in sorted(results.items(), key=lambda x: -x[1]):
            status = f"{count}字" if count > 0 else "失败/无内容"
            log(f"  {title}: {status}")
            total += count
        log(f"\n总计: {total} 中文字")
    
    elif mode == 'volumes':
        # 爬取多卷书籍
        book_name = sys.argv[2] if len(sys.argv) > 2 else '六壬大全'
        if book_name in BOOKS:
            info = BOOKS[book_name]
            log(f"=== 开始爬取: {book_name} ({info['volumes']}卷) ===")
            count = crawl_book_volumes(
                info['traditional_url'], 
                book_name, 
                info['volumes']
            )
            log(f"=== 完成: {book_name} {count} 中文字 ===")
        else:
            log(f"未知书籍: {book_name}")
    
    elif mode == 'check':
        # 检查现有书籍统计
        log(f"=== 现有书籍统计 ===")
        total_chinese = 0
        total_files = 0
        for f in sorted(os.listdir(BOOK_DIR)):
            if f.endswith('.txt'):
                filepath = os.path.join(BOOK_DIR, f)
                with open(filepath, 'r') as fh:
                    content = fh.read()
                chinese = len(re.findall(r'[\u4e00-\u9fff]', content))
                total_chinese += chinese
                total_files += 1
                log(f"  {f}: {chinese} Chinese chars")
        log(f"\n总计: {total_files} 本书, {total_chinese} 中文字")
