import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { JournalError, loadJournal, loadTradePage, mutateJournal } from "../../../db/repository";
import { actionSchema } from "../../../lib/journal";
import { parseTradeQuery } from "../../../lib/journal-query";
import { queryTradePage,queryAnalytics,queryMetadata,queryDailyRisk,consistentBatch,marketLabelSQL } from "../../../db/journal-query";
import { failure, reply, requireUserId } from "../../../lib/server-http";
import {cleanupStorage} from "../../../worker/storage-cleanup";
import {querySection} from '../../../db/section-query';

import {readJson} from "../../../lib/request-body";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const params = new URL(request.url).searchParams;
    const mode=params.get("mode");
    if(mode){
      if(!env.DB)throw new JournalError("Base de datos no disponible.",503);
      if(mode==="metadata")return reply(await queryMetadata(env.DB,userId,params.get('reviews')==='all'));
      if(mode==="detail"){
        const id=params.get("id");if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw new JournalError("Operación no válida.",422);
        const {revision,results}=await consistentBatch(env.DB,userId,undefined,[env.DB.prepare("SELECT t.*,"+marketLabelSQL("t")+" market_label FROM trades t WHERE user_id=? AND id=?").bind(userId,id),env.DB.prepare("SELECT trade_id tradeId,slot,revision FROM attachments WHERE user_id=? AND trade_id=?").bind(userId,id)]);
        const row=results[0].results[0] as {id:string;version:number;data:string;opened_at:number;account_id:string|null;setup_id:string|null;market_label:string}|undefined;
        if(!row)throw new JournalError("La operación ya no está disponible.",404);
        const data=JSON.parse(row.data);if(data.market)data.market.name=row.market_label;
        return reply({revision,trade:{...data,id:row.id,version:row.version,openedAt:row.opened_at,accountId:row.account_id,setupId:row.setup_id},captures:results[1].results});
      }
      let q;try{q=parseTradeQuery(params);}catch{throw new JournalError("Revisa los filtros, fechas y cuenta de la consulta.",422);}
      const revision=params.has("revision")?Number(params.get("revision")):undefined;
      if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0))throw new JournalError("Revisión no válida.",422);
      if(mode==="list")return reply(await queryTradePage(env.DB,userId,q,{size:params.has("size")?Number(params.get("size")):20,cursor:params.get("cursor")??undefined,revision,count:params.get("count")==="1"}));
      if(mode==="daily-risk")return reply(await queryDailyRisk(env.DB,userId,q,params.get("today")??""));
      if(mode==="analytics")return reply(await queryAnalytics(env.DB,userId,q,revision,params.get("details")==="1",params.get("granularity")==="trade"));
      if(mode==='section'){
        const section=params.get('section');if(!['psicologia','revision','cuentas','estrategias','riesgo'].includes(section??''))throw new JournalError('Sección no válida.',422);
        return reply(await querySection(env.DB,userId,section as import('../../../lib/section-models').SectionName,q,{start:params.get('start')??undefined,end:params.get('end')??undefined,previous:params.get('previous')??undefined,reviewKey:params.get('reviewKey')??undefined,historyBefore:params.get('historyBefore')??undefined}));
      }
      throw new JournalError("Consulta no reconocida.",422);
    }
    if(params.has("page")){
      const index=Number(params.get("page"));
      if(!Number.isSafeInteger(index)||index<0)throw new JournalError("Página no válida.",422);
      const beforeId=params.get("beforeId");
      const beforeAt=Number(params.get("beforeAt"));
      if(beforeId && (!/^[a-f0-9-]{36}$/i.test(beforeId)||!Number.isSafeInteger(beforeAt)))throw new JournalError("Cursor no válido.",422);
      const page={limit:201,offset:beforeId?0:index*200,before:beforeId?{at:beforeAt,id:beforeId}:undefined};
      if(params.get("only")==="trades"){
        const result=await loadTradePage(getDb(),userId,page);
        return reply({trades:result.trades.slice(0,200),captures:result.captures,hasMore:result.trades.length>200});
      }
      const journal=await loadJournal(getDb(),userId,page);
      return reply({...journal,trades:journal.trades.slice(0,200),hasMore:journal.trades.length>200});
    }
    return reply(await loadJournal(getDb(), userId));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const raw = await readJson(request, 3_000_000, 400);
    const parsed = actionSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new JournalError(issue?.code === "custom" ? issue.message : "Revisa los campos y sus valores.", 422);
    }
    const result = await mutateJournal(getDb(), userId, parsed.data, env.TRADEIFY_MAX_TRADES);
    if ("removedFiles" in result) {
      if (result.removedFiles?.length && env.BUCKET) {
        await cleanupStorage(env.DB!,env.BUCKET,userId).catch(() => console.error("Journal capture cleanup failed"));
      }
      return reply({ id: result.id });
    }
    return reply(result);
  } catch (error) {
    return failure(error);
  }
}
