import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {exampleJournal} from '../lib/demo.ts';
import {terminalCardData,terminalCardSvg,terminalCardDefaults} from '../lib/terminal-card.ts';
const journal=exampleJournal('2026-11-20'),initial=journal.trades.find(t=>t.closedAt!==null),account=journal.accounts.find(a=>a.id===initial.accountId);
account.name='CUENTA SENSIBLE';account.startingBalanceCents=1000000;
const trade={...initial,asset:'NASDAQ 100',pnlCents:16000,riskCents:5000,feesCents:500,notes:[{kind:'text',text:'NOTA PRIVADA',checked:false}]};
const before=JSON.stringify({trade,journal}),plain=terminalCardData(trade,journal,Date.now());
assert.equal(plain.r,'+3,2 R');assert.equal(plain.percent,'+1,6 %');assert.equal(plain.money,null);assert.deepEqual(plain.links,[]);assert.equal(plain.account,'');assert.equal(plain.note,'');assert.deepEqual(plain.prices,[]);
assert.equal(terminalCardData({...trade,accountId:null},journal,Date.now(),{money:true}).money,'No disponible','No inferir USD sin cuenta válida');
const linked=terminalCardData({...trade,captureLinks:{before:'https://www.tradingview.com/x/example/'}},journal,Date.now(),{captures:true});assert.equal(linked.links.length,1);assert.ok(terminalCardSvg(linked).includes('tradingview.com/x/example'));
assert.equal(terminalCardData({...trade,captureLinks:{before:'https://untrusted.example/private.png'}},journal,Date.now(),{captures:true}).links.length,0,'Los enlaces no autorizados no entran en la proyección');
const historical={...trade,setupSnapshot:{version:1,name:'REGLAS HISTÓRICAS',rules:'',description:''}};
assert.equal(terminalCardData(historical,journal,Date.now(),{strategies:true}).setup,'REGLAS HISTÓRICAS','La tarjeta conserva la estrategia registrada en la operación');
const dark=terminalCardSvg(plain);for(const value of ['CUENTA SENSIBLE','NOTA PRIVADA',String(account.startingBalanceCents),trade.id])assert.equal(dark.includes(value),false);
assert.ok(dark.includes('CURVA DECORATIVA'));assert.ok(dark.includes('SIN DATOS HISTÓRICOS'));assert.equal(dark.includes('Código'),false);
assert.equal(JSON.stringify({trade,journal}),before,'La proyección no modifica ninguna operación ni saldo');
const cases={positive:trade,negative:{...trade,pnlCents:-16000},flat:{...trade,pnlCents:0},open:{...trade,closedAt:null,pnlCents:null},partial:{...trade,closedAt:null,pnlCents:null,partials:[{price:trade.entry+1,percent:25,at:Date.now(),pnlCents:1000}]},missing:{...trade,pnlCents:null,riskCents:null,entry:null,stop:null,exit:null,partials:[]}};
await mkdir('outputs/terminal-prototypes',{recursive:true});let checked=0;
for(const [name,t]of Object.entries(cases))for(const aspect of ['1:1','4:5','9:16'])for(const theme of ['dark','light'])for(const resultUnit of ['r','percent','both']){
 const data=terminalCardData(t,journal,Date.now()),svg=terminalCardSvg(data,{...terminalCardDefaults,aspect,theme,resultUnit});
 assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('Infinity'));assert.ok(!svg.includes('<script'));assert.ok(!svg.includes('undefined'));
 const height=aspect==='1:1'?1080:aspect==='9:16'?1920:1350;assert.ok(svg.includes('width="1080" height="'+height+'"'));
 if(name==='open'||name==='partial'){assert.equal(data.percent,'No disponible');assert.equal(data.r,'No disponible');}
 if(name==='flat')assert.equal(data.tone,'flat');if(name==='missing')assert.equal(data.tone,'missing');
 if(resultUnit!=='r')assert.ok(svg.includes(data.percentReason.replaceAll('&','&amp;')));
 if(name==='positive'&&resultUnit==='both'){
  const png=await sharp(Buffer.from(svg)).png().toBuffer(),meta=await sharp(png).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,height);
  await writeFile('outputs/terminal-prototypes/'+name+'-'+aspect.replace(':','x')+'-'+theme+'.png',png);
 }
 checked++;
}
const privateView=terminalCardData(trade,journal,Date.now(),{account:true,notes:true,prices:true,money:true,strategies:true}),privateSvg=terminalCardSvg(privateView,{...terminalCardDefaults,aspect:'1:1',variant:'detailed',resultUnit:'both'});
assert.ok(privateSvg.includes('CUENTA SENSIBLE'));assert.ok(privateSvg.includes('NOTA PRIVADA'));assert.equal(privateView.prices.length,3);assert.ok(privateView.money);
const malicious={...privateView,asset:'</text><script>alert(1)</script>',note:'<img src=x onerror=alert(1)>'};const safe=terminalCardSvg(malicious,{...terminalCardDefaults,variant:'detailed'});assert.equal(safe.includes('<script'),false);assert.equal(safe.includes('<img'),false);assert.ok(safe.includes('&lt;'));
console.log('check-terminal-card: '+checked+' variantes SVG, privacidad, escape, dimensiones y seis PNG rasterizados. Prototipos, no reemplazan Chromium.');
