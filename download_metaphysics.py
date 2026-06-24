#!/usr/bin/env python3
"""
玄学/算命/哲学典籍批量下载脚本
从 shidianguji.com (识典古籍) 下载完整全文
利用页面内嵌的 _ROUTER_DATA JSON 提取结构化文本
"""

import urllib.request
import json
import re
import os
import time
import sys

OUTPUT_DIR = "/workspace/projects/public/book-content"

# 需要下载的书籍列表：书名、book_id、章节列表
# book_id 和 chapter_id 需要先从 shidianguji.com 搜索获取
BOOKS_TO_DOWNLOAD = {
    # 已知 book_id 的书籍
    "五行大义": {
        "book_id": "CADAL0210068099",
        "chapters": []  # 空表示需要先获取章节列表
    },
    "协纪辨方书": {
        "book_id": "",  # 需要搜索
        "chapters": []
    },
    "黄帝宅经": {
        "book_id": "",
        "chapters": []
    },
    "青囊奥语": {
        "book_id": "",
        "chapters": []
    },
    "催官篇": {
        "book_id": "",
        "chapters": []
    },
    "博山篇": {
        "book_id": "",
        "chapters": []
    },
    "管氏地理指蒙": {
        "book_id": "",
        "chapters": []
    },
    "平砂玉尺经": {
        "book_id": "",
        "chapters": []
    },
    "雪心赋": {
        "book_id": "",
        "chapters": []
    },
    "发微论": {
        "book_id": "",
        "chapters": []
    },
    "周易参同契": {
        "book_id": "",
        "chapters": []
    },
    "星学大成": {
        "book_id": "",
        "chapters": []
    },
    "张果星宗": {
        "book_id": "",
        "chapters": []
    },
    "演禽通纂": {
        "book_id": "",
        "chapters": []
    },
    "太乙金华宗旨": {
        "book_id": "",
        "chapters": []
    },
    "性命圭旨": {
        "book_id": "",
        "chapters": []
    },
    "卜筮全书": {
        "book_id": "",
        "chapters": []
    },
    "黄金策": {
        "book_id": "",
        "chapters": []
    },
    "断易天机": {
        "book_id": "",
        "chapters": []
    },
    "太清神鉴": {
        "book_id": "",
        "chapters": []
    },
    "人伦大统赋": {
        "book_id": "",
        "chapters": []
    },
    "柳庄相法": {
        "book_id": "",
        "chapters": []
    },
    "麻衣神相": {
        "book_id": "",
        "chapters": []
    },
    "地理五诀": {
        "book_id": "",
        "chapters": []
    },
    "都天宝照经": {
        "book_id": "",
        "chapters": []
    },
    "阳宅三要": {
        "book_id": "",
        "chapters": []
    },
    "罗经解": {
        "book_id": "",
        "chapters": []
    },
    # 哲学/佛学/心学
    "坛经": {
        "book_id": "",
        "chapters": []
    },
    "金刚经": {
        "book_id": "",
        "chapters": []
    },
    "楞严经": {
        "book_id": "",
        "chapters": []
    },
    "圆觉经": {
        "book_id": "",
        "chapters": []
    },
    "四十二章经": {
        "book_id": "",
        "chapters": []
    },
    "景德传灯录": {
        "book_id": "",
        "chapters": []
    },
    "碧岩录": {
        "book_id": "",
        "chapters": []
    },
    "无门关": {
        "book_id": "",
        "chapters": []
    },
    "宗镜录": {
        "book_id": "",
        "chapters": []
    },
    "太极图说": {
        "book_id": "",
        "chapters": []
    },
    "正蒙": {
        "book_id": "",
        "chapters": []
    },
    "二程遗书": {
        "book_id": "",
        "chapters": []
    },
    "四书章句集注": {
        "book_id": "",
        "chapters": []
    },
    "明心宝鉴": {
        "book_id": "",
        "chapters": []
    },
    "宋元学案": {
        "book_id": "",
        "chapters": []
    },
}

def fetch_url(url, timeout=15):
    """获取URL内容"""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  [ERROR] fetch_url failed: {e}")
        return None

def extract_router_data(html):
    """从HTML中提取 _ROUTER_DATA JSON"""
    match = re.search(r'window\._ROUTER_DATA\s*=\s*', html)
    if not match:
        return None
    
    start = match.end()
    json_str = html[start:]
    
    try:
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(json_str)
        return data
    except json.JSONDecodeError as e:
        print(f"  [ERROR] JSON decode error: {e}")
        return None

