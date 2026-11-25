import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {readPublicShare} from '../../../db/public-shares';
import {PublicTradeView} from '../../../components/journal/public-trade-view';
export const dynamic='force-dynamic';
export default async function PublicTradePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!env.DB)notFound();const share=await readPublicShare(env.DB,token);if(!share)notFound();
 return <PublicTradeView snapshot={share.snapshot} expiresAt={share.expiresAt}/>;
}
