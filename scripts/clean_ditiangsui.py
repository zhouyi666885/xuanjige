#!/usr/bin/env python3
"""
Clean and combine web_fetch segments for 滴天髓阐微.
Reads /tmp/dt_seg_0.txt through /tmp/dt_seg_9.txt,
cleans markdown formatting, combines, and outputs to stdout or a file.

Usage:
  python3 scripts/clean_ditiangsui.py                    # output to stdout
  python3 scripts/clean_ditiangsui.py -o output.txt      # output to file
  python3 scripts/clean_ditiangsui.py -d /tmp/segments/   # custom segment directory
"""

import re
import os
import sys
import argparse


def deep_clean(text: str) -> str:
    """Remove web_fetch markdown artifacts while preserving Chinese content."""
    
    # Remove markdown links [text](url) → text
    text = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', text)
    
    # Remove standalone URLs
    text = re.sub(r'https?://[^\s\)\]<>"]+', '', text)
    
    # Remove heading markers (### ## #) but keep the text
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    
    # Remove horizontal rules (--- or ***)
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    
    # Remove navigation/boilerplate patterns
    nav_patterns = [
        r'中华文库',
        r'另见[：:]*',
        r'返回[：:]*',
        r'目录',
        r'编辑',
        r'收藏',
        r'分享',
        r'打印',
        r'讨论',
        r'历史',
        r'监视',
        r'工具',
        r'搜索',
        r'导航菜单',
        r'个人工具',
        r'命名空间',
        r'变种',
        r'视图',
        r'操作',
        r'搜索',
        r'此页面最后编辑于.*',
        r'隐私政策',
        r'关于中华文库',
        r'免责声明',
        r'MediaWiki',
        r'手机版',
    ]
    for pattern in nav_patterns:
        text = re.sub(pattern, '', text)
    
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    
    # Remove image markers like ![alt](url)
    text = re.sub(r'!\[[^\]]*\]\([^\)]*\)', '', text)
    
    # Clean up excessive whitespace
    # Replace multiple blank lines with single blank line
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove trailing whitespace on each line
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
    
    # Remove leading whitespace (but preserve indentation for 命例 format)
    # Only remove completely blank lines' whitespace
    text = re.sub(r'^[ \t]+\n', '\n', text, flags=re.MULTILINE)
    
    return text.strip()


def extract_article_content(raw_text: str) -> str:
    """
    Extract the article content from a web_fetch result.
    web_fetch output format:
      URL: <url>
      Title: <title>
      
      <content>
      ---
      <actual article text>
    
    We want everything after the first --- separator.
    Also remove any trailing navigation/footer text.
    """
    lines = raw_text.split('\n')
    
    # Find the first --- separator (after URL and Title headers)
    content_start = 0
    for i, line in enumerate(lines):
        if line.strip() == '---':
            content_start = i + 1
            break
    
    # If no --- found, look for the article start
    if content_start == 0:
        # Try to find the first section header
        for i, line in enumerate(lines):
            if line.strip().startswith('#') or '天道' in line or '滴天髓' in line:
                content_start = i
                break
    
    content = '\n'.join(lines[content_start:])
    return content


def combine_segments(segments_dir: str, num_segments: int = 10) -> str:
    """Read and combine all segment files."""
    combined = []
    
    for i in range(num_segments):
        filepath = os.path.join(segments_dir, f'dt_seg_{i}.txt')
        if not os.path.exists(filepath):
            print(f"Warning: Missing segment {i}: {filepath}", file=sys.stderr)
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            raw = f.read()
        
        # Extract article content from web_fetch output
        article = extract_article_content(raw)
        
        if article.strip():
            combined.append(article)
    
    return '\n'.join(combined)


def validate_content(text: str) -> dict:
    """Validate the combined content quality."""
    stats = {}
    
    # Count 任氏曰 annotations
    stats['任氏曰_count'] = len(re.findall(r'任氏曰', text))
    stats['原注_count'] = len(re.findall(r'原注', text))
    
    # Check key sections
    required_sections = [
        # 通神论 (34 sections)
        '天道', '地道', '人道', '知命', '理气', '配合', '天干', '地支', '干支总论',
        '形象', '方局', '八格', '体用', '精神', '月令', '生时', '衰旺', '中和',
        '源流', '通关', '官杀', '伤官', '清气', '浊气', '真神', '假神',
        '刚柔', '顺逆', '寒暖', '燥湿', '隐显', '众寡', '震兑', '坎离',
        # 六亲论 (29 sections)
        '夫妻', '子女', '父母', '兄弟', '何知章', '女命章', '小儿', '才德',
        '奋郁', '恩怨', '闲神', '从象', '化象', '假从', '假化', '顺局', '反局',
        '战局', '合局', '君象', '臣象', '母象', '子象', '性情', '疾病',
        '出身', '地位', '岁运', '贞元',
    ]
    
    stats['sections_found'] = []
    stats['sections_missing'] = []
    for section in required_sections:
        if section in text:
            stats['sections_found'].append(section)
        else:
            stats['sections_missing'].append(section)
    
    stats['total_sections'] = len(required_sections)
    stats['found_sections'] = len(stats['sections_found'])
    stats['missing_sections'] = len(stats['sections_missing'])
    
    # Count four-pillar examples (命例) - patterns like 甲子 乙丑 丙寅 丁卯
    # Looking for patterns of 4 天干+地支 pairs
    pillar_pattern = r'[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]'
    pillars = re.findall(pillar_pattern, text)
    stats['four_pillar_refs'] = len(pillars)
    
    # File size stats
    stats['total_chars'] = len(text)
    stats['total_lines'] = text.count('\n')
    
    return stats


def main():
    parser = argparse.ArgumentParser(description='Clean and combine web_fetch segments')
    parser.add_argument('-d', '--dir', default='/tmp', help='Directory containing segment files')
    parser.add_argument('-o', '--output', help='Output file path')
    parser.add_argument('-n', '--num-segments', type=int, default=10, help='Number of segments')
    parser.add_argument('-v', '--validate', action='store_true', help='Validate content quality')
    args = parser.parse_args()
    
    # Combine segments
    print(f"Reading segments from {args.dir}...", file=sys.stderr)
    combined = combine_segments(args.dir, args.num_segments)
    print(f"Combined raw text: {len(combined)} chars", file=sys.stderr)
    
    # Clean the combined text
    cleaned = deep_clean(combined)
    print(f"Cleaned text: {len(cleaned)} chars", file=sys.stderr)
    
    # Validate if requested
    if args.validate:
        stats = validate_content(cleaned)
        print("\n=== Validation Results ===", file=sys.stderr)
        print(f"任氏曰 count: {stats['任氏曰_count']}", file=sys.stderr)
        print(f"原注 count: {stats['原注_count']}", file=sys.stderr)
        print(f"Sections found: {stats['found_sections']}/{stats['total_sections']}", file=sys.stderr)
        if stats['sections_missing']:
            print(f"Missing sections: {', '.join(stats['sections_missing'])}", file=sys.stderr)
        print(f"Four-pillar refs: {stats['four_pillar_refs']}", file=sys.stderr)
        print(f"Total chars: {stats['total_chars']}", file=sys.stderr)
        print(f"Total lines: {stats['total_lines']}", file=sys.stderr)
    
    # Output
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        print(f"Saved to {args.output} ({len(cleaned)} chars)", file=sys.stderr)
    else:
        print(cleaned)


if __name__ == '__main__':
    main()
