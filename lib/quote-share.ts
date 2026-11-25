import {BRAND,logoSvg} from './brand.ts';
import type {Quote} from './quote-types.ts';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function assertShareableQuote(q:Quote){if(q.provenance!=='original')throw Error('Esta frase se conserva en tu historial privado. Su procedencia debe verificarse antes de compartirla.');}
export function quoteText(q:Quote){assertShareableQuote(q);return q.text+'\n'+(q.provenance==='original'?(q.credit??'Colección original de Tradeify'):'Procedencia no verificada; sin atribución de autor')+'\nTradeify';}
export function quoteSvg(q:Quote,font=''){
 assertShareableQuote(q);
 const words=q.text.split(/\s+/),lines:string[]=[];let line='';for(const w of words){if((line+' '+w).trim().length>40){lines.push(line);line=w;}else line=(line+' '+w).trim();}if(line)lines.push(line);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><style>${font}text{font-family:Geist,Arial,sans-serif}</style></defs><rect width="1080" height="1350" fill="${BRAND.deep}"/><svg x="70" y="70" width="80" height="80" viewBox="0 0 48 48">${logoSvg(48).replace(/^<svg[^>]*>/,'').replace('</svg>','')}</svg><text x="180" y="120" fill="${BRAND.onNavy}" font-size="42">Tradeify</text><rect x="70" y="205" width="940" height="4" fill="${BRAND.violet}"/>${lines.map((l,i)=>`<text x="80" y="${400+i*74}" fill="${BRAND.onNavy}" font-size="42">${esc(l)}</text>`).join('')}<text x="80" y="1100" fill="${BRAND.onNavyMuted}" font-size="23">${esc(q.provenance==='original'?'Colección original · asistencia de IA':'Procedencia no verificada · sin autor atribuido')}</text><text x="80" y="1200" fill="${BRAND.violetSoft}" font-size="27">Registra. Revisa. Aprende.</text></svg>`;
}
