import assert from 'node:assert/strict';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture(),checks=[];async function check(name,run){await run();checks.push(name);console.log('PASS public API: '+name);}
const api=(who,path,input,extra={})=>f.request(path,{method:input?'POST':'GET',headers:{...(who?{Cookie:f.cookies[who]}:{}),Origin:f.origin,'X-Bitacora-Request':'1','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.221',...extra},body:input?JSON.stringify(input):undefined});
let link,path;
try{
 const trade=f.journal.trades.find(t=>t.closedAt!==null),input={action:'create',tradeId:trade.id,tradeVersion:1,accountVersion:1,visibility:{},confirmed:true};
 await check('Identidad, confirmación, CSRF, BOLA y campos estrictos antes de crear',async()=>{
  for(const who of [null,'pending','suspended','expired','blocked'])assert.equal((await api(who,'/api/compartir',input)).status,who?403:401);
  assert.equal((await api('normal','/api/compartir',input,{Origin:'https://evil.test'})).status,403);
  for(const extra of [{confirmed:false},{snapshot:{pnl:999}},{userId:'google:owner'},{visibility:{account:true}}])assert.equal((await api('normal','/api/compartir',{...input,...extra})).status,422);
  assert.equal((await api('normal','/api/compartir',{...input,tradeId:crypto.randomUUID()})).status,404);
  assert.equal((await api('normal','/api/compartir',{...input,tradeVersion:999})).status,409);
  const r=await api('normal','/api/compartir',input);assert.equal(r.status,200,await r.clone().text());link=await r.json();path=new URL(link.url).pathname;
  assert.equal(link.expiresAt-link.createdAt,30*86400000);assert.equal((await(await api('owner','/api/compartir?trade='+trade.id)).json()).items.length,0);
 });
 await check('Página anónima solo snapshot; cabeceras de privacidad y sin panel ni identificadores',async()=>{
  const response=await f.request(path);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.match(response.headers.get('X-Robots-Tag'),/noindex.*noarchive/);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.ok(response.headers.get('Content-Security-Policy').includes("script-src-attr 'none'"));const html=await response.text();assert.ok(html.includes('Operación compartida'));assert.ok(html.includes(trade.asset));for(const secret of [trade.id,trade.accountId,'normal@example.test','Mis scripts','Resumen de trading','api/bitacora','sidebar'])assert.equal(html.includes(secret),false,'HTML público incluye '+secret);
  // Even an authenticated visitor sees the same snapshot, not their panel.
  assert.equal((await api('owner',path)).status,200);
  const invalid=await f.request('/p/invalid');assert.equal(invalid.status,404);assert.equal((await invalid.text()).includes('/entrar'),false);
 });
 await check('Mantenimiento reversible: lectura pública suspendida, creación bloqueada, revocación permitida',async()=>{
  assert.equal((await api('owner','/api/admin',{action:'maintenance',version:0,active:true,message:'Mantenimiento ficticio',until:null})).status,200);
  const blocked=await f.request(path);assert.equal(blocked.status,503);assert.equal((await blocked.text()).includes('/entrar'),false);
  assert.equal((await api('normal','/api/compartir',input)).status,503);assert.equal((await api('normal','/api/compartir',{action:'revoke',id:link.id})).status,200);
  assert.equal((await api('owner','/api/admin',{action:'maintenance',version:1,active:false,message:'',until:null})).status,200);
  const old=await f.request(path);assert.equal(old.status,404);assert.equal((await old.text()).includes('/entrar'),false);
 });
 await check('Límite IP nativo protege páginas públicas sin sesión y sin revelar el token',async()=>{
  let limited=false;
  for(let i=0;i<130;i++){const r=await f.request('/p/'+'Z'.repeat(43),{headers:{'CF-Connecting-IP':'198.51.100.222'}});if(r.status===429){limited=true;assert.equal(r.headers.get('Retry-After'),'60');const html=await r.text();assert.ok(html.includes('Espera un minuto'));assert.equal(html.includes('/entrar'),false);break;}assert.equal(r.status,404);}
  assert.equal(limited,true);
 });
 console.log('check-public-share-api: '+checks.length+' grupos aprobados; Worker compilado, D1 desechable y OAuth simulado. No producción.');
}finally{await f.dispose();}
