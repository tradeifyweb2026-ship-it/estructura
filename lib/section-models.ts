import {dayKey,inputDate,resultR,type Journal,type Trade} from './journal.ts';
import {assetGroups,groups,afterLossGroups,entryOrdinals,summarize,realized} from './stats.ts';
import {encodeSummary,type TradeQuery} from './journal-query.ts';
import {accountTotals} from './account-totals.mjs';
import {dailyRisk,accountRisks,openRisk} from './risk.ts';
import {drawdownControls} from './drawdown.ts';

export type SectionName='psicologia'|'revision'|'cuentas'|'estrategias'|'riesgo';
export function psychologyModel(history:Trade[],trades:Trade[],journal:Journal){
 const closed=realized(trades),summary=summarize(trades,journal.accounts);
 const stages=(['before','during','after'] as const).map(stage=>{const known=closed.filter(t=>t[stage]);return {stage,count:known.length,intensity:known.length?known.reduce((s,t)=>s+t[stage]!.intensity,0)/known.length:null,groups:groups(known,t=>t[stage]!.name,true)};});
 const errors=[...new Set(closed.flatMap(t=>t.errors))].map(label=>{const rows=closed.filter(t=>t.errors.includes(label));return {label,count:rows.length,meanR:summarize(rows,journal.accounts).meanR,withR:rows.filter(t=>resultR(t)!==null).length};}).sort((a,b)=>b.count-a.count);
 const rules=closed.flatMap(t=>t.checklist),ordinals=entryOrdinals(history);
 return {summary:encodeSummary(summary),stages,errors,checklist:{total:rules.length,checked:rules.filter(r=>r.checked).length},risk:{known:trades.filter(t=>t.riskPercent!==null).length,total:trades.length,above:journal.plan.riskPercent===null?null:trades.filter(t=>t.riskPercent!==null&&t.riskPercent>journal.plan.riskPercent!).length},afterLoss:afterLossGroups(history,trades),ordinals:groups(trades,t=>{const n=ordinals.get(t.id)??0;return n===1?'Primera':n===2?'Segunda':'Tercera o posterior';},true)};
}
export function riskModel(trades:Trade[],journal:Journal,today:string){
 // Stable account ordering across database reads and restored metadata.
 journal={...journal,accounts:journal.accounts.slice().sort((a,b)=>a.id.localeCompare(b.id))};
 const open=trades.filter(t=>t.closedAt===null);
 return {daily:dailyRisk(trades,today,journal.plan.dailyLossR),summary:encodeSummary(summarize(trades,journal.accounts)),perAccount:accountRisks(trades,journal.accounts,today,journal.plan.dailyLossR).map(g=>({id:g.account?.id??null,name:g.account?.name??'Sin cuenta',daily:g.daily,simultaneousPercent:g.simultaneousPercent,simultaneousStatus:g.simultaneousStatus,aboveTradeLimit:g.aboveTradeLimit})),openCount:open.length,partialCount:open.filter(t=>t.partials.length).length,
 exposure:journal.accounts.map(account=>{const rows=open.filter(t=>t.accountId===account.id),risk=rows.map(openRisk);return {id:account.id,count:rows.length,initialKnown:risk.filter(r=>r.initialCents!==null).length,remainingKnown:risk.filter(r=>r.remainingCents!==null).length,initial:risk.reduce((s,r)=>s+(r.initialCents??0),0),remaining:risk.reduce((s,r)=>s+(r.remainingCents??0),0)};}).filter(g=>g.count),unassigned:open.filter(t=>!journal.accounts.some(a=>a.id===t.accountId)).length,
 drawdowns:journal.accounts.filter(a=>trades.some(t=>t.accountId===a.id)).map(account=>{const m=drawdownControls(account,trades.filter(t=>t.accountId===account.id),today);return {id:account.id,basisLabel:m.basisLabel,complete:m.complete,missingClosed:m.missingClosed,missingRealized:m.missingRealized,movements:m.movements,future:m.future,checks:m.checks,fundingChecks:m.fundingChecks,funding:m.funding};})};
}
export function accountModels(trades:Trade[],journal:Journal){
 const buckets=new Map<string,Trade[]>();for(const t of trades)if(t.accountId){const b=buckets.get(t.accountId)??[];b.push(t);buckets.set(t.accountId,b);}
 return journal.accounts.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(a=>{const rows=buckets.get(a.id)??[];const d=drawdownControls(a,rows,dayKey(Date.now()));return {id:a.id,totals:accountTotals(a.startingBalanceCents,a.movements??[],rows),summary:encodeSummary(summarize(rows,[a],a.currency)),drawdown:d.checks,funding:d.funding};});
}
export function strategyModels(trades:Trade[],journal:Journal){
 const buckets=new Map<string,Trade[]>();for(const t of trades)if(t.setupId){const b=buckets.get(t.setupId)??[];b.push(t);buckets.set(t.setupId,b);}
 return journal.setups.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(s=>{const rows=buckets.get(s.id)??[];return {id:s.id,summary:encodeSummary(summarize(rows,journal.accounts)),assets:assetGroups(rows),directions:groups(rows,t=>t.direction),months:groups(rows,t=>dayKey(t.closedAt??t.openedAt).slice(0,7)),errors:[...new Set(rows.flatMap(t=>t.errors))].sort().map(label=>({label,count:rows.filter(t=>t.errors.includes(label)).length}))};});
}
export function reviewModel(trades:Trade[],journal:Journal,query:TradeQuery,start:string,end:string,previous:string,reviewKey:string){
 const rows=trades.filter(t=>t.closedAt!==null&&dayKey(t.closedAt)>=start&&dayKey(t.closedAt)<end),prior=trades.filter(t=>t.closedAt!==null&&dayKey(t.closedAt)>=previous&&dayKey(t.closedAt)<start);
 return {summary:encodeSummary(summarize(rows,journal.accounts)),previous:encodeSummary(summarize(prior,journal.accounts)),daily:groups(rows,t=>dayKey(t.closedAt!)),strategies:groups(rows,t=>t.setupId??'unassigned'),review:journal.reviews.find(r=>r.scope===query.scope&&r.week===reviewKey)??null,history:journal.reviews.filter(r=>r.scope===query.scope).map(r=>({week:r.week,version:r.version})),startAt:inputDate(start+'T00:00')};
}
export type PsychologyModel=ReturnType<typeof psychologyModel>;
export type RiskModel=ReturnType<typeof riskModel>;
export type AccountModels=ReturnType<typeof accountModels>;
export type StrategyModels=ReturnType<typeof strategyModels>;
export type ReviewModel=ReturnType<typeof reviewModel>;
