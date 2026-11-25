"use client";

import { useId, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ChevronLeft, ChevronRight, CircleDollarSign, Crosshair, Gauge, LineChart, ListChecks, Target, TrendingUp } from "lucide-react";
import { dateLabel, dayKey, dayLabel, formatMoney, monthLabel, numberText, outcome, resultR, rLabel, shiftMonth, weekday, type Currency, type Journal, type Trade } from "@/lib/journal";
import { equity, groupBy, realized, summarize, WEEKDAYS, type Summary } from "@/lib/stats";
import { Button, Empty, Metric, Panel, pct, cashValue, Result, valueTone } from "./ui";
import { TradeList } from "./trade-list";

export function SummaryMetrics({ summary }: { summary: Summary }) {
  const { cash, currency, win, countResults, winRate, factor, meanR, cashCount, rCount, factorBasis } = summary;
  return <div className="metric-grid">
    <Metric label="P&L neto" icon={<CircleDollarSign size={17}/>} value={cashValue(cash, currency)} tone={valueTone(cash)}
      detail={currency === null ? "Separa las cuentas para no mezclar monedas" : summary.cashComplete ? `${cashCount} con P&L completo · ${currency}` : `${cashCount} de ${summary.closed} con P&L · total no disponible`} />
    <Metric label="Tasa de acierto" icon={<Target size={17}/>} value={pct(winRate)} detail={`${win} de ${countResults} con resultado`}/>
    <Metric label="Profit factor" icon={<TrendingUp size={17}/>} value={factor === null ? "—" : factor === Infinity ? "Sin pérdidas" : numberText(factor)} detail={factorBasis ? `Ganancias ÷ pérdidas · ${factorBasis}` : "Muestra incompleta para calcular el factor"}/>
    <Metric label="R promedio" icon={<Activity size={17}/>} value={rLabel(meanR)} tone={valueTone(meanR)} detail={`${rCount} / ${summary.closed} con R calculable`}/>
  </div>;
}

function axisStep(span: number) {
  const coarse = Math.max(span / 4, 0.0001);
  const base = 10 ** Math.floor(Math.log10(coarse));
  return ([1, 2, 2.5, 5, 10].find((step) => step >= coarse / base) ?? 10) * base;
}

