# -*- coding: utf-8 -*-
"""分片拼装器。
每个页面 = 参数化 <head>（统一 SEO / OG / JSON-LD / favicon）+ 片段列表。
用法：python tools/build.py [页面 ...]   不带参数 = 构建全部。
约定：每页的「样式片段」须以 </head><body> 收尾；00-head.html 仅首页使用（已含 head）。"""
import io, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, '_parts')
SITE = 'https://www.xiaozhiserver.cloud/immune-guard/'
BRAND = '生命方程 · 免疫卫士'
FAVICON = ("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3E"
           "%3Crect%20width='24'%20height='24'%20rx='6'%20fill='%2310B981'/%3E%3Cpath%20d='M12%205l5.5%202v4c0%203.4-2.2%205.8-5.5%207.5"
           "C8.7%2016.8%206.5%2014.4%206.5%2011V7z'%20fill='none'%20stroke='white'%20stroke-width='1.5'%20stroke-linecap='round'"
           "%20stroke-linejoin='round'/%3E%3C/svg%3E")
def head(meta):
    path = meta['path']; url = SITE + path
    typ = meta.get('type', 'website')
    ld = {'@context': 'https://schema.org', '@type': typ, 'name': meta['title'], 'url': url,
          'inLanguage': 'zh-CN', 'description': meta['desc']}
    if meta.get('jsonld'): ld.update(meta['jsonld'])
    return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="keywords" content="{kw}">
