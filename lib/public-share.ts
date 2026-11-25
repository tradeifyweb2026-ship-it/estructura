import {z} from './validation.ts';
import {idSchema,isTradingViewCaptureLink} from './journal.ts';
import type {TerminalCardData} from './terminal-card.ts';
export const PUBLIC_SHARE_TTL=30*86400000;
export const publicVisibility=z.object({percent:z.boolean().default(false),money:z.boolean().default(false),prices:z.boolean().default(false),strategy:z.boolean().default(false),notes:z.boolean().default(false),captures:z.boolean().default(false)}).strict();
export type PublicVisibility=z.infer<typeof publicVisibility>;
const text=z.string().max(1000),pair=z.tuple([z.string().max(80),text]);
/** The persisted/public contract contains no account, owner or trade identifier. */
export const publicSnapshotSchema=z.object({schema:z.literal(1),asset:z.string().max(120),side:z.enum(['LONG','SHORT']),date:z.string().max(100),status:z.string().max(100),tone:z.enum(['positive','negative','flat','open','missing']),r:z.string().max(100),percent:z.string().max(100).optional(),percentReason:z.string().max(150).optional(),money:z.string().max(100).optional(),prices:z.array(pair).max(3).optional(),setup:z.string().max(120).optional(),note:text.optional(),links:z.array(z.tuple([z.string().max(80),z.string().refine(isTradingViewCaptureLink)])).max(2).optional()}).strict();
export type PublicSnapshot=z.infer<typeof publicSnapshotSchema>;
export const publicShareAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),tradeId:idSchema,tradeVersion:z.number().int().positive(),accountVersion:z.number().int().positive().nullable(),visibility:publicVisibility,confirmed:z.literal(true),expectedSnapshot:publicSnapshotSchema.optional()}).strict(),
 z.object({action:z.literal('revoke'),id:idSchema}).strict(),
]);
export type PublicShareAction=z.infer<typeof publicShareAction>;
export function publicProjection(card:TerminalCardData,visibility:PublicVisibility):PublicSnapshot{
 return publicSnapshotSchema.parse({schema:1,asset:card.asset,side:card.side,date:card.date,status:card.status,tone:card.tone,r:card.r,
 ...(visibility.percent?{percent:card.percent,percentReason:card.percentReason}:{}),...(visibility.money?{money:card.money??'No disponible'}:{}),...(visibility.prices?{prices:card.prices}:{}),...(visibility.strategy?{setup:card.setup}:{}),...(visibility.notes?{note:card.note}:{}),...(visibility.captures?{links:card.links}:{}),
 });
}
export function snapshotCard(snapshot:PublicSnapshot):TerminalCardData{
 const s=publicSnapshotSchema.parse(snapshot);return {...s,percent:s.percent??'No disponible',percentReason:s.percentReason??'Porcentaje no autorizado en este enlace',money:s.money??null,prices:s.prices??[],setup:s.setup??'',account:'',note:s.note??'',links:s.links??[],partialCount:0,demo:false};
}
export const publicTokenPattern=/^[A-Za-z0-9_-]{43}$/;
export async function publicTokenHash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');}
export function publicOrigin(value:string|undefined){
 try{const url=new URL(value??'');if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();return url.origin;}catch{throw new Error('Configura una dirección HTTPS válida para compartir.');}
}
