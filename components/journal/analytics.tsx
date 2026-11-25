"use client";
import {assetKey,assetLabel} from "@/lib/asset-catalog";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Gauge, Printer, Target, TrendingUp } from "lucide-react";
import {useSectionContext,type SectionEnvelope} from "./use-section-context";
import { addDays, dateLabel, dayKey, dayLabel, inputDate, numberText, rLabel, weekStart, reviewSchema, type Currency, type Journal, type Review, type Scope, type Trade } from "@/lib/journal";
import {useServerQuery} from "./use-server-query";
import {queryParams,decodeSummary,type Analytics,type TradeQuery} from "@/lib/journal-query";
import { afterLossGroups, entryHour, entryWeekday, entryOrdinals, assetGroups, groups, realized, summarize, WEEKDAYS } from "@/lib/stats";
import {rBand,shiftMonth} from "@/lib/advanced-stats.mjs";
import {resultR,monthLabel} from "@/lib/journal";
import { AnalysisMetrics, SummaryMetrics } from "./dashboard";
import { errorText, type Save } from "./trade-editor";
import type {ReviewModel} from '@/lib/section-models';
import { Button, cashValue, Empty, Field, Metric, Panel, pct, Result, valueTone } from "./ui";

type Group = ReturnType<typeof groups>[number]&{key?:string};

export function Bars({ data }: { data: Group[] }) {
  if (!data.length) return <Empty icon={<BarChart3 size={19}/>} title="Sin operaciones cerradas para esta vista."/>;
  const max = Math.max(...data.map((item) => Math.abs(item.value ?? 0)), 1);
  return <div className="bars">{data.map(({ key, label, count, withR, value }) =>
    <div className="bar-row" key={key??label}>
      <div className="split"><span>{label} <small>· {withR} de {count} con R</small></span><Result value={value} unit="r"/></div>
      <div className="bar-track" aria-hidden="true">{value !== null && <span className={value < 0 ? "bar-loss" : "bar-win"} style={{ width: `${Math.abs(value) / max * 100}%` }}/>}</div>
    </div>
  )}</div>;
}

function WeekdayHeatmap({ trades, data }: { trades: Trade[];data?:Group[] }) {
  const values = new Map((data??groups(trades, entryWeekday, true)).map((item) => [item.label, item]));
  return <div className="heatmap">
    {WEEKDAYS.map((label) => {
      const group = values.get(label);
      const value = group?.value ?? null;
      return <div className={`heat-day heat-${valueTone(value)}`} key={label}><span>{label}</span><strong>{rLabel(value)}</strong><small>{group ? group.withR : 0} con R</small></div>;
    })}
  </div>;
}

