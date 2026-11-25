import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {spawnSync} from 'node:child_process';
import {releaseTarget,validateGeneratedConfig,requireRemoteTarget,deploymentArgs} from '../scripts/release-config.mjs';
import {expectedSchema,schemaPlan,inspectSchema,migrations,sealBuild,verifyBuild,gitCommit,assertCleanSource,schemaQuery,registryQuery,integrityQuery} from '../scripts/release-tools.mjs';
const base={TRADEIFY_D1_ID:'11111111-1111-4111-8111-111111111111'},real={TRADEIFY_DEPLOY_ENV:'production',TRADEIFY_D1_ID:'97f43a2c-56d7-4f5b-b636-a26151ae531f',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)},production=releaseTarget(real),source='c'.repeat(40),checks=[];
async function check(name,run){await run();checks.push(name);console.log('PASS release safety: '+name);}
await check('Validación no publica; staging exige recursos distintos y R2 separado',()=>{
 assert.equal(releaseTarget(base).environment,'validation');assert.throws(()=>requireRemoteTarget(releaseTarget(base)),/bloqueada/);assert.throws(()=>releaseTarget({}),/UUID/);
 const staging={...real,TRADEIFY_DEPLOY_ENV:'staging',TRADEIFY_WORKER_NAME:'tradeify-v2-staging',TRADEIFY_D1_NAME:'tradeify-v2-staging',TRADEIFY_PRODUCTION_D1_ID:real.TRADEIFY_D1_ID};
 assert.throws(()=>releaseTarget(staging),/distintos/);staging.TRADEIFY_D1_ID='acbea8e9-2adc-48b3-a0ec-9c37d459b4d9';const target=releaseTarget(staging);assert.equal(target.workerName,'tradeify-v2-staging');requireRemoteTarget(target);
 assert.throws(()=>releaseTarget({...staging,TRADEIFY_R2_BUCKET:'private-captures'}),/R2_BUCKET/);
 assert.throws(()=>releaseTarget({...staging,TRADEIFY_R2_BUCKET:'private-captures',TRADEIFY_PRODUCTION_R2_BUCKET:'private-captures'}),/R2_BUCKET/);
 assert.equal(releaseTarget({...staging,TRADEIFY_R2_BUCKET:'private-staging',TRADEIFY_PRODUCTION_R2_BUCKET:'private-production'}).bucketName,'private-staging');
 assert.throws(()=>releaseTarget({...real,TRADEIFY_WORKER_NAME:'x;rm -rf'}),/nombre/);
});
await check('Producción requiere SHA exacto; comando publica conservando vars y nunca aplica migraciones',()=>{
 assert.throws(()=>deploymentArgs(production,source,undefined),/aprobación/);assert.throws(()=>deploymentArgs(production,source,'d'.repeat(40)),/aprobación/);
 const args=deploymentArgs(production,source,source);assert.equal(args[0],'deploy');assert.ok(args.includes('--keep-vars'));assert.ok(args.includes('--tag'));assert.equal(args.some(a=>/migrations|apply|delete|temporary/.test(a)),false);
 assert.throws(()=>deploymentArgs(releaseTarget(base),source,source),/bloqueada/);
 const conf={name:production.workerName,account_id:production.accountId,d1_databases:[{binding:'DB',database_id:production.databaseId,database_name:production.databaseName}],r2_buckets:[]};validateGeneratedConfig(conf,production);assert.throws(()=>validateGeneratedConfig({...conf,name:'another-worker'},production),/destino/);assert.throws(()=>validateGeneratedConfig({...conf,d1_databases:[...conf.d1_databases,...conf.d1_databases]},production),/Bindings/);
 const cli=readFileSync('scripts/cloudflare.mjs','utf8');assert.equal(/['"]migrations['"].*['"]apply['"]/.test(cli),false,'No se mantiene la antigua escritura remota automática en deploy');
});
const expected=expectedSchema(),files=migrations().map(f=>({name:f.name})),registry={type:'table',name:'d1_migrations',tbl_name:'d1_migrations',sql:'CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT,applied_at TEXT)'};
await check('Inventario solo SELECT; registro ausente no escribe ni marca migraciones aplicadas',()=>{
 const calls=[];const inspected=inspectSchema(production,{query:sql=>{calls.push(sql);return sql===integrityQuery?[]:expected;}});assert.deepEqual(calls,[schemaQuery,integrityQuery]);assert.equal(inspected.baselineRequired,true);assert.equal(inspected.registryPresent,false);assert.equal(inspected.ready,false);assert.ok(inspected.migrations.every(m=>m.status==='unknown-registry-absent'));
 const ready=inspectSchema(production,{query:sql=>{assert.ok(sql.startsWith('SELECT ')||sql===integrityQuery);if(sql===integrityQuery)return [];if(sql===schemaQuery)return [...expected,registry];assert.equal(sql,registryQuery);return files;}});assert.equal(ready.ready,true);assert.equal(ready.missing.length,0);assert.equal(ready.different.length,0);
});
await check('Registro no basta: detecta triggers/índices faltantes, esquema distinto y plan cambiado',()=>{
 const full=[...expected,registry],plan=schemaPlan(full,files,production,source);assert.equal(plan.ready,true);
 const missing=schemaPlan(full.filter(o=>o.name!=='public_shares_frozen'),files,production,source);assert.equal(missing.ready,false);assert.deepEqual(missing.missing,['trigger:public_shares_frozen']);assert.notEqual(missing.id,plan.id);
 const changed=schemaPlan(full.map(o=>o.name==='public_shares_quota_insert'?{...o,sql:o.sql.replace('>=100','>=999')}:o),files,production,source);assert.equal(changed.ready,false);assert.ok(changed.different.includes('trigger:public_shares_quota_insert'));
 const partial=schemaPlan(full,files.slice(0,-1),production,source);assert.equal(partial.ready,false);assert.equal(partial.migrations.at(-1).status,'not-recorded');assert.equal(schemaPlan([],null,production,source).freshDatabase,true);
});
await check('DDL real de D1 local coincide con el plan y comprueba relaciones sin escribir datos privados',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('fixture')}}",d1Databases:{DB:'release-disposable'},cf:false}));
 try{const db=await mf.getD1Database('DB');for(const f of migrations())await db.batch(f.sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));await db.prepare(registry.sql).run();for(const f of files)await db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(f.name).run();const actual=(await db.prepare(schemaQuery).all()).results,applied=(await db.prepare(registryQuery).all()).results,plan=schemaPlan(actual,applied,production,source);assert.equal(plan.ready,true,JSON.stringify({missing:plan.missing,different:plan.different}));assert.equal((await db.prepare(integrityQuery).all()).results.length,0);
 const corrupt=inspectSchema(production,{query:sql=>sql===schemaQuery?actual:sql===registryQuery?applied:[{table:'fixture',rowid:1}]});assert.equal(corrupt.ready,false);assert.equal(corrupt.foreignKeyViolations,1);
 }finally{await mf.dispose();}
});
await check('Sello vincula fuente, destinos, migraciones y TODOS los archivos del build; detecta manipulación',()=>{
 const root=mkdtempSync(join(tmpdir(),'tradeify-release-disposable-'));const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','-b','mejoras-v2-2026-11-18']);git(['config','user.name','Disposable test']);git(['config','user.email','fixture@example.test']);writeFileSync(join(root,'.gitignore'),'dist/\n');cpSync('drizzle',join(root,'drizzle'),{recursive:true});git(['add','.']);git(['commit','-m','Disposable source']);assertCleanSource(root);mkdirSync(join(root,'dist/server'),{recursive:true});mkdirSync(join(root,'dist/client'),{recursive:true});
  const config={name:production.workerName,account_id:production.accountId,d1_databases:[{binding:'DB',database_id:production.databaseId,database_name:production.databaseName}],r2_buckets:[]};writeFileSync(join(root,'dist/server/wrangler.json'),JSON.stringify(config));writeFileSync(join(root,'dist/server/index.js'),'export default {fetch(){return new Response("fixture")}}');writeFileSync(join(root,'dist/client/index.html'),'<p>fixture</p>');
  const sealed=sealBuild(production,root);assert.equal(sealed.source,gitCommit(root));assert.equal(sealed.sourceClean,true);verifyBuild(production,root);writeFileSync(join(root,'dist/client/index.html'),'<p>altered</p>');assert.throws(()=>verifyBuild(production,root),/cambiaron/);writeFileSync(join(root,'dist/client/index.html'),'<p>fixture</p>');verifyBuild(production,root);
  writeFileSync(join(root,'unsaved.txt'),'Uncommitted source');assert.throws(()=>assertCleanSource(root),/sin guardar/);assert.equal(sealBuild(production,root).sourceClean,false);git(['add','unsaved.txt']);git(['commit','-m','New source']);assert.throws(()=>verifyBuild(production,root),/cambiaron/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
console.log('check-release-safety: '+checks.length+' grupos; no credenciales, recursos remotos ni despliegues. Los identificadores de estas pruebas son ficticios.');
