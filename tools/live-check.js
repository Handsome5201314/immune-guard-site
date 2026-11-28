// 线上验证：直接加载已部署站点，检查 console 错误、失败请求、横向溢出、破图。
const path=require('path');
const PW=require(path.resolve(__dirname,'../../../../05-App/node_modules/playwright-core'));
const BASE=process.env.BASE||'https://www.xiaozhiserver.cloud/immune-guard/';
const PAGES=(process.env.PAGES||'index.html,features.html,growth.html,guide.html,science.html,about.html,faq.html,legal.html,download.html').split(',');
const W=[[1440,900],[390,844]];
(async()=>{
 const b=await PW.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 let bad=0;
 for(const pg of PAGES) for(const [w,h] of W){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  const p=await ctx.newPage();
  const errs=[],failed=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
  p.on('pageerror',e=>errs.push('pageerror: '+e.message.slice(0,120)));
  p.on('response',r=>{if(r.status()>=400 && !r.url().includes('api.github.com'))failed.push(r.status()+' '+r.url().replace(BASE,''));});
  p.on('requestfailed',r=>{if(!r.url().includes('api.github.com'))failed.push('FAILED '+r.url().replace(BASE,''));});
  try{ await p.goto(BASE+pg,{waitUntil:'networkidle',timeout:45000}); }catch(e){ errs.push('goto: '+e.message.slice(0,80)); }
  await p.evaluate(()=>document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible')));
  const total=await p.evaluate(()=>document.documentElement.scrollHeight);
  for(let y=0;y<=total;y+=Math.trunc(h*0.7)){await p.evaluate(v=>window.scrollTo(0,v),y);await p.waitForTimeout(90);}
  await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await p.waitForTimeout(500);
  await p.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:6000}).catch(()=>{});
  const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
    broken:[...document.images].filter(i=>i.naturalWidth===0).map(i=>i.getAttribute('src'))}));
  const over=m.sw-m.cw;
  const fail=over>0||errs.length||failed.length||m.broken.length;
  if(fail)bad++;
  console.log((fail?'FAIL ':'ok   ')+pg+' @'+w+'  overflowX='+over+(errs.length?'  console:'+errs.join('|').slice(0,140):'')+(failed.length?'  failed:'+failed.join('|').slice(0,140):'')+(m.broken.length?'  broken:'+m.broken.join(','):''));
  await ctx.close();
 }
 await b.close();
 console.log(bad?('LIVE FAIL: '+bad):'LIVE PASS');
 process.exit(bad?1:0);
})();
