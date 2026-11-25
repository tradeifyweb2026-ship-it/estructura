'use client';
import {useState} from 'react';
import {CaptureLinkField} from './capture-preview';
import {CaptureCompare} from './capture-compare';
export function CapturePairFields({before='',after='',active,onEdited}:{before?:string;after?:string;active:boolean;onEdited:()=>void}){
 const [links,setLinks]=useState({before,after});
 return <><div className="form-grid"><CaptureLinkField name="captureBefore" title="Entrada" defaultValue={before} active={active} onEdited={onEdited} onPreview={value=>setLinks(v=>({...v,before:value}))}/><CaptureLinkField name="captureAfter" title="Salida" defaultValue={after} active={active} onEdited={onEdited} onPreview={value=>setLinks(v=>({...v,after:value}))}/></div>{active&&(links.before||links.after)&&<CaptureCompare before={{link:links.before}} after={{link:links.after}}/>}</>;
}
