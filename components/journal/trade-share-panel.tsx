"use client";
import Image from 'next/image';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Journal,Trade} from '@/lib/journal';
import type {ReportOptions} from '@/lib/report';
import {terminalCardData,terminalCardSvg,terminalCardDefaults,type TerminalCardOptions} from '@/lib/terminal-card';
import {fontCss,shareOrCopy,svgToPng} from '@/lib/share';
import {Button,Field} from './ui';
import {CapturePreview} from './capture-preview';
import {terminalQr} from '@/lib/terminal-qr';
import {PublicShareControls} from './public-share-controls';
import {HelpLink} from './help-center';
export function TradeSharePanel({trade,journal,now,demo,busy,run}:{trade:Trade;journal:Journal;now:number;demo:boolean;busy:boolean;run:(job:()=>Promise<string|void>)=>Promise<void>}){
 const [settings,setSettings]=useState<TerminalCardOptions>(terminalCardDefaults),[privacy,setPrivacy]=useState<ReportOptions>({money:false,notes:false,account:false,strategies:false,prices:false,captures:false,capital:false}),[font,setFont]=useState(''),[fontReady,setFontReady]=useState(false);
 useEffect(()=>{let active=true;void fontCss().then(value=>{if(active){setFont(value);setFontReady(true);}});return()=>{active=false;};},[]);
 const [qrUrl,setQrUrl]=useState<string|undefined>();const onQr=useCallback((url:string|undefined)=>setQrUrl(url),[]);const qr=useMemo(()=>qrUrl?terminalQr(qrUrl):undefined,[qrUrl]);
 const data=useMemo(()=>terminalCardData(trade,journal,now,privacy,demo),[trade,journal,now,privacy,demo]);
 const svg=useMemo(()=>terminalCardSvg(data,settings,font,qr),[data,settings,font,qr]);
 const height=settings.aspect==='1:1'?1080:settings.aspect==='9:16'?1920:1350;
 async function image(){await run(async()=>{const blob=await svgToPng(terminalCardSvg(data,settings,font,qr),1,settings.aspect),file=new File([blob],'tradeify-operacion.png',{type:'image/png'}),outcome=await shareOrCopy({title:'Tradeify · '+data.asset,file});return outcome==='downloaded'?'Tarjeta PNG descargada.':outcome==='shared'?'Tarjeta compartida.':undefined;});}
 async function text(){await run(async()=>{const result=settings.resultUnit==='r'?data.r:settings.resultUnit==='percent'?data.percent:data.r+' · '+data.percent;
  const body=['TRADEIFY / OPERACIÓN',data.asset+' · '+data.side,data.date,data.status,'Resultado: '+result,...(settings.resultUnit!=='r'?[data.percentReason]:[]),...(data.money?['P&L neto: '+data.money]:[]),...data.prices.map(([label,value])=>label+': '+value),...(data.setup&&settings.variant==='detailed'?['Estrategia: '+data.setup]:[]),...(data.account?['Cuenta: '+data.account]:[]),...(data.note&&settings.variant==='detailed'?['Nota: '+data.note]:[]),...data.links.map(([label,url])=>'Captura de '+label.toLowerCase()+': '+url),...(data.demo?['Datos de ejemplo']:[])].join('\n');
  const outcome=await shareOrCopy({title:'Tradeify · '+data.asset,text:body});return outcome==='copied'?'Texto de esta tarjeta copiado.':outcome==='shared'?'Texto compartido.':undefined;
 });}
 return <section className="trade-share-panel" aria-label="Tarjeta compartible Terminal Premium">
  <HelpLink topic="tarjetas-terminal"/>
  <div className="form-grid"><Field label="Resultado en la tarjeta"><select value={settings.resultUnit} disabled={busy} onChange={e=>setSettings({...settings,resultUnit:e.target.value as TerminalCardOptions['resultUnit']})}><option value="r">Solo R</option><option value="percent">Solo %</option><option value="both">R y %</option></select></Field>
   <Field label="Formato de imagen"><select value={settings.aspect} disabled={busy} onChange={e=>setSettings({...settings,aspect:e.target.value as TerminalCardOptions['aspect']})}><option value="1:1">1:1 · Cuadrado</option><option value="4:5">4:5 · Publicación</option><option value="9:16">9:16 · Historia</option></select></Field>
   <Field label="Detalle de tarjeta"><select value={settings.variant} disabled={busy} onChange={e=>setSettings({...settings,variant:e.target.value as TerminalCardOptions['variant']})}><option value="compact">Compacta</option><option value="detailed">Detallada</option></select></Field>
   <Field label="Tema de tarjeta"><select value={settings.theme} disabled={busy} onChange={e=>setSettings({...settings,theme:e.target.value as TerminalCardOptions['theme']})}><option value="dark">Terminal oscuro</option><option value="light">Terminal claro</option></select></Field></div>
  <p>Porcentaje = P&amp;L neto completo / capital inicial registrado de la cuenta × 100. No usa saldo actual, equity ni riesgo por operación. {settings.resultUnit!=='r'&&data.percent==='No disponible'&&<strong role="status">{data.percentReason}.</strong>}</p>
  <fieldset className="export-options"><legend>Privacidad de esta tarjeta</legend>{([['money','Importes en dinero'],['prices','Precios de entrada, stop y salida'],['strategies','Estrategia'],['account','Nombre de cuenta'],['notes','Notas y emociones'],['captures','Enlaces de capturas']] as const).map(([key,label])=><label key={key}><input type="checkbox" disabled={busy} checked={privacy[key]===true} onChange={e=>setPrivacy({...privacy,[key]:e.target.checked})}/><span><strong>{label}</strong></span></label>)}<p>Estas opciones se reinician al abrir otra tarjeta. No cambian reportes ni respaldos. La variante compacta omite notas y estrategia; la detallada muestra los datos autorizados.</p></fieldset>
  <figure className="terminal-preview">{fontReady?<Image unoptimized src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} width={1080} height={height} alt={'Vista previa exacta de la tarjeta: '+data.asset+' · '+data.status} style={{width:'100%',height:'auto'}}/>:<p role="status">Preparando la vista previa…</p>}<figcaption>Curva decorativa identificada; no representa el historial. Vista previa del contenido del PNG.</figcaption></figure>
  {privacy.captures&&<section aria-label="Comprobar enlaces autorizados"><p>El PNG muestra las direcciones autorizadas; estas miniaturas sirven para comprobar los enlaces. No se incorporan capturas privadas almacenadas ni se convierten páginas en imágenes.</p>{data.links.length?data.links.map(([title,url])=><CapturePreview key={title+url} link={url} title={title} asset={data.asset}/>):<p>Esta operación no tiene enlaces de TradingView. Puedes añadirlos desde Editar → Diario.</p>}</section>}
  <PublicShareControls trade={trade} journal={journal} now={now} demo={demo} busy={busy} run={run} font={font} onQr={onQr}/>
  <div className="group-buttons"><Button tone="primary" disabled={busy||!fontReady} onClick={()=>void image()}>Imagen PNG</Button><Button disabled={busy} onClick={()=>void text()}>Texto</Button></div>
 </section>;
}
