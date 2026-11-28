# -*- coding: utf-8 -*-
"""全站链接检查：页面文件存在 / 跨页锚点存在 / 资源文件存在 / 外链协议合理。"""
import io, os, re, sys
from collections import defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = [f for f in os.listdir(ROOT) if f.endswith('.html')]
ids = {}
for f in PAGES:
    src = io.open(os.path.join(ROOT, f), encoding='utf-8').read()
    ids[f] = set(re.findall(r'\sid="([^"]+)"', src))
bad = []
for f in sorted(PAGES):
    raw = io.open(os.path.join(ROOT, f), encoding='utf-8').read()
    # 排除 <script> 块：脚本里的字符串拼接不是真实链接
    src = re.sub(r'<script\b[^>]*>.*?</script>', '', raw, flags=re.S)
    for href in re.findall(r'href="([^"]+)"', src):
        if href.startswith(('http://','https://','mailto:','tel:','data:','javascript:')) or href == '#':
            continue
        if href.startswith('#'):
            target, anchor = f, href[1:]
        elif href.endswith('.html') or '.html#' in href:
            parts = href.split('#', 1)
            target = parts[0]
            anchor = parts[1] if len(parts) > 1 else None
            if not os.path.exists(os.path.join(ROOT, target)):
                bad.append((f, href, '页面不存在')); continue
        else:
            # 资源或其他文件
            if not os.path.exists(os.path.join(ROOT, href.split('#')[0])):
                bad.append((f, href, '文件不存在'))
            continue
        if anchor and target in ids and anchor not in ids[target]:
            bad.append((f, href, '锚点不存在于 %s' % target))
    for src_attr in re.findall(r'src="([^"]+)"', src):
        if src_attr.startswith(('http://','https://','data:')): continue
        if not os.path.exists(os.path.join(ROOT, src_attr)):
            bad.append((f, src_attr, '资源不存在'))
print('页面数: %d | 引用检查完成' % len(PAGES))
if bad:
    print('发现 %d 个问题:' % len(bad))
    for f, h, why in bad: print('  %-16s %-42s %s' % (f, h, why))
    sys.exit(1)
print('LINK CHECK PASS')
