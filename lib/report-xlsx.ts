import { BRAND, LOGO_PNG_BASE64, type Tone } from "./brand.ts";
import type { Bucket, Report, TradeRow } from "./report.ts";
import { dateSerial, Workbook, type Side, type Sheet, type Style } from "./xlsx.ts";

const FONT = "Calibri";
const line: Side = { style: "thin", color: BRAND.line };
const hair: Side = { style: "hair", color: BRAND.line };
const ink = (extra: NonNullable<Style["font"]> = {}) => ({ name: FONT, size: 10, color: BRAND.ink, ...extra });
const toneColor: Record<Tone, string> = { pos: BRAND.pos, neg: BRAND.neg, zero: BRAND.ink };
const toneFill: Record<Tone, string | undefined> = { pos: BRAND.posBg, neg: BRAND.negBg, zero: undefined };
const R_FORMAT = '+0.00" R";-0.00" R";0.00" R"';
const MONEY_FORMAT = "+#,##0.00;-#,##0.00;0.00";

type Box = { top?: Side; bottom?: Side; left?: Side; right?: Side };

/** Escribe en un rango (combinándolo si hace falta) y dibuja solo el borde exterior de la caja. */
function put(sheet: Sheet, r1: number, c1: number, r2: number, c2: number, value: string | number | null | { f: string; v: number }, style: Style, box: Box = {}) {
  for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) {
    const border = { top: row === r1 ? box.top : undefined, bottom: row === r2 ? box.bottom : undefined, left: col === c1 ? box.left : undefined, right: col === c2 ? box.right : undefined };
    const has = Object.values(border).some(Boolean);
    sheet.set(row, col, row === r1 && col === c1 ? value : null, { ...style, ...(has ? { border } : {}) });
  }
  if (r2 > r1 || c2 > c1) sheet.merge(r1, c1, r2, c2);
}

