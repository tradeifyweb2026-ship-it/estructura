import {z} from './validation.ts';
import {SCRIPT_LIMITS,type Sealed,type VaultEnvelope} from './script-crypto.ts';
export const encryptedBytes=(value:string)=>Math.floor(value.length*3/4);
const canonicalBase64=(s:string)=>s.length%4!==1&&(s.length%4!==2||/[AQgw]$/.test(s))&&(s.length%4!==3||/[AEIMQUYcgkosw048]$/.test(s));
const encoded=(max:number)=>z.string().min(1).max(Math.ceil(max/3)*4).regex(/^[A-Za-z0-9_-]+$/).refine(canonicalBase64,'Codificación cifrada no válida.').refine(v=>encryptedBytes(v)<=max,'El contenido cifrado supera el límite técnico.');
const iv=encoded(12).refine(v=>encryptedBytes(v)===12);
export const sealedSchema=z.object({iv,data:encoded(SCRIPT_LIMITS.ownerCodeBytes+16).refine(v=>encryptedBytes(v)>=16)}).strict();
const keyBox=z.object({iv,data:encoded(48).refine(v=>encryptedBytes(v)===48)}).strict();
export const vaultEnvelopeSchema=z.object({format:z.literal(1),id:z.uuid(),salt:encoded(16).refine(v=>encryptedBytes(v)===16),iterations:z.literal(600000),password:keyBox,recovery:keyBox}).strict();
const version=z.number().int().min(1).max(2147483646),stamp=z.number().int().min(0).max(4133980799999);
export const encryptedPayload=z.object({metadata:sealedSchema,code:sealedSchema}).strict().superRefine((v,c)=>{if(encryptedBytes(v.metadata.data)>SCRIPT_LIMITS.metadataBytes+16)c.addIssue({code:'custom',message:'Los metadatos cifrados superan su límite técnico.'});if(v.metadata.iv===v.code.iv)c.addIssue({code:'custom',message:'Usa un IV diferente para cada contenido cifrado.'});});
export const scriptAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('vault'),envelope:vaultEnvelopeSchema}).strict(),
 z.object({action:z.literal('recover'),version,envelope:vaultEnvelopeSchema}).strict(),
 z.object({action:z.literal('save'),id:z.uuid(),version:version.nullable(),vaultId:z.uuid(),payload:encryptedPayload}).strict(),
 z.object({action:z.literal('restore'),id:z.uuid(),version,vaultId:z.uuid(),payload:encryptedPayload,createdAt:stamp,updatedAt:stamp}).strict().refine(v=>v.updatedAt>=v.createdAt),
 z.object({action:z.literal('delete'),id:z.uuid(),version,vaultId:z.uuid()}).strict(),
 z.object({action:z.literal('reset'),version,vaultId:z.uuid(),confirm:z.literal('BORRAR BIBLIOTECA')}).strict(),
]);
export type ScriptAction=z.infer<typeof scriptAction>;
export type ScriptRecord={id:string;version:number;vaultId:string;metadata:Sealed;code?:Sealed;createdAt:number;updatedAt:number;bytes:number};
export type VaultState={vault:null|{id:string;version:number;revision:number;envelope:VaultEnvelope;usedBytes:number;quotaBytes:number};owner:boolean;limits:typeof SCRIPT_LIMITS};
export const scriptBackupSchema=z.object({app:z.literal('tradeify-private-scripts'),format:z.literal(1),envelope:vaultEnvelopeSchema,scripts:z.array(z.object({id:z.uuid(),version,vaultId:z.uuid(),payload:encryptedPayload,createdAt:stamp,updatedAt:stamp}).strict()).max(50000)}).superRefine((file,ctx)=>{if(new Set(file.scripts.map(s=>s.id)).size!==file.scripts.length||file.scripts.some(s=>s.vaultId!==file.envelope.id||s.updatedAt<s.createdAt))ctx.addIssue({code:'custom',message:'El respaldo repite scripts o mezcla bibliotecas.'});});
