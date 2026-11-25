import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AccountDraft, Plan, ReviewDraft, Scope, SetupDraft, Slot, TradeDraft } from "../lib/journal";
import type { RestoreResult } from "../lib/restore-types";
import { sql } from "drizzle-orm";
import type {VaultEnvelope,Sealed} from '../lib/script-crypto';
import type {PublicSnapshot,PublicVisibility} from '../lib/public-share';

export const publicTradeShares=sqliteTable('public_trade_shares',{
 id:text('id').primaryKey().notNull(),userId:text('user_id').notNull(),tradeId:text('trade_id').notNull(),accountId:text('account_id'),tokenHash:text('token_hash').notNull(),snapshot:text('snapshot',{mode:'json'}).$type<PublicSnapshot>().notNull(),visibility:text('visibility',{mode:'json'}).$type<PublicVisibility>().notNull(),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[foreignKey({columns:[t.userId],foreignColumns:[users.userId]}).onDelete('cascade'),foreignKey({columns:[t.userId,t.tradeId],foreignColumns:[trades.userId,trades.id]}).onDelete('cascade'),foreignKey({columns:[t.userId,t.accountId],foreignColumns:[accounts.userId,accounts.id]}).onDelete('cascade'),uniqueIndex('public_shares_token').on(t.tokenHash),index('public_shares_owner_trade').on(t.userId,t.tradeId,t.createdAt,t.id),index('public_shares_owner_expiry').on(t.userId,t.expiresAt),index('public_shares_expiry').on(t.expiresAt,t.id),check('public_shares_lifetime',sql`${t.expiresAt}=${t.createdAt}+2592000000`)]);

export const journalRevisions=sqliteTable("journal_revisions",{
  userId:text("user_id").primaryKey(),version:integer("version").notNull().default(0),
});

export const assetCatalog=sqliteTable('asset_catalog',{
 userId:text('user_id').notNull(),id:text('id').notNull(),version:integer('version').notNull().default(1),name:text('name').notNull(),nameKey:text('name_key').notNull(),favorite:integer('favorite').notNull().default(0),lastUsedAt:integer('last_used_at'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.userId,t.id]}),foreignKey({columns:[t.userId],foreignColumns:[users.userId]}).onDelete('cascade'),uniqueIndex('asset_catalog_owner_name').on(t.userId,t.nameKey),index('asset_catalog_owner_recent').on(t.userId,t.lastUsedAt,t.id)]);
export const assetAliases=sqliteTable('asset_aliases',{
 userId:text('user_id').notNull(),alias:text('alias').notNull(),assetId:text('asset_id').notNull(),
},t=>[primaryKey({columns:[t.userId,t.alias]}),foreignKey({columns:[t.userId,t.assetId],foreignColumns:[assetCatalog.userId,assetCatalog.id]}).onDelete('cascade'),index('asset_aliases_owner_asset').on(t.userId,t.assetId)]);

export const scriptVaults=sqliteTable('script_vaults',{
 userId:text('user_id').primaryKey().notNull(),id:text('id').notNull(),version:integer('version').notNull().default(1),revision:integer('revision').notNull().default(0),envelope:text('envelope',{mode:'json'}).$type<VaultEnvelope>().notNull(),usedBytes:integer('used_bytes').notNull().default(0),quotaBytes:integer('quota_bytes').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[foreignKey({columns:[t.userId],foreignColumns:[users.userId]}).onDelete('cascade'),uniqueIndex('script_vaults_owner_id').on(t.userId,t.id),check('script_vault_budget',sql`${t.usedBytes}>=0 AND ${t.quotaBytes}>0`)]);
export const privateScripts=sqliteTable('private_scripts',{
 userId:text('user_id').notNull(),id:text('id').notNull(),version:integer('version').notNull().default(1),vaultId:text('vault_id').notNull(),metadata:text('metadata',{mode:'json'}).$type<Sealed>().notNull(),ciphertext:text('ciphertext',{mode:'json'}).$type<Sealed>().notNull(),cipherBytes:integer('cipher_bytes').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.userId,t.id]}),foreignKey({columns:[t.userId,t.vaultId],foreignColumns:[scriptVaults.userId,scriptVaults.id]}).onDelete('cascade'),index('private_scripts_owner_updated').on(t.userId,t.updatedAt,t.id),check('private_script_budget',sql`${t.cipherBytes}>0`)]);

