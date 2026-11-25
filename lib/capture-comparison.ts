import {isDirectCaptureImage,isTradingViewCaptureLink,type Trade} from './journal.ts';
export type CaptureSide={link?:string;privateImage?:string};
export function captureSource(side:CaptureSide|undefined,slot:'before'|'after'){
 if(side?.link)return isDirectCaptureImage(side.link)?side.link:null;
 if(!side?.privateImage)return null;
 try{const u=new URL(side.privateImage,'https://local.invalid');return side.privateImage.startsWith('/api/capturas?')&&u.origin==='https://local.invalid'&&u.pathname==='/api/capturas'&&u.searchParams.get('slot')===slot&&!u.hash?side.privateImage:null;}catch{return null;}
}
/** Public snapshots use canonical labels; array ordering never assigns slots. */
export function publicCaptureSlots(links:readonly(readonly[string,string])[]){
 const get=(labels:string[])=>links.find(([label,url])=>labels.includes(label)&&isTradingViewCaptureLink(url))?.[1];
 return {before:{link:get(['Entrada','Antes'])},after:{link:get(['Salida','Después'])}};
}
export function recordCompleteness(trade:Trade,hasPrivateCapture=false){
 const checks=[{label:'Cuenta',complete:!!trade.accountId},{label:'Entrada y stop',complete:trade.entry!==null&&trade.stop!==null},{label:'Estrategia',complete:!!trade.setupId||!!trade.setupSnapshot},{label:'Emoción previa',complete:!!trade.before},{label:'Notas',complete:trade.notes.some(n=>!!n.text.trim())},{label:'Captura o enlace',complete:hasPrivateCapture||Object.values(trade.captureLinks??{}).some(v=>!!v&&isTradingViewCaptureLink(v))},...(trade.closedAt!==null?[{label:'Resultado registrado',complete:trade.pnlCents!==null}]:[])];
 return {checks,percent:Math.round(checks.filter(c=>c.complete).length/checks.length*100)};
}
