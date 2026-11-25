import { BRAND } from "./brand.ts";
import type { Report, TradeRow } from "./report.ts";

/**
 * CSV «de lectura»: mismas secciones y cifras que el PDF y el Excel, en una cuadrícula rectangular
 * (todas las filas con el mismo número de columnas) para que se vea ordenado al abrirlo en Excel.
 * No es el CSV de importación: ese sigue siendo exportTrades() en lib/csv.ts.
 *
 * Seguridad contra inyección de fórmulas: el texto que escribe el usuario (activo, setup, cuenta, notas…)
 * se protege con apóstrofo si empieza por = + - @; las cifras que genera la app son numéricas o van sin signo inicial.
 */

type Kind = "text" | "num" | "label";
const NUMERIC = /^-?\d+(?:,\d+)?$/;

function field(value: string | number | null, kind: Kind = "text") {
  let text = value === null ? "" : String(value);
  if (kind === "label") text = text.replace(/^-/, "−").replace(/^\+/, "");
  else if (/^[\s]*[=+\-@\t\r]/.test(text) && !(kind === "num" && NUMERIC.test(text))) text = "'" + text;
  return /[;"\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

const comma = (value: number | null, digits?: number) => value === null || !Number.isFinite(value) ? "" : (digits === undefined ? String(Math.round(value * 1e8) / 1e8) : value.toFixed(digits)).replace(".", ",");

export function reportCsv(report: Report): string {
  const money = report.options.money, notes = report.options.notes;
  const heads = ["Fecha", "Hora", "Activo", "Dirección", "Setup", "Cuenta", "Entrada", "Stop", "Objetivo", "Salida", "R:B plan", "Resultado R", "R acumulado", "Estado",
    ...(money ? ["P&L neto", "Moneda", "Comisiones"] : []), ...(notes ? ["Emoción (antes → después)", "Calificación", "Errores", "Comentarios"] : []), "Captura entrada", "Captura salida"];
  const width = heads.length;
  const lines: string[] = [];
  const row = (cells: [string | number | null, Kind?][]) => {
    const padded = cells.slice(0, width);
    while (padded.length < width) padded.push([null]);
    lines.push(padded.map(([value, kind]) => field(value, kind)).join(";"));
  };
  const text = (value: string | number | null): [string | number | null, Kind] => [value, "text"];
  const label = (value: string): [string, Kind] => [value, "label"];
  const blank = () => row([]);
  const section = (title: string) => { blank(); row([label("▌ " + title)]); };

  row([label(BRAND.full.toUpperCase()), label(report.title.toUpperCase())]);
  row([text("Periodo"), text(report.period)]);
  row([text("Cuenta"), text(report.account)]);
  row([text("Generado"), label(report.generated)]);
  row([text("Zona horaria"), label(report.timezone)]);
  row([text("Contenido"), label(["Resultados en R", money ? "con importes en dinero" : "sin importes en dinero", notes ? "con notas y emociones" : "sin notas ni emociones"].join(" · ") + (report.demo ? " · DATOS DE EJEMPLO" : ""))]);

  section("RESUMEN");
  row([label("Indicador"), label("Valor"), label("Detalle")]);
  for (const kpi of report.kpis) row([label(kpi.label), label(kpi.value), label(kpi.detail)]);
  if(report.profile){
    for(const s of report.sections){section(s.title);row(s.columns.map(c=>label(c.label+(c.type==="percent"?" (%)":c.type==="money"?" ("+c.currency+")":""))));for(const cells of s.rows)row(cells.map((v,i)=>typeof v==="number"?[comma(s.columns[i].type==="percent"?v*100:v),"num"]:text(v)));if(s.note)row([text(s.note)]);}
    for(const warning of report.warnings)row([text(warning)]);
    return "\uFEFF"+lines.join("\r\n");
  }

  const buckets = (title: string, first: string, items: Report["setups"]) => {
    section(title);
    row([label(first), label("Resultado R"), label("Base")]);
    if (!items.length) row([label("Sin operaciones cerradas con R calculable en este periodo.")]);
    for (const item of items) row([text(item.label), [comma(item.num, 2), "num"], label(item.detail)]);
  };
  buckets("RESULTADO POR SETUP", "Setup", report.setups);
  buckets("RESULTADO POR ACTIVO", "Activo", report.assets);
  buckets("R PROMEDIO POR DÍA DE ENTRADA", "Día", report.weekdays);

  section("OPERACIONES");
  row(heads.map((head): [string, Kind] => [head, "label"]));
  const cells = (trade: TradeRow): [string | number | null, Kind?][] => [
    [trade.day, "num"], [trade.time, "label"], text(trade.asset), text(trade.side), text(trade.setup), text(trade.account),
    [comma(trade.entry), "num"], [comma(trade.stop), "num"], [comma(trade.target), "num"], [comma(trade.exit), "num"], [comma(trade.plan, 1), "num"],
    [comma(trade.r, 2), "num"], [comma(trade.cum, 2), "num"], label(trade.status),
    ...(money ? [[comma(trade.pnl, 2), "num"], trade.pnl === null ? text(null) : text(trade.currency), [comma(trade.fees, 2), "num"]] as [string | number | null, Kind][] : []),
    ...(notes ? [text(trade.emotion), [trade.grade === null ? "" : String(trade.grade), "num"], text(trade.errors), text(trade.note)] as [string | number | null, Kind][] : []),
    text(trade.captureBefore), text(trade.captureAfter),
  ];
  for (const trade of report.trades) row(cells(trade));
  if (report.trades.length) {
    const total = report.trades.reduce((sum, trade) => sum + (trade.r ?? 0), 0);
    const totals: [string | number | null, Kind?][] = Array.from({ length: width }, () => [null]);
    totals[0] = label("Total");
    totals[11] = [comma(total, 2), "num"];
    if (money && new Set(report.trades.filter(t=>t.pnl!==null).map(t=>t.currency)).size===1) totals[14] = [comma(report.trades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0), 2), "num"];
    row(totals);
  }
  blank();
  row([label(`Fin del reporte · Generado con ${BRAND.full}`)]);
  return "\uFEFF" + lines.join("\r\n");
}
