import { createHash } from "node:crypto";
import { z } from "../lib/validation.ts";
import { JournalError } from "./repository";
import { blankJournal, idSchema, type Journal, type Trade, type Currency } from "../lib/journal";
import { encodeSummary, queryDates, type TradeQuery, type TradePage, type Analytics, type JournalMetadata, type QueryGroup, type QueryPoint } from "../lib/journal-query";
import type { Summary } from "../lib/stats";
import { dailyRisk } from "../lib/risk";
import { inputDate,addDays,type Account } from "../lib/journal";

const revisionSQL="SELECT COALESCE((SELECT version FROM journal_revisions WHERE user_id=?),0) revision";
export async function consistentBatch(db:D1Database,user:string,revision:number|undefined,queries:D1PreparedStatement[]){
 const [head,...results]=await db.batch([db.prepare(revisionSQL).bind(user),...queries]);
 const observed=Number((head.results[0] as {revision:number}).revision);
 if(revision!==undefined&&revision!==observed)throw new JournalError("El historial cambió durante la consulta. Actualiza y vuelve a intentarlo; no se mezclaron páginas.",409);
 return {revision:observed,results};
}

// Keep this expression in sync with resultR/averageExit. Every SQL branch is
// compared against those pure functions in the D1 regression suite.
function rSQL(alias:string){
 const d=alias+".data",j=(key:string)=>`json_extract(${d},'$.${key}')`;
 const fills=`json_each(COALESCE(${j("partials")},'[]'))`;
 const percent=`COALESCE((SELECT SUM(json_extract(f.value,'$.percent')) FROM ${fills} f),0)`;
 const weighted=`COALESCE((SELECT SUM(json_extract(f.value,'$.price')*json_extract(f.value,'$.percent')) FROM ${fills} f),0)`;
 const exit=`CASE WHEN json_array_length(COALESCE(${j("partials")},'[]'))=0 THEN ${j("exit")} WHEN 100-${percent}>0.000001 AND ${j("exit")} IS NULL THEN NULL ELSE (${weighted}+COALESCE(${j("exit")},0)*MAX(0,100-${percent}))/100.0 END`;
 const sign=`CASE ${j("direction")} WHEN 'long' THEN 1 ELSE -1 END`,risk=`((${j("entry")}-${j("stop")})*${sign})`;
 return `CASE WHEN ${j("closedAt")} IS NULL THEN NULL WHEN ${j("pnlCents")} IS NOT NULL AND ${j("riskCents")}>0 THEN 1.0*${j("pnlCents")}/${j("riskCents")} WHEN ${risk}>0 THEN ((${exit})-${j("entry")})*${sign}/${risk} END`;
}
function normalized(expression:string){let s=expression;for(const [from,to] of Object.entries({Á:"a",É:"e",Í:"i",Ó:"o",Ú:"u",Ü:"u",Ñ:"n",á:"a",é:"e",í:"i",ó:"o",ú:"u",ü:"u",ñ:"n"}))s=`replace(${s},'${from}','${to}')`;return `lower(${s})`;}
export function marketLabelSQL(alias:string){
 const d=alias+".data",id="json_extract("+d+",'$.market.id')";
 return "CASE WHEN "+id+" IS NOT NULL THEN coalesce((SELECT name FROM asset_catalog m WHERE m.user_id="+alias+".user_id AND m.id="+id+"),json_extract("+d+",'$.market.name'),json_extract("+d+",'$.asset')) ELSE json_extract("+d+",'$.asset') END";
}
export function source(user:string,q:TradeQuery){
 const args: (string|number|null)[]=[user];
 const where=["t.user_id=?"];
 if(q.scope!=="all"){if(q.scope==="unassigned")where.push("t.account_id IS NULL");else{where.push("t.account_id=?");args.push(q.scope);}}
 const {start,end}=queryDates(q);
 // Expression indexes serve both account-specific and all-account date scans.
 if(start!==null){where.push("coalesce(json_extract(t.data,'$.closedAt'),t.opened_at)>=?");args.push(start);}
 if(end!==null){where.push("coalesce(json_extract(t.data,'$.closedAt'),t.opened_at)<?");args.push(end);}
 if(q.asset){where.push(q.asset.startsWith("market:")?"json_extract(t.data,'$.market.id')=?":"json_extract(t.data,'$.asset')=?");args.push(q.asset.startsWith("market:")?q.asset.slice(7):q.asset);}
 for(const [column,value] of [["t.setup_id",q.setup],["json_extract(t.data,'$.direction')",q.direction],["json_extract(t.data,'$.before.name')",q.emotion]] as const){if(value){where.push(column+"=?");args.push(value);}}
 if(q.state)where.push("json_extract(t.data,'$.closedAt') IS "+(q.state==="open"?"NULL":"NOT NULL"));
 if(q.q){const search="COALESCE(json_extract(t.data,'$.asset'),'')||' '||COALESCE("+marketLabelSQL("t")+",'')||' '||COALESCE(json_extract(s.data,'$.name'),'')||' '||COALESCE((SELECT group_concat(json_extract(n.value,'$.text'),' ') FROM json_each(COALESCE(json_extract(t.data,'$.notes'),'[]')) n),'')";where.push(`instr(${normalized(search)},?)>0`);args.push(q.q.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase());}
 const cte=`WITH base AS (
 SELECT t.*,json_extract(t.data,'$.closedAt') closed_at,coalesce(json_extract(t.data,'$.closedAt'),t.opened_at) at,
 json_extract(t.data,'$.pnlCents') cash,coalesce(json_extract(a.data,'$.currency'),'USD') currency,
 coalesce(json_extract(a.data,'$.name'),'Sin cuenta') account_name,coalesce(json_extract(s.data,'$.name'),'Sin setup') setup_name,
 ${marketLabelSQL("t")} market_label,CASE WHEN json_extract(t.data,'$.market.id') IS NOT NULL THEN 'market:'||json_extract(t.data,'$.market.id') ELSE json_extract(t.data,'$.asset') END asset_key,
 ${rSQL("t")} raw_r
 FROM trades t LEFT JOIN accounts a ON a.user_id=t.user_id AND a.id=t.account_id
 LEFT JOIN setups s ON s.user_id=t.user_id AND s.id=t.setup_id WHERE ${where.join(" AND ")}
 ), finite AS (SELECT *,CASE WHEN abs(raw_r)<=1.7976931348623157e308 THEN raw_r END r FROM base),
 classified AS (SELECT *,CASE WHEN closed_at IS NULL THEN 'open' WHEN coalesce(cash,r) IS NULL THEN 'unknown' WHEN abs(coalesce(cash,r))<1e-9 THEN 'flat' WHEN coalesce(cash,r)>0 THEN 'win' ELSE 'loss' END outcome FROM finite),
 selected AS (SELECT * FROM classified ${q.result?"WHERE outcome=?":""})`;
 if(q.result)args.push(q.result);
 return {cte,args};
}
const scoreSQL=(sort:TradeQuery["sort"])=>sort==="r"?"coalesce(r,-1.7976931348623157e308)":sort==="duration"?"CASE WHEN closed_at IS NULL THEN -1 ELSE closed_at-opened_at END":"at";
const cursorSchema=z.object({revision:z.number().int().nonnegative(),key:z.number().finite(),id:idSchema,query:z.string().length(64)});
function fingerprint(q:TradeQuery,user:string){return createHash("sha256").update(user+":"+JSON.stringify(q)).digest("hex");}
function readCursor(raw:string|undefined,q:TradeQuery,user:string){
 if(!raw)return undefined;
 try{if(raw.length>1000)throw Error();const value=cursorSchema.parse(JSON.parse(Buffer.from(raw,"base64url").toString("utf8")));if(value.query!==fingerprint(q,user))throw Error();return value;}catch{throw new JournalError("Cursor no válido para estos filtros.",422);}
}
type TradeRow={id:string;version:number;opened_at:number;account_id:string|null;setup_id:string|null;data:string;score:number;market_label?:string};
function asTrade(row:TradeRow):Trade{const data=JSON.parse(row.data);if(data.market&&row.market_label)data.market.name=row.market_label;return {...data,id:row.id,version:row.version,openedAt:row.opened_at,accountId:row.account_id,setupId:row.setup_id};}
export async function queryTradePage(db:D1Database,user:string,q:TradeQuery,options:{size?:number;cursor?:string;revision?:number;count?:boolean}={}):Promise<TradePage>{
 const size=options.size??20;if(!Number.isInteger(size)||size<1||size>200)throw new JournalError("Tamaño de página no válido.",422);
 const cursor=readCursor(options.cursor,q,user),{cte,args}=source(user,q),score=scoreSQL(q.sort),ascending=q.sort==="oldest",op=ascending?">":"<",order=ascending?"ASC":"DESC";
 if(cursor&&options.revision!==undefined&&cursor.revision!==options.revision)throw new JournalError("La revisión del cursor no coincide.",422);
 const predicate=cursor?`WHERE (${score}${op}? OR (${score}=? AND id${op}?))`:"";
 const query=`${cte} SELECT id,version,opened_at,account_id,setup_id,data,market_label,${score} score FROM selected ${predicate} ORDER BY ${score} ${order},id ${order} LIMIT ?`;
 const statement=db.prepare(query).bind(...args,...(cursor?[cursor.key,cursor.key,cursor.id]:[]),size+1);
 const captures=db.prepare(`${cte} SELECT trade_id tradeId,slot,revision FROM attachments WHERE user_id=? AND trade_id IN(SELECT id FROM selected ${predicate} ORDER BY ${score} ${order},id ${order} LIMIT ?)`)
  .bind(...args,user,...(cursor?[cursor.key,cursor.key,cursor.id]:[]),size);
 const queries=[statement,captures];if(options.count)queries.push(db.prepare(`${cte} SELECT count(*) total FROM selected`).bind(...args));
 const result=await consistentBatch(db,user,cursor?.revision??options.revision,queries);
 const rows=result.results[0].results as TradeRow[],visible=rows.slice(0,size),last=visible.at(-1);
 return {trades:visible.map(asTrade),captures:result.results[1].results as Journal["captures"],revision:result.revision,
  ...(options.count?{total:Number((result.results[2].results[0] as {total:number}).total)}:{}),
  next:rows.length>size&&last?Buffer.from(JSON.stringify({revision:result.revision,key:last.score,id:last.id,query:fingerprint(q,user)})).toString("base64url"):null};
}
export async function queryMetadata(db:D1Database,user:string,includeReviews=true):Promise<JournalMetadata>{
 const query=(table:string,fields="*")=>db.prepare(`SELECT ${fields} FROM ${table} WHERE user_id=?`).bind(user);
 const {revision,results}=await consistentBatch(db,user,undefined,[query("accounts"),query("setups"),query("plans"),includeReviews?query('reviews'):db.prepare('SELECT * FROM reviews WHERE user_id=? AND 0').bind(user),query("trades","count(*) total"),db.prepare("SELECT json_extract(data,'$.asset') asset,opened_at openedAt FROM trades WHERE user_id=? ORDER BY opened_at DESC,id DESC LIMIT 1").bind(user)]);
 const records=(index:number)=>results[index].results as {id:string;version:number;data:string;week:string;scope:Journal["reviews"][number]["scope"]}[];
 const stored=(index:number)=>records(index).map(r=>({...JSON.parse(r.data),id:r.id,version:r.version})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
 return {...blankJournal,accounts:stored(0),setups:stored(1),plan:records(2)[0]?JSON.parse(records(2)[0].data):blankJournal.plan,planVersion:records(2)[0]?.version??0,
  reviews:records(3).map(r=>({...JSON.parse(r.data),week:r.week,scope:r.scope,version:r.version})),revision,tradeCount:Number((results[4].results[0] as {total:number}).total),recentAsset:(results[5].results[0] as {asset:string;openedAt:number}|undefined)??null};
}

export async function queryDailyRisk(db:D1Database,user:string,q:TradeQuery,today:string){
 const start=inputDate(today+"T00:00"),end=inputDate(addDays(today,1)+"T00:00");
 if(!Number.isFinite(start)||!Number.isFinite(end))throw new JournalError("Día no válido.",422);
 const filters=q.scope==="all"?"":q.scope==="unassigned"?" AND account_id IS NULL":" AND account_id=?";
 const statement=db.prepare("SELECT id,version,opened_at,account_id,setup_id,data FROM trades WHERE user_id=? AND opened_at<? AND (json_extract(data,'$.closedAt')>=? OR json_extract(data,'$.closedAt') IS NULL)"+filters).bind(user,end,start,...(q.scope!=="all"&&q.scope!=="unassigned"?[q.scope]:[]));
 const {revision,results}=await consistentBatch(db,user,undefined,[statement,db.prepare("SELECT id,data FROM accounts WHERE user_id=?").bind(user),db.prepare("SELECT data FROM plans WHERE user_id=?").bind(user)]);
 const rows=(results[0].results as TradeRow[]).map(asTrade),accounts=(results[1].results as {id:string;data:string}[]).map(a=>({...JSON.parse(a.data),id:a.id}) as Account);
 const plan=(results[2].results[0] as {data:string}|undefined),limit=plan?JSON.parse(plan.data).dailyLossR:null;
 const ids=new Set(rows.map(t=>t.accountId));
 return {revision,accounts:[...ids].map(id=>{const account=accounts.find(a=>a.id===id);return {id,name:account?.name??"Sin cuenta",limit:account?.riskLimits?.dailyLossR??limit,daily:dailyRisk(rows.filter(t=>t.accountId===id),today,account?.riskLimits?.dailyLossR??limit)}})};
}

function summarySQL(cte:string){return `${cte},closed AS(SELECT * FROM selected WHERE closed_at IS NOT NULL),running AS(
 SELECT *,sum(coalesce(cash,0)) OVER w cum_cash,sum(coalesce(r,0)) OVER w cum_r,
 sum(CASE WHEN outcome='win' THEN 0 ELSE 1 END) OVER w win_group,sum(CASE WHEN outcome='loss' THEN 0 ELSE 1 END) OVER w loss_group
 FROM closed WINDOW w AS(ORDER BY closed_at,opened_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)),peaks AS(
 SELECT *,max(0,max(cum_cash) OVER w) peak_cash,max(0,max(cum_r) OVER w) peak_r FROM running WINDOW w AS(ORDER BY closed_at,opened_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))
 SELECT count(*) closed,(SELECT count(*) FROM selected WHERE closed_at IS NULL) open,count(r) rCount,count(cash) cashCount,count(DISTINCT currency) currencyCount,min(currency) currency,
 sum(cash) cash,sum(r) totalR,avg(r) meanR,avg(cash) meanCash,
 coalesce(sum(outcome='win'),0) win,coalesce(sum(outcome='loss'),0) loss,coalesce(sum(outcome='flat'),0) flat,
 max(r) bestR,min(r) worstR,avg(CASE WHEN r>0 THEN r END) meanWinR,avg(CASE WHEN r<0 THEN r END) meanLossR,
 avg(CASE WHEN cash>0 THEN cash END) meanWinCash,avg(CASE WHEN cash<0 THEN cash END) meanLossCash,
 sum(CASE WHEN r>0 THEN r ELSE 0 END) winsR,sum(CASE WHEN r<0 THEN -r ELSE 0 END) lossesR,
 sum(CASE WHEN cash>0 THEN cash ELSE 0 END) winsCash,sum(CASE WHEN cash<0 THEN -cash ELSE 0 END) lossesCash,
 max(peak_cash-cum_cash) ddCash,max(peak_r-cum_r) ddR,avg(closed_at-opened_at) meanDurationMs,
 sum(json_extract(data,'$.grade') IS NOT NULL) graded,sum(json_extract(data,'$.grade')>=4) fulfilled,
 avg(CASE WHEN ((json_extract(data,'$.entry')-json_extract(data,'$.stop'))*(CASE json_extract(data,'$.direction') WHEN 'long' THEN 1 ELSE -1 END))>0
 AND ((json_extract(data,'$.target')-json_extract(data,'$.entry'))*(CASE json_extract(data,'$.direction') WHEN 'long' THEN 1 ELSE -1 END))>0
 THEN (json_extract(data,'$.target')-json_extract(data,'$.entry'))/(1.0*(json_extract(data,'$.entry')-json_extract(data,'$.stop'))) END) rrPlanned,
 (SELECT coalesce(max(n),0) FROM(SELECT count(*) n FROM running WHERE outcome='win' GROUP BY win_group)) winStreak,
 (SELECT coalesce(max(n),0) FROM(SELECT count(*) n FROM running WHERE outcome='loss' GROUP BY loss_group)) lossStreak FROM peaks`;}
type AggregateRow=Record<string,number|null>&{currency:Currency|null};
function summaryFromRow(row:AggregateRow,assumed:Currency):Summary{
 const n=(key:string)=>Number(row[key]??0),v=(key:string)=>row[key]===null||!Number.isFinite(row[key])?null:row[key] as number;
 const closed=n("closed"),rCount=n("rCount"),cashCount=n("cashCount"),cashComplete=closed>0&&cashCount===closed&&n("currencyCount")===1,rComplete=closed>0&&rCount===closed;
 const currency=n("currencyCount")>1?null:row.currency??assumed,countResults=n("win")+n("loss")+n("flat");
 const factor=(wins:number,losses:number)=>losses?wins/losses:wins?Infinity:null;
 const factorR=rCount?factor(n("winsR"),n("lossesR")):null,factorCash=cashComplete?factor(n("winsCash"),n("lossesCash")):null;
 const winMean=rCount?v("meanWinR"):cashComplete?v("meanWinCash"):null,lossMean=rCount?v("meanLossR"):cashComplete?v("meanLossCash"):null;
 return {closed,open:n("open"),currency,countResults,cashCount,cashComplete,rCount,cash:cashComplete?v("cash"):null,totalR:rCount?v("totalR"):null,
 meanR:v("meanR"),meanCash:cashComplete?v("meanCash"):null,win:n("win"),loss:n("loss"),flat:n("flat"),bestR:v("bestR"),worstR:v("worstR"),meanWinR:v("meanWinR"),meanLossR:v("meanLossR"),meanDurationMs:v("meanDurationMs"),
 winRate:countResults?n("win")/countResults*100:null,factor:cashComplete?factorCash:rComplete?factorR:null,factorR,factorCash,
 drawdownR:rCount?v("ddR"):null,drawdownCash:cashComplete?v("ddCash"):null,recoveryR:rCount&&n("ddR")>0?n("totalR")/n("ddR"):null,
 lossRate:countResults?n("loss")/countResults*100:null,flatRate:countResults?n("flat")/countResults*100:null,unknownCount:closed-countResults,
 ratio:winMean!==null&&lossMean!==null?winMean/Math.abs(lossMean):null,factorBasis:cashComplete?currency:rComplete?"R":null,ratioBasis:rCount?"R":cashComplete?currency:null,
 drawdown:cashComplete?v("ddCash"):rComplete?v("ddR"):null,winStreak:n("winStreak"),lossStreak:n("lossStreak"),graded:n("graded"),discipline:n("graded")?n("fulfilled")/n("graded")*100:null,rrPlanned:v("rrPlanned")};
}
export async function queryAnalytics(db:D1Database,user:string,q:TradeQuery,revision?:number,details=false,perTrade=false):Promise<Analytics>{
 const {cte,args}=source(user,q);
 const daily=`${cte} SELECT min(closed_at) at,sum(coalesce(cash,0)) money,sum(coalesce(r,0)) r,count(*) count,count(r) withR,count(cash) withCash FROM selected WHERE closed_at IS NOT NULL GROUP BY ${perTrade?"closed_at,opened_at,id":"date(closed_at/1000,'unixepoch','-5 hours')"} ORDER BY at${perTrade?",opened_at,id":""}`;
 const queries=[db.prepare(summarySQL(cte)).bind(...args),db.prepare(daily).bind(...args)];
 if(details){
  const dimensions:Record<string,string>={setup:"setup_name",asset:"json_object('key',asset_key,'label',market_label)",direction:"CASE json_extract(data,'$.direction') WHEN 'long' THEN 'Compras' ELSE 'Ventas' END",month:"strftime('%Y-%m',closed_at/1000,'unixepoch','-5 hours')",hour:"strftime('%H:00',opened_at/1000,'unixepoch','-5 hours')",weekday:"CASE strftime('%w',opened_at/1000,'unixepoch','-5 hours') WHEN '0' THEN 'Dom' WHEN '1' THEN 'Lun' WHEN '2' THEN 'Mar' WHEN '3' THEN 'Mié' WHEN '4' THEN 'Jue' WHEN '5' THEN 'Vie' ELSE 'Sáb' END",account:"account_name",band:"CASE WHEN r IS NULL THEN 'Sin R' WHEN r< -1 THEN 'Menos de -1 R' WHEN r<0 THEN '-1 a <0 R' WHEN r=0 THEN '0 R' WHEN r<1 THEN '>0 a <1 R' WHEN r<2 THEN '1 a <2 R' WHEN r<3 THEN '2 a <3 R' ELSE '3 R o más' END"};
  const dimensionObject="json_object("+Object.entries(dimensions).map(([kind,label])=>"'"+kind+"',"+label).join(",")+")";
  queries.push(db.prepare(`${cte} SELECT dim.key kind,dim.value label,count(*) count,count(x.r) withR,CASE WHEN dim.key IN('hour','weekday') THEN avg(x.r) ELSE sum(x.r) END value FROM selected x,json_each(${dimensionObject}) dim WHERE closed_at IS NOT NULL GROUP BY dim.key,dim.value`).bind(...args));
  // Ordinal and previous-outcome queries use the whole account history, while
  // aggregating only the selected cohort. The supporting indexes bound lookups.
  const ordinal=`(SELECT count(*) FROM trades p WHERE p.user_id=x.user_id AND p.account_id IS x.account_id AND p.opened_at>=CAST(strftime('%s',date(x.opened_at/1000,'unixepoch','-5 hours')||'T05:00:00Z') AS INTEGER)*1000 AND (p.opened_at<x.opened_at OR(p.opened_at=x.opened_at AND p.id<=x.id)))`;
  const prior=`(SELECT CASE WHEN coalesce(json_extract(p.data,'$.pnlCents'),(${rSQL("p")}))< -1e-9 THEN 1 ELSE 0 END FROM trades p WHERE p.user_id=x.user_id AND p.account_id IS x.account_id AND json_extract(p.data,'$.closedAt')<x.opened_at ORDER BY json_extract(p.data,'$.closedAt') DESC,p.opened_at DESC,p.id DESC LIMIT 1)`;
  for(const [kind,label] of [["ordinal",`CASE ${ordinal} WHEN 1 THEN 'Primera' WHEN 2 THEN 'Segunda' ELSE 'Tercera o posterior' END`],["afterLoss",`CASE WHEN ${prior}=1 THEN 'Tras una pérdida' ELSE 'Otras operaciones' END`]])queries.push(db.prepare(`${cte} SELECT '${kind}' kind,${label} label,count(*) count,count(r) withR,avg(r) value FROM selected x WHERE closed_at IS NOT NULL GROUP BY 2`).bind(...args));
  const facet=source(user,{...q,asset:undefined,setup:undefined,direction:undefined});
  queries.push(db.prepare(`${facet.cte} SELECT DISTINCT asset_key asset,market_label label FROM selected ORDER BY label,asset`).bind(...facet.args));
 }
 queries.push(db.prepare("SELECT json_extract(data,'$.currency') currency FROM accounts WHERE user_id=? AND id=?").bind(user,q.scope));
 const result=await consistentBatch(db,user,revision,queries),row=result.results[0].results[0] as AggregateRow;
 const assumed=(result.results.at(-1)?.results[0] as {currency:Currency}|undefined)?.currency??"USD";
 return {revision:result.revision,summary:encodeSummary(summaryFromRow(row,assumed)),daily:result.results[1].results as QueryPoint[],
 groups:details?result.results.slice(2,5).flatMap(r=>r.results as QueryGroup[]).map(g=>g.kind==="asset"?{...g,...JSON.parse(g.label)}:g):[],assets:details?(result.results[5].results as {asset:string}[]).map(r=>r.asset):[],...(details?{assetLabels:Object.fromEntries((result.results[5].results as {asset:string;label:string}[]).map(r=>[r.asset,r.label]))}:{})};
}
