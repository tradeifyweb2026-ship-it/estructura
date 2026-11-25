import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
import {reserveRateWindow} from './rate-window.mjs';

const f=await appFixture(),results=[];
const output=process.env.TRADEIFY_SECURITY_EVIDENCE;
const nested=Array.from({length:64}).reduce(value=>({nested:value}),0);
async function check(name,run){try{await run();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.message});}}
const post=(path,input,ip='198.51.100.79')=>f.request(path,{method:'POST',headers:{Cookie:f.cookies.normal,Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1','CF-Connecting-IP':ip},body:JSON.stringify(input)});
try{
 await reserveRateWindow();
 await check('Estado público comparte el limitador API, incluso sin sesión',async()=>{const statuses=[];for(let i=0;i<125;i++){const r=await f.request('/api/estado',{headers:{'CF-Connecting-IP':'198.51.100.78'}});statuses.push(r.status);if(r.status===429){assert.equal(r.headers.get('Retry-After'),'60');assert.match(r.headers.get('Cache-Control'),/no-store/);}}assert.ok(statuses.includes(200));assert.ok(statuses.includes(429),'125 solicitudes públicas no recibieron ningún 429');assert.equal((await f.request('/api/frases',{headers:{'CF-Connecting-IP':'198.51.100.78'}})).status,429);assert.equal((await f.request('/api/estado',{headers:{'CF-Connecting-IP':'198.51.100.80'}})).status,200);});
 await check('Mi cuenta rechaza más de 16 KiB antes de interpretar acciones',async()=>{assert.equal((await post('/api/mi-cuenta',{action:'invalid',padding:'x'.repeat(20000)})).status,413);assert.equal((await post('/api/mi-cuenta',{action:'invalid'})).status,422);});
 await check('Mi cuenta exige JSON y conserva la sesión ante rechazo',async()=>{const r=await f.request('/api/mi-cuenta',{method:'POST',headers:{Cookie:f.cookies.normal,Origin:f.origin,'Content-Type':'text/plain','X-Bitacora-Request':'1'},body:'{"action":"invalid"}'});assert.equal(r.status,415);assert.equal((await f.request('/api/bitacora?mode=metadata',{headers:{Cookie:f.cookies.normal}})).status,200);});
 await check('Frases conserva el estado HTTP 413 de su límite de bytes',async()=>{assert.equal((await post('/api/frases',{action:'favorite',id:100001,saved:true,padding:'x'.repeat(17000)})).status,413);});
 await check('Frases rechaza profundidad excesiva, incluso en campos descartados por Zod',async()=>{assert.equal((await post('/api/frases',{action:'favorite',id:100001,saved:true,padding:nested})).status,422);});
 await check('Bitácora rechaza profundidad excesiva antes de validar y no cambia datos',async()=>{const before=await f.db.prepare('SELECT count(*) n FROM trades').first('n');assert.equal((await post('/api/bitacora',{action:'invalid',padding:nested})).status,422);assert.equal(await f.db.prepare('SELECT count(*) n FROM trades').first('n'),before);});
 await check('Cuerpos pequeños válidos, llaves dentro de texto y JSON malformado',async()=>{assert.equal((await post('/api/frases',{action:'favorite',id:100001,saved:true,padding:'{'.repeat(100)+'\\"'})).status,200);const r=await f.request('/api/bitacora',{method:'POST',headers:{Cookie:f.cookies.normal,Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:'{"action":'});assert.equal(r.status,400);});
}finally{await f.dispose();}
const report={scope:'Worker compilado y D1/R2 desechables; Google simulado; sin producción',results};
if(output){await mkdir(output,{recursive:true});await writeFile(output+'/boundaries.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));process.exitCode=results.some(r=>r.status==='failed')?1:0;