export function TradeCurve({ trades, currency, hasCash,series }: { trades: Trade[]; currency: Currency | null; hasCash: boolean;series?:{money:ReturnType<typeof equity>;r:ReturnType<typeof equity>;closed:number;rCount:number;resolution:"day"|"trade"} }) {
  const [preferred, setPreferred] = useState<"money" | "r">("money");
  const [highlight, setHighlight] = useState<number | null>(null);
  const [chronological,setChronological]=useState(false);
  const unit = hasCash && currency ? preferred : "r";
  const points = useMemo(() => series?series[unit==="money"?"money":"r"]:equity(trades, unit), [trades, unit,series]);
  const id = useId();
  if (points.length < 2) {
    return <Panel title="Curva de resultados" description="Resultado acumulado desde cero">
      <Empty icon={<LineChart size={22}/>} title="La curva comienza en 0" description="Agrega una operación cerrada con P&L o R calculable." />
    </Panel>;
  }
  let low = 0, high = 0;
  for (const point of points) { low = Math.min(low, point.value); high = Math.max(high, point.value); }
  const step = axisStep(high - low || (unit === "money" ? 100 : 1));
  const min = high === 0 && low === 0 ? -2 * step : Math.floor(low / step) * step;
  const max = high === 0 && low === 0 ? 2 * step : Math.ceil(high / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const y = (value: number) => 12 + (max - value) / (max - min) * 191;
  const first=points[1].at!,last=points[points.length-1].at!;
  const origin=first-Math.max(1,Math.floor((last-first)/Math.max(1,points.length-2)));
  const x=(index:number)=>5+990*(chronological?((points[index].at??origin)-origin)/(last-origin):index/(points.length-1));
  const d = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const focus = Math.min(highlight ?? points.length - 1, points.length - 1);
  const selected = points[focus];
  const format = (value: number) => unit === "money" && currency ? formatMoney(value, currency) : rLabel(value);
  const rCoverage=series?.rCount??trades.filter(t=>t.closedAt!==null&&resultR(t)!==null).length;
  const closedCount=series?.closed??trades.filter(t=>t.closedAt!==null).length;
  const coverageNote=unit==="r"&&rCoverage<closedCount?` · ${rCoverage}/${closedCount} cierres con R`:"";
  const axis = (value: number) => (value === 0 ? "0" : numberText(unit === "money" ? value / 100 : value));
  const labelPoints = [0, Math.round((points.length - 1) / 2), points.length - 1].filter((value, index, items) => items.indexOf(value) === index);
  return <Panel title="Curva de resultados" description={(chronological?"Espaciado cronológico por fecha de cierre":series?.resolution==="day"?"Resultado neto acumulado por día de cierre":"Resultado neto acumulado por operación")+coverageNote} className="curve-panel" action={<div className="segmented" aria-label="Unidad de la curva">
    {hasCash && currency && <button type="button" aria-pressed={unit === "money"} onClick={() => { setPreferred("money"); setHighlight(null); }}>{currency}</button>}
    <button type="button" aria-pressed={chronological} onClick={()=>{setChronological(v=>!v);setHighlight(null)}}>{chronological?"Por fecha":series?.resolution==="day"?"Por día":"Por operación"}</button>
    <button type="button" aria-pressed={unit === "r"} onClick={() => { setPreferred("r"); setHighlight(null); }}>R</button>
  </div>}>
    <div className="chart-selected"><strong className={valueTone(selected.value)}>{format(selected.value)}</strong><span>{selected.at === null ? "Resultado acumulado inicial: 0" : dateLabel(selected.at)}</span></div>
    <div className="chart-body">
      <div className="chart-y num" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ top: y(tick) / 2.15 + "%" }}>{axis(tick)}</span>)}</div>
      <svg className="equity-chart" viewBox="0 0 1000 215" preserveAspectRatio="none" aria-label={`Curva con ${unit==="money"?closedCount:rCoverage} operaciones calculables desde 0. ${format(selected.value)} en el punto seleccionado. Usa las flechas para recorrer.`}
        tabIndex={0} role="img" onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const relative=(event.clientX-bounds.left)/bounds.width*1000;
          let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(x(mid)<relative)lo=mid+1;else hi=mid;}
          setHighlight(lo>0&&Math.abs(x(lo-1)-relative)<Math.abs(x(lo)-relative)?lo-1:lo);
        }} onPointerLeave={() => setHighlight(null)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : focus + (event.key === "ArrowLeft" ? -1 : 1);
          setHighlight(Math.max(0, Math.min(next, points.length - 1)));
        }}>
        <defs><linearGradient id={id} x2="0" y2="1" x1="0" y1="0"><stop offset="4%" stopColor="var(--chart)" stopOpacity=".23"/><stop offset="100%" stopColor="var(--chart)" stopOpacity=".01"/></linearGradient></defs>
        {ticks.map((tick) => <line key={tick} x1={0} x2={1000} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "grid-line zero-line" : "grid-line"}/>)}
        <polygon points={`${x(0)},${y(0)} ${d} ${x(points.length - 1)},${y(0)}`} fill={`url(#${id})`}/>
        <polyline pathLength={1} points={d} className="equity-line" />
        {highlight !== null && <line x1={x(focus)} x2={x(focus)} y1={5} y2={210} className="cursor-line"/>}
      </svg>
      <span className="chart-dot" aria-hidden="true" style={{ left: x(focus) / 10 + "%", top: y(selected.value) / 2.15 + "%" }}/>
      <div className="chart-x" aria-hidden="true">{labelPoints.map((index) => <span key={index} style={{ left: x(index) / 10 + "%" }}>{points[index].at === null ? "Inicio · 0" : dayLabel(points[index].at!)}</span>)}</div>
    </div>
  </Panel>;
}

export function TradingCalendar({ trades, today, accounts, assumedCurrency, onDetail }: { trades: Trade[]; today: string; accounts: Journal["accounts"]; assumedCurrency: Currency; onDetail: (trade: Trade) => void }) {
  const closed = useMemo(() => realized(trades), [trades]);
  const initial = today;
  const aggregate=summarize(trades, accounts, assumedCurrency);
  const currency = aggregate.currency;
  const cashAvailable=aggregate.cashComplete;
  const [unit,setUnit] = useState<"money"|"r">("money");
  const monetary = cashAvailable && currency !== null && unit === "money";
  const [currentMonth, setMonth] = useState<string | null>(null);
  const [selectedDay, setSelected] = useState<string | null>(null);
  const month = currentMonth ?? initial.slice(0, 7);
  const start = month + "-01";
  const clearDay = (offset: number) => { setMonth(shiftMonth(month, offset)); setSelected(null); };
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const daily = groupBy(closed, (trade) => dayKey(trade.closedAt!));
  const selected = selectedDay ?? (initial.startsWith(month) ? initial : start);
  const chosen = daily.get(selected) ?? [];
  const summary = summarize(chosen, accounts, assumedCurrency);
  return <Panel title="Calendario P&L" description={`${monthLabel(month)} · Historial de la cuenta · ${monetary ? currency : "R"}`} className="calendar-panel" action={<div className="calendar-nav"><Button tone="quiet" onClick={()=>{setMonth(null);setSelected(null)}}>Hoy</Button>{cashAvailable && currency && <Button tone="quiet" onClick={()=>setUnit(monetary?"r":"money")}>{monetary?"Ver R":"Ver "+currency}</Button>}
    <Button className="icon-button" aria-label="Mes anterior" tone="quiet" onClick={() => clearDay(-1)}><ChevronLeft size={17}/></Button>
    <Button className="icon-button" aria-label="Mes siguiente" tone="quiet" onClick={() => clearDay(1)}><ChevronRight size={17}/></Button>
  </div>}>
    <div className="calendar-body">
      <div className="calendar-grid">
        {WEEKDAYS.map((day) => <span key={day} className="weekday">{day}</span>)}
        {Array.from({ length: weekday(start) }, (_, i) => <span key={`space-${i}`}/>)}
        {Array.from({ length: count }, (_, i) => {
          const key = month + "-" + String(i + 1).padStart(2, "0");
          const list = daily.get(key) ?? [];
          const summary = summarize(list, accounts, assumedCurrency);
          const result = monetary ? summary.cash : summary.totalR;
          const tone = valueTone(result);
          return <button key={key} type="button" className={`day day-${tone} ${list.length ? "has-trades" : ""}`} aria-pressed={selected === key}
            aria-label={`${i + 1}, ${list.length} operaciones`} onClick={() => setSelected(key)}>{i + 1}</button>;
        })}
      </div>
      <div className="day-detail">
        <div className="split"><span className="muted">{Number(selected.slice(-2))} · {chosen.length === 1 ? "1 operación" : `${chosen.length} operaciones`} · {monetary?`${summary.cashCount}/${summary.closed} con P&L`:`${summary.rCount}/${summary.closed} con R`}</span>
          <Result value={monetary ? summary.cash : summary.totalR} unit={monetary ? "money" : "r"} currency={currency}/></div>
        {chosen.slice().reverse().map((trade) => <button key={trade.id} type="button" className="day-trade" onClick={() => onDetail(trade)}>
          <span>{trade.asset} <small>{outcome(trade) === "flat" ? "· Break-even" : ""}</small></span><Result value={monetary?trade.pnlCents:resultR(trade)} unit={monetary?"money":"r"} currency={currency}/><ChevronRight size={13}/>
        </button>)}
      </div>
    </div>
  </Panel>;
}

