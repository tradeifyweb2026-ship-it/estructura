"use client";
import {createContext,useContext,useEffect} from 'react';
import type {Journal} from '@/lib/journal';
import type {JournalMetadata} from '@/lib/journal-query';
import {metadataMatches,type SectionMetadata} from '@/lib/section-context';
import {QueryError} from '@/lib/journal-read';
import {useServerQuery} from './use-server-query';
export const SectionMetadataRefresh=createContext<null|(()=>Promise<void>)>(null);
export type SectionEnvelope<T>={revision:number;model:T;metadata:SectionMetadata};
export function useSectionContext<T>(result:{data:SectionEnvelope<T>|null;loading:boolean;error:QueryError|null;key:string},journal:Journal,refresh:number){
 const refreshParent=useContext(SectionMetadataRefresh);
 const stale=!!result.data&&!metadataMatches(journal,result.data.metadata);
 useEffect(()=>{if(stale&&refreshParent)void refreshParent();},[stale,refreshParent]);
 const metadata=useServerQuery<JournalMetadata>(stale&&!refreshParent?new URLSearchParams({mode:'metadata'}):null,refresh);
 if(stale&&refreshParent)return {...result,data:null,loading:true,error:null,journal};
 if(!stale)return {...result,journal};
 if(metadata.error)return {...result,data:null,loading:false,error:metadata.error,journal};
 if(!metadata.data)return {...result,data:null,loading:true,error:null,journal};
 if(!metadataMatches(metadata.data,result.data!.metadata))return {...result,data:null,loading:false,error:new QueryError('La configuración cambió durante la lectura. Actualiza los indicadores para obtener una revisión coherente.',409),journal};
 return {...result,journal:metadata.data};
}
