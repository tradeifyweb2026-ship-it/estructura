import {env} from 'cloudflare:workers';
import {maintenanceState} from '../../../worker/admin-resources';
import {reply,failure} from '../../../lib/server-http';
import {JournalError} from '../../../db/repository';
export const dynamic='force-dynamic';
export async function GET(){try{if(!env.DB)throw new JournalError('Estado del servicio no disponible.',503);return reply(await maintenanceState(env.DB));}catch(error){return failure(error);}}
