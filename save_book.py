#!/usr/bin/env python3
"""
从zhonghuashu.com批量下载的辅助脚本
读取stdin中的网页文本，清理后保存为txt文件
"""
import sys
import os
import re

OUTPUT_DIR = "/workspace/projects/public/book-content"

def clean_text(raw_text):
    """清理从web_fetch获取的文本"""
    # 移除导航行
    lines = raw_text.split('\n')
    cleaned = []
    skip_patterns = [
        r'^\s*目录\s*$',
        r'^\s*◀上一卷\s*$',
        r'^\s*下一卷▶\s*$',
        r'^\s*◄上一卷\s*$',
        r'^\s*下一卷►\s*$',
        r'^\s*上一卷\s*$',
        r'^\s*下一卷\s*$',
        r'^\s*全书始\s*$',
        r'^\s*全书终\s*$',
        r'^\s*↑返回顶部\s*$',
        r'^\s*\|\s*$',  # 空表格行
        r'^\s*中华文库\s*$',
        r'^\[.*\]\(http.*\)$',  # 链接行
    ]
    
    for line in lines:
        skip = False
        for pat in skip_patterns:
            if re.match(pat, line.strip()):
                skip = True
                break
        if not skip:
            cleaned.append(line)
    
    text = '\n'.join(cleaned)
    
    # 移除markdown链接
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    # 移除图片
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    
    # 移除表格分隔符
    text = re.sub(r'\|---\|.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\|\s*$', '', text, flags=re.MULTILINE)
    
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python save_book.py <book_name> [volume_name]")
        sys.exit(1)
    
    book_name = sys.argv[1]
    volume_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Read from stdin
    raw = sys.stdin.read()
    cleaned = clean_text(raw)
    
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    
    if volume_name:
        # Append volume to existing file
        mode = 'a' if os.path.exists(output_path) else 'w'
        with open(output_path, mode, encoding='utf-8') as f:
            if mode == 'a':
                f.write(f"\n\n【{volume_name}】\n\n")
            else:
                f.write(f"{book_name}\n\n")
                f.write(f"【{volume_name}】\n\n")
            f.write(cleaned)
    else:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"{book_name}\n\n")
            f.write(cleaned)
    
    with open(output_path, 'r', encoding='utf-8') as f:
        size = len(f.read())
    
    print(f"Saved: {output_path} ({size} chars)")
