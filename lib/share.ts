import { BRAND, logoSvg, type Tone } from "./brand.ts";
import { curveGeometry } from "./chart.ts";
import { downloadFile } from "./csv.ts";
import type { Journal } from "./journal.ts";
import type { Report, TradeSheet } from "./report.ts";
import { sectionCell } from "./report-profiles.ts";

/** Texto, tarjeta PNG y respaldo JSON con la misma identidad que el PDF y el Excel. */

const esc = (text: string | number | null | undefined) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const clip = (text: string, max: number) => text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
const onDark: Record<Tone, string> = { pos: BRAND.posOnDark, neg: BRAND.negOnDark, zero: BRAND.onNavy };
const W = 1080, H = 1350, M = 64;

// ---------- Texto ----------

const RULE = "━━━━━━━━━━━━━━";

export function reportText(report: Report): string {
  if(report.profile)return [BRAND.full,report.title,`${report.period} · ${report.account}`,...report.kpis.map(k=>`${k.label}: ${k.value} · ${k.detail}`),...report.sections.flatMap(s=>[s.title,...s.rows.map(row=>row.map((v,i)=>`${s.columns[i].label}: ${sectionCell(v,s.columns[i])}`).join(" · ")),s.note??""]),...report.warnings,`${report.generated} · ${report.timezone}`].join("\n");
  const kpi = (label: string) => report.kpis.find((item) => item.label === label);
  const lines = [
    `▌${BRAND.full.toUpperCase()}`, `${report.period} · ${report.account}`, RULE,
    `${report.headline.label}: ${report.headline.value}`,
    ...(kpi("P&L neto") ? [`P&L neto: ${kpi("P&L neto")!.value}`] : []),
    `Operaciones: ${report.counts.closed} cerradas (${report.counts.win} ganadas · ${report.counts.loss} perdidas · ${report.counts.flat} BE)`,
    `Acierto: ${kpi("Tasa de acierto")?.value ?? "—"} · Profit factor: ${kpi("Profit factor")?.value ?? "—"} (${kpi("Profit factor")?.detail ?? "sin muestra"})`,
    `Expectativa: ${kpi("Expectativa")?.value ?? "—"} (${kpi("Expectativa")?.detail ?? "sin muestra"}) · Caída máx.: ${kpi("Caída máxima")?.value ?? "—"} (${kpi("Caída máxima")?.detail ?? "sin muestra"})`,
  ];
  if (report.setups.length) lines.push(RULE, "Por setup:", ...report.setups.slice(0, 3).map((item) => `• ${item.label}: ${item.value}`));
  lines.push(RULE, `${report.demo ? "Datos de ejemplo · " : ""}Generado ${report.generated} · ${report.timezone}`);
  return lines.join("\n");
}

export function tradeText(sheet: TradeSheet): string {
  const lines = [
    `▌${BRAND.full.toUpperCase()}`, `${sheet.asset} · ${sheet.side} · ${sheet.when}`, RULE,
    `Resultado: ${sheet.r}${sheet.money ? ` (${sheet.money})` : ""}`, `Setup: ${sheet.setup}`,
    ...sheet.facts.map(([label, value]) => `${label}: ${value}`),
  ];
  if (sheet.emotion) lines.push(`Emociones: ${sheet.emotion}`);
  if (sheet.grade) lines.push(`Calificación: ${sheet.grade}`);
  if (sheet.errors.length) lines.push(`Errores: ${sheet.errors.join(", ")}`);
  if (sheet.note) lines.push(`Nota: ${clip(sheet.note, 280)}`);
  lines.push(RULE, `${sheet.demo ? "Datos de ejemplo · " : ""}Generado ${sheet.generated} · ${sheet.timezone}`);
  return lines.join("\n");
}

// ---------- Tarjeta (SVG → PNG) ----------

