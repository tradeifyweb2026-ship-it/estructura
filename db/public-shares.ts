import {blankJournal,type Trade,type Account,type Setup} from '../lib/journal';
import {terminalCardData} from '../lib/terminal-card';
import {publicOrigin,publicProjection,publicSnapshotSchema,publicTokenHash,publicTokenPattern,PUBLIC_SHARE_TTL,type PublicShareAction,type PublicSnapshot} from '../lib/public-share';
import {JournalError} from './repository';
import {base64url} from '../worker/session';
type Source={id:string;version:number;opened_at:number;account_id:string|null;setup_id:string|null;data:string;account_version:number|null;account_data:string|null;setup_version:number|null;setup_data:string|null};
const changed=()=>new JournalError('La operación o su cuenta cambiaron. Actualiza y revisa de nuevo los campos antes de compartir.',409);
export async function createPublicShare(db:D1Database,user:string,input:Extract<PublicShareAction,{action:'create'}>,origin:string,now=Date.now()){
 try{origin=publicOrigin(origin);}catch{throw new JournalError('Configura una dirección HTTPS válida para compartir.',503);}
 const row=await db.prepare(`SELECT t.id,t.version,t.opened_at,t.account_id,t.setup_id,t.data,a.version account_version,a.data account_data,s.version setup_version,s.data setup_data FROM trades t LEFT JOIN accounts a ON a.user_id=t.user_id AND a.id=t.account_id LEFT JOIN setups s ON s.user_id=t.user_id AND s.id=t.setup_id WHERE t.user_id=? AND t.id=?`).bind(user,input.tradeId).first<Source>();
 if(!row)throw new JournalError('Operación no disponible.',404);
 if(row.version!==input.tradeVersion||row.account_version!==input.accountVersion)throw changed();
 const trade={...JSON.parse(row.data),id:row.id,version:row.version,openedAt:row.opened_at,accountId:row.account_id,setupId:row.setup_id} as Trade;
 const accounts:Account[]=row.account_data?[{...JSON.parse(row.account_data),id:row.account_id,version:row.account_version}]:[];
 const setups:Setup[]=row.setup_data?[{...JSON.parse(row.setup_data),id:row.setup_id,version:row.setup_version}]:[];
 const v=input.visibility,card=terminalCardData(trade,{...blankJournal,accounts,setups,trades:[trade]},now,{money:v.money,prices:v.prices,strategies:v.strategy,notes:v.notes,captures:v.captures,account:false});
 const snapshot=publicProjection(card,v),id=crypto.randomUUID(),token=base64url(crypto.getRandomValues(new Uint8Array(32))),expires=now+PUBLIC_SHARE_TTL;
 if(input.expectedSnapshot&&JSON.stringify(publicSnapshotSchema.parse(input.expectedSnapshot))!==JSON.stringify(snapshot))throw changed();
 const guard=db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM trades WHERE user_id=? AND id=? AND version=? AND data=? AND opened_at=? AND account_id IS ? AND setup_id IS ?) AND (? IS NULL OR EXISTS(SELECT 1 FROM accounts WHERE user_id=? AND id=? AND version=? AND data=?)) AND (? IS NULL OR EXISTS(SELECT 1 FROM setups WHERE user_id=? AND id=? AND version=? AND data=?)) THEN 1 ELSE json('public_source_changed') END`).bind(user,row.id,row.version,row.data,row.opened_at,row.account_id,row.setup_id,row.account_id,user,row.account_id,row.account_version,row.account_data,row.setup_id,user,row.setup_id,row.setup_version,row.setup_data);
 try{await db.batch([guard,db.prepare('INSERT INTO public_trade_shares(id,user_id,trade_id,account_id,token_hash,snapshot,visibility,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user,row.id,row.account_id,await publicTokenHash(token),JSON.stringify(snapshot),JSON.stringify(v),now,expires)]);}catch(error){for(let e=error;e instanceof Error;e=e.cause){if(/public_share_quota/.test(e.message))throw new JournalError('Tienes 100 enlaces activos. Revoca uno antes de crear otro.',422);if(/public_source_changed|malformed JSON|FOREIGN KEY constraint failed/.test(e.message))throw changed();}throw error;}
 return {id,url:origin+'/p/'+token,createdAt:now,expiresAt:expires,snapshot,visibility:v};
}
export async function listPublicShares(db:D1Database,user:string,tradeId:string,now=Date.now()){
 const rows=await db.prepare('SELECT id,created_at,expires_at,snapshot,visibility FROM public_trade_shares WHERE user_id=? AND trade_id=? AND expires_at>? ORDER BY created_at DESC,id DESC LIMIT 100').bind(user,tradeId,now).all<{id:string;created_at:number;expires_at:number;snapshot:string;visibility:string}>();
 return {items:rows.results.map(r=>({id:r.id,createdAt:r.created_at,expiresAt:r.expires_at,snapshot:publicSnapshotSchema.parse(JSON.parse(r.snapshot)),visibility:JSON.parse(r.visibility)}))};
}
export async function revokePublicShare(db:D1Database,user:string,id:string){await db.prepare('DELETE FROM public_trade_shares WHERE user_id=? AND id=?').bind(user,id).run();return {id,revoked:true};}
export async function readPublicShare(db:D1Database,token:string,now=Date.now()):Promise<{snapshot:PublicSnapshot;expiresAt:number}|null>{
 if(!publicTokenPattern.test(token))return null;
 const row=await db.prepare('SELECT snapshot,expires_at FROM public_trade_shares WHERE token_hash=? AND expires_at>?').bind(await publicTokenHash(token),now).first<{snapshot:string;expires_at:number}>();
 if(!row)return null;const parsed=publicSnapshotSchema.safeParse(JSON.parse(row.snapshot));return parsed.success?{snapshot:parsed.data,expiresAt:row.expires_at}:null;
}
/** Bounded indexed cleanup; expiration itself never depends on cron. */
export async function cleanupPublicShares(db:D1Database,now=Date.now()){
 const result=await db.prepare('DELETE FROM public_trade_shares WHERE id IN (SELECT id FROM public_trade_shares WHERE expires_at<=? ORDER BY expires_at,id LIMIT 100)').bind(now).run();return result.meta.changes;
}
