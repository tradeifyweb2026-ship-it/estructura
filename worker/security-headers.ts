export function scriptPolicy(nonce: string) {
  return "script-src 'self' 'nonce-"+nonce+"' https://widgets.tradingview-widget.com https://s3.tradingview.com; script-src-attr 'none'";
}

export function securityHeaders(response: Response, embedded = false, nonce?: string) {
  const secured = new Response(response.body, response);
  secured.headers.set("Cache-Control", "private, no-store");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "no-referrer");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if(!embedded)secured.headers.set("Strict-Transport-Security","max-age=31536000");
  const policy = "base-uri 'self'; object-src 'none'; form-action 'self'";
  secured.headers.set("Content-Security-Policy", (embedded ? policy : policy + "; frame-ancestors 'self'") + (nonce ? "; " + scriptPolicy(nonce) : ""));
  if (!embedded) secured.headers.set("X-Frame-Options", "SAMEORIGIN");
  return secured;
}