function frame(font: string, body: string, subtitle: string, side: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><style>${font}text{font-family:Geist,Inter,"Segoe UI",system-ui,sans-serif}</style>
<radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 60) rotate(40) scale(900 700)"><stop offset="0" stop-color="${BRAND.violetSoft}" stop-opacity=".22"/><stop offset="1" stop-color="${BRAND.violetSoft}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${BRAND.deep}"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
<svg x="${M}" y="${M}" width="76" height="76" viewBox="0 0 48 48">${logoSvg(48).replace(/^<svg[^>]*>/, "").replace("</svg>", "")}</svg>
<text x="${M + 96}" y="${M + 40}" font-size="40" font-weight="760" letter-spacing="-1.6" fill="${BRAND.onNavy}">${esc(BRAND.name)}</text>
<text x="${M + 97}" y="${M + 68}" font-size="14" font-weight="760" letter-spacing="2.2" fill="${BRAND.onNavyMuted}">${esc(BRAND.caption)}</text>
<text x="${W - M}" y="${M + 36}" text-anchor="end" font-size="15" font-weight="760" letter-spacing="2.4" fill="${BRAND.violetSoft}">${esc(subtitle)}</text>
<text x="${W - M}" y="${M + 66}" text-anchor="end" font-size="22" fill="${BRAND.onNavyMuted}">${esc(clip(side, 44))}</text>
<rect x="${M}" y="${M + 100}" width="${W - 2 * M}" height="4" rx="2" fill="${BRAND.violet}"/>
${body}</svg>`;
}

const panel = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${BRAND.navy}" stroke="${BRAND.navyLine}" stroke-width="2"/>`;
const footer = (left: string, right: string) => `<text x="${M}" y="${H - 52}" font-size="20" fill="${BRAND.onNavyMuted}">${esc(clip(left, 70))}</text><text x="${W - M}" y="${H - 52}" text-anchor="end" font-size="20" fill="${BRAND.onNavyMuted}">${esc(right)}</text>`;

export function reportCardSvg(report: Report, fontCss = ""): string {
  if(report.profile){
    const entries=report.kpis.slice(0,6);
    let body=entries.map((k,i)=>`${panel(M,205+i*130,W-2*M,115)}<text x="${M+24}" y="${240+i*130}" font-size="22" fill="${BRAND.onNavyMuted}">${esc(clip(k.label,48))}</text><text x="${M+24}" y="${294+i*130}" font-size="38" fill="${onDark[k.tone]}">${esc(clip(k.value,35))}</text>`).join("");
    const start=235+entries.length*130,slots=Math.min(3,Math.floor((1180-start)/135));
    report.sections.slice(0,slots).forEach((s,i)=>{const y=start+i*135;body+=panel(M,y,W-2*M,125)+`<text x="${M+24}" y="${y+30}" font-size="22" fill="${BRAND.violetSoft}">${esc(clip(s.title,65))}</text>`;const lines=s.rows.slice(0,2).map(row=>row.map((v,c)=>sectionCell(v,s.columns[c])).join(" · "));if(!lines.length)lines.push("Sin datos en esta sección");lines.forEach((line,j)=>{body+=`<text x="${M+24}" y="${y+64+j*30}" font-size="20" fill="${BRAND.onNavyMuted}">${esc(clip(line,76))}</text>`;});});
    body+=`<text x="${M}" y="1220" font-size="19" fill="${BRAND.onNavyMuted}">${esc(clip(report.warnings[0]??"",84))}</text>`+footer("Vista resumida · "+report.timezone,report.generated);
    return frame(fontCss,body,report.title.toUpperCase(),`${report.period} · ${report.account}`);
  }
  let body = panel(M, 190, W - 2 * M, 470);
  body += `<text x="${M + 40}" y="250" font-size="20" font-weight="760" letter-spacing="2.4" fill="${BRAND.onNavyMuted}">${esc(report.headline.label.toUpperCase())}</text>`;
  body += `<text x="${M + 40}" y="372" font-size="124" font-weight="780" letter-spacing="-5" fill="${onDark[report.headline.tone]}">${esc(report.headline.value)}</text>`;
  body += `<text x="${M + 40}" y="420" font-size="24" fill="${BRAND.onNavyMuted}">${report.counts.closed} operaciones cerradas · ${report.counts.win} ganadas · ${report.counts.loss} perdidas</text>`;
  if (report.curve) {
    const g = curveGeometry(report.curve.values, W - 2 * M - 80, 190, { left: 4, right: 8, top: 12, bottom: 12 });
    const color = report.curve.tone === "neg" ? BRAND.negOnDark : BRAND.violetSoft;
    body += `<g transform="translate(${M + 40} 448)"><defs><linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
<line x1="0" x2="${W - 2 * M - 80}" y1="${g.zeroY.toFixed(1)}" y2="${g.zeroY.toFixed(1)}" stroke="${BRAND.navyLine}" stroke-width="2" stroke-dasharray="6 6"/>
<polygon points="${g.area}" fill="url(#cf)"/><polyline points="${g.line}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${g.lastX.toFixed(1)}" cy="${g.lastY.toFixed(1)}" r="8" fill="${color}" stroke="${BRAND.navy}" stroke-width="3"/></g>`;
  }
  const pick = ["Tasa de acierto", "Profit factor", "Expectativa", "Caída máxima"].map((label) => report.kpis.find((item) => item.label === label)).filter((item) => item !== undefined);
  const cardW = (W - 2 * M - 3 * 24) / 4;
  pick.forEach((item, i) => {
    const x = M + i * (cardW + 24);
    body += `${panel(x, 690, cardW, 150)}<text x="${x + 22}" y="734" font-size="16" font-weight="760" letter-spacing="1.6" fill="${BRAND.onNavyMuted}">${esc(item.label.toUpperCase())}</text><text x="${x + 22}" y="796" font-size="44" font-weight="760" letter-spacing="-1.5" fill="${onDark[item.tone]}">${esc(item.value)}</text><text x="${x + 22}" y="824" font-size="12" fill="${BRAND.onNavyMuted}">${esc(clip(item.detail, 30))}</text>`;
  });
  body += `<text x="${M}" y="906" font-size="20" font-weight="760" letter-spacing="2.4" fill="${BRAND.violetSoft}">MEJORES SETUPS</text>`;
  const top = report.setups.slice(0, 3);
  top.forEach((item, i) => {
    const y = 940 + i * 100, bar = W - 2 * M;
    body += `<text x="${M}" y="${y + 28}" font-size="28" font-weight="700" fill="${BRAND.onNavy}">${esc(clip(item.label, 30))}</text><text x="${W - M}" y="${y + 28}" text-anchor="end" font-size="28" font-weight="760" fill="${onDark[item.tone]}">${esc(item.value)}</text>`
      + `<rect x="${M}" y="${y + 46}" width="${bar}" height="12" rx="6" fill="${BRAND.navy}"/><rect x="${M}" y="${y + 46}" width="${Math.max(12, item.share * bar).toFixed(0)}" height="12" rx="6" fill="${item.tone === "neg" ? BRAND.negOnDark : BRAND.violetSoft}"/>`;
  });
  if (!top.length) body += `<text x="${M}" y="990" font-size="26" fill="${BRAND.onNavyMuted}">Aún no hay setups con R calculable.</text>`;
  body += footer(`${report.demo ? "Datos de ejemplo · " : ""}Resultados en R · ${report.timezone}`, report.generated);
  return frame(fontCss, body, report.title.toUpperCase(), `${report.period} · ${report.account}`);
}

