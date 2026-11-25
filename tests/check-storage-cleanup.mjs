import assert from 'node:assert/strict';
import {cleanupStorage} from '../worker/storage-cleanup.ts';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture(),{db,bucket}=f,checks=[];
async function check(name,run){await run();checks.push(name);}
async function queue(key,user='google:normal'){await bucket.put(key,'private-fixture');await db.prepare('INSERT INTO storage_deletions VALUES (?,?,?)').bind(key,user,Date.now()).run();}
try{
 await check('Intención de borrado y referencia D1 se confirman juntas, sin afectar otro propietario',async()=>{
  const trade=f.journal.trades[0].id;
  for(const [user,key]of [['google:normal','normal-image'],['google:owner','owner-image']]){await bucket.put(key,'private-fixture');await db.prepare('INSERT INTO attachments VALUES (?,?,?,?,?)').bind(user,trade,'before',key,'rev').run();}
  await db.prepare('DELETE FROM attachments WHERE user_id=?').bind('google:normal').run();
  assert.equal(await db.prepare('SELECT count(*) n FROM storage_deletions').first('n'),1);
  assert.equal(await cleanupStorage(db,bucket,'google:normal'),1);assert.equal(await bucket.get('normal-image'),null);assert.ok(await bucket.get('owner-image'));
 });
 await check('Fallo R2 parcial conserva toda la cola; reintento idempotente completa limpieza',async()=>{
  await queue('partial-one');await queue('partial-two');
  const failing={delete:async keys=>{await bucket.delete(keys[0]);throw Error('isolated partial R2 failure');}};
  await assert.rejects(cleanupStorage(db,failing),/isolated partial/);
  assert.equal(await db.prepare('SELECT count(*) n FROM storage_deletions').first('n'),2);
  assert.equal(await cleanupStorage(db,bucket),2);assert.equal(await cleanupStorage(db,bucket),0);
  assert.equal(await bucket.get('partial-one'),null);assert.equal(await bucket.get('partial-two'),null);
 });
 await check('Fallo al confirmar limpieza D1 mantiene intención para otro reintento',async()=>{
  await queue('uncertain-confirmation');
  await db.prepare("CREATE TRIGGER isolated_confirmation BEFORE DELETE ON storage_deletions BEGIN SELECT RAISE(ABORT,'isolated confirmation failure'); END").run();
  await assert.rejects(cleanupStorage(db,bucket));assert.equal(await bucket.get('uncertain-confirmation'),null);assert.equal(await db.prepare('SELECT count(*) n FROM storage_deletions').first('n'),1);
  await db.prepare('DROP TRIGGER isolated_confirmation').run();assert.equal(await cleanupStorage(db,bucket),1);
 });
 await check('No borrar objetos todavía referenciados y lote máximo 100',async()=>{
  await db.prepare('INSERT INTO storage_deletions VALUES (?,?,?)').bind('owner-image','google:owner',0).run();
  for(let i=0;i<101;i++)await queue('bounded-'+i);
  assert.equal(await cleanupStorage(db,bucket),100);assert.ok(await bucket.get('owner-image'));
  assert.equal(await cleanupStorage(db,bucket),1);assert.equal(await cleanupStorage(db,bucket),0);
  assert.equal(await db.prepare('SELECT count(*) n FROM storage_deletions').first('n'),1);
 });
 console.log(JSON.stringify({scope:'D1/R2 desechables, fallos inyectados; no certifica scheduler remoto',passed:checks},null,2));
}finally{await f.dispose();}
