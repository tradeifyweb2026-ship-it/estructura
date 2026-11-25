'use client';
import {useEffect,useState} from 'react';
import {Search,Command,Compass} from 'lucide-react';
import {Button,Empty,Field,Modal} from './ui';
export function WorkspaceNavigation({items,onNavigate}:{items:{id:string;label:string;group?:string}[];onNavigate:(id:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const matches=items.filter(i=>(i.label+' '+i.group).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
 return <><Button className="workspace-search" tone="quiet" aria-label="Buscar secciones" onClick={()=>setOpen(true)}><Search size={17}/><span>Buscar en tu espacio</span><kbd><Command size={11}/> K</kbd></Button>{open&&<Modal title="Ir a una sección" subtitle="Navega sin perder tus filtros actuales." onClose={()=>setOpen(false)}><Field label="Buscar sección"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cuentas, estrategias, ayuda…"/></Field><div className="workspace-search-results">{matches.map(i=><Button key={i.id} onClick={()=>{onNavigate(i.id);setOpen(false);setQuery('');}}><Compass size={17}/><span>{i.label}<small>{i.group}</small></span></Button>)}{!matches.length&&<Empty title="No encontramos esa sección" description="Prueba con otro nombre."/>}</div></Modal>}</>;
}
export function WorkspaceSkeleton(){return <div className="workspace-skeleton" role="status" aria-label="Cargando datos"><span className="sr-only">Cargando datos…</span><div className="skeleton-metrics">{[0,1,2,3].map(i=><div className="skeleton" key={i}/>)}</div><div className="skeleton skeleton-chart"/></div>;}
