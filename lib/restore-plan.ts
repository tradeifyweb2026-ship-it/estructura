import {accountSchema,setupSchema,tradeSchema,reviewSchema,planSchema,type Backup,type Journal,type JournalAction} from "./journal.ts";
import {restoreDecision} from "./restore-compare.mjs";
type Batch=Extract<JournalAction,{action:"restoreBatch"}>["batch"];
type PreviewRecord={kind:Batch["kind"];key:string;status:"new"|"skipped"|"rejected";reason?:string};
export function planRestore(backup:Backup,journal:Journal){
 const batches:Batch[]=[];const records:PreviewRecord[]=[];let conflicts=0,skipped=0,added=0;
 const existingAccounts=new Map(journal.accounts.map(r=>[r.id,r]));
 const existingSetups=new Map(journal.setups.map(r=>[r.id,r]));
 const existingTrades=new Map(journal.trades.map(r=>[r.id,r]));
 const existingReviews=new Map(journal.reviews.map(r=>[r.week+":"+r.scope,r]));
 const decide=(kind:Batch["kind"],key:string,existing:unknown,incoming:unknown)=>{
  const d=restoreDecision(existing,incoming);
  if(d==="conflict")conflicts++;else if(d==="skip")skipped++;else added++;
  records.push({kind,key,status:d==="conflict"?"rejected":d==="skip"?"skipped":"new",...(d==="conflict"?{reason:"Contenido diferente de un registro existente"}:{})});
  return d==="add";
 };
 const reject=(kind:Batch["kind"],key:string)=>{conflicts++;records.push({kind,key,status:"rejected",reason:"Cuenta o estrategia inexistente"});return false;};
 const accounts=backup.cuentas.filter(r=>{const old=existingAccounts.get(r.id);return decide("accounts",r.id,old?accountSchema.parse(old):undefined,accountSchema.parse(r))});
 const normalizeSetup=(r:Backup["setups"][number])=>({...setupSchema.parse(r),versions:r.versions??[]});
 const setups=backup.setups.filter(r=>{const old=existingSetups.get(r.id);return decide("setups",r.id,old?normalizeSetup(old):undefined,normalizeSetup(r))});
 const accountIds=new Set([...existingAccounts.keys(),...backup.cuentas.map(r=>r.id)]);
 const setupIds=new Set([...existingSetups.keys(),...backup.setups.map(r=>r.id)]);
 const trades=backup.operaciones.filter(r=>{
  if((r.accountId&&!accountIds.has(r.accountId))||(r.setupId&&!setupIds.has(r.setupId)))return reject("trades",r.id);
  const old=existingTrades.get(r.id);return decide("trades",r.id,old?tradeSchema.parse(old):undefined,tradeSchema.parse(r));
 });
 const reviews=backup.revisiones.filter(r=>{
  const key=r.week+":"+r.scope;
  if(r.scope!=="all"&&r.scope!=="unassigned"&&!accountIds.has(r.scope))return reject("reviews",key);
  const old=existingReviews.get(key);return decide("reviews",key,old?reviewSchema.parse(old):undefined,reviewSchema.parse(r));
 });
 for(let i=0;i<accounts.length;i+=10)batches.push({kind:"accounts",records:accounts.slice(i,i+10)});
 for(let i=0;i<setups.length;i+=10)batches.push({kind:"setups",records:setups.slice(i,i+10)});
 for(let i=0;i<trades.length;i+=10)batches.push({kind:"trades",records:trades.slice(i,i+10)});
 for(let i=0;i<reviews.length;i+=10)batches.push({kind:"reviews",records:reviews.slice(i,i+10)});
 if(decide("plan","plan",journal.planVersion?planSchema.parse(journal.plan):undefined,backup.plan))batches.push({kind:"plan",record:backup.plan});
 return {batches,records,conflicts,skipped,added};
}
