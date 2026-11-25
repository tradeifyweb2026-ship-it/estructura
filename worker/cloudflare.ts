import {recordIncident,type IncidentCode} from "./incidents";
import {presentResponse} from "./status-page";
import handler from "vinext/server/fetch-handler";
import { cloudflareAuth } from "./google-auth";
import { securityHeaders,scriptPolicy } from "./security-headers";
import {base64url} from "./session";
import {publicShareResponse} from "./public-share-response";
import {cleanupPublicShares} from "../db/public-shares";
import {cleanupStorage} from "./storage-cleanup";

const worker = {
  async scheduled(_event: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    if(env.DB)ctx.waitUntil(cleanupPublicShares(env.DB).catch(()=>console.error('Tradeify public share cleanup pending')));
    if(env.DB&&env.BUCKET)ctx.waitUntil(cleanupStorage(env.DB,env.BUCKET).catch(async()=>{
      console.error("Tradeify storage cleanup pending");
      await recordIncident(env.DB!,"storage_failure");
    }));
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const nonce=base64url(crypto.getRandomValues(new Uint8Array(16)));
    const headers=new Headers(request.headers);
    // Vinext reads this trusted request policy and propagates the nonce to
    // streamed RSC/bootstrap scripts. Never accept a client-supplied nonce.
    headers.set('Content-Security-Policy',scriptPolicy(nonce));
    request=new Request(request,{headers});
    try {
      const authenticated = await cloudflareAuth(request, env);
      const response = authenticated instanceof Response ? authenticated : await handler.fetch(authenticated, env, ctx);
      if(response.status>=500&&!response.headers.has('Retry-After')&&env.DB){const missing=!env.TRADEIFY_ORIGIN||!env.TRADEIFY_OWNER_EMAIL||!env.TRADEIFY_GOOGLE_CLIENT_ID||!env.TRADEIFY_GOOGLE_CLIENT_SECRET||!env.TRADEIFY_SESSION_SECRET;const code:IncidentCode=missing?'configuration_incomplete':new URL(request.url).pathname.startsWith('/api/capturas')&&env.BUCKET?'storage_failure':'runtime_failure';ctx.waitUntil(recordIncident(env.DB,code));}
      if (response.status >= 400) {
        const pathname = new URL(request.url).pathname;
        const area = pathname.startsWith("/api/") ? "api" : ["/entrar", "/salir", "/oauth/google/callback"].includes(pathname) ? "auth" : "page";
        console.warn("Tradeify security response", { area, status: response.status });
      }
      return securityHeaders(new URL(request.url).pathname.startsWith('/p/')?publicShareResponse(response):await presentResponse(request,response,env.TRADEIFY_SUPPORT_EMAIL),false,nonce);
    } catch {
      console.error("Tradeify request unavailable");
      if(env.DB)ctx.waitUntil(recordIncident(env.DB,"runtime_failure"));
      return securityHeaders(new URL(request.url).pathname.startsWith('/p/')?publicShareResponse(new Response(null,{status:503})):await presentResponse(request,new Response("No se pudo completar la solicitud. Inténtalo de nuevo.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),env.TRADEIFY_SUPPORT_EMAIL),false,nonce);
    }
  },
};

export default worker;
