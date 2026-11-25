import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {exampleJournal} from '../lib/demo.ts';
import {publicShareAction,publicSnapshotSchema,publicTokenHash,PUBLIC_SHARE_TTL} from '../lib/public-share.ts';
await mkdir('work',{recursive:true});const output=resolve('work/public-shares-test.mjs');
await build({stdin:{contents:"export * from './db/public-shares.ts';",resolveDir:process.cwd()},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {createPublicShare,listPublicShares,revokePublicShare,readPublicShare,cleanupPublicShares}=await import(pathToFileURL(output));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('fixture')}}",d1Databases:{DB:'public-shares-disposable'},cf:false}));
const origin='https://share.example.test',now=Date.now(),checks=[];async function check(name,run){await run();checks.push(name);console.log('PASS public shares: '+name);}
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.batch((await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 const journal=exampleJournal('2026-11-20'),account=journal.accounts[0],setup=journal.setups[0],trade={...journal.trades.find(t=>t.closedAt!==null),asset:'SNAPSHOT_TEST',accountId:account.id,setupId:setup.id,pnlCents:16000,riskCents:5000,feesCents:500,notes:[{kind:'text',text:'NOTA PRIVADA COMPARTIDA SOLO SI AUTORIZO',checked:false}],captureLinks:{before:'https://www.tradingview.com/x/snapshot-test/'}};
 account.name='CUENTA QUE NUNCA SE PUBLICA';account.startingBalanceCents=1000000;
 for(const user of ['shares-a','shares-b']){
  await db.prepare('INSERT INTO users(user_id,email,created_at,last_login) VALUES (?,?,0,0)').bind(user,user+'@example.test').run();
  await db.prepare('INSERT INTO accounts(user_id,id,version,data) VALUES (?,?,1,?)').bind(user,account.id,JSON.stringify(account)).run();
  await db.prepare('INSERT INTO setups(user_id,id,version,data) VALUES (?,?,1,?)').bind(user,setup.id,JSON.stringify(setup)).run();
  await db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,?,?,?)').bind(user,trade.id,trade.openedAt,account.id,setup.id,JSON.stringify(trade)).run();
 }
 const minimal=publicShareAction.parse({action:'create',tradeId:trade.id,tradeVersion:1,accountVersion:1,visibility:{},confirmed:true});let link,token;
 await check('Confirmación explícita, campos mínimos, token aleatorio/hash y caducidad exacta',async()=>{
  for(const extra of [{confirmed:false},{owner:true},{snapshot:{}},{visibility:{account:true}},{visibility:{scripts:true}}])assert.equal(publicShareAction.safeParse({...minimal,...extra}).success,false);
  link=await createPublicShare(db,'shares-a',minimal,origin,now);token=link.url.split('/').at(-1);assert.equal(token.length,43);assert.match(token,/^[A-Za-z0-9_-]+$/);assert.equal(link.expiresAt-now,PUBLIC_SHARE_TTL);
  const row=await db.prepare('SELECT * FROM public_trade_shares WHERE id=?').bind(link.id).first();assert.equal(row.token_hash,await publicTokenHash(token));assert.equal(JSON.stringify(row).includes(token),false);
  const pub=await readPublicShare(db,token,now);assert.deepEqual(Object.keys(pub.snapshot).sort(),['schema','asset','side','date','status','tone','r'].sort());assert.equal(pub.snapshot.r,'+3,2 R');
  for(const secret of [account.name,'NOTA PRIVADA',trade.id,account.id,setup.id,'shares-a','example.test'])assert.equal(JSON.stringify(pub).includes(secret),false);
  assert.equal(publicSnapshotSchema.safeParse({...pub.snapshot,accountId:account.id}).success,false);
  assert.equal(await readPublicShare(db,token,now+PUBLIC_SHARE_TTL),null);assert.equal(await readPublicShare(db,'../invalid',now),null);
  await assert.rejects(createPublicShare(db,'shares-a',minimal,'http://not-secure.test',now),e=>e.status===503);
 });
 await check('Opt-in por campo; porcentaje neto/capital y captura allowlist sin cuenta ni IDs',async()=>{
  const full=await createPublicShare(db,'shares-a',{...minimal,visibility:{percent:true,money:true,prices:true,strategy:true,notes:true,captures:true}},origin,now+1);
  const pub=(await readPublicShare(db,full.url.split('/').at(-1),now+2)).snapshot;assert.equal(pub.percent,'+1,6 %');assert.ok(pub.money);assert.equal(pub.prices.length,3);assert.match(pub.note,/NOTA PRIVADA/);assert.equal(pub.links.length,1);assert.ok(pub.setup);assert.equal('account'in pub,false);assert.equal(JSON.stringify(pub).includes(account.name),false);
 });
 await check('Ediciones no mutan snapshot; fuente obsoleta rechazada y revocación aislada',async()=>{
  await db.prepare("UPDATE trades SET data=json_set(data,'$.pnlCents',-16000),version=2 WHERE user_id='shares-a' AND id=?").bind(trade.id).run();
  assert.equal((await readPublicShare(db,token,now+2)).snapshot.r,'+3,2 R');
  await assert.rejects(createPublicShare(db,'shares-a',minimal,origin,now+2),e=>e.status===409);
  await db.prepare("UPDATE accounts SET version=2 WHERE user_id='shares-a' AND id=?").bind(account.id).run();
  await assert.rejects(createPublicShare(db,'shares-a',{...minimal,tradeVersion:2},origin,now+2),e=>e.status===409);
  assert.equal((await listPublicShares(db,'shares-b',trade.id,now+2)).items.length,0);
  await revokePublicShare(db,'shares-b',link.id);assert.ok(await readPublicShare(db,token,now+2));
  await assert.rejects(db.prepare('UPDATE public_trade_shares SET expires_at=expires_at+1 WHERE id=?').bind(link.id).run(),/public_share_frozen/);
  await revokePublicShare(db,'shares-a',link.id);assert.equal(await readPublicShare(db,token,now+2),null);await revokePublicShare(db,'shares-a',link.id);
 });
 await check('Límite real y atómico de 100 enlaces activos; lectura indexada y limpieza acotada',async()=>{
  const input={...minimal,tradeVersion:2,accountVersion:2};
  for(let i=0;i<99;i++)await createPublicShare(db,'shares-a',input,origin,now+3);
  await assert.rejects(createPublicShare(db,'shares-a',input,origin,now+3),e=>e.status===422);
  assert.equal((await listPublicShares(db,'shares-a',trade.id,now+4)).items.length,100);
  const plan=await db.prepare('EXPLAIN QUERY PLAN SELECT snapshot FROM public_trade_shares WHERE token_hash=? AND expires_at>?').bind(await publicTokenHash(token),now).all();assert.match(JSON.stringify(plan.results),/public_shares_token/);
  assert.equal(await cleanupPublicShares(db,now+PUBLIC_SHARE_TTL+4),100);assert.equal((await listPublicShares(db,'shares-a',trade.id,now+PUBLIC_SHARE_TTL+4)).items.length,0);
 });
 await check('Edición concurrente entre lectura y transacción impide publicar una vista obsoleta',async()=>{
  const count=await db.prepare('SELECT count(*) n FROM public_trade_shares').first('n');
  const raced={prepare:sql=>db.prepare(sql),batch:async statements=>{await db.prepare("UPDATE accounts SET data=json_set(data,'$.startingBalanceCents',2000000),version=3 WHERE user_id='shares-a' AND id=?").bind(account.id).run();return db.batch(statements);}};
  await assert.rejects(createPublicShare(raced,'shares-a',{...minimal,tradeVersion:2,accountVersion:2},origin,now+5),e=>e.status===409);
  assert.equal(await db.prepare('SELECT count(*) n FROM public_trade_shares').first('n'),count,'Un conflicto no crea un enlace ni un token parcial');
  await db.prepare("UPDATE accounts SET data=?,version=2 WHERE user_id='shares-a' AND id=?").bind(JSON.stringify(account),account.id).run();
  await assert.rejects(createPublicShare(db,'shares-a',{...minimal,tradeVersion:2,accountVersion:2,expectedSnapshot:link.snapshot},origin,now+5),e=>e.status===409,'La vista aprobada debe coincidir con el resultado actual');
 });
 await check('Borrar operación o cuenta elimina enlaces; usuarios ajenos se conservan',async()=>{
  const a=await createPublicShare(db,'shares-a',{...minimal,tradeVersion:2,accountVersion:2},origin,now+5),b=await createPublicShare(db,'shares-b',minimal,origin,now+5);
  await db.prepare("DELETE FROM trades WHERE user_id='shares-a' AND id=?").bind(trade.id).run();assert.equal(await readPublicShare(db,a.url.split('/').at(-1),now+6),null);assert.ok(await readPublicShare(db,b.url.split('/').at(-1),now+6));
  // Existing trades restrict account deletion; simulate its authorized deletion order.
  await db.prepare("DELETE FROM trades WHERE user_id='shares-b' AND id=?").bind(trade.id).run();await db.prepare("DELETE FROM accounts WHERE user_id='shares-b' AND id=?").bind(account.id).run();assert.equal(await readPublicShare(db,b.url.split('/').at(-1),now+6),null);
  assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 });
 console.log('check-public-shares: '+checks.length+' grupos D1; snapshots mínimos, opt-in, CAS, aislamiento, expiración, cuotas y borrado. No producción ni certificación del QR.');
}finally{await mf.dispose();}
