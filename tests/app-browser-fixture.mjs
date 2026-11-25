import {createServer} from 'node:https';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {exampleJournal} from '../lib/demo.ts';
import {dayKey} from '../lib/journal.ts';

// Test-only host. Nothing in this file is imported into the published Worker.
export async function appFixture({browserServer=false,buildDirectory='dist'}={}){
 let origin='https://tradeify.example.test',httpsServer,temp;
 if(browserServer){
  temp=await mkdtemp(path.join(tmpdir(),'tradeify-disposable-tls-'));const key=path.join(temp,'key.pem'),cert=path.join(temp,'cert.pem');
  const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});if(generated.status!==0)throw Error('No se pudo crear el certificado efímero de prueba.');
  httpsServer=createServer({key:await readFile(key),cert:await readFile(cert)},async(incoming,outgoing)=>{
   try{const chunks=[];for await(const chunk of incoming)chunks.push(chunk);const headers=new Headers();for(const [name,value]of Object.entries(incoming.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);
    const response=await resource(origin+incoming.url,{method:incoming.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
    outgoing.statusCode=response.status;for(const [name,value]of response.headers)if(name!=='set-cookie')outgoing.setHeader(name,value);const cookies=response.headers.getSetCookie();if(cookies.length)outgoing.setHeader('Set-Cookie',cookies);outgoing.end(Buffer.from(await response.arrayBuffer()));
   }catch{outgoing.statusCode=500;outgoing.end('Fallo del servidor aislado de prueba');}
  });await new Promise(resolve=>httpsServer.listen(0,'127.0.0.1',resolve));origin='https://127.0.0.1:'+httpsServer.address().port;
 }
 const server=path.resolve(buildDirectory,'server'),client=path.resolve(buildDirectory,'client');
 const config=JSON.parse(await readFile(path.join(server,'wrangler.json'),'utf8'));
 const files=(await readdir(server,{recursive:true})).filter(f=>/\.m?js$/.test(f)&&f!==config.main);
 const mf=new Miniflare(convertV4MiniflareOptions({name:'tradeify-ui-fixture',modules:[config.main,...files].map(f=>({type:'ESModule',path:path.join(server,f)})),modulesRoot:server,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:{DB:'ui-disposable'},r2Buckets:{BUCKET:'ui-disposable'},ratelimits:Object.fromEntries((config.ratelimits??[]).map(({name,namespace_id,simple})=>[name,{namespace_id,simple}])),bindings:{TRADEIFY_ORIGIN:origin,TRADEIFY_OWNER_EMAIL:'owner@example.test',TRADEIFY_GOOGLE_CLIENT_ID:'fixture',TRADEIFY_GOOGLE_CLIENT_SECRET:'fixture-not-real',TRADEIFY_SESSION_SECRET:'fixture-only-disposable-session-secret-0000'},outboundService:async request=>{
  const u=new URL(request.url);
  if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:new URLSearchParams(await request.text()).get('code')});
  if(u.hostname==='openidconnect.googleapis.com'){const who=request.headers.get('authorization').slice(7);return Response.json({sub:who,email:who+'@example.test',email_verified:true});}
  throw Error('Unexpected outbound fixture request '+u.hostname);
 },cf:false}));
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.batch((await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 async function login(who,ip){const begin=await mf.dispatchFetch(origin+'/entrar',{headers:ip?{'CF-Connecting-IP':ip}:{},redirect:'manual'}),state=new URL(begin.headers.get('location')).searchParams.get('state'),cookie=begin.headers.get('set-cookie').split(';')[0];const end=await mf.dispatchFetch(origin+'/oauth/google/callback?state='+state+'&code='+who,{headers:{Cookie:cookie,...(ip?{'CF-Connecting-IP':ip}:{})},redirect:'manual'});const value=end.headers.getSetCookie().find(v=>v.startsWith('__Host-tradeify-session=')).split(';')[0];return value;}
 const cookies={};for(const who of ['owner','normal','pending','suspended','expired','blocked'])cookies[who]=await login(who);
 for(const status of ['pending','suspended','blocked'])await db.prepare('UPDATE users SET status=? WHERE user_id=?').bind(status,'google:'+status).run();
 await db.prepare('UPDATE users SET access_until=? WHERE user_id=?').bind(Date.now()-1000,'google:expired').run();
 const journal=exampleJournal(dayKey(Date.now()));
 journal.accounts.push({...journal.accounts[0],id:crypto.randomUUID(),name:'Fixture EUR',currency:'EUR'});
 journal.trades.push({...journal.trades[0],id:crypto.randomUUID(),openedAt:Date.now()-60000,closedAt:null,exit:null,pnlCents:null,partials:[{price:journal.trades[0].entry+10,percent:25,at:Date.now()-30000,pnlCents:100}],currentStop:journal.trades[0].entry});
 for(const who of ['normal','owner']){
  const user='google:'+who;
  for(const a of journal.accounts)await db.prepare('INSERT INTO accounts(user_id,id,version,data) VALUES (?,?,1,?)').bind(user,a.id,JSON.stringify(a)).run();
  for(const s of journal.setups)await db.prepare('INSERT INTO setups(user_id,id,version,data) VALUES (?,?,1,?)').bind(user,s.id,JSON.stringify(s)).run();
  for(const t of journal.trades)await db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,?,?,?)').bind(user,t.id,t.openedAt,t.accountId,t.setupId,JSON.stringify(t)).run();
 }
 for(const who of ['normal','owner'])for(const [week,scope] of [['2026-11-16','all'],['month:2026-11','all']])await db.prepare('INSERT INTO reviews(user_id,week,scope,version,data) VALUES (?,?,?,1,?)').bind('google:'+who,week,scope,JSON.stringify({followed:'Reflexión ficticia',repeat:'Revisar proceso',change:'Registrar contexto'})).run();
 let visualClient=0;
 async function visualUser(who){
  cookies[who]=await login(who,'203.0.113.'+(20+visualClient++));
  await db.batch([
   db.prepare('INSERT INTO accounts SELECT ?,id,version,data FROM accounts WHERE user_id=?').bind('google:'+who,'google:normal'),
   db.prepare('INSERT INTO setups SELECT ?,id,version,data FROM setups WHERE user_id=?').bind('google:'+who,'google:normal'),
   db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,import_key,data) SELECT ?,id,version,opened_at,account_id,setup_id,import_key,data FROM trades WHERE user_id=?').bind('google:'+who,'google:normal'),
   db.prepare('INSERT INTO reviews SELECT ?,week,scope,version,data FROM reviews WHERE user_id=?').bind('google:'+who,'google:normal'),
  ]);
  return cookies[who];
 }
 const mime={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
 async function resource(url,options){const u=new URL(url),file=path.resolve(client,'.'+decodeURIComponent(u.pathname));if(file.startsWith(client+path.sep))try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]??'application/octet-stream'}});}catch{}return mf.dispatchFetch(url,{...options,redirect:'manual'});}
 async function route(route){const request=route.request(),u=new URL(request.url());
  if(u.origin!==origin){await route.fulfill({status:200,contentType:'text/html',body:'<p>Proveedor externo simulado, no certificado</p>'});return;}
  if(browserServer){await route.continue();return;}
  const file=path.resolve(client,'.'+decodeURIComponent(u.pathname));
  if(file.startsWith(client+path.sep))try{const bytes=await readFile(file);await route.fulfill({status:200,contentType:mime[path.extname(file)]??'application/octet-stream',body:bytes});return;}catch{}
  const response=await mf.dispatchFetch(request.url(),{method:request.method(),headers:await request.allHeaders(),body:request.postDataBuffer()??undefined,redirect:'manual'});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 }
 return {origin,db,visualUser,bucket:await mf.getR2Bucket('BUCKET'),journal,cookies,route,request:(pathname,options={})=>mf.dispatchFetch(origin+pathname,{redirect:'manual',...options}),dispose:async()=>{await mf.dispose();if(httpsServer){httpsServer.closeAllConnections();await new Promise(resolve=>httpsServer.close(resolve));}if(temp)await rm(temp,{recursive:true,force:true});}};
}
