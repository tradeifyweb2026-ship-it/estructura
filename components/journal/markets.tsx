"use client";
import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from "react";
import {ArrowUpRight,ChartNoAxesCombined,ChevronRight,Clock3,Globe2,LayoutGrid,LoaderCircle,Newspaper,RefreshCw,Search,SlidersHorizontal} from "lucide-react";
import {applyMarketAttributes,loadMarketWidget,MARKET_FAVORITES,marketChartUrl,normalizeMarketSymbol,validMarketSymbol,widgetAttributes,type WebWidgetName,type WidgetName} from "@/lib/market-widgets";
import {Button,Field} from "./ui";

type MarketTab="resumen"|"grafico"|"calendario"|"noticias"|"explorar";
const tabs=[{id:"resumen",name:"Resumen",icon:LayoutGrid},{id:"grafico",name:"Gráfico",icon:ChartNoAxesCombined},{id:"calendario",name:"Calendario",icon:Clock3},{id:"noticias",name:"Noticias",icon:Newspaper},{id:"explorar",name:"Explorar",icon:Globe2}] as const;
const exploration=[
  {id:"tv-heatmap",name:"Mapa de calor",description:"Observa el comportamiento de los sectores del S&P 500."},
  {id:"tv-forex-table",name:"Tabla Forex",description:"Compara el movimiento de las principales divisas."},
  {id:"tv-technical-analysis",name:"Análisis técnico",description:"Indicadores de TradingView para el activo seleccionado. No son una recomendación de inversión."},
  {id:"tv-market-data",name:"Datos de mercado",description:"Índices, divisas y criptomonedas organizados por mercado."},
  {id:"tv-world-market-summary",name:"Panorama mundial",description:"Explora mercados y regiones desde una sola vista."},
  {id:"tv-economic-map",name:"Mapa económico",description:"Explora indicadores económicos por país."},
  {id:"financials",name:"Fundamentales",description:"Resultados y datos financieros de la empresa seleccionada."},
] satisfies {id:WidgetName;name:string;description:string}[];

