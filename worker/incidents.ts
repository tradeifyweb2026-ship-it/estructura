export type IncidentCode='runtime_failure'|'storage_failure'|'configuration_incomplete';
const sampledAt=new Map<IncidentCode,number>();
// At most one observation per code/minute/isolate. This is an incident signal,
// never a count of all errors or a substitute for Cloudflare billing metrics.
export async function recordIncident(db:D1Database,code:IncidentCode,now=Date.now()){
 if(now-(sampledAt.get(code)??0)<60000)return;
 sampledAt.set(code,now);
 try{await db.prepare('INSERT INTO operational_incidents(code,first_at,last_at) VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET last_at=excluded.last_at,observations=observations+1').bind(code,now,now).run();}catch{sampledAt.delete(code);}
}