export function tradeCardSvg(sheet: TradeSheet, fontCss = ""): string {
  const accent = sheet.long ? BRAND.posOnDark : BRAND.negOnDark;
  let body = `<text x="${M}" y="262" font-size="96" font-weight="780" letter-spacing="-4" fill="${BRAND.onNavy}">${esc(clip(sheet.asset, 12))}</text>`;
  body += `<rect x="${M}" y="296" width="${sheet.long ? 190 : 170}" height="52" rx="26" fill="${accent}" fill-opacity=".16"/><text x="${M + (sheet.long ? 95 : 85)}" y="332" text-anchor="middle" font-size="24" font-weight="760" fill="${accent}">${sheet.long ? "▲ Compra" : "▼ Venta"}</text>`;
  body += `<text x="${M + (sheet.long ? 214 : 194)}" y="332" font-size="24" fill="${BRAND.onNavyMuted}">${esc(clip(sheet.setup, 34))}</text>`;
  body += panel(M, 390, W - 2 * M, 300);
  body += `<text x="${M + 40}" y="450" font-size="20" font-weight="760" letter-spacing="2.4" fill="${BRAND.onNavyMuted}">RESULTADO · ${esc(sheet.status.toUpperCase())}</text>`;
  body += `<text x="${M + 40}" y="582" font-size="140" font-weight="780" letter-spacing="-6" fill="${onDark[sheet.tone]}">${esc(sheet.r)}</text>`;
  if (sheet.money) body += `<text x="${M + 40}" y="650" font-size="34" font-weight="700" fill="${onDark[sheet.tone]}">${esc(sheet.money)}</text>`;
  const cellW = (W - 2 * M - 2 * 24) / 3;
  sheet.facts.forEach(([label, value], i) => {
    const x = M + (i % 3) * (cellW + 24), y = 720 + Math.floor(i / 3) * 140;
    body += `${panel(x, y, cellW, 116)}<text x="${x + 22}" y="${y + 40}" font-size="16" font-weight="760" letter-spacing="1.6" fill="${BRAND.onNavyMuted}">${esc(label.toUpperCase())}</text><text x="${x + 22}" y="${y + 90}" font-size="40" font-weight="740" letter-spacing="-1" fill="${BRAND.onNavy}">${esc(clip(value, 12))}</text>`;
  });
  let y = 1030;
  if (sheet.emotion) { body += `<text x="${M}" y="${y}" font-size="18" font-weight="760" letter-spacing="2.2" fill="${BRAND.violetSoft}">EMOCIONES</text><text x="${M}" y="${y + 38}" font-size="28" fill="${BRAND.onNavy}">${esc(clip(sheet.emotion, 56))}${sheet.grade ? ` · ${esc(sheet.grade)}` : ""}</text>`; y += 90; }
  if (sheet.errors.length) { body += `<text x="${M}" y="${y}" font-size="18" font-weight="760" letter-spacing="2.2" fill="${BRAND.violetSoft}">ERRORES</text><text x="${M}" y="${y + 38}" font-size="28" fill="${BRAND.negOnDark}">${esc(clip(sheet.errors.join(", "), 56))}</text>`; y += 90; }
  if (sheet.note && y < 1200) body += `<text x="${M}" y="${y}" font-size="18" font-weight="760" letter-spacing="2.2" fill="${BRAND.violetSoft}">NOTA</text><text x="${M}" y="${y + 38}" font-size="26" fill="${BRAND.onNavyMuted}">${esc(clip(sheet.note, 62))}</text>`;
  body += footer(`${sheet.demo ? "Datos de ejemplo · " : ""}${sheet.timezone}`, sheet.generated);
  return frame(fontCss, body, "OPERACIÓN", `${sheet.when} · ${sheet.account}`);
}

