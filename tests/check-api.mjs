import {createVault,encryptScript,decryptScript} from '../lib/script-crypto.ts';
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { actionSchema, dayKey, idSchema, inputDate, resultR, weekday } from "../lib/journal.ts";
import { equity, summarize } from "../lib/stats.ts";
import { csvTemplate, exportTrades, previewImport } from "../lib/csv.ts";

const workdir = path.resolve("dist/server");
const modules = (await readdir(workdir, { recursive: true })).filter((file) => /\.(m?js)$/.test(file) && file !== "index.js");
const mf = new Miniflare(convertV4MiniflareOptions({
  name: "tradeify-sites-test",
  modules: ["index.js", ...modules].map((file) => ({ type: "ESModule", path: path.join(workdir, file) })),
  modulesRoot: workdir,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: { DB: "bitacora-test" },
  r2Buckets: { BUCKET: "capturas-test" },
  cf: false,
}));

const accountId = crypto.randomUUID();
const setupId = crypto.randomUUID();
const tradeId = crypto.randomUUID();
const account = { name: "Demo Nasdaq", type: "Demo", currency: "USD", startingBalanceCents: 1_000_000, archived: false };
const when = inputDate("2026-11-16T09:30");
assert.equal(when, Date.parse("2026-11-16T14:30:00Z"));
assert.equal(dayKey(when), "2026-11-16");
const trade = {
  accountId, setupId, asset: "us100", direction: "long", openedAt: when, closedAt: null,
  entry: 200, stop: 180, target: 260, exit: null, size: .38, riskCents: 1000, riskPercent: .5,
  pnlCents: null, feesCents: null, partials: [], before: { name: "Calma", intensity: 2 },
  during: null, after: null, notes: [{ kind: "text", text: "Confirmar el cierre", checked: false }],
  grade: null, errors: [], checklist: [{ text: "Confirmar SL", checked: true }],
};
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
assert.equal(idSchema.safeParse("00112233-4455-0000-0000-66778899aabb").success, true, "Se mantienen los identificadores admitidos por el importador anterior");
assert.equal(idSchema.safeParse("../otra-cuenta").success, false);

async function api(method, { user = "test-a", action, route = "/api/bitacora", body, headers = {}, status = 200 } = {}) {
  const init = {
    method, body: action ? JSON.stringify(action) : body,
    headers: {
      ...(user ? { "oai-authenticated-user-id": user, "oai-authenticated-user-email": `${user}@example.test` } : {}),
      ...(action ? { "Content-Type": "application/json" } : {}),
      "X-Bitacora-Request": "1",
      ...headers,
    },
  };
  // RPC buffers oversized fixtures before delivery, so an early 413 cannot
  // interrupt the test client's HTTP upload with EPIPE.
  const response = body && body.length > 3_000_000
    ? await (await mf.getWorker()).fetch("http://localhost" + route, init)
    : await mf.dispatchFetch("http://localhost" + route, init);
  assert.equal(response.status, status, method + " " + route + " " + action?.action + " " + await response.clone().text().catch(() => ""));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  if (response.headers.get("content-type")?.startsWith("image/")) return response.arrayBuffer();
  return response.json();
}

const write = (action, status = 200, user = "test-a") => api("POST", { action, status, user });
const captureUrl = "/api/capturas?trade=" + tradeId + "&slot=before";

