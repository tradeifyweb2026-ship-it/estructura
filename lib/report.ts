import {assetLabel} from "./asset-catalog.ts";
import { type Tone } from "./brand.ts";
import {
  averageExit, currencyOf, dateLabel, dayKey, estimatedRatio, formatMoney, inputDate, numberText, outcome, priceText, resultR, rLabel, sideLabel, timeLabel,
  type Currency, type Journal, type Trade,
} from "./journal.ts";
import { entryWeekday, equity, assetGroups, groups, realized, summarize, WEEKDAYS } from "./stats.ts";
import { profileContent } from "./report-profiles.ts";

export const REPORT_PROFILES = { resumen:"Resumen",bitacora:"Bitácora",operacion:"Operación individual",estadisticas:"Estadísticas",psicologia:"Psicología",cuentas:"Cuentas",riesgo:"Gestión de riesgo",estrategias:"Estrategias",semanal:"Revisión semanal",mensual:"Revisión mensual" } as const;
export type ReportProfile = keyof typeof REPORT_PROFILES;
export type ReportColumn = { label:string; type:"text"|"number"|"percent"|"money"|"date"|"r"; currency?:Currency };
export type ReportSection = { title:string; columns:ReportColumn[]; rows:(string|number|null)[][]; note?:string };

/**
 * Modelo único de reporte. PDF, Excel, CSV, imagen y texto leen de aquí, por eso los cinco muestran
 * las mismas cifras y las mismas secciones. Es puro: no toca el DOM ni la red.
 */

export type ReportOptions = {
  /** Importes en dinero (P&L, comisiones, riesgo). Apagado por defecto: lo que compartes habla en R. */
  money: boolean;
  /** Notas, emociones, calificación y errores. Apagado por defecto. */
  notes: boolean;
  account?:boolean;
  strategies?:boolean;
  captures?:boolean;
  prices?:boolean;
  capital?:boolean;
};
export const defaultOptions: ReportOptions = { money: false, notes: false };

export const STATUS = { open: "Abierta", win: "Ganancia", loss: "Pérdida", flat: "Break-even", unknown: "Sin resultado" } as const;

export const toneOf = (value: number | null): Tone => value === null || Math.abs(value) < 0.005 ? "zero" : value > 0 ? "pos" : "neg";

export type Kpi = { label: string; value: string; detail: string; tone: Tone };
export type Bucket = { label: string; detail: string; value: string; num: number | null; tone: Tone; share: number };
export type Curve = { unit: string; values: number[]; final: string; tone: Tone; endLabel: string };
export type TradeRow = {
  day: string; time: string; date: string; asset: string; long: boolean; side: string; setup: string; account: string;
  entry: number | null; stop: number | null; target: number | null; exit: number | null; size: number | null;
  r: number | null; cum: number | null; status: string; tone: Tone; open: boolean; plan: number | null;
  pnl: number | null; fees: number | null; currency: Currency;
  captureBefore: string; captureAfter: string;
  emotion: string; grade: number | null; errors: string; note: string;
};
export type Report = {
  profile?:ReportProfile;
  sections:ReportSection[];
  warnings:string[];
  kind: "periodo" | "operacion";
  title: string; period: string; account: string; generated: string; timezone: string; fileStem: string; demo: boolean;
  options: ReportOptions;
  counts: { closed: number; open: number; win: number; loss: number; flat: number };
  headline: { label: string; value: string; tone: Tone };
  kpis: Kpi[]; curve: Curve | null;
  setups: Bucket[]; assets: Bucket[]; weekdays: Bucket[];
  trades: TradeRow[];
};
export type ReportSource = {
  trades: Trade[]; journal: Journal; period: string; account: string; assumedCurrency: Currency;
  now: number; demo?: boolean; options?: Partial<ReportOptions>; kind?: Report["kind"];
  profile?:ReportProfile;
  scope?:string;
  filters?:string;
  completeHistory?:boolean;
  reviewKey?:string;
};

const slug = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clip = (text: string, max: number) => text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
export const stamp = (now: number) => `${dateLabel(now)} · ${timeLabel(now)}`;

export function periodName(period: string, start: string, end: string) {
  const fixed: Record<string, string> = { "7": "Últimos 7 días", "30": "Últimos 30 días", "90": "Últimos 90 días", all: "Todo el historial" };
  if (fixed[period]) return fixed[period];
  const label = (day: string) => day ? dateLabel(inputDate(day + "T12:00")) : "…";
  return (period === "week" ? "Esta semana · " : "") + `${label(start)} – ${label(end)}`;
}

