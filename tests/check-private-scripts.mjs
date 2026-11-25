import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createVault,encryptScript,decryptScript,recoverVault,SCRIPT_LIMITS} from '../lib/script-crypto.ts';
import {scriptAction,scriptBackupSchema} from '../lib/script-protocol.ts';
await mkdir('work',{recursive:true});const output=resolve('work/private-scripts-test.mjs');
await build({stdin:{contents:"export * from './db/private-scripts.ts';",resolveDir:process.cwd()},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {readScripts,mutateScripts}=await import(pathToFileURL(output));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('fixture')}}",d1Databases:{DB:'private-scripts-disposable'},cf:false}));
const checks=[];const params=v=>new URLSearchParams(v);async function check(name,run){await run();checks.push(name);console.log('PASS private scripts: '+name);}
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.batch((await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 for(const u of ['script-a','script-b','script-owner'])await db.prepare('INSERT INTO users(user_id,email,created_at,last_login) VALUES (?,?,0,0)').bind(u,u+'@example.test').run();
 const vault=await createVault('clave ficticia scripts 2026'),id=crypto.randomUUID(),plain={title:'Título únicamente privado',description:'Descripción aislada',code:'//@version=6\nindicator("Privado")\nplot(close)'};
 const payload=await encryptScript(vault.key,vault.envelope.id,id,1,plain);
 const save={action:'save',id,version:null,vaultId:vault.envelope.id,payload};
 await check('Bóveda vacía, registro idempotente y sobres estrictos sin texto/rol/usuario',async()=>{
  assert.equal((await readScripts(db,'script-a',false,params())).vault,null);
  for(const extra of [{userId:'script-b'},{owner:true},{code:plain.code},{title:plain.title}])assert.equal(scriptAction.safeParse({...save,...extra}).success,false);
  assert.equal(scriptAction.safeParse({...save,payload:{...payload,code:{...payload.code,data:payload.code.data+'='}}}).success,false);
  const input={action:'vault',envelope:vault.envelope};await mutateScripts(db,'script-a',false,input);await mutateScripts(db,'script-a',false,input);
  assert.equal((await readScripts(db,'script-a',false,params())).vault.quotaBytes,SCRIPT_LIMITS.normalQuotaBytes);
 });
 await check('CRUD cifrado, lectura de código bajo demanda y aislamiento también del propietario',async()=>{
  assert.equal((await mutateScripts(db,'script-a',false,save)).version,1);
  const list=await readScripts(db,'script-a',false,params({mode:'list'}));assert.equal(list.total,1);assert.equal('code' in list.items[0],false);
  const detail=await readScripts(db,'script-a',false,params({mode:'detail',id}));assert.deepEqual(await decryptScript(vault.key,vault.envelope.id,id,1,{metadata:detail.script.metadata,code:detail.script.code}),plain);
  const wire=JSON.stringify((await db.prepare('SELECT * FROM private_scripts').all()).results);assert.equal(wire.includes(plain.title),false);assert.equal(wire.includes('indicator'),false);
  for(const [who,owner]of [['script-b',false],['script-owner',true]]){assert.equal((await readScripts(db,who,owner,params())).vault,null);await assert.rejects(readScripts(db,who,owner,params({mode:'detail',id})),e=>e.status===404);await assert.rejects(mutateScripts(db,who,owner,{...save,version:1}),e=>e.status===404);}
 });
 await check('Actualización CAS solo última versión; conflicto preserva contenido previo',async()=>{
  const next={...plain,code:plain.code+'\n// nueva versión'},p2=await encryptScript(vault.key,vault.envelope.id,id,2,next);
  await mutateScripts(db,'script-a',false,{...save,version:1,payload:p2});
  await assert.rejects(mutateScripts(db,'script-a',false,{...save,version:1,payload:p2}),e=>e.status===409);
  assert.equal(await db.prepare('SELECT count(*) n FROM private_scripts WHERE user_id=?').bind('script-a').first('n'),1);
  const row=(await readScripts(db,'script-a',false,params({mode:'detail',id}))).script;assert.equal(row.version,2);assert.deepEqual(await decryptScript(vault.key,vault.envelope.id,id,2,{metadata:row.metadata,code:row.code}),next);
 });
 await check('Cien scripts: páginas estables sin código, sin duplicados y revisión invalidada por mutación',async()=>{
  for(let i=0;i<100;i++){const sid=crypto.randomUUID(),p=await encryptScript(vault.key,vault.envelope.id,sid,1,{...plain,title:'Script '+i});await mutateScripts(db,'script-a',false,{...save,id:sid,payload:p},1000+i);}
  const first=await readScripts(db,'script-a',false,params({mode:'list'})),all=[...first.items];let page=1;
  for(let next=first.next;next;){const r=await readScripts(db,'script-a',false,params({mode:'list',page:String(page++),revision:String(first.revision)}));all.push(...r.items);next=r.next;}
  assert.equal(all.length,101);assert.equal(new Set(all.map(x=>x.id)).size,101);assert.ok(all.every(x=>!('code'in x)));
  const sid=all.at(-1).id;await mutateScripts(db,'script-a',false,{action:'delete',id:sid,version:1,vaultId:vault.envelope.id});
  await assert.rejects(readScripts(db,'script-a',false,params({mode:'list',page:'1',revision:String(first.revision)})),e=>e.status===409);
 });
 await check('Límite de bytes del rol y cuotas atómicas, sin confiar en líneas del cliente',async()=>{
  const bigId=crypto.randomUUID(),large={...plain,code:'x'.repeat(SCRIPT_LIMITS.normalCodeBytes+1)},largePayload=await encryptScript(vault.key,vault.envelope.id,bigId,1,large,true);
  await assert.rejects(mutateScripts(db,'script-a',false,{...save,id:bigId,payload:largePayload}),e=>e.status===413);
  const ownerVault=await createVault('clave ficticia propietario 2026');await mutateScripts(db,'script-owner',true,{action:'vault',envelope:ownerVault.envelope});
  const p=await encryptScript(ownerVault.key,ownerVault.envelope.id,bigId,1,large,true);await mutateScripts(db,'script-owner',true,{...save,id:bigId,vaultId:ownerVault.envelope.id,payload:p});
  // D1 trigger is independent of a modified client or the route's checks.
  const before=await db.prepare('SELECT used_bytes FROM script_vaults WHERE user_id=?').bind('script-a').first('used_bytes');
  await db.prepare('UPDATE script_vaults SET quota_bytes=? WHERE user_id=?').bind(before+1,'script-a').run();
  await assert.rejects(db.prepare('INSERT INTO private_scripts(user_id,id,vault_id,metadata,ciphertext,cipher_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,0,0)').bind('script-a',crypto.randomUUID(),vault.envelope.id,'{}','{}',2).run(),/script_quota/);
  assert.equal(await db.prepare('SELECT used_bytes FROM script_vaults WHERE user_id=?').bind('script-a').first('used_bytes'),before);
  await db.prepare('UPDATE script_vaults SET quota_bytes=? WHERE user_id=?').bind(SCRIPT_LIMITS.normalQuotaBytes,'script-a').run();
  const overLines={...plain,code:'x\n'.repeat(1001)},lineId=crypto.randomUUID(),cipher=await encryptScript(vault.key,vault.envelope.id,lineId,1,overLines,true);
  await mutateScripts(db,'script-a',false,{...save,id:lineId,payload:cipher}); // Explicit approved limitation.
  let quotaReached=false;
  for(let i=0;i<40;i++){
   const qid=crypto.randomUUID(),p=await encryptScript(vault.key,vault.envelope.id,qid,1,{...plain,code:'q'.repeat(SCRIPT_LIMITS.normalCodeBytes)});
   const before=await db.prepare('SELECT used_bytes FROM script_vaults WHERE user_id=?').bind('script-a').first('used_bytes');
   try{await mutateScripts(db,'script-a',false,{...save,id:qid,payload:p});}catch(error){assert.equal(error.status,422);quotaReached=true;assert.equal(await db.prepare('SELECT used_bytes FROM script_vaults WHERE user_id=?').bind('script-a').first('used_bytes'),before);assert.equal(await db.prepare('SELECT count(*) n FROM private_scripts WHERE user_id=? AND id=?').bind('script-a',qid).first('n'),0);break;}
  }
  assert.equal(quotaReached,true,'El servidor aplica el presupuesto real de 5 MiB con sobres válidos');

 });
 await check('Exportación cifrada completa y restauración idempotente sin sobrescribir',async()=>{
  const first=await readScripts(db,'script-a',false,params({mode:'backup'})),scripts=[...first.items];let page=1,next=first.next;
  while(next){const r=await readScripts(db,'script-a',false,params({mode:'backup',page:String(page++),revision:String(first.revision)}));scripts.push(...r.items);next=r.next;}
  const backup={app:'tradeify-private-scripts',format:1,envelope:vault.envelope,scripts:scripts.map(s=>({id:s.id,version:s.version,vaultId:s.vaultId,payload:{metadata:s.metadata,code:s.code},createdAt:s.createdAt,updatedAt:s.updatedAt}))};assert.equal(scriptBackupSchema.safeParse(backup).success,true);
  await mutateScripts(db,'script-b',false,{action:'vault',envelope:backup.envelope});
  for(const item of backup.scripts)await mutateScripts(db,'script-b',false,{action:'restore',...item});
  const firstItem=backup.scripts[0];assert.equal((await mutateScripts(db,'script-b',false,{action:'restore',...firstItem})).skipped,true);
  await assert.rejects(mutateScripts(db,'script-b',false,{action:'restore',...firstItem,version:firstItem.version+1}),e=>e.status===409);
  assert.equal((await readScripts(db,'script-b',false,params({mode:'list'}))).total,scripts.length);
 });
 await check('Recuperación por versión, borrado individual y cascada propia conservan biblioteca ajena',async()=>{
  const recovered=await recoverVault(vault.envelope,vault.recoveryCode,'nueva clave ficticia de prueba');
  await mutateScripts(db,'script-a',false,{action:'recover',version:1,envelope:recovered.envelope});
  await assert.rejects(mutateScripts(db,'script-a',false,{action:'recover',version:1,envelope:recovered.envelope}),e=>e.status===409);
  const before=(await readScripts(db,'script-b',false,params({mode:'list'}))).total;
  await db.prepare('DELETE FROM users WHERE user_id=?').bind('script-a').run();
  for(const table of ['private_scripts','script_vaults'])assert.equal(await db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').bind('script-a').first('n'),0);
  assert.equal((await readScripts(db,'script-b',false,params({mode:'list'}))).total,before);
 });
 console.log('check-private-scripts: '+checks.length+' grupos D1 aprobados, recursos desechables; no producción.');
}finally{await mf.dispose();}
