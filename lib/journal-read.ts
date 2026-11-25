import { tradeQuerySchema,queryParams,type TradeQuery,type JournalMetadata,type TradePage } from "./journal-query.ts";
import type { Journal } from "./journal.ts";
export class QueryError extends Error{readonly status:number;readonly retryAfter:number;constructor(message:string,status:number,retryAfter=60){super(message);this.status=status;this.retryAfter=retryAfter;}}
export async function readJournal<T>(params:URLSearchParams,signal?:AbortSignal):Promise<T>{
 const response=await fetch("/api/bitacora?"+params,{cache:"no-store",signal});
 const body=await response.json().catch(()=>null) as {error?:string}|null;
 if(!response.ok||body===null){const retry=Number(response.headers.get("retry-after")??60);throw new QueryError(body?.error??"No se pudo completar la consulta.",response.status,Number.isFinite(retry)&&retry>=0?Math.min(retry,60):60);}
 return body as T;
}
/** Collect only on explicit export/restore or a view which needs record details.
 * A revision conflict discards the entire result; no partial dataset escapes. */
export async function readCompleteJournal(query:Partial<TradeQuery>={},signal?:AbortSignal,onProgress?:(progress:{loaded:number;waitingSeconds?:number})=>void):Promise<Journal&{revision:number}>{
 const q=tradeQuerySchema.parse(query);
 const trades:Journal["trades"]=[],captures:Journal["captures"]=[],seen=new Set<string>();
 async function part<T>(params:URLSearchParams):Promise<T>{
  for(let attempt=0;;attempt++){
   signal?.throwIfAborted();
   try{return await readJournal<T>(params,signal);}catch(error){
    if(!(error instanceof QueryError)||error.status!==429||attempt>=2)throw error;
    onProgress?.({loaded:trades.length,waitingSeconds:error.retryAfter});
    await new Promise<void>((resolve,reject)=>{
     const abort=()=>{clearTimeout(timer);reject(signal?.reason??new DOMException("Cancelado","AbortError"));};
     const timer=setTimeout(()=>{signal?.removeEventListener("abort",abort);resolve();},error.retryAfter*1000);
     if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});
    });
   }
  }
 }
 const meta=await part<JournalMetadata>(new URLSearchParams({mode:"metadata",reviews:'all'}));
 let cursor:string|null=null;
 do{
  const params=queryParams(q);params.set("mode","list");params.set("size","200");params.set("revision",String(meta.revision));if(cursor)params.set("cursor",cursor);
  const page=await part<TradePage>(params);
  if(page.revision!==meta.revision)throw new QueryError("El historial cambió. Repite la lectura completa.",409);
  for(const trade of page.trades){if(seen.has(trade.id))throw new QueryError("La paginación repitió una operación. No se generó el respaldo.",409);seen.add(trade.id);trades.push(trade);}
  captures.push(...page.captures);
  onProgress?.({loaded:trades.length});
  if(page.next===cursor&&page.next!==null||page.next&&!page.trades.length)throw new QueryError("La paginación no avanzó.",500);
  cursor=page.next;
 }while(cursor);
 return {...meta,trades,captures};
}
