import assert from "node:assert/strict";
import { exampleJournal } from "../lib/demo.ts";
import { buildReport, REPORT_PROFILES } from "../lib/report.ts";
import { reportHtml } from "../lib/report-html.ts";
import { reportCsv } from "../lib/report-csv.ts";
import { reportXlsx } from "../lib/report-xlsx.ts";
import { reportText, reportCardSvg } from "../lib/share.ts";
import { summarize } from "../lib/stats.ts";
const now=Date.parse("2026-11-16T20:42:00Z"),journal=exampleJournal("2026-11-16");
const base={journal,trades:journal.trades,scope:"all",period:"Selección de prueba",account:"CUENTA_PRIVADA",assumedCurrency:"USD",now};
const titles=new Set();
for(const profile of Object.keys(REPORT_PROFILES)){
 const source={...base,profile,trades:profile==="operacion"?[journal.trades[0]]:journal.trades};
 const report=buildReport(source);titles.add(report.title);
 assert.equal(report.counts.closed,summarize(source.trades,journal.accounts).closed);
 assert.ok(report.warnings.length>0);assert.equal(report.trades.length,0);
 const html=reportHtml(report),csv=reportCsv(report),text=reportText(report),svg=reportCardSvg(report),xlsx=new TextDecoder().decode(reportXlsx(report,new Date(now)));
 for(const content of [html,csv,text,svg,xlsx]){assert.ok(!content.includes("CUENTA_PRIVADA"));assert.ok(content.toUpperCase().includes(report.title.toUpperCase()),profile+": título en todas las salidas");}
 for(const s of report.sections){assert.ok(html.includes(s.title.replaceAll("&","&amp;")));assert.ok(csv.includes(s.title));assert.ok(text.includes(s.title));assert.ok(xlsx.includes(s.title.replaceAll("&","&amp;")));assert.ok(s.rows.every(row=>row.length===s.columns.length));}
 for(const k of report.kpis){assert.ok(text.includes(k.value));assert.ok(html.includes(k.value));}
 assert.ok(!JSON.stringify(report).includes("startingBalance"));
 const empty=buildReport({...source,trades:[]});assert.ok(empty.warnings.some(w=>w.startsWith("Sin operaciones")));assert.ok(reportHtml(empty).includes("<html"));assert.ok(reportXlsx(empty).length>0);
}
assert.equal(titles.size,10);
const reviewed=structuredClone(journal);reviewed.reviews=[{week:"2026-11-16",scope:"all",version:1,followed:"SOLO_SELECCION",repeat:"Practicar",change:"Pausar"},{week:"2026-11-09",scope:"all",version:1,followed:"OTRO_PERIODO",repeat:"",change:""}];
const reviewSource={...base,journal:reviewed,profile:"semanal",reviewKey:"2026-11-16"};
assert.ok(reportText(buildReport({...reviewSource,options:{notes:true}})).includes("SOLO_SELECCION"));assert.ok(!reportText(buildReport({...reviewSource,options:{notes:true}})).includes("OTRO_PERIODO"));assert.ok(!reportText(buildReport(reviewSource)).includes("SOLO_SELECCION"));
const psy=buildReport({...base,profile:"psicologia",options:{notes:true}});assert.ok(psy.sections.some(s=>s.title.includes("Emoción")));
assert.ok(!buildReport({...base,profile:"psicologia"}).sections.some(s=>s.title.includes("Emoción")));
const risk=buildReport({...base,profile:"riesgo",completeHistory:true});assert.ok(risk.sections.some(s=>s.title.startsWith("Límites")));assert.ok(risk.sections.some(s=>s.title.includes("simultáneo")));
assert.ok(!buildReport({...base,profile:"riesgo"}).sections.some(s=>s.title.includes("simultáneo")));
const account=journal.accounts[0];
const selected=journal.trades.filter(t=>t.accountId===account.id);
const accounts=buildReport({...base,trades:selected,scope:account.id,profile:"cuentas",options:{money:true,capital:true}});
assert.equal(accounts.sections.length,1);assert.equal(accounts.sections[0].rows[0].at(-1),account.startingBalanceCents/100);
const privateAccounts=buildReport({...base,profile:"cuentas",options:{money:true,capital:false}});assert.ok(privateAccounts.sections.every(s=>s.columns.every(c=>!c.label.includes("Capital"))));
const unassigned=buildReport({...base,profile:"cuentas",scope:"unassigned",trades:[{...journal.trades[0],accountId:null}],options:{money:true}});assert.equal(unassigned.sections.length,1);assert.equal(unassigned.sections[0].title,"Sin cuenta");assert.ok(unassigned.sections[0].columns.every(c=>c.type!=="money"));
for(const profile of ["resumen","estadisticas","bitacora"]){const unknown=buildReport({...base,profile,trades:[{...journal.trades[0],accountId:null},journal.trades[1]],options:{money:true}});assert.ok(!unknown.kpis.some(k=>k.label==="P&L neto"));assert.ok(unknown.curve===null||unknown.curve.unit==="R");if(profile==="bitacora")assert.equal(unknown.sections.filter(s=>s.title.startsWith("Importes")).flatMap(s=>s.rows).length,1);}
const mixed=structuredClone(journal);mixed.accounts[1]={...mixed.accounts[0],id:"other-eur",currency:"EUR"};mixed.trades[1].accountId="other-eur";
const multi=buildReport({...base,journal:mixed,trades:mixed.trades,profile:"bitacora",options:{money:true}});assert.ok(!multi.kpis.some(k=>k.label==="P&L neto"));assert.ok(multi.sections.some(s=>s.title==="Importes · EUR"));assert.ok(multi.sections.some(s=>s.title==="Importes · USD"));
const hostile=structuredClone(journal);hostile.trades[0].asset='=HYPERLINK("x") <img src=x onerror=alert(1)>';
const h=buildReport({...base,journal:hostile,trades:hostile.trades,profile:"bitacora"});assert.ok(reportCsv(h).includes("'=HYPERLINK"));assert.ok(!reportHtml(h).includes("<img src=x"));assert.ok(!new TextDecoder().decode(reportXlsx(h)).includes("<f>=HYPERLINK"));
const large=Array.from({length:10000},(_,i)=>({...journal.trades[i%journal.trades.length],id:String(i)}));
const full=buildReport({...base,trades:large,profile:"bitacora"});assert.equal(full.sections[0].rows.length,10000);assert.equal(full.counts.closed,summarize(large,journal.accounts).closed);assert.ok(reportCsv(full).length>10000);assert.ok(reportHtml(full).length>10000);
console.log("Reportes: diez perfiles, cinco contratos de salida, privacidad, vacíos, multimoneda, tipos, inyección y 10000 registros OK. Rasterización/impresión requieren navegador real.");
