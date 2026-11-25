import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {exampleJournal} from '../lib/demo.ts';
import {tradeSchema} from '../lib/journal.ts';
import {assetGroups} from '../lib/stats.ts';
import {exportTrades,previewImport} from '../lib/csv.ts';
import {assetBackupSchema,assetAction,suggestedMarketSymbols} from '../lib/asset-catalog.ts';
await mkdir('work',{recursive:true});const output=resolve('work/assets-test.mjs');await build({stdin:{contents:"export * from './db/asset-catalog.ts'; export * from './db/journal-query.ts';",resolveDir:process.cwd(),sourcefile:'assets-test-entry.ts'},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {listAssets,mutateAsset,previewAssociation,queryAnalytics,queryTradePage}=await import(pathToFileURL(output));const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('fixture')}}",d1Databases:{DB:'assets-disposable'},cf:false}));
const checks=[];async function check(name,job){await job();checks.push(name);}
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.batch((await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 for(const u of ['asset-a','asset-b'])await db.prepare('INSERT INTO users(user_id,email,created_at,last_login) VALUES (?,?,0,0)').bind(u,u+'@example.test').run();
 const params=v=>new URLSearchParams(v),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();
 await check('Catálogo vacío: no crea activos ni asigna alias automáticamente',async()=>{assert.deepEqual((await listAssets(db,'asset-a',params())).items,[]);assert.deepEqual(suggestedMarketSymbols(['MNQ']),['NAS100','US100','USTEC','NQ','MNQ']);assert.equal((await listAssets(db,'asset-a',params())).total,0);});
 await check('Normalización, duplicados internos y asignación masiva rechazados',async()=>{assert.equal(assetAction.safeParse({action:'save',id:a,version:null,userId:'asset-b',asset:{name:'NASDAQ 100',aliases:[]}}).success,false);assert.equal(assetAction.safeParse({action:'save',id:a,version:null,asset:{name:'NASDAQ 100',aliases:['NQ','nq']}}).success,false);assert.equal(assetAction.safeParse({action:'save',id:a,version:null,asset:{name:'NASDAQ 100',aliases:['javascript:alert(1)']}}).success,false);});
 await check('CRUD privado, búsqueda por nombre/alias y favorito',async()=>{const x=await mutateAsset(db,'asset-a',{action:'save',id:a,version:null,asset:{name:'Índice Nasdaq',aliases:['NAS100','NQ'],favorite:true}},100);assert.equal(x.asset.version,1);assert.equal((await listAssets(db,'asset-a',params({q:'indice'}))).total,1);assert.equal((await listAssets(db,'asset-a',params({q:'nq',favorites:'1'}))).items[0].id,a);assert.equal((await listAssets(db,'asset-b',params())).total,0);});
 await check('Aislamiento: otro usuario puede usar el mismo alias, sin leer ni editar registros ajenos',async()=>{await mutateAsset(db,'asset-b',{action:'save',id:b,version:null,asset:{name:'Privado B',aliases:['NQ'],favorite:false}});await assert.rejects(mutateAsset(db,'asset-a',{action:'save',id:b,version:1,asset:{name:'No autorizado',aliases:[],favorite:false}}),e=>e.status===409);assert.equal((await listAssets(db,'asset-b',params())).items[0].name,'Privado B');});
 await check('Colisión de alias revierte nombre, versión y todos los símbolos del lote',async()=>{await mutateAsset(db,'asset-a',{action:'save',id:c,version:null,asset:{name:'Otro mercado',aliases:['OTHER'],favorite:false}});await assert.rejects(mutateAsset(db,'asset-a',{action:'save',id:c,version:1,asset:{name:'Cambio no confirmado',aliases:['OTHER','NQ'],favorite:false}}),e=>e.status===409);const x=(await listAssets(db,'asset-a',params({q:'OTHER'}))).items[0];assert.equal(x.version,1);assert.equal(x.name,'Otro mercado');assert.deepEqual(x.aliases,['OTHER']);});
 await check('Versiones concurrentes, nombres normalizados y paginación consistente',async()=>{const first=await listAssets(db,'asset-a',params({size:'1'}));assert.equal(first.next,true);const second=await listAssets(db,'asset-a',params({size:'1',page:'1',revision:String(first.revision)}));assert.notEqual(first.items[0].id,second.items[0].id);await mutateAsset(db,'asset-a',{action:'save',id:a,version:1,asset:{name:'NASDAQ 100',aliases:['NAS100','NQ','MNQ'],favorite:false}});await assert.rejects(listAssets(db,'asset-a',params({size:'1',page:'1',revision:String(first.revision)})),e=>e.status===409);await assert.rejects(mutateAsset(db,'asset-a',{action:'delete',id:a,version:1}),e=>e.status===409);await assert.rejects(mutateAsset(db,'asset-a',{action:'save',id:crypto.randomUUID(),version:null,asset:{name:'nasdaq 100',aliases:[],favorite:false}}),e=>e.status===409);await assert.rejects(listAssets(db,'asset-a',params({page:'1'})),e=>e.status===422);});
 await check('Asociación explícita, concurrencia y conservación financiera exacta',async()=>{
  const sample=exampleJournal('2026-11-22'),ids=[],before=[];
  for(const symbol of ['NAS100','NQ','MNQ']){
   const t={...sample.trades.find(t=>t.closedAt!==null),id:crypto.randomUUID(),version:1,asset:symbol,accountId:null,setupId:null};ids.push(t.id);
   const {id,openedAt}=t,fields={...t};for(const key of ['id','version','openedAt','accountId','setupId'])delete fields[key];const data=JSON.stringify(fields);before.push(data);
   await db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,NULL,NULL,?)').bind('asset-a',id,openedAt,data).run();
  }
  const totalBefore=await queryAnalytics(db,'asset-a',{scope:'all',q:'',sort:'latest'},undefined,true);
  let p=await previewAssociation(db,'asset-a',params({id:a}));assert.equal(p.total,3);assert.equal(assetAction.safeParse({action:'associate',id:a,version:p.asset.version,revision:p.revision,confirm:false,trades:p.items}).success,false);
  await assert.rejects(mutateAsset(db,'asset-a',{action:'associate',id:a,version:p.asset.version,revision:p.revision,confirm:true,trades:[p.items[0],{id:crypto.randomUUID(),version:1}]}),e=>e.status===409);
  assert.equal(await db.prepare("SELECT count(*) n FROM trades WHERE user_id='asset-a' AND json_extract(data,'$.market.id') IS NOT NULL").first('n'),0);
  await mutateAsset(db,'asset-a',{action:'save',id:c,version:1,asset:{name:'Otro mercado',aliases:['OTHER'],favorite:true}});
  await assert.rejects(mutateAsset(db,'asset-a',{action:'associate',id:a,version:p.asset.version,revision:p.revision,confirm:true,trades:p.items.map(({id,version})=>({id,version}))}),e=>e.status===409);
  p=await previewAssociation(db,'asset-a',params({id:a}));await mutateAsset(db,'asset-a',{action:'associate',id:a,version:p.asset.version,revision:p.revision,confirm:true,trades:p.items.map(({id,version})=>({id,version}))});
  const trades=[];for(let i=0;i<ids.length;i++){const row=await db.prepare('SELECT * FROM trades WHERE user_id=? AND id=?').bind('asset-a',ids[i]).first(),data=JSON.parse(row.data),market=data.market;delete data.market;assert.deepEqual(data,JSON.parse(before[i]));assert.equal(row.version,2);trades.push({...data,market,id:row.id,version:row.version,openedAt:row.opened_at,accountId:null,setupId:null});}
  const grouped=await queryAnalytics(db,'asset-a',{scope:'all',q:'',sort:'latest'},undefined,true);assert.deepEqual(grouped.summary,totalBefore.summary);const marketGroups=grouped.groups.filter(g=>g.kind==='asset');assert.equal(marketGroups.length,1);assert.equal(marketGroups[0].label,'NASDAQ 100');assert.equal(marketGroups[0].count,3);const filtered=await queryAnalytics(db,'asset-a',{scope:'all',q:'',sort:'latest',asset:'market:'+a});assert.equal(filtered.summary.closed,3);
  assert.equal(assetGroups(trades).length,1);assert.equal(assetGroups(trades)[0].count,3);assert.equal((await previewAssociation(db,'asset-a',params({id:a}))).total,0);
  for(const t of trades)assert.equal(tradeSchema.safeParse(t).success,true);
  const account=sample.accounts[0];const csv=exportTrades(trades,{...sample,trades});const restored=await previewImport(csv,account);assert.equal(restored.invalid.length,0);assert.ok(restored.valid.every(r=>r.trade.market.id===a));
  await mutateAsset(db,'asset-a',{action:'save',id:a,version:2,asset:{name:'NASDAQ 100 personal',aliases:['NAS100','NQ','MNQ'],favorite:false}});
  const renamed=await queryAnalytics(db,'asset-a',{scope:'all',q:'',sort:'latest'},undefined,true);assert.equal(renamed.groups.find(g=>g.kind==='asset').label,'NASDAQ 100 personal');assert.deepEqual(renamed.summary,totalBefore.summary);
  await assert.rejects(mutateAsset(db,'asset-a',{action:'delete',id:a,version:3}),e=>e.status===409);
 });
 await check('Mil operaciones asociadas: páginas sin pérdidas/duplicados, filtros y totales completos',async()=>{
  const sample=exampleJournal('2026-11-22').trades.find(t=>t.closedAt!==null),q={scope:'all',q:'',sort:'oldest',asset:'market:'+a},previous=await queryAnalytics(db,'asset-a',q),base=Date.parse('2026-10-01T12:00:00Z');
  for(let offset=0;offset<1000;offset+=20)await db.batch(Array.from({length:20},(_,j)=>{const n=offset+j,t={...sample,asset:['NQ','MNQ','NAS100'][n%3],entry:100,stop:99,exit:101,direction:'long',pnlCents:100,riskCents:100,partials:[],openedAt:base+n*1000,closedAt:base+n*1000+500,accountId:null,setupId:null,market:{id:a,name:'NASDAQ 100 personal'}};const {openedAt,...data}=t;return db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,NULL,NULL,?)').bind('asset-a',crypto.randomUUID(),openedAt,JSON.stringify(data));}));
  const all=await queryAnalytics(db,'asset-a',q);assert.equal(all.summary.closed,previous.summary.closed+1000);assert.equal(all.summary.totalR,previous.summary.totalR+1000);assert.equal(all.summary.cash,previous.summary.cash+100000);
  const ids=new Set();let cursor;do{const page=await queryTradePage(db,'asset-a',q,{size:200,cursor});for(const t of page.trades){assert.ok(!ids.has(t.id));ids.add(t.id);assert.ok(['NQ','MNQ','NAS100'].includes(t.asset));assert.equal(t.market.name,'NASDAQ 100 personal');}cursor=page.next??undefined;}while(cursor);assert.equal(ids.size,all.summary.closed);
 });
 await check('Respaldo privado: repetición idempotente sin sobrescribir ni duplicar símbolos',async()=>{
  const id=crypto.randomUUID(),asset={name:'Restaurado',aliases:['RESTORED'],favorite:true},input={action:'restore',id,asset};assert.equal(assetBackupSchema.safeParse({app:'tradeify-assets',format:1,assets:[{id,asset}]}).success,true);assert.equal(assetBackupSchema.safeParse({app:'tradeify-assets',format:1,assets:[{id,asset},{id,asset}]}).success,false);
  await mutateAsset(db,'asset-a',input);assert.equal((await mutateAsset(db,'asset-a',input)).skipped,true);
  await assert.rejects(mutateAsset(db,'asset-a',{...input,asset:{...asset,name:'No sobrescribir'}}),e=>e.status===409);
 });
 await check('Borrado de activo y eliminación de usuario limpian alias con FK',async()=>{await mutateAsset(db,'asset-a',{action:'delete',id:c,version:2});assert.equal((await listAssets(db,'asset-a',params({q:'OTHER'}))).total,0);await db.batch([db.prepare('DELETE FROM journal_revisions WHERE user_id=?').bind('asset-b'),db.prepare('DELETE FROM users WHERE user_id=?').bind('asset-b')]);assert.equal((await listAssets(db,'asset-b',params())).total,0);assert.equal(await db.prepare('SELECT count(*) n FROM journal_revisions WHERE user_id=?').bind('asset-b').first('n'),0);assert.equal(await db.prepare('SELECT count(*) n FROM asset_aliases WHERE user_id=?').bind('asset-b').first('n'),0);assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);});
 console.log(JSON.stringify({scope:'D1 desechable; catálogo real sin OAuth ni infraestructura productiva',passed:checks},null,2));
}finally{await mf.dispose();await rm(output,{force:true});}
