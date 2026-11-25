import {env} from 'cloudflare:workers';
import {requireDomainUser} from '../../../lib/domain-user';
import {reply,failure} from '../../../lib/server-http';
import {readJson} from '../../../lib/request-body';
import {idSchema} from '../../../lib/journal';
import {publicShareAction} from '../../../lib/public-share';
import {JournalError} from '../../../db/repository';
import {createPublicShare,listPublicShares,revokePublicShare,cleanupPublicShares} from '../../../db/public-shares';
import {maintenanceState} from '../../../worker/admin-resources';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await requireDomainUser();if(!env.DB)throw new JournalError('Base de datos no disponible.',503);
 const trade=idSchema.safeParse(new URL(request.url).searchParams.get('trade'));if(!trade.success)throw new JournalError('Selecciona una operación válida.',422);
 return reply(await listPublicShares(env.DB,user.userId,trade.data));
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await requireDomainUser(request);if(!env.DB)throw new JournalError('Base de datos no disponible.',503);
 const input=publicShareAction.safeParse(await readJson(request,8192));if(!input.success)throw new JournalError('Revisa los campos y confirma qué información quieres publicar.',422);
 if(input.data.action==='revoke')return reply(await revokePublicShare(env.DB,user.userId,input.data.id));
 if((await maintenanceState(env.DB)).active)throw new JournalError('No se crean enlaces durante el mantenimiento. Puedes revocar los existentes.',503);
 await cleanupPublicShares(env.DB);
 return reply(await createPublicShare(env.DB,user.userId,input.data,env.TRADEIFY_ORIGIN??''));
}catch(e){return failure(e);}}
