import { dayKey,type Account,type Trade } from "./journal.ts";

type CashEvent={at:number;amount:number;key:string};
type Basis="closed"|"realized";
export type RiskCheck={key:string;label:string;limit:number|null;value:number|null;status:"unconfigured"|"incomplete"|"reached"|"within";basis:string};
function balanceSeries(initial:number,events:CashEvent[],today:string){
 let balance=initial,peak=initial,maxDrawdown=0,maxDrawdownPercent=0,minBalance=initial,opening=initial,dailyPeak=initial,dailyDrawdown=0,dailyLoss=0;
 const days=new Map<string,number>();
 for(const event of events.slice().sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key))){
  const day=dayKey(event.at);if(day>today)continue;
  if(day<today){balance+=event.amount;opening=balance;dailyPeak=balance;}
  else{balance+=event.amount;dailyPeak=Math.max(dailyPeak,balance);if(dailyPeak>0)dailyDrawdown=Math.max(dailyDrawdown,(dailyPeak-balance)/dailyPeak*100);if(opening>0)dailyLoss=Math.max(dailyLoss,(opening-balance)/opening*100);}
  peak=Math.max(peak,balance);minBalance=Math.min(minBalance,balance);
  maxDrawdown=Math.max(maxDrawdown,peak-balance);if(peak>0)maxDrawdownPercent=Math.max(maxDrawdownPercent,(peak-balance)/peak*100);
  days.set(day,(days.get(day)??0)+event.amount);
 }
 const profit=balance-initial,totalLossPercent=initial>0?Math.max(0,(initial-minBalance)/initial*100):null;
 return {balance,profit,opening,maxDrawdown,maxDrawdownPercent,dailyDrawdownPercent:dailyDrawdown,dailyLossPercent:opening>0?dailyLoss:null,totalLossPercent,days};
}
export function drawdownControls(account:Account,trades:Trade[],today:string){
 const closed:CashEvent[]=[],realized:CashEvent[]=[];let missingClosed=0,missingRealized=0;
 const future=trades.some(t=>dayKey(t.openedAt)>today||t.closedAt!==null&&dayKey(t.closedAt)>today||t.partials.some(p=>p.at!=null&&dayKey(p.at)>today));
 for(const trade of trades){
  if(dayKey(trade.openedAt)>today)continue;
  const isClosed=trade.closedAt!==null&&dayKey(trade.closedAt)<=today;
  if(isClosed){if(trade.pnlCents===null)missingClosed++;else closed.push({at:trade.closedAt!,amount:trade.pnlCents,key:trade.id});}
  let partialSum=0,partialsComplete=true;
  for(let i=0;i<trade.partials.length;i++){
   const fill=trade.partials[i];
   if(fill.at==null||fill.pnlCents==null){partialsComplete=false;missingRealized++;continue;}
   partialSum+=fill.pnlCents;
   realized.push({at:fill.at,amount:fill.pnlCents,key:trade.id+":"+String(i).padStart(2,"0")});
  }
  if(isClosed){if(trade.pnlCents===null)missingRealized++;else if(partialsComplete)realized.push({at:trade.closedAt!,amount:trade.pnlCents-partialSum,key:trade.id+":final"});}
 }
 const movements=account.movements?.length??0,capital=account.startingBalanceCents;
 const closedComplete=capital>0&&missingClosed===0&&!future&&movements===0;
 const realizedComplete=capital>0&&missingRealized===0&&!future&&movements===0;
 const basis:Basis=account.riskLimits?.drawdownBasis??"realized";
 const seriesClosed=balanceSeries(capital,closed,today),seriesRealized=balanceSeries(capital,realized,today);
 const active=basis==="closed"?seriesClosed:seriesRealized,complete=basis==="closed"?closedComplete:realizedComplete;
 const basisLabel=basis==="closed"?"Saldo de operaciones cerradas":"Saldo realizado con parciales fechados";
 function check(key:string,label:string,limit:number|null|undefined,value:number|null,known:boolean,description:string):RiskCheck{
  return {key,label,limit:limit??null,value:known?value:null,status:limit==null?"unconfigured":!known||value===null?"incomplete":(key==="consistency"?value>limit:value>=limit)?"reached":"within",basis:description};
 }
 const checks=[
  check("max","Drawdown máximo",account.riskLimits?.maxDrawdownPercent,active.maxDrawdownPercent,complete,basisLabel),
  check("daily","Drawdown diario desde máximo del día",account.riskLimits?.dailyDrawdownPercent,active.dailyDrawdownPercent,complete,basisLabel+" · día Ecuador"),
  check("total","Pérdida total máxima desde capital inicial",account.riskLimits?.totalLossPercent,active.totalLossPercent,complete,basisLabel),
 ];
 const funding=account.funding,start=funding?.startsOn,end=funding?.endsOn;
 const crossesPhase=!!start&&trades.some(t=>dayKey(t.openedAt)<start&&(t.closedAt===null||dayKey(t.closedAt)>=start));
 const phaseKnown=realizedComplete&&!crossesPhase;
 const phase=balanceSeries(capital,realized.filter(e=>(!start||dayKey(e.at)>=start)&&(!end||dayKey(e.at)<=end)),today);
 const profitableDays=[...phase.days.values()].filter(v=>v>0),bestDay=profitableDays.length?Math.max(...profitableDays):0;
 const consistency=phase.profit>0?bestDay/phase.profit*100:null;
 const fundingChecks=[
  check("fundDaily","Fondeo: pérdida diaria máxima desde saldo al inicio del día",funding?.dailyLossPercent,phase.dailyLossPercent,phaseKnown&&(!start||today>=start)&&(!end||today<=end),"Umbral nominal realizado · día Ecuador; sin flotante"),
  check("fundTotal","Fondeo: pérdida total máxima desde capital de fase",funding?.totalLossPercent,phase.totalLossPercent,phaseKnown,"Capital inicial registrado; sin trailing de equity"),
  check("consistency","Fondeo: mejor día ÷ beneficio neto",funding?.consistencyPercent,consistency,phaseKnown,"Resultado realizado registrado; requiere beneficio neto positivo"),
 ];
 const tradingDays=new Set(trades.filter(t=>dayKey(t.openedAt)<=today&&(!start||dayKey(t.openedAt)>=start)&&(!end||dayKey(t.openedAt)<=end)).map(t=>dayKey(t.openedAt))).size;
 return {basis,basisLabel,complete,closedComplete,realizedComplete,missingClosed,missingRealized,movements,future,
  closed:seriesClosed,realized:seriesRealized,active,checks,fundingChecks,
  funding:{crossesPhase,profit:phaseKnown?phase.profit:null,targetCents:funding?.targetPercent!=null?capital*funding.targetPercent/100:null,tradingDays,minDays:funding?.minDays??null,expired:!!end&&today>end,startsOn:start??null,endsOn:end??null,externalStatus:"unavailable" as const}};
}
