import {z} from './validation.ts';
export const symbolSchema=z.string().trim().toUpperCase().min(1).max(24).regex(/^[A-Z0-9][A-Z0-9 ._:/!#-]*$/,'Escribe un símbolo válido.');
export const assetNameKey=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const assetDraft=z.object({name:z.string().trim().min(1).max(60),aliases:z.array(symbolSchema).max(20),favorite:z.boolean().default(false)}).strict().superRefine((v,c)=>{if(new Set(v.aliases).size!==v.aliases.length)c.addIssue({code:'custom',message:'No repitas símbolos dentro del mismo activo.'});});
export type CatalogAsset=z.infer<typeof assetDraft>&{id:string;version:number;createdAt:number;updatedAt:number;lastUsedAt:number|null};
const associate=z.object({action:z.literal('associate'),id:z.uuid(),version:z.number().int().positive(),revision:z.number().int().nonnegative(),confirm:z.literal(true),trades:z.array(z.object({id:z.uuid(),version:z.number().int().positive()}).strict()).min(1).max(20)}).strict();
export const assetAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),id:z.uuid(),version:z.number().int().positive().nullable(),asset:assetDraft}).strict(),
 z.object({action:z.literal('delete'),id:z.uuid(),version:z.number().int().positive()}).strict(),
 associate,
 z.object({action:z.literal('restore'),id:z.uuid(),asset:assetDraft}).strict(),
]);
export const marketSnapshot=z.object({id:z.uuid(),name:z.string().trim().min(1).max(60)}).strict();
export const assetKey=(t:{asset:string;market?:{id:string}|null})=>t.market?'market:'+t.market.id:t.asset;
export const assetLabel=(t:{asset:string;market?:{name:string}|null})=>t.market?.name??t.asset;
export function hydrateMarket<T extends {market?:{id:string;name:string}|null}>(t:T,names:Map<string,string>):T{return t.market&&names.has(t.market.id)?{...t,market:{...t.market,name:names.get(t.market.id)!}}:t;}
export const assetBackupSchema=z.object({app:z.literal('tradeify-assets'),format:z.literal(1),assets:z.array(z.object({id:z.uuid(),asset:assetDraft}).strict()).max(10000)}).superRefine((file,ctx)=>{
 const ids=new Set<string>(),names=new Set<string>(),aliases=new Set<string>();
 for(const row of file.assets){const key=assetNameKey(row.asset.name);if(ids.has(row.id)||names.has(key)||row.asset.aliases.some(a=>aliases.has(a)))ctx.addIssue({code:'custom',message:'El respaldo repite identificadores, nombres o símbolos.'});ids.add(row.id);names.add(key);for(const a of row.asset.aliases)aliases.add(a);}
});
export type AssetAction=z.infer<typeof assetAction>;
// Suggestions only. Never create records, merge history or assign a market.
export const suggestedMarketSymbols=(symbols:string[])=>symbols.some(s=>['NAS100','US100','USTEC','NQ','MNQ'].includes(s))?['NAS100','US100','USTEC','NQ','MNQ']:[];
