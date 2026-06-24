#!/usr/bin/env python3
"""
从 zhonghuashu.com (中华文库) 批量下载古籍全文
URL格式: https://www.zhonghuashu.com/wiki/{书名}/{卷号}
"""

import urllib.request
import re
import os
import time
import html
import sys

OUTPUT_DIR = "/workspace/projects/public/book-content"

# 目标书籍：书名 => 卷数 (0表示单卷本)
# 使用繁体字因为zhonghuashu.com的URL使用繁体
BOOKS = {
    # 玄学/命理/风水/占卜
    "五行大義": 5,
    "協紀辨方書": 36,  # 大型书
    "黃帝宅經": 2,
    "青囊奧語": 1,
    "催官篇": 2,
    "博山篇": 1,
    "管氏地理指蒙": 2,
    "平砂玉尺經": 1,
    "雪心賦": 1,
    "發微論": 1,
    "周易參同契": 3,
    "星學大成": 30,  # 大型书
    "張果星宗": 6,
    "演禽通纂": 2,
    "太乙金華宗旨": 1,
    "性命圭旨": 4,
    "卜筮全書": 6,
    "黃金策": 3,
    "斷易天機": 6,
    "太清神鑒": 6,
    "人倫大統賦": 1,
    "柳莊相法": 2,
    "麻衣神相": 5,
    "地理五訣": 8,
    "都天寶照經": 1,
    "陽宅三要": 4,
    "羅經解": 2,
    # 哲学/佛学/心学
    "壇經": 1,
    "金剛經": 1,
    "楞嚴經": 10,
    "圓覺經": 1,
    "四十二章經": 1,
    "景德傳燈錄": 30,  # 大型书
    "碧巖錄": 10,
    "無門關": 1,
    "宗鏡錄": 100,  # 非常大
    "太極圖說": 1,
    "正蒙": 2,
    "二程遺書": 25,
    "四書章句集注": 6,
    "明心寶鑒": 2,
    "宋元學案": 100,  # 非常大
}


def fetch_url(url, timeout=15):
    """获取URL内容"""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        return None


def extract_text_from_html(html_content):
    """从zhonghuashu.com的HTML中提取正文文本"""
    if not html_content:
        return None
    
    # 方法1：提取wiki内容区域
    # zhonghuashu.com uses mw-parser-output class
    content_match = re.search(
        r'<div\s+class="mw-parser-output[^"]*">(.*?)</div>\s*(?:<div|<!--)',
        html_content, re.DOTALL
    )
    
    if not content_match:
        # 尝试更宽松的匹配
        content_match = re.search(
            r'<div\s+class="mw-parser-output[^"]*">(.*?)$',
            html_content, re.DOTALL
        )
    
    if not content_match:
        return None
    
    content = content_match.group(1)
    
    # 移除导航表格 (目录/上一卷/下一卷)
    content = re.sub(r'<table[^>]*>.*?</table>', '', content, flags=re.DOTALL)
    
    # 移除目录列表 (保留标题)
    content = re.sub(r'<div[^>]*class="[^"]*toc[^"]*"[^>]*>.*?</div>', '', content, flags=re.DOTALL)
    
    # 处理标题
    content = re.sub(r'<h[1-6][^>]*>\s*<span[^>]*class="mw-headline"[^>]*>(.*?)</span>.*?</h[1-6]>', 
                     r'\n\n【\1】\n', content, flags=re.DOTALL)
    content = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', 
                     r'\n\n【\1】\n', content, flags=re.DOTALL)
    
    # 处理段落
    content = re.sub(r'<p[^>]*>', '\n', content)
    content = re.sub(r'</p>', '\n', content)
    
    # 处理换行
    content = re.sub(r'<br\s*/?>', '\n', content)
    
    # 移除所有剩余HTML标签
    content = re.sub(r'<[^>]+>', '', content)
    
    # 解码HTML实体
    content = html.unescape(content)
    
    # 清理多余空白
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n{3,}', '\n\n', content)
    content = content.strip()
    
    return content


def detect_volume_count(book_name):
    """自动检测书籍的卷数"""
    base_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name)}"
    html_content = fetch_url(base_url)
    if not html_content:
        return 0
    
    # 查找目录中的卷链接
    # Pattern: href="/wiki/书名/数字"
    pattern = rf'href="/wiki/{re.escape(urllib.request.quote(book_name))}/(\d+)"'
    matches = re.findall(pattern, html_content)
    
    if matches:
        max_vol = max(int(m) for m in matches)
        return max_vol
    
    # 检查是否有下一卷链接
    next_pattern = rf'href="/wiki/{re.escape(urllib.request.quote(book_name))}/(\d+)"[^>]*>下一卷'
    next_matches = re.findall(next_pattern, html_content)
    if next_matches:
        # 需要遍历找到最大卷号
        return -1  # 需要进一步检测
    
    return 0  # 单卷本


