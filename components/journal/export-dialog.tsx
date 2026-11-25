"use client";
import {TradeSharePanel} from './trade-share-panel';
import {HelpLink} from "./help-center";

import { useState, type ReactNode } from "react";
import { Copy, FileJson, FileSpreadsheet, FileText, Image as ImageIcon, Printer, Table2 } from "lucide-react";
import { downloadFile, exportTrades } from "@/lib/csv";
import { dayKey, type Currency, type Journal, type Trade } from "@/lib/journal";
import { buildReport, defaultOptions, tradeSheet, REPORT_PROFILES, type ReportProfile, type ReportOptions } from "@/lib/report";
import { reportCsv } from "@/lib/report-csv";
import { reportHtml } from "@/lib/report-html";

import { backupJson, fontCss, reportCardSvg, reportText, shareOrCopy, svgToPng, type ShareOutcome, type ImageAspect } from "@/lib/share";
import { errorText } from "./trade-editor";
import { Button, Field, Modal } from "./ui";

export type ExportTarget =
  | { kind: "periodo"; trades: Trade[]; period: string; account: string; assumedCurrency: Currency;profile?:ReportProfile;scope?:string;completeHistory?:boolean;reviewKey?:string }
  | { kind: "operacion"; trade: Trade };

const STORAGE_KEY = "trading-journal-export";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function loadOptions(): ReportOptions {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ReportOptions> | null;
    return { money: saved?.money === true, notes: saved?.notes === true, capital:saved?.capital===true, account:saved?.account===true,strategies:saved?.strategies===true,captures:saved?.captures===true,prices:saved?.prices===true };
  } catch { return {...defaultOptions,account:false,strategies:false,captures:false,prices:false}; }
}

/** Imprime el reporte en un iframe oculto: así la app no cambia y el PDF sale con su propio diseño A4. */
async function printDocument(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = html;
  const loaded = new Promise<void>((resolve) => { frame.onload = () => resolve(); });
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  if (!win) { frame.remove(); throw new Error("No se pudo preparar la impresión."); }
  try { await win.document.fonts.ready; } catch {}
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => frame.remove(), 120_000);
  win.focus();
  win.print();
}

