import { restoreBatch } from "./restore";
import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import type { getDb } from "./index";
import { accounts, attachments, plans, reviews, setups, trades, userLimits, assetCatalog } from "./schema";
import { defaultPlan, setupSchema, type Journal, type JournalAction, type TradeDraft } from "../lib/journal";

import {hydrateMarket} from "../lib/asset-catalog";
import {restoreDecision} from "../lib/restore-compare.mjs";

export type JournalDb = ReturnType<typeof getDb>;

export class JournalError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const conflict = () => new JournalError("Este registro cambió en otra pestaña o dispositivo. Actualiza y vuelve a intentarlo.", 409);
const missingLink = () => new JournalError("La cuenta o el setup elegido no está disponible.", 422);

function tradeValues(userId: string, id: string, trade: TradeDraft, importKey: string | null = null) {
  const { openedAt, accountId, setupId, ...data } = trade;
  if(data.market===null)delete data.market;
  return { userId, id, openedAt, accountId, setupId, data, importKey };
}

type JournalPage={limit:number;offset:number;before?:{at:number;id:string}};
function tradeFilter(userId:string,page?:JournalPage){
  return and(eq(trades.userId,userId),page?.before ? sql`(${trades.openedAt} < ${page.before.at} OR (${trades.openedAt} = ${page.before.at} AND ${trades.id} < ${page.before.id}))`:undefined);
}
function tradeQuery(db:JournalDb,userId:string,page?:JournalPage){
  return db.select().from(trades).where(tradeFilter(userId,page)).orderBy(desc(trades.openedAt),desc(trades.id)).limit(page?.limit??1000000).offset(page?.offset??0);
}
function tradeIdQuery(db:JournalDb,userId:string,page?:JournalPage,limit=page?.limit??1000000){
  return db.select({id:trades.id}).from(trades).where(tradeFilter(userId,page)).orderBy(desc(trades.openedAt),desc(trades.id)).limit(limit).offset(page?.offset??0);
}
export async function loadTradePage(db:JournalDb,userId:string,page:JournalPage){
  const [rows,captures]=await db.batch([
    tradeQuery(db,userId,page),
    db.select({tradeId:attachments.tradeId,slot:attachments.slot,revision:attachments.revision}).from(attachments)
      .where(and(eq(attachments.userId,userId),inArray(attachments.tradeId,tradeIdQuery(db,userId,page,Math.max(0,page.limit-1))))),
  ]);
  const trades=rows.map(({id,version,openedAt,accountId,setupId,data})=>({...data,id,version,openedAt,accountId,setupId}));
  return {trades,captures};
}
export async function loadJournal(db: JournalDb, userId: string, page?: JournalPage): Promise<Journal> {
  const [tradeRows, accountRows, setupRows, captureRows, planRows, reviewRows, markets] = await db.batch([
    tradeQuery(db,userId,page),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(setups).where(eq(setups.userId, userId)),
    db.select({tradeId:attachments.tradeId,slot:attachments.slot,revision:attachments.revision}).from(attachments)
      .where(and(eq(attachments.userId,userId),inArray(attachments.tradeId,tradeIdQuery(db,userId,page,page?Math.max(0,page.limit-1):1000000)))),
    db.select({ data: plans.data, version: plans.version }).from(plans).where(eq(plans.userId, userId)),
    db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.week)),
    db.select({id:assetCatalog.id,name:assetCatalog.name}).from(assetCatalog).where(eq(assetCatalog.userId,userId)),
  ]);
   const names=new Map(markets.map(m=>[m.id,m.name]));
   return {
    trades: tradeRows.map(({ id, version, openedAt, accountId, setupId, data }) => hydrateMarket({ ...data, id, version, openedAt, accountId, setupId },names)),
    accounts: accountRows.map(({ id, version, data }) => ({ ...data, id, version })).sort((left, right) => left.name.localeCompare(right.name, "es")),
    setups: setupRows.map(({ id, version, data }) => ({ ...data, id, version })).sort((left, right) => left.name.localeCompare(right.name, "es")),
    captures: captureRows,
    plan: planRows[0]?.data ?? defaultPlan,
    planVersion: planRows[0]?.version ?? 0,
    reviews: reviewRows.map(({ week, scope, version, data }) => ({ ...data, week, scope, version })),
  };
}

export async function mutateJournal(db: JournalDb, userId: string, action: JournalAction, configuredLimit?: string) {
  if ((action.action==="restoreBatch"&&action.batch.kind==="trades") || action.action === "importTrades" || (action.action === "saveTrade" && action.version === null)) {
    const value = Number(configuredLimit);
    const max = Number.isSafeInteger(value) && value > 0 ? value : 5000;
    await db.insert(userLimits).values({userId, trades:max}).onConflictDoUpdate({
      target:userLimits.userId, set:{trades:sql`COALESCE(${userLimits.customTrades},${max})`}, setWhere:sql`${userLimits.trades} <> COALESCE(${userLimits.customTrades},${max})`
    });
  }
  try { return await applyAction(db,userId,action); }
  catch (error) {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
      const quota = /quota_(accounts|setups|trades)/.exec(current.message)?.[1];
      if (quota) throw new JournalError("Alcanzaste el límite de " + ({accounts:"cuentas",setups:"estrategias",trades:"operaciones"}[quota]) + " de tu usuario.",422);
    }
    throw error;
  }
}

