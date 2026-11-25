import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const scanner=path.resolve('scripts/check-secret-exposure.mjs'),dir=await mkdtemp(path.join(tmpdir(),'tradeify-secret-scanner-'));
const dummy='TEST_ONLY_'+('x'.repeat(36)),fakePat='ghp_'+('x'.repeat(36));
const git=(...args)=>execFileSync('git',['-C',dir,...args],{stdio:'pipe'});
try{
 git('init');git('config','user.name','Isolated fixture');git('config','user.email','fixture@example.test');
 await writeFile(path.join(dir,'config.json'),JSON.stringify({TRADEIFY_SESSION_SECRET:dummy}));
 await writeFile(path.join(dir,'runtime-config.txt'),'TRADEIFY_EMAIL_API_KEY='+dummy);
 git('add','.');git('commit','-m','Isolated fake token '+fakePat);
 execFileSync(process.execPath,[scanner,'evidence'],{cwd:dir,stdio:'pipe'});
 const result=JSON.parse(await readFile(path.join(dir,'evidence/secret-scan.json'),'utf8'));
 assert.ok(result.candidates.some(c=>c.kind==='assigned-secret'&&c.location==='working:config.json'));
 assert.ok(result.candidates.some(c=>c.kind==='assigned-secret'&&c.location==='working:runtime-config.txt'));
 assert.ok(result.candidates.some(c=>c.kind==='github-token'&&c.location.startsWith('commit-message:')));
 assert.ok(!JSON.stringify(result).includes(dummy));assert.ok(!JSON.stringify(result).includes(fakePat));
 console.log('check-secret-scanner: JSON entrecomillado, asignación sin comillas e historial de mensajes detectados sin imprimir valores. Repositorio ficticio eliminado.');
}finally{await rm(dir,{recursive:true,force:true});}
