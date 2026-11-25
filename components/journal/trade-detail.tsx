"use client";

import { useState } from "react";
import {partialProgress} from "@/lib/partial-progress.mjs";
import {rLabel} from "@/lib/journal";
import { Pencil, Share2, Trash2 } from "lucide-react";
import { captureLinkSchema, averageExit, currencyOf, dateLabel, estimatedRatio, formatMoney, numberText, outcome, priceText, resultR, SLOTS, timeLabel, type Journal, type Slot, type Trade } from "@/lib/journal";
import { Button, Field, Modal, Result, resultName, SetupTag, TradeSide } from "./ui";
import { errorText, type Save } from "./trade-editor";
import {CaptureCompare} from "./capture-compare";
import {recordCompleteness} from "@/lib/capture-comparison";
import {CapturePreview} from "./capture-preview";

function captureUrl(tradeId: string, slot: Slot, rev?: string) {
  return `/api/capturas?trade=${tradeId}&slot=${slot}${rev ? "&v=" + rev : ""}`;
}

export function TradeDetail({ trade, journal, demo, save, onClose, onShare, onEdit,captureDemoImages }: {
  trade: Trade; journal: Journal; demo: boolean; save: Save; onClose: () => void; onShare: () => void; onEdit: (close?: boolean) => void;captureDemoImages?:{before:string;after:string};
}) {
  const captures = journal.captures.filter((capture) => capture.tradeId === trade.id);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [draftLink, setDraftLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing,setRemoving]=useState<Slot|null>(null);
  const completeness=recordCompleteness(trade,captures.length>0);
  const currency = currencyOf(trade, journal.accounts);
  const account = journal.accounts.find((item) => item.id === trade.accountId);
  const setup = journal.setups.find((item) => item.id === trade.setupId);
  const planRatio = estimatedRatio(trade);
  const progress=partialProgress(trade.entry,trade.stop,trade.currentStop,trade.direction,trade.partials);
  const weightedExit = trade.closedAt === null ? progress?.average??null : averageExit(trade);
  const partialCash=trade.partials.filter(p=>p.pnlCents!=null);
  const when = (value: number) => dateLabel(value) + " · " + timeLabel(value);
  async function changeLink(slot: Slot, value?: string) {
    if (value !== undefined) {
      const validation = captureLinkSchema.safeParse(value);
      if (!validation.success) { setError(validation.error.issues[0].message); return; }
    }
    setBusy(true);
    setError("");
    const captureLinks = { ...trade.captureLinks };
    if (value === undefined) delete captureLinks[slot];
    else captureLinks[slot] = value;
    try {
      await save({ action: "saveTrade", id: trade.id, version: trade.version, trade: { ...trade, captureLinks } }, "Enlace actualizado.");
      setEditing(null);
      return true;
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function removeTrade() {
    setBusy(true);
    try {
      await save({ action: "deleteTrade", id: trade.id, version: trade.version }, "Operación eliminada.");
      onClose();
    } catch (reason) {
      setError(errorText(reason));
      setBusy(false);
    }
  }

  return <Modal title={trade.asset} subtitle={`${when(trade.openedAt)} EC · ${account?.name ?? "Sin cuenta"}`} onClose={onClose} busy={busy} wide presentation="sheet" protectDraft={editing !== null||removing!==null}
    footer={demo ? <><Button onClick={onShare}><Share2 size={15}/>Compartir</Button><Button onClick={onClose}>Cerrar</Button></> : confirmDelete ?
      <><span className="muted confirm-copy">Se eliminarán la operación y sus capturas.</span><Button onClick={() => setConfirmDelete(false)} disabled={busy || editing !== null || removing!==null}>Cancelar</Button><Button tone="danger" onClick={removeTrade} disabled={busy || editing !== null || removing!==null}>Eliminar operación</Button></> :
      <><Button tone="quiet" className="delete-action" onClick={() => setConfirmDelete(true)} disabled={busy || editing !== null || removing!==null}><Trash2 size={15}/>Eliminar</Button><Button onClick={onShare} disabled={busy || editing !== null || removing!==null}><Share2 size={15}/>Compartir</Button><Button onClick={() => onEdit()} disabled={busy || editing !== null || removing!==null}><Pencil size={15}/>Editar</Button>
        {trade.closedAt === null && <Button tone="primary" onClick={() => onEdit(true)} disabled={busy || editing !== null || removing!==null}>Cerrar operación</Button>}</>}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="detail-top">
      <div className="tag-row"><TradeSide direction={trade.direction}/><SetupTag setup={setup}/><span className="tag">{resultName[outcome(trade)]}</span></div>
      <div className="detail-result"><span>P&L neto <Result value={trade.pnlCents} unit="money" currency={currency}/></span><span>Resultado <Result value={resultR(trade)} unit="r"/></span></div>
    </div>
    <section className="record-completeness"><div className="split"><strong>Completitud del registro</strong><span>{completeness.percent}%</span></div><progress aria-label="Completitud del registro" value={completeness.percent} max={100}/><p>Campos documentados; no mide calidad, rentabilidad ni recomienda operar.</p><details><summary>Revisar campos</summary>{completeness.checks.map(c=><p key={c.label}>{c.complete?"Completo":"Pendiente"} · {c.label}</p>)}</details></section><dl className="detail-values">
      {([
        ["Activo estadístico",trade.market?.name??"Sin asociar"],["Símbolo original",trade.asset],["Entrada", priceText(trade.entry)], ["Stop inicial", priceText(trade.stop)], ["Stop actual",priceText(trade.currentStop??null)],["Cambio de stop",trade.stopChangedAt?when(trade.stopChangedAt):"—"], ["Objetivo", priceText(trade.target)],
        ["Salida final", priceText(trade.exit)], ["Tamaño", priceText(trade.size)], ["R:B planeado", planRatio === null ? "—" : "1:" + numberText(planRatio)],
        ["Riesgo inicial", trade.riskCents === null ? (trade.riskPercent === null ? "—" : numberText(trade.riskPercent) + "%") : formatMoney(trade.riskCents, currency, false)],
        ["Comisiones", trade.feesCents === null ? "—" : formatMoney(trade.feesCents, currency, false)],
        ["Fecha de salida", trade.closedAt === null ? "—" : when(trade.closedAt)],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {trade.closedAt===null&&progress&&<section className="detail-section"><h3>Gestión de posición abierta</h3><dl className="detail-values"><div><dt>Posición restante</dt><dd>{numberText(progress.remaining)} %</dd></div><div><dt>R realizado por precio (estimado)</dt><dd>{rLabel(progress.realizedR)}</dd></div><div><dt>Resultado del resto si ejecuta el stop (estimado)</dt><dd>{rLabel(progress.stopR)}</dd></div></dl><small>No incluye comisiones ni deslizamiento. Un stop en entrada no garantiza una salida sin pérdidas.</small></section>}
    {trade.partials.length > 0 && <section className="detail-section"><h3>Salidas parciales {weightedExit !== null && <small>· Promedio ponderado {priceText(weightedExit)}</small>}</h3><div className="tag-row">
      {trade.partials.map((item, index) => <span key={index} className="tag">{numberText(item.percent)}% en {priceText(item.price)}{item.at?` · ${when(item.at)}`:""}{item.pnlCents!=null?` · ${formatMoney(item.pnlCents,currency)}`:""}</span>)}
    </div>{partialCash.length>0&&<p>Resultado monetario de parciales registrados: {formatMoney(partialCash.reduce((sum,p)=>sum+(p.pnlCents??0),0),currency)} · {partialCash.length}/{trade.partials.length} con importe. No se suma al P&L final.</p>}</section>}
    {trade.setupSnapshot&&<section className="detail-section"><h3>Estrategia al registrar · versión {trade.setupSnapshot.version}</h3><p>{trade.setupSnapshot.name}</p><p className="muted">{trade.setupSnapshot.description}</p><div className="note-content"><p>{trade.setupSnapshot.rules}</p>{trade.setupSnapshot.riskRules&&<p>{trade.setupSnapshot.riskRules}</p>}</div></section>}
    <section className="detail-section"><h3>Emociones</h3><div className="emotion-timeline">
      {([["Antes", trade.before], ["Durante", trade.during], ["Después", trade.after]] as const).map(([label, value]) =>
        <div key={label}><small>{label}</small><strong>{value?.name ?? "—"}</strong>{value && <span className="muted">Intensidad {value.intensity}/5</span>}</div>)}
    </div></section>
    {(trade.checklist.length > 0 || trade.errors.length > 0 || trade.notes.length > 0 || trade.grade !== null) && <section className="detail-section">
      <div className="split"><h3>Diario de ejecución</h3>{trade.grade !== null && <span className="tag">{trade.grade} / 5</span>}</div>
      {trade.errors.length > 0 && <div className="tag-row">{trade.errors.map((value) => <span className="tag tag-rosa" key={value}>{value}</span>)}</div>}
      {trade.checklist.length > 0 && <ul className="detail-checklist">{trade.checklist.map((item, index) => <li key={index}><input type="checkbox" disabled checked={item.checked}/>{item.text}</li>)}</ul>}
      <div className="note-content">{trade.notes.map((note, index) => note.kind === "heading" ? <h4 key={index}>{note.text}</h4> : <p key={index}>{note.kind === "check" && <input type="checkbox" aria-label="Nota de lista" checked={note.checked} disabled/>}{note.text}</p>)}</div>
    </section>}
    <section className="detail-section"><h3>Capturas del gráfico</h3><CaptureCompare asset={trade.asset} before={{link:trade.captureLinks?.before,privateImage:captures.some(c=>c.slot==="before")?captureUrl(trade.id,"before",captures.find(c=>c.slot==="before")?.revision):undefined}} after={{link:trade.captureLinks?.after,privateImage:captures.some(c=>c.slot==="after")?captureUrl(trade.id,"after",captures.find(c=>c.slot==="after")?.revision):undefined}} demoImages={captureDemoImages}/><div className="capture-grid">
      {SLOTS.map((slot) => {
        const title = slot === "before" ? "Entrada" : "Salida";
        const capture = captures.find((item) => item.slot === slot);
        const link = trade.captureLinks?.[slot];
        return <div className="capture" key={slot}>
          <strong>{title}</strong>
          <CapturePreview link={link} privateImage={capture?captureUrl(trade.id,slot,capture.revision):undefined} title={title} asset={trade.asset}/>
          {capture && link && <a className="button button-quiet" href={captureUrl(trade.id, slot, capture.revision)} target="_blank" rel="noopener noreferrer">Ver captura anterior</a>}
          {!demo && (editing === slot ? <div>
            <Field label={`Pegar enlace de TradingView · ${title}`}><input type="url" maxLength={300} value={draftLink} disabled={busy} onChange={(event) => setDraftLink(event.target.value)}/></Field>
            <div className="group-buttons"><Button disabled={busy} onClick={() => changeLink(slot, draftLink)}>Guardar enlace</Button><Button disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button></div>
          </div> : <div className="group-buttons">
            <Button disabled={busy || editing !== null || removing!==null} onClick={() => { setEditing(slot); setDraftLink(link ?? ""); setError(""); }}>{link ? "Editar enlace" : capture ? "Reemplazar por enlace" : "Agregar enlace"}</Button>
            {link && (removing===slot?<div className="capture-undo" role="status"><p>Quitar enlace: cambio pendiente de guardar.</p><Button disabled={busy} onClick={()=>setRemoving(null)}>Deshacer</Button><Button tone="danger" disabled={busy} onClick={async()=>{if(await changeLink(slot))setRemoving(null);}}>Guardar eliminación</Button></div>:<Button data-edit-action disabled={busy||editing!==null} onClick={()=>setRemoving(slot)}>Quitar enlace</Button>)}
          </div>)}
        </div>;
      })}
    </div><small>Una captura compartida es accesible para quien tenga su enlace. Las capturas anteriores se conservan.</small></section>
  </Modal>;
}
