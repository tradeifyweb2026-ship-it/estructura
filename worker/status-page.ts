import type {AccessUser} from "./access";
import {effectiveAccess} from "../lib/access-state.mjs";
const escape = (value:string) => value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]!));
export function deniedAccess(user:AccessUser|null) {
  if(!user)return new Response("El registro está cerrado. Solicita autorización antes de entrar.",{status:403,headers:{"X-Tradeify-State":"closed"}});
  const state=effectiveAccess(user);
  return new Response("Tu cuenta no tiene acceso en este momento.",{status:403,headers:{
    "X-Tradeify-State":state,"X-Tradeify-Email":user.email,
    ...(user.access_until?{"X-Tradeify-Until":String(user.access_until)}:{}),
    ...(state==="suspended"&&user.suspended_until?{"X-Tradeify-Until":String(user.suspended_until)}:{})
  }});
}
export async function presentResponse(request:Request,response:Response,support?:string) {
  if(response.status<400)return response;
  const type=response.headers.get("Content-Type")??"";
  if(type.includes("json")||type.includes("html"))return response;
  if(request.method==="HEAD")return response;
  const message=await response.text();
  const headers=new Headers(response.headers);
  const state=headers.get("X-Tradeify-State")??"";
  const email=headers.get("X-Tradeify-Email")??"";
  const rawUntil=Number(headers.get("X-Tradeify-Until"));
  for(const name of ["X-Tradeify-State","X-Tradeify-Email","X-Tradeify-Until"])headers.delete(name);
  if(new URL(request.url).pathname.startsWith("/api/")){
    headers.set("Content-Type","application/json; charset=utf-8");
    return new Response(JSON.stringify({error:message}),{status:response.status,headers});
  }
  const states:Record<string,[string,string]>={
    pending:["Tu cuenta está pendiente de aprobación","Tu identidad se confirmó con Google. El administrador debe autorizar tu acceso."],
    blocked:["Tu acceso está bloqueado","Comunícate con el responsable de Tradeify para revisar tu acceso."],
    expired:["Tu período de acceso terminó","Puedes solicitar al administrador que renueve tu autorización."],
    suspended:["Tu acceso está suspendido","Podrás volver a utilizar la bitácora cuando termine la suspensión y tu permiso esté vigente."],
    closed:["El registro está cerrado","Solicita autorización al administrador o entra con una cuenta que ya esté autorizada."]
  };
  const [title,description]=states[state]??(
    response.status===401?["Vuelve a iniciar sesión","Tu sesión no está disponible o ha caducado."]:
    response.status===403?["Acceso restringido","Esta sección requiere una cuenta autorizada."]:
    response.status===429?["Espera un momento","Has realizado varias solicitudes. Espera un minuto y vuelve a intentarlo."]:
    response.status===400?["El acceso no se completó","La solicitud puede haber caducado. Inicia el acceso otra vez."]:
    ["No pudimos completar la solicitud","Inténtalo de nuevo en unos momentos. Si el problema continúa, contacta con el responsable."]);
  const until=rawUntil&&Number.isFinite(rawUntil)?new Date(rawUntil).toLocaleString("es-EC",{timeZone:"America/Guayaquil"}):"";
  const contact=support&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(support)?'<a class="button" href="mailto:'+escape(support)+'">Contactar al responsable</a>':'<p class="hint">Comunícate con quien te facilitó el acceso a Tradeify.</p>';
  headers.set("Content-Type","text/html; charset=utf-8");
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} · Tradeify</title><style>
  @font-face{font-family:Geist;src:url('/geist.woff2')}*{box-sizing:border-box}body{margin:0;background:#0c0f1b;color:#f2f3fb;font-family:Geist,system-ui,sans-serif;line-height:1.55}main{min-height:100dvh;display:grid;place-items:center;padding:24px}.card{width:100%;max-width:500px;background:#14192b;border:1px solid #262e47;border-radius:20px;padding:clamp(24px,6vw,40px)}.brand{font-weight:750;color:#b8a8ff;letter-spacing:.02em}h1{font-size:clamp(25px,6vw,32px);line-height:1.2;margin:24px 0 14px}p{color:#a9b1ca;overflow-wrap:anywhere}.actions{display:grid;gap:10px;margin-top:24px}.button{display:flex;justify-content:center;align-items:center;min-height:46px;padding:10px 16px;border:1px solid #414b68;border-radius:9px;color:inherit;text-decoration:none}.primary{background:#b8a8ff;color:#211940;border:0;font-weight:650}.hint,footer{font-size:13px}footer{margin-top:24px}footer a{color:#c8cfe3;margin-right:12px}a:focus-visible{outline:3px solid #b8a8ff;outline-offset:4px}@media(prefers-color-scheme:light){body{background:#f4f5fa;color:#1b2340}.card{background:#fff;border-color:#dee2ed}p{color:#53607b}.brand{color:#573ab1}footer a{color:#404c68}}
  </style></head><body><main><section class="card" aria-labelledby="title"><div class="brand">Tradeify · Bitácora de trading</div><h1 id="title">${escape(title)}</h1><p>${escape(description)}</p>${email?'<p>Cuenta de Google<br><strong>'+escape(email)+'</strong></p>':""}${until?'<p>'+(state==="suspended"?"Suspensión hasta":"Vencimiento")+'<br>'+escape(until)+' · Ecuador</p>':""}<div class="actions"><a class="button primary" href="/entrar">Usar otra cuenta de Google</a><a class="button" href="/">Volver al inicio</a>${contact}</div><footer><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a></footer></section></main></body></html>`,{status:response.status,headers});
}
