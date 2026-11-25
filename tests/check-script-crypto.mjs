import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile('lib/script-crypto.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const {createVault,unlockVault,recoverVault,encryptScript,decryptScript,encryptScriptDraft,decryptScriptDraft,scriptLineCount,validateVaultEnvelope,SCRIPT_LIMITS}=api;
const checks=[];
async function check(name,job){await job();checks.push(name);console.log('PASS scripts crypto: '+name);}
const password='clave ficticia personal 2026',nextPassword='otra clave ficticia personal 2026';
const vault=await createVault(password),id=crypto.randomUUID();
const plain={title:'Título privado de prueba',description:'Descripción privada 🛡️',code:'//@version=6\nindicator("Solo prueba")\nplot(close)\n'};
const payload=await encryptScript(vault.key,vault.envelope.id,id,1,plain);
await check('AES-GCM roundtrip y clave no extraíble',async()=>{
  assert.equal(vault.key.extractable,false);
  await assert.rejects(crypto.subtle.exportKey('raw',vault.key));
  assert.deepEqual(await decryptScript(vault.key,vault.envelope.id,id,1,payload),plain);
  const wire=JSON.stringify({envelope:vault.envelope,payload});
  for(const secret of [password,vault.recoveryCode,plain.title,plain.description,'indicator','Solo prueba','plot(close)']){
    assert.equal(wire.includes(secret),false,'El sobre contiene texto privado: '+secret);
    assert.equal(wire.includes(JSON.stringify(secret).slice(1,-1)),false);
  }
});
await check('Desbloqueo y rechazo de clave errónea sin revelar datos',async()=>{
  const key=await unlockVault(vault.envelope,password);assert.equal(key.extractable,false);
  assert.deepEqual(await decryptScript(key,vault.envelope.id,id,1,payload),plain);
  await assert.rejects(unlockVault(vault.envelope,'contraseña equivocada válida'),/Clave incorrecta/);
});
await check('Identidad, versión y campo están autenticados',async()=>{
  await assert.rejects(decryptScript(vault.key,crypto.randomUUID(),id,1,payload));
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,crypto.randomUUID(),1,payload));
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,2,payload));
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,1,{metadata:payload.code,code:payload.metadata}));
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,0,plain));
});
await check('Alteraciones, formato no canónico y algoritmos manipulados se rechazan',async()=>{
  const mutate=value=>({...value,data:(value.data[0]==='A'?'B':'A')+value.data.slice(1)});
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,1,{...payload,code:mutate(payload.code)}));
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,1,{...payload,metadata:{...payload.metadata,iv:payload.metadata.iv+'='}}));
  await assert.rejects(unlockVault({...vault.envelope,iterations:1},password));
  await assert.rejects(unlockVault({...vault.envelope,password:mutate(vault.envelope.password)},password));
  await assert.rejects(unlockVault({...vault.envelope,id:crypto.randomUUID()},password));
  assert.throws(()=>validateVaultEnvelope({...vault.envelope,plaintext:'rechazar'}));
});
await check('IV aleatorio distinto por cifrado y por campo',async()=>{
  const another=await encryptScript(vault.key,vault.envelope.id,id,1,plain);
  assert.equal(new Set([payload.metadata.iv,payload.code.iv,another.metadata.iv,another.code.iv,vault.envelope.password.iv,vault.envelope.recovery.iv]).size,6);
  assert.notEqual(payload.code.data,another.code.data);
});
await check('Recuperación cambia envoltura, conserva datos y requiere el código',async()=>{
  await assert.rejects(recoverVault(vault.envelope,'código incorrecto',nextPassword));
  const recovered=await recoverVault(vault.envelope,vault.recoveryCode,nextPassword);
  assert.equal(recovered.key.extractable,false);assert.equal(recovered.envelope.id,vault.envelope.id);
  assert.notEqual(recovered.envelope.salt,vault.envelope.salt);
  assert.notEqual(recovered.envelope.password.data,vault.envelope.password.data);
  assert.deepEqual(recovered.envelope.recovery,vault.envelope.recovery);
  assert.deepEqual(await decryptScript(recovered.key,vault.envelope.id,id,1,payload),plain);
  assert.deepEqual(await decryptScript(await unlockVault(recovered.envelope,nextPassword),vault.envelope.id,id,1,payload),plain);
  await assert.rejects(unlockVault(recovered.envelope,password));
  // Recovery rewraps, not revokes: the old exported envelope still opens.
  assert.deepEqual(await decryptScript(await unlockVault(vault.envelope,password),vault.envelope.id,id,1,payload),plain);
});
await check('Política de líneas del editor y límite real de bytes son independientes',async()=>{
  assert.equal(scriptLineCount(''),1);assert.equal(scriptLineCount('a\r\nb\rc\nd'),4);
  const thousand={...plain,code:Array(1000).fill('x').join('\n')};
  await encryptScript(vault.key,vault.envelope.id,id,1,thousand);
  const over={...plain,code:Array(1001).fill('x').join('\n')};
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,over),/1.000/);
  const ownerPayload=await encryptScript(vault.key,vault.envelope.id,id,1,over,true);
  // A modified client can bypass line policy. Safe decoding does not certify it.
  assert.deepEqual(await decryptScript(vault.key,vault.envelope.id,id,1,ownerPayload),over);
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,code:'x'.repeat(SCRIPT_LIMITS.normalCodeBytes+1)}),/bytes/);
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,code:'x'.repeat(SCRIPT_LIMITS.ownerCodeBytes+1)},true),/bytes/);
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,code:'é'.repeat(SCRIPT_LIMITS.normalCodeBytes/2+1)}),/bytes/);
  const larger={...plain,code:'x'.repeat(SCRIPT_LIMITS.normalCodeBytes+1)};
  const ownerCipher=await encryptScript(vault.key,vault.envelope.id,id,1,larger,true);
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,1,ownerCipher));
  assert.deepEqual(await decryptScript(vault.key,vault.envelope.id,id,1,ownerCipher,true),larger);
});
await check('Borradores incompletos o con más líneas se cifran sin convertirse en guardados válidos',async()=>{
  const draft={title:'',description:'',code:'\n'.repeat(1001)};
  const sealed=await encryptScriptDraft(vault.key,vault.envelope.id,id,draft);
  assert.deepEqual(await decryptScriptDraft(vault.key,vault.envelope.id,id,sealed),draft);
  await assert.rejects(decryptScriptDraft(vault.key,vault.envelope.id,crypto.randomUUID(),sealed));
  await assert.rejects(decryptScript(vault.key,vault.envelope.id,id,1,{metadata:sealed,code:sealed}));
  const controls={title:'',description:'',code:'\u0000'.repeat(20000)};
  assert.deepEqual(await decryptScriptDraft(vault.key,vault.envelope.id,id,await encryptScriptDraft(vault.key,vault.envelope.id,id,controls)),controls);
});
await check('Nombres, descripciones y claves personales inválidas se rechazan',async()=>{
  await assert.rejects(createVault('corta'),/12 a 256/);
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,code:'\ud800'}),/Unicode/);
  await assert.rejects(encryptScriptDraft(vault.key,vault.envelope.id,id,{...plain,code:'\udc00'}),/Unicode/);
  await assert.rejects(createVault('x'.repeat(257)),/12 a 256/);
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,title:''}));
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,title:'x'.repeat(101)}));
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,description:'x'.repeat(1001)}));
  await assert.rejects(encryptScript(vault.key,vault.envelope.id,id,1,{...plain,title:'\u0000'.repeat(100),description:'\u0000'.repeat(1000)}),/metadatos/);
});
console.log('check-script-crypto: '+checks.length+' grupos aprobados. Solo primitivas; no acredita editor, API ni recuperación operacional.');
