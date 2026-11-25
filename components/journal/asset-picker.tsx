"use client";
import {useEffect,useState} from 'react';
import {Plus,Star,Pencil} from 'lucide-react';
import {assetBackupSchema,assetDraft,suggestedMarketSymbols,type CatalogAsset} from '@/lib/asset-catalog';
import {dateLabel} from '@/lib/journal';
import {Button,Field,Modal,Panel} from './ui';
type Market={id:string;name:string};
type Page={items:CatalogAsset[];revision:number;total:number;page:number;next:boolean};
async function api<T=Page>(path:string,input?:unknown){const response=await fetch('/api/activos'+path,{method:input?'POST':'GET',cache:'no-store',headers:input?{'Content-Type':'application/json','X-Bitacora-Request':'1'}:undefined,body:input?JSON.stringify(input):undefined}).catch(()=>{throw Error('No se pudo conectar. Conserva tus cambios e inténtalo nuevamente.');});const data=await response.json().catch(()=>({error:'No se pudo leer la respuesta del servidor. Inténtalo nuevamente.'})) as T&{error?:string};if(!response.ok||data.error)throw Error(data.error??'No se pudo abrir tu catálogo.');return data as T;}
function AssetEditor({asset,onSaved,onClose,onDeleted}:{asset?:CatalogAsset;onSaved:(asset:CatalogAsset)=>void;onClose:()=>void;onDeleted:()=>void}){
 const [name,setName]=useState(asset?.name??''),[aliases,setAliases]=useState(asset?.aliases.join(', ')??''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState(false);
 async function remove(){if(!asset)return;setBusy(true);setError('');try{await api('',{action:'delete',id:asset.id,version:asset.version});onDeleted();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const symbols=aliases.split(/[,\n]/).map(s=>s.trim().toUpperCase()).filter(Boolean),suggested=suggestedMarketSymbols(symbols);
 async function save(){const parsed=assetDraft.safeParse({name,aliases:symbols,favorite:asset?.favorite??false});if(!parsed.success){setError(parsed.error.issues[0].message);return;}setBusy(true);setError('');try{const data=await api<{asset:CatalogAsset}>('',{action:'save',id:asset?.id??crypto.randomUUID(),version:asset?.version??null,asset:parsed.data});onSaved(data.asset);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title={asset?'Editar activo':'Agregar activo'} onClose={onClose} busy={busy} protectDraft footer={confirmDelete?<><span>Se eliminará únicamente este activo si no tiene operaciones asociadas.</span><Button disabled={busy} onClick={()=>setConfirmDelete(false)}>Conservar activo</Button><Button tone="danger" disabled={busy} onClick={()=>void remove()}>Eliminar activo</Button></>:<>{asset&&<Button tone="danger" disabled={busy} onClick={()=>setConfirmDelete(true)}>Eliminar</Button>}<Button onClick={onClose} disabled={busy}>Cancelar</Button><Button tone="primary" onClick={()=>void save()} disabled={busy}>Guardar activo</Button></>}>
  <p>Solo en tu catálogo. No cambia instrumentos, tamaños ni cálculos de operaciones anteriores.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <Field label="Nombre visible del activo"><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} autoFocus onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void save();}}}/></Field>
  <Field label="Símbolos o alias (opcional)" hint="Separados por comas. Revisa cada símbolo: agrupar no define contratos, cotizaciones ni conversión monetaria. El historial requiere confirmación aparte."><textarea value={aliases} onChange={e=>setAliases(e.target.value)} maxLength={600}/></Field>
  {!!suggested.length&&!suggested.every(s=>symbols.includes(s))&&<Button onClick={()=>setAliases([...new Set([...symbols,...suggested])].join(', '))}>Proponer símbolos de NASDAQ 100</Button>}
 </Modal>;
}
function Association({asset,onClose}:{asset:CatalogAsset;onClose:()=>void}){
 const [data,setData]=useState<{asset:CatalogAsset;revision:number;items:{id:string;version:number;asset:string;openedAt:number;direction:string}[];total:number}|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;void api<NonNullable<typeof data>>('?mode=preview&id='+asset.id).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[asset.id,refresh]);
 async function apply(){if(!data||!confirm)return;setBusy(true);try{await api('',{action:'associate',id:asset.id,version:data.asset.version,revision:data.revision,confirm:true,trades:data.items.map(({id,version})=>({id,version}))});setConfirm(false);setData(null);setRefresh(n=>n+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title="Asociar operaciones anteriores" subtitle={asset.name} onClose={onClose} busy={busy} footer={<><Button onClick={onClose} disabled={busy}>Cerrar</Button><Button onClick={()=>void apply()} tone="primary" disabled={busy||!confirm||!data?.items.length}>Asociar estas {data?.items.length??0} operaciones</Button></>}>
  <p>Solo registros sin activo estadístico cuyo símbolo coincide con tus alias. El símbolo original y todos los datos financieros se conservan. Si algo cambia, se cancela el lote completo.</p>
  {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Preparando vista previa…</p>}
  {data&&<><p>{data.total} coincidencias pendientes; se muestran hasta 20 por confirmación.</p><ul>{data.items.map(t=><li key={t.id}>{t.asset} · {dateLabel(t.openedAt)} · {t.direction==='long'?'Compra':'Venta'}</li>)}</ul>{!!data.items.length&&<label className="check-label"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirmo asociar únicamente las operaciones mostradas.</label>}</>}
 </Modal>;
}
export function AssetPicker({value,onPick,enabled=true,manage=false}:{value:Market|null;onPick:(value:Market|null,asset?:CatalogAsset)=>void;enabled?:boolean;manage?:boolean}){
 const [q,setQ]=useState(''),[order,setOrder]=useState('favorites'),[data,setData]=useState<Page|null>(null),[page,setPage]=useState(0),[revision,setRevision]=useState<number|undefined>(),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(false),[editor,setEditor]=useState<CatalogAsset|null|undefined>(),[history,setHistory]=useState<CatalogAsset|null>(null);
 useEffect(()=>{if(!enabled)return;let active=true;const timer=setTimeout(()=>{setLoading(true);const p=new URLSearchParams({q,page:String(page),order});if(revision!==undefined)p.set('revision',String(revision));void api('?'+p).then(d=>{if(active){setData(d);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});},250);return()=>{active=false;clearTimeout(timer);};},[enabled,q,page,revision,order,refresh]);
 const reset=()=>{setPage(0);setRevision(undefined);setRefresh(n=>n+1);};
 async function favorite(a:CatalogAsset){try{await api('',{action:'save',id:a.id,version:a.version,asset:{name:a.name,aliases:a.aliases,favorite:!a.favorite}});reset();}catch(e){setError((e as Error).message);}}
 return <div className="asset-picker">
  <div className="asset-picker-heading"><strong>{manage?'Catálogo personal':'Activo estadístico'}</strong>{enabled&&<Button className="icon-button" aria-label="Agregar activo" onClick={()=>setEditor(null)}><Plus size={17}/></Button>}</div>
  {!enabled?<small>El catálogo personal está disponible al iniciar sesión.</small>:<>
   {!manage&&<><p>{value?value.name:'Sin asociar; se conserva el símbolo original.'}</p><input type="hidden" name="market" value={value?JSON.stringify(value):''}/>{value&&<Button tone="quiet" data-edit-action onClick={()=>onPick(null)}>Quitar asociación del borrador</Button>}</>}
   <div className="form-grid"><Field label="Buscar activo estadístico"><input type="search" value={q} onKeyDown={e=>{if(e.key==="Enter")e.preventDefault();}} onChange={e=>{setQ(e.target.value);setPage(0);setRevision(undefined);}} maxLength={80}/></Field><Field label="Orden del catálogo"><select value={order} onChange={e=>{setOrder(e.target.value);setPage(0);setRevision(undefined);}}><option value="favorites">Favoritos primero</option><option value="recent">Recientes por última operación</option><option value="name">Nombre</option></select></Field></div>
   {error&&<div role="alert"><p>{error}</p><Button onClick={reset}>Actualizar catálogo</Button></div>}{loading&&<small role="status">Buscando en tu catálogo…</small>}
   {!loading&&!data?.items.length&&!error&&<p className="muted">No hay activos con esta selección. Pulsa + para crear el tuyo.</p>}
   <div className="asset-catalog-list">{data?.items.map(a=><div className="asset-catalog-row" key={a.id}>
    {manage?<div><strong>{a.name}</strong><small>{a.aliases.join(' · ')||'Sin alias'}</small></div>:<Button data-edit-action aria-pressed={value?.id===a.id} onClick={()=>onPick({id:a.id,name:a.name},a)}>{a.name}<small>{a.aliases.join(' · ')||'Sin alias'}</small></Button>}
    <Button tone="quiet" className="icon-button" aria-label={(a.favorite?'Quitar favorito: ':'Marcar favorito: ')+a.name} aria-pressed={a.favorite} onClick={()=>void favorite(a)}><Star size={16} fill={a.favorite?'currentColor':'none'}/></Button>
    <Button tone="quiet" className="icon-button" aria-label={'Editar activo: '+a.name} onClick={()=>setEditor(a)}><Pencil size={16}/></Button>
    {manage&&<Button onClick={()=>setHistory(a)}>Revisar historial</Button>}
   </div>)}</div>
   {!!data&&<div className="pagination"><Button disabled={!page||loading} onClick={()=>{setRevision(data.revision);setPage(n=>n-1);}}>Anterior</Button><small>{data.total} activos · página {page+1}</small><Button disabled={!data.next||loading} onClick={()=>{setRevision(data.revision);setPage(n=>n+1);}}>Siguiente</Button></div>}
  </>}
  {editor!==undefined&&<AssetEditor asset={editor??undefined} onDeleted={()=>{if(value?.id===editor?.id)onPick(null);setEditor(undefined);reset();}} onClose={()=>setEditor(undefined)} onSaved={a=>{if(!manage)onPick({id:a.id,name:a.name},a);setEditor(undefined);reset();}}/>}
  {history&&<Association asset={history} onClose={()=>{setHistory(null);reset();}}/>}
 </div>;
}
export function AssetCatalogPanel(){
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState<{id:string;asset:{name:string;aliases:string[];favorite:boolean}}[]|null>(null),[confirm,setConfirm]=useState(false),[at,setAt]=useState(0),[refresh,setRefresh]=useState(0);
 async function backup(){setBusy(true);try{
  const items:CatalogAsset[]=[],ids=new Set<string>();let revision:number|undefined,page=0;
  while(true){const data=await api<Page>('?size=200&page='+page+(revision===undefined?'':'&revision='+revision));revision=data.revision;for(const a of data.items){if(ids.has(a.id))throw Error('El catálogo cambió. Repite la descarga.');ids.add(a.id);items.push(a);}if(!data.next){if(items.length!==data.total)throw Error('No se obtuvo el catálogo completo. Repite la descarga.');break;}page++;}
  const file={app:'tradeify-assets',format:1,assets:items.map(a=>({id:a.id,asset:{name:a.name,aliases:a.aliases,favorite:a.favorite}}))};if(!assetBackupSchema.safeParse(file).success)throw Error('El catálogo supera el límite de 10.000 activos de este formato. No se generó un archivo parcial; utiliza el respaldo operacional.');const json=JSON.stringify(file,null,2),blob=new Blob([json],{type:'application/json'});if(blob.size>10000000)throw Error('El catálogo supera 10 MB. No se generó un archivo parcial; utiliza el respaldo operacional.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tradeify-activos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setNotice('Catálogo privado descargado. El respaldo de operaciones se descarga por separado.');
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function restore(){if(!file||!confirm)return;setBusy(true);try{for(let i=at;i<file.length;i++){await api('',{action:'restore',...file[i]});setAt(i+1);}setNotice('Restauración del catálogo finalizada. Los registros idénticos se conservaron; no se sobrescribieron otros.');setFile(null);setConfirm(false);}catch(e){setNotice((e as Error).message+' Puedes continuar desde el último registro confirmado.');}finally{setBusy(false);setRefresh(n=>n+1);}}
 return <Panel title="Mis activos" description="Catálogo vacío al comenzar, privado y editable. La asociación histórica requiere vista previa y confirmación.">
  <AssetPicker key={refresh} value={null} onPick={()=>{}} manage/>
  <div className="v2-tools"><p role="status">{notice}</p><Button onClick={()=>void backup()} disabled={busy}>Respaldar catálogo JSON privado</Button>
   <Field label="Restaurar catálogo JSON privado"><input type="file" accept=".json,application/json" disabled={busy} onChange={async event=>{const upload=event.target.files?.[0];setFile(null);setConfirm(false);setAt(0);if(!upload)return;if(upload.size>10000000){setNotice('El archivo supera 10 MB. No se importó.');return;}try{const parsed=assetBackupSchema.safeParse(JSON.parse(await upload.text()));if(!parsed.success)throw Error('Revisa el formato, los duplicados y los símbolos del respaldo.');setFile(parsed.data.assets);setNotice('Vista previa: '+parsed.data.assets.length+' activos. Se añadirán únicamente registros nuevos o idénticos. No se asocian operaciones automáticamente.');}catch(e){setNotice((e as Error).message);}}}/></Field>
   {file&&<><label className="check-label"><input type="checkbox" checked={confirm} disabled={busy} onChange={e=>setConfirm(e.target.checked)}/>Confirmo añadir este catálogo a mi usuario.</label><Button onClick={()=>void restore()} disabled={busy||!confirm}>{busy?'Restaurando…':at?'Continuar restauración del catálogo':'Restaurar catálogo'}</Button><small>{at}/{file.length} registros confirmados. Un conflicto detiene los siguientes; no elimina datos previos.</small></>}
  </div>
 </Panel>;
}
