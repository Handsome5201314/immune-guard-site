// 布局探针：针对具体元素做几何检查（越界 / 重叠 / 被裁切）。
const path = require('path'), fs = require('fs'), http = require('http');
const PW = require(path.resolve(__dirname, '../../../../05-App/node_modules/playwright-core'));
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const fp = path.join(ROOT, u);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await PW.chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const W = [[1440, 900], [1024, 768], [390, 844], [360, 800]];
  for (const w of W) {
    const ctx = await browser.newContext({ viewport: { width: w[0], height: w[1] } });
    const p = await ctx.newPage();
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const R = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height), disp: getComputedStyle(e).display }; };
      const ov = (a, b) => a && b && a.disp !== 'none' && b.disp !== 'none' && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const vw = document.documentElement.clientWidth;
      const out = { vw, hero: R('.hero-grid'), h1: R('.hero-copy h1'), ip: R('.hv-ip'), phone: R('.hv-phone'), cta: R('.hero-actions'),
        chipA: R('.hv-chip-a'), chipB: R('.hv-chip-b'), chipC: R('.hv-chip-c') };
      out.overlaps = { 'ip-phone': ov(out.ip, out.phone), 'chipA-phone': ov(out.chipA, out.phone), 'chipB-phone': ov(out.chipB, out.phone), 'chipC-phone': ov(out.chipC, out.phone), 'chipA-ip': ov(out.chipA, out.ip), 'chipC-ip': ov(out.chipC, out.ip) };
      out.offscreen = Object.keys(out).filter(k => { const b = out[k]; return b && b.l !== undefined && (b.r > vw + 1 || b.l < -1); });
      return out;
    });
    const cls = r.hero && r.hero.t !== undefined ? '' : '';
    const detail = ['ip','phone','chipA','chipB','chipC'].map(k => k + '[' + (r[k].disp==='none'?'hidden':r[k].l+'..'+r[k].r+' / '+r[k].t+'..'+r[k].b) + ']').join(' '); console.log('     ' + detail); console.log('@' + w[0] + '  vw=' + r.vw + '  h1.w=' + r.h1.w + '  ip=' + r.ip.w + 'x' + r.ip.h + '  phone=' + (r.phone.disp === 'none' ? 'hidden' : r.phone.w + 'x' + r.phone.h) +
      '  cta.w=' + r.cta.w + '\n     overlaps=' + JSON.stringify(r.overlaps) + '  offscreen=' + JSON.stringify(r.offscreen));
    await ctx.close();
  }
  await browser.close(); server.close();
})();