export function Dashboard({ trades, calendarTrades, journal, today, onDetail, onLog, onAdd, onSettings, assumedCurrency }: {
  trades: Trade[]; calendarTrades?:Trade[]; journal: Journal; today: string; onDetail: (trade: Trade) => void; onLog: () => void;
  onAdd: () => void; onSettings?: () => void; assumedCurrency: Currency;
}) {
  const summary = summarize(trades, journal.accounts, assumedCurrency);
  const recent = trades.slice().sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt)).slice(0, 5);
  return <div className="nebula-dashboard">
    {!journal.trades.length && <div className="welcome-panel">
      <div className="welcome-icon"><Crosshair size={25}/></div>
      <div><h2>Empieza con tu primera operación</h2><ol><li>Crea una cuenta de trading en Cuentas.</li><li>Indica su balance inicial.</li><li>Registra tu primera operación.</li></ol></div>
      <div className="welcome-actions"><Button tone="primary" onClick={onAdd}>Registrar operación <ArrowRight size={16}/></Button>
        {journal.accounts.length === 0 && onSettings && <Button tone="quiet" onClick={onSettings}>Configurar cuenta</Button>}
      </div>
    </div>}
    <SummaryMetrics summary={summary}/>
    <div className="dashboard-grid">
      <TradeCurve trades={trades} currency={summary.currency} hasCash={summary.cashComplete}/>
      <TradingCalendar trades={calendarTrades ?? trades} today={today} accounts={journal.accounts} assumedCurrency={assumedCurrency} onDetail={onDetail}/>
    </div>
    <Panel title="Últimas operaciones" description={`${summary.closed} cerradas · ${summary.open} abiertas en el periodo`} action={<Button tone="quiet" onClick={onLog}>Ver bitácora <ArrowRight size={15}/></Button>}>
      {recent.length ? <TradeList rows={recent} journal={journal} onDetail={onDetail} compact/> : <Empty title="Aún no hay operaciones para este periodo."/>}
    </Panel>
  </div>;
}

export function AnalysisMetrics({ summary }: { summary: Summary }) {
  const cash = summary.cashComplete && summary.currency !== null;
  const drawdown = summary.drawdown === null ? "—" : cash
    ? formatMoney(-summary.drawdown, summary.currency!, false)
    : rLabel(-summary.drawdown);
  return <div className="metric-grid">
    <Metric label="Expectativa" icon={<Gauge size={16}/>} value={rLabel(summary.meanR)} detail={`${summary.rCount}/${summary.closed} con R calculable`}/>
    <Metric label="Caída máxima" icon={<ArrowDownRight size={16}/>} value={drawdown} tone={summary.drawdown ? "negative" : ""} detail={`Desde el máximo acumulado · ${summary.rCount}/${summary.closed} con R`}/>
    <Metric label="Rachas máximas" icon={<Activity size={16}/>} value={summary.countResults ? `${summary.winStreak} / ${summary.lossStreak}` : "—"} detail="Ganadoras / perdedoras"/>
    <Metric label="Calificación favorable" icon={<ListChecks size={16}/>} value={pct(summary.discipline)} detail={`${summary.graded} evaluadas · nota ≥ 4`}/>
  </div>;
}
