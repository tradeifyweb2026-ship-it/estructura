"use client";
import {WorkspaceNavigation,WorkspaceSkeleton} from "./workspace-navigation";
import {SectionMetadataRefresh} from "./use-section-context";

import {applyJournalUpdate,type MutationResult} from "@/lib/journal-update";
import {marketSymbol} from "@/lib/market-widgets";
import {mergeCapturePage} from "@/lib/journal-pages.mjs";
import Link from "next/link";
import { AccountAccess } from "./account-access";
import {clearOwnerDrafts} from "@/lib/editor-draft";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BookOpen, ChartNoAxesCombined, ChevronRight, ClipboardList, HeartPulse, LogOut, Moon, Plus, Settings2, ShieldCheck, Share2, Sun, TriangleAlert } from "lucide-react";
import { addDays, blankJournal, dayKey, matchesScope, weekStart, type Currency, type Journal, type JournalAction, type Scope, type Trade } from "@/lib/journal";
import { periodName, type ReportProfile } from "@/lib/report";
import {ServerDashboard} from "./server-dashboard";
import {readJournal,readCompleteJournal,QueryError} from "@/lib/journal-read";
import {type TradeQuery,type JournalMetadata} from "@/lib/journal-query";
import { TradeLog } from "./trade-list";
import { Stats, Weekly } from "./analytics";
import {ServerPsychology,ServerAccounts,ServerStrategies,ServerRisk} from './server-sections';
import { RestoreDialog } from "./restore-dialog";
import { ImportDialog, ManageEditor, Settings, type Edit } from "./settings";
import { errorText, TradeEditor, type Save } from "./trade-editor";
import { TradeDetail } from "./trade-detail";
import { ExportDialog, type ExportTarget } from "./export-dialog";
import {HelpLink} from "./help-center";
import {useMaintenance} from "./maintenance";
import { useDailyQuote } from "./daily-quote";
import { Brand, Button, Empty, Field } from "./ui";
import { Calculator, CreditCard, Gauge, CircleHelp } from "lucide-react";
import { ToolsHub, HelpView } from "./tools";

const Markets = lazy(() => import("./markets").then(m => ({default:m.Markets})));

const routes = {
  resumen: { title: "Resumen de trading", nav: "Resumen", sub: "Resultados, calendario y últimas operaciones.", icon: ChartNoAxesCombined },
  bitacora: { title: "Bitácora de operaciones", nav: "Bitácora", sub: "Consulta tus entradas, salidas y notas de ejecución.", icon: BookOpen },
  estadisticas: { title: "Estadísticas", nav: "Estadísticas", sub: "Resultados por setup, activo y horario de entrada.", icon: BarChart3 },
  psicologia: { title: "Psicología", nav: "Psicología", sub: "Relaciona las emociones y la ejecución con tus resultados.", icon: HeartPulse },
  revision: { title: "Revisión personal", nav: "Revisión", sub: "Revisa lo que funcionó y registra qué vas a cambiar.", icon: ClipboardList },
  mercados: {title:"Mercados",nav:"Mercados",sub:"Gráficos, agenda y herramientas para preparar tu sesión.",icon:ChartNoAxesCombined},
  cuentas: {title:"Cuentas de trading",nav:"Cuentas",sub:"Administra tus cuentas, monedas y capital inicial.",icon:CreditCard},
  riesgo: {title:"Gestión de riesgo",nav:"Riesgo",sub:"Consulta límites y riesgo registrado.",icon:Gauge},
  estrategias: {title:"Estrategias",nav:"Estrategias",sub:"Organiza los setups que utilizas.",icon:ClipboardList},
  calculadoras: {title:"Herramientas",nav:"Herramientas",sub:"Calculadoras y biblioteca privada de scripts.",icon:Calculator},
  ayuda: {title:"Centro de ayuda",nav:"Ayuda",sub:"Aprende a utilizar Tradeify.",icon:CircleHelp},
  configuracion: { title: "Configuración", nav: "Configuración", sub: "Define tu plan, preferencias y respaldos.", icon: Settings2 },
} as const;
type Route = keyof typeof routes;
const navGroups:{title:string;items:Route[]}[]=[{title:'Diario',items:['resumen','bitacora','revision']},{title:'Análisis',items:['estadisticas','psicologia','mercados']},{title:'Gestión',items:['cuentas','riesgo','estrategias','configuracion']},{title:'Herramientas',items:['calculadoras','ayuda']}];
type Period = "30" | "7" | "90" | "week" | "all" | "custom";
type Overlay = { kind: "trade"; id: string } | { kind: "editor"; trade?: Trade; close?: boolean } | { kind: "manage"; edit: Edit } | { kind: "import" } | {kind:"restore"};

