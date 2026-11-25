import assert from 'node:assert/strict';
const original=globalThis.Function;let attempts=0;
globalThis.Function=new Proxy(original,{apply(){attempts++;throw new EvalError('Isolated no-eval policy');},construct(){attempts++;throw new EvalError('Isolated no-eval policy');}});
try{
 const {accountSchema,actionSchema,blankJournal}=await import('../lib/journal.ts');
 const {exampleJournal}=await import('../lib/demo.ts');
 assert.ok(accountSchema.safeParse(exampleJournal('2026-11-22').accounts[0]).success);
 assert.equal(actionSchema.safeParse({action:'savePlan',version:0,plan:blankJournal.plan}).success,true);
 assert.equal(actionSchema.safeParse({action:'savePlan',version:-1,plan:blankJournal.plan}).success,false);
 assert.equal(attempts,0,'Ni la detección JIT ni la validación deben intentar Function bajo CSP');
 console.log('check-validation-csp: esquemas y validaciones reales sin intentar compilación dinámica; entrada inválida sigue rechazada.');
}finally{globalThis.Function=original;}
