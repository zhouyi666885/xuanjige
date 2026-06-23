#!/usr/bin/env python3
"""
修复滴天髓阐微.txt - 从zhonghuashu.com获取完整内容（含任氏曰注解和命例）
使用requests直接下载HTML并解析，避免curl截断问题
"""

import re
import sys
import os
import time
import html

BOOK_DIR = '/workspace/projects/public/book-content'

def log(msg):
    print(msg, flush=True)

def fetch_page_html(url):
    """用requests获取完整HTML页面"""
    import urllib.request
    import urllib.parse
    
    # Encode the URL properly (Chinese characters need percent-encoding)
    # Split URL into base and path, encode path
    parsed = urllib.parse.urlparse(url)
    encoded_path = urllib.parse.quote(parsed.path)
    encoded_url = urllib.parse.urlunparse(parsed._replace(path=encoded_path))
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    
    req = urllib.request.Request(encoded_url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            # Read in chunks to handle large pages
            chunks = []
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                chunks.append(chunk)
            raw = b''.join(chunks)
            
            # Try multiple encodings
            for enc in ['utf-8', 'gbk', 'gb2312', 'big5']:
                try:
                    return raw.decode(enc)
                except (UnicodeDecodeError, LookupError):
                    continue
            return raw.decode('utf-8', errors='replace')
    except Exception as e:
        log(f"  Error fetching {url}: {e}")
        return None

def html_to_text(html_content):
    """将HTML转换为纯文本，保留结构"""
    if not html_content:
        return ""
    
    # Remove script and style tags
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL)
    
    # Remove navigation/edit links
    html_content = re.sub(r'<a[^>]*class="[^"]*edit[^"]*"[^>]*>.*?</a>', '', html_content, flags=re.DOTALL)
    
    # Convert <br> to newlines
    html_content = re.sub(r'<br\s*/?>', '\n', html_content)
    
    # Convert block elements to newlines
    for tag in ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr']:
        html_content = re.sub(rf'</?{tag}[^>]*>', '\n', html_content, flags=re.IGNORECASE)
    
    # Convert <dd>, <dt>, <dl> to newlines (definition lists used in Chinese wikis)
    for tag in ['dd', 'dt', 'dl']:
        html_content = re.sub(rf'</?{tag}[^>]*>', '\n', html_content, flags=re.IGNORECASE)
    
    # Remove all remaining HTML tags
    html_content = re.sub(r'<[^>]+>', '', html_content)
    
    # Decode HTML entities
    html_content = html.unescape(html_content)
    
    # Clean up whitespace
    lines = html_content.split('\n')
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

def extract_content_from_wiki(text, book_title):
    """从wiki页面文本中提取实际内容（跳过导航/TOC等）"""
    lines = text.split('\n')
    
    # Find where actual content starts (after TOC)
    content_start = 0
    found_toc_end = False
    
    for i, line in enumerate(lines):
        # TOC ends when we hit actual section content
        # Look for "通神论" or similar section headers
        if re.match(r'^一、天道$', line) or re.match(r'^通神论$', line):
            # Check if there's a "通神论" header before this
            for j in range(max(0, i-5), i):
                if '通神论' in lines[j]:
                    content_start = j
                    found_toc_end = True
                    break
            if found_toc_end:
                break
        # Alternative: look for the first 〈原注： or 〈任氏曰：
        if '〈原注' in line or '〈任氏曰' in line:
            # Find the section header before this
            for j in range(i-1, max(0, i-20), -1):
                if lines[j] and not lines[j].startswith('[') and not lines[j].startswith('-'):
                    content_start = j
                    found_toc_end = True
                    break
            if found_toc_end:
                break
    
    if not found_toc_end:
        # Fallback: find the first section header
        for i, line in enumerate(lines):
            if re.match(r'^###?\s*(一|二|三|四|五|六|七|八|九|十)', line):
                content_start = i
                found_toc_end = True
                break
    
    # Find where content ends (before footer/navigation)
    content_end = len(lines)
    for i in range(len(lines) - 1, max(0, len(lines) - 50), -1):
        line = lines[i].strip()
        if '导航菜单' in line or '分类' in line and ':' in line:
            content_end = i
            break
        if line.startswith('检索') or line.startswith('工具') or line.startswith('此页'):
            content_end = i
            break
    
    if content_start > 0:
        result_lines = lines[content_start:content_end]
    else:
        result_lines = lines[:content_end]
    
    # Clean up the extracted content
    cleaned = []
    for line in result_lines:
        # Skip TOC lines
        if re.match(r'^-\s+\d+\.?\d*', line):
            continue
        # Skip navigation
        if line.startswith('[') and '](http' in line and len(line) > 100:
            continue
        # Skip metadata
        if re.match(r'^(Token|URL|offset):', line):
            continue
        # Skip edit links
        if re.match(r'^\[\d+\]$', line):
            continue
        # Skip footnote markers
        if re.match(r'^\[\d+\]', line) and len(line) < 10:
            continue
        # Skip category links
        if line.startswith('分类:'):
            continue
        
        # Remove markdown link syntax but keep text
        line = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', line)
        # Remove URLs
        line = re.sub(r'https?://[^\s]+', '', line)
        # Remove heading markers
        line = re.sub(r'^#{1,6}\s+', '', line)
        
        cleaned.append(line)
    
    # Remove trailing empty lines
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    
    return '\n'.join(cleaned).strip()