async function applyAction(db: JournalDb, userId: string, action: JournalAction) {
  switch (action.action) {
    case "restoreBatch": return restoreBatch(db,userId,action);
    case "saveTrade": {
      const { id, version } = action;
      const trade={...action.trade};
      // Never trust a client-supplied historical snapshot. Preserve the stored one.
      delete trade.setupSnapshot;
      if (trade.accountId && !await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, trade.accountId))).get()) throw missingLink();
      const setup=trade.setupId?await db.select().from(setups).where(and(eq(setups.userId,userId),eq(setups.id,trade.setupId))).get():undefined;
      if(trade.setupId&&!setup)throw missingLink();
      const prior=await db.select().from(trades).where(and(eq(trades.userId,userId),eq(trades.id,id))).get();
      if(trade.market){
        const market=await db.select().from(assetCatalog).where(and(eq(assetCatalog.userId,userId),eq(assetCatalog.id,trade.market.id))).get();
        if(market)trade.market={id:market.id,name:market.name};
        else if(prior?.data.market?.id===trade.market.id)trade.market=prior.data.market;
        else throw new JournalError("El activo estadístico no está disponible en tu catálogo.",422);
      }else if(trade.market===undefined&&prior?.data.market)trade.market=prior.data.market;
      if(prior&&prior.setupId===trade.setupId){if(prior.data.setupSnapshot)trade.setupSnapshot=prior.data.setupSnapshot;}
      else if(setup)trade.setupSnapshot={version:setup.version,name:setup.data.name,rules:setup.data.rules,description:setup.data.description,riskRules:setup.data.riskRules};
      if (version === null) {
        const result = await db.insert(trades).values(tradeValues(userId, id, trade)).onConflictDoNothing().returning({ version: trades.version });
        if (!result.length) {
          const existing = await db.select().from(trades).where(and(eq(trades.userId, userId), eq(trades.id, id))).get();
          const expected = tradeValues(userId, id, trade);
          if (!existing || existing.openedAt !== expected.openedAt || existing.accountId !== expected.accountId || existing.setupId !== expected.setupId || restoreDecision(existing.data,expected.data)!=="skip") throw conflict();
        }
      } else {
        const { data, openedAt, accountId, setupId } = tradeValues(userId, id, trade);
        const result = await db.update(trades).set({ data, openedAt, accountId, setupId, version: version + 1 })
          .where(and(eq(trades.userId, userId), eq(trades.id, id), eq(trades.version, version))).returning({ id: trades.id });
        if (!result.length) throw conflict();
      }
      const stored=await db.select().from(trades).where(and(eq(trades.userId,userId),eq(trades.id,id))).get();
      if(!stored)throw conflict();
      const {data,version:storedVersion,openedAt,accountId,setupId}=stored;
      return {id,trade:{...data,id,version:storedVersion,openedAt,accountId,setupId}};
    }

    case "deleteTrade": {
      const { id, version } = action;
      const [files, deleted] = await db.batch([
        db.select({ objectKey: attachments.objectKey }).from(attachments).where(and(eq(attachments.userId, userId), eq(attachments.tradeId, id))),
        db.delete(trades).where(and(eq(trades.userId, userId), eq(trades.id, id), eq(trades.version, version))).returning({ id: trades.id }),
      ]);
      if (!deleted.length) throw conflict();
      return { id, removedFiles: files.map((file) => file.objectKey) };
    }

    case "saveAccount": {
      const { id, version, account } = action;
      if (version === null) {
        const result = await db.insert(accounts).values({ id, userId, data: account }).onConflictDoNothing().returning({ id: accounts.id });
        if (!result.length) throw conflict();
      } else {
        const linkedTrades = db.select({ id: trades.id }).from(trades).where(and(eq(trades.userId, userId), eq(trades.accountId, id)));
        const existing = await db.select({ data: accounts.data }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, id), eq(accounts.version, version))).get();
        if (!existing) throw conflict();
        const changingCurrency = existing.data.currency !== account.currency;
        if(changingCurrency&&existing.data.movements?.length)throw new JournalError("La cuenta tiene movimientos de capital en su moneda original.",422);
        const result = await db.update(accounts).set({ data: account, version: version + 1 })
          .where(and(eq(accounts.userId, userId), eq(accounts.id, id), eq(accounts.version, version), changingCurrency ? notExists(linkedTrades) : undefined)).returning({ id: accounts.id });
        if (!result.length) {
          if (changingCurrency && await linkedTrades.get()) throw new JournalError("La cuenta ya tiene operaciones registradas en su moneda original.", 422);
          throw conflict();
        }
      }
      const stored=await db.select().from(accounts).where(and(eq(accounts.userId,userId),eq(accounts.id,id))).get();
      if(!stored)throw conflict();
      return { id, account:{...stored.data,id,version:stored.version} };
    }

    case "restoreSetupVersion": {
      const existing=await db.select().from(setups).where(and(eq(setups.userId,userId),eq(setups.id,action.id),eq(setups.version,action.version))).get();
      if(!existing)throw conflict();
      const historical=existing.data.versions?.find(v=>v.version===action.sourceVersion);
      if(!historical)throw new JournalError("La versión histórica ya no está disponible.",422);
      return applyAction(db,userId,{action:"saveSetup",id:action.id,version:action.version,setup:setupSchema.parse(historical)});
    }
    case "saveSetup": {
      const {id,version,setup:incoming}=action;
      const fields={...incoming};
      delete fields.versions;
      if(version===null){
        const result=await db.insert(setups).values({id,userId,data:{...fields,versions:[]}}).onConflictDoNothing().returning({id:setups.id});
        if(!result.length)throw conflict();
      }else{
        const existing=await db.select().from(setups).where(and(eq(setups.userId,userId),eq(setups.id,id),eq(setups.version,version))).get();
        if(!existing)throw conflict();
        const prior=setupSchema.parse(existing.data);
        const {versions:history=[],...previousFields}=prior;
        const keys=["name","description","rules","color","assets","timeframes","sessions","riskRules","examples","archived"] as const;
        const changed=keys.some(key=>previousFields[key]!==fields[key]);
        const nextHistory=changed?[...history,{...previousFields,version:existing.version,savedAt:Date.now()}].slice(-20):history;
        const result=await db.update(setups).set({data:{...fields,versions:nextHistory},version:version+1})
          .where(and(eq(setups.userId,userId),eq(setups.id,id),eq(setups.version,version))).returning({id:setups.id});
        if(!result.length)throw conflict();
      }
      const stored=await db.select().from(setups).where(and(eq(setups.userId,userId),eq(setups.id,id))).get();
      if(!stored)throw conflict();
      return {id,setup:{...stored.data,id,version:stored.version}};
    }

    case "savePlan": {
      const { version, plan } = action;
      const result = version === 0
        ? await db.insert(plans).values({ userId, data: plan }).onConflictDoNothing().returning({ version: plans.version })
        : await db.update(plans).set({ data: plan, version: version + 1 })
            .where(and(eq(plans.userId, userId), eq(plans.version, version))).returning({ version: plans.version });
      if (!result.length) throw conflict();
      return { version: result[0].version };
    }

    case "saveReview": {
      const { week, scope, version, review } = action;
      if (scope !== "all" && scope !== "unassigned" && !await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, scope))).get()) throw missingLink();
      const result = version === 0
        ? await db.insert(reviews).values({ userId, week, scope, data: review }).onConflictDoNothing().returning({ version: reviews.version })
        : await db.update(reviews).set({ data: review, version: version + 1 })
            .where(and(eq(reviews.userId, userId), eq(reviews.week, week), eq(reviews.scope, scope), eq(reviews.version, version))).returning({ version: reviews.version });
      if (!result.length) throw conflict();
      return { version: result[0].version };
    }

    case "importTrades": {
      const { accountId, trades: items } = action;
      const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).get();
      if (!account || account.data.archived) throw missingLink();
      if (items.length > 40) throw new JournalError("Importa hasta 40 operaciones por envío.", 422);
      if (items.some((item) => item.trade.closedAt === null)) throw new JournalError("El archivo debe contener operaciones cerradas.", 422);
      const activeSetups = await db.select({ id: setups.id }).from(setups).where(eq(setups.userId, userId));
      const validSetups = new Set(activeSetups.map((setup) => setup.id));
      const columnsPerTrade = 8;
      const chunkSize = Math.floor(96 / columnsPerTrade);
      const statements = [];
      for (let offset = 0; offset < items.length; offset += chunkSize) {
        const values = items.slice(offset, offset + chunkSize).map(({ id, key, trade }) => tradeValues(userId, id, {
          ...trade, setupSnapshot:undefined, accountId, setupId: trade.setupId && validSetups.has(trade.setupId) ? trade.setupId : null,
        }, `${accountId}:${key}`));
        statements.push(db.insert(trades).values(values).onConflictDoNothing().returning({ id: trades.id }));
      }
      const [first, ...rest] = statements;
      if (!first) throw new JournalError("El archivo no contiene operaciones.", 422);
      const batches = await db.batch([first, ...rest]);
      return { imported: batches.reduce((count, rows) => count + rows.length, 0) };
    }
  }
}

export function captureScope(userId: string, tradeId: string) {
  return and(eq(attachments.userId, userId), eq(attachments.tradeId, tradeId));
}

export function ownedTrade(db: JournalDb, userId: string, tradeId: string) {
  return db.select({ exists: sql<number>`1` }).from(trades).where(and(eq(trades.userId, userId), eq(trades.id, tradeId))).get();
}
