import assert from "node:assert/strict";
import { readFile,readdir,mkdir,rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Miniflare,convertV4MiniflareOptions } from "miniflare";
import { exampleJournal } from "../lib/demo.ts";
import { summarize,groups,entryOrdinals,afterLossGroups } from "../lib/stats.ts";
import { dayKey,inputDate,matchesScope,resultR,outcome } from "../lib/journal.ts";
import {readCompleteJournal} from "../lib/journal-read.ts";
import { tradeQuerySchema,decodeSummary,parseTradeQuery } from "../lib/journal-query.ts";
await mkdir("work",{recursive:true});const output=resolve("work/server-query-test.mjs");
await build({entryPoints:["db/journal-query.ts"],outfile:output,bundle:true,platform:"node",format:"esm",packages:"external",logLevel:"silent"});
const {queryTradePage,queryAnalytics,queryMetadata}=await import(pathToFileURL(output).href);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default {fetch(){return new Response('fixture')}}",d1Databases:{DB:"query-fixture"},cf:false}));
try{
 const db=await mf.getD1Database("DB");
 for(const f of (await readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())await db.batch((await readFile("drizzle/"+f,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 const user="query-large",fixture=exampleJournal("2026-11-20"),base=fixture.trades[0];
 const accounts=[fixture.accounts[0],{...fixture.accounts[0],id:crypto.randomUUID(),name:"Euro",currency:"EUR"}];
 for(const a of accounts){const {id,version,...data}=a;await db.prepare("INSERT INTO accounts(user_id,id,version,data) VALUES (?,?,?,?)").bind(user,id,version,JSON.stringify(data)).run();}
 for(const s of fixture.setups){const {id,version,...data}=s;await db.prepare("INSERT INTO setups(user_id,id,version,data) VALUES (?,?,?,?)").bind(user,id,version,JSON.stringify(data)).run();}
 await db.prepare("INSERT INTO user_limits(user_id,trades,custom_trades) VALUES (?,20000,20000)").bind(user).run();
 const records=Array.from({length:10000},(_,i)=>{
  const r=[-1,0,2,-.5,3][i%5],openedAt=inputDate("2026-08-01T09:00")+Math.floor(i/100)*86400000+(i%10)*60000;
  const partials=i%13===0?[{price:102,percent:25,at:openedAt+1000}]:[];
  return {...base,id:crypto.randomUUID(),version:1,openedAt,closedAt:i%17===0?null:openedAt+120000,accountId:i%19===0?null:accounts[i%2].id,setupId:fixture.setups[i%3].id,asset:i%2?"XAUUSD":"US100",direction:i%3?"long":"short",entry:i%31===0?null:100,stop:i%3?99:101,exit:i%3?100+r:100-r,pnlCents:i%7===0?null:r*100,riskCents:i%11===0?null:100,partials,notes:[{kind:"text",text:i%29===0?"Revisión Ñandú %_literal":"Fixture "+"x".repeat(500),checked:false}]};
 });
 let statements=[];for(let i=0;i<records.length;i+=10){const chunk=records.slice(i,i+10),values=[];
  for(const row of chunk){const {id,version,openedAt,accountId,setupId,...data}=row;values.push(user,id,version,openedAt,accountId,setupId,JSON.stringify(data));}
  statements.push(db.prepare("INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES "+chunk.map(()=>"(?,?,?,?,?,?,?)").join(",")).bind(...values));
  if(statements.length===50){await db.batch(statements);statements=[];}
 }if(statements.length)await db.batch(statements);
 const meta=await queryMetadata(db,user);assert.equal(meta.tradeCount,10000);assert.equal(meta.trades.length,0);
 const empty=await queryMetadata(db,"other-user");assert.equal(empty.tradeCount,0);
 const all=tradeQuerySchema.parse({}),first=await queryTradePage(db,user,all,{count:true});
 assert.equal(first.trades.length,20);assert.equal(first.total,10000);assert.ok(JSON.stringify(first).length<JSON.stringify(records).length/100,"Una página no transfiere las notas de todo el historial");
 const approx=(actual,expected,label)=>{if(typeof expected==="number"&&Number.isFinite(expected))assert.ok(actual!==null&&Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),label+": "+actual+" != "+expected);else assert.equal(actual,expected,label);};
 function selected(q){return records.filter(t=>matchesScope(t,q.scope)&&(!q.from||dayKey(t.closedAt??t.openedAt)>=q.from)&&(!q.to||dayKey(t.closedAt??t.openedAt)<=q.to)&&(!q.setup||t.setupId===q.setup)&&(!q.direction||t.direction===q.direction)&&(!q.state||(q.state==="open"?t.closedAt===null:t.closedAt!==null))&&(!q.result||outcome(t)===q.result)&&(!q.asset||t.asset===q.asset)&&(!q.emotion||t.before?.name===q.emotion));}
 for(const fields of [{},{scope:accounts[0].id,from:"2026-08-10",to:"2026-08-15"},{scope:accounts[1].id},{scope:"unassigned",state:"closed"},{asset:"XAUUSD",direction:"short",setup:fixture.setups[1].id,result:"win"},{result:"unknown"},{state:"open"},{from:"2020-01-01",to:"2020-01-02"}]){
  const q=tradeQuerySchema.parse(fields),expected=summarize(selected(q),accounts,accounts.find(a=>a.id===q.scope)?.currency??"USD"),response=await queryAnalytics(db,user,q),actual=decodeSummary(response.summary);
  for(const key of Object.keys(expected))approx(actual[key],expected[key],JSON.stringify(fields)+" "+key);
 }
 for(const sort of ["latest","oldest","r","duration"]){
  const q=tradeQuerySchema.parse({scope:accounts[0].id,from:"2026-08-10",to:"2026-08-15",sort});
  const wanted=selected(q),seen=[];let cursor;
  do{const page=await queryTradePage(db,user,q,{size:37,cursor});seen.push(...page.trades);cursor=page.next??undefined;}while(cursor);
  assert.equal(new Set(seen.map(t=>t.id)).size,seen.length);assert.deepEqual(new Set(seen.map(t=>t.id)),new Set(wanted.map(t=>t.id)));
  const score=t=>sort==="r"?(resultR(t)??-Number.MAX_VALUE):sort==="duration"?(t.closedAt===null?-1:t.closedAt-t.openedAt):t.closedAt??t.openedAt;
  for(let i=1;i<seen.length;i++)assert.ok(sort==="oldest"?score(seen[i])>=score(seen[i-1]):score(seen[i])<=score(seen[i-1]));
 }
 const q=tradeQuerySchema.parse({from:"2026-08-10",to:"2026-08-15"}),analysis=await queryAnalytics(db,user,q,undefined,true),cohort=selected(q);
 const ordinals=entryOrdinals(records),ordinalExpected=groups(cohort,t=>{const n=ordinals.get(t.id);return n===1?"Primera":n===2?"Segunda":"Tercera o posterior"},true);
 for(const [kind,wanted] of [["ordinal",ordinalExpected],["afterLoss",afterLossGroups(records,cohort)]])for(const g of wanted){const actual=analysis.groups.find(x=>x.kind===kind&&x.label===g.label);assert.ok(actual,kind+g.label);assert.equal(actual.count,g.count);approx(actual.value,g.value,kind+g.label);}
 const search=await queryTradePage(db,user,tradeQuerySchema.parse({q:"revision nandu %_literal"}),{count:true});assert.ok(search.total>0);assert.ok(search.trades.every(t=>t.notes[0].text.includes("Ñandú")));
 await assert.rejects(queryTradePage(db,user,{...all,state:"open"},{cursor:first.next}),e=>e.status===422);
 for(const mutation of ["insert","edit","delete","metadata"]){
  const page=await queryTradePage(db,user,all);
  if(mutation==="insert"){const t=records[0],{openedAt,accountId,setupId,...rest}=t;await db.prepare("INSERT INTO trades(user_id,id,opened_at,account_id,setup_id,data) VALUES (?,?,?,?,?,?)").bind(user,crypto.randomUUID(),openedAt,accountId,setupId,JSON.stringify(rest)).run();}
  if(mutation==="edit")await db.prepare("UPDATE trades SET opened_at=opened_at+1,version=version+1 WHERE user_id=? AND id=?").bind(user,records[5].id).run();
  if(mutation==="delete")await db.prepare("DELETE FROM trades WHERE user_id=? AND id=?").bind(user,records[6].id).run();
  if(mutation==="metadata")await db.prepare("UPDATE accounts SET version=version+1 WHERE user_id=? AND id=?").bind(user,accounts[0].id).run();
  await assert.rejects(queryTradePage(db,user,all,{cursor:page.next}),e=>e.status===409,mutation+" invalida la instantánea");
 }
 const originalFetch=globalThis.fetch;let interrupt=false,limited=false;
 try{
  globalThis.fetch=async(input)=>{
    if(limited){limited=false;return Response.json({error:"Fixture rate limit"},{status:429,headers:{"Retry-After":"0"}});}
    const params=new URL(String(input),"https://fixture.test").searchParams;
    try{if(params.get("mode")==="metadata")return Response.json(await queryMetadata(db,user));
      const page=await queryTradePage(db,user,parseTradeQuery(params),{size:Number(params.get("size")),cursor:params.get("cursor")??undefined,revision:Number(params.get("revision"))});
      if(interrupt&&page.next){interrupt=false;await db.prepare("UPDATE trades SET version=version+1 WHERE user_id=? AND id=?").bind(user,records[8].id).run();}
      return Response.json(page);
    }catch(e){return Response.json({error:e.message},{status:e.status??500});}
  };
  limited=true;
  const snapshot=await readCompleteJournal({from:"2026-08-10",to:"2026-08-15"});
  assert.deepEqual(new Set(snapshot.trades.map(t=>t.id)),new Set(selected(q).map(t=>t.id)),"La exportación recibe todo el filtro, no una página");
  limited=true;
  const cancelled=new AbortController();
  await assert.rejects(readCompleteJournal({},cancelled.signal,progress=>{if(progress.waitingSeconds!==undefined)cancelled.abort();}),e=>e.name==="AbortError","La espera por 429 puede cancelarse sin devolver un archivo parcial");
  interrupt=true;await assert.rejects(readCompleteJournal({}),e=>e.status===409,"No devolver respaldos parciales al cambiar una página");
 }finally{globalThis.fetch=originalFetch;}
 const plan=await db.prepare("EXPLAIN QUERY PLAN SELECT id FROM trades WHERE user_id=? AND account_id=? AND coalesce(json_extract(data,'$.closedAt'),opened_at)>=? ORDER BY coalesce(json_extract(data,'$.closedAt'),opened_at),id LIMIT 20").bind(user,accounts[0].id,inputDate("2026-08-10T00:00")).all();
 assert.ok(plan.results.some(r=>String(r.detail).includes("trades_user_account_event")));
 console.log("Consultas D1: 10000 operaciones; paginación, 4 órdenes, filtros, métricas completas, cohortes históricas, índices y conflictos concurrentes OK.");
}finally{await mf.dispose();await rm(output,{force:true});}
