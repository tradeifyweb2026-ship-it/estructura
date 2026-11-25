import assert from "node:assert/strict";
import { readFile, readdir, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Miniflare,convertV4MiniflareOptions } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
await mkdir("work",{recursive:true});
const output=resolve("work/restore-transaction-test.mjs");
await build({entryPoints:["db/restore.ts"],outfile:output,bundle:true,platform:"node",format:"esm",packages:"external",logLevel:"silent"});
const {restoreBatch}=await import(pathToFileURL(output).href);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default {fetch(){return new Response('fixture')}}",d1Databases:{DB:"restore-race"},cf:false}));
try{
 const d1=await mf.getD1Database("DB");
 for(const file of (await readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort()){
  const statements=(await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean);
  await d1.batch(statements.map(s=>d1.prepare(s)));
 }
 const user="restore-race",id=crypto.randomUUID(),newId=crypto.randomUUID();
 const record={id,version:1,name:"Before",type:"Demo",currency:"USD",startingBalanceCents:0,archived:false};
 const data={...record};delete data.id;delete data.version;
 await d1.prepare("INSERT INTO accounts(user_id,id,data) VALUES (?,?,?)").bind(user,id,JSON.stringify(data)).run();
 const db=drizzle(d1);let armed=true;
 const racing=new Proxy(db,{get(target,key){
  if(key==="batch")return async statements=>{
   if(armed){armed=false;await d1.prepare("UPDATE accounts SET version=2,data=? WHERE user_id=? AND id=?").bind(JSON.stringify({...data,name:"Changed concurrently"}),user,id).run();}
   return target.batch(statements);
  };
  const value=Reflect.get(target,key,target);return typeof value==="function"?value.bind(target):value;
 }});
 const requestId=crypto.randomUUID();
 const action={action:"restoreBatch",requestId,batch:{kind:"accounts",records:[record,{...record,id:newId}]}};
 await assert.rejects(restoreBatch(racing,user,action),e=>e.status===409);
 assert.equal(await d1.prepare("SELECT count(*) n FROM accounts WHERE user_id=?").bind(user).first("n"),1,"Una carrera detectada no guarda ninguna fila nueva");
 assert.equal(await d1.prepare("SELECT count(*) n FROM restore_receipts WHERE user_id=?").bind(user).first("n"),0);
 const retry={...action,batch:{kind:"accounts",records:[{...record,id:newId}]}};
 const result=await restoreBatch(db,user,retry);assert.equal(result.imported,1);
 assert.deepEqual(await restoreBatch(db,user,retry),result);
 console.log("Restauración D1: cambio concurrente determinista, rollback y recibo idempotente OK.");
}finally{await mf.dispose();await rm(output,{force:true});}
