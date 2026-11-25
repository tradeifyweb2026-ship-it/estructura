"use client";
import {useState} from "react";
import {Field,Button} from "./ui";
export function EmailForm(){
  const [email,setEmail]=useState(""), [code,setCode]=useState(""), [sent,setSent]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  return <form onSubmit={async event=>{
    event.preventDefault(); if(busy)return; setBusy(true);setError("");
    try {
      const response=await fetch(sent?"/correo/verificar":"/correo/enviar",{method:"POST",headers:{"Content-Type":"application/json","X-Bitacora-Request":"1"},body:JSON.stringify({email,code})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error ?? "Vuelve a intentarlo.");
      if(sent)window.location.reload(); else setSent(true);
    }catch(reason){setError(reason instanceof Error && !(reason instanceof TypeError)?reason.message:"No se pudo conectar. Inténtalo de nuevo.");}finally{setBusy(false);}
  }}>
    <p>Usa siempre el mismo método. Google y correo abren bitácoras independientes.</p>
    <Field label="Correo electrónico"><input type="email" autoComplete="email" required value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)}/></Field>
    {sent && <Field label="Código de 6 dígitos"><input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/></Field>}
    <Button type="submit" disabled={busy}>{sent?"Entrar con el código":"Recibir código por correo"}</Button>
    {sent && <Button type="button" disabled={busy} onClick={()=>{setSent(false);setCode("");setError("");}}>Solicitar otro código</Button>}
    {error && <p role="alert">{error}</p>}
  </form>
}
