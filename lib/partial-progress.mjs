/**
 * @param {number|null} entry
 * @param {number|null} initialStop
 * @param {number|null|undefined} currentStop
 * @param {"long"|"short"} direction
 * @param {{price:number,percent:number}[]} partials
 */
export function partialProgress(entry,initialStop,currentStop,direction,partials){
 const sign=direction==="long"?1:direction==="short"?-1:0;
 const closed=partials.reduce((sum,p)=>sum+p.percent,0);
 if(!sign||!Number.isFinite(closed)||closed<0||closed>100.000001||partials.some(p=>!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.percent)||p.percent<=0))return null;
 const remaining=Math.max(0,100-closed);
 const risk=entry===null||initialStop===null?null:(entry-initialStop)*sign;
 const valid=risk!==null&&Number.isFinite(risk)&&risk>0&&entry!==null&&Number.isFinite(entry)&&entry>0&&initialStop!==null&&initialStop>0;
 const realizedR=valid?partials.reduce((sum,p)=>sum+(p.price-entry)*sign/risk*p.percent/100,0):null;
 const stop=currentStop??initialStop;
 const stopR=valid&&stop!==null&&Number.isFinite(stop)&&stop>0?(stop-entry)*sign/risk*remaining/100:null;
 const average=closed>0?partials.reduce((sum,p)=>sum+p.price*p.percent,0)/closed:null;
 // IEEE-754 preserves the sign of zero after multiplication by the short sign.
 // Normalize exact zeros only; small, non-zero financial results stay unchanged.
 return {closed,remaining,realizedR:realizedR!==null&&Number.isFinite(realizedR)?(realizedR===0?0:realizedR):null,stopR:stopR!==null&&Number.isFinite(stopR)?(stopR===0?0:stopR):null,average};
}
