"use client";

import {CaptureBadge} from "./capture-compare";
import {assetLabel} from "@/lib/asset-catalog";
import { ArrowUpRight, ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { currencyOf, dayLabel, outcome, resultR, timeLabel, type Journal, type Trade } from "@/lib/journal";
import {useServerQuery} from "./use-server-query";
import {queryParams, type TradeQuery,type TradePage} from "@/lib/journal-query";
import {EMOTIONS} from "@/lib/journal";
import { Button, Empty, Field, Panel, Result, resultName, SetupTag, TradeSide } from "./ui";

export type Mode = "auto" | "table" | "cards";

export function TradeList({ rows, journal, onDetail, mode = "auto", compact = false }: { rows: Trade[]; journal: Journal; onDetail: (trade: Trade) => void; mode?: Mode; compact?: boolean }) {
  const setups = new Map(journal.setups.map((setup) => [setup.id, setup]));
  const accountName = (trade: Trade) => journal.accounts.find((account) => account.id === trade.accountId)?.name ?? "Sin cuenta";
  const timestamp = (trade: Trade) => trade.closedAt ?? trade.openedAt;
  return <>
    {mode !== "cards" && <div className={`table-scroll ${mode === "auto" ? "auto-table" : ""}`}>
      <table className="journal-table">
        <thead><tr><th scope="col">Activo</th><th scope="col">Fecha · EC</th><th scope="col">Dirección</th><th scope="col">Setup</th>{!compact && <th scope="col">Emoción</th>}<th scope="col" className="right">P&L neto</th><th scope="col" className="right">Resultado</th><th scope="col"><span className="sr-only">Detalle</span></th></tr></thead>
        <tbody>{rows.map((trade) => <tr key={trade.id}>
          <td><button type="button" className="trade-symbol" onClick={() => onDetail(trade)}>{assetLabel(trade)}</button>{trade.market&&<small className="table-sub">Símbolo: {trade.asset}</small>}<small className="table-sub">{accountName(trade)}</small><CaptureBadge links={trade.captureLinks}/></td>
          <td><span className="num">{dayLabel(timestamp(trade))}</span><small className="table-sub">{timeLabel(timestamp(trade))}</small></td>
          <td><TradeSide direction={trade.direction}/></td>
          <td><SetupTag setup={setups.get(trade.setupId ?? "")}/></td>
          {!compact && <td>{trade.before?.name ?? <span className="muted">—</span>}</td>}
          <td className="right">{trade.closedAt === null ? <span className="tag tag-ámbar">Abierta</span> : <Result unit="money" value={trade.pnlCents} currency={currencyOf(trade, journal.accounts)}/>}</td>
          <td className="right"><Result unit="r" value={resultR(trade)}/></td>
          <td className="right"><Button tone="quiet" className="icon-button" aria-label={`Ver detalle de ${trade.asset} del ${dayLabel(timestamp(trade))}`} onClick={() => onDetail(trade)}><ArrowUpRight size={16}/></Button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {mode !== "table" && <div className={`trade-cards ${mode === "auto" ? "auto-cards" : ""}`}>
      {rows.map((trade) => <button type="button" className="trade-card" key={trade.id} onClick={() => onDetail(trade)}>
        <span className="trade-card-main"><span><strong>{assetLabel(trade)}</strong>{trade.market&&<small>Símbolo: {trade.asset}</small>}<small>{dayLabel(timestamp(trade))} · {accountName(trade)}</small><CaptureBadge links={trade.captureLinks}/></span><TradeSide direction={trade.direction}/></span>
        <span className="trade-card-secondary"><SetupTag setup={setups.get(trade.setupId ?? "")}/><span>{trade.closedAt === null ? <span className="tag tag-ámbar">Abierta</span> : <Result unit="money" value={trade.pnlCents} currency={currencyOf(trade, journal.accounts)}/>}<Result unit="r" value={resultR(trade)}/></span></span>
      </button>)}
    </div>}
  </>;
}

const pageSize = 20;
export function TradeLog({ trades, journal, onDetail, onExport, onImport, server }: {
  trades: Trade[]; journal: Journal; onDetail: (trade: Trade) => void; onExport: (trades: Trade[]) => void; onImport?: () => void; server?:{query:TradeQuery;refresh:number;onExport:(q:TradeQuery)=>void};
}) {
  const [query, setQuery] = useState("");
  const [setup, setSetup] = useState("");
  const [emotion, setEmotion] = useState("");
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [direction,setDirection]=useState("");
  const [state,setState]=useState("");
  const [sort,setSort]=useState("latest");
  useEffect(()=>{const t=setTimeout(()=>{try{const v=localStorage.getItem("tradeify-list-mode");if(v==="table"||v==="cards"||v==="auto")setMode(v)}catch{}},0);return ()=>clearTimeout(t)},[]);
  const chooseMode=(v:Mode)=>{setMode(v);try{localStorage.setItem("tradeify-list-mode",v)}catch{}};
  const [page, setPage] = useState(0);
  const [cursors,setCursors]=useState<string[]>([""]);
  const [retry,setRetry]=useState(0);
  const serverQuery=server?{...server.query,q:query,setup:setup||undefined,emotion:(emotion||undefined) as TradeQuery["emotion"],result:(result||undefined) as TradeQuery["result"],direction:(direction||undefined) as TradeQuery["direction"],state:(state||undefined) as TradeQuery["state"],sort:sort as TradeQuery["sort"]}:null;
  const params=serverQuery?queryParams(serverQuery):null;
  if(params){params.set("mode","list");params.set("size",String(pageSize));params.set("count","1");if(page>0&&cursors[page])params.set("cursor",cursors[page]);}
  const remote=useServerQuery<TradePage>(params,(server?.refresh??0)+retry);
  useEffect(()=>{
    if(server?.refresh===undefined)return;
    const timer=setTimeout(()=>{setPage(0);setCursors([""]);},0);return()=>clearTimeout(timer);
  },[server?.refresh]);
  const filtersRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    setPage(next);
    window.requestAnimationFrame(() => {
      filtersRef.current?.scrollIntoView({ block: "start" });
      filtersRef.current?.focus({ preventScroll: true });
    });
  };
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleUpperCase("es");
    return trades.filter((trade) => {
      const strategy = journal.setups.find((item) => item.id === trade.setupId)?.name ?? "";
      return (!search || (trade.asset + " " + assetLabel(trade) + " " + strategy + " " + trade.notes.map(n=>n.text).join(" ")).toLocaleUpperCase("es").includes(search))
        && (!direction || trade.direction===direction) && (!state || (state==="open"?trade.closedAt===null:trade.closedAt!==null)) && (!setup || trade.setupId === setup) && (!emotion || trade.before?.name === emotion) && (!result || outcome(trade) === result);
    }).sort((a,b)=>{if(sort==="r")return (resultR(b)??-Infinity)-(resultR(a)??-Infinity)||b.openedAt-a.openedAt;if(sort==="duration")return (b.closedAt===null?-1:b.closedAt-b.openedAt)-(a.closedAt===null?-1:a.closedAt-a.openedAt)||b.openedAt-a.openedAt;return sort==="oldest"?(a.closedAt??a.openedAt)-(b.closedAt??b.openedAt):(b.closedAt??b.openedAt)-(a.closedAt??a.openedAt)});
  }, [trades, journal.setups, query, setup, emotion, result,direction,state,sort]);
  const count=server?(remote.data?.total??0):filtered.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const index = Math.min(page, pages - 1);
  const emotions = server?[...EMOTIONS]:[...new Set(trades.flatMap((trade) => trade.before ? [trade.before.name] : []))].sort();
  return <Panel title="Operaciones" description={server?`${count} operaciones según filtros · Página consultada en el servidor`:`${filtered.length} de ${trades.length} en el periodo · Fecha de cierre o entrada si sigue abierta`}
    action={<div className="group-buttons">{onImport && <Button onClick={onImport}>Importar CSV</Button>}<Button disabled={server?remote.loading||!!remote.error||!count:!filtered.length} onClick={() => serverQuery?server!.onExport(serverQuery):onExport(filtered)}>Compartir / exportar</Button></div>}>
    <div className="trade-filters" ref={filtersRef} tabIndex={-1} role="group" aria-label="Filtros de operaciones">
      <Field label="Buscar activo, setup o notas"><span className="search-field"><Search size={16}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Ej. US100" type="search"/></span></Field>
      <Field label="Setup"><select value={setup} onChange={(event) => { setSetup(event.target.value); setPage(0); }}><option value="">Todos</option>{journal.setups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Emoción previa"><select value={emotion} onChange={(event) => { setEmotion(event.target.value); setPage(0); }}><option value="">Todas</option>{emotions.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Resultado"><select value={result} onChange={(event) => { setResult(event.target.value); setPage(0); }}><option value="">Todos</option>{Object.entries(resultName).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
      <Field label="Estado"><select value={state} onChange={e=>{setState(e.target.value);setPage(0)}}><option value="">Todas</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select></Field>
      <Field label="Dirección"><select value={direction} onChange={e=>{setDirection(e.target.value);setPage(0)}}><option value="">Todas</option><option value="long">Compra</option><option value="short">Venta</option></select></Field>
      <Field label="Orden"><select value={sort} onChange={e=>{setSort(e.target.value);setPage(0)}}><option value="latest">Más recientes</option><option value="oldest">Más antiguas</option><option value="r">Mayor R</option><option value="duration">Mayor duración cerrada</option></select></Field>
      <Button tone="quiet" onClick={()=>{setQuery("");setSetup("");setEmotion("");setResult("");setDirection("");setState("");setSort("latest");setPage(0)}}>Limpiar filtros</Button>
      <div className="segmented view-mode" aria-label="Formato de la bitácora">
        <button className={mode === "auto" ? "default-table" : ""} aria-pressed={mode === "table"} type="button" aria-label="Vista de tabla" onClick={() => chooseMode("table")}><List size={16}/></button>
        <button className={mode === "auto" ? "default-cards" : ""} aria-pressed={mode === "cards"} type="button" aria-label="Vista de tarjetas" onClick={() => chooseMode("cards")}><LayoutGrid size={15}/></button>
      </div>
    </div>
    {server?(remote.loading?<Empty title="Consultando operaciones…"/>:remote.error?<div role="alert" className="error-banner"><span>{remote.error.message}</span><Button onClick={()=>{setPage(0);setCursors([""]);setRetry(v=>v+1)}}>Actualizar páginas</Button></div>:remote.data?.trades.length?<TradeList rows={remote.data.trades} journal={journal} onDetail={onDetail} mode={mode}/>:<Empty title="No hay operaciones con estos filtros."/>):<>
    {filtered.length
      ? <TradeList rows={filtered.slice(index * pageSize, (index + 1) * pageSize)} journal={journal} onDetail={onDetail} mode={mode}/>
      : <Empty icon={<SlidersHorizontal size={21}/>} title="No hay operaciones con estos filtros."
          action={(query || setup || emotion || result || direction || state) && <Button tone="quiet" onClick={() => { setQuery(""); setSetup(""); setEmotion(""); setResult(""); setDirection("");setState("");setPage(0); }}>Limpiar filtros</Button>}/>}
    </>}
    {pages > 1 && <div className="pagination"><span className="muted">Página {index + 1} de {pages}</span>
      <Button className="icon-button" aria-label="Página anterior" disabled={remote.loading&&!!server||index === 0} onClick={() => changePage(index - 1)}><ChevronLeft size={16}/></Button>
      <Button className="icon-button" aria-label="Página siguiente" disabled={server?remote.loading||!remote.data?.next:index + 1 === pages} onClick={() => {if(server&&remote.data?.next)setCursors([...cursors.slice(0,page+1),remote.data.next]);changePage(index + 1)}}><ChevronRight size={16}/></Button>
    </div>}
  </Panel>;
}
