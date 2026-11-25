import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
import {reserveRateWindow} from './rate-window.mjs';
const f=await appFixture();let result;
try{
 const statuses=[];
 await reserveRateWindow();
 for(let i=0;i<65;i++){
  const r=await f.request('/api/bitacora',{headers:{Cookie:f.cookies.normal,'CF-Connecting-IP':'198.51.100.'+(i+1)}});
  statuses.push(r.status);if(r.status===429)assert.equal(r.headers.get('Retry-After'),'60');
 }
 assert.ok(statuses.includes(200));assert.ok(statuses.includes(429),'Cambiar de IP permite repetir 65 lecturas completas sin límite por usuario');
 const concurrent=await Promise.all(Array.from({length:8},(_,i)=>f.request('/api/bitacora?mode=metadata',{headers:{Cookie:f.cookies.normal,'CF-Connecting-IP':'203.0.113.'+(i+30)}})));for(const r of concurrent){assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');}
 assert.equal((await f.request('/api/bitacora?mode=metadata',{headers:{Cookie:f.cookies.owner,'CF-Connecting-IP':'203.0.113.10'}})).status,200,'Otro usuario conserva acceso');
 result={status:'passed',requests:statuses.length,allowed:statuses.filter(s=>s===200).length,limited:statuses.filter(s=>s===429).length};
}catch(error){result={status:'failed',error:error.message};process.exitCode=1;}
finally{await f.dispose();}
if(process.env.TRADEIFY_SECURITY_EVIDENCE){await mkdir(process.env.TRADEIFY_SECURITY_EVIDENCE,{recursive:true});await writeFile(process.env.TRADEIFY_SECURITY_EVIDENCE+'/user-abuse.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
