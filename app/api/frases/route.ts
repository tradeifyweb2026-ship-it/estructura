import {env} from 'cloudflare:workers';
import {quoteAction,quoteLibrary,mutateQuote} from '../../../db/quote-library';
import {JournalError} from '../../../db/repository';
import {requireUserId,reply,failure} from '../../../lib/server-http';
import {readJson} from '../../../lib/request-body';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await requireUserId();if(!env.DB)throw new JournalError('Base de datos no disponible.',503);return reply(await quoteLibrary(env.DB,user,new URL(request.url).searchParams));}catch(error){return failure(error);}}
export async function POST(request:Request){try{const user=await requireUserId(request);if(!env.DB)throw new JournalError('Base de datos no disponible.',503);const raw=await readJson(request,16000);const parsed=quoteAction.safeParse(raw);if(!parsed.success)throw new JournalError('Revisa las preferencias y categorías.',422);return reply(await mutateQuote(env.DB,user,parsed.data));}catch(error){return failure(error);}}
