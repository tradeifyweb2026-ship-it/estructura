"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {AdminResources} from "./admin-resources";
import {ArrowLeft,Search,ShieldCheck,Users,Settings2,History,Monitor} from "lucide-react";
import {Brand,Button,Empty,Field,Modal,ModalClose,Panel} from "./ui";
import {ThemeControl} from "./theme-control";
import {addDays,dateInput,inputDate} from "@/lib/journal";
type User={custom_trades?:number|null;trades_used?:number;display_status?:string;user_id:string;email:string;created_at:number;last_login:number;status:string;access_until:number|null;suspended_until:number|null};
type Session={token_hash:string;user_id:string;created_at:number;last_seen:number;expires_at:number;device:string};
type Settings={mode:string;default_days:number|null};
type Data={users:User[];total:number;sessions:Session[];sessionTotal:number;events:{id:string;actor:string;action:string;target:string;created_at:number}[];settings:Settings;eventTotal:number;inviteTotal:number;invitations:{email:string;access_until:number|null;created_at:number|null;last_sent_at:number|null;registered:number}[];counts:{status:string;total:number}[];expiring:number;activeSessions:number};
type Change={action:string;[key:string]:unknown};
type Pending={input:Change;title:string;description:string;success:string;closeUser?:boolean};
const states:Record<string,string>={active:"Activo",blocked:"Bloqueado",pending:"Pendiente",suspended:"Suspendido",expired:"Vencido"};
const modes:Record<string,string>={public:"Registro público automático",approval:"Registro con aprobación",closed:"Registro cerrado"};
const dates=(value:number|null)=>value===0?"Sin registro":value===null?"Sin límite":new Date(value).toLocaleString("es-EC",{timeZone:"America/Guayaquil",dateStyle:"medium",timeStyle:"short"});
const localDate=(value:number|null)=>value?dateInput(value):"";
function deviceName(agent:string){
 const browser=/Edg/.test(agent)?"Edge":/Firefox/.test(agent)?"Firefox":/Chrome/.test(agent)?"Chrome":/Safari/.test(agent)?"Safari":"Navegador";
 const system=/Android/.test(agent)?"Android":/iPhone|iPad/.test(agent)?"iOS":/Windows/.test(agent)?"Windows":/Mac/.test(agent)?"macOS":/Linux/.test(agent)?"Linux":"Dispositivo";
 return browser+" · "+system;
}
function durationDate(value:string,custom:string){
 const result=value==="custom"?inputDate(custom):value?Date.now()+Number(value)*86400000:null;
 if(result!==null&&!Number.isFinite(result))throw new Error("Indica una fecha de vencimiento válida.");
 return result;
}
function Duration({value,setValue,custom,setCustom}:{value:string;setValue:(v:string)=>void;custom:string;setCustom:(v:string)=>void}){
 return <div className="form-grid"><Field label="Duración de acceso"><select value={value} onChange={e=>setValue(e.target.value)}><option value="">Ilimitado</option>{[1,7,15,30,90].map(v=><option key={v} value={v}>{v} {v===1?"día":"días"} desde ahora</option>)}<option value="custom">Fecha personalizada</option></select></Field>{value==="custom"&&<Field label="Vencimiento · hora de Ecuador"><input type="datetime-local" required value={custom} onChange={e=>setCustom(e.target.value)}/></Field>}</div>;
}
function RulesForm({settings,busy,onChange}:{settings:Settings;busy:boolean;onChange:(value:Pending)=>void}){
 const [mode,setMode]=useState(settings.mode);
 const [days,setDays]=useState(String(settings.default_days??""));
 return <Panel title="Reglas para nuevos usuarios" description="Los cambios se aplican a las altas posteriores."><form className="admin-form" onSubmit={e=>{
 e.preventDefault();onChange({input:{action:"settings",mode,days:days?Number(days):null},title:"Cambiar las reglas de registro",description:modes[mode]+" · "+(days?days+" días de acceso inicial":"Acceso ilimitado"),success:"Reglas de registro actualizadas."});
 }}><fieldset disabled={busy}><Field label="Quién puede registrarse"><select value={mode} onChange={e=>setMode(e.target.value)}>{Object.entries(modes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="Días de acceso inicial" hint="Deja vacío para ofrecer acceso ilimitado."><input type="number" min="1" max="3650" value={days} onChange={e=>setDays(e.target.value)}/></Field><Button type="submit" tone="primary">Guardar reglas</Button></fieldset></form></Panel>;
}
function InvitationForm({busy,onChange}:{busy:boolean;onChange:(value:Pending)=>void}){
 const [email,setEmail]=useState(""),[days,setDays]=useState(""),[custom,setCustom]=useState(""),[error,setError]=useState("");
 return <Panel title="Autorizar una cuenta de Google" description="Permite preparar el acceso cuando el registro está cerrado."><form className="admin-form" onSubmit={e=>{
 e.preventDefault();try{const until=durationDate(days,custom);setError("");onChange({input:{action:"invite",email,until},title:"Autorizar acceso",description:email+" · "+dates(until),success:"Correo autorizado."});}catch(reason){setError(reason instanceof Error?reason.message:"Revisa la fecha.");}
 }}><fieldset disabled={busy}><Field label="Correo de Google"><input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Duration value={days} setValue={setDays} custom={custom} setCustom={setCustom}/>{error&&<p role="alert" className="form-error">{error}</p>}<Button type="submit">Autorizar correo</Button></fieldset></form></Panel>;
}
function UserEditor({user,sessions,sessionPage,sessionTotal,onSessionPage,loading,busy,onClose,onChange}:{user:User;sessions:Session[];sessionPage:number;sessionTotal:number;onSessionPage:(page:number)=>void;loading:boolean;busy:boolean;onClose:()=>void;onChange:(value:Pending)=>void}){
 const [quota,setQuota]=useState(String(user.custom_trades??""));
 const [state,setState]=useState(user.status),[days,setDays]=useState(user.access_until?"custom":""),[custom,setCustom]=useState(localDate(user.access_until)),[suspension,setSuspension]=useState(localDate(user.suspended_until)),[error,setError]=useState("");
 function submit(event:FormEvent){
 event.preventDefault();
 try{
  const until=days==="custom"&&custom===localDate(user.access_until)?user.access_until:durationDate(days,custom);
  const suspendedUntil=state==="suspended"&&suspension?(suspension===localDate(user.suspended_until)?user.suspended_until:inputDate(suspension)):null;
  if(suspendedUntil!==null&&!Number.isFinite(suspendedUntil))throw new Error("Revisa la fecha de suspensión.");
  setError("");
  onChange({input:{action:"user",userId:user.user_id,status:state,until,suspendedUntil},title:"Confirmar permisos de "+user.email,description:"Estado: "+states[state]+". Vencimiento: "+dates(until)+". "+(state==="suspended"?"Suspensión hasta: "+dates(suspendedUntil)+". ":"")+"Se cerrarán sus sesiones actuales. Sus operaciones se conservan.",success:"Permisos actualizados.",closeUser:true});
 }catch(reason){setError(reason instanceof Error?reason.message:"Revisa las fechas.");}
 }
 return <Modal title="Gestionar usuario" subtitle={user.email} onClose={onClose} busy={busy} wide presentation="sheet" protectDraft footer={<><ModalClose disabled={busy}>Cerrar</ModalClose><Button type="submit" form="user-access-form" tone="primary" disabled={busy}>Revisar cambios</Button></>}>
 <dl className="detail-values"><div><dt>Registro</dt><dd>{dates(user.created_at)}</dd></div><div><dt>Último ingreso</dt><dd>{dates(user.last_login)}</dd></div><div><dt>Vencimiento actual</dt><dd>{dates(user.access_until)}</dd></div></dl>
 <form id="user-access-form" className="admin-form" onSubmit={submit}><fieldset disabled={busy}><Field label="Estado del acceso"><select value={state} onChange={e=>setState(e.target.value)}>{["active","pending","suspended","blocked"].map(value=><option key={value} value={value}>{states[value]}</option>)}</select></Field><Duration value={days} setValue={setDays} custom={custom} setCustom={setCustom}/>{state==="suspended"&&<Field label="Suspender hasta · hora de Ecuador" hint="Vacío significa suspensión indefinida."><input type="datetime-local" value={suspension} onChange={e=>setSuspension(e.target.value)}/></Field>}{error&&<p role="alert" className="form-error">{error}</p>}</fieldset></form>
 <section className="detail-section"><h3>Cuota de operaciones</h3><p>{user.trades_used??0} operaciones registradas. Vacío utiliza el máximo general.</p><form className="admin-form" onSubmit={e=>{e.preventDefault();onChange({input:{action:"quota",userId:user.user_id,maxTrades:quota.trim()?Number(quota):null},title:"Actualizar cuota",description:user.email+" · "+(quota?quota+" operaciones":"Límite general")+". Se conservarán todos sus registros.",success:"Cuota actualizada.",closeUser:true})}}><Field label="Máximo individual de operaciones"><input type="number" min={Math.max(1,user.trades_used??0)} max="100000" value={quota} disabled={busy} onChange={e=>setQuota(e.target.value)}/></Field><Button type="submit" disabled={busy}>Revisar cuota</Button></form></section>
 <section className="detail-section"><div className="split"><h3>Sesiones activas</h3><Button disabled={busy||loading||!sessions.length} onClick={()=>onChange({input:{action:"revoke",userId:user.user_id},title:"Cerrar todas las sesiones",description:"Se pedirá a "+user.email+" que vuelva a iniciar sesión en todos sus dispositivos.",success:"Sesiones cerradas."})}>Cerrar todas</Button></div>
 {loading?<p role="status">Consultando sesiones…</p>:sessions.length?sessions.map(session=><article className="admin-session" key={session.token_hash}><Monitor size={20}/><div><strong>{deviceName(session.device)}</strong><p>Inicio {dates(session.created_at)}</p><p>Actividad {dates(session.last_seen)}</p><p>Vence {dates(session.expires_at)}</p><details><summary>Detalles del navegador</summary><p>{session.device}</p></details></div><Button disabled={busy} onClick={()=>onChange({input:{action:"revoke",userId:user.user_id,session:session.token_hash},title:"Cerrar esta sesión",description:user.email+" · "+deviceName(session.device),success:"Sesión cerrada."})}>Cerrar sesión</Button></article>):<Empty title="No hay sesiones activas"/>}
 <div className="pagination"><Button disabled={loading||sessionPage===0} onClick={()=>onSessionPage(sessionPage-1)}>Anterior</Button><span>{sessionTotal} sesiones · Página {sessionPage+1}</span><Button disabled={loading||(sessionPage+1)*50>=sessionTotal} onClick={()=>onSessionPage(sessionPage+1)}>Siguiente</Button></div></section></Modal>;
}
export function Administration(){
 const [data,setData]=useState<Data|null>(null),[q,setQ]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(0),[selected,setSelected]=useState<User|null>(null);
 const [tab,setTab]=useState("users"),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[pending,setPending]=useState<Pending|null>(null);
 const [eventPage,setEventPage]=useState(0),[eventQ,setEventQ]=useState(""),[eventAction,setEventAction]=useState("");
 const [invitePage,setInvitePage]=useState(0),[inviteQ,setInviteQ]=useState("");
 const [sessionPage,setSessionPage]=useState(0);
 const [checkedAt,setCheckedAt]=useState(0);
 const [eventFrom,setEventFrom]=useState(""),[eventTo,setEventTo]=useState("");
 const requestId=useRef(0);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const id=++requestId.current;
  setLoading(true);
  try{
   const eventFromMs=eventFrom?inputDate(eventFrom+"T00:00"):0;
   const eventToMs=eventTo?inputDate(addDays(eventTo,1)+"T00:00"):0;
   const response=await fetch("/api/admin?"+new URLSearchParams({q,status,page:String(page),user:selected?.user_id??"",sessionPage:String(sessionPage),eventPage:String(eventPage),eventQ,eventAction,eventFrom:String(eventFromMs),eventTo:String(eventToMs),invitePage:String(invitePage),inviteQ}),{signal,cache:"no-store"});
   if(!response.ok)throw new Error(response.status===401?"Tu sesión ha caducado. Vuelve a entrar a Tradeify.":"No se pudo consultar la administración.");
   const next=await response.json() as Data;
   if(id===requestId.current){setData(next);setCheckedAt(Date.now());setError("");}
  }finally{if(id===requestId.current&&!signal?.aborted)setLoading(false);}
 },[q,status,page,selected?.user_id,sessionPage,eventPage,eventQ,eventAction,eventFrom,eventTo,invitePage,inviteQ]);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{void refresh(controller.signal).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});},200);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[refresh]);
 async function commit(){
  if(!pending||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json","X-Bitacora-Request":"1"},body:JSON.stringify(pending.input)});
   if(!response.ok){const result=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(result?.error??"No se pudo guardar.");}
   setMessage(pending.success);setPending(null);
   if(pending.closeUser)setSelected(null);
   await refresh();
  }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo guardar.");}
  finally{setBusy(false);}
 }
 return <div className="admin-shell"><header className="admin-header"><Link href="/" aria-label="Volver a mi bitácora"><Brand/></Link><div className="group-buttons"><Link className="button button-quiet" href="/"><ArrowLeft size={16}/>Mi bitácora</Link><ThemeControl/></div></header><main className="workspace-body admin-main">
 <div className="page-head"><div><h1>Administración</h1><p>Usuarios, permisos y actividad de Tradeify.</p></div><span className="tag"><ShieldCheck size={14}/>Cuenta propietaria</span></div>
 <nav className="admin-tabs" aria-label="Secciones de administración">{[["users","Usuarios",Users],["settings","Registro y acceso",Settings2],["activity","Actividad",History],["resources","Recursos y mantenimiento",Monitor]].map(([value,label,Icon])=>{const key=value as string;const Symbol=Icon as typeof Users;return <Button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}><Symbol size={17}/>{label as string}</Button>;})}</nav>
 {tab==="resources"&&<AdminResources refreshToken={checkedAt} busy={busy} onChange={setPending}/>}
 {message&&<p className="informative-note" role="status">{message}</p>}
 {error&&<div className="error-banner" role="alert"><span>{error}</span><Button onClick={()=>{void refresh().catch(e=>setError(e.message));}}>Reintentar</Button><Link className="button" href="/">Volver al inicio</Link></div>}
 {tab==="users"&&data&&<div className="metric-grid admin-metrics">{Object.entries(states).map(([key,label])=><div key={key} className="panel v2-admin-counter"><small>{label}</small><strong>{data.counts.find(c=>c.status===key)?.total??0}</strong></div>)}<div className="panel v2-admin-counter"><small>Total registrados</small><strong>{data.counts.reduce((n,c)=>n+c.total,0)}</strong></div><div className="panel v2-admin-counter"><small>Vencen en 7 días</small><strong>{data.expiring}</strong></div><div className="panel v2-admin-counter"><small>Sesiones no vencidas</small><strong>{data.activeSessions}</strong></div></div>}
 {tab==="users"&&<Panel title="Usuarios registrados" description={data?data.total+(data.total===1?" resultado":" resultados"):"Consulta las cuentas de acceso"}>
 <div className="admin-toolbar"><Field label="Buscar correo"><div className="admin-search"><Search size={17}/><input type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(0);}} placeholder="nombre@correo.com"/></div></Field><Field label="Estado"><select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">Todos los estados</option>{Object.entries(states).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>
 {loading?<Empty title="Cargando usuarios…"/>:data?.users.length?<div className="table-scroll admin-table"><table><thead><tr><th>Correo</th><th>Estado</th><th>Vencimiento</th><th className="admin-extra">Último ingreso</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{data.users.map(user=><tr key={user.user_id}><td className="admin-email">{user.email}</td><td><span className={"tag admin-state-"+(user.display_status??user.status)}>{states[user.display_status??user.status]??"Sin estado"}</span></td><td>{dates(user.access_until)}</td><td className="admin-extra">{dates(user.last_login)}</td><td><Button aria-label={"Gestionar "+user.email} onClick={()=>{setSelected(user);setSessionPage(0);}}>Gestionar</Button></td></tr>)}</tbody></table></div>:!error&&<Empty title={q||status?"No hay usuarios con estos filtros":"Aún no hay usuarios registrados"} description={q||status?"Prueba con otro correo o estado.":"Las cuentas aparecen cuando se identifican con Google."}/>}
 <div className="pagination"><Button disabled={loading||page===0} onClick={()=>setPage(page-1)}>Anterior</Button><span>Página {page+1}</span><Button disabled={loading||(page+1)*50>=(data?.total??0)} onClick={()=>setPage(page+1)}>Siguiente</Button></div></Panel>}
 {tab==="settings"&&(!data?<Empty title="Cargando reglas…"/>:<div className="admin-settings"><RulesForm key={data.settings.mode+":"+data.settings.default_days} settings={data.settings} busy={busy} onChange={setPending}/><InvitationForm busy={busy} onChange={setPending}/><Panel title="Invitaciones" description="Autorizaciones por correo. Revocar una invitación no cambia los permisos de un usuario ya registrado."><div className="v2-tools"><Field label="Buscar invitación"><input type="search" value={inviteQ} onChange={e=>{setInviteQ(e.target.value);setInvitePage(0)}}/></Field></div>{loading?<Empty title="Consultando…"/>:data.invitations.length?<div className="settings-list">{data.invitations.map(i=><div className="settings-row" key={i.email}><div className="settings-name"><strong>{i.email}</strong><small>{i.access_until!==null&&i.access_until<=checkedAt?"Vencida": "Vigente"} · Vence: {dates(i.access_until)} · Creada: {i.created_at===null?"Fecha no registrada":dates(i.created_at)} · Último envío: {i.last_sent_at===null?"Sin registro":dates(i.last_sent_at)} · {i.registered?"Correo registrado":"Sin registro"}</small></div><Button disabled={busy} onClick={()=>setPending({input:{action:"revokeInvite",email:i.email},title:"Revocar invitación",description:"Se retirará la autorización previa para "+i.email+". Si ya tiene cuenta, gestiona sus permisos en Usuarios.",success:"Invitación revocada."})}>Revocar</Button></div>)}</div>:<Empty title="No hay invitaciones."/>}<div className="pagination"><Button disabled={loading||invitePage===0} onClick={()=>setInvitePage(invitePage-1)}>Anterior</Button><span>Página {invitePage+1}</span><Button disabled={loading||(invitePage+1)*50>=data.inviteTotal} onClick={()=>setInvitePage(invitePage+1)}>Siguiente</Button></div></Panel></div>)}
 {tab==="activity"&&<Panel title="Actividad administrativa" description="Historial paginado de cambios de acceso."><div className="form-grid v2-tools"><Field label="Buscar usuario o administrador"><input type="search" value={eventQ} onChange={e=>{setEventQ(e.target.value);setEventPage(0)}}/></Field><Field label="Desde · Ecuador"><input type="date" value={eventFrom} max={eventTo||undefined} onChange={e=>{setEventFrom(e.target.value);setEventPage(0)}}/></Field><Field label="Hasta · Ecuador"><input type="date" value={eventTo} min={eventFrom||undefined} onChange={e=>{setEventTo(e.target.value);setEventPage(0)}}/></Field><Field label="Acción"><select value={eventAction} onChange={e=>{setEventAction(e.target.value);setEventPage(0)}}><option value="">Todas</option>{Object.entries({user:"Permisos",revoke:"Sesiones",settings:"Registro",invite:"Invitaciones",revokeInvite:"Revocación de invitación",quota:"Cuotas",maintenance:"Mantenimiento",alert:"Alertas"}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div>{!data?<Empty title="Consultando actividad…"/>:data.events.length?<ol className="admin-events">{data.events.map(event=><li key={event.id}><strong>{({user:"Permisos actualizados",revoke:"Sesiones cerradas",settings:"Reglas de registro actualizadas",invite:"Correo autorizado",revokeInvite:"Invitación revocada",quota:"Cuota actualizada",maintenance:"Mantenimiento actualizado",alert:"Alerta revisada"}[event.action])??"Acción administrativa"}</strong><p>{event.target||"Reglas generales"}</p><small>{dates(event.created_at)} · {event.actor}</small></li>)}</ol>:<Empty title="No hay cambios con estos filtros"/>}<div className="pagination"><Button disabled={loading||eventPage===0} onClick={()=>setEventPage(eventPage-1)}>Anterior</Button><span>Página {eventPage+1}</span><Button disabled={loading||(eventPage+1)*50>=(data?.eventTotal??0)} onClick={()=>setEventPage(eventPage+1)}>Siguiente</Button></div></Panel>}
 </main>{selected&&<UserEditor key={selected.user_id} user={selected} sessions={loading?[]:(data?.sessions??[]).filter(session=>session.user_id===selected.user_id)} sessionPage={sessionPage} sessionTotal={data?.sessionTotal??0} onSessionPage={setSessionPage} loading={loading} busy={busy} onClose={()=>setSelected(null)} onChange={setPending}/>}
 {pending&&<Modal title={pending.title} busy={busy} onClose={()=>setPending(null)} footer={<><ModalClose disabled={busy}>Cancelar</ModalClose><Button tone={pending.input.action==="revoke"||pending.input.status==="blocked"?"danger":"primary"} disabled={busy} onClick={commit}>{busy?"Aplicando…":"Confirmar"}</Button></>}><p>{pending.description}</p>{error&&<p className="form-error" role="alert">{error}</p>}</Modal>}
 </div>;
}
