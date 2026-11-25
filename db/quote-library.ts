import {z} from "../lib/validation.ts";
import {createHash} from 'node:crypto';
import {JournalError} from './repository';
import {archivedQuotes,eligibleQuotes,QUOTE_CATEGORIES,type Quote} from '../lib/quote-catalog';
import {dayKey,timeLabel,weekday} from '../lib/journal';
const categories=z.enum(Object.keys(QUOTE_CATEGORIES) as [keyof typeof QUOTE_CATEGORIES,...(keyof typeof QUOTE_CATEGORIES)[]]);
export const quotePreferences=z.object({enabled:z.boolean().default(true),sound:z.boolean().default(false),volume:z.number().min(0).max(100).default(20),after:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).default('00:00'),frequency:z.enum(['weekdays','daily']).default('weekdays'),categories:z.array(categories).max(13).default([])});
export const quoteAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('preferences'),version:z.number().int().nonnegative(),patch:quotePreferences.partial()}),
 z.object({action:z.literal('favorite'),id:z.number().int().positive(),saved:z.boolean()}),
 z.object({action:z.literal('deliver'),manual:z.boolean().default(false),nonce:z.uuid().optional()}),
 z.object({action:z.literal('migrate'),saved:z.array(z.number().int().positive()).max(100),history:z.array(z.number().int().positive()).max(100)})
]);
export type QuotePreferences=z.infer<typeof quotePreferences>;
export async function quoteLibrary(db:D1Database,user:string,params:URLSearchParams){
 const page=Math.max(0,Math.min(100000,Number(params.get('page'))||0)),kind=params.get('view')==='favorites'?'favorites':'history',q=(params.get('q')??'').slice(0,220),category=params.get('category')??'',order=params.get('order')==='oldest'?'ASC':'DESC';
 if(!Number.isInteger(page))throw new JournalError('Página no válida.',422);
 const table=kind==='favorites'?'quote_favorites':'quote_deliveries',filter="user_id=? AND instr(lower(json_extract(snapshot,'$.text')),lower(?))>0 AND (?='' OR json_extract(snapshot,'$.category')=?)",args=[user,q,category,category];
 const [state,rows,count,favorites]=await db.batch([db.prepare('SELECT version,preferences FROM quote_state WHERE user_id=?').bind(user),db.prepare(`SELECT snapshot,created_at FROM ${table} WHERE ${filter} ORDER BY created_at ${order},${kind==='favorites'?'quote_id':'delivery_key'} ${order} LIMIT 21 OFFSET ?`).bind(...args,page*20),db.prepare(`SELECT count(*) total FROM ${table} WHERE ${filter}`).bind(...args),db.prepare('SELECT quote_id FROM quote_favorites WHERE user_id=?').bind(user)]);
 const s=state.results[0] as {version:number;preferences:string}|undefined;
 return {version:s?.version??0,preferences:quotePreferences.parse(s?JSON.parse(s.preferences):{}),items:(rows.results as {snapshot:string;created_at:number}[]).slice(0,20).map(r=>({...JSON.parse(r.snapshot),at:r.created_at})),next:rows.results.length>20,total:(count.results[0] as {total:number}|undefined)?.total??0,favorites:(favorites.results as {quote_id:number}[]).map(r=>Number(r.quote_id)),page};
}
export async function mutateQuote(db:D1Database,user:string,input:z.infer<typeof quoteAction>,now=Date.now()):Promise<unknown>{
 await db.prepare('INSERT INTO quote_state(user_id) VALUES (?) ON CONFLICT DO NOTHING').bind(user).run();
 if(input.action==='preferences'){
  const s=await db.prepare('SELECT version,preferences FROM quote_state WHERE user_id=?').bind(user).first<{version:number;preferences:string}>();
  if(!s||s.version!==input.version)throw new JournalError('Las preferencias cambiaron en otro dispositivo. Sincroniza y vuelve a aplicar tus cambios.',409);
  const prefs=quotePreferences.parse({...JSON.parse(s.preferences),...input.patch}),result=await db.prepare('UPDATE quote_state SET preferences=?,version=version+1 WHERE user_id=? AND version=? RETURNING version').bind(JSON.stringify(prefs),user,input.version).all();
  if(!result.results.length)throw new JournalError('Conflicto de preferencias. Vuelve a sincronizar.',409);
  return {preferences:prefs,version:input.version+1};
 }
 if(input.action==='favorite'){
  const quote=archivedQuotes.find(q=>q.id===input.id);if(!quote)throw new JournalError('Frase no disponible; se conservan tus datos locales.',422);
  if(input.saved)await db.prepare('INSERT INTO quote_favorites VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(user,input.id,now,JSON.stringify(quote)).run();else await db.prepare('DELETE FROM quote_favorites WHERE user_id=? AND quote_id=?').bind(user,input.id).run();return {ok:true};
 }
 if(input.action==='migrate'){
  const catalog=new Map(archivedQuotes.map(q=>[q.id,q])),skipped=[...new Set([...input.saved,...input.history])].filter(id=>!catalog.has(id));
  const resolve=(ids:number[])=>[...new Set(ids)].flatMap(id=>catalog.get(id)??[]);
  const saved=resolve(input.saved),history=resolve(input.history);
  // Set-based writes keep legacy imports bounded to four statements, including
  // state initialization. Imported eligible phrases count as seen this cycle.
  await db.batch([
   db.prepare("INSERT INTO quote_favorites SELECT ?,json_extract(value,'$.id'),?,value FROM json_each(?) WHERE 1 ON CONFLICT DO NOTHING").bind(user,now,JSON.stringify(saved)),
   db.prepare("INSERT INTO quote_deliveries SELECT ?,'legacy:'||json_extract(j.value,'$.id'),json_extract(j.value,'$.id'),CASE WHEN EXISTS(SELECT 1 FROM quote_deliveries d WHERE d.user_id=? AND d.cycle=(SELECT cycle FROM quote_state WHERE user_id=?) AND d.quote_id=json_extract(j.value,'$.id')) THEN -1 ELSE (SELECT cycle FROM quote_state WHERE user_id=?) END,?,?,json_extract(j.value,'$.category'),j.value FROM json_each(?) j WHERE 1 ON CONFLICT DO NOTHING").bind(user,user,user,user,dayKey(now),now,JSON.stringify(history)),
   db.prepare('UPDATE quote_state SET sequence=sequence+1 WHERE user_id=? AND ?>0').bind(user,history.length)
  ]);return {ok:true,skipped};
 }
 const day=dayKey(now),key=input.manual?'manual:'+input.nonce:'daily:'+day;
 if(input.manual&&!input.nonce)throw new JournalError('Falta el identificador de la solicitud.',422);
 for(let attempt=0;attempt<5;attempt++){
  const previous=await db.prepare('SELECT snapshot FROM quote_deliveries WHERE user_id=? AND delivery_key=?').bind(user,key).first<{snapshot:string}>();if(previous)return {day,quote:JSON.parse(previous.snapshot)};
  const state=await db.prepare('SELECT preferences,sequence,cycle,version FROM quote_state WHERE user_id=?').bind(user).first<{preferences:string;sequence:number;cycle:number;version:number}>();if(!state)throw new JournalError('No se pudo preparar la frase.',503);
  const prefs=quotePreferences.parse(JSON.parse(state.preferences));if(!input.manual&&(!prefs.enabled||prefs.frequency==='weekdays'&&weekday(day)>=5||timeLabel(now)<prefs.after))return {day,quote:null};
  const count=await db.prepare("SELECT count(*) n FROM quote_deliveries WHERE user_id=? AND day=? AND delivery_key LIKE 'manual:%'").bind(user,day).first<number>('n');if(input.manual&&(count??0)>=200)throw new JournalError('Has alcanzado los 200 cambios manuales de hoy.',429);
  const pool=eligibleQuotes.filter(q=>!prefs.categories.length||prefs.categories.includes(q.category));if(!pool.length)throw new JournalError('No hay frases originales en estas categorías. Cambia la selección.',422);
  const used=await db.prepare('SELECT quote_id FROM quote_deliveries WHERE user_id=? AND cycle=?').bind(user,state.cycle).all<{quote_id:number}>(),ids=new Set(used.results.map(r=>r.quote_id));
  let cycle=state.cycle,available=pool.filter(q=>!ids.has(q.id));if(!available.length){cycle++;available=pool;}
  const seed=createHash('sha256').update(user+':'+cycle+':'+state.sequence).digest().readUInt32BE(0),quote:Quote=available[seed%available.length];
  const results=await db.batch([db.prepare('INSERT INTO quote_deliveries SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM quote_state WHERE user_id=? AND sequence=? AND version=?) ON CONFLICT DO NOTHING RETURNING quote_id').bind(user,key,quote.id,cycle,day,now,quote.category,JSON.stringify(quote),user,state.sequence,state.version),db.prepare('UPDATE quote_state SET sequence=sequence+1,cycle=? WHERE user_id=? AND sequence=? AND EXISTS(SELECT 1 FROM quote_deliveries WHERE user_id=? AND delivery_key=? AND quote_id=?)').bind(cycle,user,state.sequence,user,key,quote.id)]);
  if(results[0].results.length)return {day,quote};
 }
 throw new JournalError('La biblioteca cambió simultáneamente; vuelve a intentarlo.',409);
}
