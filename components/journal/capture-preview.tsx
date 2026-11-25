"use client";

import {useEffect,useState} from "react";
import {isDirectCaptureImage,isTradingViewCaptureLink} from "@/lib/journal";
import {Button,Field} from "./ui";

function CaptureImage({src,alt}:{src:string;alt:string}){
  const [status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
  useEffect(()=>{const timer=setTimeout(()=>setStatus(s=>s==="loading"?"failed":s),15000);return()=>clearTimeout(timer);},[]);
  return <div className={`capture-preview-media capture-preview-${status}`}>
    {status!=="failed"&&<img hidden={status!=="ready"} src={src} alt={alt} referrerPolicy="no-referrer" onLoad={event=>setStatus(event.currentTarget.naturalWidth>0?"ready":"failed")} onError={()=>setStatus("failed")}/>}
    {status!=="ready"&&<small role="status">{status==="loading"?"Comprobando vista previa…":"Vista previa no disponible"}</small>}
  </div>;
}

/** A page URL is a link, never an inferred thumbnail. No scraping or proxy. */
export function CapturePreview({link,privateImage,title,asset="operación"}:{link?:string;privateImage?:string;title:string;asset?:string}){
  const valid=!!link&&isTradingViewCaptureLink(link);
  const src=valid&&isDirectCaptureImage(link!)?link:!link?privateImage:undefined;
  return <div className="capture-preview">
    {src?<CaptureImage key={src} src={src} alt={`Gráfico de ${title.toLowerCase()} para ${asset}`}/>:<small>{link?valid?"Vista previa no disponible":"Enlace no válido. Usa una URL HTTPS de TradingView.":"Sin captura ni enlace."}</small>}
    {valid&&<a className="button" href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Abrir ${title.toLowerCase()} en TradingView`}>Abrir en TradingView</a>}
    {!link&&privateImage&&<a className="button button-quiet" href={privateImage} target="_blank" rel="noopener noreferrer">Abrir captura guardada</a>}
  </div>;
}

export function CaptureLinkField({name,title,defaultValue="",active,onEdited,onPreview}:{name:string;title:string;defaultValue?:string;active:boolean;onEdited:()=>void;onPreview?:(value:string)=>void}){
  const [value,setValue]=useState(defaultValue),[preview,setPreview]=useState(defaultValue);
  return <div className="capture-link-field">
    <Field label={`Captura de ${title.toLowerCase()} (enlace TradingView)`} hint="Sal del campo para comprobar la vista previa. El enlace se guarda con la operación.">
      <input type="url" name={name} maxLength={300} value={value} onChange={event=>{setValue(event.target.value);setPreview("");}} onBlur={()=>{setPreview(value.trim());onPreview?.(value.trim());}}/>
    </Field>
    {active&&(preview||!value)&&<CapturePreview link={preview||undefined} title={title}/>}
    {value&&<Button tone="quiet" data-edit-action onClick={()=>{setValue("");setPreview("");onPreview?.("");onEdited();}}>Quitar enlace de {title.toLowerCase()}</Button>}
  </div>;
}
