#!/usr/bin/env python3
"""
下载滴天髓阐微全文并生成干净的txt文件
从zhonghuashu.com获取完整内容，解析HTML提取文本
"""
import urllib.request
import urllib.error
import re
import html
import sys
import os

TARGET_URL = "https://www.zhonghuashu.com/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE"
OUTPUT_FILE = os.environ.get("COZE_WORKSPACE_PATH", "/workspace/projects") + "/public/book-content/滴天髓阐微.txt"

def download_page():
    """下载页面HTML，处理分块传输"""
    all_chunks = []
    total_bytes = 0
    
    req = urllib.request.Request(TARGET_URL, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',  # 不压缩，便于分段
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Connection': 'keep-alive',
    })
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            while True:
                chunk = resp.read(8192)
                if not chunk:
                    break
                all_chunks.append(chunk)
                total_bytes += len(chunk)
                print(f"  已下载 {total_bytes} 字节...", flush=True)
    except Exception as e:
        print(f"下载出错: {e}", flush=True)
    
    raw_html = b''.join(all_chunks)
    print(f"总下载: {len(raw_html)} 字节", flush=True)
    return raw_html

def extract_text_from_html(raw_html):
    """从HTML中提取正文文本"""
    # 尝试多种编码
    for encoding in ['utf-8', 'gbk', 'gb2312', 'latin1']:
        try:
            html_text = raw_html.decode(encoding)
            break
        except:
            continue
    else:
        html_text = raw_html.decode('utf-8', errors='replace')
    
    # 提取 <div class="wiki-content"> 或主要正文区域
    # 尝试多种选择器
    content_patterns = [
        r'<div[^>]*class="[^"]*wiki-content[^"]*"[^>]*>(.*?)</div>\s*(?:<div[^>]*class="[^"]*wiki(?:-nav|-footer|)[^"]*")',
        r'<div[^>]*id="content"[^>]*>(.*?)</div>',
        r'<article[^>]*>(.*?)</article>',
        r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>',
    ]
    
    content = ""
    for pattern in content_patterns:
        match = re.search(pattern, html_text, re.DOTALL)
        if match:
            content = match.group(1)
            print(f"  使用选择器提取到 {len(content)} 字符", flush=True)
            break
    
    if not content:
        # 回退：提取body内容
        match = re.search(r'<body[^>]*>(.*?)</body>', html_text, re.DOTALL)
        if match:
            content = match.group(1)
            print(f"  使用body回退提取到 {len(content)} 字符", flush=True)
        else:
            content = html_text
            print(f"  无选择器匹配，使用全部HTML", flush=True)
    
    # 清除HTML标签
    text = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<br\s*/?\s*>', '\n', text)
    text = re.sub(r'<p[^>]*>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    text = re.sub(r'<h[1-6][^>]*>', '\n', text)
    text = re.sub(r'</h[1-6]>', '\n', text)
    text = re.sub(r'<li[^>]*>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    
    # 清除多余空白
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    
    return text.strip()

def deep_clean(text):
    """深度清洗文本，移除markdown标记、URL、导航文字等"""
    # 移除markdown链接 [txt](url)
    text = re.sub(r'\[[^\]]*\]\([^\)]*\)', '', text)
    
    # 移除URL
    text = re.sub(r'https?://[^\s\)\]）】"]+', '', text)
    
    # 移除标题标记 ###
    text = re.sub(r'#{1,6}\s*', '', text)
    
    # 移除分隔线 ---
    text = re.sub(r'^-{3,}$', '', text, flags=re.MULTILINE)
    
    # 移除导航文字
    nav_patterns = [
        r'中华文库',
        r'滴天髓阐微.*?URL:',
        r'Token:\s*\d+',
        r'offset:\s*\d+',
        r'^\s*URL:.*$',
        r'^\s*---\s*$',
        r'编辑',
        r'讨论',
        r'历史',
        r'首页',
        r'分类:',
        r'导航',
        r'搜索',
        r'工具',
        r'登录',
        r'创建账号',
        r'返回',
        r'上一页',
        r'下一页',
        r'页首',
        r'页尾',
    ]
    for pattern in nav_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE)
    
    # 清除空行过多
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    
    return text.strip()

def format_book(text):
    """格式化书籍内容，确保章节标题和正文格式统一"""
    lines = text.split('\n')
    result = []
    
    for line in lines:
        line = line.strip()
        if not line:
            result.append('')
            continue
        
        # 检测章节标题模式
        # "一、天道" 或 "### 一、天道" 等格式
        if re.match(r'^[一二三四五六七八九十]+[、．.]', line) or \
           re.match(r'^第[一二三四五六七八九十]+[节章篇]', line) or \
           re.match(r'^通神论', line) or \
           re.match(r'^六亲论', line):
            result.append('')
            result.append(line)
            result.append('')
        else:
            result.append(line)
    
    return '\n'.join(result)

def count_renshi(text):
    """统计任氏曰出现次数"""
    return len(re.findall(r'任氏曰', text))

def count_sections(text):
    """统计节数"""
    # 通神论节数
    tongshen = re.findall(r'[一二三四五六七八九十]+、', text)
    # 也检查 "二十六、出身" 这类
    tongshen2 = re.findall(r'十[一二三四五六七八九]?[、．.]', text)
    total = len(set(tongshen + tongshen2))
    return total

def verify_content(text):
    """验证内容完整性"""
    renshi_count = count_renshi(text)
    print(f"\n=== 内容验证 ===", flush=True)
    print(f"文件大小: {len(text)} 字符", flush=True)
    print(f"任氏曰数量: {renshi_count}", flush=True)
    
    # 检查关键章节
    key_sections = [
        '一、天道', '十、形象', '二十、通关', '三十四、坎离',
        '一、夫妻', '五、何知章', '十、恩怨', '十五、假化',
        '二十、君象', '二十五、疾病', '二十六、出身', '二十七、地位',
        '二十八、岁运', '二十九、贞元'
    ]
    
    found = 0
    missing = []
    for section in key_sections:
        if section in text:
            found += 1
        else:
            missing.append(section)
    
    print(f"关键章节检查: {found}/{len(key_sections)} 存在", flush=True)
    if missing:
        print(f"缺失章节: {missing}", flush=True)
    
    # 检查通神论和六亲论
    has_tongshen = '通神论' in text
    has_liuqin = '六亲论' in text
    print(f"通神论: {'存在' if has_tongshen else '缺失'}", flush=True)
    print(f"六亲论: {'存在' if has_liuqin else '缺失'}", flush=True)
    
    return renshi_count >= 100 and found >= 12

def main():
    print("=== 滴天髓阐微全文下载与解析 ===", flush=True)
    
    # Step 1: 下载页面
    print("\n[1/5] 下载页面HTML...", flush=True)
    raw_html = download_page()
    
    if len(raw_html) < 1000:
        print("错误: 下载的HTML太小，可能被拦截", flush=True)
        sys.exit(1)
    
    # Step 2: 提取文本
    print("\n[2/5] 从HTML提取文本...", flush=True)
    text = extract_text_from_html(raw_html)
    print(f"  提取到 {len(text)} 字符文本", flush=True)
    
    # Step 3: 深度清洗
    print("\n[3/5] 深度清洗文本...", flush=True)
    text = deep_clean(text)
    print(f"  清洗后 {len(text)} 字符", flush=True)
    
    # Step 4: 格式化
    print("\n[4/5] 格式化书籍内容...", flush=True)
    text = format_book(text)
    
    # Step 5: 验证并保存
    print("\n[5/5] 验证并保存...", flush=True)
    is_valid = verify_content(text)
    
    # 保存
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(text)
    
    file_size = os.path.getsize(OUTPUT_FILE)
    print(f"\n已保存到: {OUTPUT_FILE}", flush=True)
    print(f"文件大小: {file_size} 字节 ({file_size/1024:.1f} KB)", flush=True)
    
    if is_valid:
        print("\n✅ 内容验证通过！", flush=True)
    else:
        print("\n⚠️ 内容可能不完整，需要补充", flush=True)
    
    return is_valid

if __name__ == '__main__':
    main()
