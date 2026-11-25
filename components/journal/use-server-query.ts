"use client";
import { useEffect,useState } from "react";
import { readJournal,QueryError } from "@/lib/journal-read";
export function useServerQuery<T>(params:URLSearchParams|null,refresh=0){
 const url=params?.toString()??"",key=url+":"+refresh;
 const [state,setState]=useState<{key:string;data:T|null;error:QueryError|null}>({key:"",data:null,error:null});
 useEffect(()=>{
  if(!url)return;
  const controller=new AbortController();
  void readJournal<T>(new URLSearchParams(url),controller.signal).then(data=>{if(!controller.signal.aborted)setState({key,data,error:null})}).catch(reason=>{if(!controller.signal.aborted)setState({key,data:null,error:reason instanceof QueryError?reason:new QueryError("No se pudo conectar. Reintenta la consulta.",0)})});
  return()=>controller.abort();
 },[url,key]);
 return state.key===key?{...state,loading:false}:{key,data:null,error:null,loading:Boolean(url)};
}
