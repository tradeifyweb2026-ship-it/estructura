import {cleanupStorage} from "./storage-cleanup";
import {recordIncident} from "./incidents";
import {readJson,RequestBodyError} from "../lib/request-body";
import {maintenanceState} from "./admin-resources";
import {deniedAccess} from "./status-page";
import {accessAllowed,adminApi,isAdmin,registerUser,type AccessUser} from "./access";
import {type Session,type Flow, callbackPath, flowCookie,sessionCookie,flowSeconds,encode,base64url,readCookie,cookie,redirect,failure,seal,unseal,sessionHash,validSession,noCache,identityId,issueSession} from "./session";
export async function cloudflareAuth(request: Request, env: Cloudflare.Env): Promise<Request | Response> {
  const url = new URL(request.url);
  const origin = env.TRADEIFY_ORIGIN?.trim().replace(/\/$/, "");
  const clientId = env.TRADEIFY_GOOGLE_CLIENT_ID;
  const secret = env.TRADEIFY_GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.TRADEIFY_SESSION_SECRET;
  if (!origin?.startsWith("https://") || !clientId || !secret || !sessionSecret || sessionSecret.length < 32 || !env.DB) {
    return failure("Completa la configuración de acceso de Tradeify en Cloudflare.", 503);
  }
  if (url.origin !== origin) return failure("Abre Tradeify desde su dirección configurada.", 421);

  const emailRoute = ["/correo/enviar","/correo/verificar"].includes(url.pathname);
  const authRoute = emailRoute || url.pathname === "/entrar" || url.pathname === callbackPath;
  const publicRoute=url.pathname.startsWith("/p/");
  const limiter = authRoute ? env.AUTH_RATE_LIMITER : url.pathname.startsWith("/api/")||publicRoute ? env.API_RATE_LIMITER : undefined;
  if (limiter) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    const { success } = await limiter.limit({ key: "tradeify:" + (authRoute ? "auth:" : "api:") + ip });
    if (!success) {
      return Response.json({ error: "Demasiadas solicitudes. Espera un minuto y vuelve a intentarlo." }, {
        status: 429, headers: { ...noCache, "Retry-After": "60" },
      });
    }
  }

  if(url.pathname==="/api/estado"&&request.method==="GET")return Response.json(await maintenanceState(env.DB),{headers:noCache});

  if(publicRoute){
    if(!/^\/p\/[A-Za-z0-9_-]{43}$/.test(url.pathname))return failure("Enlace no disponible.",404);
    if(!['GET','HEAD'].includes(request.method))return failure("Método no disponible.",405);
    if((await maintenanceState(env.DB)).active)return new Response('Enlace no disponible.',{status:503,headers:{...noCache,'Retry-After':'60'}});
    const publicHeaders=new Headers(request.headers);for(const name of [...publicHeaders.keys()])if(name.startsWith('oai-authenticated-user-')||name.startsWith('x-tradeify-')||name==='cookie'||name==='authorization')publicHeaders.delete(name);
    return new Request(request,{headers:publicHeaders});
  }

  const key = await crypto.subtle.importKey("raw", encode.encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const flowPurpose = origin + ":oauth";
  const sessionPurpose = origin + ":session";
  if (emailRoute) return failure("El acceso por correo está desactivado. Utiliza Google.",410);
  if (url.pathname === "/entrar" && request.method === "GET") {
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encode.encode(verifier))));
    const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    google.search = new URLSearchParams({
      client_id: clientId, redirect_uri: origin + callbackPath, response_type: "code",
      scope: "openid email", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
    }).toString();
    const flow = await seal(key, flowPurpose, { state, verifier, expiresAt: Date.now() + flowSeconds * 1000 });
    return redirect(google.href, [cookie(flowCookie, flow, flowSeconds)]);
  }

  if (url.pathname === callbackPath && request.method === "GET") {
    const flow = await unseal<Flow>(key, flowPurpose, readCookie(request, flowCookie));
    const code = url.searchParams.get("code");
    if (!flow || !code || flow.state !== url.searchParams.get("state")) {
      return failure("La solicitud de acceso venció o se canceló. Vuelve al inicio e inténtalo de nuevo.", 400, true);
    }
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code", code, redirect_uri: origin + callbackPath,
          client_id: clientId, client_secret: secret, code_verifier: flow.verifier,
        }),
      });
      if (!tokenResponse.ok) return failure("Google no pudo confirmar el acceso. Inténtalo de nuevo.", 502, true);
      const tokens = await tokenResponse.json() as { access_token?: string };
      if (!tokens.access_token) return failure("Google no pudo confirmar el acceso. Inténtalo de nuevo.", 502, true);
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: "Bearer " + tokens.access_token },
      });
      if (!profileResponse.ok) return failure("Google no pudo confirmar el acceso. Inténtalo de nuevo.", 502, true);
      const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean };
      if (profile.email_verified !== true || typeof profile.email !== "string" || !profile.email.includes("@") ||
          typeof profile.sub !== "string" || !/^[\w-]{1,128}$/.test(profile.sub)) {
        return failure("Esta cuenta de Google no tiene acceso a Tradeify.", 403, true);
      }
      const administrator=isAdmin(profile.email.toLowerCase(),env.TRADEIFY_OWNER_EMAIL);
      const user=await registerUser(env.DB,"google:"+profile.sub,profile.email.toLowerCase(),administrator);
      if(!user || (!administrator && !accessAllowed(user))){
        const denial=deniedAccess(user);
        denial.headers.append("Set-Cookie",cookie(flowCookie,"",0));
        return denial;
      }
      const issued = await issueSession(env.DB,key,sessionPurpose,{sub:profile.sub,email:profile.email.toLowerCase()},request.headers.get("User-Agent") ?? "Dispositivo");
      return redirect("/",[cookie(flowCookie,"",0),issued]);
    } catch {
      return failure("No se pudo conectar con Google. Inténtalo de nuevo.", 502, true);
    }
  }

  if (url.pathname === "/salir" && request.method === "GET") {
    if (request.headers.get("Sec-Fetch-Site") === "cross-site" ||
        (request.headers.has("Origin") && request.headers.get("Origin") !== origin)) {
      return failure("Abre Tradeify para cerrar sesión.", 403);
    }
    const session = await unseal<Session>(key, sessionPurpose, readCookie(request, sessionCookie));
    if (validSession(session)) {
      await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ? AND user_id = ?")
        .bind(await sessionHash(session.id), identityId(session)).run();
      console.info("Tradeify session revoked");
    }
    return redirect("/", [cookie(sessionCookie, "", 0), cookie(flowCookie, "", 0)]);
  }

  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  headers.set("x-tradeify-market",env.TRADEIFY_MARKET_SYMBOL ?? "OANDA:EURUSD");
  headers.delete("x-tradeify-email");
  headers.delete("x-tradeify-admin");
  headers.delete("x-tradeify-support");
  const support=env.TRADEIFY_SUPPORT_EMAIL?.trim();
  if(support&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(support)&&support.length<=254)headers.set("x-tradeify-support",support);
  headers.set("x-tradeify-provider", "google");
  if (["/privacidad","/condiciones"].includes(url.pathname)) return new Request(request,{headers});
  const session = await unseal<Session>(key, sessionPurpose, readCookie(request, sessionCookie));
  if (validSession(session)) {
    const active = await env.DB.prepare("SELECT token_hash FROM auth_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?")
      .bind(await sessionHash(session.id), identityId(session), Date.now()).first();
    if (active && session.method !== "email") {
      const administrator=isAdmin(session.email,env.TRADEIFY_OWNER_EMAIL);
      let user=await env.DB.prepare("SELECT * FROM users WHERE user_id=?").bind(identityId(session)).first<AccessUser>();
      user ??= await registerUser(env.DB,identityId(session),session.email,administrator);
      if(!administrator && (!user || !accessAllowed(user))) return deniedAccess(user);
      // Count only a DB-verified active session. Revoked cookies and spoofed
      // identity headers cannot spend another user's allowance. This native
      // binding is approximate per location, not a global billing quota.
      if(url.pathname.startsWith('/api/')&&env.USER_RATE_LIMITER){
        const expensive=url.pathname==='/api/bitacora'&&request.method==='GET';
        const mode=url.searchParams.get('mode');
        const delta=expensive?(!mode||mode==='analytics'?10:mode==='section'?5:1):request.method==='GET'?1:5;
        if(!(await env.USER_RATE_LIMITER.limit({key:'tradeify:user:'+identityId(session),delta})).success)
          return Response.json({error:'Alcanzaste el límite temporal de consultas. Espera un minuto y vuelve a intentarlo.'},{status:429,headers:{...noCache,'Retry-After':'60'}});
      }
      await env.DB.prepare("UPDATE auth_sessions SET last_seen=? WHERE token_hash=? AND last_seen<?").bind(Date.now(),await sessionHash(session.id),Date.now()-300000).run();
      if(url.pathname.startsWith("/api/admin")){
        if(!administrator)return failure("Acceso reservado al administrador.",403);
        if(request.method!=="GET" && (request.headers.get("Origin")!==origin || request.headers.get("X-Bitacora-Request")!=="1" || request.headers.get("Sec-Fetch-Site")==="cross-site"))return failure("Origen no permitido.",403);
        return adminApi(request,env.DB,identityId(session),env.TRADEIFY_OWNER_EMAIL!,env.TRADEIFY_MAX_TRADES);
      }
      if(url.pathname==="/administracion" && !administrator)return failure("Acceso reservado al administrador.",403);
      if(!administrator&&url.pathname!=="/api/compartir"&&request.method!=="GET"&&request.method!=="HEAD"){const maintenance=await maintenanceState(env.DB);if(maintenance.active)return Response.json({error:maintenance.message||"Tradeify está en mantenimiento de solo lectura. Tus datos se conservan.",maintenance},{status:503,headers:{...noCache,"Retry-After":"60"}});}
      headers.set("x-tradeify-admin",administrator?"1":"0");
      if (url.pathname === "/api/mi-cuenta") {
        if (request.method !== "POST") return failure("Utiliza el formulario de configuración.", 405);
        if (request.headers.get("Origin") !== origin || request.headers.get("Sec-Fetch-Site") === "cross-site" || request.headers.get("X-Bitacora-Request") !== "1") return failure("Origen no permitido.", 403);
        let raw: unknown;
        try { raw = await readJson(request, 16384); }
        catch (error) { if (error instanceof RequestBodyError) return failure(error.message,error.status); throw error; }
        const input = raw && typeof raw === "object" ? raw as {action?: unknown; confirm?: unknown} : null;
        const userId = identityId(session);
        if (input?.action === "delete" && input.confirm === "ELIMINAR") {
          if(administrator)return failure("La cuenta propietaria está protegida contra eliminación.",422);
          const files = await env.DB.prepare("SELECT object_key FROM attachments WHERE user_id = ?").bind(userId).all<{object_key:string}>();
          if (files.results.length && !env.BUCKET) return failure("El almacenamiento de capturas no está disponible.", 503);
          const tables = ["quote_favorites","quote_deliveries","quote_state","journal_section_cache","restore_receipts","attachments","trades","accounts","setups","plans","reviews","daily_quote_progress","user_limits","users","auth_sessions","journal_revisions"];
          await env.DB.batch([...tables.map(table => env.DB!.prepare("DELETE FROM " + table + " WHERE user_id = ?").bind(userId)),env.DB.prepare("DELETE FROM access_invitations WHERE email=?").bind(session.email)]);
          if(env.BUCKET)try { await cleanupStorage(env.DB,env.BUCKET,userId); }
          catch { console.error("Tradeify storage cleanup queued"); await recordIncident(env.DB,"storage_failure").catch(()=>undefined); }
        } else if (input?.action === "sessions") {
          await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(userId).run();
        } else return failure("Confirma la acción solicitada.", 422);
        return new Response(null,{status:204,headers:{...noCache,"Set-Cookie":cookie(sessionCookie,"",0)}});
      }
      headers.set("oai-authenticated-user-id", identityId(session));
      headers.set("oai-authenticated-user-email", session.email);
    }
  }
  if ((url.pathname.startsWith("/api/admin") || url.pathname === "/administracion") &&
      headers.get("x-tradeify-admin") !== "1") {
    return failure("Inicia sesión como administrador.",401);
  }
  if (url.pathname === "/api/mi-cuenta") return failure("Inicia sesión.", 401);
  return new Request(request, { headers });
}
