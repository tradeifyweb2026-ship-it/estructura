import {env} from 'cloudflare:workers';
import {assetAction} from '../../../lib/asset-catalog';
import {listAssets,mutateAsset,previewAssociation} from '../../../db/asset-catalog';
import {JournalError} from '../../../db/repository';
import {reply,failure} from '../../../lib/server-http';
import {readJson} from '../../../lib/request-body';
import {requireDomainUser} from '../../../lib/domain-user';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {userId:user}=await requireDomainUser();if(!env.DB)throw new JournalError('Base de datos no disponible.',503);const params=new URL(request.url).searchParams;return reply(await(params.get('mode')==='preview'?previewAssociation(env.DB,user,params):listAssets(env.DB,user,params)));}catch(e){return failure(e);}}
export async function POST(request:Request){try{const {userId:user}=await requireDomainUser(request);if(!env.DB)throw new JournalError('Base de datos no disponible.',503);const parsed=assetAction.safeParse(await readJson(request,16000));if(!parsed.success)throw new JournalError(parsed.error.issues[0]?.message??'Revisa el activo y sus símbolos.',422);return reply(await mutateAsset(env.DB,user,parsed.data));}catch(e){return failure(e);}}
