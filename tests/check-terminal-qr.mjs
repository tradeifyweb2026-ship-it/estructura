import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {mkdir,writeFile} from 'node:fs/promises';
import {exampleJournal} from '../lib/demo.ts';
import {terminalCardData,terminalCardSvg,terminalCardDefaults} from '../lib/terminal-card.ts';
import {terminalQr} from '../lib/terminal-qr.ts';
const journal=exampleJournal('2026-11-20'),trade=journal.trades.find(t=>t.closedAt!==null),data=terminalCardData(trade,journal,Date.now());
const url='https://tradeify.example.test/p/'+'A'.repeat(43),qr=terminalQr(url),before=terminalCardSvg(data);
for(const bad of ['http://evil.test/p/'+'a'.repeat(43),'https://evil.test/private','https://evil.test/p/'+'a'.repeat(43)+'?field=private'])assert.throws(()=>terminalQr(bad));
await mkdir('outputs/terminal-qr',{recursive:true});let count=0;
for(const aspect of ['1:1','4:5','9:16'])for(const theme of ['dark','light']){
 const svg=terminalCardSvg(data,{...terminalCardDefaults,aspect,theme},'',qr),png=await sharp(Buffer.from(svg)).png().toBuffer();
 assert.ok(svg.includes('QR del enlace público'));assert.equal(before.includes('QR del enlace público'),false);
 for(const compressed of [false,true]){
  const input=compressed?await sharp(png).resize({width:720}).jpeg({quality:65,chromaSubsampling:'4:2:0'}).toBuffer():png;
  const {data:pixels,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true}),decoded=jsQR(new Uint8ClampedArray(pixels),info.width,info.height,{inversionAttempts:'dontInvert'});assert.equal(decoded?.data,url,aspect+' '+theme+' compressed='+compressed);count++;
 }
 await writeFile('outputs/terminal-qr/'+aspect.replace(':','x')+'-'+theme+'.png',png);
}
assert.equal(terminalCardSvg(data),before,'Desactivar QR recupera el diseño completo sin reserva vacía');
console.log('check-terminal-qr: '+count+' imágenes completas decodificadas independientemente; tres formatos/dos temas, PNG y JPEG 720px/calidad65. No certifica cámaras físicas ni plataformas de mensajería.');
