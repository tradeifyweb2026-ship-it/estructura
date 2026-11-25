import {base64url, bytes, encode, issueSession} from "./session";
import {sendLoginCode} from "./resend";

function numberCode() {
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= 4294000000);
  return String(random[0] % 1000000).padStart(6,"0");
}

export async function emailLogin(request: Request, env: Cloudflare.Env, key: CryptoKey, purpose: string) {
  const db = env.DB;
  const message = (error: string,status: number) => Response.json({error},{status});
  if (!db || !env.TRADEIFY_EMAIL_API_KEY || !env.TRADEIFY_EMAIL_FROM) return message("Acceso no disponible.",404);
  if (request.method !== "POST" || request.headers.get("Origin") !== new URL(request.url).origin || request.headers.get("X-Bitacora-Request") !== "1") return message("Solicitud no válida.",403);
  const body = await request.json<{email?:unknown;code?:unknown}>().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[^\x21-\x7e]/.test(email)) return message("Escribe un correo válido.",422);
  const digest = async (value:string) => base64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,encode.encode(value))));
  const hash = await digest("email:"+email);
  const sending = new URL(request.url).pathname.endsWith("/enviar");
  if (!env.AUTH_RATE_LIMITER || !(await env.AUTH_RATE_LIMITER.limit({key:"correo:"+hash+":"+sending})).success) return message("Espera antes de intentarlo de nuevo.",429);
  const now = Date.now();
  if (sending) {
    const code = numberCode();
    const codeHash = await digest("codigo:"+hash+":"+code);
    await db.batch([
      db.prepare("DELETE FROM login_codes WHERE email_hash IN (SELECT email_hash FROM login_codes WHERE expires_at<=? LIMIT 50)").bind(now),
      db.prepare("INSERT INTO login_codes VALUES (?,?,?,0,?) ON CONFLICT(email_hash) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at").bind(hash,codeHash,now+600000,now)
    ]);
    try { await sendLoginCode(env,email,code); } catch { return message("No se pudo enviar el código. Inténtalo de nuevo.",503); }
    return Response.json({ok:true});
  }
  const invalid = () => message("El código no es válido o ha vencido.",401);
  if (typeof body?.code !== "string" || !/^\d{6}$/.test(body.code)) return invalid();
  const row = await db.prepare("UPDATE login_codes SET attempts=attempts+1 WHERE email_hash=? AND expires_at>? AND attempts<5 RETURNING code_hash,created_at").bind(hash,now).first<{code_hash:string;created_at:number}>();
  if (!row || !await crypto.subtle.verify("HMAC",key,bytes(row.code_hash),encode.encode("codigo:"+hash+":"+body.code))) return invalid();
  const consumed = await db.prepare("DELETE FROM login_codes WHERE email_hash=? AND code_hash=? AND created_at=? AND expires_at>? RETURNING email_hash").bind(hash,row.code_hash,row.created_at,Date.now()).first();
  if (!consumed) return invalid();
  const session = await issueSession(db,key,purpose,{sub:email,email,method:"email"});
  return Response.json({ok:true},{headers:{"Set-Cookie":session}});
}