try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(path.join("drizzle", file), "utf8");
    await db.batch(sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean).map((statement) => db.prepare(statement)));
  }
  // Verified Sites identity is supplied by the local adapter fixture, never by
  // a production client. New FK-backed catalogs must register its principal.
  const siteUser='sites-catalog-fixture',siteAsset=crypto.randomUUID();
  assert.equal(await db.prepare('SELECT count(*) n FROM users WHERE user_id=?').bind(siteUser).first('n'),0);
  assert.equal((await api('GET',{route:'/api/activos',user:siteUser})).total,0);
  assert.equal(await db.prepare('SELECT count(*) n FROM users WHERE user_id=?').bind(siteUser).first('n'),1);
  await api('POST',{route:'/api/activos',user:siteUser,action:{action:'save',id:siteAsset,version:null,asset:{name:'Mercado privado Sites',aliases:['SITE'],favorite:false}}});
  assert.equal((await api('GET',{route:'/api/activos',user:siteUser})).items[0].id,siteAsset);
  assert.equal((await api('GET',{route:'/api/activos',user:'sites-catalog-other'})).total,0);
  await api('POST',{route:'/api/activos',user:siteUser,action:{action:'save',id:siteAsset,version:1,asset:{name:'Bloqueo CSRF',aliases:[],favorite:false}},headers:{'X-Bitacora-Request':'0'},status:403});
  await db.prepare("UPDATE users SET status='blocked' WHERE user_id=?").bind(siteUser).run();
  await api('GET',{route:'/api/activos',user:siteUser,status:403});
  await db.prepare("UPDATE users SET status='active' WHERE user_id=?").bind(siteUser).run();
  await db.prepare("INSERT INTO access_settings(id,mode,default_days) VALUES (1,'closed',NULL) ON CONFLICT(id) DO UPDATE SET mode='closed',default_days=NULL").run();
  await api('GET',{route:'/api/activos',user:'sites-catalog-closed',status:403});
  assert.equal(await db.prepare('SELECT count(*) n FROM users WHERE user_id=?').bind('sites-catalog-closed').first('n'),0);
  await db.prepare("UPDATE access_settings SET mode='approval' WHERE id=1").run();
  await api('GET',{route:'/api/activos',user:'sites-catalog-pending',status:403});
  assert.equal(await db.prepare('SELECT status FROM users WHERE user_id=?').bind('sites-catalog-pending').first('status'),'pending');
  await db.prepare("UPDATE access_settings SET mode='public' WHERE id=1").run();
  const scriptUser='sites-private-script',scriptId=crypto.randomUUID(),scriptVault=await createVault('clave ficticia privada Sites');
  const scriptPlain={title:'Privado Sites',description:'Solo del usuario',code:'//@version=6\nindicator("Sitio")\nplot(close)'};
  const scriptPayload=await encryptScript(scriptVault.key,scriptVault.envelope.id,scriptId,1,scriptPlain);
  assert.equal((await api('GET',{route:'/api/scripts',user:scriptUser})).vault,null);
  await api('POST',{route:'/api/scripts',user:scriptUser,action:{action:'vault',envelope:scriptVault.envelope}});
  const scriptSave={action:'save',id:scriptId,version:null,vaultId:scriptVault.envelope.id,payload:scriptPayload};
  await api('POST',{route:'/api/scripts',user:scriptUser,action:scriptSave});
  const scriptList=await api('GET',{route:'/api/scripts?mode=list',user:scriptUser});assert.equal(scriptList.total,1);assert.equal('code'in scriptList.items[0],false);
  const scriptDetail=(await api('GET',{route:'/api/scripts?mode=detail&id='+scriptId,user:scriptUser})).script;
  assert.deepEqual(await decryptScript(scriptVault.key,scriptVault.envelope.id,scriptId,1,{metadata:scriptDetail.metadata,code:scriptDetail.code}),scriptPlain);
  await api('GET',{route:'/api/scripts?mode=detail&id='+scriptId,user:'sites-private-other',status:404});
  await api('POST',{route:'/api/scripts',user:scriptUser,action:{...scriptSave,owner:true},status:422});
  await api('POST',{route:'/api/scripts',user:scriptUser,action:{...scriptSave,code:scriptPlain.code},status:422});
  await api('POST',{route:'/api/scripts',user:scriptUser,action:scriptSave,headers:{'X-Bitacora-Request':'0'},status:403});
  await api('POST',{route:'/api/scripts',user:scriptUser,body:'x'.repeat(200001),headers:{'Content-Type':'application/json'},status:413});
  const quotaUser = "quota-test";
  await db.prepare("INSERT INTO user_limits(user_id,trades) VALUES (?,1)").bind(quotaUser).run();
  const insert = db.prepare("INSERT INTO trades(user_id,id,opened_at,data) VALUES (?,?,1,'{}')");
  await insert.bind(quotaUser,"one").run();
  await assert.rejects(insert.bind(quotaUser,"two").run(),/quota_trades/);
  assert.equal(await db.prepare("SELECT count(*) n FROM trades WHERE user_id=?").bind(quotaUser).first("n"),1);
  const customUser="custom-quota-fixture",customId=crypto.randomUUID();
  await db.prepare("INSERT INTO user_limits(user_id,trades,custom_trades) VALUES (?,1,1)").bind(customUser).run();
  const customTrade={...trade,accountId:null,setupId:null};
  await write({action:"saveTrade",id:customId,version:null,trade:customTrade},200,customUser);
  await write({action:"saveTrade",id:crypto.randomUUID(),version:null,trade:customTrade},422,customUser);
  assert.equal(await db.prepare("SELECT trades FROM user_limits WHERE user_id=?").bind(customUser).first("trades"),1,"El máximo general no sobrescribe la cuota individual");
  await write({action:"saveTrade",id:customId,version:1,trade:customTrade},200,customUser);
  const quoteRoute = "/api/frase-diaria";
  const claimQuote = (user) => api("POST", { route: quoteRoute, user });
  await api("POST", { route: quoteRoute, user: "", status: 401 });
  await api("POST", { route: quoteRoute, headers: { "X-Bitacora-Request": "0" }, status: 403 });
  const claims = await Promise.all([claimQuote("quotes-a"), claimQuote("quotes-a")]);
  assert.equal(claims[0].day, dayKey(Date.now()));
  if (weekday(claims[0].day) < 5) {
    const delivered = claims.filter((result) => result.quote !== null);
    assert.equal(delivered.length, 2);
    assert.equal(delivered[0].quote.id,delivered[1].quote.id);
    assert.equal((await claimQuote("quotes-b")).quote.id, delivered[0].quote.id);
    await db.prepare("UPDATE daily_quote_progress SET day = ? WHERE user_id = ?").bind("2000-01-01", "quotes-a").run();
    const nextQuote = (await claimQuote("quotes-a")).quote;
    assert.ok(nextQuote);
    assert.notEqual(nextQuote.id, delivered[0].quote.id);
  } else {
    assert.ok(claims.every((result) => result.quote === null));
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM daily_quote_progress").first()).count, 0);
  }
  const quotes = JSON.parse(await readFile("lib/daily-quotes.json", "utf8"));
  assert.equal(quotes.length, 2019);
  assert.equal(new Set(quotes.map((quote) => quote.id)).size, quotes.length);
  assert.ok(quotes.every((quote) => quote.text.length > 0 && quote.text.length <= 220));
  assert.equal(weekday("2026-11-20"), 4);
  assert.equal(weekday("2026-11-21"), 5);
  assert.equal(weekday("2026-11-22"), 6);
  assert.equal((await api("GET")).trades.length, 0);
  await api("GET", { user: "", status: 401 });
  await api("POST", { action: { action: "saveTrade" }, headers: { "X-Bitacora-Request": "0" }, status: 403 });
  await api("POST", { action: { action: "saveTrade" }, headers: { Origin: "https://hostile.example.test" }, status: 403 });
  await api("POST", { action: { action: "saveTrade" }, headers: { "Sec-Fetch-Site": "cross-site" }, status: 403 });
  await api("POST", { body: "{", headers: { "Content-Type": "application/json" }, status: 400 });
  await api("POST", { body: "x".repeat(3_000_001), headers: { "Content-Type": "application/json" }, status: 413 });
  assert.equal((await write({ action: "saveAccount", id: accountId, version: null, account })).id, accountId);
  await write({ action: "saveSetup", id: setupId, version: null, setup: { name: "Pullback", color: "verde", description: "Retroceso", rules: "Confirmar", archived: false } });
  await write({ action: "saveTrade", id: tradeId, version: null, trade }, 422, "test-b");
  await write({ action: "saveTrade", id: tradeId, version: null, trade: { ...trade, stop: 210 } }, 422);
  await write({ action: "saveTrade", id: tradeId, version: null, trade });
  await write({ action: "saveTrade", id: tradeId, version: null, trade });
  await write({ action: "saveAccount", id: accountId, version: 1, account }, 409, "test-b");
  await write({ action: "saveSetup", id: setupId, version: 1, setup: { name: "Foreign", color: "verde", description: "", rules: "", archived: false } }, 409, "test-b");
  await write({ action: "deleteTrade", id: tradeId, version: 1 }, 409, "test-b");
  assert.equal((await api("GET")).trades.length, 1);
  assert.equal((await api("GET", { user: "test-b" })).trades.length, 0);
  await write({ action: "saveAccount", id: accountId, version: 1, account: { ...account, currency: "EUR" } }, 422);

  const done = { ...trade, captureLinks: { before: "https://www.tradingview.com/x/fixture/", after: "https://s3.tradingview.com/snapshots/a/fixture.png" }, closedAt: when + 20 * 60_000, exit: 220, pnlCents: 1400, feesCents: 100, partials: [{ price: 240, percent: 50 }], grade: 5 };
  assert(actionSchema.safeParse({ action: "saveTrade", id: tradeId, version: 1, trade: done }).success);
  assert.equal(resultR(done), 1.4);
  assert.equal(resultR({ ...done, pnlCents: null }), 1.5);
  const savedTrade=await write({ action: "saveTrade", id: tradeId, version: 1, trade: done });
  assert.equal(savedTrade.trade.id,tradeId);assert.equal(savedTrade.trade.version,2);assert.equal(savedTrade.trade.setupSnapshot.name,"Pullback");
  await write({ action: "saveTrade", id: tradeId, version: 1, trade: done }, 409);
  const stored = await api("GET");
  const restoreUser="restore-fixture";
  const restoreTrade={...stored.trades[0]};
  await write({action:"restoreBatch",batch:{kind:"trades",records:[restoreTrade]}},422,restoreUser);
  assert.equal((await write({action:"restoreBatch",batch:{kind:"accounts",records:stored.accounts}},200,restoreUser)).imported,1);
  assert.equal((await write({action:"restoreBatch",batch:{kind:"setups",records:stored.setups}},200,restoreUser)).imported,1);
  assert.equal((await write({action:"restoreBatch",batch:{kind:"trades",records:[restoreTrade]}},200,restoreUser)).imported,1);
  assert.equal((await write({action:"restoreBatch",batch:{kind:"trades",records:[restoreTrade]}},200,restoreUser)).imported,0);
  await write({action:"restoreBatch",batch:{kind:"trades",records:[{...restoreTrade,pnlCents:99999}]}},409,restoreUser);
  assert.equal((await api("GET",{user:restoreUser})).trades[0].pnlCents,restoreTrade.pnlCents);
  const requestId=crypto.randomUUID();
  const receiptRecord={...stored.accounts[0],id:crypto.randomUUID(),name:"Receipt fixture"};
  const receiptAction={action:"restoreBatch",requestId,batch:{kind:"accounts",records:[receiptRecord]}};
  const [receiptA,receiptB]=await Promise.all([write(receiptAction,200,restoreUser),write(receiptAction,200,restoreUser)]);
  assert.deepEqual(receiptA,receiptB,"Un reintento concurrente recupera exactamente el mismo resultado");
  assert.equal(receiptA.imported,1);assert.deepEqual(receiptA.records,[{key:receiptRecord.id,status:"added"}]);
  assert.deepEqual(await write(receiptAction,200,restoreUser),receiptA,"Simula pérdida de respuesta después del commit");
  await write({...receiptAction,batch:{kind:"accounts",records:[{...receiptRecord,name:"Alterado"}]}},409,restoreUser);
  assert.equal((await write({...receiptAction,requestId:crypto.randomUUID()},200,restoreUser)).skipped,1);
  const isolated=await write(receiptAction,200,"isolated-receipt-user");assert.equal(isolated.imported,1);
  const mixedNew={...receiptRecord,id:crypto.randomUUID(),name:"No guardar si hay conflicto"};
  await write({action:"restoreBatch",batch:{kind:"accounts",records:[mixedNew,{...receiptRecord,name:"Conflicto"}]}},409,restoreUser);
  assert.equal(await db.prepare("SELECT count(*) n FROM accounts WHERE user_id=? AND id=?").bind(restoreUser,mixedNew.id).first("n"),0);
  await write({action:"restoreBatch",batch:{kind:"accounts",records:[mixedNew,mixedNew]}},422,restoreUser);
  // A quota error on a multi-row statement must undo every row and its receipt.
  const atomicUser="restore-atomic-quota",atomicRequest=crypto.randomUUID();
  await db.batch(Array.from({length:99},()=>db.prepare("INSERT INTO accounts(user_id,id,data) VALUES (?,?,?)").bind(atomicUser,crypto.randomUUID(),JSON.stringify(account))));
  const atomicRecords=Array.from({length:2},()=>({...receiptRecord,id:crypto.randomUUID()}));
  const atomicAction={action:"restoreBatch",requestId:atomicRequest,batch:{kind:"accounts",records:atomicRecords}};
  await write(atomicAction,422,atomicUser);
  assert.equal(await db.prepare("SELECT count(*) n FROM accounts WHERE user_id=?").bind(atomicUser).first("n"),99);
  assert.equal(await db.prepare("SELECT count(*) n FROM restore_receipts WHERE user_id=?").bind(atomicUser).first("n"),0);
  await db.prepare("DELETE FROM accounts WHERE user_id=? AND id=(SELECT id FROM accounts WHERE user_id=? LIMIT 1)").bind(atomicUser,atomicUser).run();
  assert.equal((await write(atomicAction,200,atomicUser)).imported,2,"Recuperación tras corregir la cuota");
  const reviewRecord={week:"month:2026-11",scope:receiptRecord.id,version:4,followed:"",repeat:"",change:""};
  assert.equal((await write({action:"restoreBatch",batch:{kind:"reviews",records:[reviewRecord]}},200,restoreUser)).imported,1);
  assert.equal((await write({action:"restoreBatch",batch:{kind:"reviews",records:[reviewRecord]}},200,restoreUser)).skipped,1);
  await write({action:"restoreBatch",batch:{kind:"reviews",records:[{...reviewRecord,scope:crypto.randomUUID()}]}},422,restoreUser);
  const planRestoreAction={action:"restoreBatch",requestId:crypto.randomUUID(),batch:{kind:"plan",record:{rules:[],riskPercent:null,dailyLossR:2,weeklyTargetR:null}}};
  assert.equal((await write(planRestoreAction,200,restoreUser)).imported,1);
  assert.equal((await write({...planRestoreAction,requestId:crypto.randomUUID()},200,restoreUser)).skipped,1);
  await write({...planRestoreAction,requestId:crypto.randomUUID(),batch:{...planRestoreAction.batch,record:{...planRestoreAction.batch.record,dailyLossR:3}}},409,restoreUser);
  const partialTrade={...stored.trades[0],id:crypto.randomUUID(),version:1,openedAt:stored.trades[0].openedAt+1000,closedAt:stored.trades[0].closedAt+1000,pnlCents:null};
  const partialMoney=summarize([stored.trades[0],partialTrade],stored.accounts);
  assert.equal(partialMoney.cash,null);assert.equal(partialMoney.cashComplete,false);assert.equal(partialMoney.cashCount,1);assert.equal(partialMoney.meanCash,null);
  const euroAccount={...stored.accounts[0],id:crypto.randomUUID(),name:"Cuenta EUR",currency:"EUR"};
  const euroTrade={...stored.trades[0],id:crypto.randomUUID(),accountId:euroAccount.id,openedAt:stored.trades[0].openedAt+2000,closedAt:stored.trades[0].closedAt+2000,pnlCents:2000};
  const mixedMoney=summarize([stored.trades[0],euroTrade],[...stored.accounts,euroAccount]);
  assert.equal(mixedMoney.currency,null);assert.equal(mixedMoney.cash,null);assert.equal(mixedMoney.cashComplete,false);assert.equal(mixedMoney.cashCount,2);
  const firstSetup=stored.setups.find(item=>item.id===setupId);
  await write({action:"saveSetup",id:setupId,version:1,setup:{...firstSetup,rules:"Nueva regla"}});
  const versionTwo=(await api("GET")).setups.find(item=>item.id===setupId);
  assert.equal(versionTwo.version,2);assert.equal(versionTwo.versions.length,1);
  assert.equal(versionTwo.versions[0].version,1);assert.equal(versionTwo.versions[0].rules,firstSetup.rules);
  await write({action:"saveSetup",id:setupId,version:2,setup:{...versionTwo,description:"Descripción revisada",versions:[]}});
  const versionThree=(await api("GET")).setups.find(item=>item.id===setupId);
  assert.equal(versionThree.version,3);assert.equal(versionThree.versions.length,2);
  assert.equal(versionThree.versions[0].version,1);assert.equal(versionThree.versions[1].version,2);
  assert.equal((await api("GET")).trades.find(item=>item.id===tradeId).setupSnapshot.rules,firstSetup.rules);
  const restoredVersion=await write({action:"restoreSetupVersion",id:setupId,version:3,sourceVersion:1});
  assert.equal(restoredVersion.setup.rules,firstSetup.rules);assert.equal(restoredVersion.setup.version,4);
  assert.equal(restoredVersion.setup.versions.at(-1).version,3);
  await write({action:"restoreSetupVersion",id:setupId,version:3,sourceVersion:1},409);
  await write({action:"restoreSetupVersion",id:setupId,version:4,sourceVersion:999},422);
  await write({action:"restoreSetupVersion",id:setupId,version:4,sourceVersion:1},409,"test-b");
  assert.equal((await api("GET")).trades.find(item=>item.id===tradeId).setupSnapshot.rules,firstSetup.rules);
  assert.equal(stored.trades[0].asset, "US100");
  assert.equal(stored.trades[0].version, 2);
  assert.equal(stored.trades[0].partials[0].percent, 50);
  assert.equal(summarize(stored.trades, stored.accounts).winRate, 100);
  assert.deepEqual(equity(stored.trades, "r").map((point) => point.value), [0, 1.4]);

  // Seed pre-existing R2 data directly: the HTTP upload endpoint no longer exists.
  const bucket = await mf.getR2Bucket("BUCKET");
  const revision = crypto.randomUUID();
  await bucket.put("legacy-image", png, { httpMetadata: { contentType: "image/png" } });
  await db.prepare("INSERT INTO attachments (user_id, trade_id, slot, object_key, revision) VALUES (?, ?, ?, ?, ?)").bind("test-a", tradeId, "before", "legacy-image", revision).run();
  assert.deepEqual(Buffer.from(await api("GET", { route: captureUrl })), png);
  await api("GET", { route: captureUrl, user: "test-b", status: 404 });
  await api("DELETE", { route: captureUrl, user: "test-b", headers: { "X-Capture-Revision": revision }, status: 409 });
  for (const user of ["test-a", "test-b"]) {
    const response = await mf.dispatchFetch("http://localhost" + captureUrl, { method: "PUT", body: png, headers: { "oai-authenticated-user-id": user, "X-Bitacora-Request": "1" } });
    assert.equal(response.status, 405, "No se permite subir imágenes");
  }
  for (const before of ["javascript:alert(1)", "https://tradingview.com.evil.test/x/a", "https://user:pass@tradingview.com/x/a"]) {
    await write({ action: "saveTrade", id: tradeId, version: 2, trade: { ...done, captureLinks: { before } } }, 422);
  }
  assert.deepEqual((await api("GET")).trades[0].captureLinks, done.captureLinks);
  await write({ action: "saveTrade", id: tradeId, version: 2, trade: done }, 422, "test-b");

  await write({ action: "savePlan", version: 0, plan: { rules: ["Confirmar SL"], riskPercent: .5, dailyLossR: 2, weeklyTargetR: 5 } });
  const review = { followed: "Sí", repeat: "Esperar", change: "Revisar noticias" };
  const savedReview = await write({ action: "saveReview", week: "2026-11-16", scope: accountId, version: 0, review });
  assert.equal(savedReview.version, 1);
  await write({ action: "saveReview", week: "2026-11-17", scope: accountId, version: 0, review }, 422);
  assert.equal((await write({action:"saveReview",week:"month:2026-11",scope:accountId,version:0,review})).version,1);
  await write({action:"saveReview",week:"month:2026-13",scope:accountId,version:0,review},422);

  const roundTrip = await previewImport(exportTrades(stored.trades, stored), stored.accounts[0]);
  assert.equal(roundTrip.valid[0].id, tradeId);
  assert.deepEqual(roundTrip.valid[0].trade.captureLinks, done.captureLinks);
  assert.equal(roundTrip.valid[0].trade.before.name, "Calma");
  const pack = (items) => ({ action: "importTrades", accountId, trades: items.map(({ id, key, trade }) => ({ id, key, trade })) });
  const dry = await write(pack(roundTrip.valid));
  assert.equal(dry.imported, 0);
  const template = await previewImport(csvTemplate(), stored.accounts[0]);
  assert.equal(template.invalid.length, 0);
  assert.equal((await write(pack(template.valid))).imported, 1);
  assert.equal((await write(pack(template.valid))).imported, 0);
  const mt5 = "Time;Position;Symbol;Type;Volume;Price;S / L;T / P;Time;Price;Commission;Swap;Profit\n2026.11.16 10:00:00;421;US100;sell;1;26000;26020;25960;2026.11.16 10:25:00;25960;-2;0;100";
  const lines = await previewImport(mt5, stored.accounts[0]);
  assert.equal(lines.valid[0].trade.pnlCents, 9800);
  assert.equal(lines.valid[0].trade.direction, "short");
  const twenty = Array.from({ length: 20 }, (_, i) => ({ ...template.valid[0], id: crypto.randomUUID(), key: `test-batch-${i}` }));
  assert.equal((await write(pack(twenty))).imported, 20);

  await write({ action: "deleteTrade", id: tradeId, version: 2 });
  const final = await api("GET");
  assert.equal(final.trades.length, 21);
  assert.equal(final.captures.length, 0);
  assert.equal(final.reviews.find(r=>r.week==="2026-11-16").repeat, review.repeat);
  assert.equal(final.reviews.find(r=>r.week==="month:2026-11").repeat,review.repeat);
  const extraData={...stored.trades[0]};
  for(const key of ["id","version","openedAt","accountId","setupId"])delete extraData[key];
  const extraRows=Array.from({length:205},(_,i)=>({id:crypto.randomUUID(),openedAt:Date.parse("2026-10-01T00:00:00Z")+i*3600000}));
  for(let offset=0;offset<extraRows.length;offset+=50){
    await db.batch(extraRows.slice(offset,offset+50).map(row=>db.prepare("INSERT INTO trades (user_id,id,version,opened_at,account_id,setup_id,import_key,data) VALUES (?,?,?,?,?,?,?,?)").bind("test-a",row.id,1,row.openedAt,stored.trades[0].accountId,stored.trades[0].setupId,null,JSON.stringify(extraData))));
  }
  await db.batch([
    db.prepare("INSERT INTO attachments (user_id,trade_id,slot,object_key,revision) VALUES (?,?,?,?,?)").bind("test-a",extraRows[0].id,"before","older-page-object",crypto.randomUUID()),
    db.prepare("INSERT INTO attachments (user_id,trade_id,slot,object_key,revision) VALUES (?,?,?,?,?)").bind("test-a",extraRows[204].id,"after","first-page-object",crypto.randomUUID()),
  ]);
  const paged = await api("GET",{route:"/api/bitacora?page=0"});
  assert.equal(paged.trades.length,200);assert.equal(paged.hasMore,true);
  assert.ok(paged.captures.some(c=>c.tradeId===extraRows[204].id));
  assert.ok(!paged.captures.some(c=>c.tradeId===extraRows[0].id),"No enviar capturas de operaciones de otras páginas.");
  await api("GET",{route:"/api/bitacora?page=-1",status:422});
  const lastTrade=paged.trades.at(-1);
  const tail=await api("GET",{route:"/api/bitacora?page=0&beforeAt="+lastTrade.openedAt+"&beforeId="+lastTrade.id+"&only=trades"});
  assert.equal(tail.trades.length,26);assert.equal(tail.hasMore,false);
  assert.ok(tail.captures.some(c=>c.tradeId===extraRows[0].id),"La página siguiente debe incluir sus metadatos de captura.");
  const metadata=await api("GET",{route:"/api/bitacora?mode=metadata"});
  assert.equal(metadata.trades.length,0);assert.equal(metadata.tradeCount,226);
  const list=await api("GET",{route:"/api/bitacora?mode=list&size=20&count=1"});
  assert.equal(list.trades.length,20);assert.equal(list.total,226);assert.ok(list.next);
  const listNext=await api("GET",{route:"/api/bitacora?mode=list&size=20&cursor="+encodeURIComponent(list.next)});
  assert.equal(new Set([...list.trades,...listNext.trades].map(t=>t.id)).size,40);
  const analytics=await api("GET",{route:"/api/bitacora?mode=analytics&details=1"});
  assert.equal(analytics.summary.closed+analytics.summary.open,226);assert.ok(analytics.groups.length);
  const detail=await api("GET",{route:"/api/bitacora?mode=detail&id="+extraRows[0].id});assert.equal(detail.trade.id,extraRows[0].id);assert.equal(detail.captures.length,1);
  await api("GET",{route:"/api/bitacora?mode=detail&id="+extraRows[0].id,user:"test-b",status:404});
  await api("GET",{route:"/api/bitacora?mode=list&from=2026-02-31",status:422});
  await api("GET",{route:"/api/bitacora?mode=list&size=100000",status:422});
  await api("GET",{route:"/api/bitacora?mode=list&q="+encodeURIComponent("' OR 1=1 --"),user:"test-b"});
  const balanceAlert=await api("GET",{route:"/api/bitacora?mode=daily-risk&today=2026-11-16"});assert.ok(Array.isArray(balanceAlert.accounts));
  await db.prepare("UPDATE trades SET version=version+1 WHERE user_id=? AND id=?").bind("test-a",extraRows[0].id).run();
  await api("GET",{route:"/api/bitacora?mode=list&cursor="+encodeURIComponent(list.next),status:409});
  assert.equal(final.plan.riskPercent, .5);
  const separate = await api("GET",{user:"test-b"});
  assert.deepEqual(separate.reviews,[]);
  assert.equal(separate.planVersion,0);
  assert.deepEqual(separate.setups,[]);
  assert.deepEqual(separate.captures,[]);
  assert.ok(!exportTrades(separate.trades,separate).includes(tradeId));
  await write({action:"saveReview",week:"2026-11-16",scope:accountId,version:1,review},422,"test-b");
  await write({action:"savePlan",version:1,plan:final.plan},409,"test-b");
  assert.equal((await (await mf.getR2Bucket("BUCKET")).list()).objects.length, 0);
  const injectedId = crypto.randomUUID();
  const injected = { ...account, name: "'); DROP TABLE accounts; --" };
  await write({ action: "saveAccount", id: injectedId, version: null, userId: "test-b", account: { ...injected, userId: "test-b", isAdmin: true } });
  const preserved = (await api("GET")).accounts.find(({ id }) => id === injectedId);
  assert.equal(preserved.name, injected.name);
  assert.equal("isAdmin" in preserved || "userId" in preserved, false, "Los campos internos del cliente se descartan");
  assert.equal((await api("GET", { user: "test-b" })).accounts.length, 0);
  const legacyId = "00112233-4455-0000-0000-66778899aabb";
  await write({ action: "saveAccount", id: legacyId, version: null, account });
  await write({ action: "saveAccount", id: legacyId, version: 1, account: { ...account, name: "Cuenta importada anterior" } });
  assert.equal((await api("GET")).accounts.find(({ id }) => id === legacyId).version, 2);
  console.log("Verified compiled Worker with D1 and R2: authenticated CRUD, journal scope, capture links and read-only legacy screenshots, data isolation, metrics, CSV round trip and deduplication, plans and weekly reviews.");
} finally {
  await mf.dispose();
}