def get_chapter_text(router_data):
    """从 _ROUTER_DATA 中提取章节文本"""
    try:
        loader = router_data.get('loaderData', {})
        # 遍历 loaderData 找到包含 paragraphList 的项
        for key, value in loader.items():
            if isinstance(value, dict) and 'paragraphList' in value:
                paragraphs = value['paragraphList']
                lines = []
                for para in paragraphs:
                    if isinstance(para, dict):
                        line_type = para.get('lineType', 0)
                        if line_type == 1:  # 正文行
                            content = para.get('content', '').strip()
                            if content:
                                lines.append(content)
                return '\n'.join(lines)
    except Exception as e:
        print(f"  [ERROR] extract text error: {e}")
    return None

def get_chapter_list_from_book_page(router_data):
    """从书籍首页的 _ROUTER_DATA 中提取章节列表"""
    try:
        loader = router_data.get('loaderData', {})
        for key, value in loader.items():
            if isinstance(value, dict):
                # 尝试找 chapterList 或 menuList
                for list_key in ['chapterList', 'menuList', 'catalogList', 'volumeList']:
                    if list_key in value:
                        chapters = value[list_key]
                        result = []
                        for ch in chapters:
                            if isinstance(ch, dict):
                                ch_id = ch.get('id', ch.get('chapterId', ''))
                                ch_name = ch.get('name', ch.get('title', ch.get('chapterName', '')))
                                if ch_id:
                                    result.append({'id': str(ch_id), 'name': ch_name})
                        if result:
                            return result
    except Exception as e:
        print(f"  [ERROR] get chapter list error: {e}")
    return None