<meta name="theme-color" content="#10B981">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_CN">
<meta property="og:site_name" content="{brand}">
<meta property="og:title" content="{ogt}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{fav}">
<link rel="stylesheet" href="assets/site.css">
<script type="application/ld+json">
{ld}
</script>
'''.format(title=meta['title'], desc=meta['desc'], kw=meta.get('kw', '免疫健康管理,AI健康助手,体检报告解读,智能戒指健康管理,HRV趋势,个人健康档案'),
           url=url, brand=BRAND, ogt=meta.get('og_title', meta['title']), site=SITE, fav=FAVICON, ld=json.dumps(ld, ensure_ascii=False, separators=(',', ':')))
PAGES = {
    'index': {'parts': ['00-head.html', '20-index-style.html', '10-nav.html',
                        '30-index-main1.html', '40-index-main2.html', '90-foot.html']},
    'download': {'meta': dict(path='download.html',
        title='下载免疫卫士 Android 版｜生命方程 · 免疫卫士',
        desc='下载免疫卫士 Android 版（v0.10.0）。页面实时读取最新版本号、安装包大小与 SHA-256 校验值，附系统要求、安装步骤与版本更新记录。iOS 版本尚未发布。',
        kw='免疫卫士下载,免疫卫士APK,健康管理App下载,Android健康App',
        og_title='下载免疫卫士 Android 版'), 'parts': ['20-download-style.html', '10-nav.html', '30-download-main.html', '50-download-script.html', '90-foot.html']},
    'features': {'meta': dict(path='features.html',
        title='产品功能｜免疫卫士 9 项功能与真实界面 · 生命方程',
        desc='逐项了解免疫卫士的 9 项功能：健康工作台、AI 助手小卫、体检报告解读、健康趋势、智能设备、隐私授权等。每项都标明是已上线、内测中还是即将推出，界面均为真实截图。',
        kw='免疫卫士功能,AI健康助手,体检报告解读,智能戒指,HRV趋势,健康档案,隐私授权,疲劳量表',
        og_title='免疫卫士 9 项功能，每一项都标明真实进度',
        jsonld={'@type': 'WebPage'}), 'parts': ['20-features-style.html', '10-nav.html', '30-features-main.html', '90-foot.html']},
    'growth': {'meta': dict(path='growth.html',
        title='健康成长中心｜免疫状态分、活力积分与 28 天赛季 · 免疫卫士',
        desc='了解免疫卫士的两套独立分值：反映数据趋势的免疫状态分，和记录健康行动的活力积分。含每日任务、5 个等级、6 枚徽章、28 天赛季与好友小队，并提供不连接账号的互动演示。',
        kw='免疫状态分,活力积分,健康任务,健康徽章,28天赛季,好友小队,健康管理游戏化',
        og_title='两套独立分值：一个看趋势，一个记行动'), 'parts': ['20-growth-style.html', '10-nav.html', '30-growth-main.html', '90-foot.html']},
    'guide': {'meta': dict(path='guide.html',
        title='新手指南｜7 步开始使用免疫卫士 · 生命方程',
        desc='从下载安装、连接智能戒指、上传体检报告，到和小卫对话、看懂趋势、管理隐私授权。7 篇图文教程，每一步都有真实界面截图和常见问题。',
        kw='免疫卫士教程,智能戒指配对,体检报告上传,AI健康助手使用,新手指南'), 'parts': ['20-guide-style.html', '10-nav.html', '30-guide-main.html', '90-foot.html']},
    'science': {'meta': dict(path='science.html',
        title='科学与安全｜免疫卫士的科学依据与医学边界 · 生命方程',
        desc='免疫卫士的评分依据是什么？HRV、睡眠、身体活动的参考标准来自哪里？8 个问题说清楚科学依据，4 张科普卡片引用审核文献，并明确说明何时应该就医。',
        kw='免疫健康管理科学依据,HRV参考标准,睡眠分期,AASM,WHO身体活动指南,健康管理医学边界',
        jsonld={'@type': 'WebPage', 'about': ['HealthApplication', 'MedicalWebPage']}), 'parts': ['20-science-style.html', '10-nav.html', '30-science-main.html', '90-foot.html']},
    'about': {'meta': dict(path='about.html',
        title='关于我们｜生命方程 · 免疫卫士 团队与合作',
        desc='了解生命方程与免疫卫士：我们为什么做这件事、团队构成、面向个人用户（ToC）与企业机构（ToB）的两种合作方式，以及如何联系我们。',
        kw='生命方程,免疫卫士团队,健康管理的公司,企业健康方案,合作咨询'), 'parts': ['20-about-style.html', '10-nav.html', '30-about-main.html', '90-foot.html']},
    'faq': {'meta': dict(path='faq.html',
        title='常见问题｜24 个关于免疫卫士的问答 · 生命方程',
        desc='关于免疫卫士的 24 个常见问题：它是什么、数据准不准、体检报告怎么上传、隐私怎么保护、戒指和手环支持情况、收费与退款等。',
        kw='免疫卫士常见问题,免疫卫士FAQ,健康管理App问答,体检报告解读问答',
        og_title='24 个常见问题，一次说清楚'), 'parts': ['20-faq-style.html', '10-nav.html', '30-faq-main.html', '90-foot.html']},
    'legal': {'meta': dict(path='legal.html',
        title='隐私与数据说明｜免疫卫士 · 生命方程',
        desc='免疫卫士如何处理你的健康数据：哪些数据在本机处理、哪些会上传、六类用途如何逐项授权与撤回、排行榜展示什么。正式隐私政策与用户协议仍在拟定中。',
        kw='免疫卫士隐私,健康数据安全,隐私授权,数据撤回,个保法',
        jsonld={'@type': 'WebPage'}), 'parts': ['20-legal-style.html', '10-nav.html', '30-legal-main.html', '90-foot.html']},
}
def build(name):
    cfg = PAGES[name]
    buf = []
    if cfg.get('meta'): buf.append(head(cfg['meta']).rstrip('\n'))
    for f in cfg['parts']:
        with io.open(os.path.join(P, f), encoding='utf-8') as fh: buf.append(fh.read().rstrip('\n'))
    html = '\n'.join(buf) + '\n'
    with io.open(os.path.join(ROOT, name + '.html'), 'w', encoding='utf-8', newline='\n') as fh: fh.write(html)
    print('built %-13s %6d bytes  <- %s' % (name + '.html', len(html.encode('utf-8')), ' + '.join(cfg['parts'])))
if __name__ == '__main__':
    for n in (sys.argv[1:] or list(PAGES)): build(n)
