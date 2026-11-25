"use client";
import {HelpLink} from "./help-center";
import {useRef,useState} from "react";
import {backupSchema,type Journal} from "@/lib/journal";
import {planRestore} from "@/lib/restore-plan";
import {downloadFile} from "@/lib/csv";
import type { RestoreOutcome } from "@/lib/restore-types";
import {Button,Field,Modal} from "./ui";
import {errorText,type Save} from "./trade-editor";
export function RestoreDialog({journal,ready,save,onClose}:{journal:Journal;ready:boolean;save:Save;onClose:()=>void}){
 const loadId=useRef(0);const sending=useRef(false);const requestIds=useRef<string[]>([]);
 const [outcomes,setOutcomes]=useState<(RestoreOutcome & {kind:string})[]>([]);
 const [plan,setPlan]=useState<ReturnType<typeof planRestore>|null>(null);
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [confirmed,setConfirmed]=useState(false);
 const [progress,setProgress]=useState(0);const [inserted,setInserted]=useState(0);const [done,setDone]=useState(false);
 async function load(file?:File){const id=++loadId.current;setOutcomes([]);setPlan(null);setError("");setConfirmed(false);setProgress(0);setInserted(0);setDone(false);if(!file||!ready)return;try{if(file.size>20*1024*1024)throw Error("Usa un respaldo de hasta 20 MB.");const data=backupSchema.safeParse(JSON.parse(await file.text()));if(!data.success)throw Error(data.error.issues[0]?.message??"Respaldo inválido.");if(id!==loadId.current)return;const next=planRestore(data.data,journal);requestIds.current=next.batches.map(()=>crypto.randomUUID());setPlan(next);}catch(e){if(id===loadId.current)setError(errorText(e))}}
 async function restore(){if(!ready||!plan||plan.conflicts||!confirmed||sending.current||done)return;sending.current=true;setBusy(true);setError("");let count=inserted;let index=progress;
 try{for(;index<plan.batches.length;index++){const result=await save({action:"restoreBatch",batch:plan.batches[index],requestId:requestIds.current[index]},"");const kind=plan.batches[index].kind;if(result.records)setOutcomes(previous=>[...previous,...result.records!.map(r=>({...r,kind}))]);count+=result.imported??0;setInserted(count);setProgress(index+1);}setDone(true);}
 catch(e){setError(errorText(e)+" Los lotes anteriores se conservan. Puedes reintentar desde el último lote o cerrar y revisar los datos.");}finally{sending.current=false;setBusy(false);}}
 return <Modal title="Restaurar respaldo privado" subtitle="Añadir registros sin reemplazar los existentes" busy={busy} onClose={onClose} footer={<><Button disabled={busy} onClick={onClose}>{done?"Terminar":"Cerrar"}</Button><Button tone="primary" disabled={!ready||!plan||!!plan.conflicts||!confirmed||busy||done||!plan.batches.length} onClick={()=>void restore()}>{busy?"Restaurando…":progress?"Continuar restauración":"Restaurar"}</Button></>}>
 {!ready&&<p role="alert">Espera a que termine la carga completa del historial. Si falló, cierra y reintenta la carga antes de restaurar.</p>}
 <p>Selecciona un JSON exportado por Tradeify. Los registros idénticos se omiten; un conflicto impide iniciar la restauración. Las imágenes físicas no están incluidas. No se importan identidades ni permisos.</p>
 <Field label="Archivo JSON"><input type="file" accept=".json,application/json" disabled={!ready||busy||progress>0} onChange={e=>void load(e.target.files?.[0])}/></Field>
 <HelpLink topic="restauracion"/>{error&&<p role="alert" className="form-error">{error}</p>}
 {plan&&<><dl className="stat-list"><div><dt>Nuevos registros previstos</dt><dd>{plan.added}</dd></div><div><dt>Idénticos</dt><dd>{plan.skipped}</dd></div><div><dt>Conflictos o vínculos faltantes</dt><dd>{plan.conflicts}</dd></div></dl>{plan.conflicts>0?<p role="alert">No se puede restaurar sin resolver los conflictos. No se modificaron registros.</p>:<label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy||done||progress>0} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que quiero añadir los registros de este respaldo a mi cuenta.</label>}{plan.batches.length>0&&<div role="status"><progress value={progress} max={plan.batches.length}/><p>{progress}/{plan.batches.length} lotes · {inserted} registros añadidos confirmados</p></div>}</>}
 {plan&&plan.conflicts>0&&<details><summary>Registros rechazados</summary><ul>{plan.records.filter(r=>r.status==="rejected").map(r=><li key={r.kind+":"+r.key}>{r.kind} · {r.key}: {r.reason}</li>)}</ul></details>}
 {plan&&<Button onClick={()=>downloadFile("resultado_restauracion.json",JSON.stringify({completa:done,previstos:plan?.added,omitidosEnVistaPrevia:plan?.skipped,vistaPrevia:plan?.records,registrosConfirmados:outcomes},null,2),"application/json")}>Descargar detalle de restauración</Button>}
 {done&&<p role="status">Restauración finalizada: {inserted} añadidos y {(plan?.skipped??0)+outcomes.filter(r=>r.status==="skipped").length} omitidos. Cierra para actualizar la bitácora.</p>}
 </Modal>;
}
