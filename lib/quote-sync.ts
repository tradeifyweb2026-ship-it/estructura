// Keep draining after refresh: a user can enqueue another action while that
// request is in flight. Errors propagate so the durable queue can retry later.
export async function drainQuoteSync({active,pending,send,refresh}:{active:()=>boolean;pending:()=>boolean;send:()=>Promise<void>;refresh:()=>Promise<void>}){
  while(active()){
    while(active()&&pending())await send();
    if(!active())return;
    await refresh();
    if(!active()||!pending())return;
  }
}
