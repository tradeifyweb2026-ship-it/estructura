import {createVault,encryptScript} from '../lib/script-crypto.ts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture(),checks=[];
async function check(name,run){await run();checks.push(name);}
const call=(who,path,input,method=input?'POST':'GET',extra={})=>f.request(path,{method,headers:{'CF-Connecting-IP':'198.51.100.'+([null,'normal','owner','pending','suspended','expired','blocked'].indexOf(who)+10),...(who?{Cookie:f.cookies[who]}:{}),Origin:f.origin,'Content-Type':'application/json','X-Bitacora-Request':'1',...extra},body:input?JSON.stringify(input):undefined});
try{
 const routes=['/api/compartir?trade='+f.journal.trades[0].id,'/api/scripts','/api/activos','/api/bitacora?mode=metadata','/api/bitacora?mode=list','/api/bitacora?mode=analytics',...['psicologia','cuentas','estrategias','riesgo','revision'].map(section=>'/api/bitacora?mode=section&section='+section+(section==='revision'?'&start=2026-11-16&end=2026-11-23&previous=2026-11-09&reviewKey=2026-11-16':'')),'/api/frases','/api/capturas?trade='+f.journal.trades[0].id+'&slot=before','/api/admin','/api/admin?mode=resources'];
 await check('Matriz completa de lecturas privadas: anónimo, pendiente, suspendido, vencido, bloqueado',async()=>{for(const who of [null,'pending','suspended','expired','blocked'])for(const route of routes)assert.equal((await call(who,route)).status,who?403:401,who+' '+route);});
 await check('Matriz de escrituras y borrados: identidad antes de interpretar el cuerpo',async()=>{for(const who of [null,'pending','suspended','expired','blocked'])for(const [route,method]of [['/api/compartir','POST'],['/api/scripts','POST'],['/api/activos','POST'],['/api/bitacora','POST'],['/api/frases','POST'],['/api/frase-diaria','POST'],['/api/mi-cuenta','POST'],['/api/capturas','DELETE'],['/api/admin','POST']])assert.equal((await call(who,route,{action:'invalid'},method)).status,who?403:401,who+' '+method+' '+route);});
 await check('Usuario activo y propietario acceden a sus secciones; cabeceras no escalan privilegios',async()=>{for(const who of ['normal','owner'])for(const route of routes.filter(route=>!route.includes('capturas')&&!route.includes('admin')))assert.equal((await call(who,route)).status,200,who+' '+route);assert.equal((await call('normal','/api/admin',undefined,'GET',{'x-tradeify-admin':'1','oai-authenticated-user-id':'google:owner'})).status,403);assert.equal((await call(null,'/api/bitacora?mode=metadata',undefined,'GET',{'x-tradeify-admin':'1','oai-authenticated-user-id':'google:owner'})).status,401);});
 await check('Activos privados: propietario no lee ni edita catálogo ajeno y no se acepta userId',async()=>{
  const id=crypto.randomUUID(),input={action:'save',id,version:null,asset:{name:'NORMAL PRIVATE MARKET',aliases:['NPRIV'],favorite:false}};
  assert.equal((await call('normal','/api/activos',input)).status,200);
  assert.equal((await(await call('owner','/api/activos?q=NPRIV&userId=google:normal')).json()).total,0);
  assert.equal((await call('owner','/api/activos',{...input,version:1})).status,409);
  assert.equal((await call('normal','/api/activos',{...input,id:crypto.randomUUID(),userId:'google:owner'})).status,422);
  assert.equal((await call('normal','/api/activos',input,'POST',{Origin:'https://evil.example'})).status,403);
 });
 await check('Scripts privados: ni propietario ni cabeceras alteradas acceden a texto ajeno',async()=>{
  const v=await createVault('clave ficticia matriz privada'),id=crypto.randomUUID(),payload=await encryptScript(v.key,v.envelope.id,id,1,{title:'NORMAL PRIVATE SCRIPT',description:'',code:'plot(close)'});
  assert.equal((await call('normal','/api/scripts',{action:'vault',envelope:v.envelope})).status,200);
  const input={action:'save',id,version:null,vaultId:v.envelope.id,payload};assert.equal((await call('normal','/api/scripts',input)).status,200);
  assert.equal((await call('owner','/api/scripts?mode=detail&id='+id+'&userId=google:normal')).status,404);
  assert.equal((await call('owner','/api/scripts',{...input,version:1})).status,404);
  for(const extra of [{userId:'google:owner'},{owner:true},{code:'PINE PLAINTEXT'}])assert.equal((await call('normal','/api/scripts',{...input,...extra})).status,422);
  assert.equal((await call('normal','/api/scripts',input,'POST',{'X-Bitacora-Request':'0'})).status,403);
  assert.ok(!(await(await call('owner','/api/admin?mode=resources')).text()).includes('NORMAL PRIVATE SCRIPT'));
 });
 const account=crypto.randomUUID(),setup=crypto.randomUUID(),trade=crypto.randomUUID();
 await f.db.batch([
  f.db.prepare('INSERT INTO accounts VALUES (?,?,1,?)').bind('google:owner',account,JSON.stringify({...f.journal.accounts[0],name:'OWNER PRIVATE ACCOUNT'})),
  f.db.prepare('INSERT INTO setups VALUES (?,?,1,?)').bind('google:owner',setup,JSON.stringify({...f.journal.setups[0],name:'OWNER PRIVATE SETUP'})),
  f.db.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,?,?,?)').bind('google:owner',trade,f.journal.trades[0].openedAt,account,setup,JSON.stringify({...f.journal.trades[0]})),
  f.db.prepare('INSERT INTO attachments VALUES (?,?,?,?,?)').bind('google:owner',trade,'before','owner-only-capture','revision'),
 ]);await f.bucket.put('owner-only-capture','owner-private-fixture');
 await check('IDOR/BOLA: detalle, capturas, cuentas, estrategias y borrados ajenos',async()=>{for(const path of ['/api/bitacora?mode=detail&id='+trade,'/api/capturas?trade='+trade+'&slot=before'])assert.equal((await call('normal',path)).status,404);for(const input of [{action:'deleteTrade',id:trade,version:1},{action:'saveAccount',id:account,version:1,account:f.journal.accounts[0]},{action:'saveSetup',id:setup,version:1,setup:f.journal.setups[0]}])assert.equal((await call('normal','/api/bitacora',input)).status,409,input.action);assert.equal((await call('normal','/api/capturas?trade='+trade+'&slot=before',undefined,'DELETE',{'X-Capture-Revision':'revision'})).status,409);assert.ok(await f.bucket.get('owner-only-capture'));for(const path of ['/api/bitacora?mode=list&scope='+account,'/api/bitacora?mode=section&section=cuentas','/api/frases'])assert.ok(!(await(await call('normal',path)).text()).includes('OWNER PRIVATE'));assert.ok(!(await(await call('owner','/api/admin?mode=resources')).text()).includes('OWNER PRIVATE'));});
 await check('Asignación masiva y texto SQL/HTML no cambian propietario, rol, cuota ni versión interna',async()=>{const id=crypto.randomUUID(),name="<img src=x onerror=alert(1)> ';DROP TABLE trades;--",before=await f.db.prepare('SELECT count(*) n FROM trades').first('n');const r=await call('normal','/api/bitacora',{action:'saveAccount',id,version:null,userId:'google:owner',role:'owner',status:'active',quota:100000,account:{...f.journal.accounts[0],name,version:999,userId:'google:owner',role:'owner'}});assert.equal(r.status,200);const row=await f.db.prepare('SELECT * FROM accounts WHERE user_id=? AND id=?').bind('google:normal',id).first();assert.ok(row);assert.equal(row.version,1);const data=JSON.parse(row.data);assert.equal(data.name,name);assert.equal(data.userId,undefined);assert.equal(data.role,undefined);assert.equal(await f.db.prepare('SELECT count(*) n FROM trades').first('n'),before);assert.equal((await call('normal','/api/admin')).status,403);});
 const report={scope:'Worker compilado; D1/R2 y usuarios ficticios, no servicio real. Exportaciones son cliente: se verifica acceso a sus fuentes privadas.',readMatrix:5*routes.length,writeMatrix:5*9,passed:checks};const evidence=process.env.TRADEIFY_SECURITY_EVIDENCE??'documentacion/verificacion-seguridad-2026-11-22';await mkdir(evidence,{recursive:true});await writeFile(evidence+'/access-matrix.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await f.dispose();}