def download_book_from_shidianguji(book_name, book_id=None):
    """从识典古籍下载完整书籍"""
    print(f"\n{'='*60}")
    print(f"开始下载: {book_name}")
    print(f"{'='*60}")
    
    # Step 1: 搜索书籍获取 book_id
    if not book_id:
        search_url = f"https://www.shidianguji.com/search?keyword={urllib.request.quote(book_name)}"
        print(f"  搜索URL: {search_url}")
        html = fetch_url(search_url)
        if not html:
            print(f"  [FAIL] 搜索失败")
            return None
        
        # 从搜索结果中提取 book_id
        router_data = extract_router_data(html)
        if router_data:
            loader = router_data.get('loaderData', {})
            for key, value in loader.items():
                if isinstance(value, dict):
                    for list_key in ['searchResult', 'resultList', 'bookList']:
                        if list_key in value:
                            results = value[list_key]
                            for item in results[:5]:
                                if isinstance(item, dict):
                                    name = item.get('name', item.get('title', ''))
                                    bid = item.get('bookId', item.get('id', ''))
                                    if book_name in name:
                                        book_id = str(bid)
                                        print(f"  找到: {name} (book_id={book_id})")
                                        break
                            if book_id:
                                break
                    if book_id:
                        break
        
        if not book_id:
            # 尝试从HTML中提取
            bid_match = re.search(r'/book/([A-Za-z0-9]+)', html)
            if bid_match:
                book_id = bid_match.group(1)
                print(f"  从HTML提取book_id: {book_id}")
    
    if not book_id:
        print(f"  [FAIL] 未找到book_id")
        return None
    
    # Step 2: 获取书籍首页和章节列表
    book_url = f"https://www.shidianguji.com/book/{book_id}"
    print(f"  书籍URL: {book_url}")
    html = fetch_url(book_url)
    if not html:
        print(f"  [FAIL] 无法访问书籍页面")
        return None
    
    router_data = extract_router_data(html)
    chapters = []
    
    if router_data:
        # 尝试从页面数据中提取章节列表
        loader = router_data.get('loaderData', {})
        for key, value in loader.items():
            if isinstance(value, dict):
                # 检查各种可能的章节列表字段
                for list_key in ['chapterList', 'menuList', 'catalogList', 'volumeList', 'catalogs', 'toc']:
                    if list_key in value:
                        raw_chapters = value[list_key]
                        for ch in raw_chapters:
                            if isinstance(ch, dict):
                                ch_id = str(ch.get('id', ch.get('chapterId', ch.get('id', ''))))
                                ch_name = ch.get('name', ch.get('title', ch.get('chapterName', '')))
                                if ch_id:
                                    chapters.append({'id': ch_id, 'name': ch_name})
                                # 子章节
                                if 'children' in ch:
                                    for child in ch['children']:
                                        if isinstance(child, dict):
                                            child_id = str(child.get('id', child.get('chapterId', '')))
                                            child_name = child.get('name', child.get('title', ''))
                                            if child_id:
                                                chapters.append({'id': child_id, 'name': child_name})
        
        # 如果没有找到章节列表，尝试从 router_data 中其他位置
        if not chapters:
            # 遍历整个 loaderData 寻找包含 id/name 结构的列表
            for key, value in loader.items():
                if isinstance(value, dict):
                    for k, v in value.items():
                        if isinstance(v, list) and len(v) > 0:
                            first = v[0]
                            if isinstance(first, dict) and ('id' in first or 'chapterId' in first):
                                for item in v:
                                    ch_id = str(item.get('id', item.get('chapterId', '')))
                                    ch_name = item.get('name', item.get('title', item.get('chapterName', '')))
                                    if ch_id:
                                        chapters.append({'id': ch_id, 'name': ch_name})
    
    if not chapters:
        print(f"  [WARN] 未从页面数据中找到章节列表，尝试直接读取首页内容")
        # 尝试直接提取首页内容
        text = get_chapter_text(router_data) if router_data else None
        if text and len(text) > 100:
            output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f"{book_name}\n\n")
                f.write(text)
            print(f"  [OK] 仅首页内容，保存到 {output_path} ({len(text)} 字符)")
            return output_path
        print(f"  [FAIL] 无法获取任何内容")
        return None
    
    print(f"  找到 {len(chapters)} 个章节")
    for i, ch in enumerate(chapters[:5]):
        print(f"    {i+1}. {ch['name']} (id={ch['id']})")
    if len(chapters) > 5:
        print(f"    ... 共 {len(chapters)} 章")
    
    # Step 3: 逐章下载
    all_text = []
    all_text.append(f"{book_name}\n\n")
    
    for i, ch in enumerate(chapters):
        ch_url = f"https://www.shidianguji.com/book/{book_id}/chapter/{ch['id']}"
        print(f"  [{i+1}/{len(chapters)}] 下载: {ch['name']} ...", end='', flush=True)
        
        ch_html = fetch_url(ch_url)
        if not ch_html:
            print(" FAIL")
            all_text.append(f"\n【{ch['name']}】\n\n[下载失败]\n\n")
            continue
        
        ch_router = extract_router_data(ch_html)
        if not ch_router:
            print(" NO_DATA")
            all_text.append(f"\n【{ch['name']}】\n\n[无数据]\n\n")
            continue
        
        ch_text = get_chapter_text(ch_router)
        if ch_text and len(ch_text) > 0:
            all_text.append(f"\n【{ch['name']}】\n\n{ch_text}\n\n")
            print(f" OK ({len(ch_text)} 字)")
        else:
            print(" EMPTY")
            all_text.append(f"\n【{ch['name']}】\n\n[内容为空]\n\n")
        
        # 礼貌延迟
        time.sleep(0.5)
    
    # Step 4: 保存
    full_text = '\n'.join(all_text)
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    
    # 检查是否已有同名文件
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            old_size = len(f.read())
        if len(full_text) > old_size:
            print(f"  新内容({len(full_text)}字) > 旧内容({old_size}字)，覆盖")
        else:
            print(f"  旧内容({old_size}字) >= 新内容({len(full_text)}字)，跳过")
            return output_path
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"\n  [DONE] 保存到 {output_path}")
    print(f"  总字符数: {len(full_text)}")
    print(f"  总行数: {full_text.count(chr(10))}")
    
    return output_path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 如果命令行指定了特定书籍
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if target in BOOKS_TO_DOWNLOAD:
            info = BOOKS_TO_DOWNLOAD[target]
            download_book_from_shidianguji(target, info.get('book_id') or None)
        else:
            # 当作书名直接搜索
            download_book_from_shidianguji(target)
        return
    
    # 否则批量下载
    results = {'success': [], 'fail': [], 'skip': []}
    
    for book_name, info in BOOKS_TO_DOWNLOAD.items():
        # 检查是否已存在
        existing = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
        if os.path.exists(existing):
            with open(existing, 'r', encoding='utf-8') as f:
                content = f.read()
            if len(content) > 500:  # 已有足够内容
                print(f"\n[SKIP] {book_name} 已存在 ({len(content)} 字符)")
                results['skip'].append(book_name)
                continue
        
        try:
            result = download_book_from_shidianguji(book_name, info.get('book_id') or None)
            if result:
                results['success'].append(book_name)
            else:
                results['fail'].append(book_name)
        except Exception as e:
            print(f"  [ERROR] {e}")
            results['fail'].append(book_name)
        
        time.sleep(1)  # 书间延迟
    
    print(f"\n\n{'='*60}")
    print(f"批量下载完成")
    print(f"  成功: {len(results['success'])} - {results['success']}")
    print(f"  失败: {len(results['fail'])} - {results['fail']}")
    print(f"  跳过: {len(results['skip'])} - {results['skip']}")


if __name__ == '__main__':
    main()
