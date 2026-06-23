#!/usr/bin/env python3
"""
从劝学网(quanxue.cn)下载滴天髓阐微全文
每章一个页面，避免单页面截断问题
"""
import urllib.request
import re
import html
import sys
import os
import time
import ssl

OUTPUT_FILE = os.environ.get("COZE_WORKSPACE_PATH", "/workspace/projects") + "/public/book-content/滴天髓阐微.txt"
BASE_URL = "https://www.quanxue.cn/qt_mingxiang/ditian/ditian"

# 章节标题映射
CHAPTER_TITLES = {
    1: "滴天髓序",
    2: "滴天髓简介",
    # 通神论
    3: "一、天道",
    4: "二、地道",
    5: "三、人道",
    6: "四、知命",
    7: "五、理气",
    8: "六、配合",
    9: "七、天干",
    10: "八、地支",
    11: "九、干支总论",
    12: "十、形象",
    13: "十一、方局",
    14: "十二、八格",
    15: "十三、体用",
    16: "十四、精神",
    17: "十五、月令",
    18: "十六、生时",
    19: "十七、衰旺",
    20: "十八、中和",
    21: "十九、源流",
    22: "二十、通关",
    23: "二十一、官杀",
    24: "二十二、伤官",
    25: "二十三、清气",
    26: "二十四、浊气",
    27: "二十五、真神",
    28: "二十六、假神",
    29: "二十七、刚柔",
    30: "二十八、顺逆",
    31: "二十九、寒暖",
    32: "三十、燥湿",
    33: "三十一、隐显",
    34: "三十二、众寡",
    35: "三十三、震兑",
    36: "三十四、坎离",
    # 六亲论（征验论）
    37: "一、夫妻",
    38: "二、子女",
    39: "三、父母",
    40: "四、兄弟",
    41: "五、何知章",
    42: "六、女命章",
    43: "七、小儿",
    44: "八、才德",
    45: "九、奋郁",
    46: "十、恩怨",
    47: "十一、闲神",
    48: "十二、从象",
    49: "十三、化象",
    50: "十四、假从",
    51: "十五、假化",
    52: "十六、顺局",
    53: "十七、反局",
    54: "十八、战局",
    55: "十九、合局",
    56: "二十、君象",
    57: "二十一、臣象",
    58: "二十二、母象",
    59: "二十三、子象",
    60: "二十四、性情",
    61: "二十五、疾病",
    62: "二十六、出身",
    63: "二十七、地位",
    64: "二十八、岁运",
    65: "二十九、贞元",
}

# SSL context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def download_chapter(chapter_num):
    """下载单个章节页面"""
    url = f"{BASE_URL}{chapter_num:02d}.html"
    title = CHAPTER_TITLES.get(chapter_num, f"Chapter {chapter_num}")
    
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read()
    except Exception as e:
        print(f"  ✗ 章节 {chapter_num} 下载失败: {e}", flush=True)
        return None
    
    # 解码
    for enc in ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5', 'latin1']:
        try:
            html_text = raw.decode(enc)
            break
        except:
            continue
    else:
        html_text = raw.decode('utf-8', errors='replace')
    
    # 提取正文内容 - 劝学网使用特定HTML结构
    # 尝试多种选择器
    content = ""
    
    # 方法1: 找到主要内容区域
    # 劝学网通常用 <div class="content"> 或 <div id="content">
    patterns = [
        r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*id="[^"]*content[^"]*"[^>]*>(.*?)</div>',
        r'<article[^>]*>(.*?)</article>',
        r'<td[^>]*class="[^"]*text[^"]*"[^>]*>(.*?)</td>',
        r'<div[^>]*class="[^"]*art[^"]*"[^>]*>(.*?)</div>',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html_text, re.DOTALL)
        if match:
            content = match.group(1)
            break
    
    if not content:
        # 回退：提取body内容，去掉导航
        match = re.search(r'<body[^>]*>(.*?)</body>', html_text, re.DOTALL)
        if match:
            content = match.group(1)
        else:
            content = html_text
    
    # 清除HTML
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL)
    content = re.sub(r'<table[^>]*>.*?</table>', '', content, flags=re.DOTALL)
    content = re.sub(r'<br\s*/?\s*>', '\n', content)
    content = re.sub(r'<p[^>]*>', '\n', content)
    content = re.sub(r'</p>', '\n', content)
    content = re.sub(r'<h[1-6][^>]*>', '\n', content)
    content = re.sub(r'</h[1-6]>', '\n', content)
    content = re.sub(r'<li[^>]*>', '\n', content)
    content = re.sub(r'<[^>]+>', '', content)
    content = html.unescape(content)
    
    # 清除导航文字
    nav_words = ['上一篇', '下一篇', '返回目录', '首页', '劝学网', '收藏本页',
                 '设为首页', '打印此文', '关闭窗口', 'QQ空间', '腾讯微博',
                 '新浪微博', '微信', '更多', '0', '1', '2', '3', '4', '5',
                 '6', '7', '8', '9']
    for word in nav_words:
        content = content.replace(word, '')
    
    # 清除URL
    content = re.sub(r'https?://[^\s<>\"]+', '', content)
    
    # 清除多余空白
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
    content = content.strip()
    
    # 统计本章任氏曰
    renshi_count = len(re.findall(r'任氏曰', content))
    
    print(f"  ✓ 章节 {chapter_num:02d} [{title}]: {len(content)}字, 任氏曰:{renshi_count}", flush=True)
    
    return content

