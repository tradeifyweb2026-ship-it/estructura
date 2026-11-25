import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {exampleJournal} from '../lib/demo.ts';
import {dayKey,inputDate} from '../lib/journal.ts';
import {tradeQuerySchema} from '../lib/journal-query.ts';
import {psychologyModel,riskModel,accountModels,strategyModels} from '../lib/section-models.ts';
await mkdir('work',{recursive:true});const file=resolve('work/section-tests.mjs');await build({entryPoints:['db/section-query.ts'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});const {querySection}=await import(pathToFileURL(file));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('fixture')}}",d1Databases:{DB:'section-test'},cf:false}));
try{const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.batch((await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 const j=exampleJournal('2026-11-20'),user='sections',q=tradeQuerySchema.parse({}),metrics=[];j.accounts.push({...j.accounts[0],id:crypto.randomUUID(),currency:'EUR',name:'Euro'});j.setups[1].name=j.setups[0].name;
 for(const [table,rows]of [['accounts',j.accounts],['setups',j.setups]])for(const row of rows)await db.prepare(`INSERT INTO ${table}(user_id,id,version,data) VALUES (?,?,1,?)`).bind(user,row.id,JSON.stringify(row)).run();
 await db.prepare('INSERT INTO plans(user_id,data) VALUES (?,?)').bind(user,JSON.stringify(j.plan)).run();await db.prepare('INSERT INTO user_limits(user_id,trades,custom_trades) VALUES (?,20000,20000)').bind(user).run();
 const prepared=[];const measured={prepare(sql){prepared.push(sql);return db.prepare(sql);},batch:db.batch.bind(db)};let records=[];
 for(const count of [100,1000,10000,20000]){
  const added=Array.from({length:count-records.length},(_,n)=>{const i=n+records.length,t=j.trades[i%j.trades.length];return {...t,id:crypto.randomUUID(),accountId:j.accounts[i%2].id,notes:[{kind:'text',text:'PRIVATE_NOTES_'+ 'x'.repeat(1000),checked:false}]};});
  for(let i=0;i<added.length;i+=50)await db.batch(added.slice(i,i+50).map(t=>db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,?,?,?)').bind(user,t.id,t.openedAt,t.accountId,t.setupId,JSON.stringify(t))));records.push(...added);
  const journal={...j,trades:records},start=performance.now(),mem=process.memoryUsage().heapUsed;
  for(const [section,expected]of [['psicologia',psychologyModel(records,records,journal)],['cuentas',accountModels(records,journal)],['estrategias',strategyModels(records,journal)],['riesgo',riskModel(records,journal,dayKey(Date.now()))]]){
   const before=prepared.length;const r=await querySection(measured,user,section,q);const coldStatements=prepared.length-before;assert.deepEqual(r.model,JSON.parse(JSON.stringify(expected)),section+' parity '+count);assert.equal(r.cache,'miss');assert.deepEqual(r.metadata.accounts.map(a=>a.id),journal.accounts.map(a=>a.id).sort());assert.ok(!JSON.stringify(r).includes('PRIVATE_NOTES'));assert.ok(!Object.hasOwn(r,'trades'));
   const warmed=prepared.length;const hit=await querySection(measured,user,section,q);assert.equal(prepared.length-warmed,2,'Caché lee solo revisión y agregado');assert.ok(!prepared.slice(warmed).some(sql=>/FROM trades/.test(sql)));assert.equal(coldStatements,11);assert.equal(hit.cache,'hit');assert.deepEqual(hit.model,r.model);
   if(section==='estrategias')assert.equal(r.model.filter(m=>[j.setups[0].id,j.setups[1].id].includes(m.id)).length,2,'Estrategias homónimas mantienen ID');
  }
  const rev=await querySection(db,user,'revision',q,{start:'2026-11-16',end:'2026-11-23',previous:'2026-11-09',reviewKey:'2026-11-16'});assert.ok(rev.model.summary.closed<=records.length);assert.equal(rev.model.startAt,inputDate('2026-11-16T00:00'));
  metrics.push({count,preparedStatements:{coldPerSection:11,warmPerSection:2},rawTradesInSectionResponses:0,seconds:(performance.now()-start)/1000,responseBytes:Buffer.byteLength(JSON.stringify(await querySection(db,user,'psicologia',q))),rawBytes:Buffer.byteLength(JSON.stringify(records)),heapDelta:process.memoryUsage().heapUsed-mem});
 }
 await assert.rejects(()=>querySection(db,user,'cuentas',{...q,asset:'US100'}),e=>e.status===422);
 for(let i=0;i<25;i++){const week='2025-'+String(i%12+1).padStart(2,'0')+'-'+String(Math.floor(i/12)+1).padStart(2,'0');await db.prepare('INSERT INTO reviews VALUES (?,?,?,1,?)').bind(user,week,'all',JSON.stringify({followed:'Preserved '+week,repeat:'',change:''})).run();}
 const options={start:'2026-11-16',end:'2026-11-23',previous:'2026-11-09',reviewKey:'2025-01-01'};
 const first=await querySection(db,user,'revision',q,options);assert.equal(first.model.review.followed,'Preserved 2025-01-01');assert.equal(first.model.history.length,20);assert.ok(first.model.historyNext);
 const next=await querySection(db,user,'revision',q,{...options,historyBefore:first.model.historyNext});assert.equal(next.model.history.length,5);assert.ok(!first.model.history.some(a=>next.model.history.some(b=>a.week===b.week)));
 const isolated=await querySection(db,'other','riesgo',q);assert.equal(isolated.model.openCount,0);
 await db.prepare('UPDATE trades SET version=version+1 WHERE user_id=? AND id=?').bind(user,records[0].id).run();assert.equal((await querySection(db,user,'riesgo',q)).cache,'miss');
 const total=await db.prepare('SELECT count(*) n FROM journal_section_cache WHERE user_id=?').bind(user).first('n');assert.ok(total<=32);
 console.log(JSON.stringify({scope:'local; series evaluadas en Worker; no latencia ni factura de producción',metrics},null,2));
}finally{await mf.dispose();await rm(file,{force:true});}
