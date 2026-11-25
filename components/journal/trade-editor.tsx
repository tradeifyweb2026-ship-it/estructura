"use client";
import {HelpLink} from "./help-center";
import {AssetPicker} from "./asset-picker";
import {marketSnapshot} from "@/lib/asset-catalog";
import {CapturePairFields} from "./capture-pair-fields";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { RestoreResult } from "@/lib/restore-types";
import {draftKey,parseDraft,type EditorDraft} from "@/lib/editor-draft";
import { ArrowRight, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { dateInput, EMOTIONS, ERRORS, estimatedRatio, inputDate, numberText, toCents, tradeSchema, type Account, type Setup, type Currency, type Emotion, type Journal, type JournalAction, type Note, type Scope, type Trade } from "@/lib/journal";
import { Button, Field, Modal, ModalClose } from "./ui";

export type Save = (action: JournalAction, message: string) => Promise<{ id?: string; imported?: number; skipped?: number; records?: RestoreResult["records"]; account?:Account; setup?:Setup; version?: number; trade?:Trade }>;
export const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la acción.";

type Step = "entry" | "close" | "review";
const tabs = [["entry", "Entrada"], ["close", "Cierre"], ["review", "Diario"]] as const;

function nullableNumber(raw: FormDataEntryValue | null) {
  return typeof raw === "string" && raw.trim() ? Number(raw.trim().replace(",", ".")) : null;
}

function EmotionInput({ stage, label, current }: { stage: string; label: string; current?: Emotion | null }) {
  const [selected, setSelected] = useState(current?.name ?? "");
  return <div className="emotion-input">
    <Field label={label}><select name={stage} value={selected} onChange={(event) => setSelected(event.target.value as Emotion["name"] | "")}>
      <option value="">Sin registrar</option>{EMOTIONS.map((name) => <option key={name}>{name}</option>)}
    </select></Field>
    <Field label="Intensidad (1–5)"><select name={stage + "_intensity"} defaultValue={current?.intensity ?? 3} disabled={!selected}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></Field>
  </div>;
}

type DraftNote = Note & { key: number };
type PartialRow = { key: number; price: string; percent: string; at?:string; pnl?:string };
function NoteEditor({ notes, onChange, nextId }: { notes: DraftNote[]; onChange: (notes: DraftNote[]) => void; nextId: () => number }) {
  return <div className="note-editor">
    {notes.map((note) => <div className="note-row" key={note.key}>
      {note.kind === "check" && <input type="checkbox" aria-label="Marcar nota de lista" checked={note.checked} onChange={(event) => onChange(notes.map((item) => item.key === note.key ? { ...item, checked: event.target.checked } : item))}/>}
      <textarea rows={note.kind === "text" ? 3 : 1} aria-label={note.kind === "heading" ? "Título de nota" : "Texto de nota"} value={note.text} maxLength={2500}
        placeholder={note.kind === "heading" ? "Título" : note.kind === "check" ? "Tarea o punto a revisar" : "Motivo de entrada, aprendizaje o comentario"}
        onChange={(event) => onChange(notes.map((item) => item.key === note.key ? { ...item, text: event.target.value } : item))}/>
      <Button className="icon-button" aria-label="Quitar bloque" tone="quiet" onClick={() => onChange(notes.filter((item) => item.key !== note.key))}><Trash2 size={15}/></Button>
    </div>)}
    {notes.length < 30 && <div className="group-buttons">{([["text", "Texto"], ["heading", "Título"], ["check", "Lista"]] as const).map(([kind, label]) => (
      <Button key={kind} tone="quiet" onClick={() => onChange([...notes, { key: nextId(), kind, text: "", checked: false }])}><Plus size={13}/>{label}</Button>
    ))}</div>}
  </div>;
}

export function TradeEditor({ draftOwner,trade, initialStep, journal, scope, save, onClose, onSaved }: {
  draftOwner?:string; trade?: Trade; initialStep?: Step; journal: Journal; scope: Scope; save: Save; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [market,setMarket]=useState(trade?.market??null);
  const [step, setStep] = useState<Step>(initialStep ?? "entry");
  const [accountId, setAccountId] = useState(() => trade ? trade.accountId ?? "" :
    journal.accounts.find((account) => !account.archived && account.id === scope)?.id ??
    (scope === "unassigned" ? "" : journal.accounts.find((account) => !account.archived)?.id ?? ""));
  const [closed, setClosed] = useState(initialStep === "close" || Boolean(trade?.closedAt));
  const [direction, setDirection] = useState<Trade["direction"]>(trade?.direction ?? "long");
  const [entry, setEntry] = useState(String(trade?.entry ?? ""));
  const [stop, setStop] = useState(String(trade?.stop ?? ""));
  const [target, setTarget] = useState(String(trade?.target ?? ""));
  const [checklist, setChecklist] = useState(() => trade?.checklist ?? journal.plan.rules.map((text) => ({ text, checked: false })));
  const [partials, setPartials] = useState<PartialRow[]>(() => (trade?.partials ?? []).map((fill, key) => ({ key, price: String(fill.price), percent: String(fill.percent),at:fill.at?dateInput(fill.at):"",pnl:fill.pnlCents==null?"":String(fill.pnlCents/100) })));
  const [notes, setNotes] = useState<DraftNote[]>(() => trade?.notes.length ? trade.notes.map((note, key) => ({ ...note, key })) : [{ key: 0, kind: "text", text: "", checked: false }]);
  const formRef=useRef<HTMLFormElement>(null);
  const [storedDraft,setStoredDraft]=useState<EditorDraft|null>(null);
  const [draftMessage,setDraftMessage]=useState("");
  const [restored,setRestored]=useState<EditorDraft|null>(null);
  const autoTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const draftWriter=useRef<()=>void>(()=>{});
  const unresolved=useRef(true);
  const saving=useRef(false);
  const storageKey=draftOwner?draftKey(draftOwner,trade?.id):null;
  useEffect(()=>{
    const timer=setTimeout(()=>{
      try{const saved=storageKey?parseDraft(sessionStorage.getItem(storageKey)):null;setStoredDraft(saved);unresolved.current=!!saved;}catch{unresolved.current=false;}
    },0);
    return ()=>clearTimeout(timer);
  },[storageKey]);
  function saveDraft(automatic=false){
    if(automatic&&(unresolved.current||saving.current))return;
    unresolved.current=false;
    if(!formRef.current||!storageKey)return;
    const fields:Record<string,string[]>={};
    for(const [key,value] of new FormData(formRef.current)){
      if(typeof value==="string")(fields[key]??=[]).push(value);
    }
    const draft:EditorDraft={version:trade?.version??null,step,fields,accountId,closed,direction,entry,stop,target,checklist,partials,notes,savedAt:Date.now()};
    try{sessionStorage.setItem(storageKey,JSON.stringify(draft));setStoredDraft(draft);if(!automatic)setDraftMessage("Borrador guardado en esta pestaña. Puedes recuperarlo al recargar.");}
    catch{setDraftMessage("No se pudo guardar el borrador en este dispositivo.");}
  }
  useLayoutEffect(()=>{draftWriter.current=()=>saveDraft(true)});
  useEffect(()=>()=>{if(autoTimer.current!==null)clearTimeout(autoTimer.current)},[]);
  function queueDraft(){if(!storageKey)return;if(autoTimer.current!==null)clearTimeout(autoTimer.current);autoTimer.current=setTimeout(()=>draftWriter.current(),300);}
  function removeDraft(){
    if(autoTimer.current!==null)clearTimeout(autoTimer.current);
    unresolved.current=false;
    try{if(storageKey)sessionStorage.removeItem(storageKey);}catch{}
    setStoredDraft(null);
  }
  function restoreDraft(){
    if(!storedDraft)return;
    if(storedDraft.version!==(trade?.version??null)){showError("La operación cambió desde que guardaste el borrador. Revisa la versión actual antes de editar.");return;}
    unresolved.current=false;
    setStep(storedDraft.step);setAccountId(storedDraft.accountId);setClosed(storedDraft.closed);setDirection(storedDraft.direction);
    setEntry(storedDraft.entry);setStop(storedDraft.stop);setTarget(storedDraft.target);
    if(storedDraft.fields.market){try{const raw=storedDraft.fields.market[0];setMarket(raw?marketSnapshot.parse(JSON.parse(raw)):null);}catch{showError("El activo estadístico del borrador no es válido. Revisa tu catálogo.");return;}}
    setChecklist(storedDraft.checklist);setPartials(storedDraft.partials);setNotes(storedDraft.notes);setRestored(storedDraft);
    nextKey.current=Math.max(100,...storedDraft.notes.map(v=>v.key),...storedDraft.partials.map(v=>v.key))+1;
    window.requestAnimationFrame(()=>{
      for(const element of formRef.current?.querySelectorAll<HTMLElement>("input[name],select[name]")??[]){
        const name=element.getAttribute("name")??"";
        if(!Object.hasOwn(storedDraft.fields,name)&&["currentStop","stopChangedAt","captureBefore","captureAfter"].includes(name))continue;
        const values=storedDraft.fields[name]??[];
        if(element instanceof HTMLInputElement && element.type==="checkbox")element.checked=values.includes(element.value);
        else (element as HTMLElement & {value:string}).value=values[0]??"";
      }
      setDraftMessage("Borrador restaurado. Revisa los campos antes de guardar la operación.");
    });
  }
  const draftEmotion=(stage:string):Emotion|null|undefined=>{
    if(!restored)return undefined;
    const name=restored.fields[stage]?.[0] as Emotion["name"]|undefined;
    return name?{name,intensity:Number(restored.fields[stage+"_intensity"]?.[0]??3)}:null;
  };
  const nextKey = useRef(100);
  const allocateKey=()=>{const value=nextKey.current;nextKey.current=value+1;return value;};
  const id = useRef(trade?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const showError = (message: string) => {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  };
  const [defaultsNow] = useState(() => dateInput(Date.now()));
  const ratio = estimatedRatio({ direction, entry: nullableNumber(entry), stop: nullableNumber(stop), target: nullableNumber(target) });
  const currency: Currency = journal.accounts.find((account) => account.id === accountId)?.currency ?? "USD";
  const amount = (value: number | null | undefined) => value == null ? "" : value / 100;
  const next = () => setStep(step === "entry" ? "close" : "review");
  const partialPercentage = partials.reduce((total, fill) => total + (nullableNumber(fill.percent) ?? 0), 0);

  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    const numeric = (key: string) => nullableNumber(data.get(key));
    const cash = (key: string) => { const value = numeric(key); return value === null ? null : toCents(value); };
    const emotion = (key: string) => get(key) ? { name: get(key), intensity: numeric(key + "_intensity") ?? 3 } : null;
    const openedValue = get("openedAt");
    const closedValue = get("closedAt");
    const openedAt = trade && dateInput(trade.openedAt) === openedValue ? trade.openedAt : inputDate(openedValue);
    const closedAt = !closed ? null : trade?.closedAt && dateInput(trade.closedAt) === closedValue ? trade.closedAt : inputDate(closedValue);
    const validation = tradeSchema.safeParse({
      market,
      captureLinks: { ...(get("captureBefore").trim()?{before:get("captureBefore").trim()}:{}), ...(get("captureAfter").trim()?{after:get("captureAfter").trim()}:{}) },
      asset: get("asset"), accountId: accountId || null, setupId: get("setup") || null, direction, openedAt, closedAt,
      entry: nullableNumber(entry), stop: nullableNumber(stop), currentStop:numeric("currentStop"),stopChangedAt:get("stopChangedAt")?inputDate(get("stopChangedAt")):null, target: nullableNumber(target), size: numeric("size"),
      riskCents: cash("riskCents"), riskPercent: numeric("riskPercent"),
      exit: closed ? numeric("exit") : null, pnlCents: closed ? cash("pnlCents") : null, feesCents: closed ? cash("feesCents") : null,
      partials: partials.filter((fill) => fill.price || fill.percent || fill.at || fill.pnl).map((fill) => ({ price: nullableNumber(fill.price), percent: nullableNumber(fill.percent),at:fill.at?inputDate(fill.at):null,pnlCents:fill.pnl?.trim()?toCents(nullableNumber(fill.pnl)??NaN):null })),
      before: emotion("before"), during: emotion("during"), after: emotion("after"),
      grade: numeric("grade"), errors: data.getAll("errors"), checklist,
      notes: notes.filter((note) => note.text.trim()).map(({ kind, text, checked }) => ({ kind, text, checked })),
    });
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const field = String(issue.path[0]);
      const labels: Record<string, string> = { asset: "activo", openedAt: "fecha de entrada", closedAt: "fecha de salida", entry: "entrada", stop: "stop loss", target: "take profit",
        riskPercent: "riesgo (%)", riskCents: "riesgo monetario", exit: "precio de salida", pnlCents: "P&L neto", feesCents: "comisiones", partials: "cierres parciales", size: "tamaño", notes: "notas", currentStop:"stop actual",stopChangedAt:"fecha de modificación del stop",captureLinks:"enlaces de captura" };
      setStep(["exit", "closedAt", "pnlCents", "feesCents", "partials","currentStop","stopChangedAt"].includes(field) ? "close" : ["notes","captureLinks"].includes(field) ? "review" : "entry");
      window.requestAnimationFrame(()=>{
        for(const element of formRef.current?.querySelectorAll<HTMLElement>("[aria-invalid]")??[])element.removeAttribute("aria-invalid");
        const name=field==="setupId"?"setup":field;
        const element=formRef.current?.elements.namedItem(name);
        if(element instanceof HTMLElement){element.setAttribute("aria-invalid","true");element.setAttribute("aria-describedby","trade-error");}
      });
      showError(issue.code === "custom" ? issue.message : `Revisa el campo «${labels[field] ?? field}» y su valor.`);
      return;
    }
    saving.current=true;
    if(autoTimer.current!==null)clearTimeout(autoTimer.current);
    setBusy(true);
    setError("");
    id.current ??= crypto.randomUUID();
    try {
      await save({ action: "saveTrade", id: id.current, version: trade?.version ?? null, trade: validation.data }, trade ? "Operación actualizada." : "Operación guardada.");
      removeDraft();
      onSaved(id.current);
    } catch (reason) {
      saving.current=false;
      saveDraft(true);
      showError(errorText(reason));
      setBusy(false);
    }
  }

  return <Modal title={trade ? (initialStep === "close" ? "Cerrar operación" : "Editar operación") : "Nueva operación"}
    presentation="page" subtitle="Fechas y horas de Ecuador continental (UTC−5)" onClose={onClose} busy={busy} wide protectDraft
    footer={<><ModalClose disabled={busy}>Cancelar</ModalClose>{step !== "review" && <Button onClick={next} disabled={busy}>Siguiente <ArrowRight size={15}/></Button>}
      <Button type="submit" form="trade-form" tone="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar operación"}</Button></>}>
    <HelpLink topic="registro"/>
    {storageKey&&<div className="draft-actions"><Button disabled={busy} onClick={()=>saveDraft()}>Guardar borrador</Button>{storedDraft&&<><Button data-edit-action disabled={busy} onClick={restoreDraft}>Recuperar borrador</Button><Button disabled={busy} tone="quiet" onClick={()=>{removeDraft();setDraftMessage("Borrador eliminado.");}}>Quitar borrador</Button></>}<small>Autoguardado en esta pestaña al editar. Si hay un borrador anterior, recupéralo o elimínalo primero. Se borra al guardar la operación.</small></div>}
    {draftMessage&&<p className="informative-note" role="status">{draftMessage}</p>}
    <p className="editor-section-count">Registro en tres secciones · {tabs.find(t=>t[0]===step)?.[1]}</p><div className="editor-tabs" aria-label="Secciones del registro">{tabs.map(([key, label]) =>
      <button type="button" key={key} aria-pressed={step === key} onClick={() => setStep(key)}>{label}</button>)}</div>
    {error && <p id="trade-error" className="form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
    <form ref={formRef} id="trade-form" className="editor-form" onSubmit={saveForm} onChange={queueDraft} noValidate>
      <section className="form-block" hidden={step !== "entry"}>
        <AssetPicker enabled={!!draftOwner} value={market} onPick={(value,asset)=>{setMarket(value);const input=formRef.current?.elements.namedItem("asset");if(input instanceof HTMLInputElement&&!input.value&&asset?.aliases.length)input.value=asset.aliases[0];queueDraft();}}/>
        <div className="form-grid">
          <Field label="Activo"><input name="asset" maxLength={24} defaultValue={trade?.asset ?? journal.trades.find(t=>t.accountId===(accountId||null))?.asset ?? ""} placeholder="US100"/></Field>
          <Field label="Dirección"><select value={direction} onChange={(event) => setDirection(event.target.value as Trade["direction"])}><option value="long">Compra / Long</option><option value="short">Venta / Short</option></select></Field>
          <Field label="Cuenta"><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Sin cuenta · USD</option>
            {journal.accounts.filter((item) => !item.archived || item.id === trade?.accountId).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}
          </select></Field>
          <Field label="Setup"><select name="setup" defaultValue={trade?.setupId ?? ""}><option value="">Sin setup</option>
            {journal.setups.filter((item) => !item.archived || item.id === trade?.setupId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></Field>
          <Field label="Fecha de entrada"><input type="datetime-local" name="openedAt" defaultValue={trade ? dateInput(trade.openedAt) : defaultsNow}/></Field>
          <Field label="Tamaño de la posición"><input type="number" name="size" step="any" min="0" defaultValue={trade?.size ?? ""} placeholder="Lotes, contratos o unidades"/></Field>
          <Field label="Precio de entrada"><input type="number" step="any" name="entry" value={entry} onChange={(event) => setEntry(event.target.value)}/></Field>
          <Field label="Stop loss inicial"><input type="number" step="any" name="stop" value={stop} onChange={(event) => setStop(event.target.value)}/></Field>
          <Field label="Take profit"><input type="number" step="any" name="target" value={target} onChange={(event) => setTarget(event.target.value)}/></Field>
          <Field label="Riesgo (%)"><input type="number" step="any" name="riskPercent" defaultValue={trade ? trade.riskPercent ?? "" : journal.plan.riskPercent ?? ""}/></Field>
          <Field label={`Riesgo inicial (${currency})`}><input type="number" step="0.01" name="riskCents" defaultValue={amount(trade?.riskCents)}/></Field>
          <div className="ratio-display"><small>Riesgo / beneficio estimado</small><strong>{ratio === null ? "—" : "1:" + numberText(ratio)}</strong>{ratio !== null && ratio < 1 && <small>Por debajo de 1:1</small>}</div>
        </div>
        <EmotionInput key={"before"+(restored?.savedAt??"")} stage="before" label="Emoción antes de entrar" current={restored?draftEmotion("before"):trade?.before}/>
        {checklist.length > 0 && <fieldset className="checks"><legend><ClipboardCheck size={15}/>Checklist previo</legend>{checklist.map((item, index) =>
          <label key={index}><input type="checkbox" checked={item.checked} onChange={(event) => setChecklist(checklist.map((rule, i) => i === index ? { ...rule, checked: event.target.checked } : rule))}/>{item.text}</label>
        )}</fieldset>}
      </section>
      <section className="form-block" hidden={step !== "close"}>
        <Field label="Estado"><select value={closed ? "closed" : "open"} onChange={(event) => setClosed(event.target.value === "closed")}><option value="open">Abierta</option><option value="closed">Cerrada</option></select></Field>
        <div className="form-grid" hidden={!closed}>
          <Field label="Fecha de salida"><input name="closedAt" type="datetime-local" defaultValue={trade?.closedAt ? dateInput(trade.closedAt) : defaultsNow}/></Field>
          <Field label="Precio de salida final"><input type="number" name="exit" step="any" defaultValue={trade?.exit ?? ""}/></Field>
          <Field label={`P&L neto (${currency})`} hint="Introduce el resultado final del bróker, con comisiones incluidas."><input type="number" name="pnlCents" step=".01" defaultValue={amount(trade?.pnlCents)}/></Field>
          <Field label={`Comisiones (${currency})`}><input type="number" name="feesCents" step=".01" min="0" defaultValue={amount(trade?.feesCents)}/></Field>
        </div>
        <div className="form-grid"><Field label="Stop actual (opcional)" hint="No modifica el stop inicial ni el cálculo de R."><input name="currentStop" type="number" step="any" min="0" defaultValue={trade?.currentStop??""}/></Field><Field label="Fecha de cambio del stop (opcional)"><input name="stopChangedAt" type="datetime-local" defaultValue={trade?.stopChangedAt?dateInput(trade.stopChangedAt):""}/></Field></div>
        <div className="partial-editor"><div className="split"><h3>Cierres parciales</h3><span className="tag">{numberText(partialPercentage)}% cerrado · {numberText(Math.max(0,100-partialPercentage))}% restante</span></div>
          {partials.map((fill) => {
            const change = (field: "price" | "percent" | "at" | "pnl", value: string) => setPartials(partials.map((item) => item.key === fill.key ? { ...item, [field]: value } : item));
            return <div className="partial-row" key={fill.key}>
              <Field label="Precio parcial"><input type="number" step="any" value={fill.price} onChange={(event) => change("price", event.target.value)}/></Field>
              <Field label="% de la posición inicial"><input type="number" step="any" value={fill.percent} onChange={(event) => change("percent", event.target.value)}/></Field>
              <Field label="Fecha del parcial (opcional)"><input type="datetime-local" value={fill.at??""} onChange={event=>change("at",event.target.value)}/></Field>
              <Field label={`P&L neto del parcial (${currency}, opcional)`}><input type="number" step=".01" value={fill.pnl??""} onChange={event=>change("pnl",event.target.value)}/></Field>
              <Button className="icon-button" aria-label="Quitar parcial" tone="quiet" onClick={() => setPartials(partials.filter((item) => item.key !== fill.key))}><Trash2 size={15}/></Button>
            </div>;
          })}
          <Button tone="quiet" disabled={partials.length >= 12} onClick={() => setPartials([...partials, { key: allocateKey(), price: "", percent: "" }])}><Plus size={15}/>Añadir parcial</Button>
        </div>
      </section>
      <section className="form-block" hidden={step !== "review"}>
        <EmotionInput key={"during"+(restored?.savedAt??"")} stage="during" label="Emoción durante el trade" current={restored?draftEmotion("during"):trade?.during}/>
        <EmotionInput key={"after"+(restored?.savedAt??"")} stage="after" label="Emoción después del trade" current={restored?draftEmotion("after"):trade?.after}/>
        <Field label="Ejecución del plan"><select name="grade" defaultValue={trade?.grade ?? ""}><option value="">Sin calificar</option>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select></Field>
        <fieldset className="error-chips"><legend>Errores registrados</legend>{ERRORS.map((value) =>
          <label key={value}><input type="checkbox" name="errors" value={value} defaultChecked={trade?.errors.includes(value)}/>{value}</label>
        )}</fieldset>
        <CapturePairFields key={restored?.savedAt??"initial"} before={restored?.fields.captureBefore?.[0]??trade?.captureLinks?.before} after={restored?.fields.captureAfter?.[0]??trade?.captureLinks?.after} active={step==="review"} onEdited={queueDraft}/>
        <div className="form-block"><h3>Notas</h3><NoteEditor notes={notes} onChange={setNotes} nextId={allocateKey}/></div>
      </section>
    </form>
  </Modal>;
}
