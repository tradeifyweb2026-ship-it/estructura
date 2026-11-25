import QRCode from 'qrcode';
import {publicTokenPattern} from './public-share.ts';
export type TerminalQr={url:string;size:number;modules:Uint8Array};
/** Local encoder, no network, pixel-aligned modules, ECC Q. */
export function terminalQr(url:string):TerminalQr{
 const value=new URL(url);if(value.protocol!=='https:'||value.username||value.password||value.hash||value.search||!publicTokenPattern.test(value.pathname.slice(3))||!value.pathname.startsWith('/p/')||url.length>512)throw new Error('Crea primero un enlace público válido para añadir su QR.');
 const qr=QRCode.create(value.href,{errorCorrectionLevel:'Q'});return {url:value.href,size:qr.modules.size,modules:qr.modules.data};
}
export function terminalQrSvg(qr:TerminalQr,x:number,y:number,moduleSize:number){
 const quiet=4,side=(qr.size+quiet*2)*moduleSize;let path='';
 for(let row=0;row<qr.size;row++)for(let col=0;col<qr.size;col++)if(qr.modules[row*qr.size+col])path+=`M${x+(col+quiet)*moduleSize} ${y+(row+quiet)*moduleSize}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
 return `<g aria-label="QR del enlace público"><rect x="${x}" y="${y}" width="${side}" height="${side}" fill="#FFFFFF"/><path d="${path}" fill="#000000" shape-rendering="crispEdges"/></g>`;
}
