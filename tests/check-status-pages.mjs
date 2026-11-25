import assert from "node:assert/strict";
import {deniedAccess,presentResponse} from "../worker/status-page.ts";
import {draftKey,parseDraft,editorDraftSchema} from "../lib/editor-draft.ts";
const request=new Request("https://tradeify.example.test/oauth/google/callback");
const base={user_id:"google:test",email:'name<test>@example.test',created_at:1,last_login:1,status:"pending",access_until:null,suspended_until:null};
for(const [user,title] of [
 [base,"pendiente de aprobación"],
 [{...base,status:"blocked"},"está bloqueado"],
 [{...base,status:"active",access_until:1},"período de acceso terminó"],
 [{...base,status:"suspended",suspended_until:Date.now()+60000},"está suspendido"],
 [null,"registro está cerrado"]
]){
 const response=await presentResponse(request,deniedAccess(user));
 assert.equal(response.status,403);
 assert.match(response.headers.get("content-type"),/text\/html/);
 const html=await response.text();
 assert.ok(html.includes(title));
 assert.ok(html.includes('href="/entrar"'));
 assert.ok(!html.includes("name<test>"));
 assert.ok(!response.headers.has("X-Tradeify-Email"));
}
const api=await presentResponse(new Request("https://tradeify.example.test/api/bitacora"),deniedAccess(base));
assert.equal(api.status,403);
assert.deepEqual(await api.json(),{error:"Tu cuenta no tiene acceso en este momento."});
for(const status of [400,401,403,410,421,429,503]){
 const response=await presentResponse(request,new Response("Error técnico",{status}));
 assert.equal(response.status,status);
 assert.match(await response.text(),/Tradeify/);
}
const draft={version:null,step:"entry",fields:{asset:["US100"]},accountId:"",closed:false,direction:"long",entry:"25000",stop:"",target:"",checklist:[],partials:[],notes:[{key:0,kind:"text",text:"Sin completar",checked:false}],savedAt:1};
assert.ok(editorDraftSchema.safeParse(draft).success);
assert.deepEqual(parseDraft(JSON.stringify(draft)),draft);
assert.equal(parseDraft("{"),null);
assert.equal(parseDraft('{"notes":"incorrecto"}'),null);
assert.notEqual(draftKey("user-a"),draftKey("user-b"));
assert.notEqual(draftKey("user-a","trade-1"),draftKey("user-a","trade-2"));
console.log("Pantallas de acceso: estados, escapado, JSON privado y borradores incompletos verificados.");
