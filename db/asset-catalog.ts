import {assetNameKey,type AssetAction,type CatalogAsset} from '../lib/asset-catalog';
import {JournalError} from './repository';
import {consistentBatch} from './journal-query';
type Row={id:string;version:number;name:string;favorite:number;last_used_at:number|null;created_at:number;updated_at:number;aliases:string};
const selection=`SELECT c.id,c.version,c.name,c.favorite,c.created_at,c.updated_at,coalesce(c.last_used_at,(SELECT max(t.opened_at) FROM trades t WHERE t.user_id=c.user_id AND json_extract(t.data,'$.market.id')=c.id)) last_used_at,COALESCE((SELECT json_group_array(alias) FROM (SELECT alias FROM asset_aliases WHERE user_id=c.user_id AND asset_id=c.id ORDER BY alias)),'[]') aliases FROM asset_catalog c`;
const result=(r:Row):CatalogAsset=>({id:r.id,version:r.version,name:r.name,favorite:!!r.favorite,lastUsedAt:r.last_used_at,createdAt:r.created_at,updatedAt:r.updated_at,aliases:JSON.parse(r.aliases)});
export async function listAssets(db:D1Database,user:string,params:URLSearchParams){
 const q=assetNameKey(params.get('q')??''),page=Number(params.get('page')??0),size=Number(params.get('size')??20),revision=params.has('revision')?Number(params.get('revision')):undefined;
 if(q.length>80||!Number.isSafeInteger(page)||page<0||page>100000||!Number.isInteger(size)||size<1||size>200||revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0)||page>0&&revision===undefined)throw new JournalError('Revisa la búsqueda y la página del catálogo.',422);
 const where=`c.user_id=?${params.get('favorites')==='1'?' AND c.favorite=1':''}${q?" AND (instr(c.name_key,?)>0 OR EXISTS (SELECT 1 FROM asset_aliases x WHERE x.user_id=c.user_id AND x.asset_id=c.id AND instr(lower(x.alias),?)>0))":''}`;
 const args=q?[user,q,q]:[user],order=params.get('order')==='recent'?'last_used_at DESC,c.name_key,c.id':params.get('order')==='favorites'?'c.favorite DESC,c.name_key,c.id':'c.name_key,c.id';
 const batch=await consistentBatch(db,user,revision,[db.prepare(`${selection} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,size,page*size),db.prepare(`SELECT count(*) total FROM asset_catalog c WHERE ${where}`).bind(...args)]);
 const total=Number((batch.results[1].results[0] as {total:number}).total);
 return {revision:batch.revision,items:(batch.results[0].results as Row[]).map(result),total,page,next:(page+1)*size<total};
}
export async function previewAssociation(db:D1Database,user:string,params:URLSearchParams){
 const id=params.get('id')??'',page=Number(params.get('page')??0),revision=params.has('revision')?Number(params.get('revision')):undefined;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(page)||page<0||page>100000||page>0&&revision===undefined)throw new JournalError('Vista previa no válida.',422);
 const asset=await db.prepare(selection+' WHERE c.user_id=? AND c.id=?').bind(user,id).first<Row>();if(!asset)throw new JournalError('Activo no disponible.',404);
 const where="t.user_id=? AND json_extract(t.data,'$.market.id') IS NULL AND EXISTS(SELECT 1 FROM asset_aliases x WHERE x.user_id=t.user_id AND x.asset_id=? AND x.alias=json_extract(t.data,'$.asset'))";
 const batch=await consistentBatch(db,user,revision,[db.prepare("SELECT t.id,t.version,t.opened_at openedAt,json_extract(t.data,'$.asset') asset,json_extract(t.data,'$.direction') direction FROM trades t WHERE "+where+" ORDER BY t.opened_at DESC,t.id DESC LIMIT 20 OFFSET ?").bind(user,id,page*20),db.prepare('SELECT count(*) total FROM trades t WHERE '+where).bind(user,id)]);
 const total=Number((batch.results[1].results[0] as {total:number}).total);
 return {asset:result(asset),revision:batch.revision,items:batch.results[0].results,total,page,next:(page+1)*20<total};
}
export async function mutateAsset(db:D1Database,user:string,input:AssetAction,now=Date.now()){
 if(input.action==='restore'){
  const read=()=>db.prepare(selection+' WHERE c.user_id=? AND c.id=?').bind(user,input.id).first<Row>();
  const same=(row:Row)=>{const a=result(row),b=input.asset;return a.name===b.name&&a.favorite===b.favorite&&JSON.stringify([...a.aliases].sort())===JSON.stringify([...b.aliases].sort());};
  const old=await read();if(old){if(same(old))return {asset:result(old),skipped:true};throw new JournalError('Un activo existente tiene otro contenido. No se sobrescribió.',409);}
  try{return await mutateAsset(db,user,{action:'save',id:input.id,version:null,asset:input.asset},now);}catch(e){const current=await read();if(current&&same(current))return {asset:result(current),skipped:true};throw e;}
 }
 if(input.action==='associate'){
  if(new Set(input.trades.map(t=>t.id)).size!==input.trades.length)throw new JournalError('No repitas operaciones en la confirmación.',422);
  const asset=await db.prepare(selection+' WHERE c.user_id=? AND c.id=? AND c.version=?').bind(user,input.id,input.version).first<Row>();if(!asset)throw new JournalError('El activo cambió. Revisa la vista previa.',409);
  const snapshot=JSON.stringify({id:asset.id,name:asset.name});
  const guards=[db.prepare("SELECT CASE WHEN coalesce((SELECT version FROM journal_revisions WHERE user_id=?),0)=? AND EXISTS(SELECT 1 FROM asset_catalog WHERE user_id=? AND id=? AND version=?) THEN 1 ELSE json('asset_snapshot_changed') END").bind(user,input.revision,user,input.id,input.version)];
  for(const t of input.trades)guards.push(db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM trades t WHERE t.user_id=? AND t.id=? AND t.version=? AND json_extract(t.data,'$.market.id') IS NULL AND EXISTS(SELECT 1 FROM asset_aliases a WHERE a.user_id=t.user_id AND a.asset_id=? AND a.alias=json_extract(t.data,'$.asset'))) THEN 1 ELSE json('asset_snapshot_changed') END").bind(user,t.id,t.version,input.id));
  try{await db.batch([...guards,...input.trades.map(t=>db.prepare("UPDATE trades SET data=json_set(data,'$.market',json(?)),version=version+1 WHERE user_id=? AND id=? AND version=?").bind(snapshot,user,t.id,t.version))]);}catch(error){for(let e=error;e instanceof Error;e=e.cause)if(/malformed JSON|asset_snapshot_changed/.test(e.message))throw new JournalError('El historial cambió. No se asoció ninguna operación del lote; revisa la vista previa.',409);throw error;}
  return {associated:input.trades.length};
 }
 const {id,version}=input,exists=version===null?'NOT EXISTS (SELECT 1 FROM asset_catalog WHERE user_id=? AND id=?)':'EXISTS (SELECT 1 FROM asset_catalog WHERE user_id=? AND id=? AND version=?)';
 const statements=[db.prepare(`SELECT CASE WHEN ${exists} THEN 1 ELSE json('asset_changed') END`).bind(user,id,...(version===null?[]:[version]))];
 if(input.action==='delete'){
  if(await db.prepare("SELECT 1 present FROM trades WHERE user_id=? AND json_extract(data,'$.market.id')=? LIMIT 1").bind(user,id).first())throw new JournalError('Este activo tiene operaciones asociadas; no se eliminó.',409);
  // Do not silently disconnect assigned history. The financial record remains.
  statements.push(db.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trades WHERE user_id=? AND json_extract(data,'$.market.id')=?) THEN 1 ELSE json('asset_in_use') END").bind(user,id));
  statements.push(db.prepare('DELETE FROM asset_catalog WHERE user_id=? AND id=? AND version=?').bind(user,id,version));
 }else{
  const a=input.asset;
  if(version===null)statements.push(db.prepare('INSERT INTO asset_catalog(user_id,id,name,name_key,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(user,id,a.name,assetNameKey(a.name),Number(a.favorite),now,now));
  else statements.push(db.prepare('UPDATE asset_catalog SET version=version+1,name=?,name_key=?,favorite=?,updated_at=? WHERE user_id=? AND id=? AND version=?').bind(a.name,assetNameKey(a.name),Number(a.favorite),now,user,id,version));
  statements.push(db.prepare('DELETE FROM asset_aliases WHERE user_id=? AND asset_id=?').bind(user,id));
  for(const alias of a.aliases)statements.push(db.prepare('INSERT INTO asset_aliases(user_id,alias,asset_id) VALUES (?,?,?)').bind(user,alias,id));
 }
 try{await db.batch(statements);}catch(error){for(let e=error;e instanceof Error;e=e.cause){if(/asset_in_use/.test(e.message))throw new JournalError('Este activo tiene operaciones asociadas; no se eliminó.',409);if(/asset_changed|malformed JSON/.test(e.message))throw new JournalError('El catálogo cambió. Actualiza antes de guardar.',409);if(/UNIQUE constraint failed/.test(e.message))throw new JournalError('Ya existe un activo con ese nombre o símbolo. Revisa los posibles duplicados.',409);}throw error;}
 if(input.action==='delete')return {id};
 return {asset:result(await db.prepare(`${selection} WHERE c.user_id=? AND c.id=?`).bind(user,id).first<Row>() as Row)};
}
