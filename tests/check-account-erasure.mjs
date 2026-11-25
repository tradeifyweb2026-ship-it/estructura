import {createVault,encryptScript} from '../lib/script-crypto.ts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture(),key='isolated-erasure-capture',trade=f.journal.trades[0].id;
let result;
try{
 const assetId=crypto.randomUUID();for(const who of ['normal','owner']){assert.equal((await f.request('/api/activos',{method:'POST',headers:{Cookie:f.cookies[who],Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:JSON.stringify({action:'save',id:assetId,version:null,asset:{name:'Activo privado '+who,aliases:['ERASURE'],favorite:true}})})).status,200);}
 const scriptId=crypto.randomUUID();
 for(const who of ['normal','owner']){const v=await createVault('clave ficticia borrado '+who),payload=await encryptScript(v.key,v.envelope.id,scriptId,1,{title:'Script propio '+who,description:'',code:'plot(close)'});for(const input of [{action:'vault',envelope:v.envelope},{action:'save',id:scriptId,version:null,vaultId:v.envelope.id,payload}])assert.equal((await f.request('/api/scripts',{method:'POST',headers:{Cookie:f.cookies[who],Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:JSON.stringify(input)})).status,200);}
 for(const who of ['normal','owner'])assert.equal((await f.request('/api/compartir',{method:'POST',headers:{Cookie:f.cookies[who],Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:JSON.stringify({action:'create',tradeId:trade,tradeVersion:1,accountVersion:1,visibility:{},confirmed:true})})).status,200);
 await f.bucket.put(key,'fixture-image',{httpMetadata:{contentType:'image/png'}});
 await f.db.prepare('INSERT INTO attachments VALUES (?,?,?,?,?)').bind('google:normal',trade,'before',key,'test-revision').run();
 // Fail *after* the attachment DELETE in the batch. The entire D1 transaction
 // must roll back and retain its R2 content; no production resource is used.
 await f.db.prepare("CREATE TRIGGER isolated_erasure_failure BEFORE DELETE ON users WHEN old.user_id='google:normal' BEGIN SELECT RAISE(ABORT,'isolated failure'); END").run();
 const r=await f.request('/api/mi-cuenta',{method:'POST',headers:{Cookie:f.cookies.normal,Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:JSON.stringify({action:'delete',confirm:'ELIMINAR'})});
 assert.equal(r.status,503);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM attachments WHERE user_id=?').bind('google:normal').first('n'),1);
 assert.ok(await f.bucket.get(key),'D1 revierte pero R2 perdió la captura');
 assert.equal((await f.request('/api/capturas?trade='+trade+'&slot=before',{headers:{Cookie:f.cookies.normal}})).status,200);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM asset_catalog WHERE user_id=?').bind('google:normal').first('n'),1);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM private_scripts WHERE user_id=?').bind('google:normal').first('n'),1);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM public_trade_shares WHERE user_id=?').bind('google:normal').first('n'),1);
 await f.db.prepare('DROP TRIGGER isolated_erasure_failure').run();
 const success=await f.request('/api/mi-cuenta',{method:'POST',headers:{Cookie:f.cookies.normal,Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1'},body:JSON.stringify({action:'delete',confirm:'ELIMINAR'})});assert.equal(success.status,204);
 for(const table of ['asset_catalog','asset_aliases','journal_revisions','auth_sessions','script_vaults','private_scripts','public_trade_shares'])assert.equal(await f.db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').bind('google:normal').first('n'),0,table+' sin restos del usuario borrado');
 assert.equal(await f.db.prepare('SELECT count(*) n FROM asset_catalog WHERE user_id=?').bind('google:owner').first('n'),1);assert.equal((await f.request('/api/activos',{headers:{Cookie:f.cookies.normal}})).status,401);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM private_scripts WHERE user_id=?').bind('google:owner').first('n'),1);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM public_trade_shares WHERE user_id=?').bind('google:owner').first('n'),1);
 result={status:'passed',scenario:'D1 revierte sin pérdida; borrado confirmado limpia catálogo/alias/revisión/sesiones y conserva catálogo ajeno'};
}catch(error){result={status:'failed',error:error.message};process.exitCode=1;}
finally{await f.dispose();}
if(process.env.TRADEIFY_SECURITY_EVIDENCE){await mkdir(process.env.TRADEIFY_SECURITY_EVIDENCE,{recursive:true});await writeFile(process.env.TRADEIFY_SECURITY_EVIDENCE+'/account-erasure.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
