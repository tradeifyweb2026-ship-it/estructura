import assert from 'node:assert/strict';
import {appFixture} from './app-browser-fixture.mjs';
const f=await appFixture();
try{
 const email='long-'+('a'.repeat(170))+'@example.test',now=Date.now();
 await f.db.batch([f.db.prepare('INSERT INTO users(user_id,email,created_at,last_login,status) VALUES (?,?,?,?,?)').bind('google:long-search',email,now,now,'active'),f.db.prepare('INSERT INTO access_invitations VALUES (?,NULL)').bind(email),f.db.prepare('INSERT INTO admin_events VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'google:owner',email,'invite',now,'{}')]);
 const get=async params=>{const r=await f.request('/api/admin?'+new URLSearchParams(params),{headers:{Cookie:f.cookies.owner}});assert.equal(r.status,200);return r.json();};
 const found=await get({q:email.toUpperCase(),inviteQ:email,eventQ:email});assert.equal(found.total,1);assert.equal(found.inviteTotal,1);assert.equal(found.eventTotal,1);
 const literal=await get({q:'%',inviteQ:'_',eventQ:"'; DROP TABLE users;--"});assert.equal(literal.total,0);assert.equal(literal.inviteTotal,0);assert.equal(literal.eventTotal,0);assert.ok(await f.db.prepare('SELECT count(*) n FROM users').first('n')>1);
 console.log('check-admin-search: búsqueda literal parametrizada, mayúsculas y correo >50 bytes en usuarios/invitaciones/eventos; sin LIKE limitado por D1.');
}finally{await f.dispose();}
