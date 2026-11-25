import {terminalQrSvg,type TerminalQr} from './terminal-qr.ts';
import {tradeSheet,type ReportOptions} from './report.ts';
import {CURRENCIES,isTradingViewCaptureLink,outcome,type Trade,type Journal} from './journal.ts';
import {shareTradeReturn,sharePercentLabel} from './share-return.ts';
export type TerminalResultUnit='r'|'percent'|'both';
export type TerminalCardOptions={aspect:'1:1'|'4:5'|'9:16';variant:'compact'|'detailed';theme:'dark'|'light';resultUnit:TerminalResultUnit};
export const terminalCardDefaults:TerminalCardOptions={aspect:'4:5',variant:'compact',theme:'dark',resultUnit:'r'};
export type TerminalCardData={asset:string;side:'LONG'|'SHORT';date:string;status:string;tone:'positive'|'negative'|'flat'|'open'|'missing';r:string;percent:string;percentReason:string;money:string|null;prices:[string,string][];setup:string;account:string;note:string;links:[string,string][];partialCount:number;demo:boolean};
const reasons={available:'Sobre el capital inicial registrado',open:'La operación está abierta; no hay resultado neto cerrado','date-invalid':'La fecha de cierre no es válida', 'net-missing':'Falta el P&L neto completo registrado','account-missing':'Falta una cuenta identificada sin ambigüedad','capital-invalid':'Falta capital inicial registrado positivo','currency-invalid':'La divisa registrada no es válida'};
/** Build the sharing projection first; the SVG never receives a Journal or IDs. */
export function terminalCardData(trade:Trade,journal:Journal,now:number,privacy:Partial<ReportOptions>={},demo=false):TerminalCardData{
 const allowed={money:false,notes:false,account:false,strategies:false,prices:false,captures:false,capital:false,...privacy},sheet=tradeSheet(trade,journal,now,allowed,demo),result=outcome(trade),measure=shareTradeReturn(trade,journal.accounts);
 const accountMatches=journal.accounts.filter(a=>a.id===trade.accountId),validMoney=trade.closedAt!==null&&accountMatches.length===1&&CURRENCIES.includes(accountMatches[0].currency)&&trade.pnlCents!==null&&Number.isSafeInteger(trade.pnlCents);
 const links:[string,string][]=[];if(allowed.captures){for(const [title,url]of [['Entrada',trade.captureLinks?.before],['Salida',trade.captureLinks?.after]])if(url&&isTradingViewCaptureLink(url))links.push([title!,url]);}
 const tone=result==='open'?'open':result==='win'?'positive':result==='loss'?'negative':result==='flat'?'flat':'missing';
 return {asset:sheet.asset,side:sheet.long?'LONG':'SHORT',date:sheet.when,status:result==='open'?(trade.partials.length?'Abierta con parciales':'Abierta'):result==='unknown'?'Datos incompletos':sheet.status,tone,r:result==='open'?'No disponible':sheet.r==='—'?'No disponible':sheet.r,percent:sharePercentLabel(measure.percent),percentReason:reasons[measure.reason],money:allowed.money?(validMoney?sheet.money:'No disponible'):null,prices:allowed.prices?[sheet.facts[0],['Stop inicial',sheet.facts[1][1]],[trade.partials.length?'Salida media':'Salida',sheet.facts[3][1]]]:[],setup:allowed.strategies?(trade.setupSnapshot?.name??sheet.setup):'',account:allowed.account?sheet.account:'',note:allowed.notes?[sheet.note,sheet.emotion].filter(Boolean).join(' · '):'',links,partialCount:trade.partials.length,demo};
}
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clip=(value:string,length:number)=>Array.from(value).length>length?Array.from(value).slice(0,length-1).join('')+'…':value;
const lines=(value:string,length=56,max=3)=>{const chars=Array.from(value),result:string[]=[];for(let i=0;i<chars.length&&result.length<max;i+=length)result.push(chars.slice(i,i+length).join(''));if(chars.length>length*max)result[max-1]=clip(result[max-1],length-1)+'…';return result;};
/** Original SVG implementation of the supplied Terminal reference, no runtime
 * or external font/CDN. The fixed curve is explicitly decorative, never data.
 */
