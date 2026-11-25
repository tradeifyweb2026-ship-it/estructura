import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {captureSource,publicCaptureSlots,recordCompleteness} from '../lib/capture-comparison.ts';
const bundled=await build({stdin:{contents:`export {initialJournal} from './sites/tradeify-v2-visual-preview/src/fixtures.js'; export {mutateLocal} from './sites/tradeify-v2-visual-preview/src/local-save.js';`,resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'node',write:false});
await mkdir('outputs/visual-contracts',{recursive:true});await writeFile('outputs/visual-contracts/bundle.mjs',bundled.outputFiles[0].text);
const {initialJournal,mutateLocal}=await import('../outputs/visual-contracts/bundle.mjs');
let checks=0;function check(name,job){try{job();checks++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name, e.issues??e.message);process.exit(1);}}
check('Capturas: hosts, páginas y slots seguros',()=>{
 assert.equal(captureSource({link:'https://example.com/x/test/'},'before'),null);
 assert.equal(captureSource({link:'https://www.tradingview.com/x/DEMOANTES/'},'before'),null);
 assert.equal(captureSource({privateImage:'/api/capturas?trade=demo&slot=after'},'before'),null);
 assert.equal(captureSource({privateImage:'//evil.test/api/capturas?slot=before'},'before'),null);
 assert.equal(captureSource({privateImage:'/api/capturas?trade=demo&slot=before'},'before'),'/api/capturas?trade=demo&slot=before');
 const slots=publicCaptureSlots([['Salida','https://www.tradingview.com/x/AFTER/'],['Entrada','https://www.tradingview.com/x/BEFORE/']]);assert.match(slots.before.link,/BEFORE/);assert.match(slots.after.link,/AFTER/);assert.equal(publicCaptureSlots([['Salida','https://www.tradingview.com/x/AFTER/']]).before.link,undefined);
});
check('Completitud mide campos y no rentabilidad',()=>{const j=initialJournal(),t=j.trades.find(x=>x.asset==='DATOS_INCOMPLETOS'),c=recordCompleteness(t);assert.ok(c.percent>=0&&c.percent<100);assert.equal(c.checks.find(x=>x.label==='Entrada y stop').complete,false);});
check('CRUD demo validado y conflicto de versión conserva origen',()=>{const j=initialJournal(),t=j.trades.find(t=>t.pnlCents!==null),saved=mutateLocal(j,{action:'saveTrade',id:t.id,version:t.version,trade:{...t,asset:'LOCAL_TEST'}});assert.equal(saved.journal.trades.find(x=>x.id===t.id).asset,'LOCAL_TEST');assert.equal(j.trades.find(x=>x.id===t.id).asset,t.asset);assert.throws(()=>mutateLocal(saved.journal,{action:'saveTrade',id:t.id,version:t.version,trade:t}),/409/);});
check('Importación: deduplicación dentro y entre lotes',()=>{const j=initialJournal(),t=j.trades.find(t=>t.pnlCents!==null),imports=new Set(),one={id:crypto.randomUUID(),key:'local-import-key-0001',trade:t};const a=mutateLocal(j,{action:'importTrades',accountId:t.accountId,trades:[one,{...one,id:crypto.randomUUID()}]},imports);assert.equal(a.result.imported,1);assert.equal(a.result.skipped,1);assert.equal(mutateLocal(a.journal,{action:'importTrades',accountId:t.accountId,trades:[one]},imports).result.imported,0);});
const graph=JSON.parse(await readFile('sites/tradeify-v2-visual-preview/build-metafile.json','utf8'));
assert.ok(!graph.sourceInputs.some(x=>/(?:^|\/)worker\/|(?:^|\/)db\/|components\/journal\/asset-picker.tsx/.test(x)));
const html=await readFile('sites/tradeify-v2-visual-preview/dist/index.html','utf8');assert.match(html,/connect-src &#39;self&#39;|connect-src 'self'/);assert.ok(!/workers\.dev|tradeify\.tradeify-web|google\.com/.test(html));
const chart=await readFile('components/ui/chart.tsx','utf8');assert.ok(!chart.includes('dangerouslySetInnerHTML'));
checks++;console.log('PASS Demo construida sin catálogo remoto ni código del servidor');
console.log(JSON.stringify({checks,scope:'Contratos estáticos y lógica local; no sustituye pruebas visuales.'}));
