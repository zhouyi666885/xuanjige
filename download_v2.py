#!/usr/bin/env python3
"""
玄学典籍批量下载 v2 - 多源支持
主要来源: zhonghuashu.com (中华文库)
备选来源: shidianguji.com (识典古籍), diancang.xyz (中华典藏)
"""

import urllib.request
import re
import os
import time
import html as html_module
import json
import sys

OUTPUT_DIR = "/workspace/projects/public/book-content"

def fetch_url(url, timeout=15, retries=2):
    """获取URL内容"""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            })
            resp = urllib.request.urlopen(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                return None

def extract_text_generic(html_content):
    """通用HTML文本提取"""
    if not html_content:
        return None
    
    # 移除script和style
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    
    # 找到正文区域 - 尝试多种模式
    content = None
    
    # 模式1: mw-parser-output (MediaWiki)
    match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)</div>\s*(?:<div\s|<!--\s*NewPP)', text, re.DOTALL)
    if match:
        content = match.group(1)
    
    if not content:
        # 模式2: 尝试更大的范围
        match = re.search(r'<div\s+class="mw-parser-output[^"]*">(.*?)$', text, re.DOTALL)
        if match:
            content = match.group(1)
    
    if not content:
        # 模式3: article标签
        match = re.search(r'<article[^>]*>(.*?)</article>', text, re.DOTALL)
        if match:
            content = match.group(1)
    
    if not content:
        content = text
    
    # 保留标题标记
    content = re.sub(r'<h[1-6][^>]*>\s*(?:<span[^>]*class="mw-headline"[^>]*>)?(.*?)(?:</span>)?\s*(?:<span[^>]*class="mw-editsection"[^>]*>.*?</span>)?\s*</h[1-6]>', 
                     r'\n\n【\1】\n', content, flags=re.DOTALL)
    
    # 移除导航表格
    content = re.sub(r'<table[^>]*class="[^"]*nav[^"]*"[^>]*>.*?</table>', '', content, flags=re.DOTALL)
    
    # 保留段落换行
    content = re.sub(r'<p[^>]*>', '\n', content)
    content = re.sub(r'</p>', '\n', content)
    content = re.sub(r'<br\s*/?>', '\n', content)
    
    # 移除所有HTML标签
    content = re.sub(r'<[^>]+>', '', content)
    
    # 解码HTML实体
    content = html_module.unescape(content)
    
    # 清理
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n{3,}', '\n\n', content)
    content = content.strip()
    
    # 移除常见的导航文字
    nav_patterns = [
        r'目录\s*$',
        r'^\s*上一卷\s*$',
        r'^\s*下一卷\s*$',
        r'^\s*◄上一卷\s*$',
        r'^\s*下一卷▶\s*$',
        r'^\s*全书始\s*$',
        r'^\s*全书终\s*$',
    ]
    for pat in nav_patterns:
        content = re.sub(pat, '', content, flags=re.MULTILINE)
    
    return content.strip()


