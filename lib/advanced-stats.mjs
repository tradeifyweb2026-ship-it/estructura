/** @param {number[]} values */
export function distribution(values){let balance=0,peak=0,drawdown=0,wins=0,losses=0;for(const v of values){balance+=v;peak=Math.max(peak,balance);drawdown=Math.max(drawdown,peak-balance);if(v>0)wins+=v;else if(v<0)losses-=v;}return {count:values.length,total:values.length?balance:null,mean:values.length?balance/values.length:null,factor:losses?wins/losses:wins?Infinity:null,drawdown:values.length?drawdown:null,recovery:drawdown>0?balance/drawdown:null};}
/** @param {string} month @param {number} offset */
export function shiftMonth(month,offset){const date=new Date(month+"-01T12:00:00Z");date.setUTCMonth(date.getUTCMonth()+offset);return date.toISOString().slice(0,7)}
/** @param {number|null} r */
export function rBand(r){return r===null?"Sin R":r< -1?"Menos de -1 R":r<0?"-1 a <0 R":r===0?"0 R":r<1?">0 a <1 R":r<2?"1 a <2 R":r<3?"2 a <3 R":"3 R o más"}
