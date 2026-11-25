import { BRAND, logoSvg, type Tone } from "./brand.ts";
import { curveGeometry } from "./chart.ts";
import { formatMoney, rLabel } from "./journal.ts";
import type { Bucket, Report, TradeRow } from "./report.ts";
import { sectionCell } from "./report-profiles.ts";

/**
 * Documento HTML del reporte, pensado para imprimirse en A4 («Guardar como PDF»).
 * Es texto puro: sirve igual dentro de un iframe oculto de la app y para probarlo fuera de ella.
 * Todo texto dinámico pasa por esc().
 */

const esc = (text: string | number | null | undefined) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const cls: Record<Tone, string> = { pos: "pos", neg: "neg", zero: "" };
const price = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("es-EC", { maximumFractionDigits: 8 }).format(value);
const cssString = (text: string) => text.replace(/["\\\n\r]/g, " ");

const STYLE = `
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{font:10px/1.45 Geist,Inter,"Segoe UI",system-ui,sans-serif;color:${BRAND.ink};background:#fff}
.pos{color:${BRAND.pos}}.neg{color:${BRAND.neg}}.muted{color:${BRAND.muted}}
.hd{display:flex;align-items:center;gap:14px;background:${BRAND.navy};color:${BRAND.onNavy};border-radius:12px 12px 0 0;padding:16px 18px}
.brand{display:flex;align-items:center;gap:11px}
.brand b{display:block;font-size:20px;font-weight:740;letter-spacing:-.05em;line-height:1}
.brand i{display:block;margin-top:5px;font-style:normal;font-size:7.5px;font-weight:740;letter-spacing:.15em;color:${BRAND.onNavyMuted}}
.hd .right{margin-left:auto;text-align:right}
.hd .right strong{display:block;font-size:8.5px;letter-spacing:.14em;color:${BRAND.violetSoft}}
.hd .right span{display:block;margin-top:3px;font-size:10px;color:${BRAND.onNavyMuted}}
.stripe{height:4px;background:${BRAND.violet};border-radius:0 0 4px 4px;margin-bottom:9px}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.chip{border:1px solid ${BRAND.line};background:${BRAND.surface};border-radius:99px;padding:2px 9px;font-size:8.5px;color:${BRAND.muted}}
.chip.warn{background:${BRAND.amberBg};border-color:${BRAND.amberBg};color:${BRAND.amber};font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.kpi{background:${BRAND.surface};border:1px solid ${BRAND.line};border-top:3px solid ${BRAND.violet};border-radius:10px;padding:9px 12px;break-inside:avoid}
.kpi small{display:block;font-size:7.5px;font-weight:740;letter-spacing:.09em;text-transform:uppercase;color:${BRAND.muted}}
.kpi strong{display:block;margin:2px 0 1px;font-size:22px;line-height:1.15;letter-spacing:-.045em}
.kpi span{font-size:8.5px;color:${BRAND.muted}}
h2{margin:0 0 8px;padding-bottom:4px;border-bottom:2px solid ${BRAND.violet};font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:${BRAND.violet}}
.card{border:1px solid ${BRAND.line};border-radius:12px;padding:11px 14px 12px;margin-bottom:12px;break-inside:avoid}
.card h2{margin-bottom:6px}
.curve-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
.curve-top strong{font-size:15px;letter-spacing:-.04em}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bar-row{padding:4px 0;border-bottom:1px solid ${BRAND.line}}
.bar-row:last-child{border-bottom:0}
.bar-top{display:flex;justify-content:space-between;gap:8px}
.bar-top small{color:${BRAND.muted};font-size:8px}
.track{margin-top:3px;height:5px;border-radius:4px;background:${BRAND.surface}}
.track i{display:block;height:100%;border-radius:4px}
.week{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.day{border-radius:8px;padding:6px 7px;background:${BRAND.surface};border:1px solid ${BRAND.line}}
.day.pos{background:${BRAND.posBg};border-color:${BRAND.posBg}}.day.neg{background:${BRAND.negBg};border-color:${BRAND.negBg}}
.day span{display:block;font-size:8px;color:${BRAND.muted};font-weight:740}.day strong{font-size:11px}
.empty{color:${BRAND.muted};font-style:italic;padding:6px 0}
table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{overflow-wrap:anywhere}h2{break-after:avoid}tr{break-inside:avoid}section{break-inside:auto}
thead{display:table-header-group}
th{background:${BRAND.navy};color:${BRAND.onNavy};text-align:left;padding:6px 7px;font-size:7.5px;font-weight:740;letter-spacing:.07em;text-transform:uppercase}
th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}
td{padding:5px 7px;border-bottom:1px solid ${BRAND.line};font-size:8.5px;vertical-align:middle}
tr.z td{background:${BRAND.surface}}
tbody{break-inside:auto}tr{break-inside:avoid}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
td small{display:block;color:${BRAND.muted};font-size:7.5px}
tr.note td{padding-top:0;border-bottom:1px solid ${BRAND.line};color:${BRAND.muted};font-size:8px}
.side{font-weight:740}
.tag{display:inline-block;border-radius:99px;padding:1px 7px;font-size:8px;font-weight:740}
.tag.pos{background:${BRAND.posBg}}.tag.neg{background:${BRAND.negBg}}.tag.zero{background:${BRAND.tint};color:${BRAND.violet}}.tag.open{background:${BRAND.amberBg};color:${BRAND.amber}}
.foot{margin-top:12px;padding-top:8px;border-top:1px solid ${BRAND.line};font-size:8px;color:${BRAND.muted};display:flex;justify-content:space-between;gap:12px}
section{margin-bottom:12px}
body{overflow-wrap:anywhere}.kpis>*{min-width:0}.hd>*{min-width:0}
@media screen and (max-width:600px){.hd{flex-wrap:wrap}.hd .right{margin-left:0;text-align:left}.kpis{grid-template-columns:1fr}.grid2{grid-template-columns:1fr}.curve-top{flex-wrap:wrap}.meta .chip{max-width:100%;border-radius:8px}}
`;

function curveCard(report: Report) {
  const curve = report.curve;
  if (!curve) return "";
  const width = 680, height = 128;
  const g = curveGeometry(curve.values, width, height);
  const grid = g.ticks.map((tick) => `<line x1="${g.left}" x2="${g.right}" y1="${tick.y.toFixed(1)}" y2="${tick.y.toFixed(1)}" stroke="${tick.zero ? BRAND.muted : BRAND.line}" stroke-width="${tick.zero ? 1 : .7}" ${tick.zero ? 'stroke-dasharray="3 3"' : ""}/><text x="${g.left - 6}" y="${(tick.y + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${BRAND.muted}">${esc(tick.label)}</text>`).join("");
  const color = curve.tone === "neg" ? BRAND.neg : BRAND.violet;
  return `<section class="card"><div class="curve-top"><h2 style="border:0;margin:0;padding:0">Curva de resultados · ${esc(curve.unit)}</h2><strong class="${cls[curve.tone]}">${esc(curve.final)}</strong></div>
<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Curva de resultado acumulado"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>
${grid}<polygon points="${g.area}" fill="url(#fill)"/><polyline points="${g.line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${g.lastX.toFixed(1)}" cy="${g.lastY.toFixed(1)}" r="3.6" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>
<div class="curve-top" style="font-size:8px;color:${BRAND.muted}"><span>Inicio · 0</span><span>${esc(curve.endLabel)}</span></div></section>`;
}

function bars(title: string, items: Bucket[]) {
  const body = items.length ? items.map((item) => `<div class="bar-row"><div class="bar-top"><span><b>${esc(item.label)}</b> <small>· ${esc(item.detail)}</small></span><b class="${cls[item.tone]}">${esc(item.value)}</b></div>
<div class="track"><i style="width:${(item.share * 100).toFixed(0)}%;background:${item.tone === "neg" ? BRAND.neg : BRAND.violet}"></i></div></div>`).join("")
    : `<div class="empty">Sin operaciones cerradas con R calculable.</div>`;
  return `<section class="card" style="margin:0"><h2>${esc(title)}</h2>${body}</section>`;
}

function tradeRows(report: Report) {
  const { money, notes } = report.options;
  const span = 7 + (money ? 1 : 0);
  const head = `<tr><th>Fecha</th><th>Activo</th><th>Dirección</th><th>Setup</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">Resultado</th>${money ? '<th class="n">P&amp;L</th>' : ""}</tr>`;
  const rows = report.trades.map((trade: TradeRow, index) => {
    const zebra = index % 2 === 1 ? "z" : "";
    const result = trade.open ? `<span class="tag open">Abierta</span>` : `<b class="${cls[trade.tone]}">${esc(rLabel(trade.r))}</b>`;
    const extra = notes ? [trade.emotion, trade.grade === null ? "" : `Calificación ${trade.grade}/5`, trade.errors ? "Errores: " + trade.errors : "", trade.note].filter(Boolean).join(" · ") : "";
    return `<tbody><tr class="${zebra}"><td>${esc(trade.date)}<small>${esc(trade.time)} EC</small></td><td><b>${esc(trade.asset)}</b><small>${esc(trade.account)}</small></td>
<td class="side ${trade.long ? "pos" : "neg"}">${esc(trade.side)}</td><td>${esc(trade.setup)}</td><td class="n">${esc(price(trade.entry))}</td><td class="n">${esc(price(trade.exit))}</td><td class="n">${result}</td>
${money ? `<td class="n ${trade.pnl === null ? "" : trade.pnl > 0 ? "pos" : trade.pnl < 0 ? "neg" : ""}">${trade.pnl === null ? "—" : esc(formatMoney(Math.round(trade.pnl * 100), trade.currency))}</td>` : ""}</tr>`
      + (extra ? `<tr class="note ${zebra}"><td colspan="${span}">${esc(extra)}</td></tr>` : "") + ([ ["Captura entrada", trade.captureBefore], ["Captura salida", trade.captureAfter] ].filter(([, link]) => link).map(([label, link]) => `<tr class="note ${zebra}"><td colspan="${span}" style="overflow-wrap:anywhere">${esc(label)}: ${esc(link)}</td></tr>`).join("")) + "</tbody>";
  }).join("");
  return `<table><thead>${head}</thead>${rows}</table>`;
}

export function reportHtml(report: Report, options: { fontUrl?: string } = {}): string {
  const font = options.fontUrl ? `@font-face{font-family:Geist;src:url("${esc(options.fontUrl)}") format("woff2");font-weight:100 900}` : "";
  const footerText = cssString(`${BRAND.full} · ${report.period}`);
  const note = ["Resultados en R (múltiplos del riesgo inicial).", report.options.money ? "Incluye importes en dinero." : "Sin importes en dinero.", report.options.notes ? "Incluye notas y emociones." : "Sin notas ni emociones."].join(" ");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.fileStem)}</title>
<style>${font}@page{size:A4;margin:12mm 12mm 16mm;@bottom-left{content:"${footerText}";font:8px Geist,Inter,sans-serif;color:${BRAND.muted}}@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8px Geist,Inter,sans-serif;color:${BRAND.muted}}}${STYLE}</style></head><body>
<header class="hd"><div class="brand">${logoSvg(42)}<div><b>${esc(BRAND.name)}</b><i>${esc(BRAND.caption)}</i></div></div>
<div class="right"><strong>${esc(report.title.toUpperCase())}</strong><span>${esc(report.period)}</span><span>${esc(report.account)}</span></div></header><div class="stripe"></div>
<div class="meta"><span class="chip">${report.counts.closed} cerradas · ${report.counts.open} abiertas</span><span class="chip">${esc(report.timezone)}</span><span class="chip">Generado ${esc(report.generated)}</span>${report.demo ? '<span class="chip warn">Datos de ejemplo</span>' : ""}</div>
<div class="kpis">${report.kpis.map((kpi) => `<div class="kpi"><small>${esc(kpi.label)}</small><strong class="${cls[kpi.tone]}">${esc(kpi.value)}</strong><span>${esc(kpi.detail)}</span></div>`).join("")}</div>
${curveCard(report)}
${report.kind === "periodo" && !report.profile ? `<div class="grid2" style="margin-bottom:12px">${bars("Resultado por setup", report.setups)}${bars("Resultado por activo", report.assets)}</div>
<section class="card"><h2>R promedio por día de entrada</h2>${report.weekdays.length ? `<div class="week">${report.weekdays.map((day) => `<div class="day ${cls[day.tone]}"><span>${esc(day.label)}</span><strong>${esc(day.value)}</strong></div>`).join("")}</div>` : '<div class="empty">Sin operaciones cerradas con R calculable.</div>'}</section>` : ""}
${report.profile?report.sections.map(s=>`<section><h2>${esc(s.title)}</h2>${s.note?`<p>${esc(s.note)}</p>`:""}<table><thead><tr>${s.columns.map(c=>`<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${s.rows.map(row=>`<tr>${row.map((v,i)=>`<td>${esc(sectionCell(v,s.columns[i]))}</td>`).join("")}</tr>`).join("")}</tbody></table>${!s.rows.length?'<p>Sin datos para esta sección.</p>':""}</section>`).join("")+`<aside>${report.warnings.map(w=>`<p>${esc(w)}</p>`).join("")}</aside>`:`<section><h2>Operaciones</h2>${report.trades.length ? tradeRows(report) : '<div class="empty">No hay operaciones en este periodo.</div>'}</section>`}
<div class="foot"><span>${esc(note)}</span><span>${esc(BRAND.full)}</span></div></body></html>`;
}