const emotionChain = (trade: Trade) => [trade.before, trade.during, trade.after].flatMap((item) => item ? [item.name] : []).join(" → ");
const noteText = (trade: Trade) => clip(trade.notes.map((note) => note.text).join(" · "), 400);

export function tradeRow(trade: Trade, journal: Journal, options: ReportOptions): TradeRow {
  const at = trade.closedAt ?? trade.openedAt;
  const result = outcome(trade);
  const r = resultR(trade);
  const currency = currencyOf(trade, journal.accounts);
  return {
    day: dayKey(at), time: timeLabel(at), date: dateLabel(at), asset: assetLabel(trade),
    long: trade.direction === "long", side: sideLabel(trade.direction),
    setup: options.strategies===false?"Oculta":journal.setups.find((item) => item.id === trade.setupId)?.name ?? "Sin setup",
    account: options.account===false?"Oculta":journal.accounts.find((item) => item.id === trade.accountId)?.name ?? "Sin cuenta",
    entry: options.prices===false?null:trade.entry, stop: options.prices===false?null:trade.stop, target: options.prices===false?null:trade.target, exit: options.prices===false||trade.closedAt === null ? null : averageExit(trade), size: options.money&&options.prices!==false?trade.size:null,
    r, cum: null, status: STATUS[result], tone: toneOf(r), open: trade.closedAt === null, plan: estimatedRatio(trade),
    pnl: options.money && trade.pnlCents !== null ? trade.pnlCents / 100 : null,
    fees: options.money && trade.feesCents !== null ? trade.feesCents / 100 : null,
    currency,
    captureBefore: options.captures===false?"":trade.captureLinks?.before ?? "", captureAfter: options.captures===false?"":trade.captureLinks?.after ?? "",
    emotion: options.notes ? emotionChain(trade) : "", grade: options.notes ? trade.grade : null,
    errors: options.notes ? trade.errors.join(", ") : "", note: options.notes ? noteText(trade) : "",
  };
}

function buckets(items: ReturnType<typeof groups>): Bucket[] {
  const top = items.reduce((max, item) => Math.max(max, Math.abs(item.value ?? 0)), 0) || 1;
  return items.map((item) => ({
    label: item.label, detail: `${item.withR} de ${item.count} con R`, value: rLabel(item.value), num: item.value,
    tone: toneOf(item.value), share: item.value === null ? 0 : Math.abs(item.value) / top,
  }));
}

