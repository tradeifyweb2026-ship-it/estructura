import {sectionMetadata} from '../lib/section-context';
import {createHash} from 'node:crypto';
import {consistentBatch,source} from './journal-query';
import {JournalError} from './repository';
import {blankJournal,dayKey,inputDate,type Journal,type Trade} from '../lib/journal';
import {psychologyModel,riskModel,accountModels,strategyModels,reviewModel,type SectionName} from '../lib/section-models';
import type {TradeQuery} from '../lib/journal-query';

export async function querySection(db:D1Database,user:string,section:SectionName,q:TradeQuery,options:{start?:string;end?:string;previous?:string;reviewKey?:string;historyBefore?:string}={}){
 if(q.q||q.setup||q.asset||q.emotion||q.direction||q.state||q.result)throw new JournalError('Esta sección admite cuenta y periodo; usa la consulta de estadísticas para filtros de operaciones.',422);
 if(section!=='psicologia'&&(q.from||q.to))throw new JournalError('Esta sección utiliza su periodo propio o el historial de la cuenta.',422);
 if(options.historyBefore&&!/^(month:)?\d{4}-\d{2}(-\d{2})?$/.test(options.historyBefore))throw new JournalError('Cursor de revisiones no válido.',422);
 const key=createHash('sha256').update('v2:'+JSON.stringify({section,q,options,today:dayKey(Date.now())})).digest('hex');
 const hit=await consistentBatch(db,user,undefined,[db.prepare('SELECT revision,data FROM journal_section_cache WHERE user_id=? AND cache_key=?').bind(user,key)]);
 const cached=hit.results[0].results[0] as {revision:number;data:string}|undefined;
 if(cached&&cached.revision===hit.revision)return {...JSON.parse(cached.data),revision:hit.revision,cache:'hit'};
 // Full-series metrics execute in the Worker. Private notes/captures never leave
 // D1 for these reads; only bounded aggregates and a separately paged list reach UI.
 const all={...q,from:undefined,to:undefined,q:'',setup:undefined,asset:undefined,emotion:undefined,direction:undefined,state:undefined,result:undefined};
 let selection=section==='cuentas'||section==='estrategias'||section==='riesgo'||section==='psicologia'?all:q;
 if(section==='revision'){
  for(const date of [options.start,options.end,options.previous])if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(inputDate(date+'T00:00')))throw new JournalError('Periodo de revisión no válido.',422);
  if(options.previous!>=options.start!||options.start!>=options.end!)throw new JournalError('Orden de periodos no válido.',422);
  selection={...all,from:options.previous,to:options.end,state:'closed'};
 }
 const {cte,args}=source(user,selection);
 const original="CASE WHEN json_extract(data,'$.market.id') IS NOT NULL THEN json_set(data,'$.market.name',market_label) ELSE data END";
 const projection="json_set(json_remove("+original+",'$.notes','$.captureLinks','$.checklist'),'$.notes',json('[]'),'$.checklist',json(COALESCE((SELECT json_group_array(json_object('text','','checked',json_extract(c.value,'$.checked'))) FROM json_each(COALESCE(json_extract(data,'$.checklist'),'[]')) c),'[]')))";
 const read=await consistentBatch(db,user,hit.revision,[db.prepare(cte+' SELECT id,version,opened_at,account_id,setup_id,'+projection+' data FROM selected ORDER BY opened_at,id').bind(...args),db.prepare('SELECT id,version,data FROM accounts WHERE user_id=?').bind(user),db.prepare('SELECT id,version,data FROM setups WHERE user_id=?').bind(user),db.prepare('SELECT data,version FROM plans WHERE user_id=?').bind(user),db.prepare("SELECT week,scope,version,NULL data FROM reviews WHERE user_id=? AND scope=? AND (?='' OR replace(week,'month:','')<replace(?,'month:','')) ORDER BY replace(week,'month:','') DESC,week DESC LIMIT 21").bind(user,q.scope,options.historyBefore??'',options.historyBefore??''),db.prepare('SELECT week,scope,version,data FROM reviews WHERE user_id=? AND scope=? AND week=?').bind(user,q.scope,options.reviewKey??'')]);
 const history=(read.results[0].results as {id:string;version:number;opened_at:number;account_id:string|null;setup_id:string|null;data:string}[]).map(r=>({...JSON.parse(r.data),id:r.id,version:r.version,openedAt:r.opened_at,accountId:r.account_id,setupId:r.setup_id}) as Trade);
 const stored=(i:number)=>(read.results[i].results as {id:string;version:number;data:string}[]).map(r=>({...JSON.parse(r.data),id:r.id,version:r.version}));
 const plan=read.results[3].results[0] as {data:string;version:number}|undefined;
 const reviews=read.results[4].results as {data:string|null;week:string;scope:Journal['reviews'][number]['scope'];version:number}[];
 const currentReview=read.results[5].results[0] as (typeof reviews)[number]|undefined;
 const journal:Journal={...blankJournal,accounts:stored(1),setups:stored(2),plan:plan?JSON.parse(plan.data):blankJournal.plan,planVersion:plan?.version??0,reviews:[...reviews.slice(0,20).filter(r=>r.week!==currentReview?.week),...(currentReview?[currentReview]:[])].map(r=>({...r.data?JSON.parse(r.data):{followed:'',repeat:'',change:''},week:r.week,scope:r.scope,version:r.version}))};
 const cohort=history.filter(t=>{const d=dayKey(t.closedAt??t.openedAt);return (!q.from||d>=q.from)&&(!q.to||d<=q.to);});
 const model=section==='psicologia'?psychologyModel(history,cohort,journal):section==='cuentas'?accountModels(history,journal):section==='estrategias'?strategyModels(history,journal):section==='riesgo'?riskModel(history,journal,dayKey(Date.now())):{...reviewModel(history,journal,q,options.start!,options.end!,options.previous!,options.reviewKey??''),history:reviews.slice(0,20).map(r=>({week:r.week,version:r.version})),historyNext:reviews.length>20?reviews[19].week:null};
 const value={section,model,metadata:sectionMetadata(journal)};
 await db.batch([db.prepare('INSERT INTO journal_section_cache(user_id,cache_key,revision,data,updated_at) SELECT ?,?,?,?,? WHERE (SELECT coalesce((SELECT version FROM journal_revisions WHERE user_id=?),0))=? ON CONFLICT(user_id,cache_key) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at').bind(user,key,read.revision,JSON.stringify(value),Date.now(),user,read.revision),db.prepare('DELETE FROM journal_section_cache WHERE user_id=? AND coalesce((SELECT version FROM journal_revisions WHERE user_id=?),0)=? AND (revision<>? OR cache_key NOT IN(SELECT cache_key FROM journal_section_cache WHERE user_id=? ORDER BY updated_at DESC LIMIT 32))').bind(user,user,read.revision,read.revision,user)]);
 return {...value,revision:read.revision,cache:'miss'};
}
