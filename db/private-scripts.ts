import {JournalError} from './repository';
import {SCRIPT_LIMITS,type Sealed} from '../lib/script-crypto';
import {encryptedBytes,type ScriptAction,type ScriptRecord,type VaultState} from '../lib/script-protocol';
type VaultRow={user_id:string;id:string;version:number;revision:number;envelope:string;used_bytes:number;quota_bytes:number;created_at:number;updated_at:number};
type ScriptRow={id:string;version:number;vault_id:string;metadata:string;ciphertext?:string;cipher_bytes:number;created_at:number;updated_at:number};
const quota=(owner:boolean)=>owner?SCRIPT_LIMITS.ownerQuotaBytes:SCRIPT_LIMITS.normalQuotaBytes;
const cap=(owner:boolean)=>owner?SCRIPT_LIMITS.ownerCodeBytes:SCRIPT_LIMITS.normalCodeBytes;
const row=(r:ScriptRow):ScriptRecord=>({id:r.id,version:r.version,vaultId:r.vault_id,metadata:JSON.parse(r.metadata),...(r.ciphertext?{code:JSON.parse(r.ciphertext)}:{}),bytes:r.cipher_bytes,createdAt:r.created_at,updatedAt:r.updated_at});
const readVault=(db:D1Database,user:string)=>db.prepare('SELECT * FROM script_vaults WHERE user_id=?').bind(user).first<VaultRow>();
function state(v:VaultRow|null,owner:boolean):VaultState{return {vault:v?{id:v.id,version:v.version,revision:v.revision,envelope:JSON.parse(v.envelope),usedBytes:v.used_bytes,quotaBytes:Math.min(v.quota_bytes,quota(owner))}:null,owner,limits:SCRIPT_LIMITS};}
const changed=()=>new JournalError('La biblioteca cambió en otra pestaña. Actualiza antes de guardar; tus cambios locales se conservan.',409);
async function batch(db:D1Database,statements:D1PreparedStatement[]){try{return await db.batch(statements);}catch(error){for(let e=error;e instanceof Error;e=e.cause){if(/script_quota/.test(e.message))throw new JournalError('Alcanzaste el presupuesto técnico de almacenamiento de tu biblioteca. Exporta o elimina scripts propios antes de añadir más.',422);if(/malformed JSON|script_changed|UNIQUE constraint failed|FOREIGN KEY constraint failed/.test(e.message))throw changed();}throw error;}}
export async function readScripts(db:D1Database,user:string,owner:boolean,params:URLSearchParams){
 const mode=params.get('mode')??'vault';if(mode==='vault')return state(await readVault(db,user),owner);
 if(!['list','detail','backup'].includes(mode))throw new JournalError('Consulta de scripts no válida.',422);
 const page=Number(params.get('page')??0),revision=params.has('revision')?Number(params.get('revision')):undefined,id=params.get('id'),size=mode==='backup'?5:50;
 if(!Number.isSafeInteger(page)||page<0||page>100000||page>0&&revision===undefined||revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0)||mode==='detail'&&(!id||!/^[0-9a-f-]{36}$/i.test(id)))throw new JournalError('Revisa la página o el identificador de script.',422);
 const fields='id,version,vault_id,metadata,cipher_bytes,created_at,updated_at'+(mode==='list'?'':',ciphertext');
 const queries=[db.prepare('SELECT * FROM script_vaults WHERE user_id=?').bind(user),mode==='detail'?db.prepare('SELECT '+fields+' FROM private_scripts WHERE user_id=? AND id=?').bind(user,id):db.prepare('SELECT '+fields+' FROM private_scripts WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?').bind(user,size,page*size),db.prepare('SELECT count(*) total FROM private_scripts WHERE user_id=?').bind(user)];
 const results=await db.batch(queries),v=results[0].results[0] as VaultRow|undefined;if(!v)throw new JournalError('Todavía no has creado tu biblioteca cifrada.',404);if(revision!==undefined&&revision!==v.revision)throw changed();
 const items=(results[1].results as ScriptRow[]).map(row);if(mode==='detail'){if(!items[0])throw new JournalError('El script no está disponible.',404);return {script:items[0],revision:v.revision};}
 const total=Number((results[2].results[0] as {total:number}).total);return {...state(v,owner),items,total,page,next:(page+1)*size<total,revision:v.revision};
}
function payloadBytes(payload:{metadata:Sealed;code:Sealed}){return JSON.stringify(payload.metadata).length+JSON.stringify(payload.code).length+512;}
export async function mutateScripts(db:D1Database,user:string,owner:boolean,input:ScriptAction,now=Date.now()):Promise<unknown>{
 const current=await readVault(db,user);
 if(input.action==='vault'){
  if(current){if(current.id===input.envelope.id&&current.envelope===JSON.stringify(input.envelope))return state(current,owner);throw changed();}
  await batch(db,[db.prepare('INSERT INTO script_vaults(user_id,id,envelope,quota_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(user,input.envelope.id,JSON.stringify(input.envelope),quota(owner),now,now)]);return state(await readVault(db,user),owner);
 }
 if(!current)throw new JournalError('Primero crea o restaura tu biblioteca cifrada.',404);
 if(input.action==='recover'){
  if(input.envelope.id!==current.id)throw changed();
  await batch(db,[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM script_vaults WHERE user_id=? AND id=? AND version=?) THEN 1 ELSE json('script_changed') END").bind(user,current.id,input.version),db.prepare('UPDATE script_vaults SET envelope=?,version=version+1,revision=revision+1,updated_at=? WHERE user_id=? AND id=? AND version=?').bind(JSON.stringify(input.envelope),now,user,current.id,input.version)]);return state(await readVault(db,user),owner);
 }
 if(input.vaultId!==current.id)throw changed();
 if(input.action==='reset'){
  await batch(db,[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM script_vaults WHERE user_id=? AND id=? AND version=?) THEN 1 ELSE json('script_changed') END").bind(user,current.id,input.version),db.prepare('DELETE FROM script_vaults WHERE user_id=? AND id=? AND version=?').bind(user,current.id,input.version)]);return {reset:true};
 }
 const previous=await db.prepare('SELECT * FROM private_scripts WHERE user_id=? AND id=?').bind(user,input.id).first<ScriptRow>();
 if(input.action==='restore'&&previous){if(previous.vault_id===input.vaultId&&previous.version===input.version&&previous.metadata===JSON.stringify(input.payload.metadata)&&previous.ciphertext===JSON.stringify(input.payload.code))return {id:input.id,version:previous.version,skipped:true};throw changed();}
 const expected=input.action==='restore'?null:input.version;
 const exists=expected===null?'NOT EXISTS(SELECT 1 FROM private_scripts WHERE user_id=? AND id=?)':'EXISTS(SELECT 1 FROM private_scripts WHERE user_id=? AND id=? AND version=?)';
 const statements=[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM script_vaults WHERE user_id=? AND id=?) AND "+exists+" THEN 1 ELSE json('script_changed') END").bind(user,current.id,user,input.id,...(expected===null?[]:[expected]))];
 if(input.action==='delete'){
  statements.push(db.prepare('DELETE FROM private_scripts WHERE user_id=? AND id=? AND version=?').bind(user,input.id,input.version));await batch(db,statements);return {id:input.id};
 }
 if(encryptedBytes(input.payload.code.data)>cap(owner)+16)throw new JournalError('El código cifrado supera el límite técnico de bytes de tu usuario.',413);
 const bytes=payloadBytes(input.payload),next=input.action==='restore'?input.version:expected===null?1:expected+1;if(next>2147483646)throw new JournalError('La versión del script alcanzó su límite técnico.',422);
 statements.push(db.prepare('UPDATE script_vaults SET quota_bytes=? WHERE user_id=?').bind(quota(owner),user));
 const created=input.action==='restore'?input.createdAt:now,updated=input.action==='restore'?input.updatedAt:now;
 if(expected===null)statements.push(db.prepare('INSERT INTO private_scripts(user_id,id,version,vault_id,metadata,ciphertext,cipher_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(user,input.id,next,input.vaultId,JSON.stringify(input.payload.metadata),JSON.stringify(input.payload.code),bytes,created,updated));
 else statements.push(db.prepare('UPDATE private_scripts SET version=?,metadata=?,ciphertext=?,cipher_bytes=?,updated_at=? WHERE user_id=? AND id=? AND version=?').bind(next,JSON.stringify(input.payload.metadata),JSON.stringify(input.payload.code),bytes,now,user,input.id,expected));
 await batch(db,statements);return {id:input.id,version:next};
}