const readRoute = (): Route => {
  const key = window.location.hash.slice(1).split("/")[0];
  return Object.hasOwn(routes, key) ? key as Route : "resumen";
};

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requestData<T>(action?: JournalAction): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/bitacora", action ? {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Bitacora-Request": "1" },
      body: JSON.stringify(action),
    } : { cache: "no-store" });
  } catch {
    throw new RequestError("No se pudo conectar con la bitácora. Verifica tu conexión y vuelve a intentarlo.", 0);
  }
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok || data === null) {
    throw new RequestError(data?.error ?? "No se pudo acceder a la bitácora. Actualiza la página e inicia sesión si hace falta.", response.status);
  }
  return data as T;
}

function AccountFilter({ accounts, scope, onChange }: { accounts: Journal["accounts"]; scope: Scope; onChange: (value: Scope) => void }) {
  return <Field label="Cuenta"><select value={scope} onChange={(event) => onChange(event.target.value)}>
    <option value="all">Todas las cuentas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.archived ? " · archivada" : ""}</option>)}
    <option value="unassigned">Sin cuenta · USD</option>
  </select></Field>;
}

export function JournalApp({ admin=false,draftOwner,marketDefault,today:initialToday, displayName, signInHref, signOutHref }: {
  admin?: boolean; draftOwner?:string; marketDefault?: string; today: string; displayName?: string; signInHref: string; signOutHref?: string;
}) {
  const [today,setToday]=useState(initialToday);
  useEffect(()=>{const update=()=>setToday(dayKey(Date.now()));const timer=setInterval(update,60000);document.addEventListener("visibilitychange",update);return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",update)}},[]);
  const [journal, setJournal] = useState<Journal>(blankJournal);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; expired: boolean } | null>(null);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyError,setHistoryError]=useState("");
  const [fullReady,setFullReady]=useState(false);
  const [queryGeneration,setQueryGeneration]=useState(0);
  const [recentMarketAsset,setRecentMarketAsset]=useState<{asset:string;openedAt:number}|null>(null);
  const [exportBusy,setExportBusy]=useState(false);
  const [restorePreparing,setRestorePreparing]=useState(false);
  const suspendRefresh=useRef(false);
  const exportController=useRef<AbortController|null>(null);
  const [readStatus,setReadStatus]=useState("");
  const [exportJournal,setExportJournal]=useState<Journal|null>(null);
  const fullController=useRef<AbortController|null>(null);
  const fullPromise=useRef<Promise<Journal>|null>(null);
  const detailRequest=useRef(0);
  const [detailCache,setDetailCache]=useState<{trade:Trade|null;captures:Journal["captures"]}>({trade:null,captures:[]});
  const [toast, setToast] = useState("");
  const [view, setView] = useState<Route>("resumen");
  const [light, setLight] = useState(false);
  const [themeReady,setThemeReady]=useState(false);
  const [period, setPeriod] = useState<Period>("30");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [scope, setScope] = useState<Scope>("all");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [exporting, setExporting] = useState<ExportTarget | null>(null);
  const requestNumber = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const refreshedAt = useRef(0);
  const refreshing=useRef(false);
  const localUpdatesDuringLoad=useRef<{action:JournalAction;result:MutationResult}[]>([]);
  const maintenance=useMaintenance(admin);
  const dailyQuote = useDailyQuote(!loading && !loadError,draftOwner);

  const refresh = useCallback(async () => {
    const request=++requestNumber.current;
    controller.current?.abort();
    const abort=new AbortController();
    controller.current=abort;
    refreshing.current=true;
    fullController.current?.abort();fullPromise.current=null;
    localUpdatesDuringLoad.current=[];
    setFullReady(false);setHistoryError("");setHistoryLoading(false);setQueryGeneration(v=>v+1);
    try{
      const initial=await readJournal<JournalMetadata>(new URLSearchParams({mode:"metadata"}),abort.signal);
      if(request===requestNumber.current){
        setJournal(()=>localUpdatesDuringLoad.current.reduce<Journal>((data,update)=>applyJournalUpdate(data,update.action,update.result)??data,{...initial,trades:[],captures:[]}));
        setRecentMarketAsset(initial.recentAsset);setLoaded(true);setLoadError(null);refreshedAt.current=Date.now();
      }
    }catch(error){if(!abort.signal.aborted&&request===requestNumber.current)setLoadError({message:errorText(error),expired:(error instanceof RequestError||error instanceof QueryError)&&error.status===401});}
    finally{if(request===requestNumber.current){refreshing.current=false;setLoading(false);}}
  }, []);

  const canRefreshSectionMetadata=!exportBusy&&!restorePreparing&&overlay?.kind!=='restore'&&overlay?.kind!=='import';
  const refreshSectionMetadata=useCallback(async()=>{if(!refreshing.current&&canRefreshSectionMetadata)await refresh();},[refresh,canRefreshSectionMetadata]);
  const ensureFullHistory=useCallback(()=>{
    if(fullPromise.current)return fullPromise.current;
    const abort=new AbortController();fullController.current?.abort();fullController.current=abort;
    const generation=requestNumber.current;
    setHistoryLoading(true);setHistoryError("");
    const pending=readCompleteJournal({},abort.signal).then(next=>{
      if(abort.signal.aborted||generation!==requestNumber.current)throw new DOMException("Lectura cancelada","AbortError");
      setJournal(next);setFullReady(true);return next;
    }).catch(error=>{if(!abort.signal.aborted&&generation===requestNumber.current){setHistoryError(errorText(error));setFullReady(false);}throw error;})
      .finally(()=>{if(fullController.current===abort){setHistoryLoading(false);fullPromise.current=null;}});
    fullPromise.current=pending;return pending;
  },[]);
  const needsFullHistory=false;
  useEffect(()=>{
    if(!loaded||!needsFullHistory||fullReady||historyLoading||historyError)return;
    const timer=setTimeout(()=>{void ensureFullHistory().catch(()=>{});},0);return()=>clearTimeout(timer);
  },[loaded,needsFullHistory,fullReady,historyLoading,historyError,ensureFullHistory]);

  useEffect(()=>{
    if(needsFullHistory||!fullReady||restorePreparing||overlay?.kind==="restore")return;
    const timer=setTimeout(()=>{setFullReady(false);setJournal(previous=>({...previous,trades:[],captures:[]}));},0);
    return()=>clearTimeout(timer);
  },[needsFullHistory,fullReady,restorePreparing,overlay?.kind]);

  useEffect(()=>{suspendRefresh.current=overlay?.kind==="restore"||overlay?.kind==="import"||restorePreparing||exportBusy;},[overlay?.kind,restorePreparing,exportBusy]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    function restore() { if (document.visibilityState === "visible" && !suspendRefresh.current && !refreshing.current && Date.now()-refreshedAt.current>60000) void refresh(); }
    document.addEventListener("visibilitychange", restore);
    return () => { window.clearTimeout(timer); controller.current?.abort();fullController.current?.abort();exportController.current?.abort(); document.removeEventListener("visibilitychange", restore); };
  }, [refresh]);
  useEffect(() => {
    const update = () => { setView(readRoute()); window.scrollTo(0, 0); };
    const timer = window.setTimeout(() => {
      update();
      try { setLight(window.localStorage.getItem("trading-journal-theme") === "light"); } catch {}
      setThemeReady(true);
    }, 0);
    window.addEventListener("hashchange", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", update); };
  }, []);
  useEffect(() => {
    if(themeReady)document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light,themeReady]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const data = journal;
  const activeAccount = data.accounts.find((item) => item.id === scope);
  const assumedCurrency: Currency = activeAccount?.currency ?? "USD";
  const scopedTrades = useMemo(() => data.trades.filter((trade) => matchesScope(trade, scope)), [data.trades, scope]);
  const start = period === "custom" ? from : period === "week" ? weekStart(today) : period === "all" ? "" : addDays(today, 1 - Number(period));
  const end = period === "custom" ? to : period === "all" ? "" : today;
  const filtered = useMemo(() => scopedTrades.filter((trade) => {
    const key = dayKey(trade.closedAt ?? trade.openedAt);
    return (!start || key >= start) && (!end || key <= end);
  }), [scopedTrades, start, end]);
  const accountLabel = scope === "all" ? "Todas las cuentas" : scope === "unassigned" ? "Sin cuenta" : activeAccount?.name ?? "Cuenta";
  const periodLabel = periodName(period, start, end);
  const openExport = (trades: Trade[]) => {if(historyLoading||historyError){setToast("Espera a que termine la carga del historial o reintenta antes de exportar.");return;}setExportJournal(data);setExporting({kind:"periodo",trades,period:periodLabel,account:accountLabel,assumedCurrency,scope,profile:view==="psicologia"?"psicologia":"bitacora"});};
  const historyReady = fullReady && loaded && !historyLoading && !historyError && !loadError;
  const serverQuery:TradeQuery={scope,from:start||undefined,to:end||undefined,q:"",sort:"latest"};
  const exportContext=useRef("");useEffect(()=>{exportContext.current=JSON.stringify({view,scope,period,from,to});},[view,scope,period,from,to]);
  const openQueryExport=async(query:TradeQuery,all=false,profile:ReportProfile=view==="resumen"?"resumen":view==="psicologia"?'psicologia':view==="estadisticas"?"estadisticas":view==="riesgo"?"riesgo":view==="cuentas"?"cuentas":view==="estrategias"?"estrategias":"bitacora",label=periodLabel,reviewKey?:string)=>{
    if(exportBusy)return;setExportBusy(true);setReadStatus("");
    const context=exportContext.current;
    const abort=new AbortController();exportController.current=abort;
    try{const next=await readCompleteJournal(query,abort.signal,p=>setReadStatus(p.waitingSeconds!==undefined?`Límite temporal de solicitudes: esperando ${p.waitingSeconds} s. ${p.loaded} registros preparados.`:`${p.loaded} registros preparados.`));if(context!==exportContext.current)throw new Error("La vista o los filtros cambiaron durante la preparación. Genera el reporte otra vez.");setExportJournal(next);setExporting({kind:"periodo",profile,reviewKey,scope:query.scope,completeHistory:Object.entries(query).every(([key,value])=>["scope","sort"].includes(key)||!value),trades:next.trades,period:all?"Todo el historial":label,account:all?"Todas las cuentas":accountLabel,assumedCurrency:all?"USD":assumedCurrency});}
    catch(error){setToast(abort.signal.aborted?"Preparación cancelada.":errorText(error));}finally{setExportBusy(false);setReadStatus("");}
  };
  const openRestore=async()=>{if(restorePreparing)return;setRestorePreparing(true);try{await ensureFullHistory();setOverlay({kind:"restore"});}catch(error){setToast(errorText(error));}finally{setRestorePreparing(false);}};


  const go = (route: Route) => { setView(route); if (window.location.hash !== "#" + route) window.location.hash = route; window.scrollTo(0, 0); };
  const onDetail = async (trade: Trade) => {
    const request=++detailRequest.current;
    try{const result=await readJournal<{trade:Trade;captures:Journal["captures"]}>(new URLSearchParams({mode:"detail",id:trade.id}));
      if(request!==detailRequest.current)return;
      setDetailCache({trade:result.trade,captures:result.captures});setOverlay({kind:"trade",id:trade.id});
    }catch(error){if(request===detailRequest.current)setToast(errorText(error));}
  };
  const closeOverlay = () => {detailRequest.current++;setOverlay(null);};
  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    try { window.localStorage.setItem("trading-journal-theme", next ? "light" : "dark"); } catch {}
  };
  const save: Save = async (action, message) => {
    if(maintenance.readOnly)throw new Error("Tradeify está en mantenimiento de solo lectura. Tus datos y borradores se conservan.");
    const result = await requestData<Awaited<ReturnType<Save>>>(action);
    const patchable=loaded&&!loadError&&applyJournalUpdate(journal,action,result)!==null;
    if(patchable){
      if(refreshing.current)localUpdatesDuringLoad.current.push({action,result});
      setJournal(previous=>applyJournalUpdate(previous,action,result)??previous);
    }else if (message || (action.action !== "importTrades"&&action.action!=="restoreBatch")) await refresh();
    if(result.trade)setDetailCache(previous=>({trade:result.trade!,captures:previous.trade?.id===result.trade!.id?previous.captures:[]}));
    if(action.action==="deleteTrade")setDetailCache(previous=>previous.trade?.id===action.id?{trade:null,captures:[]}:previous);
    setQueryGeneration(v=>v+1);
    if(action.action==="deleteTrade")void refresh();
    if(action.action!=="restoreBatch"){fullController.current?.abort();setFullReady(false);}
    if (message) setToast(message);
    return result;
  };

  const active = routes[view];
  const mainRoutes:Route[]=["resumen","bitacora","estadisticas","psicologia","revision","mercados"];
  const hasFilters=mainRoutes.includes(view)&&view!=="mercados"||view==="riesgo";
  const [moreOpen,setMoreOpen]=useState(false);
  const detail = overlay?.kind === "trade" ? (data.trades.find((trade) => trade.id === overlay.id)??(detailCache.trade?.id===overlay.id?detailCache.trade:undefined)) : undefined;
  return <div className="shell"><a className="skip-link" href="#workspace-main" onClick={event=>{event.preventDefault();document.getElementById("workspace-main")?.focus();}}>Ir al contenido</a>
    <aside className="sidebar">
      <a href="#resumen" className="brand-link" aria-label="Inicio de Bitácora de Trading"><Brand/></a>
      <nav className={"nav"+(moreOpen?" nav-expanded":"")} aria-label="Navegación principal">
        <div className="desktop-nav-groups">{navGroups.map(group=><div className="nav-group" role="group" aria-label={group.title} key={group.title}><span className="nav-group-label">{group.title}</span>{group.items.map(route=>{const item=routes[route],Icon=item.icon;return <a href={'#'+route} key={route} aria-current={view===route?'page':undefined} aria-label={item.nav}><Icon size={19}/><span>{item.nav}</span></a>;})}</div>)}</div>
        <div className="mobile-nav-primary">{(['resumen','bitacora','estadisticas','mercados']as const).map(route=>{const item=routes[route],Icon=item.icon;return <a href={'#'+route} key={route} aria-current={view===route?'page':undefined} aria-label={item.nav}><Icon size={19}/><span>{route==='estadisticas'?'Análisis':item.nav}</span></a>;})}<Button className="mobile-more" aria-expanded={moreOpen} onClick={()=>setMoreOpen(!moreOpen)}>Más</Button>
        {moreOpen&&<div className="mobile-more-panel" role="group" aria-label="Más secciones">{navGroups.map(group=>{const items=group.items.filter(route=>!['resumen','bitacora','estadisticas','mercados'].includes(route));return items.length?<div className="nav-group" role="group" aria-label={group.title} key={group.title}><span className="nav-group-label">{group.title}</span>{items.map(route=>{const item=routes[route],Icon=item.icon;return <a key={route} href={'#'+route} aria-current={view===route?'page':undefined} onClick={()=>setMoreOpen(false)}><Icon size={17}/><span>{item.nav}</span></a>;})}</div>:null;})}</div>}</div>
      </nav>
      <div className="sidebar-foot">{admin && <Link className="admin-entry" href="/administracion"><ShieldCheck size={17}/>Administración</Link>}
        <div className="zone"><span className="online-dot"/>Hora de Ecuador <strong>UTC−5</strong></div>
        <div className="identity"><span className="identity-mark"><ShieldCheck size={17}/></span>
          <span className="identity-text"><strong>{displayName ?? "Bitácora privada"}</strong><small>Espacio privado</small></span>
          {signOutHref && <a className="button button-quiet icon-button" href={signOutHref} target="_top" aria-label="Cerrar sesión" onClick={()=>clearOwnerDrafts(draftOwner)}><LogOut size={16}/></a>}
        </div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumbs"><button onClick={()=>go("resumen")}>Mi espacio</button><ChevronRight size={13}/><strong>{active.nav}</strong></div>
        <a className="mobile-mark brand-link" href="#resumen" aria-label="Inicio de Bitácora de Trading"><Brand/></a>
        <div className="topbar-actions"><WorkspaceNavigation items={navGroups.flatMap(g=>g.items.map(id=>({id,label:routes[id].nav,group:g.title})))} onNavigate={id=>go(id as Route)}/>
          <Button tone="quiet" className="icon-button theme-button" aria-label={light ? "Cambiar a tema oscuro" : "Cambiar a tema claro"} onClick={toggleTheme}>{light ? <Moon size={19}/> : <Sun size={19}/>}</Button>
          <a className="button button-quiet icon-button mobile-settings" href="#configuracion" aria-label="Configuración"><Settings2 size={19}/></a>
            <Button tone="primary" className="new-trade" aria-label="Nueva operación" disabled={loading || !loaded || loadError?.expired || maintenance.readOnly} onClick={() => setOverlay({ kind: "editor" })}><Plus size={18}/><span>Nueva operación</span></Button>
        </div>
      </header>
      <main className="workspace-body" id="workspace-main" tabIndex={-1}>
        {maintenance.notice}
        <div className="page-head" inert={exportBusy}>
          <div><span className="eyebrow">{navGroups.find(g=>g.items.includes(view))?.title} / Tradeify V2</span><h1>{active.title}</h1><p>{active.sub}</p>{view!=="ayuda"&&<HelpLink topic={({revision:"revisiones",configuracion:"seguridad"} as Record<string,string>)[view]??view} label="Guía de esta sección"/>}</div>
          {hasFilters && <div className="global-filters">
            <AccountFilter accounts={data.accounts} scope={scope} onChange={setScope}/>
            {view !== "revision" && view!=="riesgo" && <Field label="Periodo"><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option>
              <option value="week">Esta semana</option><option value="all">Todo el historial</option><option value="custom">Rango de fechas</option>
            </select></Field>}
            {(["resumen","psicologia","riesgo"].includes(view)) && !loading && loaded && <Button className="export-trigger" disabled={exportBusy} onClick={() => void openQueryExport(view==="riesgo"?{scope,q:'',sort:'latest'}:serverQuery,false,view==="riesgo"?'riesgo':view==='psicologia'?'psicologia':'resumen',view==='riesgo'?'Todo el historial':periodLabel)} aria-label="Compartir o exportar"><Share2 size={16}/><span>Compartir</span></Button>}
          </div>}
          {(["cuentas","estrategias"].includes(view))&&loaded&&<Button disabled={exportBusy} onClick={()=>void openQueryExport({scope,q:"",sort:"latest"},false,view==="cuentas"?"cuentas":"estrategias","Todo el historial")}><Share2 size={16}/>Compartir reporte</Button>}
        </div>
        {hasFilters && view !== "revision" && view!=="riesgo" && period === "custom" && <div className="date-range" inert={exportBusy}>
          <Field label="Desde"><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)}/></Field>
          <Field label="Hasta"><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}/></Field>
        </div>}
        {exportBusy&&<p className="informative-note" role="status">Preparando el reporte completo de los filtros seleccionados… {readStatus} <Button onClick={()=>exportController.current?.abort()}>Cancelar preparación</Button></p>}
        {historyLoading&&loaded&&<p className="informative-note" role="status">Preparando el historial completo para esta sección o acción. Las consultas paginadas mantienen sus propias estadísticas.</p>}
        {historyError&&loaded&&<div className="error-banner" role="alert"><TriangleAlert size={19}/><span>No se pudo completar el historial: {historyError} Esta sección no se mostrará hasta obtener una lectura completa y consistente.</span><Button onClick={()=>{void ensureFullHistory().catch(()=>{});}}>Reintentar carga</Button></div>}
        {loadError && <div className="error-banner" role="alert"><TriangleAlert size={19}/><span>{loadError.message}</span>
          {loadError.expired ? <a href={signInHref} target="_top" className="button">Iniciar sesión</a> : <Button onClick={refresh}>Reintentar</Button>}
        </div>}
        {loading ? <WorkspaceSkeleton/> : !loaded ? null : <div key={view} className="section-stage" inert={exportBusy}><SectionMetadataRefresh.Provider value={refreshSectionMetadata}>
          {needsFullHistory&&!historyReady&&<Empty title={historyError?"Historial completo no disponible":"Preparando datos completos de esta sección…"}/> }
          {view === "resumen" && <ServerDashboard query={serverQuery} refresh={queryGeneration} journal={data} today={today} onDetail={onDetail}
            onLog={() => go("bitacora")} onAdd={() => setOverlay({ kind: "editor" })} onSettings={() => go("cuentas")}/>}
          {view === "bitacora" && <TradeLog key={scope+":"+start+":"+end} trades={filtered} journal={data} onDetail={onDetail} onImport={() => setOverlay({ kind: "import" })}
            onExport={openExport} server={{query:serverQuery,refresh:queryGeneration,onExport:q=>void openQueryExport(q)}}/>}
          {view === "estadisticas" && <Stats trades={[]} journal={data} assumedCurrency={assumedCurrency} onExport={openExport} server={{query:serverQuery,refresh:queryGeneration,onExport:q=>void openQueryExport(q)}}/>}
          {view === 'psicologia' && <ServerPsychology query={serverQuery} refresh={queryGeneration} journal={data}/>}
          {view === 'revision' && <Weekly draftOwner={draftOwner} trades={[]} journal={data} today={today} scope={scope} assumedCurrency={assumedCurrency} save={save} server={{refresh:queryGeneration,onExport:(q,profile,label,key)=>void openQueryExport(q,false,profile,label,key)}}/>}
          {view === "mercados" && <Suspense fallback={<div className="panel"><Empty title="Cargando herramientas de mercado…"/></div>}><Markets symbol={marketSymbol(recentMarketAsset?[...journal.trades,recentMarketAsset]:journal.trades,marketDefault)} light={light}/></Suspense>}
          {view==='cuentas'&&<ServerAccounts query={{scope:'all',q:'',sort:'latest'}} refresh={queryGeneration} journal={data} onManage={edit=>setOverlay({kind:'manage',edit})}/>}
          {view==='estrategias'&&<ServerStrategies query={{scope:'all',q:'',sort:'latest'}} refresh={queryGeneration} journal={data} onManage={edit=>setOverlay({kind:'manage',edit})}/>}
          {view==='riesgo'&&<ServerRisk query={{scope,q:'',sort:'latest'}} refresh={queryGeneration} journal={data} today={today} onDetail={onDetail} onExport={q=>void openQueryExport(q)}/>}
          {view==="calculadoras"&&<ToolsHub draftOwner={draftOwner}/>}
          {view==="ayuda"&&<HelpView/>}
          {view === "configuracion" && <Settings section="preferences" journal={data} save={save} onRestore={()=>void openRestore()} onExport={()=>void openQueryExport({scope:"all",q:"",sort:"latest"},true)} onManage={(edit) => setOverlay({ kind: "manage", edit })}/>}
{view === "configuracion" && <><p><Link href="/privacidad">Privacidad</Link> · <Link href="/condiciones">Condiciones</Link></p>{signInHref === "/entrar" && <AccountAccess draftOwner={draftOwner}/>}</>}
          {view === "configuracion" && admin && <Link className="button admin-mobile-entry" href="/administracion"><ShieldCheck size={17}/>Administración de Tradeify</Link>}
          {view === "configuracion" && dailyQuote.settings}
          {view === "configuracion" && signOutHref && <a className="button button-quiet mobile-session" href={signOutHref} target="_top" onClick={()=>clearOwnerDrafts(draftOwner)}><LogOut size={16}/>Cerrar sesión</a>}
        </SectionMetadataRefresh.Provider></div>}
      </main>
    </div>
    {overlay?.kind === "editor" && <TradeEditor draftOwner={draftOwner} trade={overlay.trade} initialStep={overlay.close ? "close" : undefined}
      journal={data} scope={scope} save={save} onClose={closeOverlay} onSaved={(id) => setOverlay({ kind: "trade", id })}/>}
    {detail && <TradeDetail key={detail.id} trade={detail} journal={{...data,captures:mergeCapturePage(data.captures,detailCache.captures)}} demo={false} save={save} onClose={closeOverlay}
      onShare={() => setExporting({ kind: "operacion", trade: detail })} onEdit={(close) => setOverlay({ kind: "editor", trade: detail, close })}/>}
    {overlay?.kind === "manage" && <ManageEditor edit={overlay.edit} save={save} onClose={closeOverlay}/>}
    {overlay?.kind==="restore"&&<RestoreDialog ready={Boolean(historyReady)} journal={data} save={save} onClose={()=>{closeOverlay();void refresh()}}/>}
    {overlay?.kind === "import" && <ImportDialog journal={data} save={save} onClose={() => { closeOverlay(); void refresh(); }} onSettings={() => { closeOverlay(); go("cuentas"); }}/>}
    {exporting && <ExportDialog target={exporting} journal={exportJournal??data} demo={false} loadBackup={()=>readCompleteJournal({})} onClose={() => {setExporting(null);setExportJournal(null);}} onToast={setToast}/>}
    <div className="toast-region" role="status" aria-live="polite">{toast && <div className="toast"><ShieldCheck size={18}/>{toast}</div>}</div>
    {dailyQuote.view}
  </div>;
}
