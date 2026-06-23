#!/usr/bin/env python3
"""
Crawl 增删卜易 from shidianguji.com using web_fetch-like approach.
Since direct HTTP requests don't work well (JS-rendered), we'll use
the content we already know how to get via the web_fetch tool pattern.
This script processes the pre-fetched content and saves it.
"""
import os
import sys
import re
import time

OUTPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "public/book-content"

# All chapter URLs for 增删卜易
CHAPTERS = [
    ("序", "1lfn5zr93jw27"),
    ("自序", "1lfn5zr93k8pb"),
    ("增删卜易总目", "1lfn5zr93klcf"),
    ("增删卜易卷之一", "1laba3s8ovar2"),
    ("增删卜易卷之二", "1laba3uso1vza"),
    ("卷三", "1laba3x9svcby"),
    ("增删卜易卷四", "1laba40qqjnka"),
    ("增删卜易卷五", "1laba43ti5hye"),
    ("卷六", "1laba46qlsgm3"),
    ("增删卜易卷七", "1laba495sv2ur"),
    ("增删卜易卷八", "1laba4acxp6vu"),
    ("增删卜易卷九", "1laba4brkmdyr"),
    ("增删卜易卷十", "1laba4dqh16h6"),
    ("增删卜易卷十一", "1laba4fl56z2y"),
    ("增删卜易卷十二", "1laba4hurr0uy"),
]

def clean_chapter_content(text):
    """Clean chapter content from web_fetch output"""
    # Remove markdown links
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove image references
    content = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', content)
    content = re.sub(r'<img[^>]*/?>', '', content)
    # Remove URL/Token lines
    content = re.sub(r'^URL:.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Token:.*$', '', content, flags=re.MULTILINE)
    # Remove horizontal rules
    content = re.sub(r'^---+$', '', content, flags=re.MULTILINE)
    # Remove [Next] navigation links  
    content = re.sub(r'Next', '', content)
    # Clean up navigation text at the bottom
    content = re.sub(r'序\s*序\s*自序\s*自序.*$', '', content, flags=re.DOTALL)
    # Clean up whitespace
    lines = [line.strip() for line in content.split('\n')]
    content = '\n'.join(lines)
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content.strip()

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Check if already exists
    output_path = os.path.join(OUTPUT_DIR, "增删卜易.txt")
    if os.path.exists(output_path):
        print("增删卜易.txt already exists, skipping")
        return
    
    print("This script is a helper - the actual fetching needs to be done via web_fetch tool")
    print("Use the following URLs to fetch each chapter:")
    for title, chapter_id in CHAPTERS:
        url = f"https://www.shidianguji.com/book/XYXZSBY/chapter/{chapter_id}"
        print(f"  {title}: {url}")
    
    print(f"\nTotal: {len(CHAPTERS)} chapters to fetch")

if __name__ == "__main__":
    main()
