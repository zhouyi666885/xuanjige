#!/usr/bin/env python3
"""Fetch a zhonghuashu.com wiki page and extract clean text using BeautifulSoup."""
import sys
import re
import requests
from bs4 import BeautifulSoup

def fetch_zhonghuashu_book(url, output_file):
    """Fetch a zhonghuashu wiki page and save clean text."""
    print(f"Fetching: {url}")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    resp.encoding = 'utf-8'
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Find the main content area
    # zhonghuashu uses different class names, let's try several
    content = None
    
    # Try common content selectors
    for selector in ['#mw-content-text', '.mw-parser-output', '#content', '.page-content', 'article']:
        content = soup.select_one(selector)
        if content:
            print(f"Found content using selector: {selector}")
            break
    
    if not content:
        # Fall back to body
        content = soup.body
        print("Using body as fallback")
    
    if not content:
        print("ERROR: Could not find content")
        sys.exit(1)
    
    # Remove unwanted elements
    for tag in content.find_all(['script', 'style', 'nav', 'header', 'footer', 'noscript']):
        tag.decompose()
    
    # Remove table of contents and navigation
    for tag in content.find_all(class_=['toc', 'mw-editsection', 'mw-headline-number', 'navbox', 'sistersitebox', 'metadata', 'mw-empty-elt']):
        tag.decompose()
    
    # Remove edit links
    for tag in content.find_all('span', class_='mw-editsection'):
        tag.decompose()
    
    # Remove reference links [1], [2] etc.
    for tag in content.find_all('sup', class_='reference'):
        tag.decompose()
    
    # Get text
    text = content.get_text(separator='\n')
    
    # Clean up the text
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        # Skip empty lines (but keep one)
        if not line:
            if lines and lines[-1]:  # Only add empty line if previous line was not empty
                lines.append('')
            continue
        # Skip navigation lines
        if line in ['中华文库', '搜索', '跳转到导航', '跳转到搜索', '查看源代码', '阅读', '编辑', '查看历史', '讨论']:
            continue
        if line.startswith('URL:') or line.startswith('Token:'):
            continue
        # Skip wiki navigation
        if re.match(r'^\[编辑\]$', line):
            continue
        if re.match(r'^\[\d+\]$', line):
            continue
        lines.append(line)
    
    result = '\n'.join(lines)
    
    # Remove multiple consecutive empty lines
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    # Count Chinese characters
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', result))
    renshi_count = result.count('任氏曰')
    yuanzz_count = result.count('原注')
    
    print(f"Chinese characters: {chinese_chars}")
    print(f"任氏曰 count: {renshi_count}")
    print(f"原注 count: {yuanzz_count}")
    print(f"Total file size: {len(result)} bytes")
    
    # Save
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"Saved to: {output_file}")
    return chinese_chars, renshi_count

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <url> <output_file>")
        sys.exit(1)
    
    fetch_zhonghuashu_book(sys.argv[1], sys.argv[2])
