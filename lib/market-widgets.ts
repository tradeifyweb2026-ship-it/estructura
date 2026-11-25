type TradedAsset = {asset: string; openedAt: number};
export const validMarketSymbol = (value?: string): boolean => !!value && /^[A-Z0-9_]{1,24}:[A-Z0-9_.!-]{1,30}$/.test(value);
export const MARKET_FAVORITES = [
  {symbol:"PEPPERSTONE:NAS100",name:"Nasdaq 100",short:"NQ",group:"Índices"},
  {symbol:"OANDA:EURUSD",name:"EUR / USD",short:"EU",group:"Forex"},
  {symbol:"OANDA:XAUUSD",name:"Oro",short:"AU",group:"Metales"},
  {symbol:"OANDA:GBPUSD",name:"GBP / USD",short:"GU",group:"Forex"},
  {symbol:"BITSTAMP:BTCUSD",name:"Bitcoin",short:"BTC",group:"Cripto"},
] as const;
const aliases:Record<string,string> = {
  US100:"PEPPERSTONE:NAS100",NAS100:"PEPPERSTONE:NAS100",NASDAQ:"PEPPERSTONE:NAS100",NASDAQ100:"PEPPERSTONE:NAS100",USTEC:"PEPPERSTONE:NAS100",
  EURUSD:"OANDA:EURUSD",GBPUSD:"OANDA:GBPUSD",USDJPY:"OANDA:USDJPY",AUDUSD:"OANDA:AUDUSD",
  XAUUSD:"OANDA:XAUUSD",GOLD:"OANDA:XAUUSD",ORO:"OANDA:XAUUSD",BTCUSD:"BITSTAMP:BTCUSD",BTCUSDT:"BINANCE:BTCUSDT",
};
export function normalizeMarketSymbol(value?:string):string|undefined {
  if (!value) return;
  const text=value.trim().toUpperCase();
  return validMarketSymbol(text)?text:aliases[text.replace(/[\s/_.-]/g,"")];
}
export function marketSymbol(trades: TradedAsset[], fallback?: string) {
  const latest = trades.reduce<TradedAsset | undefined>((last,trade) => !last || trade.openedAt > last.openedAt ? trade : last,undefined);
  return normalizeMarketSymbol(latest?.asset) ?? normalizeMarketSymbol(fallback) ?? "OANDA:EURUSD";
}
export const WEB_WIDGETS = ["tv-advanced-chart","tv-economic-calendar","tv-market-summary","tv-market-overview","tv-market-data","tv-world-market-summary","tv-heatmap","tv-forex-table","tv-technical-analysis","tv-news-feed","tv-economic-map"] as const;
export type WebWidgetName = typeof WEB_WIDGETS[number];
export type WidgetName = WebWidgetName | "financials";
const loads = new Map<WebWidgetName, Promise<void>>();
const failures = new Map<WebWidgetName, number>();
export function marketWidgetUrl(name:WebWidgetName) {
  if (!WEB_WIDGETS.includes(name)) throw new Error("Widget de mercado no permitido.");
  return "https://widgets.tradingview-widget.com/w/es/" + name + ".js";
}
export function loadMarketWidget(name: WebWidgetName, timeoutMs=15000):Promise<void> {
  const existing=loads.get(name);
  if(existing)return existing;
  if(typeof document==="undefined"||typeof customElements==="undefined")return Promise.reject(new Error("Abre Mercados en un navegador compatible."));
  if(customElements.get(name)){const ready=Promise.resolve();loads.set(name,ready);return ready;}
  const url=marketWidgetUrl(name);
  const script=document.createElement("script");
  const attempt=failures.get(name)??0;
  script.type="module";script.src=url+(attempt?"?tradeify_retry="+attempt:"");
  const loading=new Promise<void>((resolve,reject)=>{
    let settled=false;
    const finish=(error?:Error)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;
      if(error){script.remove();failures.set(name,attempt+1);reject(error);}else resolve();
    };
    const timer=setTimeout(()=>finish(new Error("TradingView está tardando demasiado. Vuelve a intentarlo.")),timeoutMs);
    script.onload=()=>{customElements.whenDefined(name).then(()=>finish(),()=>finish(new Error("No se pudo iniciar TradingView.")));};
    script.onerror=()=>finish(new Error("No se pudo conectar con TradingView."));
  });
  const promise=loading.catch((error)=>{if(loads.get(name)===promise)loads.delete(name);throw error;});
  loads.set(name,promise);document.head.appendChild(script);return promise;
}
export const marketChartUrl=(symbol:string)=>"https://www.tradingview.com/chart/?symbol="+encodeURIComponent(symbol);
export function widgetAttributes(name:WebWidgetName,symbol:string,light:boolean,interval="60"):Record<string,string> {
  if(!validMarketSymbol(symbol))throw new Error("Elige un símbolo válido de TradingView.");
  const attributes:Record<string,string>={theme:light?"light":"dark"};
  if(name==="tv-advanced-chart")Object.assign(attributes,{symbol,interval,timezone:"America/Guayaquil","allow-symbol-change":"","show-drawing-toolbar":"","show-date-ranges":"",watchlist:[...new Set([symbol,...MARKET_FAVORITES.map(a=>a.symbol)])].join(",")});
  if(name==="tv-technical-analysis")attributes.symbol=symbol;
  if(name==="tv-market-summary")attributes.direction="horizontal";
  if(name==="tv-market-overview"||name==="tv-market-data")attributes["symbol-sectors"]=JSON.stringify([
    {sectionName:"Índices",symbols:["PEPPERSTONE:NAS100","PEPPERSTONE:US500","FOREXCOM:DJI"]},
    {sectionName:"Forex",symbols:["OANDA:EURUSD","OANDA:GBPUSD","OANDA:USDJPY"]},
    {sectionName:"Cripto",symbols:["BITSTAMP:BTCUSD","BITSTAMP:ETHUSD"]},
  ]);
  if(name==="tv-heatmap")Object.assign(attributes,{"heatmap-type":"stock","data-source":"SPX500",grouping:"sector","block-size":"market_cap_basic","block-color":"change"});
  return attributes;
}
export function applyMarketAttributes(element:HTMLElement,attributes:Record<string,string>){
  for(const [key,value] of Object.entries(attributes))if(element.getAttribute(key)!==value)element.setAttribute(key,value);
}
