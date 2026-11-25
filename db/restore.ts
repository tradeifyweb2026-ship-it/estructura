import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { JournalDb } from "./repository";
import { JournalError } from "./repository";
import { accounts, setups, trades, plans, reviews, restoreReceipts } from "./schema";
import { accountSchema, setupSchema, tradeSchema, reviewSchema, planSchema, type JournalAction } from "../lib/journal";
import { canonical, restoreDecision } from "../lib/restore-compare.mjs";
import type { RestoreResult } from "../lib/restore-types";

type Action = Extract<JournalAction, { action: "restoreBatch" }>;
// The snapshot check and every write share one D1 batch transaction. A changed
// snapshot deliberately fails the first SQL statement, rolling back the batch.
function snapshot(db: JournalDb, guards: SQL[]) {
  return db.select({ valid: sql<number>`CASE WHEN ${sql.join(guards, sql` AND `)} THEN 1 ELSE json('restore_snapshot_changed') END` }).from(sql`(SELECT 1)`);
}
function changed(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) if (/malformed JSON|restore_snapshot_changed/.test(e.message)) return true;
  return false;
}

export async function restoreBatch(db: JournalDb, userId: string, action: Action): Promise<RestoreResult> {
  const { batch } = action;
  const requestId = action.requestId ?? crypto.randomUUID();
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(batch)));
  const fingerprint = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
  const receiptQuery = () => db.select().from(restoreReceipts).where(and(eq(restoreReceipts.userId, userId), eq(restoreReceipts.requestId, requestId))).get();
  const readReceipt = (receipt: Awaited<ReturnType<typeof receiptQuery>>) => {
    if (!receipt) return undefined;
    if (receipt.fingerprint !== fingerprint) throw new JournalError("El identificador del lote ya corresponde a otro contenido.", 409);
    return receipt.result;
  };
  const saved = readReceipt(await receiptQuery());
  if (saved) return saved;
  const result: RestoreResult = { imported: 0, skipped: 0, records: [] };
  const decide = (key: string, previous: unknown, incoming: unknown) => {
    const decision = restoreDecision(previous, incoming);
    if (decision === "conflict") throw new JournalError(`Conflicto en ${batch.kind}: ${key}. No se guardó este lote.`, 409);
    result.records.push({ key, status: decision === "add" ? "added" : "skipped" });
    if (decision === "add") result.imported++; else result.skipped++;
    return decision === "add";
  };
  const receipt = () => db.insert(restoreReceipts).values({ userId, requestId, fingerprint, result });
  const guards: SQL[] = [];
  try {
    if (batch.kind === "plan") {
      const old = await db.select().from(plans).where(eq(plans.userId, userId)).get();
      const add = decide("plan", old ? planSchema.parse(old.data) : undefined, batch.record);
      guards.push(old ? sql`EXISTS (SELECT 1 FROM plans WHERE user_id=${userId} AND version=${old.version} AND json(data)=json(${JSON.stringify(old.data)}))` : sql`NOT EXISTS (SELECT 1 FROM plans WHERE user_id=${userId})`);
      if (add) await db.batch([snapshot(db, guards), db.insert(plans).values({ userId, data: batch.record }), receipt()]);
      else await db.batch([snapshot(db, guards), receipt()]);
      return result;
    }
    const keys = batch.kind === "reviews" ? batch.records.map(r => r.week + ":" + r.scope) : batch.records.map(r => r.id);
    if (new Set(keys).size !== keys.length) throw new JournalError("El lote contiene identificadores duplicados.", 422);
    if (batch.kind === "accounts" || batch.kind === "setups") {
      // These tables have the same storage shape; keep their domain parsers separate.
      if (batch.kind === "accounts") {
        const old = await db.select().from(accounts).where(and(eq(accounts.userId, userId), inArray(accounts.id, keys)));
        const values = batch.records.flatMap(r => {
          const previous = old.find(o => o.id === r.id);
          guards.push(previous ? sql`EXISTS (SELECT 1 FROM accounts WHERE user_id=${userId} AND id=${r.id} AND version=${previous.version} AND json(data)=json(${JSON.stringify(previous.data)}))` : sql`NOT EXISTS (SELECT 1 FROM accounts WHERE user_id=${userId} AND id=${r.id})`);
          return decide(r.id, previous ? accountSchema.parse(previous.data) : undefined, accountSchema.parse(r)) ? [{ userId, id: r.id, version: r.version, data: accountSchema.parse(r) }] : [];
        });
        if (values.length) await db.batch([snapshot(db, guards), db.insert(accounts).values(values), receipt()]);
        else await db.batch([snapshot(db, guards), receipt()]);
      } else {
        const old = await db.select().from(setups).where(and(eq(setups.userId, userId), inArray(setups.id, keys)));
        const values = batch.records.flatMap(r => {
          const previous = old.find(o => o.id === r.id);
          guards.push(previous ? sql`EXISTS (SELECT 1 FROM setups WHERE user_id=${userId} AND id=${r.id} AND version=${previous.version} AND json(data)=json(${JSON.stringify(previous.data)}))` : sql`NOT EXISTS (SELECT 1 FROM setups WHERE user_id=${userId} AND id=${r.id})`);
          return decide(r.id, previous ? {...setupSchema.parse(previous.data),versions:previous.data.versions??[]} : undefined, {...setupSchema.parse(r),versions:r.versions??[]}) ? [{ userId, id: r.id, version: r.version, data: setupSchema.parse(r) }] : [];
        });
        if (values.length) await db.batch([snapshot(db, guards), db.insert(setups).values(values), receipt()]);
        else await db.batch([snapshot(db, guards), receipt()]);
      }
      return result;
    }
    if (batch.kind === "trades") {
      const old = await db.select().from(trades).where(and(eq(trades.userId, userId), inArray(trades.id, keys)));
      const values = batch.records.flatMap(r => {
        const previous = old.find(o => o.id === r.id);
        guards.push(previous ? sql`EXISTS (SELECT 1 FROM trades WHERE user_id=${userId} AND id=${r.id} AND version=${previous.version} AND opened_at=${previous.openedAt} AND account_id IS ${previous.accountId} AND setup_id IS ${previous.setupId} AND json(data)=json(${JSON.stringify(previous.data)}))` : sql`NOT EXISTS (SELECT 1 FROM trades WHERE user_id=${userId} AND id=${r.id})`);
        const prior = previous ? tradeSchema.parse({ ...previous.data, openedAt: previous.openedAt, accountId: previous.accountId, setupId: previous.setupId }) : undefined;
        const data = tradeSchema.parse(r);
        if (!decide(r.id, prior, data)) return [];
        const { openedAt, accountId, setupId, ...fields } = data;
        return [{ userId, id: r.id, version: r.version, openedAt, accountId, setupId, data: fields }];
      });
      for (const id of new Set(batch.records.flatMap(r => r.accountId ? [r.accountId] : []))) {
        if (!await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, id))).get()) throw new JournalError(`Cuenta inexistente: ${id}.`, 422);
      }
      for (const id of new Set(batch.records.flatMap(r => r.setupId ? [r.setupId] : []))) {
        if (!await db.select({ id: setups.id }).from(setups).where(and(eq(setups.userId, userId), eq(setups.id, id))).get()) throw new JournalError(`Estrategia inexistente: ${id}.`, 422);
      }
      if (values.length) await db.batch([snapshot(db, guards), db.insert(trades).values(values), receipt()]);
      else await db.batch([snapshot(db, guards), receipt()]);
      return result;
    }
    const old = await db.select().from(reviews).where(and(eq(reviews.userId, userId), inArray(reviews.week, batch.records.map(r => r.week))));
    for (const scope of new Set(batch.records.map(r => r.scope).filter(s => s !== "all" && s !== "unassigned"))) {
      if (!await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, scope))).get()) throw new JournalError(`Cuenta de revisión inexistente: ${scope}.`, 422);
      guards.push(sql`EXISTS (SELECT 1 FROM accounts WHERE user_id=${userId} AND id=${scope})`);
    }
    const values = batch.records.flatMap(r => {
      const previous = old.find(o => o.week === r.week && o.scope === r.scope);
      guards.push(previous ? sql`EXISTS (SELECT 1 FROM reviews WHERE user_id=${userId} AND week=${r.week} AND scope=${r.scope} AND version=${previous.version} AND json(data)=json(${JSON.stringify(previous.data)}))` : sql`NOT EXISTS (SELECT 1 FROM reviews WHERE user_id=${userId} AND week=${r.week} AND scope=${r.scope})`);
      return decide(r.week + ":" + r.scope, previous ? reviewSchema.parse(previous.data) : undefined, reviewSchema.parse(r)) ? [{ userId, week: r.week, scope: r.scope, version: r.version, data: reviewSchema.parse(r) }] : [];
    });
    if (values.length) await db.batch([snapshot(db, guards), db.insert(reviews).values(values), receipt()]);
    else await db.batch([snapshot(db, guards), receipt()]);
    return result;
  } catch (error) {
    const concurrent = readReceipt(await receiptQuery());
    if (concurrent) return concurrent;
    if (changed(error)) throw new JournalError("Los datos cambiaron durante la restauración. No se guardó este lote; vuelve a intentarlo.", 409);
    throw error;
  }
}
