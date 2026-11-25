import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Miniflare,convertV4MiniflareOptions } from "miniflare";
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default {fetch(){return new Response('fixture')}}",d1Databases:{DB:"migration-fixture",INVALID:"invalid-migration-fixture"},cf:false}));
try{
 const db=await mf.getD1Database("DB"),files=(await readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort();
 async function migrate(file,target=db){await target.batch((await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean).map(s=>target.prepare(s)));}
 for(const file of files.filter(f=>f<"0006"))await migrate(file);
 const user="upgrade-fixture";
 await db.batch([
  db.prepare("INSERT INTO accounts(user_id,id,version,data) VALUES (?, 'account',3,'{\"name\":\"Preserved\"}')").bind(user),
  db.prepare("INSERT INTO setups(user_id,id,version,data) VALUES (?, 'setup',4,'{\"rules\":\"Preserved\"}')").bind(user),
  db.prepare("INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?, 'trade',5,1795183200000,'account','setup','{\"pnlCents\":125}')").bind(user),
  db.prepare("INSERT INTO attachments(user_id,trade_id,slot,object_key,revision) VALUES (?,'trade','before','legacy-object','revision-1')").bind(user),
  db.prepare("INSERT INTO plans(user_id,version,data) VALUES (?,2,'{\"dailyLossR\":2}')").bind(user),
  db.prepare("INSERT INTO reviews(user_id,week,scope,version,data) VALUES (?,'2026-11-16','account',6,'{\"followed\":\"Preserved\"}')").bind(user),
  db.prepare("INSERT INTO user_limits(user_id,trades) VALUES (?,5000)").bind(user),
  db.prepare("INSERT INTO users(user_id,email,created_at,last_login,status) VALUES (?,'owner@example.test',1,2,'active')").bind(user),
  db.prepare("INSERT INTO users(user_id,email,created_at,last_login,status,access_until,suspended_until) VALUES ('second-fixture','other@example.test',3,4,'suspended',100,200)"),
  db.prepare("INSERT INTO accounts(user_id,id,version,data) VALUES ('second-fixture','second-account',7,'{\"name\":\"Other owner\"}')"),
  db.prepare("INSERT INTO auth_sessions VALUES ('fixture-session-hash',?,2000000000000,1,2,'Fixture device')").bind(user),
  db.prepare("INSERT INTO access_settings VALUES (1,'closed',NULL)"),
  db.prepare("INSERT INTO access_invitations VALUES ('guest@example.test',2000000000000)"),
  db.prepare("INSERT INTO admin_events VALUES ('fixture-event',?,'second-fixture','suspend',1,'{\"reason\":\"fixture\"}')").bind(user),
  db.prepare("INSERT INTO login_codes VALUES ('fixture-email-hash','fixture-code-hash',2000000000000,2,1)"),
  db.prepare("INSERT INTO daily_quote_progress VALUES (?,'2026-11-23',8)").bind(user),
 ]);
 await db.prepare("WITH RECURSIVE series(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM series WHERE n<1000) INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) SELECT ?, 'legacy-'||n, n,1795183200000+n,'account','setup',json_object('pnlCents',n-500,'closedAt',1795183200000+n) FROM series").bind(user).run();
 await db.prepare("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)").run();
 const baseline=files.filter(f=>f<'0006');
 for(let i=0;i<baseline.length;i++)await db.prepare("INSERT INTO d1_migrations VALUES (?,?,?)").bind(i+1,baseline[i],'fixture-before-upgrade').run();
 const legacyTables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY name").all()).results.map(r=>r.name);
 const identifier=name=>{assert.match(name,/^[a-z_]+$/);return '"'+name+'"';};
 const stable=rows=>JSON.stringify(rows.map(row=>JSON.stringify(row)).sort());
 const original={};for(const table of legacyTables)original[table]=(await db.prepare('SELECT * FROM '+identifier(table)).all()).results;
 const steps=[];
 const tables=["accounts","setups","trades","attachments","plans","reviews","user_limits"];
 const before=await Promise.all(tables.map(t=>db.prepare("SELECT * FROM "+t+" WHERE user_id=?").bind(user).all()));
 for(const file of files.filter(f=>f>="0006")){
  await migrate(file);
  // Check ALL old tables after EACH migration, including the other user's rows.
  // Project only old columns: 0007 intentionally adds nullable custom_trades.
  for(const table of legacyTables){const columns=Object.keys(original[table][0]??{});assert.ok(columns.length,'Baseline fixture must populate '+table);const rows=(await db.prepare('SELECT '+columns.map(identifier).join(',')+' FROM '+identifier(table)).all()).results;assert.equal(stable(rows),stable(original[table]),file+' conserva '+table);}
  assert.deepEqual((await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).results.map(r=>r.name),[...baseline,...steps.map(s=>s.name)],'DDL no altera el registro antes de que lo registre el operador');
  await db.prepare("INSERT INTO d1_migrations(name,applied_at) VALUES (?,?)").bind(file,'fixture-after-upgrade').run();
  assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0,file+' conserva relaciones');
  steps.push({name:file,sha256:createHash('sha256').update(await readFile('drizzle/'+file)).digest('hex'),legacyTablesUnchanged:legacyTables.length,foreignKeyViolations:0});
 }
 for(let i=0;i<tables.length;i++){
  const after=await db.prepare("SELECT * FROM "+tables[i]+" WHERE user_id=?").bind(user).all();
  const rows=after.results.map(row=>{const copy={...row};delete copy.custom_trades;return copy;});
  assert.deepEqual(rows,before[i].results,tables[i]+" conserva datos, relaciones y versiones");
 }
 assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).results.length,0);
 assert.deepEqual((await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).results.map(r=>r.name),files);
 assert.equal(await db.prepare("SELECT mode FROM access_settings WHERE id=1").first('mode'),'closed','La actualización nunca abre el registro cerrado');
 assert.equal(await db.prepare("SELECT count(*) n FROM restore_receipts").first("n"),0);
 assert.equal(await db.prepare("SELECT custom_trades FROM user_limits WHERE user_id=?").bind(user).first("custom_trades"),null);
 const indexes=(await db.prepare("PRAGMA index_list(trades)").all()).results.map(r=>r.name);
 assert.ok(indexes.includes("trades_user_account_event"));
 assert.ok(indexes.includes("trades_owner_market"));
 await db.prepare("UPDATE accounts SET version=version+1 WHERE user_id=?").bind(user).run();
 assert.equal(await db.prepare("SELECT version FROM journal_revisions WHERE user_id=?").bind(user).first("version"),1);
 for(const table of ['journal_section_cache','quote_state','quote_deliveries','quote_favorites','admin_alert_state','operational_incidents','storage_deletions','asset_catalog','asset_aliases','script_vaults','private_scripts','public_trade_shares'])assert.equal(await db.prepare('SELECT count(*) n FROM '+table).first('n'),0);
 assert.equal(await db.prepare('SELECT active FROM maintenance_state WHERE id=1').first('active'),0);
 await assert.rejects(()=>db.prepare("INSERT INTO maintenance_state(id) VALUES (2)").run());
 await assert.rejects(()=>db.prepare("INSERT INTO admin_alert_state VALUES ('x','unknown','test','fixture',1)").run());
 await db.prepare("DELETE FROM attachments WHERE user_id=?").bind(user).run();
 assert.equal(await db.prepare("SELECT object_key FROM storage_deletions WHERE user_id=?").bind(user).first("object_key"),'legacy-object');
 // A valid old schema alone does not prove that expression indexes can be built.
 // Fail on malformed old JSON and verify batch rollback, never silently repair it.
 const invalid=await mf.getD1Database('INVALID');
 for(const file of files.filter(f=>f<'0008'))await migrate(file,invalid);
 await invalid.prepare("INSERT INTO trades(user_id,id,version,opened_at,data) VALUES ('invalid-fixture','invalid-row',9,1,'{invalid')").run();
 await assert.rejects(()=>migrate(files.find(f=>f.startsWith('0008_')),invalid),/malformed JSON/);
 assert.equal(await invalid.prepare("SELECT count(*) n FROM sqlite_master WHERE name='journal_revisions' OR name='trades_user_event'").first('n'),0,'0008 falla de forma atómica sin dejar objetos parciales');
 assert.equal(await invalid.prepare("SELECT count(*) n FROM trades WHERE version=9 AND data='{invalid'").first('n'),1,'No altera ni elimina el registro que requiere revisión');
 await mkdir('outputs/migration-upgrade',{recursive:true});
 await writeFile('outputs/migration-upgrade/resultados.json',JSON.stringify({scope:'D1 local desechable; datos ficticios, no respaldo ni migración de producción',from:'0005',to:files.at(-1).slice(0,4),legacyTables:legacyTables.map(name=>({name,rows:original[name].length})),steps,closedAccessPreserved:true,migrationRegistryPreserved:true,malformedJsonRejectsIndexMigrationAtomically:true},null,2)+'\n');
 console.log("Migraciones 0006–"+files.at(-1).slice(0,4)+": actualización desde V2 previa conserva registros, versiones y relaciones en D1.");
}finally{await mf.dispose();}
