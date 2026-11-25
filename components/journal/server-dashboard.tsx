"use client";
import { useMemo,useState } from "react";
import { ChevronLeft,ChevronRight } from "lucide-react";
import { addDays,dayKey,monthLabel,shiftMonth,weekday,numberText,type Journal,type Trade } from "@/lib/journal";
import { decodeSummary,queryParams,type Analytics,type TradePage,type TradeQuery } from "@/lib/journal-query";
import { WEEKDAYS } from "@/lib/stats";
import { SummaryMetrics,TradeCurve } from "./dashboard";
import { TradeList } from "./trade-list";
import { Button,Empty,Panel,Result,valueTone } from "./ui";
import { useServerQuery } from "./use-server-query";

function CalendarDay({query,journal,revision,refresh,onDetail,onRefresh}:{query:TradeQuery;journal:Journal;revision:number;refresh:number;onDetail:(t:Trade)=>void;onRefresh:()=>void}){
 const [cursors,setCursors]=useState([""]),[page,setPage]=useState(0);
 const params=queryParams(query);params.set("mode","list");params.set("size","20");params.set("revision",String(revision));if(page)params.set("cursor",cursors[page]);
 const result=useServerQuery<TradePage>(params,refresh);
 return result.loading?<Empty title="Consultando operaciones del día…"/>:result.error?<p role="alert">{result.error.message} <Button onClick={onRefresh}>Actualizar calendario</Button></p>:<><TradeList rows={result.data?.trades??[]} journal={journal} onDetail={onDetail} compact/><div className="pagination"><Button disabled={!page} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span>Página {page+1}</span><Button disabled={!result.data?.next} onClick={()=>{setCursors([...cursors.slice(0,page+1),result.data!.next!]);setPage(p=>p+1)}}>Siguiente</Button></div></>;
}
function ServerCalendar({scope,journal,today,refresh,onDetail}:{scope:TradeQuery["scope"];journal:Journal;today:string;refresh:number;onDetail:(t:Trade)=>void}){
 const [month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState<string|null>(null),[money,setMoney]=useState(true),[retry,setRetry]=useState(0);
 const from=month+"-01",to=addDays(shiftMonth(month,1)+"-01",-1),selected=day??(today.startsWith(month)?today:from);
 const params=queryParams({scope,from,to,state:"closed"});params.set("mode","analytics");
 const result=useServerQuery<Analytics>(params,refresh+retry),summary=result.data?decodeSummary(result.data.summary):null;
 const monetary=money&&summary?.cashComplete&&summary.currency!==null;
 const days=new Map(result.data?.daily.map(p=>[dayKey(p.at),p])??[]),count=Number(to.slice(-2)),chosen=days.get(selected);
 const move=(offset:number)=>{setMonth(shiftMonth(month,offset));setDay(null)};
 return <Panel title="Calendario P&L" description={`${monthLabel(month)} · ${monetary?summary?.currency:"R"}`} className="calendar-panel" action={<div className="calendar-nav"><Button tone="quiet" onClick={()=>{setMonth(today.slice(0,7));setDay(null)}}>Hoy</Button>{summary?.cashComplete&&<Button tone="quiet" onClick={()=>setMoney(v=>!v)}>{monetary?"Ver R":"Ver "+summary.currency}</Button>}<Button aria-label="Mes anterior" onClick={()=>move(-1)}><ChevronLeft size={16}/></Button><Button aria-label="Mes siguiente" onClick={()=>move(1)}><ChevronRight size={16}/></Button></div>}>
 {result.loading?<Empty title="Consultando calendario…"/>:result.error?<p role="alert">{result.error.message}<Button onClick={()=>setRetry(v=>v+1)}>Reintentar</Button></p>:<div className="calendar-body"><div className="calendar-grid">{WEEKDAYS.map(d=><span className="weekday" key={d}>{d}</span>)}{Array.from({length:weekday(from)},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:count},(_,i)=>{const key=month+"-"+String(i+1).padStart(2,"0"),p=days.get(key),value=p?(monetary?p.money:p.withR?p.r:null):null;return <button key={key} className={`day day-${valueTone(value)} ${p?"has-trades":""}`} aria-pressed={selected===key} aria-label={`${i+1}, ${p?.count??0} operaciones`} onClick={()=>setDay(key)}>{i+1}</button>})}</div><div className="day-detail"><div className="split"><span>{Number(selected.slice(-2))} · {chosen?.count??0} operaciones · {monetary?`${chosen?.withCash??0} con P&L`:`${chosen?.withR??0} con R`}</span><Result unit={monetary?"money":"r"} value={chosen?(monetary?chosen.money:chosen.withR?chosen.r:null):null} currency={summary?.currency}/></div>{chosen&&result.data&&<CalendarDay key={selected+":"+result.data.revision} query={{scope,from:selected,to:selected,q:"",sort:"latest",state:"closed"}} journal={journal} revision={result.data.revision} refresh={refresh+retry} onDetail={onDetail} onRefresh={()=>setRetry(v=>v+1)}/>}</div></div>}
 </Panel>;
}