function Item({ icon, title, description, onClick, disabled }: { icon: ReactNode; title: string; description: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" className="export-item" onClick={onClick} disabled={disabled}>
    <span className="export-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span>
  </button>;
}

export function ExportDialog({ target, journal, demo, onClose, onToast,loadBackup }: {
  target: ExportTarget; journal: Journal; demo: boolean; onClose: () => void; onToast: (message: string) => void;loadBackup?:()=>Promise<Journal>;
}) {
  const [options, setOptions] = useState<ReportOptions>(loadOptions);
  const [busy, setBusy] = useState(false);
  const [aspect,setAspect]=useState<ImageAspect>("4:5");
  const [preview,setPreview]=useState(false);
  const [error, setError] = useState("");
  const [periodFlow,setPeriodFlow]=useState<'share'|'export'|'backup'>('export'),[backupConfirm,setBackupConfirm]=useState<'csv'|'json'|null>(null);
  const single = target.kind === "operacion";
  const [operationFlow,setOperationFlow]=useState<"share"|"export">("share");
  const [profile,setProfile]=useState<ReportProfile>(target.kind==="operacion"?"operacion":target.profile??"resumen");
  const trades = target.kind === "operacion" ? [target.trade] : target.trades;
  const count = trades.length;

  function change(next: Partial<ReportOptions>) {
    const merged = { ...options, ...next };
    setOptions(merged);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
  }
  const [generatedAt] = useState(() => Date.now());
  const now = () => generatedAt;
  const report = () => target.kind === "operacion"
    ? buildReport({ trades: [target.trade], journal, kind: "operacion",profile:"operacion", period: dayKey(target.trade.closedAt ?? target.trade.openedAt), account: journal.accounts.find((item) => item.id === target.trade.accountId)?.name ?? "Sin cuenta", assumedCurrency: "USD", now: now(), demo, options })
    : buildReport({ trades: target.trades, journal,profile,scope:target.scope,reviewKey:target.reviewKey,completeHistory:target.completeHistory, period: target.period, account: target.account, assumedCurrency: target.assumedCurrency, now: now(), demo, options });
  const stem = () => single ? tradeSheet(target.trade, journal, now(), options, demo).fileStem : report().fileStem;

  async function run(job: () => Promise<string | void> | string | void) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { const message = await job(); if (message) onToast(message); }
    catch (reason) { setError(errorText(reason)); }
    setBusy(false);
  }
  const outcomeText = (outcome: ShareOutcome, copied: string) =>
    outcome === "copied" ? copied : outcome === "downloaded" ? "Imagen descargada." : outcome === "shared" ? "Listo para compartir." : undefined;

  const pdf = () => run(async () => { await printDocument(reportHtml(report(), { fontUrl: window.location.origin + "/geist.woff2" })); });
  const xlsx = () => run(async () => { const {reportXlsx}=await import("@/lib/report-xlsx");downloadFile(`${stem()}.xlsx`, reportXlsx(report()).buffer as ArrayBuffer, XLSX_TYPE); return "Excel descargado."; });
  const csv = () => run(() => { downloadFile(`${stem()}.csv`, reportCsv(report()), "text/csv;charset=utf-8"); return "CSV descargado."; });
  const dataCsv = () => setBackupConfirm('csv');
  const json = () => setBackupConfirm('json');
  const downloadBackup = () => run(async()=>{if(backupConfirm==='csv'){downloadFile(`${stem()}_datos.csv`,exportTrades(trades,journal),'text/csv;charset=utf-8');setBackupConfirm(null);return 'CSV privado de las operaciones seleccionadas descargado.';}const full=loadBackup?await loadBackup():journal;downloadFile(`bitacora_respaldo_${dayKey(now())}.json`,backupJson(full,now()),'application/json');setBackupConfirm(null);return 'Respaldo JSON completo descargado.';});
  const image = () => run(async () => {
    const font = await fontCss();
    const svg = reportCardSvg(report(), font);
    const blob = await svgToPng(svg, 1,aspect);
    const file = new File([blob], `${stem()}.png`, { type: "image/png" });
    return outcomeText(await shareOrCopy({ title: "Bitácora de Trading", file }), "");
  });
  const text = () => run(async () => {
    const body = reportText(report());
    return outcomeText(await shareOrCopy({ title: "Bitácora de Trading", text: body }), "Texto copiado.");
  });

  const off = busy;
  return <><Modal title={single ? "Compartir operación" : "Compartir o exportar"} wide busy={busy} onClose={onClose}
    subtitle={single ? `${target.trade.asset}` : `${count} ${count === 1 ? "operación" : "operaciones"} · ${target.period} · ${target.account}`}
    footer={<Button onClick={onClose} disabled={busy}>Cerrar</Button>}>
    <HelpLink topic="reportes"/>
    {error && <p className="form-error" role="alert">{error}</p>}
    {single&&<div className="group-buttons" role="group" aria-label="Compartir o exportar esta operación"><Button disabled={busy} aria-pressed={operationFlow==='share'} onClick={()=>setOperationFlow('share')}>Compartir tarjeta</Button><Button disabled={busy} aria-pressed={operationFlow==='export'} onClick={()=>setOperationFlow('export')}>Exportar operación</Button></div>}
    {!single&&<div className="group-buttons export-flow-switch" role="group" aria-label="Elegir compartir, exportar o respaldar"><Button disabled={busy} aria-pressed={periodFlow==='share'} onClick={()=>setPeriodFlow('share')}>Compartir resumen</Button><Button disabled={busy} aria-pressed={periodFlow==='export'} onClick={()=>setPeriodFlow('export')}>Exportar reporte</Button><Button disabled={busy} aria-pressed={periodFlow==='backup'} onClick={()=>setPeriodFlow('backup')}>Respaldar datos</Button></div>}
    {!single&&periodFlow==='backup'&&<section aria-label="Respaldos privados"><h3>Respaldos privados</h3><p>Estos archivos contienen datos sin ocultar. Las opciones de tarjetas y reportes no los limitan. El CSV incluye las operaciones que cumplen los filtros; el JSON recupera todo el historial, cuentas, estrategias, plan y revisiones. No incluyen imágenes ni enlaces públicos.</p><div className="export-grid"><Item icon={<FileText size={19}/>} title="CSV privado para importar" description="Datos sin ocultar de las operaciones seleccionadas." onClick={dataCsv} disabled={busy}/><Item icon={<FileJson size={19}/>} title="JSON completo" description="Copia completa obtenida del servidor; no solo la página visible." onClick={json} disabled={busy}/></div><p>Catálogo: usa su respaldo en Configuración. Scripts: Herramientas → Mis scripts → Exportar scripts cifrados; conserva su clave o recuperación aparte. El respaldo operacional D1/R2 es un procedimiento administrativo separado.</p></section>}
    {target.kind==='operacion'&&<div hidden={operationFlow!=='share'}><TradeSharePanel trade={target.trade} journal={journal} now={generatedAt} demo={demo} busy={busy} run={run}/></div>}
    {((!single&&periodFlow!=='backup')||(single&&operationFlow==='export'))&&<>
    {!single&&<Field label="Perfil del reporte"><select value={profile} onChange={e=>setProfile(e.target.value as ReportProfile)}>{Object.entries(REPORT_PROFILES).filter(([key])=>key!=="operacion"&&(!["semanal","mensual"].includes(key)||key===target.profile)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>}
    <fieldset className="export-options">
      <legend>Qué incluir</legend>
      <label><input type="checkbox" checked={options.money} onChange={(event) => change({ money: event.target.checked })}/><span><strong>Importes en dinero</strong><small>P&amp;L, comisiones y riesgo en dinero. Apagado: solo R.</small></span></label>
      <label><input type="checkbox" checked={options.notes} onChange={(event) => change({ notes: event.target.checked })}/><span><strong>Notas y emociones</strong><small>Emociones, calificación, errores y comentarios.</small></span></label>
      <label><input type="checkbox" checked={options.capital===true} onChange={e=>change({capital:e.target.checked})}/><span><strong>Capital inicial</strong><small>Solo en Cuentas y si también habilitas importes.</small></span></label>
      {([["account","Nombre de cuenta"],["strategies","Estrategias y setups"],["captures","Enlaces de capturas"],["prices","Precios de entrada, stop y salida"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={options[key]===true} onChange={e=>change({[key]:e.target.checked})}/><span><strong>{label}</strong></span></label>)}
      <p className="muted">Los perfiles usan la misma selección de datos. El capital está oculto por defecto. Los respaldos privados no aplican estas opciones.</p>
    </fieldset>
    <div className="form-grid">{!single&&<Field label="Formato de imagen"><select value={aspect} onChange={e=>setAspect(e.target.value as ImageAspect)}><option value="1:1">1:1 · Cuadrado</option><option value="4:5">4:5 · Publicación</option><option value="9:16">9:16 · Historia</option></select></Field>}<Button onClick={()=>setPreview(!preview)} aria-expanded={preview}>{preview?"Ocultar vista previa":"Ver vista previa de texto"}</Button></div>
    {preview&&<><iframe title="Vista previa del reporte A4" sandbox="" srcDoc={reportHtml(report())} style={{width:"100%",height:480,border:0}}/><pre className="v2-export-preview">{reportText(report())}</pre></>}
    {!single&&periodFlow==='share'&&<div className="export-group"><h3>Compartir</h3><div className="export-grid">
      <Item icon={<ImageIcon size={19}/>} title="Imagen PNG" description="Tarjeta con el diseño de la app, lista para WhatsApp o redes." onClick={image} disabled={off}/>
      <Item icon={<Copy size={19}/>} title="Texto" description="Resumen para pegar en un mensaje (se copia si no se puede compartir)." onClick={text} disabled={off}/>
    </div></div>}
    {(single||periodFlow==='export')&&<details className="export-downloads"><summary>Descargar reportes</summary><div className="export-group"><h3>Reporte con diseño</h3><div className="export-grid">
      <Item icon={<Printer size={19}/>} title="PDF" description="Se abre la impresión: elige «Guardar como PDF». Mejor desde el computador." onClick={pdf} disabled={off}/>
      <Item icon={<FileSpreadsheet size={19}/>} title="Excel (.xlsx)" description="Indicadores y hojas específicas del perfil, con valores numéricos." onClick={xlsx} disabled={off}/>
      <Item icon={<Table2 size={19}/>} title="CSV ordenado" description="Mismas secciones en texto, en columnas alineadas para abrir en Excel." onClick={csv} disabled={off}/>
    </div></div>
    </details>}
    </>}
  </Modal>{backupConfirm&&<Modal title="Confirmar respaldo privado" busy={busy} onClose={()=>setBackupConfirm(null)} footer={<><Button disabled={busy} onClick={()=>setBackupConfirm(null)}>Cancelar</Button><Button tone="primary" disabled={busy} onClick={()=>void downloadBackup()}>Descargar respaldo privado</Button></>}><p>{backupConfirm==='csv'?'El CSV contiene todos los datos de las operaciones seleccionadas por los filtros, sin aplicar ocultación.':'El JSON contiene todo el historial y la configuración privada de la bitácora, sin aplicar ocultación. No se limita al periodo o página visibles.'} Guárdalo en un lugar privado; no lo publiques ni lo compartas como reporte.</p>{error&&<p role="alert">{error}</p>}</Modal>}</>;
}
