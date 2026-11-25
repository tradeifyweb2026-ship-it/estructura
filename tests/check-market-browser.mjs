import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
import sharp from 'sharp';
const {chromium}=await import(process.env.TRADEIFY_PLAYWRIGHT_MODULE??'playwright');
const out='outputs/market-browser';await mkdir(out,{recursive:true});
const f=await appFixture({browserServer:true}),browser=await chromium.launch({headless:true});
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),cases=[],consoleLog=[],requests=[];
const cdp=await context.newCDPSession(page);
// NO route interception/mocks for TradingView. Google alone is simulated by
// the disposable Worker fixture. Do not persist third-party bodies or quotes.
page.on('console',msg=>consoleLog.push({type:msg.type(),message:msg.text(),location:msg.location()}));
page.on('response',r=>{const u=new URL(r.url());if(u.origin!==f.origin)requests.push({origin:u.origin,path:u.pathname,status:r.status()});});
await page.addInitScript(()=>{globalThis.__cspIssues=[];document.addEventListener('securitypolicyviolation',e=>globalThis.__cspIssues.push({directive:e.effectiveDirective,blocked:e.blockedURI,source:e.sourceFile,line:e.lineNumber,column:e.columnNumber,disposition:e.disposition}));});
const cookie=f.cookies.normal;await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:f.origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
async function check(name,run){try{const evidence=await run();cases.push({name,status:'passed',evidence});}catch(error){cases.push({name,status:'failed',error:error.message});}await page.screenshot({path:out+'/'+name+'.png',fullPage:true});await writeFile(out+'/progreso.json',JSON.stringify(cases,null,2));}
async function widget(tag,{allowRestriction=false}={}){
 await page.locator(tag).waitFor({state:'visible',timeout:30000});
 assert.equal(await page.evaluate(tag=>Boolean(customElements.get(tag)),tag),true);
 // Official components use closed shadow roots. Inspect Chromium's native DOM
 // instead of treating an opaque JS root as an empty widget. No bypassCSP or
 // unsafe-eval allowance is needed for the debugger observations.
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  const {result}=await cdp.send('Runtime.evaluate',{expression:'document.querySelector('+JSON.stringify(tag)+')'});
  const {node}=await cdp.send('DOM.describeNode',{objectId:result.objectId,depth:-1,pierce:true});
  const signal={textCharacters:0,decimalTextNodes:0,integerNodes:0,analysisLabels:0,restricted:false,newsLinks:0,svgPaths:0,frames:[],frameTextCharacters:0};
  function inspect(n){if(['STYLE','SCRIPT','TEMPLATE'].includes(n.nodeName))return;if(n.nodeType===3){const t=(n.nodeValue??'').trim();signal.textCharacters+=t.length;if(/\d[.,]\d/.test(t))signal.decimalTextNodes++;if(/^\d{1,3}$/.test(t))signal.integerNodes++;if(/venta|compra|vender|comprar|neutral|\bbuy\b|\bsell\b/i.test(t))signal.analysisLabels++;if(/permiso denegado|permission denied|s[oó]lo est[aá] disponible en TradingView/i.test(t))signal.restricted=true;}if(n.nodeName.toLowerCase()==='path')signal.svgPaths++;const a=n.attributes??[],href=a.indexOf('href');if(n.nodeName==='A'&&href>=0&&a[href+1].includes('/news/'))signal.newsLinks++;if(n.nodeName==='IFRAME'){const i=a.indexOf('src');if(i>=0)signal.frames.push(a[i+1]);}for(const child of [...(n.children??[]),...(n.shadowRoots??[]),...(n.contentDocument?[n.contentDocument]:[])])inspect(child);}
  inspect(node);await cdp.send('Runtime.releaseObject',{objectId:result.objectId});
  const matchedFrames=[];
  for(const src of signal.frames){let url;try{url=new URL(src);}catch{continue;}for(const frame of page.frames())if(frame.url().startsWith(url.origin+url.pathname))try{signal.frameTextCharacters=Math.max(signal.frameTextCharacters,(await frame.locator('body').innerText({timeout:1000})).trim().length);matchedFrames.push(frame);}catch{}}
  assert.deepEqual(await page.evaluate(()=>globalThis.__cspIssues),[],'CSP bloqueó recursos del proveedor');
  if(signal.restricted&&allowRestriction)return {...signal,availability:'provider-restricted'};
  if(['tv-heatmap','tv-world-market-summary','tv-technical-analysis'].includes(tag)){
   // Maps paint into a canvas; compact technical analysis draws a gauge.
   // Require real colored chart pixels, and a recommendation label for analysis.
   // Text APIs cannot certify that a map
   // contains data. Count actual red/green data pixels from the native capture.
   const {data,info}=await sharp(await page.locator(tag).screenshot({animations:'disabled'})).removeAlpha().raw().toBuffer({resolveWithObject:true});
   let colored=0;for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2];if(r>60&&r>g*1.3&&r>b*1.3||g>60&&g>r*1.3&&g>b*1.3)colored++;}signal.coloredDataPixels=colored;
  }
  // Footer/branding text alone does not prove a loaded chart or heatmap.
  const ready=signal.restricted?false:signal.coloredDataPixels!==undefined?signal.coloredDataPixels>1000&&(tag!=='tv-technical-analysis'||signal.analysisLabels>=1):signal.frames.length?signal.frameTextCharacters>50:tag==='tv-news-feed'?signal.newsLinks>0:tag==='tv-economic-map'?signal.svgPaths>=50&&requests.some(r=>r.path==='/data/economic/global/gdp.json'&&r.status===200):signal.decimalTextNodes>=2;
  if(ready){for(const frame of matchedFrames)await frame.waitForLoadState('networkidle',{timeout:15000});signal.frames=signal.frames.map(src=>{const u=new URL(src);return u.origin+u.pathname;});return signal;}
  await page.waitForTimeout(350);
 }
 throw Error('El componente real no mostró contenido nativo ni un frame con contenido tras 30 segundos');
}
try{
 await page.goto(f.origin+'/#resumen');await page.locator('main h1').waitFor();const baseline=await page.evaluate(()=>globalThis.__cspIssues);await writeFile(out+'/csp-baseline.json',JSON.stringify(baseline,null,2));assert.deepEqual(baseline,[],'La aplicación emite violaciones CSP antes de cargar proveedores');
 await page.goto(f.origin+'/#mercados');await page.getByRole('tablist',{name:'Herramientas de mercados'}).waitFor();
 await page.getByRole('tab',{name:'Resumen',exact:true}).click();
 await check('resumen-real',()=>widget('tv-market-summary'));
 for(const [tab,tag]of [['Gráfico','tv-advanced-chart'],['Calendario','tv-economic-calendar'],['Noticias','tv-news-feed']])await check(tag+'-real',async()=>{await page.getByRole('tab',{name:tab,exact:true}).click();return widget(tag);});
 await page.getByRole('tab',{name:'Explorar',exact:true}).click();
 for(const tag of ['tv-heatmap','tv-forex-table','tv-technical-analysis','tv-market-data','tv-world-market-summary','tv-economic-map'])await check(tag+'-real',async()=>{
  await page.getByLabel('Vista de mercado').selectOption(tag);
  if(tag==='tv-technical-analysis'){
   const requested=await widget(tag,{allowRestriction:true});
   if(requested.restricted){const href=await page.getByRole('link',{name:'Abrir análisis técnico en TradingView',exact:true}).getAttribute('href');assert.equal(new URL(href).hostname,'www.tradingview.com');}
   // Do not substitute the user's symbol silently. Explicitly select a public
   // supported instrument through the UI and verify its analysis separately.
   await page.getByRole('button',{name:'Otro activo',exact:true}).click();await page.getByPlaceholder('Buscar por símbolo',{exact:true}).fill('NASDAQ:AAPL');await page.getByRole('button',{name:'Ver activo',exact:true}).click();
   return {requestedSymbol:requested,explicitApple:await widget(tag)};
  }
  return widget(tag);
 });
 await check('fundamentales-real',async()=>{await page.getByLabel('Vista de mercado').selectOption('financials');const iframe=page.locator('.market-widget-host iframe');await iframe.waitFor({state:'visible',timeout:30000});const frame=await(await iframe.elementHandle()).contentFrame();await frame.getByText(/Apple|AAPL/).first().waitFor({timeout:30000});assert.ok((await frame.locator('body').innerText()).length>100);assert.deepEqual(await page.evaluate(()=>globalThis.__cspIssues),[]);});
 await check('csp-bloquea-script-y-handler-inline',async()=>{
  await page.evaluate(()=>{globalThis.__cspIssues=[];globalThis.__attackExecuted=false;const s=document.createElement('script');s.textContent='globalThis.__attackExecuted=true';document.body.append(s);const b=document.createElement('button');b.setAttribute('onclick','globalThis.__attackExecuted=true');document.body.append(b);b.click();b.remove();});
  for(let i=0;i<20&&(await page.evaluate(()=>globalThis.__cspIssues.length))<2;i++)await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>globalThis.__cspIssues)).length,2);assert.equal(await page.evaluate(()=>globalThis.__attackExecuted),false);assert.ok((await page.evaluate(()=>globalThis.__cspIssues)).every(e=>e.blocked==='inline'));
 });
}finally{
 await writeFile(out+'/resultados.json',JSON.stringify({scope:'Chromium con proveedor TradingView real, app y Google ficticios. DOM/screenshot/HTTP prueban carga; no exactitud de precios ni OAuth de producción.',cases,requests,console:consoleLog},null,2));await context.close();await browser.close();await f.dispose();
}
assert.equal(cases.filter(c=>c.status==='failed').length,0,JSON.stringify(cases.filter(c=>c.status==='failed')));
