import { z } from "./validation.ts";
import {marketSnapshot} from "./asset-catalog.ts";

export const TIME_ZONE = "America/Guayaquil";
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "MXN"] as const;
export const ACCOUNT_TYPES = ["Demo", "Real", "Evaluación", "Fondeada", "Fondeo instantáneo", "Personalizada"] as const;
export const ACCOUNT_STATES=["Activa","En evaluación","Aprobada","Fondeada","Suspendida","Perdida","Finalizada"] as const;
export const EMOTIONS = ["Calma", "Confianza", "FOMO", "Miedo", "Duda", "Euforia", "Frustración", "Aburrimiento", "Venganza", "Satisfacción"] as const;
export const ERRORS = ["Entrada tardía", "Moví el stop", "Cerré por miedo", "Sobreoperé", "Ignoré el plan", "Operé durante noticia", "Aumenté el riesgo"] as const;
export const SETUP_COLORS = ["violeta", "azul", "verde", "ámbar", "rosa"] as const;
export const SLOTS = ["before", "after"] as const;

// Preserve the GUID format accepted by Zod 3 for existing CSV imports.
export const idSchema = z.string().guid();
const versionSchema = z.number().int().positive();
const cents = z.number().int().min(-100_000_000_000).max(100_000_000_000);
const positiveCents = cents.min(0);
const price = z.number().positive().max(1_000_000_000).nullable();
const timestamp = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
const smallText = z.string().trim().max(100);
const optionalText = z.string().trim().max(2_500);
const emotion = z.object({
  name: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(5),
}).nullable();
const noteSchema = z.object({
  kind: z.enum(["text", "heading", "check"]),
  text: z.string().trim().min(1).max(2_500),
  checked: z.boolean().default(false),
});

const optionalPercent=z.number().positive().max(100).nullable().optional();
const dateKeySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;});
export const capitalMovementSchema=z.object({id:idSchema,kind:z.enum(["deposit","withdrawal","adjustment","fee"]),amountCents:cents,day:dateKeySchema,note:smallText}).superRefine((m,ctx)=>{if(m.amountCents===0||(m.kind!=="adjustment"&&m.amountCents<0))ctx.addIssue({code:"custom",path:["amountCents"],message:"Importe de movimiento no válido."});});
const fundingSchema=z.object({company:smallText,phase:smallText,targetPercent:optionalPercent,dailyLossPercent:optionalPercent,totalLossPercent:optionalPercent,consistencyPercent:optionalPercent,minDays:z.number().int().min(1).max(3650).nullable().optional(),startsOn:dateKeySchema.nullable().optional(),endsOn:dateKeySchema.nullable().optional(),rules:optionalText}).superRefine((v,ctx)=>{if(v.startsOn&&v.endsOn&&v.endsOn<v.startsOn)ctx.addIssue({code:"custom",path:["endsOn"],message:"El vencimiento debe ser posterior al inicio."});});
export const accountSchema = z.object({
  name: smallText.min(1),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.enum(CURRENCIES),
  startingBalanceCents: positiveCents,
  riskLimits:z.object({perTradePercent:optionalPercent,dailyLossR:z.number().positive().max(1000).nullable().optional(),simultaneousPercent:optionalPercent,drawdownBasis:z.enum(["closed","realized"]).optional(),maxDrawdownPercent:optionalPercent,dailyDrawdownPercent:optionalPercent,totalLossPercent:optionalPercent}).optional(),
  broker:smallText.optional(),platform:smallText.optional(),createdOn:dateKeySchema.nullable().optional(),status:z.enum(ACCOUNT_STATES).optional(),notes:optionalText.optional(),funding:fundingSchema.optional(),
  movements:z.array(capitalMovementSchema).max(100).refine(v=>new Set(v.map(m=>m.id)).size===v.length,"Hay movimientos duplicados.").optional(),
  archived: z.boolean().default(false),
});

const setupVersionSchema=z.object({
  version:versionSchema,savedAt:timestamp,name:smallText.min(1),description:optionalText,rules:optionalText,color:z.enum(SETUP_COLORS),
  assets:smallText.optional(),timeframes:smallText.optional(),sessions:smallText.optional(),riskRules:optionalText.optional(),examples:optionalText.optional(),archived:z.boolean(),
});
export const setupSchema = z.object({
  name: smallText.min(1),
  description: optionalText,
  rules: optionalText,
  color: z.enum(SETUP_COLORS),
  assets:smallText.optional(),timeframes:smallText.optional(),sessions:smallText.optional(),riskRules:optionalText.optional(),examples:optionalText.optional(),
  archived: z.boolean().default(false),
  versions:z.array(setupVersionSchema).max(20).optional(),
});