export function terminalCardSvg(data:TerminalCardData,options:TerminalCardOptions=terminalCardDefaults,fontCss='',qr?:TerminalQr):string{
 const width=1080,height=options.aspect==='1:1'?1080:options.aspect==='9:16'?1920:1350,light=options.theme==='light';
 const colors=light?{outside:'#F0F4F7',card:'#FFFFFF',line:'#D2DCE4',text:'#101820',muted:'#526170',graph:'#F7FAFC',positive:'#00794F',negative:'#B22644',flat:'#805600',open:'#006B82',missing:'#526170'}:{outside:'#07090C',card:'#0E1217',line:'#1F2A33',text:'#FFFFFF',muted:'#8B99A7',graph:'#0A0E12',positive:'#3EF2B0',negative:'#FF7189',flat:'#F1C366',open:'#77DDF4',missing:'#A8B4BF'};
 const accent=colors[data.tone],margin=52,inside=100,cw=880,header=160,baseGraph=height===1080?240:height===1920?380:280,graphH=qr?Math.max(baseGraph,(qr.size+8)*4+48):baseGraph,graphEnd=header+graphH,footer=height-94;
 const text=(x:number,y:number,value:string,size:number,color=colors.text,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`;
 const mono='style="font-family:ui-monospace,Consolas,monospace"';
 const primary=options.resultUnit==='percent'?data.percent:data.r,secondary=options.resultUnit==='both'?data.percent:'',detailed=options.variant==='detailed';
 const basis=options.resultUnit!=='r'?data.percentReason:'';
 const note=detailed?lines(data.note,56,3):[],core=data.links.length*80+(basis?40:0)+74+216+(secondary?54:0)+(data.money?48:0)+(data.setup&&detailed?46:0)+(data.prices.length?126:0)+(note.length?30+note.length*30:0);
 const blockCount=2+Number(!!data.links.length)+Number(!!basis)+Number(!!secondary)+Number(!!data.money)+Number(!!data.setup&&detailed)+Number(!!data.prices.length)+Number(!!note.length),available=footer-graphEnd-100,scale=Math.min(1,available/(core+24*(blockCount-1))),gap=Math.min(90,Math.max(24,(available/scale-core)/Math.max(1,blockCount-1))),offset=inside+(cw-cw*scale)/2,verticalOffset=Math.max(0,(available/scale-core-gap*(blockCount-1))*.4);
 let y=0,body='';
 body+=text(0,y+54,clip(data.asset,34),Math.min(52,Math.max(30,700/(Array.from(data.asset).length*.61))),colors.text,'font-weight="650"');
 body+=`<rect x="736" y="16" width="144" height="42" rx="10" fill="${colors.card}" stroke="${colors.line}"/>`+text(808,y+45,data.side,22,accent,mono+' text-anchor="middle"');y+=74+gap;
 const mainSize=primary==='No disponible'?96:Math.min(184,840/(Math.max(1,Array.from(primary).length)*.62));
 body+=text(0,y+mainSize,primary,mainSize,primary==='No disponible'?colors.missing:accent,'font-weight="720" letter-spacing="-4"');
 body+=text(880,y+205,data.status.toUpperCase(),22,colors.muted,mono+' text-anchor="end"');y+=216+gap;
 if(secondary){body+=text(0,y+38,secondary,44,accent,'font-weight="650"');y+=54+gap;}
 if(basis){body+=text(0,y+26,clip(basis,65),23,colors.muted);y+=40+gap;}
 if(data.money){body+=text(0,y+32,'NETO · '+data.money,30,colors.text,mono);y+=48+gap;}
 if(data.setup&&detailed){body+=text(0,y+30,'ESTRATEGIA · '+clip(data.setup,46),26,colors.muted);y+=46+gap;}
 if(data.prices.length){body+=`<rect x="0" y="${y}" width="880" height="126" rx="24" fill="none" stroke="${colors.line}" stroke-width="2"/>`;data.prices.slice(0,3).forEach(([label,value],i)=>{const x=i*880/3;if(i)body+=`<path d="M${x} ${y}v126" stroke="${colors.line}" stroke-width="2"/>`;body+=text(x+28,y+42,label.toUpperCase(),22,colors.muted,mono)+text(x+28,y+92,clip(value,15),Math.min(30,230/(Math.max(1,Array.from(clip(value,15)).length)*.62)),colors.text,mono);});y+=126+gap;}
 if(note.length){body+=text(0,y+22,'NOTA AUTORIZADA',20,colors.muted,mono);note.forEach((line,i)=>{body+=text(0,y+56+i*30,line,25,colors.text);});y+=30+note.length*30+gap;}
 for(const [label,url]of data.links){body+=text(0,y+24,label.toUpperCase()+' · ENLACE AUTORIZADO',20,colors.muted,mono)+text(0,y+56,clip(url,65),20,colors.text,mono);y+=80;}
 const qrModule=qr?Math.max(4,Math.floor((graphH-48)/(qr.size+8))):0,qrSide=qr?(qr.size+8)*qrModule:0,qrX=1004-qrSide,curveWidth=qr?qrX-76:976;
 const qrMarkup=qr?terminalQrSvg(qr,qrX,header+20,qrModule)+text(qrX+qrSide/2,graphEnd-9,'VER OPERACIÓN',17,colors.muted,mono+' text-anchor="middle"'):'';
 const curve=`M0 194 C70 180 120 130 180 150 S290 210 370 168 S490 70 580 110 S700 160 770 84 S890 42 976 24`;
 const footerLeft=[data.demo?'DATOS DE EJEMPLO':data.money?'IMPORTE AUTORIZADO':'IMPORTES OCULTOS',data.partialCount?`${data.partialCount} PARCIAL${data.partialCount===1?'':'ES'}`:''].filter(Boolean).join(' · ');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(data.asset+' · '+data.status+' · '+primary)}"><defs><style>${fontCss}text{font-family:Geist,Inter,system-ui,sans-serif}</style><clipPath id="terminal-clip"><rect x="52" y="52" width="976" height="${height-104}" rx="44"/></clipPath></defs><rect width="1080" height="${height}" fill="${colors.outside}"/><rect x="${margin}" y="${margin}" width="976" height="${height-104}" rx="44" fill="${colors.card}" stroke="${colors.line}" stroke-width="2"/><g clip-path="url(#terminal-clip)">${text(100,114,'TRADEIFY / OPERACIÓN',24,colors.muted,mono+' letter-spacing="2"')}${text(980,114,clip(data.date,34),22,colors.muted,mono+' text-anchor="end"')}<path d="M52 160h976" stroke="${colors.line}" stroke-width="2"/><rect x="52" y="160" width="976" height="${graphH}" fill="${colors.graph}"/><g transform="translate(52 160) scale(${curveWidth/976} ${graphH/240})"><path d="${curve} L976 240H0Z" fill="${accent}" fill-opacity=".07"/><path d="${curve}" fill="none" stroke="${accent}" stroke-width="5"/></g>${qrMarkup}${text(qr?qrX-24:980,graphEnd-18,'CURVA DECORATIVA · SIN DATOS HISTÓRICOS',17,colors.muted,mono+' text-anchor="end"')}<path d="M52 ${graphEnd}h976" stroke="${colors.line}" stroke-width="2"/><g transform="translate(${offset} ${graphEnd+48+verticalOffset*scale}) scale(${scale})">${body}</g>${text(100,footer,clip(footerLeft,52),20,colors.muted,mono)}${text(980,footer,clip(data.account||'PRIVADO / COMPARTIDO POR TI',35),20,colors.muted,mono+' text-anchor="end"')}</g></svg>`;
}
