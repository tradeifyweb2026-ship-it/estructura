/**
 * A monetary aggregate is safe only when every closed trade has a known result
 * and all trades share one currency. Partial cash coverage is not a total.
 * @template {string} C
 * @param {{pnlCents:number|null}[]} trades
 * @param {C[]} currencies
 * @param {C} assumedCurrency
 * @returns {{currency:C|null,cashCount:number,complete:boolean,cash:number[]}}
 */
export function cashCoverage(trades,currencies,assumedCurrency){
 const unique=[...new Set(currencies)];
 const currency=unique.length>1?null:unique[0]??assumedCurrency;
 const cashCount=trades.filter(t=>t.pnlCents!==null&&Number.isFinite(t.pnlCents)).length;
 const complete=trades.length>0&&unique.length===1&&cashCount===trades.length;
 const cash=complete?trades.flatMap(t=>t.pnlCents===null?[]:[t.pnlCents]):[];
 return {currency,cashCount,complete,cash};
}
