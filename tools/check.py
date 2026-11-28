# -*- coding: utf-8 -*-
"""静态校验：标签配对 / 乱码 / 坏属性 / 关键锚点与资源引用。返回非 0 即失败。"""
import io, os, re, sys
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
BAD_WORDS = ['garbled','marine-guard','bogus','corrupted','zh:image','undefined','NaN','[object',
             '内容因长度限制被截断','内部细节请见完整脚本目录','lorem','TODO','FIXME','XXX']
class Chk(HTMLParser):
    def __init__(s):
        HTMLParser.__init__(s, convert_charrefs=True); s.stack=[]; s.err=[]; s.ids={}
    def handle_starttag(s, tag, attrs):
        if tag in VOID: return
        s.stack.append((tag, s.getpos()))
        s._ids(attrs)
    def handle_startendtag(s, tag, attrs):
        s._ids(attrs)
    def _ids(s, attrs):
        for k, v in attrs:
            if k == 'id' and v: s.ids[v] = s.getpos()
    def handle_endtag(s, tag):
        if tag in VOID: return
        if not s.stack: s.err.append('多余闭合 </%s> @%s' % (tag, s.getpos())); return
        if s.stack[-1][0] == tag: s.stack.pop(); return
        names = [t for t, _ in s.stack]
        if tag in names:
            while s.stack and s.stack[-1][0] != tag:
                t, pos = s.stack.pop(); s.err.append('未闭合 <%s> @%s' % (t, pos))
            s.stack.pop()
        else: s.err.append('意外闭合 </%s> @%s' % (tag, s.getpos()))
def check(path):
    name = os.path.basename(path)
    src = io.open(path, encoding='utf-8').read()
    fails = []
    # 1 乱码
    # 普通词用子串匹配；NaN/undefined 这类需要用词边界，避免把 isNaN / undefinedVar 误判
    WORD_ONLY = {'NaN', 'undefined'}
    hits = [w for w in BAD_WORDS if (re.search(r'\b' + re.escape(w) + r'\b', src) if w in WORD_ONLY else w in src)]
    if hits: fails.append('乱码/占位词: %s' % hits)
    # 2 坏属性： ="..." 紧跟在已闭合属性后，或 " 之后直接跟 =字母
    for m in re.finditer(r'="\s*=\w*"', src) : fails.append('坏属性 @%d: %s' % (m.start(), src[max(0,m.start()-30):m.end()+5]))
    for m in re.finditer(r'<[^>]*?\s[\w-]+=""\s+[\w-]+\(=""', src): fails.append('空属性 @%d' % m.start())
    # 2b 同一标签内重复属性（如 aria-hidden 出现两次）
    for m in re.finditer(r'<[a-zA-Z][^<>]*>', src):
        keys = re.findall(r'\s([a-zA-Z-]+)="', m.group(0))
        dupk = sorted({k for k in keys if keys.count(k) > 1})
        if dupk: fails.append('重复属性 %s @%d: %s' % (dupk, m.start(), m.group(0)[:70]))
    # 2c 明显损坏的 SVG path（坐标异常长）
    for m in re.finditer(r'd="([^"]+)"', src):
        for tok in re.findall(r'-?\d+(?:\.\d+)?', m.group(1)):
            if abs(float(tok)) > 200: fails.append('path 坐标异常 @%d: %s' % (m.start(), m.group(1)[:50])); break
    # 3 标签配对
    c = Chk()
    try: c.feed(src); c.close()
    except Exception as e: fails.append('解析异常: %r' % e)
    for t, pos in c.stack: fails.append('未闭合 <%s> @%s' % (t, pos))
    fails.extend(c.err)
    # 4 结构
    low = src.lower()
    for need in ['<!doctype html>', '<title>', 'name="description"', 'rel="canonical"', 'assets/site.css', 'assets/site.js']:
        if need not in low: fails.append('缺少 ' + need)
    if low.count('<main') != 1 or low.count('</main>') != 1: fails.append('<main> 数量异常: %d/%d' % (low.count('<main'), low.count('</main>')))
    if low.count('<body') != 1 or low.count('</body>') != 1: fails.append('<body> 数量异常')
    if low.count('</head>') != 1: fails.append('</head> 数量异常: %d' % low.count('</head>'))
    # 5 锚点与资源
    hrefs = set(re.findall(r'href="#([\w-]+)"', src))
    missing_anchor = sorted(h for h in hrefs if h not in c.ids)
    if missing_anchor: fails.append('同页锚点无对应 id: %s' % missing_anchor)
    refs = set(re.findall(r'(?:src|href)="(assets/[^"#]+)"', src))
    for r in sorted(refs):
        if not os.path.exists(os.path.join(ROOT, r)): fails.append('资源不存在: ' + r)
    dup = [k for k, v in __import__('collections').Counter(
            re.findall(r'\sid="([^"]+)"', src)).items() if v > 1]
    if dup: fails.append('重复 id: %s' % dup)
    print(('PASS  ' if not fails else 'FAIL  ') + name)
    for f in fails: print('   - ' + f)
    return not fails
ok = True
for p in sys.argv[1:]: ok = check(p) and ok
sys.exit(0 if ok else 1)