export function Stats({ trades, journal, assumedCurrency, onExport,server }: { trades: Trade[]; journal: Journal; assumedCurrency: Currency; onExport?: (trades:Trade[])=>void;server?:{query:TradeQuery;refresh:number;onExport:(q:TradeQuery)=>void} }) {
  const summary = summarize(trades, journal.accounts, assumedCurrency);
  const [setup, setSetup] = useState("");
  const [asset,setAsset]=useState("");
  const [direction,setDirection]=useState("");
  const [retry,setRetry]=useState(0);
  const serverQuery=server?{...server.query,setup:setup||undefined,asset:asset||undefined,direction:(direction||undefined) as TradeQuery["direction"]}:null;
  const params=serverQuery?queryParams(serverQuery):null;if(params){params.set("mode","analytics");params.set("details","1");}
  const remote=useServerQuery<Analytics>(params,(server?.refresh??0)+retry);
  const grouped=(kind:string,local:Group[])=>server?remote.data?.groups.filter(g=>g.kind===kind).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity))??[]:local;
  const selected=trades.filter(t=>(!setup||t.setupId===setup)&&(!asset||assetKey(t)===asset)&&(!direction||t.direction===direction));
  const report=server&&remote.data?decodeSummary(remote.data.summary):setup||asset||direction?summarize(selected,journal.accounts,assumedCurrency):summary;
  const ordinals=entryOrdinals(journal.trades);
  const distribution=new Map<string,number>();for(const t of realized(selected)){const label=rBand(resultR(t));distribution.set(label,(server?remote.data?.groups.find(g=>g.kind==="band"&&g.label===label)?.count??0:distribution.get(label)??0)+1);}
  const name = (trade: Trade) => journal.setups.find((item) => item.id === trade.setupId)?.name ?? "Sin setup";
  return <div className="nebula-statistics">
    <div className="section-control"><Field label="Setup en estadísticas"><select value={setup} onChange={(event) => setSetup(event.target.value)}>
      <option value="">Todos los setups</option>{journal.setups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></Field><Field label="Activo"><select value={asset} onChange={e=>setAsset(e.target.value)}><option value="">Todos</option>{(server?(remote.data?.assets??(asset?[asset]:[])):[...new Set(trades.map(assetKey))].sort()).map(a=><option key={a} value={a}>{remote.data?.assetLabels?.[a]??assetLabel(trades.find(t=>assetKey(t)===a)??{asset:a})}</option>)}</select></Field><Field label="Dirección"><select value={direction} onChange={e=>setDirection(e.target.value)}><option value="">Todas</option><option value="long">Compra</option><option value="short">Venta</option></select></Field><Button tone="quiet" onClick={()=>{setSetup("");setAsset("");setDirection("")}}>Limpiar</Button>{(onExport||server) && <Button disabled={server?remote.loading||!!remote.error||report.closed+report.open===0:!selected.length} onClick={()=>serverQuery?server!.onExport(serverQuery):onExport?.(selected)}>Compartir / exportar</Button>}{report.closed > 0 && report.closed < 15 && <p className="informative-note">Muestra pequeña: {report.closed} operaciones cerradas. Evita conclusiones definitivas.</p>}</div>
    {server&&remote.loading?<Empty title="Calculando estadísticas de todos los resultados filtrados…"/>:server&&remote.error?<div role="alert" className="error-banner"><span>{remote.error.message}</span><Button onClick={()=>setRetry(v=>v+1)}>Reintentar</Button></div>:<>
    <SummaryMetrics summary={report}/>
    <AnalysisMetrics summary={report}/>
    <div className="analytics-grid">
      <Panel title="Resultado por setup" description="R acumulado"><Bars data={grouped("setup",groups(selected, name))}/></Panel>
      <Panel title="Resultado por activo" description="R acumulado"><Bars data={grouped("asset",assetGroups(selected))}/></Panel>
      <Panel title="Resultado por dirección" description="R acumulado"><Bars data={grouped("direction",groups(selected,trade=>trade.direction==="long"?"Compras":"Ventas"))}/></Panel>
      <Panel title="Resultado por mes" description="R acumulado"><Bars data={grouped("month",groups(selected,trade=>dayKey(trade.closedAt!).slice(0,7)))}/></Panel>
      <Panel title="Hora de entrada" description="R promedio · Ecuador (UTC−5)"><Bars data={grouped("hour",groups(selected, entryHour, true))}/></Panel>
      <Panel title="Día de entrada" description="R promedio por día de la semana"><WeekdayHeatmap trades={selected} data={server?grouped("weekday",[]):undefined}/></Panel>
      <Panel title="Distribución en R" description="Número de cierres por intervalo"><dl className="stat-list">{["Menos de -1 R","-1 a <0 R","0 R",">0 a <1 R","1 a <2 R","2 a <3 R","3 R o más","Sin R"].map(label=><div key={label}><dt>{label}</dt><dd>{server?remote.data?.groups.find(g=>g.kind==="band"&&g.label===label)?.count??0:distribution.get(label)??0}</dd></div>)}</dl></Panel>
      <Panel title="Orden de entrada en el día" description="R promedio por posición de entrada, por cuenta y día Ecuador"><Bars data={grouped("ordinal",groups(selected,t=>{const n=ordinals.get(t.id)??0;return n===0?"Sin orden":n===1?"Primera":n===2?"Segunda":"Tercera o posterior"},true))}/></Panel>
      <Panel title="Resultado por cuenta" description="R acumulado, sin sumar divisas"><Bars data={grouped("account",groups(selected,t=>journal.accounts.find(a=>a.id===t.accountId)?.name??"Sin cuenta"))}/></Panel>
      <Panel title="Plan y resultado" description="Comparación de objetivos y resultados observados">
        <dl className="stat-list">
          <div><dt>R:B planeado medio</dt><dd>{report.rrPlanned === null ? "—" : "1:" + numberText(report.rrPlanned)}</dd></div>
          <div><dt>Ganancia media ÷ pérdida media ({report.ratioBasis??"—"})</dt><dd>{report.ratio === null ? "—" : `${numberText(report.ratio)} · ${report.ratioBasis==="R"?report.rCount:report.cashCount}/${report.closed}`}</dd></div>
          <div><dt>Expectativa monetaria</dt><dd>{cashValue(report.meanCash, report.currency)}</dd></div><div><dt>Cobertura monetaria</dt><dd>{report.cashCount} / {report.closed} cierres · {report.cashComplete?"completa":"incompleta"}</dd></div>
          <div><dt>Mejor / peor R</dt><dd>{rLabel(report.bestR)} / {rLabel(report.worstR)}</dd></div>
          <div><dt>Ganancia / pérdida media en R</dt><dd>{rLabel(report.meanWinR)} / {rLabel(report.meanLossR)}</dd></div>
          <div><dt>Profit factor en R · muestra {report.rCount}/{report.closed}</dt><dd>{report.factorR===null?"—":report.factorR===Infinity?"Sin pérdidas":numberText(report.factorR)}</dd></div><div><dt>Caída máxima en R · muestra {report.rCount}/{report.closed}</dt><dd>{rLabel(report.drawdownR===null?null:-report.drawdownR)}</dd></div><div><dt>Factor de recuperación en R · muestra {report.rCount}/{report.closed}</dt><dd>{report.recoveryR===null?"—":numberText(report.recoveryR)}</dd></div><div><dt>Duración promedio</dt><dd>{report.meanDurationMs===null?"—":numberText(report.meanDurationMs/60000)+" min"}</dd></div><div><dt>Perdedoras / break-even</dt><dd>{pct(report.lossRate)} / {pct(report.flatRate)}</dd></div><div><dt>Cierres sin resultado</dt><dd>{report.unknownCount}</dd></div>
          <div><dt>Ganadas / perdidas / break-even</dt><dd>{report.win} / {report.loss} / {report.flat}</dd></div>
        </dl>
      </Panel>
      <Panel title="Después de una pérdida" description="R promedio según el resultado previo en la misma cuenta">
        <Bars data={grouped("afterLoss",afterLossGroups(journal.trades, selected))}/>
      </Panel>
    </div>
    </>}
  </div>;
}

