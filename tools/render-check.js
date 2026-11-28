// 渲染检查：本地静态服务 + 多断点加载，收集 console 错误 / 失败请求 / 横向溢出，并截图。
// 用法：node tools/render-check.js <页面> [<页面> ...]
const path = require('path');
const fs = require('fs');
const http = require('http');
const PW = require(path.resolve(__dirname, '../../../../05-App/node_modules/playwright-core'));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, '_render');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const fp = path.join(ROOT, u);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
const W = [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 800]];
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await PW.chromium.launch({ executablePath: EDGE, headless: true });
  let bad = 0;
  for (const page of process.argv.slice(2)) {
    for (const [w, h] of W) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      const errs = [], failed = [];
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('pageerror', e => errs.push('pageerror: ' + e.message));
      p.on('requestfailed', r => failed.push(r.url() + ' ' + (r.failure() || {}).errorText));
      p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
      await p.goto(base + page, { waitUntil: 'networkidle' });
      await p.evaluate(() => { document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible')); });
      await p.waitForTimeout(350);
      /* 懒加载图片在视口外不会请求：在 Node 侧逐屏滚动（每屏停留），让浏览器真正触发加载，
         再等所有图片完成（最多 4 秒）。避免把 lazy 误判为破图。 */
      const total = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= total; y += Math.trunc(h * 0.7)) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(120); }
      /* 滚到底后要多停留，给 IntersectionObserver 触发最后几张图；并且「在底部」等加载完再回顶，
         否则图片刚进视口就被滚走，请求可能永远不发出。 */
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(600);
      await p.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(200);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(150);
      const m = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        sh: document.documentElement.scrollHeight,
        h1: (document.querySelector('h1') || {}).textContent,
        title: document.title,
        imgs: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'))
      }));
      const over = m.sw - m.cw;
      const shot = path.join(OUT, page.replace('.html', '') + '-' + w + '.png');
      await p.screenshot({ path: shot, fullPage: true });
      const flag = (over > 0 || errs.length || failed.length || m.imgs.length) ? 'FAIL' : 'ok  ';
      if (flag === 'FAIL') bad++;
      console.log(flag + ' ' + page + ' @' + w + 'x' + h + '  height=' + m.sh + ' overflowX=' + over +
        (errs.length ? '\n     console: ' + errs.join(' | ') : '') +
        (failed.length ? '\n     failed: ' + failed.join(' | ') : '') +
        (m.imgs.length ? '\n     broken img: ' + m.imgs.join(', ') : ''));
      await ctx.close();
    }
  }
  await browser.close(); server.close();
  console.log(bad ? ('RENDER FAIL: ' + bad) : 'RENDER PASS');
  process.exit(bad ? 1 : 0);
})();
