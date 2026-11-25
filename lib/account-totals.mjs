/**
 * @param {number} initial
 * @param {{kind:string,amountCents:number}[]} movements
 * @param {{closedAt:number|null,pnlCents?:number|null,partials:{pnlCents?:number|null}[]}[]} trades
 */
export function accountTotals(initial,movements,trades){
 let deposits=0,withdrawals=0,adjustments=0,externalFees=0,closedPnl=0,openPartials=0,missingClosed=0,missingPartials=0;
 for(const m of movements){
  if(m.kind==="deposit")deposits+=m.amountCents;
  else if(m.kind==="withdrawal")withdrawals+=m.amountCents;
  else if(m.kind==="fee")externalFees+=m.amountCents;
  else if(m.kind==="adjustment")adjustments+=m.amountCents;
 }
 for(const t of trades){
  if(t.closedAt!==null){if(t.pnlCents==null)missingClosed++;else closedPnl+=t.pnlCents;}
  else for(const p of t.partials){if(p.pnlCents==null)missingPartials++;else openPartials+=p.pnlCents;}
 }
 const realized=closedPnl+openPartials;
 const balance=initial+deposits-withdrawals+adjustments-externalFees+realized;
 const complete=missingClosed===0&&missingPartials===0;
 const returnPercent=complete&&initial>0&&deposits===0&&withdrawals===0&&adjustments===0?((realized-externalFees)/initial)*100:null;
 return {deposits,withdrawals,adjustments,externalFees,closedPnl,openPartials,realized,balance,missingClosed,missingPartials,complete,returnPercent};
}