const emotionTimes = [["before", "Antes"], ["during", "Durante"], ["after", "Después"]] as const;
export function Psychology({ trades, journal, assumedCurrency }: { trades: Trade[]; journal: Journal; assumedCurrency: Currency }) {
  const [stage, setStage] = useState<"before" | "during" | "after">("before");
  const closed = realized(trades);
  const known = closed.filter((trade) => trade[stage] !== null);
  const { discipline, graded } = summarize(trades, journal.accounts, assumedCurrency);
  const notes = known.map((trade) => trade[stage]!.intensity);
  const mean = notes.length ? notes.reduce((sum, value) => sum + value, 0) / notes.length : null;
  const errors = new Map<Trade["errors"][number], number>();
  for (const trade of closed) for (const error of new Set(trade.errors)) errors.set(error, (errors.get(error) ?? 0) + 1);
  return <div className="nebula-psychology">
    <div className="metric-grid metric-grid-three">
      <Metric label="Calificación favorable" value={pct(discipline)} detail={`${graded} operaciones evaluadas`} icon={<ClipboardList size={17}/>}/>
      <Metric label="Emoción registrada" value={closed.length ? pct(known.length / closed.length * 100) : "—"} detail={`${known.length} de ${closed.length} cerradas`} icon={<TrendingUp size={17}/>}/>
      <Metric label="Intensidad media" value={mean === null ? "—" : numberText(mean) + " / 5"} detail="Del momento seleccionado" icon={<Gauge size={17}/>}/>
    </div>
    <div className="analytics-grid">
      <Panel title="Emoción y resultado" description="R promedio por emoción" action={<div className="segmented" aria-label="Momento de la emoción">
        {emotionTimes.map(([value, label]) => <button type="button" key={value} aria-pressed={value === stage} onClick={() => setStage(value)}>{label}</button>)}
      </div>}>
        <Bars data={groups(known, (trade) => trade[stage]!.name, true)}/>
      </Panel>
      <Panel title="Checklist registrado" description="Reglas marcadas, sin confundirlas con la calificación subjetiva">{(()=>{const rules=closed.flatMap(t=>t.checklist);return <p>{rules.length?`${rules.filter(r=>r.checked).length} de ${rules.length} reglas marcadas · ${pct(rules.filter(r=>r.checked).length/rules.length*100)}`:"Sin reglas registradas."}</p>})()}</Panel>
      <Panel title="Errores frecuentes" description="Veces que aparece cada error">
        {errors.size ? <dl className="stat-list">{[...errors].sort((a, b) => b[1] - a[1]).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
          : <Empty title="Aún no hay errores registrados."/>}
      </Panel>
      <Panel title="Frecuencia emocional" description="Emociones observadas en el momento elegido"><dl className="stat-list">{[...new Set(known.map(t=>t[stage]!.name))].map(label=><div key={label}><dt>{label}</dt><dd>{known.filter(t=>t[stage]!.name===label).length}</dd></div>)}</dl>{!known.length&&<Empty title="Sin emociones registradas"/>}</Panel>
      <Panel title="Resultado asociado a errores" description="Asociaciones descriptivas; un trade puede contener varios errores. No demuestra causalidad."><dl className="stat-list">{[...errors.keys()].map(label=>{const sample=closed.filter(t=>t.errors.includes(label));const s=summarize(sample,journal.accounts,assumedCurrency);return <div key={label}><dt>{label} · {s.rCount}/{sample.length} con R</dt><dd>{rLabel(s.meanR)}</dd></div>})}</dl>{!errors.size&&<Empty title="Sin errores registrados"/>}</Panel>
      <Panel title="Riesgo frente al plan" description="Compara el riesgo porcentual registrado con el riesgo habitual actual, no con reglas históricas."><dl className="stat-list"><div><dt>Riesgo superior al habitual</dt><dd>{journal.plan.riskPercent===null?"Sin plan":trades.filter(t=>t.riskPercent!==null&&t.riskPercent>journal.plan.riskPercent!).length}</dd></div><div><dt>Operaciones con riesgo porcentual</dt><dd>{trades.filter(t=>t.riskPercent!==null).length}/{trades.length}</dd></div></dl></Panel>
      <Panel title="Reacción tras una pérdida" description="R promedio según el último cierre anterior en la misma cuenta">
        <Bars data={afterLossGroups(journal.trades, trades)}/>
      </Panel>
    </div>
  </div>;
}

export function Weekly({ journal:initialJournal, trades, today, scope, assumedCurrency, save, draftOwner,onExport,server }: {
  journal: Journal; trades: Trade[]; today: string; scope: Scope; assumedCurrency: Currency; save?: Save;draftOwner?:string;
  onExport?:(trades:Trade[],profile:"semanal"|"mensual",label:string,reviewKey:string)=>void;
  server?:{refresh:number;onExport:(q:TradeQuery,profile:'semanal'|'mensual',label:string,key:string)=>void};
}) {
  const [mode,setMode]=useState<"weekly"|"monthly">("weekly");
  const [week, setWeek] = useState(weekStart(today));
  const [month,setMonth]=useState(today.slice(0,7));
  const start=mode==="weekly"?week:month+"-01";
  const end=mode==="weekly"?addDays(week,7):shiftMonth(month,1)+"-01";
  const reviewKey=mode==="weekly"?week:"month:"+month;
  const previousStart=mode==="weekly"?addDays(week,-7):shiftMonth(month,-1)+"-01";
  const [historyPages,setHistoryPages]=useState<string[]>(['']),[retry,setRetry]=useState(0),params=server?queryParams({scope,q:'',sort:'latest'}):null;
  if(params){params.set('mode','section');params.set('section','revision');params.set('start',start);params.set('end',end);params.set('previous',previousStart);params.set('reviewKey',reviewKey);params.set('historyBefore',historyPages.at(-1)??'');}
  const raw=useServerQuery<SectionEnvelope<ReviewModel&{historyNext?:string|null}>>(params,(server?.refresh??0)+retry),remote=useSectionContext(raw,initialJournal,(server?.refresh??0)+retry);const journal=remote.journal;
  const selected = trades.filter((trade) => trade.closedAt !== null && trade.closedAt >= inputDate(start + "T00:00") && trade.closedAt < inputDate(end + "T00:00"));
  const summary = remote.data?decodeSummary(remote.data.model.summary):summarize(selected, journal.accounts, assumedCurrency);
  const sunday = addDays(week, 6);
  const firstDay = inputDate(week + "T12:00");
  const lastDay = inputDate(sunday + "T12:00");
  const label = mode==="monthly"?monthLabel(month)+" "+month.slice(0,4):`${week.slice(0, 4) === sunday.slice(0, 4) ? dayLabel(firstDay) : dateLabel(firstDay)} – ${dateLabel(lastDay)}`;
  const stored = server?remote.data?.model.review??undefined:journal.reviews.find((review) => review.week === reviewKey && review.scope === scope);
  const goal = mode==="weekly"?journal.plan.weeklyTargetR:null;
  const previous=trades.filter(t=>t.closedAt!==null&&dayKey(t.closedAt)>=previousStart&&dayKey(t.closedAt)<start);
  const prev=remote.data?decodeSummary(remote.data.model.previous):summarize(previous,journal.accounts,assumedCurrency);
  const selectedAccount = scope === "all" ? "Todas las cuentas" : scope === "unassigned" ? "Sin cuenta" : journal.accounts.find((item) => item.id === scope)?.name ?? "Cuenta";
  return <div className="weekly print-area">
    <header className="weekly-header">
      <div className="weekly-period"><CalendarDays size={19}/><div><h2>{label}</h2><small>{selectedAccount} · Ecuador</small></div></div>
      <div className="group-buttons no-print">
        <Field label="Periodo"><select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></Field><Button className="icon-button" aria-label="Periodo anterior" onClick={() => mode==="weekly"?setWeek(addDays(week,-7)):setMonth(shiftMonth(month,-1))}><ChevronLeft size={17}/></Button>
        <Button className="icon-button" aria-label="Periodo siguiente" onClick={() => mode==="weekly"?setWeek(addDays(week,7)):setMonth(shiftMonth(month,1))}><ChevronRight size={17}/></Button>
        <Button disabled={server&&!remote.data} onClick={() => server?server.onExport({scope,from:start,to:addDays(end,-1),q:'',sort:'latest',state:'closed'},mode==='weekly'?'semanal':'mensual',label,reviewKey):onExport?onExport(selected,mode==="weekly"?"semanal":"mensual",label,reviewKey):window.print()}><Printer size={15}/>Compartir / PDF</Button>
      </div>
    </header>
    {server&&!remote.data?<Panel title="Consulta del periodo">{remote.error?<><p role="alert">{remote.error.message}</p><Button onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></>:<p role="status">Preparando el periodo completo…</p>}</Panel>:<>
    <div className="metric-grid">
      <Metric label="P&L neto" value={cashValue(summary.cash, summary.currency)} detail={summary.currency===null?"Monedas distintas":summary.cashComplete?`${summary.cashCount} con P&L · ${summary.currency}`:`${summary.cashCount} de ${summary.closed} con P&L · total no disponible`} icon={<ArrowDownRight size={17}/>} tone={valueTone(summary.cash)}/>
      <Metric label="Operaciones" value={summary.closed} detail={`${summary.win} ganadas · ${summary.loss} perdidas`} icon={<BarChart3 size={17}/>}/>
      <Metric label="R acumulado" value={rLabel(summary.totalR)} detail={`${summary.rCount}/${summary.closed} con R calculable`} icon={<Target size={17}/>} tone={valueTone(summary.totalR)}/>
      <Metric label="Calificación favorable" value={pct(summary.discipline)} detail={`${summary.graded} calificadas`} icon={<ClipboardList size={17}/>}/>
    </div>
    {goal !== null && <Panel title="Meta semanal" description={`Objetivo de +${numberText(goal)} R`}>
      <div className="goal-progress"><progress value={Math.max(0, Math.min(goal, summary.totalR ?? 0))} max={goal}/><strong>{summary.totalR === null ? "Sin R calculable" : `${rLabel(summary.totalR)} de +${numberText(goal)} R`}</strong></div>
    </Panel>}
    <Panel title="Comparación con el periodo anterior"><dl className="stat-list v2-tools"><div><dt>R anterior</dt><dd>{rLabel(prev.totalR)}</dd></div><div><dt>R actual</dt><dd>{rLabel(summary.totalR)}</dd></div><div><dt>Mejor / peor R actual</dt><dd>{rLabel(summary.bestR)} / {rLabel(summary.worstR)}</dd></div></dl></Panel>
    <ReviewForm key={reviewKey + scope} draftOwner={draftOwner} label={label} stored={stored} week={reviewKey} scope={scope} save={save}/>
    {remote.data&&<Panel title="Resultados diarios"><Bars data={remote.data.model.daily}/></Panel>}
    <Panel title="Revisiones guardadas"><div className="v2-tools">{server&&<div className="pagination"><Button disabled={historyPages.length===1||remote.loading} onClick={()=>setHistoryPages(p=>p.slice(0,-1))}>Revisiones anteriores de la lista</Button><span>Página {historyPages.length}</span><Button disabled={!remote.data?.model.historyNext||remote.loading} onClick={()=>setHistoryPages(p=>[...p,remote.data!.model.historyNext!])}>Más revisiones guardadas</Button></div>}{(server?remote.data?.model.history??[]:journal.reviews.filter(r=>r.scope===scope)).slice().sort((a,b)=>b.week.replace("month:","").localeCompare(a.week.replace("month:",""))).map(r=><div className="settings-row" key={r.week}><span>{r.week.startsWith("month:")?"Mensual · "+r.week.slice(6):"Semanal · "+r.week}</span><Button tone="quiet" onClick={()=>{if(r.week.startsWith("month:")){setMode("monthly");setMonth(r.week.slice(6));}else{setMode("weekly");setWeek(r.week)}}}>Abrir</Button></div>)}</div></Panel>
    </>}
  </div>;
}

const reviewQuestions = [
  ["followed", "¿Seguí mi plan?"],
  ["repeat", "¿Qué repetiría?"],
  ["change", "¿Qué cambiaré?"],
] as const;

function ReviewForm({ stored, week, scope, label, save, draftOwner }: { stored?: Review; week: string; scope: Scope; label: string; save?: Save;draftOwner?:string }) {
  const [review, setReview] = useState(() => ({
    followed: stored?.followed ?? "", repeat: stored?.repeat ?? "", change: stored?.change ?? "",
  }));
  const [version, setVersion] = useState(stored?.version ?? 0);
  const key=draftOwner?`tradeify-review:${draftOwner}:${week}:${scope}`:null;
  const [draftNotice,setDraftNotice]=useState("");
  useEffect(()=>{const timer=setTimeout(()=>{if(!key)return;try{const raw=JSON.parse(sessionStorage.getItem(key)??"null");if(!raw)return;const parsed=reviewSchema.safeParse(raw.review);if(parsed.success&&raw.version===(stored?.version??0)){setReview(parsed.data);setDraftNotice("Borrador recuperado en esta pestaña.");}else setDraftNotice("Hay un borrador de una versión anterior; no se aplicó. Puedes descartarlo.")}catch{}},0);return()=>clearTimeout(timer)},[key,stored?.version]);
  function changeReview(next:typeof review){setReview(next);if(key)try{sessionStorage.setItem(key,JSON.stringify({version,review:next}));setDraftNotice("Borrador guardado en esta pestaña.")}catch{setDraftNotice("No se pudo guardar el borrador.")}}
  function discard(){if(key)try{sessionStorage.removeItem(key)}catch{}setReview({followed:stored?.followed??"",repeat:stored?.repeat??"",change:stored?.change??""});setVersion(stored?.version??0);setDraftNotice("");}
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!save || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await save({ action: "saveReview", week, scope, version, review }, "Revisión guardada.");
      setVersion(saved.version ?? version);
      if(key)try{sessionStorage.removeItem(key)}catch{}
      setDraftNotice("");
    } catch (reason) { setError(errorText(reason)); }
    setBusy(false);
  }
  return <Panel title={week.startsWith("month:")?"Reflexión mensual":"Reflexión semanal"} description={label}><form className="review-form" onSubmit={submit}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {draftNotice&&<div className="group-buttons no-print"><small role="status">{draftNotice}</small><Button tone="quiet" disabled={busy} onClick={discard}>Descartar borrador</Button></div>}
    {reviewQuestions.map(([key, question]) => <div key={key}>
      <div className="no-print"><Field label={question}><textarea rows={3} maxLength={2500} value={review[key]} disabled={busy} onChange={(event) => changeReview({ ...review, [key]: event.target.value })}/></Field></div>
      <div className="only-print"><strong>{question}</strong><p>{review[key] || "—"}</p></div>
    </div>)}
    {save && <div className="align-end no-print"><Button tone="primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar revisión"}</Button></div>}
  </form></Panel>;
}
