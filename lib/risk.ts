import { dayKey, resultR, type Trade, type Account } from "./journal.ts";
import { partialProgress } from "./partial-progress.mjs";
import { accountTotals } from "./account-totals.mjs";

export function dailyRisk(trades: Trade[], today: string, limit: number | null, historyComplete = true) {
  let total = 0, known = 0, missing = 0, estimated = 0;
  const closedToday = trades.filter(t => t.closedAt !== null && dayKey(t.closedAt) === today);
  for (const trade of trades) {
    if (dayKey(trade.openedAt) > today || (trade.closedAt !== null && dayKey(trade.closedAt) < today)) continue;
    const closesToday = trade.closedAt !== null && dayKey(trade.closedAt) === today;
    const full = closesToday ? resultR(trade) : null;
    if (closesToday) {
      if (full === null || !Number.isFinite(full)) missing++;
      else { total += full; known++; if (trade.pnlCents === null || trade.riskCents === null) estimated++; }
    }
    for (const fill of trade.partials) {
      // An undated fill cannot be assigned safely to a daily ledger.
      if (fill.at == null) { missing++; continue; }
      const fillDay = dayKey(fill.at);
      const include = !closesToday && fillDay === today;
      const subtract = closesToday && fillDay !== today;
      if (!include && !subtract) continue;
      const cashR = fill.pnlCents != null && trade.riskCents !== null ? fill.pnlCents / trade.riskCents : null;
      const priceR = partialProgress(trade.entry, trade.stop, trade.currentStop, trade.direction, [fill])?.realizedR ?? null;
      const value = cashR ?? priceR;
      if (value === null || !Number.isFinite(value)) missing++;
      else { total += value * (subtract ? -1 : 1); known++; if (cashR === null) estimated++; }
    }
  }
  const complete = historyComplete && missing === 0;
  const status = !complete ? "incomplete" : limit === null ? "unconfigured" : !known ? "no-activity" : total <= -limit ? "reached" : "within";
  return { total: known ? (total === 0 ? 0 : total) : null, known, missing, estimated, complete, status, closedCount: closedToday.length, closedKnown: closedToday.filter(t => resultR(t) !== null).length };
}

export function openRisk(trade: Trade) {
  const progress = partialProgress(trade.entry, trade.stop, trade.currentStop, trade.direction, trade.partials);
  const remainingR = progress?.stopR == null ? null : Math.max(0, -progress.stopR);
  const remainingCents = remainingR === null || trade.riskCents === null ? null : Math.round(remainingR * trade.riskCents);
  return { initialCents: trade.riskCents, remainingR, remainingCents, partialR: progress?.realizedR ?? null };
}

export function accountRisks(trades:Trade[],accounts:Account[],today:string,defaultLimit:number|null,historyComplete=true){
  const knownIds=new Set(accounts.map(a=>a.id));
  const groups=[...accounts.map(account=>({account,trades:trades.filter(t=>t.accountId===account.id)})),{account:null,trades:trades.filter(t=>!t.accountId||!knownIds.has(t.accountId))}];
  return groups.filter(g=>g.trades.length).map(g=>{
    const daily=dailyRisk(g.trades,today,g.account?.riskLimits?.dailyLossR??defaultLimit,historyComplete);
    const open=g.trades.filter(t=>t.closedAt===null);
    const remaining=open.map(t=>openRisk(t).remainingCents);
    const totals=g.account?accountTotals(g.account.startingBalanceCents,g.account.movements??[],g.trades):null;
    const simultaneousPercent=historyComplete&&totals?.complete&&totals.balance>0&&remaining.every(v=>v!==null)?remaining.reduce<number>((s,v)=>s+(v??0),0)/totals.balance*100:null;
    const limit=g.account?.riskLimits?.simultaneousPercent;
    const simultaneousStatus=!historyComplete||simultaneousPercent===null?"incomplete":limit==null?"unconfigured":simultaneousPercent>limit?"reached":"within";
    const perTrade=g.account?.riskLimits?.perTradePercent;
    return {...g,daily,simultaneousPercent,simultaneousStatus,aboveTradeLimit:perTrade==null?null:g.trades.filter(t=>t.riskPercent!==null&&t.riskPercent>perTrade).length};
  });
}
