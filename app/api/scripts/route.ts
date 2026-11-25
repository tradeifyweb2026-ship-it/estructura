import {env} from 'cloudflare:workers';
import {requireDomainUser} from '../../../lib/domain-user';
import {reply,failure} from '../../../lib/server-http';
import {readJson} from '../../../lib/request-body';
import {scriptAction} from '../../../lib/script-protocol';
import {JournalError} from '../../../db/repository';
import {readScripts,mutateScripts} from '../../../db/private-scripts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await requireDomainUser();if(!env.DB)throw new JournalError('Base de datos no disponible.',503);return reply(await readScripts(env.DB,user.userId,user.owner,new URL(request.url).searchParams));}catch(e){return failure(e);}}
export async function POST(request:Request){try{const user=await requireDomainUser(request);if(!env.DB)throw new JournalError('Base de datos no disponible.',503);const parsed=scriptAction.safeParse(await readJson(request,user.owner?750000:200000));if(!parsed.success)throw new JournalError('Revisa el formato cifrado, la versión y los límites técnicos. No envíes código sin cifrar.',422);return reply(await mutateScripts(env.DB,user.userId,user.owner,parsed.data));}catch(e){return failure(e);}}
