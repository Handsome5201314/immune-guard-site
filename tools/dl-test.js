// 下载页功能测试：确认版本号/大小/日期/校验值/更新记录被脚本正确填充。
const path=require('path'),fs=require('fs'),http=require('http');
const PW=require(path.resolve(__dirname,'../../../../05-App/node_modules/playwright-core'));
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';
 const fp=path.join(ROOT,u); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(fp).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await PW.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await b.newContext({viewport:{width:1280,height:900}});
 const p=await ctx.newPage(); const errs=[];
 p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 // 阻断外部请求（GitHub API / 资源），验证同域 version.json 降级路径
 await p.route('**://api.github.com/**', r=>r.abort());
 await p.goto('http://127.0.0.1:'+server.address().port+'/download.html',{waitUntil:'networkidle'});
 await p.waitForTimeout(1200);
 const g=async id=>{const e=await p.$('#'+id); return e? (await e.textContent()).trim() : '(missing)';};
 for(const id of ['vc-ver','vc-size','vc-published','vc-downloads','vc-hash','meta-size','meta-date','log-state']) console.log('  '+id.padEnd(14), JSON.stringify(await g(id)));
 const rel=await p.$$eval('#release-list .release',e=>e.length);
 console.log('  releases rendered:', rel);
 const href=await p.getAttribute('#dl-primary','href');
 console.log('  dl-primary href:', href);
 console.log('  pageerrors:', errs.length? errs.join(' | ') : 'none');
 await b.close();server.close();
})();
