import {z} from "./validation.ts";
const text=z.string().max(3000);
export const editorDraftSchema=z.object({
  version:z.number().int().nullable(),
  step:z.enum(["entry","close","review"]),
  fields:z.record(z.string(),z.array(text).max(30)),
  accountId:text,closed:z.boolean(),direction:z.enum(["long","short"]),
  entry:text,stop:text,target:text,
  checklist:z.array(z.object({text,checked:z.boolean()})).max(20),
  partials:z.array(z.object({key:z.number(),price:text,percent:text,at:text.optional(),pnl:text.optional()})).max(12),
  notes:z.array(z.object({key:z.number(),kind:z.enum(["text","heading","check"]),text,checked:z.boolean()})).max(30),
  savedAt:z.number().int()
});
export type EditorDraft=z.infer<typeof editorDraftSchema>;
export function draftKey(owner:string,trade?:string){return "tradeify-draft:"+owner+":"+(trade??"new");}
export function parseDraft(value:string|null){
  try{
    const result=editorDraftSchema.safeParse(JSON.parse(value??"null"));
    return result.success?result.data:null;
  }catch{return null;}
}

/** Remove only drafts belonging to the current identity. */
export function clearOwnerDrafts(owner?:string){
 if(!owner)return;
 try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith("tradeify-draft:"+owner+":")||key?.startsWith("tradeify-review:"+owner+":"))sessionStorage.removeItem(key)}}catch{}
}

/** Clear the deleted identity's quote history without touching another user. */
export function clearOwnerQuotes(owner?:string){
 if(!owner)return;
 try{localStorage.removeItem("tradeify-quotes:"+owner)}catch{}
 try{for(const suffix of [':queue',':snapshot'])localStorage.removeItem('tradeify-quote-library:'+owner+suffix)}catch{}
 try{sessionStorage.removeItem("tradeify-quotes:"+owner+":seen")}catch{}
}

/** Encrypted script drafts survive sign-out; erase only after account deletion. */
export function clearOwnerScripts(owner?:string){
 if(!owner)return;const prefix='tradeify-script-draft:'+encodeURIComponent(owner)+':';
 try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith(prefix))localStorage.removeItem(key);}}catch{}
}
