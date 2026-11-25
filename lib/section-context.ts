import type {Journal} from './journal';
export function sectionMetadata(journal:Journal){const versions=(rows:{id:string;version:number}[])=>rows.map(({id,version})=>({id,version})).sort((a,b)=>a.id.localeCompare(b.id));return {accounts:versions(journal.accounts),setups:versions(journal.setups),planVersion:journal.planVersion};}
export type SectionMetadata=ReturnType<typeof sectionMetadata>;
export function metadataMatches(journal:Journal,metadata:SectionMetadata){return JSON.stringify(sectionMetadata(journal))===JSON.stringify(metadata);}
