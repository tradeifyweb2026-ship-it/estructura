/**
 * @template {{id:string,openedAt:number}} T
 * @param {T[]} current
 * @param {T[]} incoming
 * @param {Set<string>} [deleted]
 * @returns {T[]}
 */
export function mergeTradePage(current,incoming,deleted=new Set()){
 const merged=new Map(current.map(trade=>/** @type {[string,T]} */ ([trade.id,trade])));
 for(const trade of incoming)if(!deleted.has(trade.id)&&!merged.has(trade.id))merged.set(trade.id,trade);
 return [...merged.values()].sort((a,b)=>b.openedAt-a.openedAt||b.id.localeCompare(a.id));
}
/**
 * @template {{id:string,openedAt:number}} T
 * @param {T[]} current
 * @param {T} trade
 * @returns {T[]}
 */
export function upsertTrade(current,trade){return [...current.filter(item=>item.id!==trade.id),trade].sort((a,b)=>b.openedAt-a.openedAt||b.id.localeCompare(a.id));}
/**
 * @template {{id:string}} T
 * @param {T[]} current
 * @param {string} id
 * @returns {T[]}
 */
export function removeTrade(current,id){return current.filter(trade=>trade.id!==id);}

/**
 * @template {{tradeId:string,slot:string}} T
 * @param {T[]} current
 * @param {T[]} incoming
 * @returns {T[]}
 */
export function mergeCapturePage(current,incoming){
 const merged=new Map(current.map(capture=>/** @type {[string,T]} */ ([capture.tradeId+":"+capture.slot,capture])));
 for(const capture of incoming)merged.set(capture.tradeId+":"+capture.slot,capture);
 return [...merged.values()];
}
