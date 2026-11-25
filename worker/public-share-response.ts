/** Public error pages deliberately contain no sign-in, panel or support identity. */
export function publicShareResponse(response:Response){
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store, max-age=0');headers.set('Pragma','no-cache');headers.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet');headers.set('Referrer-Policy','no-referrer');
 if(response.status<400)return new Response(response.body,{status:response.status,headers});
 for(const name of ['Content-Length','Content-Encoding','ETag','Set-Cookie','X-Tradeify-State','X-Tradeify-Email','X-Tradeify-Until'])headers.delete(name);
 headers.set('Content-Type','text/html; charset=utf-8');
 const message=response.status===429?'Espera un minuto y vuelve a intentarlo.':response.status===503?'Inténtalo más tarde.':'Puede haber vencido, haberse revocado o no existir.';
 return new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Enlace no disponible · Tradeify</title></head><body><main><h1>Enlace no disponible</h1><p>'+message+'</p></main></body></html>',{status:response.status,headers});
}
