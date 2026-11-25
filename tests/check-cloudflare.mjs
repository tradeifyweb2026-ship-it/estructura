import {createVault,encryptScript} from '../lib/script-crypto.ts';
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { reserveRateWindow } from "./rate-window.mjs";

const origin = "https://tradeify.example.test";
const server = path.resolve("dist/server");
const config = JSON.parse(await readFile(path.join(server, "wrangler.json"), "utf8"));
assert.equal(config.name, "tradeify", "Primero ejecuta npm run build:cloudflare");
const files = (await readdir(server, { recursive: true })).filter((file) => /\.m?js$/.test(file) && file !== config.main);
const miniflare = new Miniflare(convertV4MiniflareOptions({
  name: "tradeify-cloudflare-test",
  modules: [config.main, ...files].map((file) => ({ type: "ESModule", path: path.join(server, file) })),
  modulesRoot: server,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  d1Databases: { DB: "standalone-test" },
  r2Buckets: config.r2_buckets.length ? { BUCKET: "standalone-test-captures" } : {},
  ratelimits: Object.fromEntries((config.ratelimits ?? []).map(({ name, namespace_id, simple }) => [name, { namespace_id, simple }])),
  bindings: {
    TRADEIFY_EMAIL_FROM:"login@example.test", TRADEIFY_EMAIL_API_KEY:"test-only",
    TRADEIFY_ORIGIN: origin,
    TRADEIFY_OWNER_EMAIL: "owner@example.test",
    TRADEIFY_GOOGLE_CLIENT_ID: "client",
    TRADEIFY_GOOGLE_CLIENT_SECRET: "example-only",
    TRADEIFY_SESSION_SECRET: "disposable-test-secret-0000000000000000",
  },
  outboundService: async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "api.resend.com") {
      assert.fail("No se deben enviar correos");
      return Response.json({id:"fake"});
    }
    if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") {
      const body = new URLSearchParams(await request.text());
      const verifier = body.get("code_verifier");
      assert.equal(Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url"), challenge);
      return Response.json({ access_token: body.get("code") });
    }
    if (url.hostname === "openidconnect.googleapis.com" && url.pathname === "/v1/userinfo") {
      return Response.json({
        sub: request.headers.get("authorization") === "Bearer other" ? "other-user" : "test-google-user",
        email: request.headers.get("authorization") === "Bearer other" ? "other@example.test" : "owner@example.test",
        email_verified: request.headers.get("authorization") !== "Bearer unverified",
      });
    }
    throw new Error("Unexpected upstream request");
  },
  cf: false,
}));

