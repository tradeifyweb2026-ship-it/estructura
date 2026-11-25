'use client';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {snapshotCard,type PublicSnapshot} from '@/lib/public-share';
import {terminalCardSvg,terminalCardDefaults} from '@/lib/terminal-card';
import {fontCss} from '@/lib/share';
import {PublicSnapshotDetails} from './public-snapshot-details';
import {CaptureCompare} from './capture-compare';
import {publicCaptureSlots} from '@/lib/capture-comparison';
import {CapturePreview} from './capture-preview';
export function PublicTradeView({snapshot,expiresAt}:{snapshot:PublicSnapshot;expiresAt:number}){
 const [font,setFont]=useState('');useEffect(()=>{let active=true;void fontCss().then(f=>{if(active)setFont(f);});return()=>{active=false;};},[]);
 const data=snapshotCard(snapshot),svg=terminalCardSvg(data,{...terminalCardDefaults,variant:'detailed',resultUnit:snapshot.percent?'both':'r'},font);
 return <main className="public-trade-page"><h1>Operación compartida</h1><p>Snapshot congelado. No refleja ediciones posteriores ni verifica operaciones de un bróker.</p><figure className="terminal-preview"><Image unoptimized src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} width={1080} height={1350} alt={'Operación compartida: '+data.asset+' · '+data.status} style={{width:'100%',height:'auto'}}/><figcaption>Curva decorativa; sin datos históricos.</figcaption></figure><PublicSnapshotDetails snapshot={snapshot}/>{data.links.length>0&&<CaptureCompare asset={data.asset} {...publicCaptureSlots(data.links)}/>} {data.links.map(([title,url])=><CapturePreview key={title} link={url} title={title} asset={data.asset}/>)}<p>Disponible hasta {new Date(expiresAt).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})} · Ecuador. Cualquier persona con el enlace puede verlo y guardar copias. Revocarlo no elimina copias ya guardadas.</p></main>;
}