/** Convierte el SVG en PNG con un canvas (solo navegador). */
export type ImageAspect="1:1"|"4:5"|"9:16";
export async function svgToPng(svg: string, scale = 1, aspect:ImageAspect="4:5"): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("No se pudo preparar la imagen.")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = (aspect==="1:1"?1080:aspect==="9:16"?1920:H) * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Este navegador no puede crear la imagen.");
    context.fillStyle=BRAND.deep;context.fillRect(0,0,canvas.width,canvas.height);
    const sourceWidth=image.naturalWidth||W,sourceHeight=image.naturalHeight||H;
    const fit=Math.min(canvas.width/sourceWidth,canvas.height/sourceHeight);const width=sourceWidth*fit,height=sourceHeight*fit;
    context.drawImage(image,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

/** CSS @font-face con Geist incrustado, para que la imagen conserve la tipografía de la app. */
export async function fontCss(): Promise<string> {
  try {
    const response = await fetch("/geist.woff2");
    if (!response.ok) return "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");font-weight:100 900}`;
  } catch { return ""; }
}

// ---------- Respaldo JSON ----------

/** Respaldo completo y legible. No incluye las imágenes de captura (solo cuáles existen). */
export function backupJson(journal: Journal, now: number): string {
  return JSON.stringify({
    app: "bitacora-de-trading", formato: 1, exportado: new Date(now).toISOString(), zonaHoraria: "America/Guayaquil",
    resumen: { cuentas: journal.accounts.length, setups: journal.setups.length, operaciones: journal.trades.length, revisiones: journal.reviews.length },
    cuentas: journal.accounts, setups: journal.setups, plan: journal.plan, operaciones: journal.trades, revisiones: journal.reviews,
    capturas: journal.captures,
  }, null, 2);
}

// ---------- Compartir o copiar ----------

export type ShareOutcome = "shared" | "copied" | "downloaded" | "cancelled";

/** Prueba compartir nativo; si no existe, copia al portapapeles; si tampoco, descarga el archivo. */
export async function shareOrCopy(input: { title: string; text?: string; file?: File }): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  try {
    if (typeof nav.share === "function") {
      if (input.file && nav.canShare?.({ files: [input.file] })) { await nav.share({ files: [input.file], title: input.title, text: input.text }); return "shared"; }
      if (!input.file && input.text) { await nav.share({ title: input.title, text: input.text }); return "shared"; }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
  }
  if (!input.file && input.text && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(input.text); return "copied"; } catch {}
  }
  if (input.file) {
    downloadFile(input.file.name, input.file, input.file.type);
    return "downloaded";
  }
  throw new Error("Este navegador no permite compartir ni copiar. Usa una de las descargas.");
}
