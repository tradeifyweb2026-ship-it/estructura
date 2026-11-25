export const flowCookie = "__Host-tradeify-oauth";
export const sessionCookie = "__Host-tradeify-session";
export const flowSeconds = 600;
export const sessionSeconds = 7 * 24 * 3600;
export const callbackPath = "/oauth/google/callback";
export const encode = new TextEncoder();
export const decode = new TextDecoder();
export const noCache = { "Cache-Control": "private, no-store" };

export type Flow = { state: string; verifier: string; expiresAt: number };
export type Session = { method?: "email"; sub: string; email: string; expiresAt: number; id: string };

export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function bytes(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (character) => character.charCodeAt(0));
}

export function readCookie(request: Request, name: string) {
  return request.headers.get("Cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))?.slice(name.length + 1);
}

export function cookie(name: string, value: string, seconds: number) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}

export function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location, ...noCache });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}

export function failure(message: string, status: number, clearFlow = false) {
  const headers = new Headers({ ...noCache, "Content-Type": "text/plain; charset=utf-8" });
  if (clearFlow) headers.set("Set-Cookie", cookie(flowCookie, "", 0));
  return new Response(message, { status, headers });
}

export async function seal(key: CryptoKey, purpose: string, value: Flow | Session) {
  const payload = base64url(encode.encode(JSON.stringify(value)));
  const mac = await crypto.subtle.sign("HMAC", key, encode.encode(purpose + "." + payload));
  return payload + "." + base64url(new Uint8Array(mac));
}

export async function unseal<T extends Flow | Session>(key: CryptoKey, purpose: string, value?: string): Promise<T | null> {
  if (!value || value.length > 1500 || !/^[\w-]+\.[\w-]+$/.test(value)) return null;
  try {
    const [payload, mac] = value.split(".");
    if (!await crypto.subtle.verify("HMAC", key, bytes(mac), encode.encode(purpose + "." + payload))) return null;
    const data = JSON.parse(decode.decode(bytes(payload))) as T;
    return Number.isSafeInteger(data.expiresAt) && data.expiresAt > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export async function sessionHash(id: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encode.encode(id))));
}

export function validSession(session: Session | null): session is Session {
  return !!session && typeof session.email === "string" && session.email.includes("@") && typeof session.sub === "string" &&
    (session.method === "email" ? session.sub === session.email : /^[\w-]{1,128}$/.test(session.sub)) && typeof session.id === "string" && /^[\w-]{43}$/.test(session.id);
}

export type Identity = Pick<Session,"sub"|"email"|"method">;
export function identityId(identity: Identity) {
  return (identity.method === "email" ? "email:" : "google:") + identity.sub;
}
export async function issueSession(db: D1Database, key: CryptoKey, sessionPurpose: string, identity: Identity, device = "Dispositivo") {
      const id = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const expiresAt = Date.now() + sessionSeconds * 1000;
      await db.batch([
        db.prepare("DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE expires_at <= ? LIMIT 100)").bind(Date.now()),
        db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at,created_at,last_seen,device) VALUES (?, ?, ?,?,?,?)")
          .bind(await sessionHash(id), identityId(identity), expiresAt,Date.now(),Date.now(),device.slice(0,180)),
      ]);
      const session = await seal(key, sessionPurpose, { ...identity, expiresAt, id });
      console.info("Tradeify session created");
      return cookie(sessionCookie, session, sessionSeconds);
}
