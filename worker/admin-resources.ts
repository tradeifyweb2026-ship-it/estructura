import {z} from "../lib/validation.ts";
import {noCache} from './session';
export type Maintenance={version:number;active:boolean;message:string;startedAt:number|null;until:number|null};
export async function maintenanceState(db:D1Database):Promise<Maintenance>{const r=await db.prepare('SELECT version,active,message,started_at,until_at FROM maintenance_state WHERE id=1').first<{version:number;active:number;message:string;started_at:number|null;until_at:number|null}>();return {version:r?.version??0,active:r?.active===1,message:r?.message??'',startedAt:r?.started_at??null,until:r?.until_at??null};}
export async function adminResources(db:D1Database,configuredLimit?:string,from=0,to=Date.now()+1,selection:{page?:number;filter?:string;q?:string;id?:string}={}){
 const now=Date.now(),span=Math.max(1,to-from),before=Math.max(0,from-span),max=Number(configuredLimit)||5000;
 const resources=['trades','accounts','setups','reviews','attachments','users','auth_sessions','admin_events','storage_deletions'] as const;
 const [counts,invites,quotas,growth,events,saved,maintenance]=await Promise.all([
  db.batch(resources.map(table=>db.prepare(`SELECT count(*) total FROM ${table}`))),
  db.prepare('SELECT email,access_until FROM access_invitations ORDER BY email').all<{email:string;access_until:number|null}>(),
  db.prepare('SELECT u.user_id,u.email,count(t.id) used,coalesce(l.custom_trades,l.trades,?) quota FROM users u LEFT JOIN trades t ON t.user_id=u.user_id LEFT JOIN user_limits l ON l.user_id=u.user_id GROUP BY u.user_id HAVING used>=quota*0.8 ORDER BY (1.0*used/quota) DESC,u.user_id').bind(max).all<{user_id:string;email:string;used:number;quota:number}>(),
  db.prepare('SELECT sum(created_at>=? AND created_at<?) current,sum(created_at>=? AND created_at<?) previous FROM users').bind(from,to,before,from).first<{current:number;previous:number}>(),
  db.prepare('SELECT count(*) total FROM admin_events WHERE created_at>=? AND created_at<?').bind(from,to).first<{total:number}>(),
  db.prepare('SELECT * FROM admin_alert_state ORDER BY updated_at DESC LIMIT 100').all<{id:string;status:string;label:string;updated_by:string;updated_at:number}>(),
  maintenanceState(db)
 ]);
 const alerts: {id:string;label:string;kind:string;target:string;conditionActive:boolean;status:string;updatedAt?:number;updatedBy?:string}[]=quotas.results.map(q=>({id:'quota:'+q.user_id,label:q.email+' · '+q.used+'/'+q.quota+' operaciones',kind:q.used>=q.quota?'quota_reached':'quota_near',target:q.user_id,conditionActive:true,status:'active'}));
 for(const i of invites.results)if(i.access_until!==null&&i.access_until<=now+7*86400000)alerts.push({id:'invite:'+i.email,label:i.email+(i.access_until<=now?' · invitación vencida':' · invitación vence en 7 días'),kind:'invitation',target:i.email,conditionActive:true,status:'active'});
 const pendingStorage=Number((counts[resources.indexOf('storage_deletions')].results[0] as {total:number}|undefined)?.total??0);
 if(pendingStorage)alerts.push({id:'storage-cleanup',label:pendingStorage+' capturas pendientes de limpieza técnica; comprobar R2 y ejecución programada',kind:'storage',target:'system',conditionActive:true,status:'active'});
 const incidents=await db.prepare('SELECT code,first_at,last_at,observations FROM operational_incidents ORDER BY last_at DESC LIMIT 10').all<{code:string;first_at:number;last_at:number;observations:number}>();
 for(const i of incidents.results){const label=({runtime_failure:'Fallo de aplicación o base de datos',storage_failure:'Fallo de capturas con almacenamiento configurado',configuration_incomplete:'Configuración de acceso incompleta'} as Record<string,string>)[i.code];if(label)alerts.push({id:'incident:'+i.code,label:label+' · última observación '+new Date(i.last_at).toISOString()+' · '+i.observations+' muestras; no equivale al número total de fallos ni confirma que persistan',kind:'incident',target:'system',conditionActive:i.last_at>=now-86400000,status:'active'});}
 const expired=await db.prepare("SELECT user_id,email FROM users WHERE access_until<=? AND status NOT IN('blocked','pending') ORDER BY access_until").bind(now).all<{user_id:string;email:string}>();for(const u of expired.results)alerts.push({id:'access:'+u.user_id,label:u.email+' · acceso vencido',kind:'access',target:u.user_id,conditionActive:true,status:'active'});
 if(maintenance.active)alerts.push({id:'maintenance',label:maintenance.until!==null&&maintenance.until<now?'Mantenimiento superó la finalización prevista; sigue activo hasta desactivación explícita':'Mantenimiento activo',kind:'maintenance',target:'system',conditionActive:true,status:'active'});
 for(const a of alerts){const s=saved.results.find(s=>s.id===a.id);if(s){a.status=s.status;a.updatedAt=s.updated_at;a.updatedBy=s.updated_by;}}
 for(const s of saved.results)if(!alerts.some(a=>a.id===s.id))alerts.push({id:s.id,label:s.label,kind:'history',target:'',conditionActive:false,status:s.status,updatedAt:s.updated_at,updatedBy:s.updated_by});
 const filtered=alerts.filter(a=>(!selection.id||a.id===selection.id)&&(!selection.q||a.label.toLocaleLowerCase('es').includes(selection.q.toLocaleLowerCase('es')))&&(selection.filter==='active'?a.conditionActive:selection.filter==='reviewed'||selection.filter==='resolved'?a.status===selection.filter:true)),page=selection.page??0;
 return {alertTotal:filtered.length,alertPage:page,counts:Object.fromEntries(resources.map((key,i)=>[key,Number((counts[i].results[0] as {total:number}|undefined)?.total??0)])),invitations:{active:invites.results.filter(i=>i.access_until===null||i.access_until>now).length,expired:invites.results.filter(i=>i.access_until!==null&&i.access_until<=now).length},growth:{from,to,newUsers:growth?.current??0,previousNewUsers:growth?.previous??0,adminEvents:events?.total??0},quotaAlerts:quotas.results.slice(0,20),alerts:filtered.slice(page*20,page*20+20),maintenance,external:{workersRequests:null,d1Reads:null,d1Writes:null,d1Storage:null,r2Storage:null,r2Operations:null,reason:'No hay una integración autorizada de métricas de Cloudflare; los conteos internos no son consumo ni facturación.'},observedAt:now};
}
export const adminOperations=z.discriminatedUnion('action',[
 z.object({action:z.literal('maintenance'),version:z.number().int().nonnegative(),active:z.boolean(),message:z.string().trim().max(500),until:z.number().int().positive().nullable()}),
 z.object({action:z.literal('alert'),id:z.string().min(1).max(350),status:z.enum(['reviewed','resolved'])})
]);
export async function mutateAdminOperation(db:D1Database,actor:string,input:z.infer<typeof adminOperations>,configuredLimit?:string){
 const json=(v:unknown,status=200)=>Response.json(v,{status,headers:noCache}),now=Date.now();
 if(input.action==='maintenance'){
  if(input.active&&input.until!==null&&input.until<=now)return json({error:'La finalización prevista debe estar en el futuro.'},422);
  const event=crypto.randomUUID();
  const result=await db.batch([db.prepare('INSERT INTO admin_events SELECT ?,?,?,?,?,? WHERE (SELECT version FROM maintenance_state WHERE id=1)=? RETURNING id').bind(event,actor,'system','maintenance',now,JSON.stringify({active:input.active,message:input.message,until:input.until,result:'applied',version:input.version+1}),input.version),db.prepare('UPDATE maintenance_state SET version=version+1,active=?,message=?,started_at=CASE WHEN ?=1 AND active=0 THEN ? ELSE started_at END,until_at=?,updated_by=?,updated_at=? WHERE id=1 AND version=? AND EXISTS(SELECT 1 FROM admin_events WHERE id=?) RETURNING version').bind(input.active?1:0,input.message,input.active?1:0,now,input.until,actor,now,input.version,event)]);
  return result[1].results.length?json({ok:true,maintenance:await maintenanceState(db)}):json({error:'El estado cambió en otra sesión. Actualiza antes de continuar.'},409);
 }
 const resources=await adminResources(db,configuredLimit,0,Date.now()+1,{id:input.id}),alert=resources.alerts.find(a=>a.id===input.id);if(!alert)return json({error:'Alerta no encontrada; actualiza los indicadores.'},404);
 await db.batch([db.prepare('INSERT INTO admin_alert_state VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,label=excluded.label,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(alert.id,input.status,alert.label,actor,now),db.prepare('INSERT INTO admin_events VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,alert.target,'alert',now,JSON.stringify({id:alert.id,status:input.status,conditionActive:alert.conditionActive,result:'applied'}))]);return json({ok:true});
}
