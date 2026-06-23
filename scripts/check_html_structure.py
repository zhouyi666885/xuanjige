#!/usr/bin/env python3
"""检查zhonghuashu.com页面HTML结构"""
import urllib.request

TARGET_URL = "https://www.zhonghuashu.com/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE"

req = urllib.request.Request(TARGET_URL, headers={
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Accept': 'text/html',
    'Accept-Encoding': 'identity',
})

with urllib.request.urlopen(req, timeout=60) as resp:
    raw = resp.read()

print(f"Total bytes: {len(raw)}")

# Save raw HTML for inspection
with open('/tmp/ditiantsui_raw.html', 'wb') as f:
    f.write(raw)

# Decode and show structure
html_text = raw.decode('utf-8', errors='replace')

# Find all div class names
import re
classes = re.findall(r'class="([^"]+)"', html_text)
unique_classes = set(classes)
print(f"\nFound {len(unique_classes)} unique class names")
for c in sorted(unique_classes):
    print(f"  .{c}")

# Find main content containers
print("\n--- Looking for content containers ---")
for tag in ['div', 'article', 'section', 'main']:
    matches = re.findall(f'<{tag}[^>]*class="([^"]*)"[^>]*>', html_text)
    if matches:
        print(f"\n<{tag}> classes:")
        for m in matches:
            print(f"  class={m}")

# Show first 2000 chars of body
body_match = re.search(r'<body[^>]*>(.*)', html_text, re.DOTALL)
if body_match:
    body = body_match.group(1)[:3000]
    print(f"\n--- First 3000 chars of body ---")
    print(body[:3000])
