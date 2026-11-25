import assert from 'node:assert/strict';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture();
try{
 const fetchPage=()=>f.request('/',{headers:{Cookie:f.cookies.normal,'Content-Security-Policy':"script-src 'nonce-attacker' * 'unsafe-inline'"}});
 const first=await fetchPage(),second=await fetchPage(),policy=first.headers.get('Content-Security-Policy'),nonce=policy.match(/'nonce-([\w-]+)'/)[1],html=await first.text();
 assert.equal(nonce.length,22);assert.notEqual(second.headers.get('Content-Security-Policy').match(/'nonce-([\w-]+)'/)[1],nonce);
 assert.ok(!policy.includes('unsafe-inline'));assert.ok(!policy.includes('unsafe-eval'));assert.ok(!policy.includes('*'));assert.ok(!policy.includes('attacker'));assert.match(policy,/script-src-attr 'none'/);
 const scripts=[...html.matchAll(/<script\b([^>]*)>/g)].map(match=>match[1]);assert.ok(scripts.length>0);
 for(const attrs of scripts)if(!/src=/.test(attrs)&&!/type="application\/(?:json|ld\+json)"/.test(attrs))assert.ok(attrs.includes('nonce="'+nonce+'"'),'Script inline sin nonce: '+attrs);
 assert.equal(first.headers.get('Cache-Control'),'private, no-store');console.log('check-csp: nonce aleatorio por respuesta, cabecera del cliente descartada, scripts SSR/RSC coinciden y sin unsafe-inline/eval/comodines. Navegador se comprueba aparte.');
}finally{await f.dispose();}