export const restoreReceipts = sqliteTable("restore_receipts", {
  userId: text("user_id").notNull(), requestId: text("request_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  result: text("result", { mode: "json" }).$type<RestoreResult>().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.requestId] })]);

export const accounts = sqliteTable("accounts", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  version: integer("version").notNull().default(1),
  data: text("data", { mode: "json" }).$type<AccountDraft>().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.id] })]);

export const setups = sqliteTable("setups", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  version: integer("version").notNull().default(1),
  data: text("data", { mode: "json" }).$type<SetupDraft>().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.id] })]);

export const trades = sqliteTable("trades", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  version: integer("version").notNull().default(1),
  openedAt: integer("opened_at").notNull(),
  accountId: text("account_id"),
  setupId: text("setup_id"),
  importKey: text("import_key"),
  data: text("data", { mode: "json" }).$type<Omit<TradeDraft, "openedAt" | "accountId" | "setupId">>().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  foreignKey({ columns: [table.userId, table.accountId], foreignColumns: [accounts.userId, accounts.id] }),
  foreignKey({ columns: [table.userId, table.setupId], foreignColumns: [setups.userId, setups.id] }),
  index("trades_user_opened").on(table.userId, table.openedAt),
  index("trades_owner_market").on(table.userId,sql`json_extract(${table.data},'$.market.id')`,table.openedAt),
  index("trades_user_event").on(table.userId,sql`coalesce(json_extract(${table.data},'$.closedAt'),${table.openedAt})`,table.id),
  index("trades_user_account_event").on(table.userId,table.accountId,sql`coalesce(json_extract(${table.data},'$.closedAt'),${table.openedAt})`,table.id),
  index("trades_user_account_closed").on(table.userId,table.accountId,sql`json_extract(${table.data},'$.closedAt')`,table.openedAt,table.id),
  index("trades_user_account_opened").on(table.userId,table.accountId,table.openedAt,table.id),
  uniqueIndex("trades_user_import").on(table.userId, table.importKey),
]);

export const attachments = sqliteTable("attachments", {
  userId: text("user_id").notNull(),
  tradeId: text("trade_id").notNull(),
  slot: text("slot").$type<Slot>().notNull(),
  objectKey: text("object_key").notNull(),
  revision: text("revision").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.tradeId, table.slot] }),
  foreignKey({ columns: [table.userId, table.tradeId], foreignColumns: [trades.userId, trades.id] }).onDelete("cascade"),
  index("attachments_object_key").on(table.objectKey),
]);

export const plans = sqliteTable("plans", {
  userId: text("user_id").primaryKey(),
  version: integer("version").notNull().default(1),
  data: text("data", { mode: "json" }).$type<Plan>().notNull(),
});

export const reviews = sqliteTable("reviews", {
  userId: text("user_id").notNull(),
  week: text("week").notNull(),
  scope: text("scope").$type<Scope>().notNull(),
  version: integer("version").notNull().default(1),
  data: text("data", { mode: "json" }).$type<ReviewDraft>().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.week, table.scope] })]);

export const dailyQuoteProgress = sqliteTable("daily_quote_progress", {
  userId: text("user_id").primaryKey(),
  day: text("day").notNull(),
  position: integer("position").notNull(),
});

export const authSessions = sqliteTable("auth_sessions", {
  createdAt: integer("created_at").notNull().default(0),
  lastSeen: integer("last_seen").notNull().default(0),
  device: text("device").notNull().default("Dispositivo anterior"),
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("auth_sessions_expires").on(table.expiresAt)]);

export const userLimits = sqliteTable("user_limits", {
  userId: text("user_id").primaryKey(),
  trades: integer("trades").notNull(),
  customTrades: integer("custom_trades"),
});

