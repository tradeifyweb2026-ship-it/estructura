'use client';
import {useEffect,useState} from 'react';
import {captureSource,type CaptureSide} from '@/lib/capture-comparison';
import {isTradingViewCaptureLink} from '@/lib/journal';
import {Button,Field} from './ui';
import {CapturePreview} from './capture-preview';
export function CaptureBadge({links}:{links?:{before?:string;after?:string}}){const n=Object.values(links??{}).filter(v=>!!v&&isTradingViewCaptureLink(v)).length;return <small className="capture-badge">Capturas {n}/2</small>;}
export function CaptureCompare({before,after,asset='operación',demoImages,fallbackPreviews=false}:{before?:CaptureSide;after?:CaptureSide;asset?:string;demoImages?:{before:string;after:string};fallbackPreviews?:boolean}){
 const [mode,setMode]=useState<'slider'|'side'|'toggle'>('slider'),[position,setPosition]=useState(50),[selected,setSelected]=useState<'before'|'after'>('before'),[failed,setFailed]=useState<string[]>([]),[loaded,setLoaded]=useState<string[]>([]);
 const demo=(slot:'before'|'after')=>demoImages?.[slot]?.startsWith('/demo-assets/')?demoImages[slot]:null;
 const a=demo('before')??captureSource(before,'before'),b=demo('after')??captureSource(after,'after');
 const ready=!!a&&!!b&&!failed.includes(a)&&!failed.includes(b);
 useEffect(()=>{if(!ready||(!a||loaded.includes(a))&&(!b||loaded.includes(b)))return;const timer=setTimeout(()=>setFailed(v=>[...v,...(a&&!loaded.includes(a)?[a]:[]),...(b&&!loaded.includes(b)?[b]:[])]),15000);return()=>clearTimeout(timer);},[a,b,ready,loaded]);
 return <section className="capture-compare" aria-label="Comparador de capturas">
  <header className="split"><div><span className="eyebrow">Auditoría visual</span><h3>Antes y después</h3></div><div className="segmented" role="group" aria-label="Modo del comparador">{([['slider','Deslizador'],['side','Lado a lado'],['toggle','Alternar']]as const).map(([key,label])=><Button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</Button>)}</div></header>
  {demoImages&&<small>Imágenes ilustrativas locales · no son cotizaciones ni capturas de un usuario.</small>}
  {ready?<>{(!loaded.includes(a)||!loaded.includes(b))&&<p role="status">Cargando imágenes…</p>}<div className={'capture-comparison-stage capture-mode-'+mode}>
   {/* These sources are allowlisted images or authenticated same-origin captures. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={a} alt={'Antes de '+asset} referrerPolicy="no-referrer" onLoad={()=>setLoaded(v=>v.includes(a)?v:[...v,a])} hidden={mode==='toggle'&&selected!=='before'} onError={()=>setFailed(v=>[...v,a])}/>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={b} alt={'Después de '+asset} referrerPolicy="no-referrer" onLoad={()=>setLoaded(v=>v.includes(b)?v:[...v,b])} hidden={mode==='toggle'&&selected!=='after'} style={mode==='slider'?{clipPath:`inset(0 0 0 ${position}%)`}:undefined} onError={()=>setFailed(v=>[...v,b])}/>
   <span className="capture-label capture-label-before">ANTES</span><span className="capture-label capture-label-after">DESPUÉS</span>
   {mode==='slider'&&<span className="capture-comparison-divider" aria-hidden="true" style={{left:position+'%'}}/>}
  </div>{mode==='slider'&&<Field label="Posición del comparador"><input type="range" min="0" max="100" value={position} aria-valuetext={`${position}% antes, ${100-position}% después`} onChange={e=>setPosition(Number(e.target.value))}/></Field>}{mode==='toggle'&&<div className="group-buttons"><Button aria-pressed={selected==='before'} onClick={()=>setSelected('before')}>Mostrar antes</Button><Button aria-pressed={selected==='after'} onClick={()=>setSelected('after')}>Mostrar después</Button></div>}</>:<div className="capture-comparison-fallback"><p>No hay dos imágenes disponibles para superponer. Los enlaces a páginas no se convierten en imágenes.</p>{fallbackPreviews&&<div className="capture-grid"><div><h4>Antes</h4><CapturePreview link={before?.link} privateImage={captureSource(before,'before')??undefined} title="Entrada" asset={asset}/></div><div><h4>Después</h4><CapturePreview link={after?.link} privateImage={captureSource(after,'after')??undefined} title="Salida" asset={asset}/></div></div>}</div>}
 </section>;
}