def clean_final(text):
    """最终清洗：移除残留的wiki垃圾文字"""
    lines = text.split('\n')
    result = []
    skip_patterns = [
        r'^作者：',
        r'^另见',
        r'^滴天髓阐微\s*$',  # standalone title (not section content)
        r'^中华文库',
        r'^---+$',
        r'^\s*$',
    ]
    
    in_content = False
    for line in lines:
        stripped = line.strip()
        
        # Skip known garbage patterns
        if re.match(r'^作者：', stripped):
            continue
        if re.match(r'^另见', stripped):
            continue
        if stripped == '滴天髓阐微' and not in_content:
            continue
        if '中华文库' in stripped and len(stripped) < 30:
            continue
        if re.match(r'^-{3,}$', stripped):
            continue
        
        # Once we hit actual content, include everything
        if not in_content:
            if '通神论' in stripped or '天道' in stripped or '〈原注' in stripped or '〈任氏曰' in stripped:
                in_content = True
        
        if in_content or (stripped and not any(re.match(p, stripped) for p in skip_patterns)):
            result.append(line)
    
    # Clean up multiple empty lines
    final = []
    prev_empty = False
    for line in result:
        if not line.strip():
            if not prev_empty:
                final.append('')
            prev_empty = True
        else:
            final.append(line)
            prev_empty = False
    
    return '\n'.join(final).strip()

def main():
    url = 'https://www.zhonghuashu.com/wiki/滴天髓闡微'
    output_file = os.path.join(BOOK_DIR, '滴天髓阐微.txt')
    
    log(f"=== 修复滴天髓阐微.txt ===")
    log(f"URL: {url}")
    log(f"目标: {output_file}")
    
    # Step 1: Fetch HTML
    log("\n[1/4] 下载页面HTML...")
    html_content = fetch_page_html(url)
    if not html_content:
        log("ERROR: 无法获取页面")
        return False
    
    html_size = len(html_content)
    log(f"  HTML大小: {html_size:,} bytes")
    
    # Step 2: Convert to text
    log("\n[2/4] 转换HTML为文本...")
    text = html_to_text(html_content)
    text_size = len(text)
    log(f"  文本大小: {text_size:,} chars")
    
    # Step 3: Extract and clean content
    log("\n[3/4] 提取并清洗内容...")
    content = extract_content_from_wiki(text, '滴天髓阐微')
    content = clean_final(content)
    
    # Count quality indicators
    renshi_count = len(re.findall(r'任氏曰', content))
    yuanzhu_count = len(re.findall(r'原注', content))
    mingli_count = len(re.findall(r'命例', content))
    chinese_count = len(re.findall(r'[\u4e00-\u9fff]', content))
    
    log(f"  清洗后大小: {len(content):,} chars")
    log(f"  中文字数: {chinese_count:,}")
    log(f"  任氏曰数: {renshi_count}")
    log(f"  原注数: {yuanzhu_count}")
    log(f"  命例数: {mingli_count}")
    
    # Step 4: Save
    log(f"\n[4/4] 保存到 {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    file_size = os.path.getsize(output_file)
    log(f"  文件大小: {file_size:,} bytes")
    
    # Verify
    log(f"\n=== 验证 ===")
    if renshi_count >= 80:
        log(f"✓ 任氏曰注解数量充足 ({renshi_count}个, 预期100+)")
    else:
        log(f"⚠ 任氏曰注解数量不足 ({renshi_count}个, 预期100+)")
    
    if chinese_count >= 50000:
        log(f"✓ 中文字数充足 ({chinese_count:,}字)")
    else:
        log(f"⚠ 中文字数不足 ({chinese_count:,}字)")
    
    if file_size >= 100000:
        log(f"✓ 文件大小充足 ({file_size:,} bytes)")
    else:
        log(f"⚠ 文件大小不足 ({file_size:,} bytes)")
    
    # Show first 500 chars for spot check
    log(f"\n--- 前500字预览 ---")
    log(content[:500])
    log(f"\n--- 最后200字预览 ---")
    log(content[-200:])
    
    return True

if __name__ == '__main__':
    main()