function logoBytes() {
  const binary = atob(LOGO_PNG_BASE64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Banda de cabecera con logo: es la misma pieza que abre el PDF y la tarjeta. */
function header(sheet: Sheet, report: Report, lastCol: number, title: string, sub: string) {
  sheet.paint(1, 1, 3, lastCol, { fill: BRAND.navy });
  put(sheet, 1, 3, 2, Math.min(lastCol, 9), title, { font: ink({ size: 20, bold: true, color: BRAND.onNavy }), fill: BRAND.navy, align: { v: "center" } });
  put(sheet, 3, 3, 3, Math.min(lastCol, 9), sub, { font: ink({ size: 9, bold: true, color: BRAND.violetSoft }), fill: BRAND.navy, align: { v: "top" } });
  const rightFrom = Math.min(lastCol, 9) + 1;
  put(sheet, 1, rightFrom, 3, lastCol, `${report.period}\n${report.account}`, { font: ink({ size: 10, color: BRAND.onNavyMuted }), fill: BRAND.navy, align: { h: "right", v: "center", wrap: true, indent: 1 } });
  sheet.height(1, 22).height(2, 22).height(3, 18).height(4, 4);
  sheet.paint(4, 1, 4, lastCol, { fill: BRAND.violet });
  sheet.picture(logoBytes(), 0, 0, 44, 44, 12, 9, "Logo de Bitácora de Trading");
}

function sectionTitle(sheet: Sheet, row: number, lastCol: number, text: string) {
  put(sheet, row, 1, row, lastCol, text, { font: ink({ size: 11, bold: true, color: BRAND.violet }), align: { v: "bottom" } }, { bottom: { style: "medium", color: BRAND.violet } });
  sheet.height(row, 22);
}

const bar = (bucket: Bucket) => "█".repeat(Math.max(bucket.num === null ? 0 : 1, Math.round(bucket.share * 18)));

function bucketTable(sheet: Sheet, start: number, lastCol: number, title: string, firstHead: string, items: Bucket[]) {
  let row = start;
  sectionTitle(sheet, row++, lastCol, title);
  const head: Style = { font: ink({ size: 9, bold: true, color: BRAND.muted }), fill: BRAND.surface, align: { v: "center", indent: 1 } };
  put(sheet, row, 1, row, 4, firstHead, head); put(sheet, row, 5, row, 8, "Base", head);
  put(sheet, row, 9, row, 10, "Resultado", { ...head, align: { h: "right", v: "center", indent: 1 } }); put(sheet, row, 11, row, lastCol, "", head);
  sheet.height(row++, 18);
  if (!items.length) {
    put(sheet, row, 1, row, lastCol, "Sin operaciones cerradas con R calculable en este periodo.", { font: ink({ italic: true, color: BRAND.muted }), align: { indent: 1 } });
    return row + 2;
  }
  for (const item of items) {
    const base: Style = { font: ink(), align: { v: "center", indent: 1 } };
    const edge = { bottom: hair };
    put(sheet, row, 1, row, 4, item.label, { ...base, font: ink({ bold: true }) }, edge);
    put(sheet, row, 5, row, 8, item.detail, { ...base, font: ink({ color: BRAND.muted }) }, edge);
    put(sheet, row, 9, row, 10, item.value, { ...base, font: ink({ bold: true, color: toneColor[item.tone] }), align: { h: "right", v: "center", indent: 1 } }, edge);
    put(sheet, row, 11, row, lastCol, bar(item), { ...base, font: ink({ size: 9, color: item.tone === "neg" ? BRAND.neg : BRAND.pos }) }, edge);
    sheet.height(row++, 19);
  }
  return row + 1;
}

function summarySheet(book: Workbook, report: Report) {
  const sheet = book.sheet("Resumen");
  sheet.tab = BRAND.violet;
  sheet.landscape = false;
  sheet.footer = `${BRAND.full} · ${report.title}`;
  const cols = [10.5, 10.5, 10.5, 10.5, 1.5, 10.5, 10.5, 10.5, 10.5, 1.5, 10.5, 10.5, 10.5, 10.5];
  cols.forEach((width, i) => sheet.width(i + 1, width));
  const last = cols.length;
  header(sheet, report, last, BRAND.full, report.title.toUpperCase());
  sheet.height(5, 8);
  put(sheet, 6, 1, 6, last, `Generado el ${report.generated} · ${report.timezone} · ${report.counts.closed} cerradas, ${report.counts.open} abiertas${report.demo ? " · DATOS DE EJEMPLO" : ""}`,
    { font: ink({ size: 9, color: report.demo ? BRAND.amber : BRAND.muted, bold: report.demo }), align: { v: "center" } });
  sheet.height(6, 20).height(7, 6);

  const spans: [number, number][] = [[1, 4], [6, 9], [11, 14]];
  report.kpis.slice(0, 6).forEach((kpi, index) => {
    const top = 8 + Math.floor(index / 3) * 4;
    const [c1, c2] = spans[index % 3];
    const side = { left: line, right: line };
    put(sheet, top, c1, top, c2, kpi.label.toUpperCase(), { font: ink({ size: 8.5, bold: true, color: BRAND.muted }), fill: BRAND.surface, align: { v: "center", indent: 1 } }, { ...side, top: { style: "medium", color: BRAND.violet } });
    put(sheet, top + 1, c1, top + 1, c2, kpi.value, { font: ink({ size: 24, bold: true, color: toneColor[kpi.tone] }), fill: BRAND.surface, align: { h: "left", v: "center", indent: 1 } }, side);
    put(sheet, top + 2, c1, top + 2, c2, kpi.detail, { font: ink({ size: 9, color: BRAND.muted }), fill: BRAND.surface, align: { v: "center", indent: 1 } }, { ...side, bottom: line });
    sheet.height(top, 20).height(top + 1, 38).height(top + 2, 20).height(top + 3, 9);
  });

  let row = 16;
  row = bucketTable(sheet, row, last, "RESULTADO POR SETUP", "Setup", report.setups);
  row = bucketTable(sheet, row, last, "RESULTADO POR ACTIVO", "Activo", report.assets);
  row = bucketTable(sheet, row, last, "R PROMEDIO POR DÍA DE ENTRADA", "Día", report.weekdays);
  const note = ["Resultados en R (múltiplos del riesgo inicial).", report.options.money ? "Incluye importes en dinero." : "Sin importes en dinero.", report.options.notes ? "Incluye notas y emociones." : "Sin notas ni emociones."].join(" ");
  put(sheet, row, 1, row, last, note, { font: ink({ size: 9, color: BRAND.muted }), align: { v: "center", wrap: true } }, { top: line });
  sheet.height(row, 22);
  return sheet;
}

type Column = { head: string; width: number; value: (row: TradeRow) => string | number | null; style: (row: TradeRow, zebra: boolean) => Style; total?: "r" | "pnl" };

function tradesSheet(book: Workbook, report: Report) {
  const sheet = book.sheet("Operaciones");
  sheet.tab = BRAND.navy;
  sheet.footer = `${BRAND.full} · ${report.period}`;
  const money = report.options.money, notes = report.options.notes;
  const body = (row: TradeRow, zebra: boolean, extra: Style = {}): Style => ({
    font: ink(), fill: zebra ? BRAND.surface : undefined, border: { bottom: hair }, align: { v: "center" }, ...extra,
  });
  const time = (row: TradeRow) => { const [h, m] = row.time.split(":").map(Number); return (h * 60 + m) / 1440; };
  const columns: Column[] = [
    { head: "Fecha", width: 13, value: (row) => dateSerial(row.day), style: (row, z) => body(row, z, { numFmt: "dd mmm yyyy", align: { h: "left", v: "center", indent: 1 } }) },
    { head: "Hora", width: 8, value: time, style: (row, z) => body(row, z, { numFmt: "hh:mm", align: { h: "center", v: "center" } }) },
    { head: "Activo", width: 11, value: (row) => row.asset, style: (row, z) => body(row, z, { font: ink({ bold: true }) }) },
    { head: "Dirección", width: 11, value: (row) => row.side, style: (row, z) => body(row, z, { font: ink({ bold: true, color: row.long ? BRAND.pos : BRAND.neg }) }) },
    { head: "Setup", width: 22, value: (row) => row.setup, style: (row, z) => body(row, z) },
    { head: "Cuenta", width: 16, value: (row) => row.account, style: (row, z) => body(row, z, { font: ink({ color: BRAND.muted }) }) },
    { head: "Entrada", width: 12, value: (row) => row.entry, style: (row, z) => body(row, z, { numFmt: "General", align: { h: "right", v: "center" } }) },
    { head: "Stop", width: 12, value: (row) => row.stop, style: (row, z) => body(row, z, { numFmt: "General", align: { h: "right", v: "center" } }) },
    { head: "Objetivo", width: 12, value: (row) => row.target, style: (row, z) => body(row, z, { numFmt: "General", align: { h: "right", v: "center" } }) },
    { head: "Salida", width: 12, value: (row) => row.exit, style: (row, z) => body(row, z, { numFmt: "General", align: { h: "right", v: "center" } }) },
    { head: "R:B plan", width: 9, value: (row) => row.plan, style: (row, z) => body(row, z, { numFmt: '"1:"0.0#', align: { h: "right", v: "center" } }) },
    { head: "Resultado R", width: 13, value: (row) => row.r, total: "r", style: (row, z) => body(row, z, { numFmt: R_FORMAT, font: ink({ bold: true, color: toneColor[row.tone] }), fill: toneFill[row.tone] ?? (z ? BRAND.surface : undefined), align: { h: "right", v: "center" } }) },
    { head: "R acumulado", width: 13, value: (row) => row.cum, style: (row, z) => body(row, z, { numFmt: R_FORMAT, font: ink({ color: BRAND.muted }), align: { h: "right", v: "center" } }) },
    { head: "Estado", width: 13, value: (row) => row.status, style: (row, z) => body(row, z, { font: ink({ bold: true, color: row.open ? BRAND.amber : toneColor[row.tone] }), fill: row.open ? BRAND.amberBg : toneFill[row.tone] ?? (z ? BRAND.surface : undefined), align: { h: "center", v: "center" } }) },
  ];
  if (money) {
    columns.push(
      { head: "P&L neto", width: 13, value: (row) => row.pnl, total: "pnl", style: (row, z) => body(row, z, { numFmt: MONEY_FORMAT, font: ink({ bold: true, color: row.pnl === null || row.pnl === 0 ? BRAND.ink : row.pnl > 0 ? BRAND.pos : BRAND.neg }), align: { h: "right", v: "center" } }) },
      { head: "Moneda", width: 9, value: (row) => row.pnl === null ? null : row.currency, style: (row, z) => body(row, z, { font: ink({ color: BRAND.muted }), align: { h: "center", v: "center" } }) },
      { head: "Comisiones", width: 12, value: (row) => row.fees, style: (row, z) => body(row, z, { numFmt: "#,##0.00", align: { h: "right", v: "center" } }) },
    );
  }
  if (notes) {
    columns.push(
      { head: "Emoción (antes → después)", width: 34, value: (row) => row.emotion || null, style: (row, z) => body(row, z) },
      { head: "Calificación", width: 12, value: (row) => row.grade, style: (row, z) => body(row, z, { numFmt: '0" / 5"', align: { h: "center", v: "center" } }) },
      { head: "Errores", width: 26, value: (row) => row.errors || null, style: (row, z) => body(row, z, { font: ink({ color: BRAND.neg }) }) },
      { head: "Comentarios", width: 60, value: (row) => row.note || null, style: (row, z) => body(row, z, { align: { v: "center", wrap: true } }) },
    );
  }
  columns.push(
    { head: "Captura entrada", width: 48, value: (row) => row.captureBefore || null, style: (row, z) => body(row, z, { align: { wrap: true } }) },
    { head: "Captura salida", width: 48, value: (row) => row.captureAfter || null, style: (row, z) => body(row, z, { align: { wrap: true } }) },
  );
  const last = columns.length;
  columns.forEach((column, i) => sheet.width(i + 1, column.width));
  header(sheet, report, Math.max(last, 12), "Operaciones", `${report.counts.closed} CERRADAS · ${report.counts.open} ABIERTAS`);
  sheet.height(5, 8);

  const headRow = 6;
  columns.forEach((column, i) => sheet.set(headRow, i + 1, column.head, {
    font: ink({ bold: true, color: BRAND.onNavy }), fill: BRAND.navy, align: { h: i < 6 && i !== 1 ? "left" : "center", v: "center", wrap: true, indent: i === 0 ? 1 : 0 },
  }));
  sheet.height(headRow, 26);
  const first = headRow + 1;
  report.trades.forEach((trade, index) => {
    const row = first + index;
    columns.forEach((column, i) => sheet.set(row, i + 1, column.value(trade), column.style(trade, index % 2 === 1)));
    sheet.height(row, notes ? 22 : 19);
  });
  const lastRow = first + report.trades.length - 1;
  const total = lastRow + 1;
  if (report.trades.length) {
    const totalStyle: Style = { font: ink({ bold: true }), fill: BRAND.tint, border: { top: { style: "medium", color: BRAND.violet } }, align: { v: "center" } };
    sheet.paint(total, 1, total, last, totalStyle);
    sheet.set(total, 1, "Total del filtro visible", { ...totalStyle, align: { v: "center", indent: 1 } });
    columns.forEach((column, i) => {
      if (!column.total) return;
      if(column.total==="pnl"&&new Set(report.trades.filter(t=>t.pnl!==null).map(t=>t.currency)).size!==1)return;
      const letter = String.fromCharCode(65 + i);
      const cached = report.trades.reduce((sum, trade) => sum + ((column.total === "r" ? trade.r : trade.pnl) ?? 0), 0);
      sheet.set(total, i + 1, { f: `SUBTOTAL(109,${letter}${first}:${letter}${lastRow})`, v: cached },
        { ...totalStyle, numFmt: column.total === "r" ? R_FORMAT : MONEY_FORMAT, font: ink({ bold: true, color: BRAND.violet }), align: { h: "right", v: "center" } });
    });
    sheet.height(total, 22);
    sheet.filter = [headRow, 1, lastRow, last];
  }
  put(sheet, total + 2, 1, total + 2, Math.max(last, 12), `Generado el ${report.generated} · ${report.timezone}${report.demo ? " · DATOS DE EJEMPLO" : ""} · El total cambia al filtrar las columnas.`, { font: ink({ size: 9, color: BRAND.muted }) });
  sheet.frozenRows = headRow;
  sheet.titleRow = headRow;
  return sheet;
}

/** Libro de Excel con la identidad de la app: hoja «Resumen» y hoja «Operaciones». */
export function reportXlsx(report: Report, date = new Date()): Uint8Array {
  const book = new Workbook();
  book.title = `${BRAND.full} · ${report.period}`;
  book.author = BRAND.full;
  if(report.profile){
    const overview=book.sheet("Indicadores");overview.width(1,40).width(2,32).width(3,80);overview.set(1,1,report.title,{font:ink({bold:true,size:18})});overview.set(2,1,report.period);overview.set(3,1,report.account);overview.set(4,1,report.generated+" · "+report.timezone);
    overview.picture(logoBytes(),0,3,44,44,0,0,"Tradeify");
    report.kpis.forEach((k,i)=>{overview.set(i+6,1,k.label);overview.set(i+6,2,k.value);overview.set(i+6,3,k.detail);});
    report.warnings.forEach((w,i)=>overview.set(i+7+report.kpis.length,1,w,{align:{wrap:true}}).height(i+7+report.kpis.length,40));
    report.sections.forEach((s,index)=>{
      const sheet=book.sheet(((index+1)+" "+s.title.replace(/[:\\/?*\[\]]/g," ")).slice(0,31));sheet.footer=report.title+" · "+report.timezone;sheet.titleRow=2;sheet.frozenRows=2;sheet.set(1,1,s.title,{font:ink({bold:true,size:14})});
      s.columns.forEach((c,i)=>{sheet.width(i+1,c.type==="text"?32:22);sheet.set(2,i+1,c.label,{font:ink({bold:true}),fill:BRAND.tint});});
      s.rows.forEach((cells,r)=>cells.forEach((value,c)=>{const column=s.columns[c];const numberFormat=column.type==="percent"?"0.00%":column.type==="money"?'"'+column.currency+'" #,##0.00;"'+column.currency+'" -#,##0.00':column.type==="r"?R_FORMAT:column.type==="date"?"yyyy-mm-dd":"General";sheet.set(r+3,c+1,column.type==="date"&&typeof value==="string"?dateSerial(value):value,{font:ink(),numFmt:numberFormat,align:{wrap:true,v:"top"}});sheet.height(r+3,32);}));
      if(s.rows.length)sheet.filter=[2,1,s.rows.length+2,s.columns.length];if(s.note)sheet.set(s.rows.length+4,1,s.note,{align:{wrap:true}});
    });
  }else{summarySheet(book, report);tradesSheet(book, report);}
  return book.build(date);
}