def download_book(book_name, volumes=0):
    """从zhonghuashu.com下载完整书籍"""
    simplified = {
        '義': '义', '協': '协', '紀': '纪', '辨': '辨', '書': '书',
        '黃': '黄', '經': '经', '奧': '奥', '語': '语', '賦': '赋',
        '參': '参', '學': '学', '張': '张', '極': '极', '華': '华',
        '旨': '旨', '筮': '筮', '斷': '断', '鑒': '鉴', '鑑': '鉴',
        '倫': '伦', '統': '统', '訣': '诀', '陽': '阳', '羅': '罗',
        '壇': '坛', '剛': '刚', '嚴': '严', '圓': '圆', '覺': '觉',
        '傳': '传', '錄': '录', '巖': '岩', '關': '关', '鏡': '镜',
        '遺': '遗', '響': '响', '漢': '汉', '學': '学', '寶': '宝',
        '觀': '观', '論': '论', '體': '体', '質': '质',
    }
    
    # 转换繁体到简体作为文件名
    save_name = book_name
    for tc, sc in simplified.items():
        save_name = save_name.replace(tc, sc)
    
    output_path = os.path.join(OUTPUT_DIR, f"{save_name}.txt")
    
    # 检查是否已存在且有足够内容
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            old_content = f.read()
        if len(old_content) > 1000:
            print(f"  [SKIP] {save_name} 已存在 ({len(old_content)} 字符)")
            return output_path
    
    print(f"\n{'='*50}")
    print(f"下载: {book_name} (保存为: {save_name}.txt)")
    
    all_text = [f"{save_name}\n\n"]
    
    # 下载主页（可能有前言/序）
    base_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name)}"
    print(f"  主页: {base_url}")
    main_html = fetch_url(base_url)
    
    if main_html:
        main_text = extract_text_from_html(main_html)
        if main_text and len(main_text) > 50:
            all_text.append(main_text)
            all_text.append("\n\n")
    
    # 如果未指定卷数，自动检测
    if volumes <= 0:
        volumes = detect_volume_count(book_name)
        if volumes < 0:
            # 需要遍历检测最大卷号
            vol = 1
            while True:
                vol_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name)}/{vol}"
                test = fetch_url(vol_url)
                if not test or '找不到' in test or '不存在' in test:
                    break
                vol += 1
                if vol > 200:  # 安全上限
                    break
            volumes = vol - 1
        print(f"  检测到 {volumes} 卷")
    
    # 逐卷下载
    for vol in range(1, volumes + 1):
        vol_url = f"https://www.zhonghuashu.com/wiki/{urllib.request.quote(book_name)}/{vol}"
        print(f"  [{vol}/{volumes}] 下载卷{vol}...", end='', flush=True)
        
        vol_html = fetch_url(vol_url)
        if not vol_html:
            print(" FAIL")
            all_text.append(f"\n【卷{vol}】\n\n[下载失败]\n\n")
            continue
        
        vol_text = extract_text_from_html(vol_html)
        if vol_text and len(vol_text) > 20:
            all_text.append(f"\n【卷{vol}】\n\n{vol_text}\n\n")
            print(f" OK ({len(vol_text)} 字)")
        else:
            print(" EMPTY")
            all_text.append(f"\n【卷{vol}】\n\n[内容为空]\n\n")
        
        time.sleep(0.3)
    
    # 保存
    full_text = ''.join(all_text)
    
    if len(full_text) < 100:
        print(f"  [FAIL] 内容太少 ({len(full_text)} 字符)")
        return None
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"  [DONE] {output_path} ({len(full_text)} 字符, {full_text.count(chr(10))} 行)")
    return output_path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if len(sys.argv) > 1:
        # 命令行指定书籍
        target = sys.argv[1]
        if target in BOOKS:
            download_book(target, BOOKS[target])
        else:
            # 当作书名，自动检测卷数
            download_book(target, 0)
        return
    
    # 批量下载
    results = {'success': [], 'fail': [], 'skip': []}
    
    for book_name, volumes in BOOKS.items():
        try:
            result = download_book(book_name, volumes)
            if result:
                results['success'].append(book_name)
            else:
                results['fail'].append(book_name)
        except Exception as e:
            print(f"  [ERROR] {e}")
            results['fail'].append(book_name)
        
        time.sleep(0.5)
    
    print(f"\n\n{'='*60}")
    print(f"批量下载完成")
    print(f"  成功: {len(results['success'])} - {results['success']}")
    print(f"  失败: {len(results['fail'])} - {results['fail']}")
    print(f"  跳过: {len(results['skip'])} - {results['skip']}")


if __name__ == '__main__':
    main()