# ========== 中华文库 (zhonghuashu.com) ==========
def download_from_zhonghuashu(book_name_tw, volumes):
    """从zhonghuashu.com下载"""
    # 繁简转换
    tc_to_sc = {
        '義':'义','協':'协','紀':'纪','書':'书','黃':'黄','經':'经',
        '奧':'奥','語':'语','賦':'赋','參':'参','學':'学','張':'张',
        '極':'极','華':'华','旨':'旨','筮':'筮','斷':'断','鑒':'鉴',
        '鑑':'鉴','倫':'伦','統':'统','訣':'诀','陽':'阳','羅':'罗',
        '壇':'坛','剛':'刚','嚴':'严','圓':'圆','覺':'觉','傳':'传',
        '錄':'录','巖':'岩','關':'关','鏡':'镜','遺':'遗','寶':'宝',
        '觀':'观','論':'论','體':'体','質':'质','營':'营','辭':'辞',
        '開':'开','問':'问','難':'难','會':'会','機':'机','無':'无',
        '靈':'灵','龍':'龙','門':'门','記':'记','還':'还','術':'术',
        '總':'总','註':'注','訓':'训','講':'讲','歷':'历','聖':'圣',
        '賢':'贤','圖':'图','儀':'仪','節':'节','數':'数','樂':'乐',
        '禮':'礼','運':'运','氣':'气','變':'变','過':'过','據':'据',
        '處':'处','萬':'万','發':'发','東':'东','鳳':'凤','龜':'龟',
    }
    save_name = book_name_tw
    for tc, sc in tc_to_sc.items():
        save_name = save_name.replace(tc, sc)
    
    output_path = os.path.join(OUTPUT_DIR, f"{save_name}.txt")
    
    # 检查已存在
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            old = f.read()
        if len(old) > 1000:
            print(f"  [SKIP] {save_name} 已存在 ({len(old)} 字符)")
            return output_path
    
    print(f"  [zhonghuashu] 下载: {book_name_tw} => {save_name}.txt")
    
    all_text = [f"{save_name}\n\n"]
    
    # 下载主页
    base_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name_tw)}"
    main_html = fetch_url(base_url)
    if main_html:
        main_text = extract_text_generic(main_html)
        if main_text and len(main_text) > 50:
            all_text.append(main_text)
            all_text.append("\n\n")
    
    # 逐卷下载
    for vol in range(1, volumes + 1):
        vol_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name_tw)}/{vol}"
        print(f"    [{vol}/{volumes}] {vol_url}", end=' ... ', flush=True)
        
        vol_html = fetch_url(vol_url)
        if not vol_html:
            print("FAIL")
            continue
        
        vol_text = extract_text_generic(vol_html)
        if vol_text and len(vol_text) > 20:
            all_text.append(f"\n【卷{vol}】\n\n{vol_text}\n\n")
            print(f"OK ({len(vol_text)}字)")
        else:
            print("EMPTY")
        
        time.sleep(0.3)
    
    full_text = ''.join(all_text)
    if len(full_text) < 100:
        print(f"  [FAIL] 内容太少")
        return None
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"  [OK] {save_name}.txt ({len(full_text)} 字符)")
    return output_path


# ========== 识典古籍 (shidianguji.com) ==========
def download_from_shidianguji(book_name, book_id, chapter_ids):
    """从shidianguji.com下载完整书籍（使用_ROUTER_DATA提取）"""
    print(f"  [shidianguji] 下载: {book_name}")
    
    all_text = [f"{book_name}\n\n"]
    
    for i, ch_id in enumerate(chapter_ids):
        ch_url = f"https://www.shidianguji.com/book/{book_id}/chapter/{ch_id}"
        print(f"    [{i+1}/{len(chapter_ids)}] {ch_url}", end=' ... ', flush=True)
        
        ch_html = fetch_url(ch_url)
        if not ch_html:
            print("FAIL")
            continue
        
        # 提取 _ROUTER_DATA
        match = re.search(r'window\._ROUTER_DATA\s*=\s*', ch_html)
        if not match:
            print("NO_ROUTER_DATA")
            continue
        
        json_str = ch_html[match.end():]
        try:
            decoder = json.JSONDecoder()
            data, _ = decoder.raw_decode(json_str)
        except:
            print("JSON_FAIL")
            continue
        
        # 提取paragraphList中的正文
        loader = data.get('loaderData', {})
        text_lines = []
        ch_name = ''
        for key, value in loader.items():
            if isinstance(value, dict):
                if 'paragraphList' in value:
                    paragraphs = value['paragraphList']
                    for para in paragraphs:
                        if isinstance(para, dict):
                            if para.get('lineType') == 1:
                                content = para.get('content', '').strip()
                                if content:
                                    text_lines.append(content)
                if not ch_name:
                    ch_name = value.get('chapterName', value.get('name', ''))
        
        if text_lines:
            ch_text = '\n'.join(text_lines)
            label = ch_name if ch_name else f"章节{i+1}"
            all_text.append(f"\n【{label}】\n\n{ch_text}\n\n")
            print(f"OK ({len(ch_text)}字)")
        else:
            print("EMPTY")
        
        time.sleep(0.5)
    
    full_text = ''.join(all_text)
    if len(full_text) < 100:
        print(f"  [FAIL] 内容太少")
        return None
    
    output_path = os.path.join(OUTPUT_DIR, f"{book_name}.txt")
    
    # 检查是否需要覆盖
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            old = f.read()
        if len(full_text) > len(old):
            print(f"  新内容({len(full_text)}字) > 旧内容({len(old)}字)，覆盖")
        else:
            print(f"  旧内容({len(old)}字) >= 新内容({len(full_text)}字)，保留")
            return output_path
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"  [OK] {book_name}.txt ({len(full_text)} 字符)")
    return output_path


