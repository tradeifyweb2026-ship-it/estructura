import {
  CURRENCIES, currencyOf, inputDate, resultR, toCents, tradeSchema,
  type Account, type Currency, type Journal, type Trade, type TradeDraft,
} from "./journal.ts";

const MAX_ROWS = 2500;
const BASE_HEADERS = ["activo", "direccion", "entrada_fecha", "salida_fecha", "entrada", "sl", "tp", "salida", "tamano", "pnl_neto", "comisiones", "riesgo_dinero", "riesgo_pct", "moneda"];
const EXTRA_HEADERS = ["r", "cuenta", "setup", "id_operacion", "setup_id", "nota", "bitacora_v1", "captura_entrada", "captura_salida"];
const aliases = {
  asset: ["activo", "simbolo", "symbol", "instrument", "ticker", "asset"],
  side: ["direccion", "side", "direction", "type", "tipo", "action"],
  opened: ["entradafecha", "fechaentrada", "opentime", "timeopen", "openingtime", "entrytime", "opendate", "entrydate", "time", "fecha"],
  closed: ["salidafecha", "fechasalida", "closetime", "timeclose", "closingtime", "exittime", "closedate", "exitdate"],
  entry: ["entrada", "entry", "entryprice", "openprice", "priceopen", "price"],
  exit: ["salida", "exit", "exitprice", "closeprice", "priceclose", "preciosalida"],
  stop: ["sl", "stoploss", "stop"],
  target: ["tp", "takeprofit", "target"],
  size: ["tamano", "volume", "qty", "quantity", "size", "lots", "lot", "volumen"],
  net: ["pnlneto", "beneficioneto", "netpnl", "netprofit", "netpl", "netresult", "resultado"],
  gross: ["profit", "beneficio", "ganancia", "pnl", "grosspnl", "grossprofit", "pl"],
  swap: ["swap", "financing"],
  fees: ["comisiones", "comision", "commission", "commissions", "fees", "fee"],
  risk: ["riesgodinero", "riskamount", "riskmoney", "riesgomonetario"],
  riskPercent: ["riesgopct", "riskpercent"],
  currency: ["moneda", "currency"],
  identifier: ["position", "ticket", "positionid", "tradeid", "trade", "operacionid"],
  sourceId: ["idoperacion"],
  setup: ["setupid"],
  comment: ["comentario", "comment", "nota", "notes"],
  metadata: ["bitacorav1"],
  captureBefore: ["capturaentrada"],
  captureAfter: ["capturasalida"],
} as const;

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function firstLineDelimiter(text: string) {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = new Map([[";", 0], [",", 0], ["\t", 0]]);
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsv(text: string) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const delimiter = firstLineDelimiter(clean);
  const lines: string[][] = [];
  let line: string[] = [], field = "", quoted = false;
  function endLine() {
    line.push(field);
    if (line.some((value) => value.trim())) lines.push(line);
    if (lines.length > MAX_ROWS + 1) throw new Error(`Importa un máximo de ${MAX_ROWS} filas por archivo.`);
    line = [];
    field = "";
  }
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"' && quoted && clean[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"' && (quoted || !field.length)) {
      quoted = !quoted;
    } else if (quoted) field += char;
    else if (char === delimiter) {
      line.push(field);
      field = "";
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      endLine();
    } else field += char;
  }
  if (quoted) throw new Error("El CSV tiene una celda con comillas sin cerrar.");
  endLine();
  return lines;
}

function parseNumber(text: string) {
  if (!text.trim()) return null;
  let value = text.trim().replace(/[\s\u00A0]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/[−–]/g, "-");
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma > dot) value = value.replace(/\./g, "").replace(",", ".");
  else if (comma !== -1) value = value.replaceAll(",", "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return NaN;
  return Number(value);
}

