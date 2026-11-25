"use client";
import {AssetCatalogPanel} from "./asset-picker";
import {HelpLink} from "./help-center";

import { useRef, useState, type FormEvent } from "react";
import { Archive, BookOpen, CreditCard, Download, FileSpreadsheet, Plus } from "lucide-react";
import { csvTemplate, downloadCsv, previewImport, type ImportPreview } from "@/lib/csv";
import { ACCOUNT_TYPES, ACCOUNT_STATES, accountSchema, CURRENCIES, dayKey, formatMoney, numberText, rLabel, planSchema, SETUP_COLORS, setupSchema, toCents, type Account, type Journal, type Setup } from "@/lib/journal";
import { accountTotals } from "@/lib/account-totals.mjs";
import { summarize } from "@/lib/stats";
import {decodeSummary} from '@/lib/journal-query';
import type {AccountModels,StrategyModels} from '@/lib/section-models';
import { errorText, type Save } from "./trade-editor";
import { Button, Empty, Field, Modal, ModalClose, Panel } from "./ui";

export type Edit = { kind: "account"; item?: Account } | { kind: "setup"; item?: Setup; copy?:Setup };

export function Settings({ journal, save, onManage, onExport, onRestore, section="all",accountModels,strategyModels }: { journal: Journal; save?: Save; onManage?: (edit: Edit) => void; onExport?: () => void; onRestore?:()=>void; section?:"all"|"accounts"|"setups"|"preferences";accountModels?:AccountModels;strategyModels?:StrategyModels }) {
  return <div className={"nebula-settings-layout nebula-settings-"+section}>
    {section==="accounts"&&<AccountOverview journal={journal} onManage={onManage} models={accountModels}/>}
    {section!=="preferences"&&section!=="accounts"&&<div className="analytics-grid">
      {section!=="setups"&&<Panel title="Cuentas" description="Separa resultados por cuenta y moneda" action={onManage && <Button onClick={() => onManage({ kind: "account" })}><Plus size={15}/>Nueva cuenta</Button>}>
        {journal.accounts.length ? <div className="settings-list">{journal.accounts.map((account) =>
          <div className="settings-row" key={account.id}><span className="settings-icon"><CreditCard size={17}/></span><div className="settings-name">
            <strong>{account.name}</strong><small>{account.type} · {account.currency} · Saldo inicial {formatMoney(account.startingBalanceCents, account.currency, false)}</small>
          </div>{account.archived && <span className="tag"><Archive size={13}/>Archivada</span>}{onManage && <Button tone="quiet" onClick={() => onManage({ kind: "account", item: account })}>Editar</Button>}</div>)}</div>
          : <Empty icon={<CreditCard size={20}/>} title="Aún no has creado ninguna cuenta."/>}
      </Panel>}
      {<Panel title="Estrategias" description="Agrupa operaciones por estrategia" action={onManage && <Button onClick={() => onManage({ kind: "setup" })}><Plus size={15}/>Nuevo setup</Button>}>
        {journal.setups.length ? <div className="settings-list">{journal.setups.map((setup) =>
          <div className="settings-row" key={setup.id}><span className={`settings-icon tag-${setup.color}`}><BookOpen size={17}/></span><div className="settings-name">
            <strong>{setup.name}</strong>{setup.description && <small>{setup.description}</small>}<small>{setup.assets||"Activos sin definir"} · {setup.timeframes||"Temporalidad sin definir"}</small>{(()=>{const model=strategyModels?.find(m=>m.id===setup.id);const s=model?decodeSummary(model.summary):summarize(journal.trades.filter(t=>t.setupId===setup.id),journal.accounts);return <small>{s.closed} cerradas · {rLabel(s.totalR)} · {s.winRate===null?"—":numberText(s.winRate)+"% de acierto"}</small>})()}
          </div>{setup.archived && <span className="tag"><Archive size={13}/>Archivado</span>}{onManage && <Button tone="quiet" onClick={() => onManage({ kind: "setup", item: setup })}>Editar</Button>}{onManage&&<Button tone="quiet" onClick={()=>onManage({kind:"setup",copy:setup})}>Duplicar</Button>}</div>)}</div>
          : <Empty icon={<BookOpen size={20}/>} title="Aún no has creado ningún setup."/>}
      </Panel>}
    </div>}
    {(section==="all"||section==="preferences")&&!!save&&<AssetCatalogPanel/>}
    {(section==="all"||section==="preferences")&&<PlanForm journal={journal} save={save}/>}
    {(section==="all"||section==="preferences")&&onExport && <Panel title="Respaldo y exportación" description="Descarga tus datos o compártelos con el diseño de la app" action={<Button onClick={onExport}><Download size={15}/>Exportar</Button>}>
      <p className="muted">Excel, PDF, CSV y un respaldo JSON con cuentas, setups, plan, operaciones y revisiones. Las imágenes de captura no se incluyen.</p>{onRestore&&<div className="v2-tools"><Button onClick={onRestore}>Restaurar respaldo JSON</Button></div>}
    </Panel>}
  </div>;
}

