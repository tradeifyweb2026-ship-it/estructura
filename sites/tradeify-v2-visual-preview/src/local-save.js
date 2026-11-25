import{actionSchema}from '../../../lib/journal';
import{applyJournalUpdate}from '../../../lib/journal-update';
/** Same validation; all mutations remain in the demo ref. No HTTP. */
export function mutateLocal(current,input,imports=new Set()){
 const action=actionSchema.parse(input);const id='id'in action?action.id:undefined;let result={},next=current;
 const kind={saveTrade:'trades',saveAccount:'accounts',saveSetup:'setups',restoreSetupVersion:'setups',deleteTrade:'trades'}[action.action];
 const old=kind?current[kind].find(r=>r.id===id):null;
 if(kind&&'version'in action&&((old&&old.version!==action.version)||(!old&&action.version>0)))throw Error('409 de demostración: la versión local cambió. Tus cambios se conservan en el editor.');
 if(action.action==='saveTrade'){const trade={...action.trade,id,version:(old?.version??0)+1};result={id,version:trade.version,trade};}
 if(action.action==='deleteTrade')result={id};
 if(action.action==='saveAccount'){const account={...action.account,id,version:(old?.version??0)+1};result={id,version:account.version,account};}
 if(action.action==='saveSetup'||action.action==='restoreSetupVersion'){
  const previous=old?{...old,savedAt:Date.now()}:null,source=action.action==='restoreSetupVersion'?old?.versions?.find(v=>v.version===action.sourceVersion):action.setup;
  if(!source)throw Error('No hay esa versión local.');
  const setup={...source,id,version:(old?.version??0)+1,versions:previous?[...(old.versions??[]),previous].slice(-20):[]};result={id,version:setup.version,setup};
 }
 if(action.action==='savePlan'){if(action.version!==current.planVersion)throw Error('409 de demostración: plan modificado.');result={version:current.planVersion+1};}
 if(action.action==='saveReview'){const existing=current.reviews.find(r=>r.week===action.week&&r.scope===action.scope);if((existing?.version??0)!==action.version)throw Error('409 de demostración: revisión modificada.');result={version:action.version+1};}
 if(action.action==='importTrades'){
  const fresh=action.trades.filter(t=>{if(imports.has(t.key))return false;imports.add(t.key);return true;});next={...current,trades:[...fresh.map(t=>({...t.trade,id:t.id,version:1})),...current.trades]};result={imported:fresh.length,skipped:action.trades.length-fresh.length};
 }else if(action.action==='restoreBatch'){
  const batch=action.batch,table={accounts:'accounts',setups:'setups',trades:'trades',reviews:'reviews'}[batch.kind];
  if(table){const fresh=batch.records.filter(r=>!current[table].some(x=>table==='reviews'?x.week===r.week&&x.scope===r.scope:x.id===r.id));next={...current,[table]:[...current[table],...fresh]};result={imported:fresh.length,records:[]};}
  else if(batch.kind==='plan'){next={...current,plan:batch.record??current.plan,planVersion:current.planVersion+1};result={imported:1,records:[]};}
 }else next=applyJournalUpdate(current,action,result)??current;
 return{journal:next,result};
}
