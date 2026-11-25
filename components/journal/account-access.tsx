"use client";
import {useState} from "react";
import {clearOwnerDrafts,clearOwnerQuotes,clearOwnerScripts} from "@/lib/editor-draft";
import {Button,Field,Modal,ModalClose,Panel} from "./ui";
export function AccountAccess({draftOwner}:{draftOwner?:string}={}){
  const [action,setAction]=useState<"sessions"|"delete"|null>(null);
  const [confirmation,setConfirmation]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  function close(){setAction(null);setConfirmation("");setError("");}
  async function submit(){
    if(!action||busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/mi-cuenta",{
        method:"POST",headers:{"Content-Type":"application/json","X-Bitacora-Request":"1"},
        body:JSON.stringify({action,confirm:confirmation})
      });
      if(!response.ok)throw new Error("No se pudo completar la solicitud. Vuelve a intentarlo.");
      clearOwnerDrafts(draftOwner);
      if(action==="delete"){clearOwnerQuotes(draftOwner);clearOwnerScripts(draftOwner);}
      window.location.reload();
    }catch(reason){setError(reason instanceof Error?reason.message:"Verifica tu conexión y vuelve a intentarlo.");setBusy(false);}
  }
  return <><Panel title="Acceso y privacidad" description="Administra tus sesiones y tus datos.">
    <div className="admin-form group-buttons"><Button onClick={()=>setAction("sessions")}>Cerrar todas mis sesiones</Button><Button tone="quiet" onClick={()=>setAction("delete")}>Eliminar mi cuenta</Button></div>
  </Panel>{action&&<Modal title={action==="delete"?"Eliminar mi cuenta":"Cerrar todas mis sesiones"} onClose={close} busy={busy}
    footer={<><ModalClose disabled={busy}>Cancelar</ModalClose><Button tone={action==="delete"?"danger":"primary"} disabled={busy||(action==="delete"&&confirmation!=="ELIMINAR")} onClick={submit}>{busy?"Procesando…":action==="delete"?"Eliminar definitivamente":"Cerrar las sesiones"}</Button></>}>
    {action==="delete"?<><p>Se eliminarán tus operaciones, capturas anteriores y configuración. Esta acción es definitiva.</p><Field label="Escribe ELIMINAR para confirmar"><input autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></Field></>:<p>Se cerrará también esta sesión. Tendrás que volver a entrar con Google.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </Modal>}</>;
}
