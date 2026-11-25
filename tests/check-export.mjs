// Pruebas de compartir/exportar. Solo usan funciones puras: no necesitan servidor ni navegador.
// Ejecuta: node tests/check-export.mjs
import assert from "node:assert/strict";
import { exampleJournal } from "../lib/demo.ts";
import { buildReport, periodName, tradeSheet } from "../lib/report.ts";
import { reportCsv } from "../lib/report-csv.ts";
import { reportHtml } from "../lib/report-html.ts";
import { reportXlsx } from "../lib/report-xlsx.ts";
import { reportText, tradeText, reportCardSvg, tradeCardSvg, backupJson } from "../lib/share.ts";
import { summarize } from "../lib/stats.ts";
import { dateSerial, zip } from "../lib/xlsx.ts";

const journal = exampleJournal("2026-11-16");
const now = Date.parse("2026-11-16T20:42:00Z");
const base = { trades: journal.trades, journal, period: periodName("30", "2026-10-18", "2026-11-16"), account: "Demo", assumedCurrency: "USD", now };
const plain = buildReport(base);
const full = buildReport({ ...base, options: { money: true, notes: true } });

// 1) Las cifras coinciden con las estadísticas de la app
const summary = summarize(journal.trades, journal.accounts, "USD");
assert.equal(plain.counts.closed, summary.closed);
assert.equal(plain.counts.win, summary.win);
assert.equal(plain.trades.length, journal.trades.length);
assert.ok(Math.abs(plain.trades[0].cum - plain.curve.values.at(-1)) < 1e-9, "R acumulado de la última fila = final de la curva");

// 2) Privacidad por defecto: sin dinero, sin notas, sin saldo
const sensitive = JSON.stringify(plain);
assert.ok(plain.trades.every((row) => row.pnl === null && row.fees === null && row.note === "" && row.emotion === ""));
assert.ok(!plain.kpis.some((kpi) => kpi.label === "P&L neto"));
assert.ok(!reportText(plain).includes("$") && !reportCsv(plain).includes("USD;"));
assert.ok(!sensitive.includes("startingBalance") && !sensitive.includes("10.000,00"));
assert.ok(!JSON.stringify(full).includes("startingBalance"));
assert.ok(full.kpis[0].label === "P&L neto" && full.trades[0].pnl !== null && full.trades[0].note !== "");

// 3) CSV: rectangular y protegido contra inyección de fórmulas
const hostile = structuredClone(journal);
hostile.setups[0].name = '=HYPERLINK("http://malo")';
hostile.accounts[0].name = "@cuenta";
const hostileReport = buildReport({ ...base, journal: hostile, account: "@cuenta", options: { notes: true } });
const csv = reportCsv(hostileReport);
const widths = new Set(csv.slice(1).split("\r\n").map((line) => { let n = 1, q = false; for (const c of line) { if (c === '"') q = !q; else if (c === ";" && !q) n++; } return n; }));
assert.equal(widths.size, 1, "todas las filas del CSV tienen las mismas columnas");
assert.ok(csv.startsWith("\uFEFF") && csv.includes("'=HYPERLINK") && csv.includes("'@cuenta"));
assert.ok(!/(^|;)[=+@]/m.test(csv.replace(/'=|'@/g, "")), "ninguna celda empieza por = + @");
assert.ok(!/(^|;)-\d+ R/m.test(csv), "los valores con unidad no empiezan por -");

// 4) HTML: escapa texto del usuario
hostile.setups[1].name = '<img src=x onerror=alert(1)>';
const html = reportHtml(buildReport({ ...base, journal: hostile }));
assert.ok(!html.includes("<img src=x") && html.includes("&lt;img src=x"));

// 5) Excel: ZIP válido, partes esperadas y texto nunca como fórmula
const bytes = reportXlsx(hostileReport, new Date(now));
assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
const text = new TextDecoder("latin1").decode(bytes);
for (const part of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/media/image1.png"]) assert.ok(text.includes(part), part);
assert.ok(!/<f>=HYPERLINK/.test(text) && text.includes("t=\"inlineStr\""));
assert.equal(dateSerial("2026-11-16"), 46342);
assert.equal(zip([{ name: "a.txt", data: new TextEncoder().encode("hola") }]).length, 30 + 5 + 4 + 46 + 5 + 22);

// 6) Imagen, texto y respaldo
const sheet = tradeSheet(journal.trades[0], journal, now, {}, true);
assert.ok(sheet.money === null && sheet.note === "");
assert.ok(reportCardSvg(plain).includes("<svg") && tradeCardSvg(sheet).includes("US100"));
assert.ok(tradeText(sheet).includes("Resultado:"));
const backup = JSON.parse(backupJson(journal, now));
assert.equal(backup.operaciones.length, journal.trades.length);
assert.equal(backup.cuentas[0].startingBalanceCents, 1_000_000, "el respaldo es completo");

console.log("check-export: ok");