export const planSchema = z.object({
  rules: z.array(smallText.min(1)).max(20),
  riskPercent: z.number().positive().max(100).nullable(),
  dailyLossR: z.number().positive().max(1000).nullable(),
  weeklyTargetR: z.number().positive().max(1000).nullable(),
});

export const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}, "La revisión debe empezar en lunes");

export const reviewPeriodSchema=z.union([weekSchema,z.string().regex(/^month:\d{4}-(0[1-9]|1[0-2])$/)]);
export const scopeSchema = z.union([z.literal("all"), z.literal("unassigned"), idSchema]);
export const reviewSchema = z.object({
  followed: optionalText,
  repeat: optionalText,
  change: optionalText,
});

// Deliberately explicit hosts: never accept arbitrary *.tradingview.com or suffix matches.
export function isTradingViewCaptureLink(value: string): boolean {
  if (value.length > 300 || /[\s\x00-\x1f\x7f<>"'\\]/.test(value) || /%(?:00|0a|0d|20|3c|3e)/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["tradingview.com", "www.tradingview.com", "s3.tradingview.com"].includes(url.hostname) &&
      value.startsWith("https://") && !url.hash;
  } catch { return false; }
}
export const captureLinkSchema = z.string().refine(isTradingViewCaptureLink,
  "Pega un enlace HTTPS de TradingView de hasta 300 caracteres, sin espacios, credenciales ni código.");
export function isDirectCaptureImage(value: string): boolean {
  return isTradingViewCaptureLink(value) && new URL(value).hostname === "s3.tradingview.com" &&
    /\.(png|jpe?g|webp)$/i.test(new URL(value).pathname);
}

export const tradeSchema = z.object({
  market:marketSnapshot.nullable().optional(),
  captureLinks: z.object({ before: captureLinkSchema.optional(), after: captureLinkSchema.optional() }).optional(),
  accountId: idSchema.nullable(),
  setupId: idSchema.nullable(),
  setupSnapshot:z.object({version:versionSchema,name:smallText,rules:optionalText,description:optionalText,riskRules:optionalText.optional()}).optional(),
  asset: z.string().trim().toUpperCase().min(1).max(24).regex(/^[A-Z0-9][A-Z0-9 ._:/!#-]*$/, "Escribe un símbolo válido"),
  direction: z.enum(["long", "short"]),
  openedAt: timestamp,
  closedAt: timestamp.nullable(),
  entry: price,
  stop: price,
  // Optional JSON fields: old operations remain readable without a migration.
  currentStop: price.optional(),
  stopChangedAt: timestamp.nullable().optional(),
  target: price,
  exit: price,
  size: z.number().positive().max(1_000_000_000).nullable(),
  riskPercent: z.number().positive().max(100).nullable(),
  riskCents: positiveCents.min(1).nullable(),
  pnlCents: cents.nullable(),
  feesCents: positiveCents.nullable(),
  partials: z.array(z.object({
    price: z.number().positive().max(1_000_000_000),
    percent: z.number().positive().max(100),
    at: timestamp.nullable().optional(),
    pnlCents: cents.nullable().optional(),
  })).max(12),
  before: emotion,
  during: emotion,
  after: emotion,
  grade: z.number().int().min(1).max(5).nullable(),
  errors: z.array(z.enum(ERRORS)).max(ERRORS.length),
  checklist: z.array(z.object({ text: smallText.min(1), checked: z.boolean() })).max(20),
  notes: z.array(noteSchema).max(30),
}).superRefine((trade, ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (trade.closedAt !== null && trade.closedAt < trade.openedAt) add("closedAt", "La salida debe ser posterior o igual a la entrada");
  if (trade.closedAt === null && (trade.entry === null || trade.stop === null)) add(trade.entry === null ? "entry" : "stop", "Indica la entrada y el stop loss para registrar una operación abierta");
  if (trade.closedAt !== null && trade.exit === null && trade.pnlCents === null && !trade.partials.length) {
    add("pnlCents", "Indica el resultado neto o un precio de salida");
  }
  if (trade.entry !== null) {
    const direction = trade.direction === "long" ? 1 : -1;
    if (trade.stop !== null && (trade.entry - trade.stop) * direction <= 0) add("stop", "El stop loss debe quedar del lado de la pérdida");
    if (trade.target !== null && (trade.target - trade.entry) * direction <= 0) add("target", "El objetivo debe quedar del lado del beneficio");
  }
  if(trade.stopChangedAt!=null&&(trade.currentStop==null||trade.stopChangedAt<trade.openedAt||(trade.closedAt!==null&&trade.stopChangedAt>trade.closedAt)))add("stopChangedAt","La fecha del stop actual debe estar dentro de la operación y requiere un precio.");
  if(trade.partials.some(fill=>fill.at!=null&&(fill.at<trade.openedAt||(trade.closedAt!==null&&fill.at>trade.closedAt))))add("partials","La fecha de cada parcial debe estar dentro de la operación.");
  const exited = trade.partials.reduce((total, fill) => total + fill.percent, 0);
  if (exited > 100.000001) add("partials", "Las salidas parciales superan el 100% de la posición");
  if (trade.closedAt === null && exited >= 99.999999) add("partials", "Marca la operación como cerrada si ya salió el 100%");
  if (trade.closedAt !== null && exited > 0 && exited < 99.999999 && trade.exit === null) add("exit", "Indica el precio de salida final de la parte restante");
});

export type AccountDraft = z.infer<typeof accountSchema>;
export type SetupDraft = z.infer<typeof setupSchema>;
export type TradeDraft = z.infer<typeof tradeSchema>;
export type Plan = z.infer<typeof planSchema>;
export type ReviewDraft = z.infer<typeof reviewSchema>;
export type Currency = (typeof CURRENCIES)[number];
export type Slot = (typeof SLOTS)[number];
export type Scope = z.infer<typeof scopeSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Emotion = NonNullable<TradeDraft["before"]>;
type Stored<T> = T & { id: string; version: number };
export type Account = Stored<AccountDraft>;
export type Setup = Stored<SetupDraft>;
export type Capture = { tradeId: string; slot: Slot; revision: string };
export type Trade = Stored<TradeDraft>;
export type Review = ReviewDraft & { week: string; scope: Scope; version: number };
export type Journal = {
  accounts: Account[];
  setups: Setup[];
  trades: Trade[];
  captures: Capture[];
  plan: Plan;
  planVersion: number;
  reviews: Review[];
};

export const defaultPlan: Plan = { rules: [], riskPercent: null, dailyLossR: null, weeklyTargetR: null };
export const blankJournal: Journal = { accounts: [], setups: [], trades: [], captures: [], plan: defaultPlan, planVersion: 0, reviews: [] };
const storedSchema=z.object({id:idSchema,version:versionSchema});
export const storedAccountSchema=z.intersection(accountSchema,storedSchema);
export const storedSetupSchema=z.intersection(setupSchema,storedSchema);
export const storedTradeSchema=z.intersection(tradeSchema,storedSchema);
export const storedReviewSchema=z.intersection(reviewSchema,z.object({week:reviewPeriodSchema,scope:scopeSchema,version:versionSchema}));
export const backupSchema=z.object({
 app:z.literal("bitacora-de-trading"),formato:z.literal(1),
 cuentas:z.array(storedAccountSchema).max(1000),setups:z.array(storedSetupSchema).max(1000),
 operaciones:z.array(storedTradeSchema).max(20000),revisiones:z.array(storedReviewSchema).max(10000),
 plan:planSchema,
}).superRefine((data,ctx)=>{
 for(const list of [data.cuentas,data.setups,data.operaciones])if(new Set(list.map(v=>v.id)).size!==list.length)ctx.addIssue({code:"custom",message:"El respaldo contiene identificadores duplicados."});
 if(new Set(data.revisiones.map(v=>v.week+":"+v.scope)).size!==data.revisiones.length)ctx.addIssue({code:"custom",message:"El respaldo contiene revisiones duplicadas."});
});
export type Backup=z.infer<typeof backupSchema>;
const restoreBatchSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("accounts"),records:z.array(storedAccountSchema).min(1).max(10)}),
 z.object({kind:z.literal("setups"),records:z.array(storedSetupSchema).min(1).max(10)}),
 z.object({kind:z.literal("trades"),records:z.array(storedTradeSchema).min(1).max(10)}),
 z.object({kind:z.literal("reviews"),records:z.array(storedReviewSchema).min(1).max(10)}),
 z.object({kind:z.literal("plan"),record:planSchema}),
]);
const saveTarget = { id: idSchema, version: versionSchema.nullable() };
export const actionSchema = z.discriminatedUnion("action", [
  z.object({action:z.literal("restoreBatch"),batch:restoreBatchSchema,requestId:idSchema.optional()}),
  z.object({ action: z.literal("saveTrade"), ...saveTarget, trade: tradeSchema }),
  z.object({ action: z.literal("deleteTrade"), id: idSchema, version: versionSchema }),
  z.object({ action: z.literal("saveAccount"), ...saveTarget, account: accountSchema }),
  z.object({ action: z.literal("saveSetup"), ...saveTarget, setup: setupSchema }),
  z.object({ action: z.literal("restoreSetupVersion"), id: idSchema, version: versionSchema, sourceVersion: versionSchema }),
  z.object({ action: z.literal("savePlan"), version: z.number().int().min(0), plan: planSchema }),
  z.object({ action: z.literal("saveReview"), week: reviewPeriodSchema, scope: scopeSchema, version: z.number().int().min(0), review: reviewSchema }),
  z.object({
    action: z.literal("importTrades"),
    accountId: idSchema,
    trades: z.array(z.object({ id: idSchema, key: z.string().trim().min(1).max(256), trade: tradeSchema })).min(1).max(40),
  }),
]);
export type JournalAction = z.infer<typeof actionSchema>;

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const humanDate = new Intl.DateTimeFormat("es-EC", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
const humanDay = new Intl.DateTimeFormat("es-EC", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const humanMonth = new Intl.DateTimeFormat("es-EC", { timeZone: "UTC", month: "long", year: "numeric" });
const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

export function dayKey(value: number) {
  const parts = dayFormatter.formatToParts(value);
  const get = (key: string) => parts.find((part) => part.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const timeLabel = (value: number) => hourFormatter.format(value);
export const dateLabel = (value: number) => humanDate.format(value);
export const dayLabel = (value: number) => humanDay.format(value);
export const monthLabel = (value: string) => humanMonth.format(new Date(value + "-01T12:00:00Z"));
export const dateInput = (value: number) => `${dayKey(value)}T${timeLabel(value)}`;

// Mainland Ecuador uses UTC−05:00 for the current trading dates supported here.
export function inputDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  const parsed = Date.parse(value + "-05:00");
  return Number.isFinite(parsed) && dateInput(parsed) === value.slice(0, 16) ? parsed : NaN;
}

const utcDay = (day: string) => new Date(day + "T12:00:00Z");
export function addDays(day: string, offset: number) {
  const date = utcDay(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export const weekday = (day: string) => (utcDay(day).getUTCDay() + 6) % 7;
export const weekStart = (day: string) => addDays(day, -weekday(day));
export function shiftMonth(month: string, offset: number) {
  const date = utcDay(month + "-01");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function toCents(value: number) {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100);
}

export function formatMoney(value: number, currency: Currency = "USD", signed = true) {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-EC", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    moneyFormatters.set(currency, formatter);
  }
  return (signed && value > 0 ? "+" : "") + formatter.format(value / 100);
}

const numberFormat = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 });
export const numberText = (value: number) => Number.isFinite(value) ? numberFormat.format(value) : "∞";
export const priceText = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("es-EC", { maximumFractionDigits: 8 }).format(value);
export const rLabel = (value: number | null) => value === null ? "—" : `${value >= 0.005 ? "+" : ""}${numberText(Math.abs(value) < 0.005 ? 0 : value)} R`;
export const sideLabel = (direction: TradeDraft["direction"]) => direction === "long" ? "Compra" : "Venta";
export const currencyOf = (trade: TradeDraft, accounts: Account[]) => accounts.find((account) => account.id === trade.accountId)?.currency ?? "USD";

export function estimatedRatio(trade: Pick<TradeDraft, "entry" | "stop" | "target" | "direction">) {
  if (trade.entry === null || trade.stop === null || trade.target === null) return null;
  const direction = trade.direction === "long" ? 1 : -1;
  const risk = (trade.entry - trade.stop) * direction;
  const gain = (trade.target - trade.entry) * direction;
  return risk > 0 && gain > 0 ? gain / risk : null;
}

export function averageExit(trade: TradeDraft): number | null {
  if (!trade.partials.length) return trade.exit;
  const closed = trade.partials.reduce((total, fill) => total + fill.percent, 0);
  const notPartial = Math.max(0, 100 - closed);
  if (notPartial > 0.000001 && trade.exit === null) return null;
  const weighted = trade.partials.reduce((total, fill) => total + fill.price * fill.percent, 0);
  return (weighted + (trade.exit ?? 0) * notPartial) / 100;
}

export function resultR(trade: TradeDraft): number | null {
  if (trade.closedAt === null) return null;
  if (trade.pnlCents !== null && trade.riskCents !== null) return trade.pnlCents / trade.riskCents;
  const exit = averageExit(trade);
  if (exit === null || trade.entry === null || trade.stop === null) return null;
  const direction = trade.direction === "long" ? 1 : -1;
  const initialRisk = (trade.entry - trade.stop) * direction;
  if (initialRisk <= 0) return null;
  const value = (exit - trade.entry) * direction / initialRisk;
  return Number.isFinite(value) ? (value === 0 ? 0 : value) : null;
}

export function outcome(trade: TradeDraft) {
  if (trade.closedAt === null) return "open";
  const value = trade.pnlCents ?? resultR(trade);
  return value === null ? "unknown" : Math.abs(value) < 1e-9 ? "flat" : value > 0 ? "win" : "loss";
}

export function matchesScope(trade: TradeDraft, scope: Scope) {
  return scope === "all" || (scope === "unassigned" ? trade.accountId === null : trade.accountId === scope);
}
