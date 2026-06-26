#!/usr/bin/env python3
"""
墨渊阅读 - 书籍爬虫脚本库
根据书名自动搜索并爬取完整章节内容
支持多个数据源：QQ阅读、顶点小说、鬼大爷、25zw、飞碟小说等
"""

import requests, json, os, sys, re, time
from urllib.parse import quote
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
OUTPUT_DIR = 'public/books-data'


# ============== 工具函数 ==============

def clean_text(element):
    """清理提取的文本：去除导航、广告等无关内容"""
    if not element: return None
    lines = []
    for line in element.get_text('\n', strip=False).split('\n'):
        l = line.strip()
        if not l: continue
        # 过滤广告/导航行
        skip = ['上一页', '下一页', '首页', '目录', '广告', '推荐', '下载',
                '手机用户', '收藏', '加入书架', '投票', '微信', 'QQ',
                '\u00a9', 'copyright', '侵权', '本站', 'TXT']
        if any(k in l for k in skip) and len(l) < 30: continue
        if len(l) > 3: lines.append(l)
    return '\n\n'.join(lines) if lines else None


def fetch_url(url, timeout=15):
    """带重试的HTTP请求"""
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            r.encoding = 'utf-8'
            return r.text
        except Exception as e:
            if attempt == 2: return None
            time.sleep(2)
    return None


def fetch_content(url, containers=None):
    """通用内容提取"""
    html = fetch_url(url)
    if not html: return None
    s = BeautifulSoup(html, 'lxml')

    check_list = containers or []
    # 默认查找列表
    for cls_name in ['chapter-content', 'read-content', 'content', 'container',
                      'page-content', 'txt', 'showtxt', 'text', 'nr', 'nr1',
                      'main-content', 'article-content', 'wrapper', 'book-content']:
        check_list.append({'class': cls_name})
    for id_name in ['content', 'chaptercontent', 'nr', 'nr1', 'txtContent', 'htmlContent']:
        check_list.append({'id': id_name})

    for c in check_list:
        d = None
        if 'class' in c:
            d = s.find(['div', 'article'], class_=c['class'])
            if not d and 'container' in c.get('class', ''):
                d = s.find('div', class_=lambda x: x and all(cls in (x.split() if isinstance(x, str) else []) for cls in c['class'].split()))
        elif 'id' in c:
            d = s.find(id=c['id'])
        if d:
            t = clean_text(d)
            if t and len(t) > 200: return t

    # 最后兜底：找大量文本的块
    for tag in ['div', 'article', 'section']:
        for el in s.find_all(tag):
            t = el.get_text(strip=False)
            if len(t) > 1500:
                t2 = clean_text(el)
                if t2 and len(t2) > 200: return t2
    return None


# ============== QQ阅读 ==============

def search_qq_read(book_name):
    """搜索QQ阅读，返回 [{title, author, book_id}]"""
    url = f'https://book.qq.com/search?keyword={quote(book_name)}'
    html = fetch_url(url)
    if not html: return []
    s = BeautifulSoup(html, 'lxml')
    results = []
    for a in s.find_all('a', href=re.compile(r'/book-detail/\d+')):
        m = re.search(r'/book-detail/(\d+)', a.get('href', ''))
        if m:
            results.append({
                'source': 'qq_read', 'name': 'QQ阅读',
                'title': a.get_text(strip=True) or book_name,
                'book_id': m.group(1),
            })
    # 去重
    seen = set()
    return [r for r in results if not (r['book_id'] in seen or seen.add(r['book_id']))]


