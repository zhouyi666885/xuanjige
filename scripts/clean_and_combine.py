#!/usr/bin/env python3
"""Clean and combine web_fetch segments into a proper book text file."""

import re
import sys
import os

def deep_clean(text: str) -> str:
    """Clean markdown-formatted text from web_fetch into pure Chinese book text."""
    # Remove markdown image syntax ![alt](url)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    # Remove markdown links [text](url) but keep the text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove markdown headings markers (### etc) but keep the text
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
    # Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove navigation text patterns
    text = re.sub(r'中华文库|导航菜单|个人工具|名字空间|variant|查看|编辑|阅读|历史|更多|搜索|工具|最近更改|随机页面|帮助|社区入口|方針與指引|赞助|打印/导出|创建帐号|登录', '', text)
    # Remove wiki-specific junk
    text = re.sub(r'此页面上使用的[^\n]*', '', text)
    text = re.sub(r'Cookie[^\n]*偏好[^\n]*', '', text)
    text = re.sub(r' Wikimedia[^\n]*', '', text)
    text = re.sub(r'Wikipedia[^\n]*', '', text)
    # Remove page navigation elements
    text = re.sub(r'上一页|下一页|返回|首页', '', text)
    # Remove edit section links
    text = re.sub(r'\[编辑\]|\[edit\]|\[编辑 \| 编辑\]', '', text)
    # Remove trailing/leading whitespace on lines
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        # Skip empty lines but keep them for paragraph separation
        # Skip lines that are just wiki navigation junk
        if line and len(line) < 3 and not re.search(r'[\u4e00-\u9fff]', line):
            continue
        cleaned_lines.append(line)
    
    text = '\n'.join(cleaned_lines)
    
    # Collapse multiple consecutive blank lines to at most 2
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text

def combine_segments(segment_dir: str, output_file: str):
    """Combine and clean all segment files from web_fetch."""
    segments = []
    
    # Find all segment files
    for fname in sorted(os.listdir(segment_dir)):
        if fname.startswith('segment_') and fname.endswith('.txt'):
            filepath = os.path.join(segment_dir, fname)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            segments.append((fname, content))
            print(f"  Read {fname}: {len(content)} chars")
    
    if not segments:
        print("No segment files found!")
        sys.exit(1)
    
    # Combine all segments
    combined = '\n'.join(content for _, content in segments)
    print(f"\nCombined raw text: {len(combined)} chars")
    
    # Clean the combined text
    cleaned = deep_clean(combined)
    print(f"Cleaned text: {len(cleaned)} chars")
    
    # Count 任氏曰
    renshi_count = cleaned.count('任氏曰')
    print(f"任氏曰 count: {renshi_count}")
    
    # Also count 任氏日 (variant)
    renshi_day_count = cleaned.count('任氏日')
    print(f"任氏日 count: {renshi_day_count}")
    
    # Save the cleaned text
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    print(f"\nSaved to {output_file}")
    print(f"File size: {os.path.getsize(output_file)} bytes")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <segment_dir> <output_file>")
        sys.exit(1)
    
    combine_segments(sys.argv[1], sys.argv[2])