const movementLabels={deposit:"Depósito",withdrawal:"Retiro",adjustment:"Ajuste",fee:"Comisión externa"} as const;
function AccountOverview({journal,onManage,models}:{journal:Journal;onManage?:(edit:Edit)=>void;models?:AccountModels}){
 const [showArchived,setShowArchived]=useState(false);
 const [selected,setSelected]=useState("");
 const visible=journal.accounts.filter(a=>showArchived||!a.archived);
 const shown=selected?visible.filter(a=>a.id===selected):visible;
 return <><Panel title="Mis cuentas" description="Consulta cada moneda por separado." action={onManage&&<Button onClick={()=>onManage({kind:"account"})}><Plus size={15}/>Nueva cuenta</Button>}><div className="form-grid v2-tools"><Field label="Cuenta"><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Todas las cuentas</option>{visible.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><label className="check-label"><input type="checkbox" checked={showArchived} onChange={e=>{setShowArchived(e.target.checked);setSelected("");}}/>Mostrar archivadas</label></div></Panel>
 {!shown.length&&<Panel title="Sin cuentas"><Empty title="Crea una cuenta para empezar."/></Panel>}
 {shown.map(a=>{const trades=journal.trades.filter(t=>t.accountId===a.id);const model=models?.find(m=>m.id===a.id);const totals=model?.totals??accountTotals(a.startingBalanceCents,a.movements??[],trades);const summary=model?decodeSummary(model.summary):summarize(trades,[a],a.currency);const money=(v:number)=>formatMoney(v,a.currency,false);const target=a.funding?.targetPercent;return <Panel key={a.id} title={a.name} description={a.type+" · "+a.currency+" · "+(a.archived?"Archivada":a.status??"Activa")} action={onManage&&<Button onClick={()=>onManage({kind:"account",item:a})}>Editar cuenta</Button>}>
 <div className="v2-tools"><div className="v2-result"><small>Saldo calculado desde registros</small><strong>{money(totals.balance)}</strong><p>{totals.complete?"No equivale al patrimonio en tiempo real.":"Estimación incompleta: faltan "+totals.missingClosed+" cierres o "+totals.missingPartials+" parciales con importe."}</p></div>{(a.broker||a.platform)&&<p>{[a.broker,a.platform].filter(Boolean).join(" · ")}</p>}</div>
 <dl className="stat-list"><div><dt>Capital inicial</dt><dd>{money(a.startingBalanceCents)}</dd></div><div><dt>Depósitos</dt><dd>{money(totals.deposits)}</dd></div><div><dt>Retiros</dt><dd>{money(totals.withdrawals)}</dd></div><div><dt>Ajustes</dt><dd>{money(totals.adjustments)}</dd></div><div><dt>Comisiones externas</dt><dd>{money(totals.externalFees)}</dd></div><div><dt>Resultado cerrado registrado</dt><dd>{money(totals.closedPnl)}</dd></div><div><dt>Parciales de posiciones abiertas</dt><dd>{money(totals.openPartials)}</dd></div><div><dt>Rentabilidad simple sin flujos</dt><dd>{totals.returnPercent===null?"No calculable":numberText(totals.returnPercent)+"%"}</dd></div><div><dt>Operaciones cerradas / abiertas</dt><dd>{summary.closed} / {summary.open}</dd></div><div><dt>R acumulado cerrado</dt><dd>{rLabel(summary.totalR)}</dd></div></dl>
 {a.funding?.company&&<div className="v2-tools"><h3>Fondeo · {a.funding.company} {a.funding.phase}</h3><p className="muted">Reglas registradas manualmente; no verifica equity, trailing drawdown ni horarios de reinicio.</p><dl className="stat-list"><div><dt>Objetivo</dt><dd>{target==null?"—":numberText(target)+"%"}</dd></div><div><dt>Límite diario / total</dt><dd>{a.funding.dailyLossPercent??"—"}% / {a.funding.totalLossPercent??"—"}%</dd></div><div><dt>Días mínimos</dt><dd>{a.funding.minDays??"—"}</dd></div><div><dt>Vencimiento</dt><dd>{a.funding.endsOn??"—"}</dd></div></dl>{target!=null&&a.startingBalanceCents>0&&<p>Objetivo nominal: {money(a.startingBalanceCents*target/100)}. P&L registrado de trading: {money(totals.realized)}.</p>}</div>}
 {!!a.movements?.length&&<details className="v2-tools"><summary>Historial de movimientos ({a.movements.length})</summary><dl className="stat-list">{a.movements.slice().sort((x,y)=>y.day.localeCompare(x.day)).map(m=><div key={m.id}><dt>{m.day} · {movementLabels[m.kind]} {m.note}</dt><dd>{money(m.amountCents)}</dd></div>)}</dl></details>}
 </Panel>})}</>;
}
function PlanForm({ journal, save }: { journal: Journal; save?: Save }) {
  const { plan } = journal;
  const [version, setVersion] = useState(journal.planVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !save) return;
    const data = new FormData(event.currentTarget);
    const number = (key: string) => data.get(key) ? Number(data.get(key)) : null;
    const parsed = planSchema.safeParse({
      rules: String(data.get("rules") ?? "").split("\n").map((rule) => rule.trim()).filter(Boolean),
      riskPercent: number("risk"), dailyLossR: number("daily"), weeklyTargetR: number("weekly"),
    });
    if (!parsed.success) { setError("Revisa las metas y limita el checklist a 20 reglas de hasta 100 caracteres."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await save({ action: "savePlan", version, plan: parsed.data }, "Plan guardado.");
      setVersion(result.version ?? version);
    } catch (reason) { setError(errorText(reason)); }
    setBusy(false);
  }
  return <Panel title="Plan personal" description="Metas y reglas que puedes revisar al registrar cada operación">
    <form className="plan-form" onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-grid plan-grid">
        <Field label="Riesgo habitual (%)"><input name="risk" type="number" min="0.01" max="100" step="any" defaultValue={plan.riskPercent ?? ""} placeholder="0,5" disabled={!save}/></Field>
        <Field label="Límite diario de pérdida (R)"><input name="daily" type="number" min="0.01" max="1000" step="any" defaultValue={plan.dailyLossR ?? ""} placeholder="2" disabled={!save}/></Field>
        <Field label="Meta semanal (R)"><input name="weekly" type="number" min="0.01" max="1000" step="any" defaultValue={plan.weeklyTargetR ?? ""} placeholder="5" disabled={!save}/></Field>
        <Field wide label="Checklist de entrada" hint="Escribe una regla por línea."><textarea name="rules" rows={5} maxLength={2020} defaultValue={plan.rules.join("\n")} placeholder="Verificar el calendario de noticias" disabled={!save}/></Field>
      </div>
      {save && <div className="align-end"><Button type="submit" tone="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar plan"}</Button></div>}
    </form>
  </Panel>;
}

