/**
 * Client-side encryption primitives for private scripts. No network, storage or
 * code execution. The UI must keep keys in memory and send only sealed values.
 * Security boundary: a trusted browser/front-end. This cannot protect against a
 * compromised device, XSS or an operator serving modified JavaScript.
 */
export type Sealed = {iv:string; data:string};
export type VaultEnvelope = {
  format:1; id:string; salt:string; iterations:600000;
  password:Sealed; recovery:Sealed;
};
export type PlainScript = {title:string; description:string; code:string};
export type EncryptedScript = {metadata:Sealed; code:Sealed};
export const SCRIPT_LIMITS = Object.freeze({
  lines:1000, normalCodeBytes:131072, ownerCodeBytes:524288,
  metadataBytes:4096, normalQuotaBytes:5242880, ownerQuotaBytes:26214400,
});
const ITERATIONS=600000 as const;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure=()=>new Error('Clave incorrecta, archivo inválido o contenido alterado.');
function bytes(value:Uint8Array):Uint8Array<ArrayBuffer>{return new Uint8Array(value);}
function random(size:number):Uint8Array<ArrayBuffer>{return crypto.getRandomValues(new Uint8Array(size));}
function encode(value:Uint8Array):string{
  let binary='';for(let i=0;i<value.length;i+=8192)binary+=String.fromCharCode(...value.subarray(i,i+8192));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(value:unknown,max:number):Uint8Array<ArrayBuffer>{
  if(typeof value!=='string'||!value.length||value.length>Math.ceil(max*4/3)||!/^[A-Za-z0-9_-]+$/.test(value)||value.length%4===1)throw failure();
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  const result=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(result.length>max||encode(result)!==value)throw failure();
  return result;
}
function object(value:unknown,keys:string[]):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
}
function validateBox(value:unknown,max:number):asserts value is Sealed{
  if(!object(value,['iv','data'])||decode(value.iv,12).length!==12||decode(value.data,max).length<16)throw failure();
}
export function validateVaultEnvelope(value:unknown):asserts value is VaultEnvelope{
  if(!object(value,['format','id','salt','iterations','password','recovery'])||value.format!==1||
    typeof value.id!=='string'||!UUID.test(value.id)||value.iterations!==ITERATIONS||decode(value.salt,16).length!==16)throw failure();
  validateBox(value.password,48);validateBox(value.recovery,48);
  if(decode(value.password.data,48).length!==48||decode(value.recovery.data,48).length!==48||value.password.iv===value.recovery.iv)throw failure();
}
function validatePassword(password:string):void{
  if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('Usa una clave personal de 12 a 256 caracteres.');
}
function context(vaultId:string,scriptId:string,version:number,field:string):string{
  if(!UUID.test(vaultId)||!UUID.test(scriptId)||!Number.isSafeInteger(version)||version<1)throw failure();
  return 'tradeify:scripts:v1:'+vaultId+':'+scriptId+':'+version+':'+field;
}
async function aes(raw:Uint8Array):Promise<CryptoKey>{
  return crypto.subtle.importKey('raw',bytes(raw),'AES-GCM',false,['encrypt','decrypt']);
}
async function passwordKey(password:string,salt:string):Promise<CryptoKey>{
  validatePassword(password);
  const material=encoder.encode(password);
  try{
    const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveKey']);
    return await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:decode(salt,16)},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }finally{material.fill(0);}
}
async function seal(key:CryptoKey,plain:Uint8Array,aad:string):Promise<Sealed>{
  const iv=random(12);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(aad),tagLength:128},key,bytes(plain));
  return {iv:encode(iv),data:encode(new Uint8Array(encrypted))};
}
async function open(key:CryptoKey,sealed:Sealed,aad:string,max:number):Promise<Uint8Array<ArrayBuffer>>{
  validateBox(sealed,max+16);
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(sealed.iv,12),additionalData:encoder.encode(aad),tagLength:128},key,decode(sealed.data,max+16)));
}
export async function createVault(password:string):Promise<{key:CryptoKey;envelope:VaultEnvelope;recoveryCode:string}>{
  validatePassword(password);
  const id=crypto.randomUUID(),salt=encode(random(16)),raw=random(32),recoveryRaw=random(32);
  try{
    const key=await aes(raw),personal=await passwordKey(password,salt),recoveryKey=await aes(recoveryRaw);
    const passwordBox=await seal(personal,raw,'tradeify:scripts:v1:'+id+':key:password');
    const recoveryBox=await seal(recoveryKey,raw,'tradeify:scripts:v1:'+id+':key:recovery');
    return {key,envelope:{format:1,id,salt,iterations:ITERATIONS,password:passwordBox,recovery:recoveryBox},recoveryCode:encode(recoveryRaw)};
  }finally{raw.fill(0);recoveryRaw.fill(0);}
}
export async function unlockVault(envelope:VaultEnvelope,password:string):Promise<CryptoKey>{
  let raw:Uint8Array|undefined;
  try{
    validateVaultEnvelope(envelope);
    raw=await open(await passwordKey(password,envelope.salt),envelope.password,'tradeify:scripts:v1:'+envelope.id+':key:password',32);
    if(raw.length!==32)throw failure();return await aes(raw);
  }catch{throw failure();}finally{raw?.fill(0);}
}
/** Rewraps the same data key; old backups remain readable with their old password. */
export async function recoverVault(envelope:VaultEnvelope,recoveryCode:string,newPassword:string):Promise<{key:CryptoKey;envelope:VaultEnvelope}>{
  validatePassword(newPassword);
  let raw:Uint8Array|undefined,recoveryRaw:Uint8Array|undefined;
  try{
    validateVaultEnvelope(envelope);recoveryRaw=decode(recoveryCode.trim(),32);if(recoveryRaw.length!==32)throw failure();
    raw=await open(await aes(recoveryRaw),envelope.recovery,'tradeify:scripts:v1:'+envelope.id+':key:recovery',32);
    if(raw.length!==32)throw failure();
    const salt=encode(random(16)),password=await seal(await passwordKey(newPassword,salt),raw,'tradeify:scripts:v1:'+envelope.id+':key:password');
    return {key:await aes(raw),envelope:{...envelope,salt,password}};
  }catch{throw failure();}finally{raw?.fill(0);recoveryRaw?.fill(0);}
}
export function scriptLineCount(code:string):number{
  let count=1;
  for(let i=0;i<code.length;i++){if(code[i]==='\r'){count++;if(code[i+1]==='\n')i++;}else if(code[i]==='\n')count++;}
  return count;
}
function validatePlain(value:unknown,owner:boolean,draft:boolean):asserts value is PlainScript{
  if(!object(value,['title','description','code'])||typeof value.title!=='string'||typeof value.description!=='string'||typeof value.code!=='string')throw failure();
  if(value.title.length>100||value.description.length>1000||(!draft&&!value.title.trim()))throw new Error('Revisa el nombre y la descripción del script.');
  if(encoder.encode(JSON.stringify({title:value.title,description:value.description})).length>SCRIPT_LIMITS.metadataBytes)throw new Error('Los metadatos superan el límite de bytes.');
  const limit=owner?SCRIPT_LIMITS.ownerCodeBytes:SCRIPT_LIMITS.normalCodeBytes;
  if(value.code.length>limit)throw new Error('El código supera el límite de bytes.');
  const utf8=encoder.encode(value.code);
  try{
    if(utf8.length>limit)throw new Error('El código supera el límite de bytes.');
    // TextEncoder replaces unpaired surrogates. Reject rather than silently
    // changing an imported source document while encrypting it.
    if(decoder.decode(utf8)!==value.code)throw new Error('El código contiene Unicode no válido. Conserva el archivo original y revisa su codificación.');
  }finally{utf8.fill(0);}
  // Deliberately an editor policy, NOT a server-verifiable encrypted line count.
  if(!owner&&!draft&&scriptLineCount(value.code)>SCRIPT_LIMITS.lines)throw new Error('El editor admite hasta 1.000 líneas.');
}
export async function encryptScript(key:CryptoKey,vaultId:string,id:string,version:number,value:PlainScript,owner=false):Promise<EncryptedScript>{
  validatePlain(value,owner,false);
  const meta=encoder.encode(JSON.stringify({title:value.title,description:value.description})),code=encoder.encode(value.code);
  try{return {metadata:await seal(key,meta,context(vaultId,id,version,'metadata')),code:await seal(key,code,context(vaultId,id,version,'code'))};}
  finally{meta.fill(0);code.fill(0);}
}
export async function decryptScriptMetadata(key:CryptoKey,vaultId:string,id:string,version:number,sealed:Sealed):Promise<Pick<PlainScript,'title'|'description'>>{
  let raw:Uint8Array|undefined;
  try{
    raw=await open(key,sealed,context(vaultId,id,version,'metadata'),SCRIPT_LIMITS.metadataBytes);
    const value:unknown=JSON.parse(decoder.decode(raw));
    if(!object(value,['title','description']))throw failure();
    const plain={...value,code:''};validatePlain(plain,false,true);
    return {title:plain.title,description:plain.description};
  }catch{throw failure();}finally{raw?.fill(0);}
}
export async function decryptScript(key:CryptoKey,vaultId:string,id:string,version:number,payload:EncryptedScript,owner=false):Promise<PlainScript>{
  let meta:Uint8Array|undefined,code:Uint8Array|undefined;
  try{
    if(!object(payload,['metadata','code'])||payload.metadata.iv===payload.code.iv)throw failure();
    meta=await open(key,payload.metadata,context(vaultId,id,version,'metadata'),SCRIPT_LIMITS.metadataBytes);
    code=await open(key,payload.code,context(vaultId,id,version,'code'),owner?SCRIPT_LIMITS.ownerCodeBytes:SCRIPT_LIMITS.normalCodeBytes);
    const metadata:unknown=JSON.parse(decoder.decode(meta));if(!object(metadata,['title','description']))throw failure();
    const value={title:metadata.title,description:metadata.description,code:decoder.decode(code)};
    // Encrypted data may come from a modified client. Decode safely by bytes,
    // leaving the editor to display/enforce its line-count policy on save.
    validatePlain(value,owner,true);return value;
  }catch{throw failure();}finally{meta?.fill(0);code?.fill(0);}
}
/** Local drafts stay encrypted even when they are not yet valid for saving. */
export async function encryptScriptDraft(key:CryptoKey,vaultId:string,id:string,value:PlainScript,owner=false):Promise<Sealed>{
  validatePlain(value,owner,true);const plain=encoder.encode(JSON.stringify(value));
  try{return await seal(key,plain,context(vaultId,id,1,'local-draft'));}
  finally{plain.fill(0);}
}
export async function decryptScriptDraft(key:CryptoKey,vaultId:string,id:string,value:Sealed,owner=false):Promise<PlainScript>{
  let raw:Uint8Array|undefined;
  try{
    // JSON escaping may expand each source byte to six ASCII bytes.
    const maximum=6*(owner?SCRIPT_LIMITS.ownerCodeBytes:SCRIPT_LIMITS.normalCodeBytes)+6*SCRIPT_LIMITS.metadataBytes+100;
    raw=await open(key,value,context(vaultId,id,1,'local-draft'),maximum);
    const plain:unknown=JSON.parse(decoder.decode(raw));validatePlain(plain,owner,true);return plain;
  }catch{throw failure();}finally{raw?.fill(0);}
}