export function buildReport(source: ReportSource): Report {
  const options: ReportOptions = { ...defaultOptions,...(source.profile?{account:false,strategies:false,prices:false,captures:false,capital:false}:{}), ...source.options };
  const { journal, now } = source;
  const kind = source.kind ?? "periodo";
  const summary = summarize(source.trades, journal.accounts, source.assumedCurrency);
  const closed = realized(source.trades);
  const values = closed.flatMap((trade) => resultR(trade) ?? []);
  const factor=summary.factorR,totalR=summary.totalR,meanR=summary.meanR,drawdown=summary.drawdownR??0;

  const hasMoney = options.money && summary.currency !== null && summary.cash !== null && source.trades.every(t=>journal.accounts.some(a=>a.id===t.accountId));
  const kpis: Kpi[] = [];
  if (hasMoney) kpis.push({ label: "P&L neto", value: formatMoney(summary.cash!, summary.currency!), detail: `${summary.cashCount} con resultado · ${summary.currency}`, tone: toneOf(summary.cash) });
  kpis.push({ label: "Resultado acumulado", value: rLabel(totalR), detail: `${values.length}/${summary.closed} con R calculable`, tone: toneOf(totalR) });
  if (!hasMoney) kpis.push({ label: "Operaciones", value: String(summary.closed), detail: `${summary.open} abiertas`, tone: "zero" });
  kpis.push(
    { label: "Tasa de acierto", value: summary.winRate === null ? "—" : numberText(summary.winRate) + "%", detail: `${summary.win} de ${summary.countResults} con resultado`, tone: "zero" },
    { label: "Profit factor", value: factor === null ? "—" : factor===Infinity?"Sin pérdidas":numberText(factor), detail: `Ganancias ÷ pérdidas · R · ${summary.rCount}/${summary.closed} con R`, tone: "zero" },
    { label: "Expectativa", value: rLabel(meanR), detail: `${summary.rCount}/${summary.closed} cierres con R calculable`, tone: toneOf(meanR) },
    { label: "Caída máxima", value: values.length ? rLabel(drawdown > 0 ? -drawdown : 0) : "—", detail: `Desde el máximo acumulado · ${summary.rCount}/${summary.closed} con R`, tone: drawdown > 0 ? "neg" : "zero" },
  );

  const unit = hasMoney && summary.cashCount > 0 ? "money" : "r";
  const points = equity(source.trades, unit);
  let curve: Curve | null = null;
  if (points.length > 1) {
    const last = points[points.length - 1];
    curve = {
      unit: unit === "money" ? summary.currency! : "R", values: points.map((point) => unit === "money" ? point.value / 100 : point.value),
      final: unit === "money" ? formatMoney(last.value, summary.currency!) : rLabel(last.value), tone: toneOf(last.value),
      endLabel: last.at === null ? "" : dateLabel(last.at),
    };
  }

  const setupName = (trade: Trade) => journal.setups.find((item) => item.id === trade.setupId)?.name ?? "Sin setup";
  const weekdays = groups(source.trades, entryWeekday, true).sort((a, b) => WEEKDAYS.indexOf(a.label) - WEEKDAYS.indexOf(b.label));
  const running = new Map<string, number>();
  let accumulated = 0;
  for (const trade of closed) {
    const value = resultR(trade);
    if (value === null) continue;
    accumulated += value;
    running.set(trade.id, accumulated);
  }
  const rows = source.trades.slice().sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt))
    .map((trade) => ({ ...tradeRow(trade, journal, options), cum: running.get(trade.id) ?? null }));

  const report:Report = {
    kind, title: kind === "operacion" ? "Reporte de operación" : "Reporte de trading",
    period: source.period, account: options.account===false?"Cuenta oculta":source.account, generated: stamp(now), timezone: "Hora de Ecuador · UTC−5",
    fileStem: `bitacora_${dayKey(now)}_${slug(source.period) || "reporte"}`, demo: Boolean(source.demo), options,
    counts: { closed: summary.closed, open: summary.open, win: summary.win, loss: summary.loss, flat: summary.flat },
    headline: { label: "Resultado acumulado", value: rLabel(totalR), tone: toneOf(totalR) },
    kpis, curve, setups: options.strategies===false?[]:buckets(groups(source.trades, setupName)).slice(0, 8), assets: buckets(assetGroups(source.trades)).slice(0, 8),
    weekdays: buckets(weekdays), trades: rows,sections:[],warnings:[],
  };
  if(source.profile){
    report.profile=source.profile;
    report.title=REPORT_PROFILES[source.profile];
    report.fileStem=`tradeify_${source.profile}_${dayKey(now)}`;
    profileContent(report,source,summary);
  }
  return report;
}

/** Datos de una sola operación para la tarjeta y el texto de «Compartir». */
export type TradeSheet = {
  asset: string; long: boolean; side: string; setup: string; account: string; when: string; status: string; tone: Tone;
  r: string; money: string | null; facts: [string, string][];
  captureBefore: string; captureAfter: string;
  emotion: string; grade: string; errors: string[]; note: string;
  generated: string; timezone: string; demo: boolean; options: ReportOptions; fileStem: string;
};

export function tradeSheet(trade: Trade, journal: Journal, now: number, options: Partial<ReportOptions> = {}, demo = false): TradeSheet {
  const full: ReportOptions = { ...defaultOptions, ...options };
  const row = tradeRow(trade, journal, full);
  const price = priceText;
  const risk = full.money && trade.riskCents !== null ? formatMoney(trade.riskCents, row.currency, false) : trade.riskPercent !== null ? numberText(trade.riskPercent) + "%" : "—";
  return {
    asset: row.asset, long: row.long, side: row.side, setup: row.setup, account: row.account,
    when: `${row.date} · ${row.time}`, status: row.status, tone: row.tone, r: row.open ? "Abierta" : rLabel(row.r),
    money: row.pnl === null ? null : formatMoney(Math.round(row.pnl * 100), row.currency),
    facts: [["Entrada", price(row.entry)], ["Stop", price(row.stop)], ["Objetivo", price(row.target)], ["Salida", price(row.exit)],
      ["R:B planeado", row.plan === null ? "—" : "1:" + numberText(row.plan)], ["Riesgo", risk]],
    captureBefore: row.captureBefore, captureAfter: row.captureAfter,
    emotion: row.emotion, grade: row.grade === null ? "" : `${row.grade} / 5`, errors: row.errors ? row.errors.split(", ") : [], note: row.note,
    generated: stamp(now), timezone: "Hora de Ecuador · UTC−5", demo, options: full,
    fileStem: `operacion_${slug(row.asset)}_${row.day}`,
  };
}
