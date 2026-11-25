import {createVault,encryptScript,decryptScript,unlockVault} from '../lib/script-crypto.ts';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
import {cleanupStorage} from '../worker/storage-cleanup.ts';
import {blankJournal} from '../lib/journal.ts';
import {DatabaseSync} from 'node:sqlite';

// Disposable recovery drill, NEVER a production restore command. Private rows,
// session cookies and blob contents remain in memory and are not printed/saved.
const source=await appFixture(),target=await appFixture({buildDirectory:process.env.TRADEIFY_ROLLBACK_BUILD??'dist'}),checks=[];
const receiptInput={action:'restoreBatch',requestId:crypto.randomUUID(),batch:{kind:'accounts',records:[{...source.journal.accounts[0],id:crypto.randomUUID(),version:4}]}};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ident=name=>{assert.match(name,/^[a-zA-Z_][a-zA-Z0-9_]*$/);return '"'+name+'"';};
const stable=rows=>JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
async function check(name,run){await run();checks.push(name);}
async function schema(db){return (await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").all()).results;}
async function contents(db,tables){const rows={};for(const name of tables)rows[name]=(await db.prepare('SELECT * FROM '+ident(name)).all()).results;return rows;}
let scriptSnapshot,publicSnapshotUrl;
const api=(f,path,input,who='normal')=>f.request(path,{method:input?'POST':'GET',headers:{Cookie:f.cookies[who],Origin:f.origin,'X-Bitacora-Request':'1','Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});
try{
 await check('Preparar datos de todas las familias, versiones, cuotas, auditoría y capturas',async()=>{
  assert.equal((await api(source,'/api/bitacora',{action:'savePlan',version:0,plan:{...blankJournal.plan,dailyLossR:2}})).status,200);
  assert.equal((await api(source,'/api/bitacora',receiptInput)).status,200);
  assert.equal((await api(source,'/api/admin',{action:'settings',mode:'public',days:14},'owner')).status,200);
  assert.equal((await api(source,'/api/admin',{action:'invite',email:'recovery-guest@example.test',until:Date.now()+86400000},'owner')).status,200);
  assert.equal((await api(source,'/api/admin',{action:'maintenance',version:0,active:false,message:'',until:null},'owner')).status,200);
  assert.equal((await api(source,'/api/activos',{action:'save',id:crypto.randomUUID(),version:null,asset:{name:'Activo de recuperación',aliases:['RECOVERY'],favorite:true}})).status,200);
  const privateVault=await createVault('clave ficticia recuperación D1'),privateId=crypto.randomUUID(),privatePlain={title:'Código operacional privado',description:'No texto en D1',code:'//@version=6\nindicator("Recuperación")\nplot(close)'};
  const cipher=await encryptScript(privateVault.key,privateVault.envelope.id,privateId,1,privatePlain);
  assert.equal((await api(source,'/api/scripts',{action:'vault',envelope:privateVault.envelope})).status,200);
  assert.equal((await api(source,'/api/scripts',{action:'save',id:privateId,version:null,vaultId:privateVault.envelope.id,payload:cipher})).status,200);
  scriptSnapshot={id:privateId,plain:privatePlain};
  const publicTrade=source.journal.trades[0],publicResult=await api(source,'/api/compartir',{action:'create',tradeId:publicTrade.id,tradeVersion:1,accountVersion:1,visibility:{},confirmed:true});assert.equal(publicResult.status,200);publicSnapshotUrl=(await publicResult.json()).url;
  const setup=source.journal.setups[0];assert.equal((await api(source,'/api/bitacora',{action:'saveSetup',id:setup.id,version:1,setup:{...setup,rules:setup.rules+' · revisión de recuperación'}})).status,200);
  assert.equal((await api(source,'/api/frases',{action:'preferences',version:0,patch:{sound:true,volume:35,frequency:'daily'}})).status,200);
  assert.equal((await api(source,'/api/frases',{action:'favorite',id:100001,saved:true})).status,200);
  assert.equal((await api(source,'/api/frases',{action:'deliver',manual:true,nonce:crypto.randomUUID()})).status,200);
  assert.equal((await api(source,'/api/admin',{action:'quota',userId:'google:normal',maxTrades:7000},'owner')).status,200);
  assert.equal((await api(source,'/api/bitacora?mode=section&section=psicologia')).status,200);
  for(const f of [source,target])await f.db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)').run();
  await source.db.prepare("INSERT INTO d1_migrations VALUES (1,'0016_public_trade_shares.sql','2026-11-23')").run();
  for(const [who,key]of [['normal','private-normal.png'],['owner','private-owner.png']]){await source.bucket.put(key,new Uint8Array([137,80,78,71,13,10,26,10]),{httpMetadata:{contentType:'image/png'}});await source.db.prepare('INSERT INTO attachments VALUES (?,?,?,?,?)').bind('google:'+who,source.journal.trades[0].id,'before',key,'snapshot-revision').run();}
  await source.bucket.put('pending-private.png','disposable pending object');await source.db.prepare('INSERT INTO storage_deletions VALUES (?,?,?)').bind('pending-private.png','google:normal',1).run();
  await source.db.batch([
   source.db.prepare('INSERT INTO login_codes(email_hash,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,?)').bind('fixture-email-hash','fixture-code-hash',Date.now()+60000,0,Date.now()),
   source.db.prepare('INSERT INTO daily_quote_progress VALUES (?,?,?)').bind('google:normal','2026-11-20',2),
   source.db.prepare('INSERT INTO operational_incidents VALUES (?,?,?,?)').bind('runtime_failure',Date.now(),Date.now(),1),
  ]);
  assert.equal((await api(source,'/api/admin',{action:'alert',id:'storage-cleanup',status:'reviewed'},'owner')).status,200);
 });
 const definitions=await schema(source.db),tables=definitions.filter(row=>row.type==='table').map(row=>row.name),rows=await contents(source.db,tables),blobs=[];
 let cursor;
 do{const page=await source.bucket.list({limit:2,cursor});for(const item of page.objects){const object=await source.bucket.get(item.key),bytes=Buffer.from(await object.arrayBuffer());blobs.push({key:item.key,bytes,sha256:hash(bytes),httpMetadata:object.httpMetadata,customMetadata:object.customMetadata});}cursor=page.truncated?page.cursor:undefined;}while(cursor);
 const validate=objects=>{for(const b of objects)assert.equal(hash(b.bytes),b.sha256,'Backup R2 corrupto: detener antes de restaurar');};
 await check('Manifiesto rechaza corrupción antes de escribir en destino',async()=>{const initial=await contents(target.db,tables);assert.throws(()=>validate([{...blobs[0],bytes:Buffer.from('corrupted')}]),/corrupto/);assert.equal(stable(Object.entries(await contents(target.db,tables))),stable(Object.entries(initial)));});
 await check('Restaurar R2 privado y después D1 atómicamente en otro recurso desechable',async()=>{
  validate(blobs);assert.equal(JSON.stringify(await schema(target.db)),JSON.stringify(definitions));
  for(const blob of blobs)await target.bucket.put(blob.key,blob.bytes,{httpMetadata:blob.httpMetadata,customMetadata:blob.customMetadata});
  const triggers=definitions.filter(row=>row.type==='trigger');
  const statements=[...triggers.map(row=>target.db.prepare('DROP TRIGGER '+ident(row.name))),target.db.prepare('PRAGMA defer_foreign_keys=ON'),...tables.map(name=>target.db.prepare('DELETE FROM '+ident(name)))];
  for(const name of tables)for(const row of rows[name]){const columns=Object.keys(row);statements.push(target.db.prepare('INSERT INTO '+ident(name)+' ('+columns.map(ident).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').bind(...columns.map(c=>row[c])));}
  statements.push(...triggers.map(row=>target.db.prepare(row.sql)));await target.db.batch(statements);
 });
 await check('Esquema, cada tabla, versiones, relaciones, índices y bytes recuperados coinciden',async()=>{
  assert.equal(JSON.stringify(await schema(target.db)),JSON.stringify(definitions));const restored=await contents(target.db,tables);
  for(const name of tables)assert.equal(stable(restored[name]),stable(rows[name]),name);
  assert.equal((await target.db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
  // D1 denies integrity_check (SQLITE_AUTH). Do not claim a physical D1 check:
  // inspect the exact logical backup in independent SQLite instead, plus D1 FK
  // and exact table comparisons above.
  const offline=new DatabaseSync(':memory:');
  try{
   for(const row of definitions.filter(row=>row.type==='table'))offline.exec(row.sql);
   // Composite foreign keys can depend on an explicitly created UNIQUE index.
   // Install indexes before preparing INSERTs; install triggers after loading
   // rows so stored usage counters are not applied a second time.
   for(const row of definitions.filter(row=>row.type==='index'))offline.exec(row.sql);
   offline.exec('BEGIN; PRAGMA defer_foreign_keys=ON');
   for(const name of tables)for(const row of rows[name]){const columns=Object.keys(row);offline.prepare('INSERT INTO '+ident(name)+' ('+columns.map(ident).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').run(...columns.map(c=>row[c]));}
   for(const row of definitions.filter(row=>row.type!=='table'&&row.type!=='index'))offline.exec(row.sql);
   offline.exec('COMMIT');assert.equal(offline.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(offline.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{offline.close();}
  for(const blob of blobs){const restored=await target.bucket.get(blob.key);assert.ok(restored);assert.equal(hash(Buffer.from(await restored.arrayBuffer())),blob.sha256);assert.deepEqual(restored.httpMetadata,blob.httpMetadata);}
 });
 Object.assign(target.cookies,source.cookies); // Only source sessions exist after recovery.
 await check('Autenticación restaurada, consultas completas, aislamiento y capturas privadas',async()=>{
  assert.equal((await api(target,'/api/bitacora?mode=metadata')).status,200);
  assert.equal((await api(target,'/api/bitacora',receiptInput)).status,200,'Recibo recuperado admite reintento idempotente');
  const account=source.journal.accounts[0].id;
  for(const mode of ['list','analytics']){const query='/api/bitacora?mode='+mode+'&scope='+account;const a=await(await api(source,query)).json(),b=await(await api(target,query)).json();assert.deepEqual(b,a);}
  const capture='/api/capturas?trade='+source.journal.trades[0].id+'&slot=before';assert.equal((await api(target,capture)).status,200);assert.equal((await target.request(capture)).status,401);
  const recoveredVault=(await(await api(target,'/api/scripts')).json()).vault;
  const recoveredScript=(await(await api(target,'/api/scripts?mode=detail&id='+scriptSnapshot.id)).json()).script;
  const recoveredKey=await unlockVault(recoveredVault.envelope,'clave ficticia recuperación D1');
  assert.deepEqual(await decryptScript(recoveredKey,recoveredVault.id,recoveredScript.id,recoveredScript.version,{metadata:recoveredScript.metadata,code:recoveredScript.code}),scriptSnapshot.plain);
  const library=await(await api(target,'/api/frases')).json();assert.equal(library.preferences.volume,35);assert.ok(library.favorites.includes(100001));assert.ok(library.total>0);
 });
 await check('Cola recuperada se reanuda sin borrar capturas vinculadas; sesiones y enlaces públicos se revocan antes de reabrir',async()=>{
  assert.equal(await cleanupStorage(target.db,target.bucket),1);assert.equal(await target.bucket.get('pending-private.png'),null);assert.ok(await target.bucket.get('private-normal.png'));
  assert.equal((await target.request(new URL(publicSnapshotUrl).pathname)).status,200,'Copia operacional contiene el snapshot autorizado');
  // Mandatory restore gate: never resurrect public bearers revoked after a backup.
  await target.db.prepare('DELETE FROM public_trade_shares').run();assert.equal((await target.request(new URL(publicSnapshotUrl).pathname)).status,404);
  await target.db.prepare('DELETE FROM auth_sessions').run();assert.equal((await api(target,'/api/bitacora?mode=metadata')).status,401);
  // Exercise the actual PKCE mock flow again after intentional revocation.
  const begin=await target.request('/entrar'),state=new URL(begin.headers.get('Location')).searchParams.get('state'),flow=begin.headers.get('Set-Cookie').split(';')[0];
  const callback=await target.request('/oauth/google/callback?code=normal&state='+state,{headers:{Cookie:flow}});const session=callback.headers.getSetCookie().find(v=>v.startsWith('__Host-tradeify-session=')).split(';')[0];
  assert.equal((await target.request('/api/bitacora?mode=metadata',{headers:{Cookie:session}})).status,200);
 });
 const report={scope:'Dos D1/R2 locales independientes, cuentas ficticias, Google simulado; copia lógica en memoria de todas las tablas y todos los blobs. No es backup real ni prueba de Time Travel, KMS o plan remoto.',rollbackSourceCommit:process.env.TRADEIFY_ROLLBACK_BUILD?'e26d64488fa8fe2429d7fd2904bd03f8a86fc841':null,d1PhysicalIntegrity:'No verificable mediante PRAGMA integrity_check: API D1 devuelve SQLITE_AUTH',sqliteLogicalBackupIntegrity:'ok; esquema/datos/índices/triggers del respaldo reconstruidos en SQLite independiente',tables:tables.map(name=>({name,rows:rows[name].length})),schemaObjects:definitions.length,r2Objects:blobs.length,passed:checks};
 const evidence=process.env.TRADEIFY_SECURITY_EVIDENCE??'documentacion/verificacion-seguridad-2026-11-22';await mkdir(evidence,{recursive:true});await writeFile(evidence+'/'+(process.env.TRADEIFY_ROLLBACK_BUILD?'rollback-local.json':'recovery.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await source.dispose();await target.dispose();}