# ========== 目标书籍列表 ==========
# 格式: (保存名, 来源, 参数)
# zhonghuashu: (书名繁体, 卷数)
# shidianguji: (书名, book_id, [chapter_ids])

BOOKS_TO_DOWNLOAD = [
    # ===== 玄学/命理/风水/占卜 =====
    ("五行大义", "zhonghuashu", ("五行大義", 5)),
    ("周易参同契", "zhonghuashu", ("周易參同契", 3)),
    ("黄帝宅经", "zhonghuashu", ("黃帝宅經", 2)),
    ("青囊奥语", "zhonghuashu", ("青囊奧語", 1)),
    ("催官篇", "zhonghuashu", ("催官篇", 2)),
    ("博山篇", "zhonghuashu", ("博山篇", 1)),
    ("管氏地理指蒙", "zhonghuashu", ("管氏地理指蒙", 2)),
    ("雪心赋", "zhonghuashu", ("雪心賦", 1)),
    ("发微论", "zhonghuashu", ("發微論", 1)),
    ("太乙金华宗旨", "zhonghuashu", ("太乙金華宗旨", 1)),
    ("平砂玉尺经", "zhonghuashu", ("平砂玉尺經", 1)),
    ("人伦大统赋", "zhonghuashu", ("人倫大統賦", 1)),
    ("都天宝照经", "zhonghuashu", ("都天寶照經", 1)),
    # 哲学/佛学/心学
    ("坛经", "zhonghuashu", ("壇經", 1)),
    ("金刚经", "zhonghuashu", ("金剛經", 1)),
    ("圆觉经", "zhonghuashu", ("圓覺經", 1)),
    ("四十二章经", "zhonghuashu", ("四十二章經", 1)),
    ("无门关", "zhonghuashu", ("無門關", 1)),
    ("太极图说", "zhonghuashu", ("太極圖說", 1)),
    ("明心宝鉴", "zhonghuashu", ("明心寶鑒", 2)),
]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if len(sys.argv) > 1:
        target = sys.argv[1]
        for save_name, source, params in BOOKS_TO_DOWNLOAD:
            if save_name == target:
                if source == "zhonghuashu":
                    download_from_zhonghuashu(params[0], params[1])
                elif source == "shidianguji":
                    download_from_shidianguji(save_name, params[0], params[1])
                break
        return
    
    results = {'success': [], 'fail': [], 'skip': []}
    
    for save_name, source, params in BOOKS_TO_DOWNLOAD:
        try:
            if source == "zhonghuashu":
                result = download_from_zhonghuashu(params[0], params[1])
            elif source == "shidianguji":
                result = download_from_shidianguji(save_name, params[0], params[1])
            else:
                result = None
            
            if result:
                results['success'].append(save_name)
            else:
                results['fail'].append(save_name)
        except Exception as e:
            print(f"  [ERROR] {save_name}: {e}")
            results['fail'].append(save_name)
        
        time.sleep(0.5)
    
    print(f"\n\n{'='*60}")
    print(f"批量下载完成")
    print(f"  成功: {len(results['success'])} - {results['success']}")
    print(f"  失败: {len(results['fail'])} - {results['fail']}")
    print(f"  跳过: {len(results['skip'])} - {results['skip']}")


if __name__ == '__main__':
    main()