def main():
    print("=== 从劝学网下载滴天髓阐微全文 ===\n", flush=True)
    
    all_chapters = []
    total_renshi = 0
    total_chars = 0
    failed = []
    
    # 下载全部65章
    for i in range(1, 66):
        content = download_chapter(i)
        if content is None:
            failed.append(i)
            continue
        
        title = CHAPTER_TITLES.get(i, f"Chapter {i}")
        renshi = len(re.findall(r'任氏曰', content))
        total_renshi += renshi
        total_chars += len(content)
        
        all_chapters.append({
            'num': i,
            'title': title,
            'content': content,
            'renshi': renshi
        })
        
        # 添加延迟避免被封
        if i % 5 == 0:
            print(f"  --- 已下载 {i}/65, 任氏曰累计: {total_renshi} ---", flush=True)
            time.sleep(0.5)
        else:
            time.sleep(0.2)
    
    print(f"\n=== 下载完成 ===", flush=True)
    print(f"成功: {len(all_chapters)}/65", flush=True)
    print(f"失败: {failed}" if failed else "无失败", flush=True)
    print(f"总字数: {total_chars}", flush=True)
    print(f"任氏曰总数: {total_renshi}", flush=True)
    
    if not all_chapters:
        print("错误: 没有成功下载任何章节!", flush=True)
        sys.exit(1)
    
    # 组装完整文本
    output_lines = []
    output_lines.append("滴天髓阐微")
    output_lines.append("作者：任铁樵（清）")
    output_lines.append("")
    output_lines.append("=" * 40)
    output_lines.append("")
    
    # 序和简介
    for ch in all_chapters[:2]:
        output_lines.append(ch['title'])
        output_lines.append("")
        output_lines.append(ch['content'])
        output_lines.append("")
        output_lines.append("=" * 40)
        output_lines.append("")
    
    # 通神论
    output_lines.append("通神论")
    output_lines.append("")
    for ch in all_chapters[2:36]:
        output_lines.append(ch['title'])
        output_lines.append("")
        output_lines.append(ch['content'])
        output_lines.append("")
    
    output_lines.append("=" * 40)
    output_lines.append("")
    
    # 六亲论（征验论）
    output_lines.append("六亲论")
    output_lines.append("")
    for ch in all_chapters[36:]:
        output_lines.append(ch['title'])
        output_lines.append("")
        output_lines.append(ch['content'])
        output_lines.append("")
    
    full_text = '\n'.join(output_lines)
    
    # 保存
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    file_size = os.path.getsize(OUTPUT_FILE)
    print(f"\n已保存到: {OUTPUT_FILE}", flush=True)
    print(f"文件大小: {file_size} 字节 ({file_size/1024:.1f} KB)", flush=True)
    
    # 验证
    final_renshi = len(re.findall(r'任氏曰', full_text))
    print(f"\n=== 最终验证 ===", flush=True)
    print(f"任氏曰: {final_renshi}", flush=True)
    
    # 检查关键章节
    key_check = ['天道', '地道', '天干', '地支', '形象', '官杀', '伤官', '坎离',
                 '夫妻', '何知', '女命', '性情', '疾病', '出身', '地位', '岁运', '贞元']
    for k in key_check:
        found = k in full_text
        print(f"  {'✓' if found else '✗'} {k}", flush=True)
    
    return len(failed) == 0

if __name__ == '__main__':
    main()
