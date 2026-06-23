#!/usr/bin/env python3
"""下载星平会海全文 from shidianguji.com 并写入 public/book-content/星平会海.txt"""

import urllib.request
import json
import re
import os
import time

BASE_URL = 'https://www.shidianguji.com/book/CADAL02055515/chapter/'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

# Chapter IDs and names from the book's table of contents
CHAPTERS = [
    ('1lahjrsphbaps', '卷首'),
    ('1lahjrsphuyo0', '目录'),
    ('1lahk3gxylqm8', '卷之首'),
    ('1lahk3mxmq70v', '卷一'),
    ('1lahk3ro1rtpf', '卷二'),
    ('1lahk3yhjbzn8', '卷三'),
    ('1lahk43a43pj4', '卷四'),
    ('1lahk47jf57he', '卷五'),
    ('1lahk4c8h2d6c', '卷六'),
    ('1lahk4guo4tts', '卷七'),
    ('1lahk4m448ug8', '卷八'),
    ('1lahk4ta7v31k', '卷九'),
    ('1lahk4zphwt1c', '卷十'),
]

def download_chapter(chapter_id, chapter_name):
    """Download and extract text from a chapter page."""
    url = BASE_URL + chapter_id
    print(f"  Downloading {chapter_name} ({chapter_id})...")
    
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        content = resp.read().decode('utf-8')
    
    # Extract _ROUTER_DATA JSON
    match = re.search(r'window\._ROUTER_DATA\s*=\s*(\{)', content)
    if not match:
        print(f"  WARNING: No _ROUTER_DATA found for {chapter_name}")
        return []
    
    start = match.start() + len('window._ROUTER_DATA = ')
    decoder = json.JSONDecoder()
    data, end = decoder.raw_decode(content[start:])
    
    # Navigate to paragraphList
    loader_data = data.get('loaderData', {})
    book_data_key = None
    for key in loader_data:
        if 'book' in key:
            book_data_key = key
            break
    
    if not book_data_key:
        print(f"  WARNING: No book data key found for {chapter_name}")
        return []
    
    book_data = loader_data[book_data_key]
    paragraph_list = book_data.get('paragraphList', [])
    print(f"  Found {len(paragraph_list)} paragraphs")
    
    # Extract text from paragraphs
    texts = []
    for para in paragraph_list:
        if para.get('paragraphType') != 1:
            continue
        
        content_str = para.get('content', '')
        if not content_str:
            continue
        
        try:
            content_data = json.loads(content_str)
            lines = content_data.get('lines', [])
            for line in lines:
                line_type = line.get('lineType', 0)
                line_content = line.get('content', '').strip()
                
                if line_type == 1 and line_content:  # Text line
                    texts.append(line_content)
                elif line_type == 3:  # Image/page - mark it
                    texts.append('[图]')
        except json.JSONDecodeError:
            pass
    
    return texts

def main():
    all_text = []
    
    print("=" * 60)
    print("下载星平会海全文 from shidianguji.com")
    print("=" * 60)
    
    for chapter_id, chapter_name in CHAPTERS:
        texts = download_chapter(chapter_id, chapter_name)
        
        if texts:
            all_text.append(f"\n{'=' * 40}")
            all_text.append(f"增补星平会海命学全书 {chapter_name}")
            all_text.append(f"{'=' * 40}\n")
            all_text.extend(texts)
            print(f"  Extracted {len(texts)} text lines")
        else:
            print(f"  No text extracted for {chapter_name}")
        
        time.sleep(1)  # Be polite
    
    # Write the full text
    output_path = os.path.join(os.environ.get('COZE_WORKSPACE_PATH', '/workspace/projects'),
                                'public', 'book-content', '星平会海.txt')
    
    full_text = '\n'.join(all_text)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"\nDone! Written {len(full_text)} chars ({len(all_text)} lines) to {output_path}")
    
    # Verify
    with open(output_path, 'r', encoding='utf-8') as f:
        verify = f.read()
    print(f"Verification: {len(verify)} chars, {verify.count(chr(10))} newlines")

if __name__ == '__main__':
    main()