function WebSurface({name,attributes,onRetry}:{name:WebWidgetName;attributes:Record<string,string>;onRetry:()=>void}){
  const host=useRef<HTMLDivElement>(null);
  const element=useRef<HTMLElement|null>(null);
  const currentAttributes=useRef(attributes);
  const [status,setStatus]=useState<"loading"|"mounted"|"failed">("loading");
  useEffect(()=>{currentAttributes.current=attributes;if(element.current)applyMarketAttributes(element.current,attributes);},[attributes]);
  useEffect(()=>{
    let active=true;const container=host.current;
    loadMarketWidget(name).then(()=>{
      if(!active||!container)return;
      const widget=document.createElement(name);applyMarketAttributes(widget,currentAttributes.current);
      element.current=widget;container.replaceChildren(widget);setStatus("mounted");
    }).catch(()=>{if(active)setStatus("failed");});
    return ()=>{active=false;element.current=null;container?.replaceChildren();};
  },[name]);
  return <div className={`market-stage market-stage-${status}`}>
    {status==="loading"&&<div className="market-loading" role="status"><LoaderCircle size={24}/><strong>Conectando con TradingView</strong><span>Preparando la información de mercado…</span></div>}
    {status==="failed"&&<MarketFailure onRetry={onRetry}/>}
    <div className="market-widget-host" ref={host} hidden={status==="failed"}/>
  </div>;
}
function MarketFailure({onRetry}:{onRetry:()=>void}){
  return <div className="market-loading market-load-error" role="status"><Globe2 size={26}/><strong>No se pudo conectar con TradingView</strong><span>Comprueba tu conexión o vuelve a intentarlo. También puedes abrir la fuente original.</span><Button onClick={onRetry}><RefreshCw size={15}/>Reintentar</Button></div>;
}
function FinancialSurface({symbol,light,onRetry}:{symbol:string;light:boolean;onRetry:()=>void}){
  const host=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState<"loading"|"mounted"|"failed">("loading");
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let active=true;let frame:HTMLIFrameElement|null=null;let loaded=false;
    const markLoaded=()=>{loaded=true;if(active)setStatus("mounted");};
    const observer=new MutationObserver(()=>{
      const found=container.querySelector("iframe");
      if(found&&found!==frame){frame=found;frame.title="Datos fundamentales de TradingView";frame.addEventListener("load",markLoaded,{once:true});}
    });
    observer.observe(container,{childList:true,subtree:true});
    const script=document.createElement("script");script.type="text/javascript";script.async=true;
    script.src="https://s3.tradingview.com/external-embedding/embed-widget-financials.js";
    script.textContent=JSON.stringify({symbol,colorTheme:light?"light":"dark",displayMode:"regular",isTransparent:false,locale:"es",width:"100%",height:"100%"});
    script.onerror=()=>{if(active)setStatus("failed");};
    const timer=window.setTimeout(()=>{if(active&&!loaded)setStatus("failed");},15000);
    const widget=document.createElement("div");widget.className="tradingview-widget-container__widget";container.replaceChildren(widget,script);
    return ()=>{active=false;clearTimeout(timer);observer.disconnect();frame?.removeEventListener("load",markLoaded);container.replaceChildren();};
  },[symbol,light]);
  return <div className={`market-stage market-stage-${status}`}>{status==="loading"&&<div className="market-loading" role="status"><LoaderCircle size={24}/><strong>Cargando datos de la empresa</strong></div>}{status==="failed"&&<MarketFailure onRetry={onRetry}/>}<div className="market-widget-host tradingview-widget-container" ref={host} hidden={status==="failed"}/></div>;
}
function Widget({name,title,description,symbol,light,interval="60",size="standard"}:{name:WidgetName;title:string;description:string;symbol:string;light:boolean;interval?:string;size?:"chart"|"compact"|"standard"|"large"}){
  const [attempt,setAttempt]=useState(0);
  const attributes=useMemo(()=>name==="financials"?{}:widgetAttributes(name,symbol,light,interval),[name,symbol,light,interval]);
  const source=name==="tv-economic-calendar"?"https://www.tradingview.com/economic-calendar/":name==="tv-news-feed"?"https://www.tradingview.com/news/":marketChartUrl(symbol);
  return <section className={`panel market-panel market-size-${size}`} aria-label={title}>
    <header className="panel-head"><div><h2>{title}</h2><p>{description}</p></div><a className="button button-quiet market-open" href={source} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${title.toLowerCase()} en TradingView`}><span>Abrir</span><ArrowUpRight size={16}/></a></header>
    {name==="financials"?<FinancialSurface key={`${symbol}-${light}-${attempt}`} symbol={symbol} light={light} onRetry={()=>setAttempt(a=>a+1)}/>:<WebSurface key={`${name}-${attempt}`} name={name} attributes={attributes} onRetry={()=>setAttempt(a=>a+1)}/>}
    <footer className="market-attribution"><span>Datos y herramientas de <a href={source} target="_blank" rel="noopener noreferrer">TradingView</a></span><span>Datos sujetos a disponibilidad y posibles retrasos</span></footer>
  </section>;
}

export function Markets({symbol,light}:{symbol:string;light:boolean}){
  const [tab,setTab]=useState<MarketTab>("grafico");
  const [selected,setSelected]=useState(symbol);
  const [interval,setInterval]=useState("60");
  const [explore,setExplore]=useState<WidgetName>("tv-heatmap");
  const [company,setCompany]=useState("NASDAQ:AAPL");
  const [custom,setCustom]=useState(false);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [preferencesReady,setPreferencesReady]=useState(false);
  const [favorites,setFavorites]=useState<string[]>([]);
  useEffect(()=>{const t=setTimeout(()=>{try{const saved=JSON.parse(localStorage.getItem("tradeify-markets-v2")??"null");if(saved){if(tabs.some(t=>t.id===saved.tab))setTab(saved.tab);if(typeof saved.symbol==="string"&&validMarketSymbol(saved.symbol))setSelected(saved.symbol);if(["15","60","240","D"].includes(saved.interval))setInterval(saved.interval);if(Array.isArray(saved.favorites))setFavorites([...new Set<string>(saved.favorites.filter((s:unknown)=>typeof s==="string"&&validMarketSymbol(s)))].slice(0,12));}}catch{}setPreferencesReady(true)},0);return()=>clearTimeout(t)},[]);
  useEffect(()=>{if(preferencesReady)try{localStorage.setItem("tradeify-markets-v2",JSON.stringify({tab,symbol:selected,interval,favorites}))}catch{}},[preferencesReady,tab,selected,interval,favorites]);
  const id=useId();
  const asset=MARKET_FAVORITES.find(a=>a.symbol===selected);
  const activeExplore=exploration.find(e=>e.id===explore)!;
  function navigateTabs(event:KeyboardEvent<HTMLButtonElement>,index:number){
    const next=event.key==="ArrowRight"?(index+1)%tabs.length:event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:event.key==="Home"?0:event.key==="End"?tabs.length-1:null;
    if(next===null)return;event.preventDefault();setTab(tabs[next]!.id);document.getElementById(`${id}-tab-${tabs[next]!.id}`)?.focus();
  }
  return <div className="markets" data-market-theme={light?"light":"dark"}>
    <section className="market-intro"><div className="market-intro-copy"><span className="market-eyebrow"><span/>ESPACIO DE MERCADOS</span><h2>Tu próxima decisión empieza con contexto.</h2><p>Consulta el mercado, sigue la agenda y prepara tu sesión en un solo lugar.</p></div><div className="market-selected"><span className="market-asset-mark">{asset?.short??"TV"}</span><div><strong>{asset?.name??selected}</strong><span>{asset?.group??"Activo seleccionado"} · TradingView</span></div></div></section>
    <nav className="market-tabs" role="tablist" aria-label="Herramientas de mercados">{tabs.map((item,index)=><button type="button" key={item.id} role="tab" id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} onClick={()=>setTab(item.id)} onKeyDown={e=>navigateTabs(e,index)}><item.icon size={17}/>{item.name}</button>)}</nav>
    <div className="market-control-bar"><div className="market-favorites" aria-label="Activos favoritos">{MARKET_FAVORITES.map(item=><button type="button" key={item.symbol} aria-pressed={selected===item.symbol} onClick={()=>{setSelected(item.symbol);setError("");}}><span>{item.short}</span>{item.name}</button>)}{favorites.filter(s=>!MARKET_FAVORITES.some(a=>a.symbol===s)).map(s=><button type="button" key={s} aria-pressed={selected===s} onClick={()=>setSelected(s)}>{s}</button>)}</div><Button tone="quiet" disabled={!favorites.includes(selected)&&favorites.length>=12} onClick={()=>setFavorites(favorites.includes(selected)?favorites.filter(s=>s!==selected):[...favorites,selected])}>{favorites.includes(selected)?"Quitar de mi lista":"Guardar en mi lista"}</Button><Button tone="quiet" onClick={()=>setCustom(value=>!value)} aria-expanded={custom} aria-controls={`${id}-symbol-search`}><Search size={15}/>Otro activo</Button></div>
    {custom&&<form className="market-search" id={`${id}-symbol-search`} onSubmit={event=>{event.preventDefault();const result=normalizeMarketSymbol(search);if(!result||!validMarketSymbol(result)){setError("Introduce un símbolo de TradingView, por ejemplo NASDAQ:AAPL o US100.");return;}setSelected(result);setError("");setCustom(false);}}><Field label="Símbolo de TradingView" hint="Puedes escribir US100, EURUSD o un símbolo como NASDAQ:AAPL."><input value={search} onChange={event=>setSearch(event.target.value)} maxLength={60} placeholder="Buscar por símbolo" aria-invalid={!!error} aria-describedby={error?`${id}-symbol-error`:undefined}/></Field><Button type="submit">Ver activo<ChevronRight size={15}/></Button>{error&&<p id={`${id}-symbol-error`} role="alert">{error}</p>}</form>}
    <div id={`${id}-panel-grafico`} role="tabpanel" aria-labelledby={`${id}-tab-grafico`} hidden={tab!=="grafico"} className="market-content">
      <div className="market-section-head"><div><span className="market-eyebrow">LECTURA DEL PRECIO</span><h3>{asset?.name??selected}</h3></div><div className="market-chart-tools"><span className="market-timezone"><Clock3 size={14}/>Hora de Ecuador</span><div className="segmented" aria-label="Temporalidad del gráfico">{[{value:"15",label:"15 min"},{value:"60",label:"1 h"},{value:"240",label:"4 h"},{value:"D",label:"1 día"}].map(t=><button type="button" key={t.value} aria-pressed={interval===t.value} onClick={()=>setInterval(t.value)}>{t.label}</button>)}</div></div></div>
      {tab==="grafico"&&preferencesReady&&<Widget name="tv-advanced-chart" title="Gráfico del mercado" description="Explora el precio y prepara tus escenarios con las herramientas de TradingView." symbol={selected} light={light} interval={interval} size="chart"/>}
    </div>
    <div id={`${id}-panel-resumen`} role="tabpanel" aria-labelledby={`${id}-tab-resumen`} hidden={tab!=="resumen"} className="market-content">{tab==="resumen"&&<><Widget name="tv-market-summary" title="El mercado de un vistazo" description="Un resumen para situarte antes de empezar la sesión." symbol={selected} light={light} size="compact"/><Widget name="tv-market-overview" title="Panorama de mercados" description="Compara índices, divisas y criptomonedas por categoría." symbol={selected} light={light}/></>}</div>
    <div id={`${id}-panel-calendario`} role="tabpanel" aria-labelledby={`${id}-tab-calendario`} hidden={tab!=="calendario"} className="market-content">{tab==="calendario"&&<><p className="market-context-note"><Clock3 size={16}/>Revisa la zona horaria y los filtros del calendario antes de planificar tu sesión.</p><Widget name="tv-economic-calendar" title="Agenda económica" description="Publicaciones y eventos que pueden influir en el mercado." symbol={selected} light={light} size="large"/></>}</div>
    <div id={`${id}-panel-noticias`} role="tabpanel" aria-labelledby={`${id}-tab-noticias`} hidden={tab!=="noticias"} className="market-content">{tab==="noticias"&&<Widget name="tv-news-feed" title="Actualidad de los mercados" description="Noticias financieras para complementar tu análisis." symbol={selected} light={light} size="large"/>}</div>
    <div id={`${id}-panel-explorar`} role="tabpanel" aria-labelledby={`${id}-tab-explorar`} hidden={tab!=="explorar"} className="market-content">{tab==="explorar"&&<><div className="market-explore-toolbar"><div><SlidersHorizontal size={17}/><span>Elige una herramienta</span></div><Field label="Vista de mercado"><select value={explore} onChange={event=>setExplore(event.target.value as WidgetName)}>{exploration.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{explore==="financials"&&<Field label="Empresa"><select value={company} onChange={event=>setCompany(event.target.value)}><option value="NASDAQ:AAPL">Apple</option><option value="NASDAQ:NVDA">NVIDIA</option><option value="NASDAQ:MSFT">Microsoft</option><option value="NASDAQ:TSLA">Tesla</option></select></Field>}</div><Widget key={explore} name={explore} title={activeExplore.name} description={activeExplore.description} symbol={explore==="financials"?company:selected} light={light} size="large"/></>}</div>
    <p className="market-disclaimer">Información de terceros para acompañar tu análisis. La disponibilidad y la actualización de los datos dependen de TradingView y del mercado; las cotizaciones pueden diferir de las de tu bróker.</p>
  </div>;
}
