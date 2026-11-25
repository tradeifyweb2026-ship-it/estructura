import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {JournalError} from '../db/repository';
import {requireUserId} from './server-http';
import {accessAllowed,isAdmin,registerUser,type AccessUser} from '../worker/access';

/**
 * New FK-backed private domains require a users row. Cloudflare Google sign-in
 * creates it already; the Sites identity adapter may predate that registration.
 * Apply the existing access policy, never a caller-provided role or user ID.
 */
export async function requireDomainUser(request?:Request):Promise<{userId:string;owner:boolean}>{
  const userId=await requireUserId(request);
  if(!env.DB)throw new JournalError('Base de datos no disponible.',503);
  const identity=await getChatGPTUser();
  if(!identity||identity.userId!==userId)throw new JournalError('Inicia sesión para continuar.',401);
  const email=identity.email.trim().toLowerCase(),owner=isAdmin(email,env.TRADEIFY_OWNER_EMAIL);
  const user=await env.DB.prepare('SELECT * FROM users WHERE user_id=?').bind(userId).first<AccessUser>()
    ??await registerUser(env.DB,userId,email,owner);
  if(!user||(!owner&&!accessAllowed(user)))throw new JournalError('Tu cuenta no tiene acceso activo.',403);
  return {userId,owner};
}