export function ManageEditor({ edit, save, onClose }: { edit: Edit; save: Save; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation,setConfirmation]=useState<{kind:'restore';version:number}|{kind:'movement';id:string}|null>(null);
  const { item } = edit;
  const id = useRef(item?.id);
  const account = edit.kind === "account" ? edit.item : undefined;
  const setup = edit.kind === "setup" ? edit.item ?? edit.copy : undefined;
  const [movements,setMovements]=useState(()=>account?.movements??[]);
  const [movementKind,setMovementKind]=useState<"deposit"|"withdrawal"|"adjustment"|"fee">("deposit");
  const [movementAmount,setMovementAmount]=useState("");
  const [movementDay,setMovementDay]=useState(()=>dayKey(Date.now()));
  const [movementNote,setMovementNote]=useState("");
  const [movementError,setMovementError]=useState("");
  function addMovement(){const value=Number(movementAmount);if(!movementAmount.trim()||!Number.isFinite(value)||value===0||(movementKind!=="adjustment"&&value<0)||Math.abs(value)>1e9||!movementDay){setMovementError("Indica fecha e importe válidos.");return;}if(movements.length>=100){setMovementError("Límite de 100 movimientos por cuenta.");return;}setMovements([...movements,{id:crypto.randomUUID(),kind:movementKind,amountCents:toCents(value),day:movementDay,note:movementNote}]);setMovementAmount("");setMovementNote("");setMovementError("");}
  async function restoreVersion(sourceVersion:number){
    if(busy||edit.kind!=="setup"||!edit.item)return;
    setBusy(true);setError("");
    try{await save({action:"restoreSetupVersion",id:edit.item.id,version:edit.item.version,sourceVersion},"Versión de estrategia restaurada.");setConfirmation(null);onClose();}
    catch(reason){setError(errorText(reason));setBusy(false);}
  }
  const kindName = edit.kind === "account" ? "cuenta" : "setup";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    id.current ??= crypto.randomUUID();
    const common = { name: get("name"), archived: data.has("archived") };
    const base = { id: id.current, version: item?.version ?? null };
    try {
      if (edit.kind === "account") {
        const optional=(k:string)=>get(k).trim()?Number(get(k)):null;
        const account = accountSchema.parse({ ...common, currency: get("currency"), type: get("type"), startingBalanceCents: toCents(Number(get("balance"))),riskLimits:{perTradePercent:optional("accountRisk"),dailyLossR:optional("accountDaily"),simultaneousPercent:optional("accountSimultaneous"),drawdownBasis:get("drawdownBasis")||"realized",maxDrawdownPercent:optional("accountMaxDD"),dailyDrawdownPercent:optional("accountDailyDD"),totalLossPercent:optional("accountTotalLoss")},broker:get("broker"),platform:get("platform"),createdOn:get("createdOn")||null,status:get("status"),notes:get("notes"),movements,funding:{company:get("company"),phase:get("phase"),targetPercent:optional("fundTarget"),dailyLossPercent:optional("fundDaily"),totalLossPercent:optional("fundTotal"),consistencyPercent:optional("consistency"),minDays:optional("minDays"),startsOn:get("fundStart")||null,endsOn:get("fundEnd")||null,rules:get("fundRules")} });
        await save({ action: "saveAccount", ...base, account }, "Cuenta guardada.");
      } else {
        const setup = setupSchema.parse({ ...common, description: get("description"), rules: get("rules"), color: get("color"),assets:get("assets"),timeframes:get("timeframes"),sessions:get("sessions"),riskRules:get("riskRules"),examples:get("examples") });
        await save({ action: "saveSetup", ...base, setup }, "Setup guardado.");
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error && reason.name === "ZodError" ? "Revisa los campos del formulario." : errorText(reason));
      setBusy(false);
    }
  }
  return <><Modal title={(item ? "Editar " : edit.kind === "account" ? "Nueva " : "Nuevo ") + kindName} onClose={onClose} busy={busy} protectDraft
    footer={<><ModalClose disabled={busy}>Cancelar</ModalClose><Button type="submit" form="manage-form" tone="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button></>}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {edit.kind==="setup"&&edit.item && edit.item.versions && edit.item.versions.length>0&&<details className="v2-disclosure"><summary>Historial de versiones ({edit.item.versions.length}) · actual {edit.item.version}</summary><div className="settings-list">{edit.item.versions.slice().reverse().map(version=><div className="settings-row" key={version.version}><div className="settings-name"><strong>Versión {version.version} · {new Date(version.savedAt).toLocaleString("es-EC",{timeZone:"America/Guayaquil",dateStyle:"medium",timeStyle:"short"})}</strong><small>{version.name} · {version.color} · {version.assets||"Activos sin definir"} · {version.timeframes||"Temporalidad sin definir"}</small><small>{version.rules||"Sin reglas registradas"}</small>{version.riskRules&&<small>Riesgo: {version.riskRules}</small>}<small>{version.description} · Sesiones: {version.sessions||"Sin definir"}</small>{version.examples&&<small>Ejemplos: {version.examples}</small>}</div><Button disabled={busy} onClick={()=>setConfirmation({kind:'restore',version:version.version})}>Restaurar versión {version.version}</Button></div>)}</div><p className="muted">Restaurar crea una versión actual y conserva los snapshots de las operaciones existentes.</p></details>}
    <form id="manage-form" className="form-grid" onSubmit={submit}>
      <Field label="Nombre" wide><input name="name" maxLength={100} required defaultValue={item?.name??(edit.kind==="setup"&&edit.copy?`${edit.copy.name.slice(0,90)} (copia)`:"")} placeholder={edit.kind === "account" ? "Ej. Demo Nasdaq" : "Ej. Ruptura + retroceso"}/></Field>
      {edit.kind === "account" ? <>
        <Field label="Tipo"><select name="type" defaultValue={account?.type ?? "Demo"}>{ACCOUNT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Moneda"><select name="currency" defaultValue={account?.currency ?? "USD"}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Saldo inicial"><input name="balance" type="number" min="0" step=".01" required defaultValue={(account?.startingBalanceCents ?? 0) / 100}/></Field>
        <details className="span-all v2-disclosure"><summary>Límites de riesgo de esta cuenta</summary><div className="form-grid"><Field label="Máximo por operación (%)"><input name="accountRisk" type="number" min="0.01" max="100" step="any" defaultValue={account?.riskLimits?.perTradePercent??""}/></Field><Field label="Pérdida diaria (R)"><input name="accountDaily" type="number" min="0.01" max="1000" step="any" defaultValue={account?.riskLimits?.dailyLossR??""}/></Field><Field label="Riesgo simultáneo estimado (%)"><input name="accountSimultaneous" type="number" min="0.01" max="100" step="any" defaultValue={account?.riskLimits?.simultaneousPercent??""}/></Field><Field label="Base de drawdown"><select name="drawdownBasis" defaultValue={account?.riskLimits?.drawdownBasis??"realized"}><option value="realized">Saldo realizado con parciales fechados</option><option value="closed">Solo operaciones cerradas</option></select></Field><Field label="Drawdown máximo (%)"><input name="accountMaxDD" type="number" min="0.01" max="100" step="any" defaultValue={account?.riskLimits?.maxDrawdownPercent??""}/></Field><Field label="Drawdown diario (%)"><input name="accountDailyDD" type="number" min="0.01" max="100" step="any" defaultValue={account?.riskLimits?.dailyDrawdownPercent??""}/></Field><Field label="Pérdida total desde capital inicial (%)"><input name="accountTotalLoss" type="number" min="0.01" max="100" step="any" defaultValue={account?.riskLimits?.totalLossPercent??""}/></Field></div><p className="muted">Vacío utiliza el límite diario del plan o deja el control sin configurar. El riesgo simultáneo se estima sobre el saldo registrado; no bloquea órdenes en el bróker.</p></details>
        <Field label="Bróker"><input name="broker" maxLength={100} defaultValue={account?.broker}/></Field><Field label="Plataforma"><input name="platform" maxLength={100} defaultValue={account?.platform}/></Field>
        <Field label="Fecha de creación"><input name="createdOn" type="date" defaultValue={account?.createdOn??""}/></Field><Field label="Estado"><select name="status" defaultValue={account?.status??"Activa"}>{ACCOUNT_STATES.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field wide label="Observaciones"><textarea name="notes" maxLength={2500} rows={2} defaultValue={account?.notes}/></Field>
        <details className="span-all v2-disclosure"><summary>Condiciones de fondeo (opcional)</summary><div className="form-grid">
          <Field label="Empresa"><input name="company" maxLength={100} defaultValue={account?.funding?.company}/></Field><Field label="Fase"><input name="phase" maxLength={100} defaultValue={account?.funding?.phase}/></Field>
          {([["fundTarget","Objetivo (%)",account?.funding?.targetPercent],["fundDaily","Pérdida diaria máxima (%)",account?.funding?.dailyLossPercent],["fundTotal","Pérdida total máxima (%)",account?.funding?.totalLossPercent],["consistency","Consistencia (%)",account?.funding?.consistencyPercent]] as const).map(([name,label,value])=><Field key={name} label={label}><input name={name} type="number" step="any" min=".01" max="100" defaultValue={value??""}/></Field>)}
          <Field label="Días mínimos"><input name="minDays" type="number" min="1" max="3650" step="1" defaultValue={account?.funding?.minDays??""}/></Field><Field label="Inicio"><input name="fundStart" type="date" defaultValue={account?.funding?.startsOn??""}/></Field><Field label="Vencimiento"><input name="fundEnd" type="date" defaultValue={account?.funding?.endsOn??""}/></Field><Field wide label="Reglas personalizadas"><textarea name="fundRules" maxLength={2500} defaultValue={account?.funding?.rules}/></Field>
        </div><p className="muted">Solo seguimiento manual; no verifica las reglas reales de la empresa.</p></details>
        <details className="span-all v2-disclosure"><summary>Movimientos de capital ({movements.length}/100)</summary><p className="muted">Importes en la moneda de la cuenta. No registres aquí comisiones ya incluidas en el P&L de trades.</p><div className="form-grid"><Field label="Movimiento"><select value={movementKind} onChange={e=>setMovementKind(e.target.value as typeof movementKind)}>{Object.entries(movementLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></Field><Field label="Importe"><input type="number" step=".01" value={movementAmount} onChange={e=>setMovementAmount(e.target.value)}/></Field><Field label="Fecha"><input type="date" value={movementDay} onChange={e=>setMovementDay(e.target.value)}/></Field><Field label="Nota"><input maxLength={100} value={movementNote} onChange={e=>setMovementNote(e.target.value)}/></Field></div><Button tone="quiet" onClick={addMovement}>Añadir movimiento</Button>{movementError&&<p role="alert">{movementError}</p>}
          {movements.map(m=><div className="settings-row" key={m.id}><div className="settings-name"><strong>{movementLabels[m.kind]} · {numberText(m.amountCents/100)}</strong><small>{m.day} {m.note}</small></div><Button tone="quiet" onClick={()=>setConfirmation({kind:'movement',id:m.id})}>Quitar</Button></div>)}
        </details>
      </> : <>
        <Field label="Color"><select name="color" defaultValue={setup?.color ?? "violeta"}>{SETUP_COLORS.map((color) => <option key={color}>{color}</option>)}</select></Field>
        <Field label="Descripción" wide><textarea name="description" rows={3} maxLength={2500} defaultValue={setup?.description}/></Field>
        <Field label="Reglas de entrada y salida" wide><textarea name="rules" rows={3} maxLength={2500} defaultValue={setup?.rules}/></Field>
        <Field label="Activos"><input name="assets" maxLength={100} defaultValue={setup?.assets}/></Field><Field label="Temporalidades"><input name="timeframes" maxLength={100} defaultValue={setup?.timeframes}/></Field><Field label="Sesiones"><input name="sessions" maxLength={100} defaultValue={setup?.sessions}/></Field><Field wide label="Gestión del riesgo"><textarea name="riskRules" maxLength={2500} defaultValue={setup?.riskRules}/></Field><Field wide label="Ejemplos y notas"><textarea name="examples" maxLength={2500} defaultValue={setup?.examples}/></Field>
      </>}
      {item && <label className="check-label span-all"><input name="archived" type="checkbox" defaultChecked={item.archived}/>Archivar {kindName}</label>}
    </form>
  </Modal>{confirmation&&<Modal title={confirmation.kind==='restore'?'Restaurar versión de estrategia':'Quitar movimiento'} busy={busy} onClose={()=>setConfirmation(null)} footer={<><Button disabled={busy} onClick={()=>setConfirmation(null)}>Cancelar</Button><Button tone={confirmation.kind==='movement'?'danger':'primary'} disabled={busy} onClick={()=>{if(confirmation.kind==='restore')void restoreVersion(confirmation.version);else{setMovements(current=>current.filter(m=>m.id!==confirmation.id));setConfirmation(null);}}}>{confirmation.kind==='restore'?'Confirmar restauración':'Confirmar quitar movimiento'}</Button></>}><p>{confirmation.kind==='restore'?'Se creará una versión actual con estas reglas históricas. Las operaciones anteriores conservarán sus snapshots.':'Se quitará del formulario este movimiento. El registro del servidor solo cambia al guardar la cuenta.'}</p>{error&&<p role="alert">{error}</p>}</Modal>}</>;
}

export function ImportDialog({ journal, save, onClose, onSettings }: { journal: Journal; save: Save; onClose: () => void; onSettings: () => void }) {
  const accounts = journal.accounts.filter((account) => !account.archived);
  const [accountId, setAccount] = useState(accounts[0]?.id ?? "");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState("");
  const [alreadyImported, setAlreadyImported] = useState(0);
  const [resumeAt, setResumeAt] = useState(0);
  const account = accounts.find((item) => item.id === accountId);

  async function loadFile(file?: File) {
    setPreview(null);
    setError("");
    setComplete("");
    setAlreadyImported(0);
    setResumeAt(0);
    if (!file || !account) return;
    setFilename(file.name);
    if (file.size > 5 * 1024 * 1024) { setError("Usa un CSV de hasta 5 MB."); return; }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
      const text = new TextDecoder(encoding).decode(buffer);
      setPreview(await previewImport(text, account));
    } catch (reason) { setError(errorText(reason)); }
    setBusy(false);
  }

  async function importRows() {
    if (busy || !preview?.valid.length || !account) return;
    setBusy(true);
    setError("");
    let inserted = alreadyImported;
    try {
      const batchSize = 20;
      for (let offset = resumeAt; offset < preview.valid.length; offset += batchSize) {
        const batch = preview.valid.slice(offset, offset + batchSize).map(({ id, key, trade }) => ({ id, key, trade }));
        const result = await save({ action: "importTrades", accountId: account.id, trades: batch }, "");
        inserted += result.imported ?? 0;
        setAlreadyImported(inserted);
        setResumeAt(offset + batch.length);
      }
      setComplete(`${inserted} importadas · ${preview.valid.length - inserted} omitidas por duplicado`);
    } catch (reason) { setError(`${errorText(reason)} ${inserted} operaciones ya quedaron guardadas.`); }
    setBusy(false);
  }

  return <Modal title="Importar operaciones" presentation="page" protectDraft={!!preview && !complete} subtitle="CSV de operaciones cerradas · Usa la plantilla si tu bróker tiene otro formato." onClose={onClose} busy={busy}
    footer={<><ModalClose disabled={busy}>{complete ? "Cerrar" : "Cancelar"}</ModalClose>
      {preview && !complete && <Button tone="primary" onClick={importRows} disabled={busy || !preview.valid.length || resumeAt >= preview.valid.length}>{busy ? "Importando…" : resumeAt ? "Continuar importación" : `Importar ${preview.valid.length}`}</Button>}</>}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <HelpLink topic="importaciones"/>
    <ol className="import-steps" aria-label="Progreso de importación"><li aria-current={!preview&&!complete?"step":undefined}>Elegir archivo</li><li aria-current={!!preview&&!complete?"step":undefined}>Revisar e importar</li><li aria-current={complete?"step":undefined}>Resultado</li></ol>
    {complete && <p className="informative-note" role="status">{complete}</p>}
    {busy && <p className="muted" role="status">{preview ? `Importando: ${resumeAt} de ${preview.valid.length} filas procesadas…` : "Preparando la vista previa del CSV…"}</p>}
    {!accounts.length ? <Empty icon={<FileSpreadsheet size={21}/>} title="Crea una cuenta para importar tu CSV." action={<Button onClick={onSettings}>Ir a cuentas</Button>}/> : <>
      <Field label="Cuenta de destino"><select value={accountId} disabled={busy} onChange={(event) => { setAccount(event.target.value); setFilename(""); setPreview(null); setError(""); setComplete(""); setAlreadyImported(0); setResumeAt(0); }}>
        {accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}
      </select></Field>
      <Field label="Archivo CSV" hint="Las fechas sin zona horaria se interpretan en hora de Ecuador."><input type="file" aria-label="Archivo CSV" accept=".csv,.tsv,text/csv,text/tab-separated-values" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void loadFile(file); }}/></Field>
      <div><Button tone="quiet" onClick={() => downloadCsv("plantilla_bitacora.csv", csvTemplate(account?.currency))}><Download size={15}/>Descargar plantilla CSV</Button></div>
      {preview && <div className="import-preview"><strong>{filename}</strong><p>{preview.valid.length} válidas · {preview.invalid.length} con errores</p>
        {preview.invalid.slice(0, 8).map(({ line, reason }) => <small key={line}>Fila {line}: {reason}</small>)}
        {!!preview.invalid.length && <small>Solo se importarán las filas válidas.</small>}
      </div>}
    </>}
  </Modal>;
}
