import {assetKey,assetLabel} from "./asset-catalog.ts";
import { currencyOf, dayKey, estimatedRatio, outcome, resultR, timeLabel, weekday, type Account, type Currency, type Trade } from "./journal.ts";

import {distribution} from "./advanced-stats.mjs";
import {cashCoverage} from "./summary-math.mjs";
export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => values.length ? sum(values) / values.length : null;
export const realized = (trades: Trade[]) => trades.filter((trade) => trade.closedAt !== null)
  .sort((a, b) => a.closedAt! - b.closedAt! || a.openedAt - b.openedAt || a.id.localeCompare(b.id));

export function summarize(trades: Trade[], accounts: Account[], assumedCurrency: Currency = "USD") {
  const closed = realized(trades);
  const r = closed.flatMap((trade) => {
    const result = resultR(trade);
    return result === null ? [] : [result];
  });
  const coverage=cashCoverage(closed,closed.map(trade=>currencyOf(trade,accounts)),assumedCurrency);
  const {currency,cash,cashCount,complete:cashComplete}=coverage;
  const rComplete=closed.length>0&&r.length===closed.length;
  const values = cashComplete ? cash : rComplete ? r : [];
  const statsR=distribution(r),statsCash=distribution(cashComplete?cash:[]);
  const grossWins = sum(values.filter((value) => value > 0));
  const grossLosses = Math.abs(sum(values.filter((value) => value < 0)));
  const payoffs = r.length ? r : cashComplete ? cash : [];
  const meanWin = mean(payoffs.filter((value) => value > 0));
  const meanLoss = mean(payoffs.filter((value) => value < 0));
  let win = 0, loss = 0, flat = 0, winStreak = 0, lossStreak = 0, winRun = 0, lossRun = 0;
  for (const trade of closed) {
    const result = outcome(trade);
    if (result === "win") win++;
    if (result === "loss") loss++;
    if (result === "flat") flat++;
    winRun = result === "win" ? winRun + 1 : 0;
    lossRun = result === "loss" ? lossRun + 1 : 0;
    winStreak = Math.max(winRun, winStreak);
    lossStreak = Math.max(lossRun, lossStreak);
  }
  let balance = 0, peak = 0, drawdown = 0;
  for (const value of values) {
    balance += value;
    peak = Math.max(peak, balance);
    drawdown = Math.max(drawdown, peak - balance);
  }
  const graded = closed.filter((trade) => trade.grade !== null);
  const fulfilled = graded.filter((trade) => trade.grade! >= 4).length;
  const countResults = win + loss + flat;
  return {
    closed: closed.length, open: trades.length - closed.length, currency, countResults, cashCount, cashComplete,
    rCount: r.length, cash: cashComplete ? sum(cash) : null, totalR: r.length ? sum(r) : null,
    meanR: mean(r), meanCash: cashComplete ? mean(cash) : null, win, loss, flat,
    bestR:r.length?r.reduce((a,b)=>Math.max(a,b)):null, worstR:r.length?r.reduce((a,b)=>Math.min(a,b)):null,
    meanWinR:mean(r.filter(v=>v>0)),meanLossR:mean(r.filter(v=>v<0)),
    meanDurationMs:mean(closed.map(t=>t.closedAt!-t.openedAt)),
    winRate: countResults ? win / countResults * 100 : null,
    factor: !values.length ? null : grossLosses ? grossWins / grossLosses : grossWins ? Infinity : null,
    factorR:statsR.factor,factorCash:cashComplete?statsCash.factor:null,drawdownR:statsR.drawdown,drawdownCash:cashComplete?statsCash.drawdown:null,recoveryR:statsR.recovery,lossRate:countResults?loss/countResults*100:null,flatRate:countResults?flat/countResults*100:null,unknownCount:closed.length-countResults,
    ratio: meanWin !== null && meanLoss !== null ? meanWin / Math.abs(meanLoss) : null,
    factorBasis: cashComplete ? currency : rComplete ? "R" : null,ratioBasis:r.length?"R":cashComplete?currency:null,
    drawdown: values.length ? drawdown : null,
    winStreak, lossStreak, graded: graded.length, discipline: graded.length ? fulfilled / graded.length * 100 : null,
    rrPlanned: mean(closed.flatMap((trade) => estimatedRatio(trade) ?? [])),
  };
}

export type Summary = ReturnType<typeof summarize>;

export function equity(trades: Trade[], unit: "money" | "r") {
  let cumulative = 0;
  return [{ value: 0, at: null as number | null }, ...realized(trades).flatMap((trade) => {
    const value = unit === "money" ? trade.pnlCents : resultR(trade);
    if (value === null) return [];
    cumulative += value;
    return [{ value: cumulative, at: trade.closedAt }];
  })];
}

export function groupBy<T, Key>(items: T[], keyOf: (item: T) => Key) {
  const buckets = new Map<Key, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return buckets;
}

export function groups(trades: Trade[], keyOf: (trade: Trade) => string, average = false) {
  const buckets = groupBy(realized(trades), keyOf);
  return [...buckets].map(([label, items]) => {
    const values = items.flatMap((trade) => resultR(trade) ?? []);
    return {
      label, count: items.length, withR: values.length,
      value: values.length ? (average ? sum(values) / values.length : sum(values)) : null,
    };
  }).sort((left, right) => (right.value ?? -Infinity) - (left.value ?? -Infinity));
}

export function assetGroups(trades:Trade[]){
 const buckets=groupBy(realized(trades),assetKey);
 return [...buckets].map(([key,items])=>({...groups(items,()=>assetLabel(items[0]))[0],...(items[0].market?{key}:{} )})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
}
export const entryHour = (trade: Trade) => timeLabel(trade.openedAt).slice(0, 2) + ":00";
export const entryWeekday = (trade: Trade) => WEEKDAYS[weekday(dayKey(trade.openedAt))];

export function afterLossGroups(history: Trade[], cohort: Trade[]) {
  const historyByAccount = groupBy(realized(history), (trade) => trade.accountId);
  const positions = new Map<string | null, number>();
  const classified = new Map<string, string>();
  const opened = cohort.slice().sort((a, b) => a.openedAt - b.openedAt);
  for (const trade of opened) {
    const finished = historyByAccount.get(trade.accountId) ?? [];
    let position = positions.get(trade.accountId) ?? 0;
    while (position < finished.length && finished[position].closedAt! < trade.openedAt) position++;
    positions.set(trade.accountId, position);
    classified.set(trade.id, position > 0 && outcome(finished[position - 1]) === "loss" ? "Tras una pérdida" : "Otras operaciones");
  }
  return groups(cohort, (trade) => classified.get(trade.id) ?? "Otras operaciones", true);
}

export function entryOrdinals(history:Trade[]){const counts=new Map<string,number>(), result=new Map<string,number>();for(const trade of history.slice().sort((a,b)=>a.openedAt-b.openedAt||a.id.localeCompare(b.id))){const key=(trade.accountId??"unassigned")+":"+dayKey(trade.openedAt);const n=(counts.get(key)??0)+1;counts.set(key,n);result.set(trade.id,n);}return result;}