export const loginCodes = sqliteTable("login_codes", {
  emailHash: text("email_hash").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("login_codes_expiry").on(table.expiresAt)]);

export const users = sqliteTable("users", {
  userId: text("user_id").primaryKey(), email: text("email").notNull(),
  createdAt: integer("created_at").notNull(), lastLogin: integer("last_login").notNull(),
  status: text("status").notNull().default("active"),
  accessUntil: integer("access_until"), suspendedUntil: integer("suspended_until"),
});
export const accessSettings = sqliteTable("access_settings", {
  id: integer("id").primaryKey(), mode: text("mode").notNull(),
  defaultDays: integer("default_days"),
});
export const invitations = sqliteTable("access_invitations", {
  email: text("email").primaryKey(), accessUntil: integer("access_until"),
});
export const adminEvents = sqliteTable("admin_events", {
  id: text("id").primaryKey(), actor: text("actor").notNull(),
  target: text("target").notNull(), action: text("action").notNull(),
  createdAt: integer("created_at").notNull(), data: text("data").notNull(),
});

export const sectionCache=sqliteTable("journal_section_cache",{
 userId:text("user_id").notNull(),cacheKey:text("cache_key").notNull(),revision:integer("revision").notNull(),data:text("data").notNull(),updatedAt:integer("updated_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.cacheKey]}),index("journal_section_cache_owner_revision").on(t.userId,t.revision)]);
export const quoteState=sqliteTable("quote_state",{
 userId:text("user_id").primaryKey().notNull(),version:integer("version").notNull().default(0),preferences:text("preferences").notNull().default("{}"),sequence:integer("sequence").notNull().default(0),cycle:integer("cycle").notNull().default(0),
});
export const quoteDeliveries=sqliteTable("quote_deliveries",{
 userId:text("user_id").notNull(),deliveryKey:text("delivery_key").notNull(),quoteId:integer("quote_id").notNull(),cycle:integer("cycle").notNull(),day:text("day").notNull(),createdAt:integer("created_at").notNull(),category:text("category").notNull(),snapshot:text("snapshot").notNull(),
},t=>[primaryKey({columns:[t.userId,t.deliveryKey]}),index("quote_deliveries_owner_cycle").on(t.userId,t.cycle,t.quoteId),index("quote_deliveries_owner_date").on(t.userId,t.createdAt,t.deliveryKey)]);
export const quoteFavorites=sqliteTable("quote_favorites",{
 userId:text("user_id").notNull(),quoteId:integer("quote_id").notNull(),createdAt:integer("created_at").notNull(),snapshot:text("snapshot").notNull(),
},t=>[primaryKey({columns:[t.userId,t.quoteId]})]);
export const maintenance=sqliteTable("maintenance_state",{
 id:integer("id").primaryKey(),version:integer("version").notNull().default(0),active:integer("active").notNull().default(0),message:text("message").notNull().default(""),startedAt:integer("started_at"),untilAt:integer("until_at"),updatedBy:text("updated_by"),updatedAt:integer("updated_at"),
},t=>[check("maintenance_singleton",sql`${t.id}=1`)]);
export const adminAlertState=sqliteTable("admin_alert_state",{
 id:text("id").primaryKey(),status:text("status").notNull(),label:text("label").notNull(),updatedBy:text("updated_by").notNull(),updatedAt:integer("updated_at").notNull(),
},t=>[check("admin_alert_status",sql`${t.status} IN ('reviewed','resolved')`)]);

export const operationalIncidents=sqliteTable("operational_incidents",{
 code:text("code").primaryKey().notNull(),firstAt:integer("first_at").notNull(),lastAt:integer("last_at").notNull(),observations:integer("observations").notNull().default(1),
});

// No FK to users: deletion tasks must survive erasure of the account itself.
export const storageDeletions=sqliteTable("storage_deletions",{
 objectKey:text("object_key").primaryKey().notNull(),userId:text("user_id").notNull(),createdAt:integer("created_at").notNull(),
},t=>[index("storage_deletions_pending").on(t.createdAt,t.objectKey),index("storage_deletions_owner").on(t.userId)]);