def parse_qq_chapters(book_id):
    """从QQ阅读获取章节列表"""
    url = f'https://ubook.reader.qq.com/book-chapter/{book_id}'
    html = fetch_url(url)
    if not html: return None

    chapters = []
    # 方法1：__NUXT__
    m = re.search(r'window\.__NUXT__\s*=\s*({.*?});', html, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            def find_cl(obj, d=0):
                if d > 20: return None
                if isinstance(obj, dict):
                    if 'chapterList' in obj: return obj['chapterList']
                    for v in obj.values():
                        r = find_cl(v, d+1)
                        if r: return r
                elif isinstance(obj, list):
                    for v in obj:
                        r = find_cl(v, d+1)
                        if r: return r
                return None
            chapters = find_cl(data)
        except: pass

    # 方法2：HTML 链接
    if not chapters:
        s = BeautifulSoup(html, 'lxml')
        for a in s.find_all('a'):
            href = a.get('href', '')
            m2 = re.search(r'/(\d+)\.html$', href)
            if m2:
                chapters.append({'title': a.get_text(strip=True), 'id': m2.group(1)})

    if chapters:
        return [{'title': c.get('title', f'第{i+1}章'),
                 'id': c.get('id', c.get('chapterId', i+1))}
                for i, c in enumerate(chapters)]
    return None


def fetch_qq_chapter(book_id, ch_id):
    """QQ阅读单章内容"""
    return fetch_content(
        f'https://ubook.reader.qq.com/book-read/{book_id}/{ch_id}',
        [{'class': 'chapter-content'}, {'class': 'read-content'}, {'class': 'content'}]
    )


# ============== 顶点小说 ==============

def search_dingdian(book_name):
    """搜索顶点小说"""
    html = fetch_url(f'https://dingdianzww.org/search.html?key={quote(book_name)}')
    if not html: return []
    s = BeautifulSoup(html, 'lxml')
    results = []
    for a in s.find_all('a', href=re.compile(r'/\d+/$')):
        href = a.get('href', '')
        m = re.search(r'/(\d+)/$', href)
        if m:
            results.append({
                'source': 'dingdianzww', 'name': '顶点小说',
                'title': a.get('title', a.get_text(strip=True)),
                'book_id': m.group(1),
                'list_url': f'https://dingdianzww.org/{m.group(1)}/',
            })
    return results


def parse_dingdian_chapters(list_url):
    """解析顶点小说章节"""
    html = fetch_url(list_url)
    if not html: return None
    s = BeautifulSoup(html, 'lxml')
    chapters = []
    base = 'https://dingdianzww.org'
    for a in s.find_all('a'):
        href = a.get('href', '').strip()
        text = a.get_text(strip=True)
        if not href or not text: continue
        # 检查是否含 book_id 且以 .html 结尾
        if href.endswith('.html') and (list_url.rstrip('/').split('/')[-1] in href):
            full = href if href.startswith('http') else f'{base}/{href.lstrip("/")}'
            chapters.append({'title': text, 'url': full})
    return chapters or None


def fetch_dingdian_chapter(url):
    """顶点小说单章"""
    return fetch_content(url, [{'class': 'container'}])


# ============== 鬼大爷 ==============

def search_guidaye(book_name):
    """搜索鬼大爷"""
    html = fetch_url(f'https://b.guidaye.com/search.html?key={quote(book_name)}')
    if not html: return []
    s = BeautifulSoup(html, 'lxml')
    results = []
    for a in s.find_all('a', href=re.compile(r'/xy/\d+/$')):
        m = re.search(r'/xy/(\d+)/$', a.get('href', ''))
        if m:
            results.append({
                'source': 'guidaye', 'name': '鬼大爷',
                'title': a.get_text(strip=True),
                'book_id': m.group(1),
                'list_url': f'https://b.guidaye.com/xy/{m.group(1)}/',
            })
    return results


def parse_guidaye_chapters(list_url):
    """解析鬼大爷章节"""
    html = fetch_url(list_url)
    if not html: return None
    s = BeautifulSoup(html, 'lxml')
    chapters = []
    base = 'https://b.guidaye.com'
    for a in s.find_all('a'):
        href = a.get('href', '').strip()
        text = a.get_text(strip=True)
        if 'xy/' in href and href.endswith('.html'):
            full = href if href.startswith('http') else f'{base}/{href.lstrip("/")}'
            chapters.append({'title': text, 'url': full})
    return chapters or None


def fetch_guidaye_chapter(url):
    """鬼大爷单章"""
    return fetch_content(url, [{'class': 'container'}])


# ============== 25zw ==============

def search_25zw(book_name):
    """搜索25zw"""
    html = fetch_url(f'http://www.25zw.cc/search.html?keyword={quote(book_name)}')
    if not html: return []
    s = BeautifulSoup(html, 'lxml')
    results = []
    for a in s.find_all('a', href=re.compile(r'/book/\d+/$')):
        m = re.search(r'/book/(\d+)/$', a.get('href', ''))
        if m:
            results.append({
                'source': '25zw', 'name': '25zw',
                'title': a.get_text(strip=True),
                'book_id': m.group(1),
                'list_url': f'http://www.25zw.cc/book/{m.group(1)}/',
            })
    return results


def parse_25zw_chapters(list_url):
    """解析25zw章节"""
    html = fetch_url(list_url)
    if not html: return None
    s = BeautifulSoup(html, 'lxml')
    chapters = []
    for a in s.find_all('a'):
        href = a.get('href', '').strip()
        text = a.get_text(strip=True)
        if '/book/' in href and href.endswith('.html'):
            full = href if href.startswith('http') else f'http://www.25zw.cc{href}'
            chapters.append({'title': text, 'url': full})
    return chapters or None


def fetch_25zw_chapter(url):
    """25zw单章"""
    return fetch_content(url, [{'class': 'content'}])


# ============== 飞碟小说 ==============

def parse_feidie_chapters(list_url):
    """解析飞碟小说章节"""
    html = fetch_url(list_url)
    if not html: return None
    s = BeautifulSoup(html, 'lxml')
    chapters = []
    book_dir = list_url.rstrip('/').split('/')[-1]
    for a in s.find_all('a'):
        href = a.get('href', '').strip()
        text = a.get_text(strip=True)
        if book_dir in href and href.endswith('.html'):
            full = href if href.startswith('http') else f'https://m.feidiexs.com/{href.lstrip("/")}'
            chapters.append({'title': text, 'url': full})
    return chapters or None


# ============== 数据源注册表 ==============

SOURCES = [
    {
        'key': 'qq_read',
        'name': 'QQ阅读',
        'search': search_qq_read,
        'parse': lambda r: parse_qq_chapters(r['book_id']),
        'fetch': lambda ch, r: fetch_qq_chapter(r['book_id'], ch['id']),
    },
    {
        'key': 'dingdianzww',
        'name': '顶点小说',
        'search': search_dingdian,
        'parse': lambda r: parse_dingdian_chapters(r['list_url']),
        'fetch': lambda ch, r: fetch_dingdian_chapter(ch['url']),
    },
    {
        'key': 'guidaye',
        'name': '鬼大爷',
        'search': search_guidaye,
        'parse': lambda r: parse_guidaye_chapters(r['list_url']),
        'fetch': lambda ch, r: fetch_guidaye_chapter(ch['url']),
    },
    {
        'key': '25zw',
        'name': '25zw',
        'search': search_25zw,
        'parse': lambda r: parse_25zw_chapters(r['list_url']),
        'fetch': lambda ch, r: fetch_25zw_chapter(ch['url']),
    },
]


# ============== 自动分类 ==============

CATEGORY_KEYWORDS = {
    '玄幻': ['玄幻', '斗气', '魔法', '异界', '神', '魔', '仙帝', '斗帝', '武魂', '魂技',
             '召唤', '位面', '大陆', '苍穹', '星辰', '主宰', '武帝', '魔帝', '神帝'],
    '仙侠': ['仙侠', '修仙', '修真', '飞升', '凡人', '道', '元婴', '金丹', '灵根',
             '剑修', '法修', '天劫', '仙界', '灵界', '飞升'],
    '都市': ['都市', '校园', '职场', '总裁', '豪门', '现实', '重生', '娱乐', '体育',
             '商业', '金融', '医生', '律师', '老师', '明星', '黑客'],
    '言情': ['言情', '爱情', '恋爱', '结婚', '甜宠', '虐恋', '宫斗', '宅斗',
             '青梅竹马', '一见钟情', '霸道总裁', '王妃', '皇后', '萌宝'],
    '历史': ['历史', '穿越', '三国', '唐宋', '明清', '皇帝', '王爷', '将军',
             '回到', '古代', '架空', '王朝'],
    '科幻': ['科幻', '未来', '星际', '机甲', '末世', '丧尸', '外星', 'AI', '人工智能',
             '基因', '变异', '末日', '废土', '赛博'],
    '悬疑': ['悬疑', '恐怖', '鬼', '灵异', '推理', '侦探', '盗墓', '探险',
             '恐怖屋', '惊悚', '诡异', '谜案', '探案'],
    '无限流': ['无限', '轮回', '副本', '快穿', '系统', '主神', '任务', '面板'],
}

def detect_category(title, description=''):
    """根据书名和简介自动判断分类"""
    if not description: description = ''
    text = title + description

    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score

    if not scores:
        return '其他'

    # 返回得分最高的分类
    return max(scores, key=scores.get)


# ============== 主流程 ==============

def auto_fetch(book_name, author='', category=None, fetch_limit=50):
    """自动搜索并爬取书籍完整内容"""
    print(f'\n{"="*50}')
    print(f'  📚 搜索: {book_name}')
    print(f'{"="*50}')

    # 搜索所有数据源
    all_results = []
    for src in SOURCES:
        try:
            results = src['search'](book_name)
            if results:
                filtered = [r for r in results if book_name.lower() in r['title'].lower()]
                all_results.extend(filtered or results[:1])
                print(f'  [{src["name"]}] 找到 {len(filtered or results[:1])} 个结果')
        except Exception as e:
            print(f'  [{src["name"]}] 搜索失败: {e}')

    if not all_results:
        print(f'\n❌ 未找到"{book_name}"')
        return None

    print(f'\n📋 共 {len(all_results)} 个匹配:')
    for i, r in enumerate(all_results):
        print(f'   [{i+1}] {r["name"]} - {r["title"]}')

    # 选最优结果
    result = all_results[0]
    src = next(s for s in SOURCES if s['key'] == result['source'])

    print(f'\n📌 使用: {result["name"]} - {result["title"]}')

    # 获取章节列表
    chapters = src['parse'](result)
    if not chapters:
        print('❌ 获取章节列表失败'); return None

    total = len(chapters)
    print(f'✅ 共 {total} 章')

    to_fetch = chapters[:fetch_limit]
    if fetch_limit < total:
        print(f'   爬取前 {fetch_limit} 章（共 {total} 章）')

    # 爬取
    fetched = []
    print(f'\n📖 开始爬取...')

    for i, ch in enumerate(to_fetch):
        ct = ch['title'][:25] + '..' if len(ch['title']) > 25 else ch['title']
        print(f'  [{i+1}/{len(to_fetch)}] {ct} ...', end='', flush=True)

        content = src['fetch'](ch, result)
        if content:
            fetched.append({'order': i+1, 'title': ch['title'], 'content': content})
            print(f' {len(content)}字 ✓')
        else:
            print(f' ✗')

        if (i+1) % 10 == 0:
            time.sleep(1)

    if not fetched:
        print(f'\n❌ 未能爬取任何章节'); return None

    # 自动判断分类
    if not category:
        category = detect_category(book_name, fetched[0]['content'][:500] if fetched else '')
        print(f'  🏷️ 自动分类: {category}')

    # 保存
    key = re.sub(r'[\s　]', '_', book_name.lower())
    path = os.path.join(OUTPUT_DIR, f'{key}.json')

    data = {
        'title': book_name,
        'author': author or result.get('title', ''),
        'description': '',
        'category': category,
        'coverEmoji': '',
        'totalChapters': total,
        'allChapterTitles': [c['title'] for c in chapters],
        'fetchedChapters': fetched,
    }

    # 如果已存在，合并
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        existing_fetched = existing.get('fetchedChapters', [])
        existing_titles = {f['title'] for f in existing_fetched}
        for f in fetched:
            if f['title'] not in existing_titles:
                existing_fetched.append(f)
        data['fetchedChapters'] = existing_fetched
        # 如果新爬取章节更多，更新 totalChapters
        if total > existing.get('totalChapters', 0):
            data['totalChapters'] = total
            data['allChapterTitles'] = [c['title'] for c in chapters]

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'\n{"="*50}')
    print(f'✅ 完成！')
    print(f'   保存: {path}')
    print(f'   章节: {len(fetched)}/{total}')
    print(f'   用时: 约 {len(fetched) * 2} 秒')
    print(f'{"="*50}')

    return path


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(description='搜索并爬取书籍')
    p.add_argument('title', help='书名')
    p.add_argument('--author', '-a', default='', help='作者')
    p.add_argument('--cat', default=None, help='分类（不传则自动从书名/内容判断）')
    p.add_argument('--limit', '-n', type=int, default=50, help='爬取章数')
    a = p.parse_args()

    auto_fetch(a.title, a.author, a.cat, a.limit)