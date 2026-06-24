#!/usr/bin/env python3
"""
Multi-source book crawler for 玄机阁 knowledge base
Sources: Archive.org, Gutenberg, and direct URLs
"""

import asyncio
import aiohttp
import json
import os
import re
import time
import logging
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.FileHandler('/tmp/multi_crawler.log'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

OUTPUT_DIR = '/workspace/projects/public/book-content'
MAX_CONCURRENT = 50
TIMEOUT = aiohttp.ClientTimeout(total=15)
MAX_BOOKS = 15000  # Target total books

class MultiSourceCrawler:
    def __init__(self):
        self.session = None
        self.downloaded = 0
        self.skipped = 0
        self.failed = 0
        self.existing_files = set()
        self._load_existing()
    
    def _load_existing(self):
        """Load existing book filenames to skip duplicates."""
        for f in os.listdir(OUTPUT_DIR):
            if f.endswith('.txt'):
                self.existing_files.add(f.lower())
        log.info(f"Found {len(self.existing_files)} existing books")
    
    def _safe_filename(self, title):
        """Create safe filename from title."""
        title = re.sub(r'[\\/:*?"<>|]', '', title)
        title = re.sub(r'\s+', ' ', title).strip()
        if len(title) > 80:
            title = title[:80]
        return f"{title}.txt"
    
    def _is_duplicate(self, filename):
        """Check if file already exists."""
        return filename.lower() in self.existing_files
    
    async def _save_book(self, title, content, source="archive"):
        """Save a book to the output directory."""
        if not content or len(content.strip()) < 200:
            return False
        
        filename = self._safe_filename(title)
        if self._is_duplicate(filename):
            self.skipped += 1
            return False
        
        filepath = os.path.join(OUTPUT_DIR, filename)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            self.existing_files.add(filename.lower())
            self.downloaded += 1
            if self.downloaded % 100 == 0:
                log.info(f"Progress: {self.downloaded} downloaded, {self.skipped} skipped, {self.failed} failed")
            return True
        except Exception as e:
            log.error(f"Save error: {e}")
            self.failed += 1
            return False
    
    # === Source 1: Archive.org ===
    async def _search_archive(self, session, query, rows=200):
        """Search Archive.org for books."""
        url = "https://archive.org/advancedsearch.php"
        params = {
            'q': query,
            'fl[]': ['identifier', 'title', 'language'],
            'output': 'json',
            'rows': rows,
        }
        try:
            async with session.get(url, params=params) as resp:
                data = await resp.json()
                docs = data.get('response', {}).get('docs', [])
                return docs
        except Exception as e:
            log.error(f"Archive search error for '{query}': {e}")
            return []
    
    async def _download_archive_book(self, session, identifier, title):
        """Download a single book from Archive.org."""
        try:
            # Try plain text first
            txt_url = f"https://archive.org/download/{identifier}/{identifier}_text.txt"
            djvu_url = f"https://archive.org/download/{identifier}/{identifier}_djvu.txt"
            
            content = None
            for url in [txt_url, djvu_url]:
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                        if resp.status == 200:
                            text = await resp.text()
                            if len(text) > 200:
                                content = text
                                break
                except:
                    continue
            
            if content:
                # Add metadata header
                header = f"【来源：Archive.org | ID: {identifier}】\n\n"
                await self._save_book(title, header + content, "archive")
                return True
            return False
        except Exception as e:
            self.failed += 1
            return False
    
    async def crawl_archive(self):
        """Crawl Archive.org for relevant books."""
        log.info("=== Starting Archive.org crawl ===")
        
        queries = [
            # Chinese metaphysics
            'language:chi AND mediatype:texts AND (易经 OR 周易 OR 风水 OR 八字 OR 命理)',
            'language:chi AND mediatype:texts AND (术数 OR 占卜 OR 堪舆 OR 相术 OR 六爻)',
            'language:chi AND mediatype:texts AND (奇门遁甲 OR 紫微斗数 OR 梅花易数)',
            'language:chi AND mediatype:texts AND (黄帝内经 OR 本草纲目 OR 伤寒论)',
            'language:chi AND mediatype:texts AND (道德经 OR 庄子 OR 老子)',
            'language:chi AND mediatype:texts AND (孙子兵法 OR 三十六计 OR 六韬)',
            'language:chi AND mediatype:texts AND subject:"Chinese literature"',
            'language:chi AND mediatype:texts',
            # Western esoteric
            'mediatype:texts AND subject:"Occultism"',
            'mediatype:texts AND subject:"Astrology"',
            'mediatype:texts AND subject:"Divination"',
            'mediatype:texts AND subject:"Alchemy"',
            'mediatype:texts AND subject:"Kabbalah"',
            'mediatype:texts AND subject:"Hermeticism"',
            'mediatype:texts AND subject:"Tarot"',
            'mediatype:texts AND subject:"Numerology"',
            'mediatype:texts AND subject:"Magic"',
            'mediatype:texts AND subject:"Theosophy"',
            'mediatype:texts AND subject:"Mysticism"',
            'mediatype:texts AND subject:"Prophecies"',
            'mediatype:texts AND subject:"I Ching"',
            'mediatype:texts AND subject:"Taoism"',
            'mediatype:texts AND subject:"Confucianism"',
            'mediatype:texts AND subject:"Chinese philosophy"',
            'mediatype:texts AND subject:"Buddhism"',
            'mediatype:texts AND subject:"Meditation"',
            'mediatype:texts AND subject:"Yoga"',
            'mediatype:texts AND subject:"Palmistry"',
            'mediatype:texts AND subject:"Physiognomy"',
            'mediatype:texts AND subject:"Feng shui"',
        ]
        
        connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT, ttl_dns_cache=300)
        async with aiohttp.ClientSession(connector=connector, timeout=TIMEOUT) as session:
            all_identifiers = {}  # id -> title
            
            for query in queries:
                docs = await self._search_archive(session, query, rows=200)
                for doc in docs:
                    ident = doc.get('identifier', '')
                    title = doc.get('title', '')
                    if ident and ident not in all_identifiers:
                        all_identifiers[ident] = title
                log.info(f"Archive query '{query[:50]}': found {len(docs)}, total: {len(all_identifiers)}")
                await asyncio.sleep(0.3)
            
            log.info(f"Total Archive.org books to download: {len(all_identifiers)}")
            
            # Download in batches
            sem = asyncio.Semaphore(MAX_CONCURRENT)
            
            async def _dl(ident, title):
                async with sem:
                    return await self._download_archive_book(session, ident, title)
            
            tasks = [_dl(ident, title) for ident, title in all_identifiers.items()]
            
            # Process in chunks of 500
            chunk_size = 500
            for i in range(0, len(tasks), chunk_size):
                chunk = tasks[i:i+chunk_size]
                results = await asyncio.gather(*chunk, return_exceptions=True)
                success = sum(1 for r in results if r is True)
                log.info(f"Archive batch {i//chunk_size + 1}: {success}/{len(chunk)} succeeded")
    
    # === Source 2: Gutenberg ===
    async def crawl_gutenberg(self):
        """Crawl Project Gutenberg for relevant books."""
        log.info("=== Starting Gutenberg crawl ===")
        
        connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT, ttl_dns_cache=300)
        async with aiohttp.ClientSession(connector=connector, timeout=TIMEOUT) as session:
            # Use the Gutendex API
            topics = [
                'chinese', 'philosophy', 'occult', 'astrology', 'divination',
                'alchemy', 'taoism', 'confucianism', 'mysticism', 'kabbalah',
                'tarot', 'hermeticism', 'theosophy', 'esoteric', 'magic',
                'numerology', 'geomancy', 'prophecy', 'oracle', 'feng shui',
                'yi jing', 'i ching', 'buddhism', 'meditation', 'yoga',
                'palmistry', 'physiognomy', 'fate', 'fortune telling',
                'horoscope', 'zodiac', 'runes', 'scrying', 'necromancy',
            ]
            
            all_books = {}  # id -> title
            
            for topic in topics:
                try:
                    url = f"https://gutendex.com/books?topic={topic}"
                    async with session.get(url) as resp:
                        data = await resp.json()
                        count = data.get('count', 0)
                        results = data.get('results', [])
                        
                        for book in results:
                            bid = str(book['id'])
                            title = book.get('title', 'Unknown')
                            if bid not in all_books:
                                all_books[bid] = title
                        
                        # Get more pages if available
                        next_url = data.get('next')
                        page = 1
                        while next_url and page < 5:
                            try:
                                async with session.get(next_url) as resp2:
                                    data2 = await resp2.json()
                                    for book in data2.get('results', []):
                                        bid = str(book['id'])
                                        title = book.get('title', 'Unknown')
                                        if bid not in all_books:
                                            all_books[bid] = title
                                    next_url = data2.get('next')
                                    page += 1
                            except:
                                break
                        
                        log.info(f"Gutenberg topic '{topic}': {count} total, cumulative: {len(all_books)}")
                except Exception as e:
                    log.error(f"Gutenberg error for '{topic}': {e}")
                
                await asyncio.sleep(0.2)
            
            log.info(f"Total Gutenberg books to download: {len(all_books)}")
            
            # Download Gutenberg books
            sem = asyncio.Semaphore(MAX_CONCURRENT)
            
            async def _dl_gutenberg(bid, title):
                async with sem:
                    try:
                        # Try UTF-8 text first
                        txt_url = f"https://www.gutenberg.org/files/{bid}/{bid}-0.txt"
                        alt_url = f"https://www.gutenberg.org/files/{bid}/{bid}.txt"
                        
                        content = None
                        for url in [txt_url, alt_url]:
                            try:
                                async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                                    if resp.status == 200:
                                        text = await resp.text()
                                        if len(text) > 200:
                                            content = text
                                            break
                            except:
                                continue
                        
                        if not content:
                            # Try cache
                            cache_url = f"https://www.gutenberg.org/cache/epub/{bid}/pg{bid}.txt"
                            try:
                                async with session.get(cache_url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                                    if resp.status == 200:
                                        text = await resp.text()
                                        if len(text) > 200:
                                            content = text
                            except:
                                pass
                        
                        if content:
                            # Remove Gutenberg header/footer
                            content = re.sub(r'^\*\*\* START OF THIS PROJECT GUTENBERG.*?\*\*\*\n', '', content, flags=re.DOTALL)
                            content = re.sub(r'\n\*\*\* END OF THIS PROJECT GUTENBERG.*$', '', content, flags=re.DOTALL)
                            
                            header = f"【来源：Project Gutenberg | ID: {bid}】\n\n"
                            return await self._save_book(title, header + content, "gutenberg")
                        return False
                    except:
                        self.failed += 1
                        return False
            
            tasks = [_dl_gutenberg(bid, title) for bid, title in all_books.items()]
            
            chunk_size = 500
            for i in range(0, len(tasks), chunk_size):
                chunk = tasks[i:i+chunk_size]
                results = await asyncio.gather(*chunk, return_exceptions=True)
                success = sum(1 for r in results if r is True)
                log.info(f"Gutenberg batch {i//chunk_size + 1}: {success}/{len(chunk)} succeeded")
    
    # === Source 3: Wikisource (Chinese) ===
    async def crawl_wikisource(self):
        """Crawl Chinese Wikisource for ancient texts."""
        log.info("=== Starting Wikisource crawl ===")
        
        connector = aiohttp.TCPConnector(limit=20, ttl_dns_cache=300)
        async with aiohttp.ClientSession(connector=connector, timeout=aiohttp.ClientTimeout(total=20)) as session:
            # List of important categories on Chinese Wikisource
            categories = [
                'Category:易学',
                'Category:道家',
                'Category:术数',
                'Category:医学',
                'Category:兵家',
                'Category:儒家',
                'Category:佛家',
                'Category:農家',
                'Category:法家',
                'Category:墨家',
                'Category:名家',
                'Category:阴阳家',
                'Category:经部',
                'Category:史部',
                'Category:子部',
                'Category:集部',
            ]
            
            all_titles = {}  # title -> url
            
            for cat in categories:
                try:
                    url = f"https://zh.wikisource.org/wiki/{cat}"
                    async with session.get(url) as resp:
                        if resp.status != 200:
                            continue
                        html = await resp.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Find links to works in category
                        for link in soup.select('#mw-pages a, .mw-category a'):
                            href = link.get('href', '')
                            text = link.get_text().strip()
                            if href and text and '/wiki/' in href and 'Category:' not in href:
                                all_titles[text] = f"https://zh.wikisource.org{href}"
                        
                        log.info(f"Wikisource cat '{cat}': {len(all_titles)} total titles")
                except Exception as e:
                    log.error(f"Wikisource cat error: {e}")
                await asyncio.sleep(0.5)
            
            log.info(f"Total Wikisource pages to fetch: {len(all_titles)}")
            
            # Fetch content
            sem = asyncio.Semaphore(20)
            
            async def _fetch_ws(title, url):
                async with sem:
                    try:
                        async with session.get(url) as resp:
                            if resp.status != 200:
                                return False
                            html = await resp.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # Extract main content
                            content_div = soup.find('div', class_='mw-parser-output')
                            if not content_div:
                                return False
                            
                            # Remove non-content elements
                            for tag in content_div.find_all(['sup', 'span', 'div', 'table', 'style', 'script']):
                                if tag.get('class') and any(c in ' '.join(tag.get('class', [])) for c in ['catlinks', 'printfooter', 'noprint']):
                                    tag.decompose()
                            
                            text = content_div.get_text(separator='\n', strip=True)
                            if len(text) < 200:
                                return False
                            
                            header = f"【来源：Wikisource | URL: {url}】\n\n"
                            return await self._save_book(title, header + text, "wikisource")
                    except:
                        self.failed += 1
                        return False
            
            tasks = [_fetch_ws(title, url) for title, url in all_titles.items()]
            
            chunk_size = 100
            for i in range(0, len(tasks), chunk_size):
                chunk = tasks[i:i+chunk_size]
                results = await asyncio.gather(*chunk, return_exceptions=True)
                success = sum(1 for r in results if r is True)
                log.info(f"Wikisource batch {i//chunk_size + 1}: {success}/{len(chunk)}")
    
    async def run(self):
        """Run all crawlers sequentially."""
        start = time.time()
        
        # Run each source
        await self.crawl_archive()
        await self.crawl_gutenberg()
        await self.crawl_wikisource()
        
        elapsed = time.time() - start
        log.info(f"\n{'='*50}")
        log.info(f"CRAWL COMPLETE in {elapsed:.0f}s")
        log.info(f"  Downloaded: {self.downloaded}")
        log.info(f"  Skipped (dup): {self.skipped}")
        log.info(f"  Failed: {self.failed}")
        log.info(f"  Total books: {len(self.existing_files)}")


async def main():
    crawler = MultiSourceCrawler()
    await crawler.run()

if __name__ == '__main__':
    asyncio.run(main())
