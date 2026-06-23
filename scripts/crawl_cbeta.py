#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CBETA 佛经爬虫 - 从 cbetaonline.dila.edu.tw 爬取佛经全文
"""

import argparse
import json
import os
import re
import sys
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("请安装 requests: pip install requests")
    exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("请安装 beautifulsoup4: pip install beautifulsoup4")
    exit(1)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
}

progress_lock = Lock()

# CBETA 经典编号映射 (经名 -> CBETA编号)
SUTRA_MAP = {
    '金刚经': 'T0235',
    '金刚般若波罗蜜经': 'T0235',
    '心经': 'T0251',
    '般若波罗蜜多心经': 'T0251',
    '楞严经': 'T0945',
    '大佛顶如来密因修证了义诸菩萨万行首楞严经': 'T0945',
    '法华经': 'T0262',
    '妙法莲华经': 'T0262',
    '华严经': 'T0278',
    '大方广佛华严经': 'T0278',
    '地藏菩萨本愿经': 'T0412',
    '阿弥陀经': 'T0366',
    '佛说阿弥陀经': 'T0366',
    '无量寿经': 'T0360',
    '佛说无量寿经': 'T0360',
    '药师经': 'T0450',
    '药师琉璃光如来本愿功德经': 'T0450',
    '六祖坛经': 'T2008',
    '六祖大师法宝坛经': 'T2008',
    '维摩诘经': 'T0475',
    '维摩诘所说经': 'T0475',
    '圆觉经': 'T0842',
    '大方广圆觉修多罗了义经': 'T0842',
    '四十二章经': 'T0784',
    '佛说四十二章经': 'T0784',
    '八大人觉经': 'T0779',
    '佛说八大人觉经': 'T0779',
    '佛遗教经': 'T0789',
    '佛垂般涅槃略说教诫经': 'T0789',
    '长阿含经': 'T0001',
    '中阿含经': 'T0026',
    '杂阿含经': 'T0099',
    '增一阿含经': 'T0125',
    '大般若经': 'T0220',
    '大般若波罗蜜多经': 'T0220',
    '大智度论': 'T1509',
    '中论': 'T1564',
    '十二门论': 'T1568',
    '百论': 'T1569',
    '俱舍论': 'T1558',
    '阿毗达磨俱舍论': 'T1558',
    '成唯识论': 'T1580',
    '唯识三十论': 'T1586',
    '瑜伽师地论': 'T1579',
    '摄大乘论': 'T1593',
    '大乘起信论': 'T1667',
    '梵网经': 'T1484',
    '梵网经卢舍那佛说菩萨心地戒品第十': 'T1484',
    '优婆塞戒经': 'T1488',
    '四分律': 'T1428',
    '十诵律': 'T1435',
    '大宝积经': 'T0310',
    '金光明经': 'T0663',
    '解深密经': 'T0676',
    '占察善恶业报经': 'T0839',
    '楞伽经': 'T0671',
    '入楞伽经': 'T0671',
    '大集经': 'T0397',
    '僧伽吒经': 'T0423',
    '盂兰盆经': 'T0685',
    '佛说盂兰盆经': 'T0685',
    '观世音菩萨普门品': 'T0262',  # part of 法华经
    '普贤菩萨行愿品': 'T0293',
    '地藏经': 'T0412',
    '观无量寿佛经': 'T0365',
    '佛说观无量寿佛经': 'T0365',
}

# 道教经典 - 使用 zh.wikisource.org
DAOIST_MAP = {
    '道德真经': '老子',
    '道德经': '老子',
    '南华真经': '庄子',
    '冲虚真经': '列子',
    '文始真经': '关尹子',
    '洞灵真经': '亢仓子',
    '通玄真经': '文子',
    '太上感应篇': '太上感应篇',
    '文昌帝君阴骘文': '文昌帝君阴骘文',
    '清静经': '太上老君说常清静经',
    '黄庭经': '黄庭经',
    '悟真篇': '悟真篇',
    '参同契': '周易参同契',
    '抱朴子': '抱朴子',
    '真诰': '真诰',
    '灵宝经': '灵宝无量度人上品妙经',
}


def create_session():
    session = requests.Session()
    adapter = HTTPAdapter(
        pool_connections=10,
        pool_maxsize=10,
        max_retries=Retry(total=2, backoff_factor=0.1)
    )
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    session.headers.update(HEADERS)
    return session


def fetch_cbeta_sutra(session, sutra_id, max_juans=100):
    """从CBETA爬取一部经的全部卷"""
    base_url = f'https://cbetaonline.dila.edu.tw/zh/{sutra_id}'
    all_text = []
    
    # First get the main page to determine the number of juans
    try:
        time.sleep(random.uniform(0.3, 0.8))
        resp = session.get(base_url, timeout=15)
        resp.encoding = 'utf-8'
        if resp.status_code != 200:
            print(f"  [WARN] {sutra_id}: HTTP {resp.status_code}")
            return None
        
        soup = BeautifulSoup(resp.text, 'lxml')
        
        # Try to find max juan number from pagination
        juan_links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if f'/{sutra_id}_' in href or f'{sutra_id}#' in href:
                text = a.get_text(strip=True)
                if text and text.isdigit():
                    juan_links.append(int(text))
        
        max_juan = max(juan_links) if juan_links else 1
        max_juan = min(max_juan, max_juans)
        
        # Also extract text from main page
        content_div = soup.find('div', id='body_text') or soup.find('div', class_='body-text')
        if content_div:
            text = content_div.get_text(separator='\n', strip=True)
            # Clean up line numbers like [1], [2], etc.
            text = re.sub(r'\[\d+\]', '', text)
            text = re.sub(r'\n{3,}', '\n\n', text)
            if text:
                all_text.append(f"卷1\n{text}")
        
    except Exception as e:
        print(f"  [ERROR] {sutra_id} main page: {e}")
        return None
    
    # Get remaining juans
    for juan in range(2, max_juan + 1):
        try:
            juan_url = f'https://cbetaonline.dila.edu.tw/zh/{sutra_id}_{juan:03d}'
            time.sleep(random.uniform(0.2, 0.6))
            resp = session.get(juan_url, timeout=15)
            resp.encoding = 'utf-8'
            
            if resp.status_code != 200:
                break
            
            soup = BeautifulSoup(resp.text, 'lxml')
            content_div = soup.find('div', id='body_text') or soup.find('div', class_='body-text')
            
            if content_div:
                text = content_div.get_text(separator='\n', strip=True)
                text = re.sub(r'\[\d+\]', '', text)
                text = re.sub(r'\n{3,}', '\n\n', text)
                if text:
                    all_text.append(f"卷{juan}\n{text}")
                    print(f"    {sutra_id} 卷{juan}/{max_juan}")
            else:
                break
                
        except Exception as e:
            print(f"  [ERROR] {sutra_id} 卷{juan}: {e}")
            continue
    
    if all_text:
        full_text = '\n\n'.join(all_text)
        print(f"  [OK] {sutra_id}: {len(full_text):,} chars, {max_juan} juans")
        return full_text
    return None


def fetch_wikisource(session, book_name, max_chapters=200):
    """从中文维基文库爬取书籍"""
    from urllib.parse import quote
    search_url = f'https://zh.wikisource.org/wiki/{quote(book_name)}'
    
    try:
        time.sleep(random.uniform(0.5, 1.0))
        resp = session.get(search_url, timeout=15)
        resp.encoding = 'utf-8'
        
        if resp.status_code != 200:
            return None
        
        soup = BeautifulSoup(resp.text, 'lxml')
        content = soup.find('div', class_='mw-parser-output')
        
        if not content:
            return None
        
        # Check if this is a multi-chapter work (has subpage links)
        chapter_links = []
        for a in content.find_all('a', href=True):
            href = a['href']
            title = a.get_text(strip=True)
            if href.startswith('/wiki/') and title and len(title) > 1:
                if book_name in href or any(c in title for c in ['卷', '第', '篇', '章']):
                    full_url = f'https://zh.wikisource.org{href}'
                    if full_url not in [cl[1] for cl in chapter_links]:
                        chapter_links.append((title, full_url))
        
        chapter_links = chapter_links[:max_chapters]
        
        if chapter_links:
            # Multi-chapter work
            all_text = []
            for ch_title, ch_url in chapter_links:
                try:
                    time.sleep(random.uniform(0.3, 0.8))
                    ch_resp = session.get(ch_url, timeout=15)
                    ch_resp.encoding = 'utf-8'
                    ch_soup = BeautifulSoup(ch_resp.text, 'lxml')
                    ch_content = ch_soup.find('div', class_='mw-parser-output')
                    if ch_content:
                        # Remove navigation boxes
                        for nav in ch_content.find_all(['table', 'div'], class_=re.compile(r'toc|navbox|catlinks')):
                            nav.decompose()
                        text = ch_content.get_text(separator='\n', strip=True)
                        text = re.sub(r'\n{3,}', '\n\n', text)
                        if text and len(text) > 20:
                            all_text.append(f"\n{ch_title}\n{text}")
                            print(f"    {book_name}: {ch_title} ({len(text)} chars)")
                except:
                    continue
            
            if all_text:
                return '\n'.join(all_text)
        else:
            # Single page work
            for nav in content.find_all(['table', 'div'], class_=re.compile(r'toc|navbox|catlinks')):
                nav.decompose()
            text = content.get_text(separator='\n', strip=True)
            text = re.sub(r'\n{3,}', '\n\n', text)
            if text and len(text) > 50:
                return text
    
    except Exception as e:
        print(f"  [ERROR] wikisource {book_name}: {e}")
    
    return None


def main():
    parser = argparse.ArgumentParser(description='CBETA佛经 + 维基文库 道教经典爬虫')
    parser.add_argument('--output', type=str, default='public/book-content', help='输出目录')
    parser.add_argument('--parallel', type=int, default=3, help='并发数')
    parser.add_argument('--source', type=str, choices=['cbeta', 'wikisource', 'all'], default='all', help='数据源')
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    session = create_session()
    
    completed = 0
    failed = []
    
    # CBETA 佛经
    if args.source in ['cbeta', 'all']:
        print(f"\n=== 爬取CBETA佛经 ({len(SUTRA_MAP)}部) ===")
        for name, sutra_id in SUTRA_MAP.items():
            # Check if already exists
            safe_name = re.sub(r'[^\w\s-]', '', name)[:50]
            out_file = os.path.join(args.output, f"{safe_name}.txt")
            if os.path.exists(out_file):
                print(f"  [SKIP] {name} (already exists)")
                completed += 1
                continue
            
            print(f"  爬取: {name} ({sutra_id})")
            text = fetch_cbeta_sutra(session, sutra_id)
            if text:
                with open(out_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                completed += 1
                print(f"  [SAVED] {name}: {len(text):,} chars")
            else:
                failed.append(f"{name} ({sutra_id})")
    
    # Wikisource 道教经典
    if args.source in ['wikisource', 'all']:
        print(f"\n=== 爬取维基文库道教经典 ({len(DAOIST_MAP)}部) ===")
        for name, ws_name in DAOIST_MAP.items():
            safe_name = re.sub(r'[^\w\s-]', '', name)[:50]
            out_file = os.path.join(args.output, f"{safe_name}.txt")
            if os.path.exists(out_file):
                print(f"  [SKIP] {name} (already exists)")
                completed += 1
                continue
            
            print(f"  爬取: {name} (wikisource: {ws_name})")
            text = fetch_wikisource(session, ws_name)
            if text:
                with open(out_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                completed += 1
                print(f"  [SAVED] {name}: {len(text):,} chars")
            else:
                failed.append(f"{name} (wikisource: {ws_name})")
    
    print(f"\n=== 完成 ===")
    print(f"成功: {completed}")
    print(f"失败: {len(failed)}")
    if failed:
        print("失败列表:")
        for f in failed:
            print(f"  {f}")


if __name__ == '__main__':
    main()
