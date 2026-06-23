#!/usr/bin/env python3
"""Batch fetch books from zhonghuashu.com via web_fetch tool output.
Since we can't call web_fetch from Python, this script processes already-fetched content.
Usage: python3 scripts/fetch_zhonghuashu_books.py public/book-content
"""
import os, re, sys

def clean_zhonghuashu_content(text, title):
    """Clean zhonghuashu wiki content"""
    # Remove markdown links
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove image references
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    # Remove section numbers like "1.1.1"
    text = re.sub(r'^\d+\.\d*(\.\d+)*\s*', '', text, flags=re.MULTILINE)
    # Remove "中华文库" 
    text = text.replace('中华文库', '')
    # Remove the title header if repeated
    text = re.sub(r'^#\s+' + re.escape(title) + r'\s*$', '', text, flags=re.MULTILINE)
    # Clean up multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text

def save_book(content, title, output_dir):
    """Save a book to a txt file"""
    filepath = os.path.join(output_dir, f"{title}.txt")
    # Check if existing file is larger
    if os.path.exists(filepath):
        existing_size = os.path.getsize(filepath)
        new_size = len(content.encode('utf-8'))
        if existing_size > new_size * 0.8:  # existing is at least 80% as large
            print(f"  Skip {title}: existing ({existing_size} bytes) >= new ({new_size} bytes)")
            return False
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"{title}\n\n")
        f.write(content)
    
    size = len(content.encode('utf-8'))
    chars = len(content)
    print(f"  Saved {title}: {size} bytes, {chars} chars")
    return True

if __name__ == '__main__':
    output_dir = sys.argv[1] if len(sys.argv) > 1 else 'public/book-content'
    os.makedirs(output_dir, exist_ok=True)
    print("This script is a helper for cleaning zhonghuashu content.")
    print("Use web_fetch to get content, then pipe through this script.")
