import {readJson,RequestBodyError} from "../lib/request-body";
import {z} from "../lib/validation.ts";
import {adminOperations,adminResources,mutateAdminOperation} from "./admin-resources";
import {noCache} from "./session";
import {effectiveAccess} from "../lib/access-state.mjs";

export type AccessUser = {user_id:string;email:string;created_at:number;last_login:number;status:string;access_until:number|null;suspended_until:number|null};
export function isAdmin(email: string, owner?: string) {
  return !!owner && email === owner.trim().toLowerCase();
}
export function accessAllowed(user: AccessUser, now = Date.now()) {
  return effectiveAccess(user,now)==="active";
}
export async function registerUser(db:D1Database,userId:string,email:string,admin:boolean) {
  const now = Date.now();
  const settings = await db.prepare("SELECT mode,default_days FROM access_settings WHERE id=1").first<{mode:string;default_days:number|null}>();
  const invite = await db.prepare("SELECT access_until FROM access_invitations WHERE email=? AND (access_until IS NULL OR access_until>?)").bind(email,now).first<{access_until:number|null}>();
  const existing = await db.prepare("SELECT user_id FROM users WHERE user_id=?").bind(userId).first();
  const closed = settings?.mode === "closed" && !invite && !admin && !existing;
  const status = admin || invite || !settings || settings.mode === "public" ? "active" : "pending";
  if (!closed) await db.prepare("INSERT INTO users(user_id,email,created_at,last_login,status,access_until) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,last_login=excluded.last_login")
    .bind(userId,email,now,now,status,admin ? null : invite ? invite.access_until : settings?.default_days ? now+settings.default_days*86400000 : null).run();
  return closed ? null : db.prepare("SELECT * FROM users WHERE user_id=?").bind(userId).first<AccessUser>();
}
const actionSchema = z.discriminatedUnion("action",[
  z.object({action:z.literal("settings"),mode:z.enum(["public","approval","closed"]),days:z.number().int().min(1).max(3650).nullable()}),
  z.object({action:z.literal("invite"),email:z.email().max(254),until:z.number().int().positive().nullable()}),
  z.object({action:z.literal("user"),userId:z.string().min(1).max(160),status:z.enum(["active","blocked","suspended","pending"]),until:z.number().int().positive().nullable(),suspendedUntil:z.number().int().positive().nullable()}),
  z.object({action:z.literal("revokeInvite"),email:z.email().max(254)}),
  z.object({action:z.literal("revoke"),userId:z.string().min(1).max(160),session:z.string().max(100).optional()}),
  z.object({action:z.literal("quota"),userId:z.string().min(1).max(160),maxTrades:z.number().int().min(1).max(100000).nullable()}),
]);
export async function adminApi(request:Request,db:D1Database,actor:string,owner:string,configuredLimit?:string) {
  const url=new URL(request.url);
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:noCache});
  if(request.method === "GET"){
    if(url.searchParams.get("mode")==="resources"){const from=Number(url.searchParams.get("from")??0),to=Number(url.searchParams.get("to")??Date.now()+1);if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from)return json({error:"Rango no válido."},422);const alertPage=Number(url.searchParams.get('alertPage')??0),filter=url.searchParams.get('alertFilter')??'all',q=(url.searchParams.get('alertQ')??'').slice(0,254);if(!Number.isSafeInteger(alertPage)||alertPage<0||alertPage>100000||!['all','active','reviewed','resolved'].includes(filter))return json({error:'Filtros de alertas no válidos.'},422);return json(await adminResources(db,configuredLimit,from,to,{page:alertPage,filter,q}));}
    const page=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get("page"))||0)));
    const query=(url.searchParams.get("q")??"").slice(0,254);
    const status=url.searchParams.get("status")??"";
    const now=Date.now();
    const boundedPage=(key:string)=>Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get(key))||0)));
    const eventPage=boundedPage("eventPage"),invitePage=boundedPage("invitePage"),sessionPage=boundedPage("sessionPage");
    const eventQuery=(url.searchParams.get("eventQ")??"").slice(0,254),eventAction=(url.searchParams.get("eventAction")??"").slice(0,32);
    const eventFrom=Math.max(0,Math.min(4_102_444_800_000,Math.floor(Number(url.searchParams.get("eventFrom"))||0)));
    const eventTo=Math.max(0,Math.min(4_102_444_800_000,Math.floor(Number(url.searchParams.get("eventTo"))||0)));
    const inviteQuery=(url.searchParams.get("inviteQ")??"").slice(0,254);
    const eventWhere="(instr(lower(target),lower(?))>0 OR instr(lower(actor),lower(?))>0) AND (?='' OR action=?) AND (?=0 OR created_at>=?) AND (?=0 OR created_at<?)";
    const eventArgs=[eventQuery,eventQuery,eventAction,eventAction,eventFrom,eventFrom,eventTo,eventTo];
    const effective="CASE WHEN status IN ('blocked','pending') THEN status WHEN status NOT IN ('active','suspended') THEN 'blocked' WHEN access_until IS NOT NULL AND access_until<="+now+" THEN 'expired' WHEN status='suspended' AND (suspended_until IS NULL OR suspended_until>"+now+") THEN 'suspended' ELSE 'active' END";
    const where="instr(lower(email),lower(?))>0 AND (?='' OR ("+effective+")=?)";
    const args=[query,status,status];
    const [users,count,sessions,sessionCount,events,settings,eventCount,invites,inviteCount,counts,expiring,activeSessions]=await db.batch([
      db.prepare("SELECT *, (SELECT custom_trades FROM user_limits l WHERE l.user_id=users.user_id) custom_trades,(SELECT count(*) FROM trades t WHERE t.user_id=users.user_id) trades_used,("+effective+") AS display_status FROM users WHERE "+where+" ORDER BY created_at DESC,user_id LIMIT 50 OFFSET ?").bind(...args,page*50),
      db.prepare("SELECT count(*) total FROM users WHERE "+where).bind(...args),
      db.prepare("SELECT token_hash,user_id,expires_at,created_at,last_seen,device FROM auth_sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC,token_hash DESC LIMIT 50 OFFSET ?").bind((url.searchParams.get("user")??"").slice(0,160),now,sessionPage*50),
      db.prepare("SELECT count(*) total FROM auth_sessions WHERE user_id=? AND expires_at>?").bind((url.searchParams.get("user")??"").slice(0,160),now),
      db.prepare("SELECT id,actor,target,action,created_at FROM admin_events WHERE "+eventWhere+" ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?").bind(...eventArgs,eventPage*50),
      db.prepare("SELECT * FROM access_settings WHERE id=1"),
      db.prepare("SELECT count(*) total FROM admin_events WHERE "+eventWhere).bind(...eventArgs),
      db.prepare("SELECT i.email,i.access_until,(SELECT min(e.created_at) FROM admin_events e WHERE e.action='invite' AND e.target=i.email AND e.rowid>coalesce((SELECT max(r.rowid) FROM admin_events r WHERE r.action='revokeInvite' AND r.target=i.email),0)) created_at,(SELECT max(e.created_at) FROM admin_events e WHERE e.action='invite' AND e.target=i.email AND e.rowid>coalesce((SELECT max(r.rowid) FROM admin_events r WHERE r.action='revokeInvite' AND r.target=i.email),0)) last_sent_at,EXISTS(SELECT 1 FROM users u WHERE u.email=i.email) registered FROM access_invitations i WHERE instr(lower(i.email),lower(?))>0 ORDER BY i.email LIMIT 50 OFFSET ?").bind(inviteQuery,invitePage*50),
      db.prepare("SELECT count(*) total FROM access_invitations WHERE instr(lower(email),lower(?))>0").bind(inviteQuery),
      db.prepare("SELECT ("+effective+") status,count(*) total FROM users GROUP BY 1"),
      db.prepare("SELECT count(*) total FROM users WHERE ("+effective+")='active' AND access_until>? AND access_until<=?").bind(now,now+7*86400000),
      db.prepare("SELECT count(*) total FROM auth_sessions WHERE expires_at>?").bind(now),
    ]);
    const total=(result:D1Result)=>Number((result.results[0] as {total?:number}|undefined)?.total??0);
    return json({users:users.results,total:total(count),sessions:sessions.results,sessionTotal:total(sessionCount),events:events.results,eventTotal:total(eventCount),invitations:invites.results,inviteTotal:total(inviteCount),counts:counts.results,expiring:total(expiring),activeSessions:total(activeSessions),settings:settings.results[0]??{mode:"public",default_days:null}});
  }
  if(request.method !== "POST")return json({error:"Método no permitido."},405);
  let payload:unknown;
  try { payload=await readJson(request,16384); }
  catch(error) { if(error instanceof RequestBodyError)return json({error:error.message},error.status); throw error; }
  const operation=adminOperations.safeParse(payload);if(operation.success)return mutateAdminOperation(db,actor,operation.data,configuredLimit);
  const parsed=actionSchema.safeParse(payload);
  if(!parsed.success)return json({error:"Revisa los datos y las fechas."},422);
  const input=parsed.data, statements:D1PreparedStatement[]=[];
  let target="";
  if(input.action==="settings")statements.push(db.prepare("INSERT INTO access_settings VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,default_days=excluded.default_days").bind(input.mode,input.days));
  if(input.action==="revokeInvite"){
    target=input.email.trim().toLowerCase();
    if(isAdmin(target,owner))return json({error:"La cuenta administradora está protegida."},422);
    statements.push(db.prepare("DELETE FROM access_invitations WHERE email=?").bind(target));
  }
  if(input.action==="invite"){
    target=input.email.trim().toLowerCase();
    if(isAdmin(target,owner))return json({error:"La cuenta administradora está protegida."},422);
    if(input.until!==null&&input.until<=Date.now())return json({error:"La invitación debe vencer en el futuro."},422);
    const existing=await db.prepare("SELECT user_id FROM users WHERE email=? AND status IN ('blocked','suspended')").bind(target).first();
    if(existing)return json({error:"Este usuario tiene acceso bloqueado o suspendido. Cambia sus permisos desde Usuarios."},409);
    statements.push(db.prepare("INSERT INTO access_invitations VALUES (?,?) ON CONFLICT(email) DO UPDATE SET access_until=excluded.access_until").bind(target,input.until));
    statements.push(db.prepare("UPDATE users SET status='active',access_until=?,suspended_until=NULL WHERE email=? AND status NOT IN ('blocked','suspended')").bind(input.until,target));
    statements.push(db.prepare("DELETE FROM auth_sessions WHERE user_id IN (SELECT user_id FROM users WHERE email=?)").bind(target));
  }
  if(input.action==="user"||input.action==="revoke"||input.action==="quota"){
    target=input.userId;
    const user=await db.prepare("SELECT email FROM users WHERE user_id=?").bind(target).first<{email:string}>();
    if(!user)return json({error:"Usuario no encontrado."},404);
    if(isAdmin(user.email,owner))return json({error:"La cuenta administradora está protegida."},422);
    if(input.action==="user"){
      statements.push(db.prepare("UPDATE users SET status=?,access_until=?,suspended_until=? WHERE user_id=?").bind(input.status,input.until,input.suspendedUntil,target));
      statements.push(db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(target));
    }else if(input.action==="quota"){
      const configured=Number(configuredLimit);
      const effective=input.maxTrades??(Number.isSafeInteger(configured)&&configured>0?configured:5000);
      const used=Number(await db.prepare("SELECT count(*) n FROM trades WHERE user_id=?").bind(target).first("n"));
      if(effective<used)return json({error:`El usuario tiene ${used} operaciones; el límite no puede ser menor. No se eliminaron datos.`},422);
      statements.push(db.prepare("INSERT INTO user_limits(user_id,trades,custom_trades) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET trades=excluded.trades,custom_trades=excluded.custom_trades").bind(target,effective,input.maxTrades));
    }else{
      statements.push(input.session?db.prepare("DELETE FROM auth_sessions WHERE user_id=? AND token_hash=?").bind(target,input.session):db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(target));
    }
  }
  statements.push(db.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),actor,target,input.action,Date.now(),JSON.stringify(input.action==="revoke"?{action:"revoke",userId:input.userId,scope:input.session?"individual":"all"}:input)));
  await db.batch(statements);
  return json({ok:true});
}