function parseDate(text: string) {
  const value = text.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return Date.parse(value);
  const yearFirst = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!yearFirst && !dayFirst) return NaN;
  const [, first, month, third, hours = "00", minutes = "00", seconds = "00"] = (yearFirst ?? dayFirst)!;
  const year = yearFirst ? first : third;
  const day = yearFirst ? third : first;
  return inputDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}:${seconds}`);
}

export type ImportRow = { line: number; id: string; key: string; trade: TradeDraft };
export type ImportPreview = { valid: ImportRow[]; invalid: { line: number; reason: string }[] };

function parseDirection(value: string) {
  const normalized = normalize(value);
  if (["buy", "long", "compra", "comprar", "b"].includes(normalized)) return "long";
  if (["sell", "short", "venta", "vender", "s"].includes(normalized)) return "short";
  return undefined;
}

async function keyFor(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function previewImport(text: string, account: Account): Promise<ImportPreview> {
  const [rawHeaders, ...rows] = parseCsv(text);
  if (!rawHeaders || !rows.length) throw new Error("El CSV está vacío o solo contiene encabezados.");
  const headers = rawHeaders.map(normalize);
  const column = (key: keyof typeof aliases) => headers.findIndex((header) => (aliases[key] as readonly string[]).includes(header));
  const columns = Object.fromEntries(Object.keys(aliases).map((key) => [key, column(key as keyof typeof aliases)])) as Record<keyof typeof aliases, number>;
  if (columns.asset < 0 || columns.side < 0 || columns.opened < 0) throw new Error("El CSV necesita encabezados de activo, dirección y fecha de entrada.");
  const mt5Positions = headers.includes("position") && headers.indexOf("time") !== headers.lastIndexOf("time");
  if (mt5Positions) {
    columns.closed = headers.lastIndexOf("time");
    columns.exit = headers.lastIndexOf("price");
  }
  if (columns.closed < 0) throw new Error("Agrega una columna con la fecha de salida. Se importan operaciones cerradas.");
  const valid: ImportRow[] = [];
  const invalid: ImportPreview["invalid"] = [];
  for (let offset = 0; offset < rows.length; offset++) {
    const row = rows[offset];
    const line = offset + 2;
    const get = (key: keyof typeof aliases) => row[columns[key]]?.trim() ?? "";
    const number = (key: keyof typeof aliases) => parseNumber(get(key));
    const cash = (key: keyof typeof aliases) => {
      const value = number(key);
      return value === null ? null : toCents(value);
    };
    const currency = get("currency").toUpperCase();
    if (currency && currency !== account.currency) {
      invalid.push({ line, reason: `La fila tiene moneda ${currency} y la cuenta usa ${account.currency}.` });
      continue;
    }
    const openedAt = parseDate(get("opened"));
    const closedAt = parseDate(get("closed"));
    if (openedAt === null || closedAt === null || !Number.isFinite(openedAt) || !Number.isFinite(closedAt)) {
      invalid.push({ line, reason: "Fecha de entrada o salida vacía o inválida." });
      continue;
    }
    const direction = parseDirection(get("side"));
    if (!direction) {
      invalid.push({ line, reason: "La dirección debe ser compra (buy/long) o venta (sell/short)." });
      continue;
    }
    const gross = cash("gross");
    const fees = cash("fees");
    const net = cash("net") ?? (gross === null ? null : gross - Math.abs(fees ?? 0) + (cash("swap") ?? 0));
    let extra: Partial<TradeDraft> = {};
    if (get("metadata")) {
      try {
        const value = JSON.parse(get("metadata"));
        if (!value || typeof value !== "object") throw Error("metadata");
        extra = { market:value.market, captureLinks: value.captureLinks, before: value.before, during: value.during, after: value.after, grade: value.grade, errors: value.errors, checklist: value.checklist, partials: value.partials, notes: value.notes };
      } catch {
        invalid.push({ line, reason: "Los detalles de la bitácora de esta fila están dañados." });
        continue;
      }
    }
    const parsed = tradeSchema.safeParse({
      market:extra.market,
      captureLinks: { before: get("captureBefore") || extra.captureLinks?.before, after: get("captureAfter") || extra.captureLinks?.after },
      asset: get("asset"), direction, openedAt, closedAt, accountId: account.id, setupId: get("setup") || null,
      entry: number("entry"), exit: number("exit"), stop: number("stop"), target: number("target"),
      size: number("size"), pnlCents: net, feesCents: fees === null ? null : Math.abs(fees), riskCents: cash("risk"), riskPercent: number("riskPercent"),
      before: extra.before ?? null, during: extra.during ?? null, after: extra.after ?? null, grade: extra.grade ?? null,
      errors: extra.errors ?? [], checklist: extra.checklist ?? [], partials: extra.partials ?? [],
      notes: extra.notes ?? (get("comment") ? [{ kind: "text", text: get("comment").slice(0, 2500), checked: false }] : []),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      invalid.push({ line, reason: issue.code === "custom" ? issue.message : "Revisa el campo «" + String(issue.path[0] ?? "") + "»." });
      continue;
    }
    const trade = parsed.data;
    const sourceId = get("sourceId");
    const usableSourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId);
    const brokerId = get("identifier");
    const fingerprint = brokerId
      ? ["broker", brokerId, trade.asset, openedAt, closedAt].join("|")
      : [trade.asset, direction, openedAt, closedAt, trade.entry, trade.exit, trade.size, net].join("|");
    valid.push({ line, id: usableSourceId ? sourceId.toLowerCase() : crypto.randomUUID(), key: await keyFor(fingerprint), trade });
  }
  return { valid, invalid };
}

function csvField(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return /[;"\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

const monetary = (value: number | null) => value === null ? null : value / 100;
export function exportTrades(items: Trade[], journal: Journal) {
  const rows = items.map((trade) => [
    trade.asset, trade.direction, new Date(trade.openedAt).toISOString(), trade.closedAt === null ? null : new Date(trade.closedAt).toISOString(),
    trade.entry, trade.stop, trade.target, trade.exit, trade.size, monetary(trade.pnlCents), monetary(trade.feesCents), monetary(trade.riskCents), trade.riskPercent,
    currencyOf(trade, journal.accounts), resultR(trade), journal.accounts.find((account) => account.id === trade.accountId)?.name,
    journal.setups.find((setup) => setup.id === trade.setupId)?.name, trade.id, trade.setupId,
    trade.notes.map((note) => note.text).join("\n"),
    JSON.stringify({ market:trade.market, captureLinks: trade.captureLinks, before: trade.before, during: trade.during, after: trade.after, grade: trade.grade, errors: trade.errors, checklist: trade.checklist, partials: trade.partials, notes: trade.notes }),
    trade.captureLinks?.before, trade.captureLinks?.after,
  ]);
  return "\uFEFF" + [[...BASE_HEADERS, ...EXTRA_HEADERS], ...rows].map((row) => row.map(csvField).join(";")).join("\r\n");
}

export function csvTemplate(currency: Currency = CURRENCIES[0]) {
  return "\uFEFF" + BASE_HEADERS.join(";") + "\r\n" +
    ["US100", "compra", "2026-11-16 09:31", "2026-11-16 09:49", 25780.5, 25760.5, 25840.5, 25820.5, 1, 100, 2, 50, 0.5, currency].join(";");
}

export function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const downloadCsv = (filename: string, content: string) => downloadFile(filename, content, "text/csv;charset=utf-8");