const request = (pathname, headers) => miniflare.dispatchFetch(origin + pathname, { headers, redirect: "manual" });
let challenge;
try {
  const database = await miniflare.getD1Database("DB");
  const directory = path.join(server, config.d1_databases[0].migrations_dir);
  for (const file of (await readdir(directory)).filter((item) => item.endsWith(".sql")).sort()) {
    const sql = await readFile(path.join(directory, file), "utf8");
    const prepared = sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)
      .map((part) => database.prepare(part));
    await database.batch(prepared);
  }
  const previousExample = await request("/?ejemplo=1");
  const landing = await previousExample.text();
  assert.match(landing, /Tu bitácora de trading/);
  assert.doesNotMatch(landing, /Ver ejemplo US100/);
  const guest = await request("/");
  assert.equal(guest.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(guest.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.equal(guest.headers.get("referrer-policy"), "no-referrer");
  assert.equal(guest.headers.get("x-content-type-options"), "nosniff");
  assert.match(guest.headers.get("cache-control"), /no-store/);
  assert.match(await guest.text(), /Iniciar sesión con[\s\S]*Google/);
  assert.equal((await miniflare.dispatchFetch("https://other.example.test/api/bitacora")).status, 421);
  const untrusted = await request("/api/bitacora", {
    "oai-authenticated-user-id": "google:test-google-user", "oai-authenticated-user-email": "owner@example.test",
  });
  assert.equal(untrusted.status, 401);

  const login = await request("/entrar");
  assert.equal(login.status, 303);
  const location = new URL(login.headers.get("location"));
  assert.equal(location.hostname, "accounts.google.com");
  const state = location.searchParams.get("state");
  challenge = location.searchParams.get("code_challenge");
  const oauthCookie = login.headers.get("set-cookie").split(";")[0];
  assert.match(login.headers.get("set-cookie"), /Secure; HttpOnly; SameSite=Lax/);
  const callbackPath = "/oauth/google/callback";
  assert.equal((await request(callbackPath + "?state=bad&code=owner", { Cookie: oauthCookie })).status, 400);
  assert.equal((await request(`${callbackPath}?state=${state}&code=owner`)).status, 400);
  const second = await request(`${callbackPath}?state=${state}&code=other`, {Cookie:oauthCookie});
  assert.equal(second.status,303);
  const otherCookie = second.headers.getSetCookie().find(value => value.startsWith("__Host-tradeify-session=")).split(";")[0];
  assert.equal((await request(`${callbackPath}?state=${state}&code=unverified`, { Cookie: oauthCookie })).status, 403);
  const callback = await request(`${callbackPath}?state=${state}&code=owner`, { Cookie: oauthCookie });
  assert.equal(callback.status, 303);
  const setCookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-tradeify-session="));
  assert.match(setCookie, /Secure; HttpOnly; SameSite=Lax/);
  const session = setCookie.split(";")[0];
  const invalid = session.replace(/=./, (value) => value === "=A" ? "=B" : "=A");
  assert.equal((await request("/api/bitacora", { Cookie: invalid })).status, 401);
  const scriptVault=await createVault('clave ficticia Cloudflare'),scriptId=crypto.randomUUID(),scriptPayload=await encryptScript(scriptVault.key,scriptVault.envelope.id,scriptId,1,{title:'Worker privado',description:'Sin necesidad de R2',code:'plot(close)'});
  for(const input of [{action:'vault',envelope:scriptVault.envelope},{action:'save',id:scriptId,version:null,vaultId:scriptVault.envelope.id,payload:scriptPayload}])assert.equal((await miniflare.dispatchFetch(origin+'/api/scripts',{method:'POST',headers:{Cookie:session,Origin:origin,'X-Bitacora-Request':'1','Content-Type':'application/json'},body:JSON.stringify(input)})).status,200);
  const scriptList=await request('/api/scripts?mode=list',{Cookie:session});assert.equal(scriptList.status,200);const scriptJson=await scriptList.json();assert.equal(scriptJson.items.length,1);assert.equal('code'in scriptJson.items[0],false);assert.ok(!JSON.stringify(scriptJson).includes('Worker privado'));
  const journal = await request("/api/bitacora", { Cookie: session });
  assert.equal(journal.status, 200);
  assert.deepEqual((await journal.json()).trades, []);
  const publicTradeId=crypto.randomUUID(),publicTrade={asset:'R2_OPTIONAL_QR',direction:'long',closedAt:Date.now(),entry:100,stop:95,exit:110,target:115,size:1,riskCents:5000,pnlCents:10000,feesCents:0,partials:[],notes:[],errors:[],before:null,during:null,after:null,grade:null};
  await database.prepare('INSERT INTO trades(user_id,id,version,opened_at,account_id,setup_id,data) VALUES (?,?,1,?,NULL,NULL,?)').bind('google:test-google-user',publicTradeId,Date.now()-60000,JSON.stringify(publicTrade)).run();
  const publicResponse=await miniflare.dispatchFetch(origin+'/api/compartir',{method:'POST',headers:{Cookie:session,Origin:origin,'X-Bitacora-Request':'1','Content-Type':'application/json'},body:JSON.stringify({action:'create',tradeId:publicTradeId,tradeVersion:1,accountVersion:null,visibility:{},confirmed:true})});assert.equal(publicResponse.status,200);const publicLink=await publicResponse.json();assert.equal((await request(new URL(publicLink.url).pathname)).status,200,'Snapshot público no depende de R2');
  await database.prepare('DELETE FROM trades WHERE user_id=? AND id=?').bind('google:test-google-user',publicTradeId).run();assert.equal((await request(new URL(publicLink.url).pathname)).status,404,'Borrar la operación invalida el enlace también sin R2');
  if (!config.r2_buckets.length) {
    const capture = await request("/api/capturas?trade=" + crypto.randomUUID() + "&slot=before", { Cookie: session });
    assert.equal(capture.status, 503, "R2 es opcional y su ausencia se comunica sin habilitar acceso público");
  }
  const crossOrigin = await miniflare.dispatchFetch(origin + "/api/frase-diaria", {
    method: "POST", headers: { Cookie: session, Origin: "https://hostile.example.test", "X-Bitacora-Request": "1" },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await request("/salir", { Cookie: session, Origin: "https://hostile.example.test" })).status, 403);
  assert.equal((await request("/api/bitacora", { Cookie: session })).status, 200);
  await database.prepare("INSERT INTO plans(user_id,data) VALUES (?,?)").bind("google:test-google-user","{}").run();
  const remove = await miniflare.dispatchFetch(origin+"/api/mi-cuenta",{method:"POST",headers:{Cookie:otherCookie,Origin:origin,"X-Bitacora-Request":"1","Content-Type":"application/json"},body:JSON.stringify({action:"delete",confirm:"ELIMINAR"})});
  assert.equal(remove.status,204);
  assert.equal(await database.prepare("SELECT count(*) n FROM journal_revisions WHERE user_id=?").bind("google:other-user").first("n"),0);
  assert.equal((await request("/api/bitacora",{Cookie:otherCookie})).status,401);
  assert.equal(await database.prepare("SELECT count(*) n FROM plans WHERE user_id='google:test-google-user'").first("n"),1);
  const logout = await request("/salir", { Cookie: session });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get("set-cookie"), /__Host-tradeify-session=;[^,]*Max-Age=0/);
  const replay = await request("/api/bitacora", { Cookie: session });
  assert.equal(replay.status, 401, "Una cookie copiada antes de cerrar sesión debe quedar revocada en el servidor");
  assert.equal(await database.prepare("SELECT COUNT(*) AS n FROM auth_sessions").first("n"), 0);

  const again = await request("/entrar");
  const againUrl = new URL(again.headers.get("location"));
  challenge = againUrl.searchParams.get("code_challenge");
  const againFlow = again.headers.get("set-cookie").split(";")[0];
  const againLogin = await request(`${callbackPath}?state=${againUrl.searchParams.get("state")}&code=owner`, { Cookie: againFlow });
  const againSession = againLogin.headers.getSetCookie().find((value) => value.startsWith("__Host-tradeify-session=")).split(";")[0];
  await database.prepare("UPDATE auth_sessions SET expires_at = 0").run();
  assert.equal((await request("/api/bitacora", { Cookie: againSession })).status, 401, "La expiración se comprueba también en D1");

  const disabledEmail = await miniflare.dispatchFetch(origin+"/correo/enviar",{method:"POST",body:"{}"});
  assert.equal(disabledEmail.status,410);

  let flowNumber=0;
  async function googleSession(code){
    const flowIp="192.0.2."+String(100+(flowNumber++));
    const start=await request("/entrar",{"CF-Connecting-IP":flowIp});
    const location=new URL(start.headers.get("location"));
    challenge=location.searchParams.get("code_challenge");
    const result=await request(callbackPath+"?state="+location.searchParams.get("state")+"&code="+code,{Cookie:start.headers.get("set-cookie").split(";")[0],"CF-Connecting-IP":flowIp});
    if(result.status!==303)return result;
    return result.headers.getSetCookie().find(value=>value.startsWith("__Host-tradeify-session=")).split(";")[0];
  }
  const adminCookie=await googleSession("owner");
  const otherSession=await googleSession("other");
  assert.equal(typeof adminCookie,"string");
  const adminPage = await request("/administracion",{Cookie:adminCookie});
  assert.equal(adminPage.status,200,"El propietario autenticado debe poder abrir el panel");
  assert.match(await adminPage.text(),/<h1>Administración<\/h1>/);
  const ownerHome=await (await request("/",{Cookie:adminCookie})).text();
  assert.ok(ownerHome.indexOf('href="/administracion"')>ownerHome.indexOf('class="shell"'),"Administración debe integrarse en la bitácora");
  const regularHome=await (await request("/",{Cookie:otherSession,"x-tradeify-admin":"1"})).text();
  assert.ok(!regularHome.includes('href="/administracion"'));
  assert.equal((await request("/administracion")).status,401);
  assert.equal((await request("/administracion",{"x-tradeify-admin":"1"})).status,401);
  assert.equal(typeof otherSession,"string");
  assert.equal((await request("/api/admin",{Cookie:otherSession})).status,403);
  assert.equal((await request("/administracion",{Cookie:otherSession})).status,403);
  assert.equal((await request("/api/admin",{"x-tradeify-admin":"1"})).status,401);
  const admin = async(input)=>{
    const response=await miniflare.dispatchFetch(origin+"/api/admin",{method:"POST",headers:{Cookie:adminCookie,Origin:origin,"X-Bitacora-Request":"1","Content-Type":"application/json"},body:JSON.stringify(input)});
    return response;
  };
  const target="google:other-user";
  assert.equal((await admin({action:"quota",userId:"google:test-google-user",maxTrades:1})).status,422);
  assert.equal((await admin({action:"quota",userId:target,maxTrades:12})).status,200);
  assert.equal(await database.prepare("SELECT custom_trades FROM user_limits WHERE user_id=?").bind(target).first("custom_trades"),12);
  assert.equal((await admin({action:"quota",userId:target,maxTrades:0})).status,422);
  assert.equal((await admin({action:"quota",userId:target,maxTrades:null})).status,200);
  assert.equal(await database.prepare("SELECT trades FROM user_limits WHERE user_id=?").bind(target).first("trades"),5000);
  assert.equal((await admin({action:"user",userId:"google:test-google-user",status:"blocked",until:null,suspendedUntil:null})).status,422);
  await database.prepare("INSERT INTO plans(user_id,data) VALUES (?,?)").bind(target,"{}").run();
  assert.equal((await admin({action:"user",userId:target,status:"blocked",until:null,suspendedUntil:null})).status,200);
  assert.equal((await request("/api/bitacora",{Cookie:otherSession})).status,401);
  assert.equal((await googleSession("other")).status,403);
  assert.equal(await database.prepare("SELECT count(*) n FROM plans WHERE user_id=?").bind(target).first("n"),1);
  assert.equal((await admin({action:"user",userId:target,status:"active",until:Date.now()-1000,suspendedUntil:null})).status,200);
  assert.equal((await googleSession("other")).status,403);
  await admin({action:"user",userId:target,status:"suspended",until:null,suspendedUntil:Date.now()+86400000});
  assert.equal((await googleSession("other")).status,403);
  await admin({action:"user",userId:target,status:"active",until:null,suspendedUntil:null});
  const renewed=await googleSession("other");
  assert.equal(typeof renewed,"string");
  await database.prepare("UPDATE users SET access_until=? WHERE user_id=?").bind(Date.now()-1000,target).run();
  assert.equal((await request("/api/bitacora",{Cookie:renewed})).status,403);
  await database.prepare("UPDATE users SET access_until=NULL WHERE user_id=?").bind(target).run();
  const otherHash=await database.prepare("SELECT token_hash FROM auth_sessions WHERE user_id=? AND expires_at>?").bind(target,Date.now()).first("token_hash");
  await admin({action:"revoke",userId:target,session:otherHash});
  assert.equal((await request("/api/bitacora",{Cookie:renewed})).status,401);
  assert.ok(await database.prepare("SELECT count(*) n FROM admin_events").first("n")>=5);
  const crossAdmin=await miniflare.dispatchFetch(origin+"/api/admin",{method:"POST",headers:{Cookie:adminCookie,Origin:"https://hostile.test","X-Bitacora-Request":"1","Content-Type":"application/json"},body:JSON.stringify({action:"settings",mode:"closed",days:null})});
  assert.equal(crossAdmin.status,403);
  await admin({action:"settings",mode:"approval",days:7});
  await database.prepare("DELETE FROM users WHERE user_id=?").bind(target).run();
  const pendingPage=await googleSession("other");
  assert.equal(pendingPage.status,403);
  assert.match(await pendingPage.text(),/Tu cuenta está pendiente de aprobación/);
  assert.equal(await database.prepare("SELECT status FROM users WHERE user_id=?").bind(target).first("status"),"pending");
  await admin({action:"settings",mode:"closed",days:null});
  await admin({action:"user",userId:target,status:"active",until:null,suspendedUntil:null});
  assert.equal(typeof await googleSession("other"),"string","Cerrar registros conserva las cuentas ya autorizadas");
  await database.prepare("DELETE FROM users WHERE user_id=?").bind(target).run();
  assert.equal((await googleSession("other")).status,403);
  assert.equal((await admin({action:"invite",email:"other@example.test",until:Date.now()-1000})).status,422);
  await admin({action:"invite",email:"other@example.test",until:null});
  assert.equal(typeof await googleSession("other"),"string");
  const panel=await (await request("/api/admin?eventAction=invite",{Cookie:adminCookie})).json();
  assert.ok(Array.isArray(panel.counts));assert.ok(panel.eventTotal>=1);assert.ok(panel.events.every(e=>e.action==="invite"&&!Object.hasOwn(e,"data")));
  const invitation=panel.invitations.find(i=>i.email==="other@example.test");assert.ok(Number.isFinite(invitation.created_at));assert.ok(Number.isFinite(invitation.last_sent_at));
  await admin({action:"invite",email:"other@example.test",until:null});
  const renewedInvitation=(await (await request("/api/admin?inviteQ=other%40example.test",{Cookie:adminCookie})).json()).invitations[0];
  assert.equal(renewedInvitation.created_at,invitation.created_at);assert.ok(renewedInvitation.last_sent_at>=invitation.last_sent_at);
  const eventAnchor=Date.now();
  await database.batch([
    database.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),"owner@example.test","fixture-old","fixture-date",eventAnchor-2*86400000,"{}"),
    database.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),"owner@example.test","fixture-new","fixture-date",eventAnchor-12*3600000,"{}"),
  ]);
  const dateFiltered=await (await request("/api/admin?"+new URLSearchParams({eventAction:"fixture-date",eventFrom:String(eventAnchor-86400000),eventTo:String(eventAnchor+1)}),{Cookie:adminCookie})).json();
  assert.equal(dateFiltered.eventTotal,1);assert.equal(dateFiltered.events.length,1);assert.equal(dateFiltered.events[0].target,"fixture-new");
  await database.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(target).run();
  const expiry=Date.now()+86400000,created=Date.now();
  await database.batch(Array.from({length:55},(_,i)=>database.prepare("INSERT INTO auth_sessions (token_hash,user_id,expires_at,created_at,last_seen,device) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),target,expiry,created-i*1000,created,"fixture device")));
  const sessionPage0=await (await request("/api/admin?user="+encodeURIComponent(target)+"&sessionPage=0",{Cookie:adminCookie})).json();
  const sessionPage1=await (await request("/api/admin?user="+encodeURIComponent(target)+"&sessionPage=1",{Cookie:adminCookie})).json();
  assert.equal(sessionPage0.sessionTotal,55);assert.equal(sessionPage0.sessions.length,50);
  assert.equal(sessionPage1.sessionTotal,55);assert.equal(sessionPage1.sessions.length,5);
  assert.equal((await admin({action:"revokeInvite",email:"other@example.test"})).status,200);
  assert.equal(await database.prepare("SELECT count(*) n FROM access_invitations WHERE email=?").bind("other@example.test").first("n"),0);
  await new Promise(resolve=>setTimeout(resolve,5));
  await admin({action:"invite",email:"other@example.test",until:null});
  const freshCycle=(await (await request("/api/admin?inviteQ=other%40example.test",{Cookie:adminCookie})).json()).invitations[0];
  assert.ok(freshCycle.created_at>=renewedInvitation.last_sent_at);assert.equal(freshCycle.created_at,freshCycle.last_sent_at);
  const sameTime=Date.now(),sameEmail="same-time@example.test";
  await database.batch([
    database.prepare("INSERT INTO access_invitations(email,access_until) VALUES (?,NULL)").bind(sameEmail),
    database.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),"fixture",sameEmail,"invite",sameTime-1,"{}"),
    database.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),"fixture",sameEmail,"revokeInvite",sameTime,"{}"),
    database.prepare("INSERT INTO admin_events VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),"fixture",sameEmail,"invite",sameTime,"{}"),
  ]);
  const sameCycle=(await (await request("/api/admin?inviteQ="+encodeURIComponent(sameEmail),{Cookie:adminCookie})).json()).invitations[0];
  assert.equal(sameCycle.created_at,sameTime);assert.equal(sameCycle.last_sent_at,sameTime,"Un ciclo nuevo en el mismo milisegundo conserva su fecha");
  for (const [route, bindingName, attempts] of [["/entrar", "AUTH_RATE_LIMITER", 25], ["/api/bitacora", "API_RATE_LIMITER", 125]]) {
    if (!config.ratelimits.some(({ name }) => name === bindingName)) continue;
    await reserveRateWindow();
    let limited;
    for (let count = 0; count < attempts; count++) {
      const response = await request(route, { "CF-Connecting-IP": "192.0.2.41" });
      if (response.status === 429) { limited = response; break; }
    }
    assert.equal(limited?.status, 429, bindingName);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.notEqual((await request(route, { "CF-Connecting-IP": "192.0.2.42" })).status, 429);
  }
  console.log("check-cloudflare: PKCE, propietario, cookies, revocación, expiración, CSRF, cabeceras y límites 429 verificados con Google y datos simulados.");
} finally {
  await miniflare.dispose();
}