export function ServerDashboard({query,journal,today,refresh,onDetail,onLog,onAdd,onSettings}:{query:TradeQuery;journal:Journal;today:string;refresh:number;onDetail:(t:Trade)=>void;onLog:()=>void;onAdd:()=>void;onSettings:()=>void}){
 const [resolution,setResolution]=useState<"day"|"trade">("day"),[retry,setRetry]=useState(0);
 const params=queryParams(query);params.set("mode","analytics");if(resolution==="trade")params.set("granularity","trade");
 const result=useServerQuery<Analytics>(params,refresh+retry),summary=result.data?decodeSummary(result.data.summary):null;
 const riskParams=queryParams({scope:query.scope});riskParams.set("mode","daily-risk");riskParams.set("today",today);
 const risk=useServerQuery<{accounts:{name:string;daily:{status:string}}[]}>(riskParams,refresh+retry);
 const recentParams=result.data?queryParams({...query,sort:"latest"}):null;if(recentParams){recentParams.set("mode","list");recentParams.set("size","5");recentParams.set("revision",String(result.data!.revision));}
 const recent=useServerQuery<TradePage>(recentParams,refresh+retry);
 const series=useMemo(()=>{let cash=0,r=0;const money=[{value:0,at:null as number|null}],points=[{value:0,at:null as number|null}];for(const p of result.data?.daily??[]){cash+=p.money;r+=p.r;money.push({value:cash,at:p.at});if(p.withR)points.push({value:r,at:p.at});}return {money,r:points,closed:summary?.closed??0,rCount:summary?.rCount??0,resolution};},[result.data,summary?.closed,summary?.rCount,resolution]);
 if(result.loading)return <Empty title="Calculando el resumen completo de tus filtros…"/>;
 if(result.error||!summary)return <div role="alert" className="error-banner"><span>{result.error?.message??"No se pudo cargar el resumen."}</span><Button onClick={()=>setRetry(v=>v+1)}>Reintentar</Button></div>;
 return <>{summary.closed+summary.open===0&&<div className="welcome-panel"><div><h2>Sin operaciones en este periodo</h2><p>Crea una cuenta y registra tus operaciones para comenzar.</p></div><Button onClick={onAdd}>Registrar operación</Button><Button onClick={onSettings}>Configurar cuenta</Button></div>}
 {risk.error&&<p className="informative-note" role="alert">No se pudo evaluar el riesgo diario: {risk.error.message}</p>}
 {risk.data?.accounts.some(a=>a.daily.status==="incomplete")&&<p className="informative-note" role="alert">Límite diario no evaluable: faltan datos de cierres o parciales en una cuenta.</p>}
 {risk.data?.accounts.some(a=>a.daily.status==="reached")&&<p className="error-banner" role="alert">Límite diario alcanzado en: {risk.data.accounts.filter(a=>a.daily.status==="reached").map(a=>a.name).join(", ")}</p>}
 <SummaryMetrics summary={summary}/><div className="section-control"><Button aria-pressed={resolution==="day"} onClick={()=>setResolution("day")}>Curva por día</Button><Button aria-pressed={resolution==="trade"} onClick={()=>setResolution("trade")}>Curva por operación</Button><small>{resolution==="day"?"Agrupada por cierre diario; las métricas conservan el cálculo por operación.":`${numberText(summary.closed)} cierres consultados bajo demanda.`}</small></div>
 <div className="dashboard-grid"><TradeCurve trades={[]} currency={summary.currency} hasCash={summary.cashComplete} series={series}/><ServerCalendar scope={query.scope} journal={journal} today={today} refresh={refresh} onDetail={onDetail}/></div>
 <Panel title="Últimas operaciones" description={`${summary.closed} cerradas · ${summary.open} abiertas en el periodo`} action={<Button onClick={onLog}>Ver bitácora</Button>}>{recent.loading?<Empty title="Consultando operaciones…"/>:recent.error?<p role="alert">{recent.error.message}<Button onClick={()=>setRetry(v=>v+1)}>Actualizar</Button></p>:recent.data?.trades.length?<TradeList rows={recent.data.trades} journal={journal} onDetail={onDetail} compact/>:<Empty title="Sin operaciones en este periodo."/>}</Panel>
 </>;
}
