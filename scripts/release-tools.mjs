import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {releaseTarget,validateGeneratedConfig,requireRemoteTarget} from './release-config.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const schemaQuery="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name";
export const registryQuery='SELECT name FROM d1_migrations ORDER BY id';
export const integrityQuery='PRAGMA foreign_key_check';
export function migrations(root=process.cwd()){
 return readdirSync(resolve(root,'drizzle')).filter(p=>/^\d{4}_.+\.sql$/.test(p)).sort().map(name=>({name,sha256:hash(readFileSync(resolve(root,'drizzle',name))),sql:readFileSync(resolve(root,'drizzle',name),'utf8')}));
}
export function expectedSchema(root=process.cwd()){
 const db=new DatabaseSync(':memory:');try{for(const file of migrations(root))db.exec(file.sql);return db.prepare(schemaQuery).all();}finally{db.close();}
}
const normalized=sql=>sql.replace(/\s+/g,' ').replace(/;\s*$/,'').trim();
export function schemaPlan(actual,applied,target,source,root=process.cwd()){
 const expected=expectedSchema(root),key=o=>o.type+':'+o.name,actualMap=new Map(actual.map(o=>[key(o),o])),expectedMap=new Map(expected.map(o=>[key(o),o]));
 const missing=expected.filter(o=>!actualMap.has(key(o))).map(key),different=expected.filter(o=>actualMap.has(key(o))&&normalized(o.sql)!==normalized(actualMap.get(key(o)).sql)).map(key),registryPresent=actual.some(o=>o.type==='table'&&o.name==='d1_migrations'),appTables=actual.filter(o=>o.type==='table'&&!['d1_migrations','_litestream_seq','_litestream_lock'].includes(o.name));
 const files=migrations(root).map(({name,sha256})=>({name,sha256})),names=applied===null?null:new Set(applied.map(r=>r.name));
 const migrationState=files.map(f=>({...f,status:names?(names.has(f.name)?'recorded':'not-recorded'):'unknown-registry-absent'}));
 const fingerprint=hash(JSON.stringify(actual)),id=hash(JSON.stringify({source,target,fingerprint,files,applied}));
 return {format:1,id,source,target,readOnly:true,schemaFingerprint:fingerprint,registryPresent,freshDatabase:appTables.length===0,missing,different,extra:actual.filter(o=>!expectedMap.has(key(o))&&o.name!=='d1_migrations').map(key),migrations:migrationState,ready:missing.length===0&&different.length===0&&registryPresent&&names!==null&&files.every(f=>names.has(f.name)),baselineRequired:appTables.length>0&&!registryPresent,explanation:'Un registro de migración no prueba que sus objetos existan. Diferencias de SQL requieren revisión; no se corrigen ni se marca una migración como aplicada automáticamente.'};
}
export function gitCommit(root=process.cwd()){
 const r=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});if(r.status||!/^[a-f0-9]{40}\s*$/.test(r.stdout))throw Error('Compila desde el repositorio Git para registrar la versión exacta.');return r.stdout.trim();
}
export function assertCleanSource(root=process.cwd()){
 const r=spawnSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'});if(r.status)throw Error('No se pudo verificar el árbol Git.');
 if(r.stdout.trim())throw Error('Hay cambios o archivos sin guardar. Revisa git status y registra o aparta los datos locales antes de desplegar; no se descartan automáticamente.');
}
export function sourceIsClean(root=process.cwd()){
 const r=spawnSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'});if(r.status)throw Error('No se pudo verificar la fuente de la compilación.');return !r.stdout.trim();
}
function artifactFiles(root){
 const paths=[];for(const base of ['dist/server','dist/client']){const dir=resolve(root,base);if(!existsSync(dir))throw Error('Primero compila Cloudflare.');for(const item of readdirSync(dir,{recursive:true,withFileTypes:true}))if(item.isFile()){const path=resolve(item.parentPath,item.name),name=relative(root,path).replaceAll('\\','/');if(!name.endsWith('/tradeify-release.json'))paths.push(name);}}
 return paths.sort().map(path=>({path,sha256:hash(readFileSync(resolve(root,path)))}));
}
export function sealBuild(target,root=process.cwd()){
 const manifest={format:1,source:gitCommit(root),sourceClean:sourceIsClean(root),target,migrations:migrations(root).map(({name,sha256})=>({name,sha256})),artifactFingerprint:hash(JSON.stringify(artifactFiles(root)))};
 writeFileSync(resolve(root,'dist/server/tradeify-release.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
export function verifyBuild(target,root=process.cwd()){
 const config=JSON.parse(readFileSync(resolve(root,'dist/server/wrangler.json'),'utf8'));validateGeneratedConfig(config,target);
 const manifest=JSON.parse(readFileSync(resolve(root,'dist/server/tradeify-release.json'),'utf8'));
 if(manifest.source!==gitCommit(root)||JSON.stringify(manifest.target)!==JSON.stringify(target)||manifest.artifactFingerprint!==hash(JSON.stringify(artifactFiles(root)))||JSON.stringify(manifest.migrations)!==JSON.stringify(migrations(root).map(({name,sha256})=>({name,sha256}))))throw Error('Código, artefactos o migraciones cambiaron desde la compilación. Vuelve a compilar; no se publica un artefacto distinto del revisado.');
 return manifest;
}
export function inspectSchema(target,{local=false,persistTo,root=process.cwd(),query}={}){
 if(!local)requireRemoteTarget(target);
 const execute=query??(sql=>{
  const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',local?'--local':'--remote','--config','dist/server/wrangler.json','--command',sql,'--json',...(persistTo?['--persist-to',persistTo]:[])];
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:8*1024*1024});
  if(r.status)throw Error('No se pudo leer el esquema D1. Verifica sesión, cuenta, binding y permisos. No se ejecutaron migraciones.');
  let parsed;try{parsed=JSON.parse(r.stdout);}catch{throw Error('Wrangler no devolvió JSON válido; no se interpreta como esquema vacío.');}
  if(!Array.isArray(parsed)||parsed.length!==1||parsed[0].success!==true||!Array.isArray(parsed[0].results))throw Error('Respuesta D1 incompleta; se detiene la inspección.');return parsed[0].results;
 });
 const actual=execute(schemaQuery),registry=actual.some(o=>o.type==='table'&&o.name==='d1_migrations'),applied=registry?execute(registryQuery):null;
 const plan=schemaPlan(actual,applied,target,gitCommit(root),root),foreignKeyViolations=execute(integrityQuery).length;
 return {...plan,foreignKeyViolations,ready:plan.ready&&foreignKeyViolations===0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [command,...args]=process.argv.slice(2);if(command!=='inspect'||!args.includes('--remote')&&!args.includes('--local')||args.includes('--remote')&&args.includes('--local'))throw Error('Usa inspect --remote o inspect --local [--persist-to directorio] [--output work/inspeccion.json].');
  const value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined,target=releaseTarget();validateGeneratedConfig(JSON.parse(readFileSync('dist/server/wrangler.json','utf8')),target);
  const report=inspectSchema(target,{local:args.includes('--local'),persistTo:value('--persist-to')});
  const output=value('--output');if(output){const path=resolve(output);if(!path.startsWith(resolve('work')+'/'))throw Error('Guarda inventarios reales solo dentro de work/ (ignorado por Git).');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});}
  console.log(JSON.stringify({environment:target.environment,worker:target.workerName,readOnly:true,ready:report.ready,foreignKeyViolations:report.foreignKeyViolations,baselineRequired:report.baselineRequired,missing:report.missing,different:report.different,migrations:report.migrations.map(({name,status})=>({name,status})),planId:report.id,output:output??null},null,2));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
