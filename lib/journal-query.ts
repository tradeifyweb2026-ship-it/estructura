import { z } from "./validation.ts";
import { EMOTIONS, scopeSchema, idSchema, inputDate, addDays, type Journal, type Trade } from "./journal.ts";
import type { Summary } from "./stats.ts";

const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(inputDate(v+"T00:00")),"Fecha no válida");
export const tradeQuerySchema=z.object({
 scope:scopeSchema.default("all"),from:day.optional(),to:day.optional(),q:z.string().trim().max(200).default(""),
 setup:idSchema.optional(),asset:z.string().trim().min(1).max(100).optional(),emotion:z.enum(EMOTIONS).optional(),
 direction:z.enum(["long","short"]).optional(),state:z.enum(["open","closed"]).optional(),
 result:z.enum(["win","loss","flat","unknown","open"]).optional(),sort:z.enum(["latest","oldest","r","duration"]).default("latest"),
}).refine(v=>!v.from||!v.to||v.from<=v.to,{message:"El inicio debe ser anterior al fin"});
export type TradeQuery=z.infer<typeof tradeQuerySchema>;
export function parseTradeQuery(params:URLSearchParams){
 return tradeQuerySchema.parse(Object.fromEntries([...params].filter(([key,value])=>value!==""&&["scope","from","to","q","setup","asset","emotion","direction","state","result","sort"].includes(key))));
}
export function queryParams(query:Partial<TradeQuery>){return new URLSearchParams(Object.entries(query).filter(([,v])=>v!=null&&v!=="") as [string,string][]);}
export function queryDates(q:TradeQuery){return {start:q.from?inputDate(q.from+"T00:00"):null,end:q.to?inputDate(addDays(q.to,1)+"T00:00"):null};}
export type SummaryWire=Omit<Summary,"factor"|"factorR"|"factorCash">&{factor:number|"Infinity"|null;factorR:number|"Infinity"|null;factorCash:number|"Infinity"|null};
export function encodeSummary(summary:Summary):SummaryWire{return {...summary,factor:summary.factor===Infinity?"Infinity":summary.factor,factorR:summary.factorR===Infinity?"Infinity":summary.factorR,factorCash:summary.factorCash===Infinity?"Infinity":summary.factorCash};}
export function decodeSummary(summary:SummaryWire):Summary{return {...summary,factor:summary.factor==="Infinity"?Infinity:summary.factor,factorR:summary.factorR==="Infinity"?Infinity:summary.factorR,factorCash:summary.factorCash==="Infinity"?Infinity:summary.factorCash};}
export type QueryGroup={key?:string;kind:string;label:string;count:number;withR:number;value:number|null};
export type QueryPoint={at:number;money:number;r:number;count:number;withR:number;withCash:number};
export type TradePage={trades:Trade[];captures:Journal["captures"];next:string|null;revision:number;total?:number};
export type Analytics={revision:number;summary:SummaryWire;groups:QueryGroup[];daily:QueryPoint[];assets:string[];assetLabels?:Record<string,string>};
export type JournalMetadata=Journal&{revision:number;tradeCount:number;recentAsset:{asset:string;openedAt:number}|null};
