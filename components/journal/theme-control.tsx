"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";
import {Button} from "./ui";
export function ThemeControl(){
  const [light,setLight]=useState(false);
  useEffect(()=>{
    const timer=setTimeout(()=>{
      let value=false;
      try{value=localStorage.getItem("trading-journal-theme")==="light";}catch{}
      setLight(value);
      document.documentElement.dataset.theme=value?"light":"dark";
    },0);
    return ()=>clearTimeout(timer);
  },[]);
  return <Button className="icon-button" tone="quiet" aria-label={light?"Usar tema oscuro":"Usar tema claro"} onClick={()=>{
    const next=!light;setLight(next);
    document.documentElement.dataset.theme=next?"light":"dark";
    try{localStorage.setItem("trading-journal-theme",next?"light":"dark");}catch{}
  }}>{light?<Moon size={19}/>:<Sun size={19}/>}</Button>;
}
