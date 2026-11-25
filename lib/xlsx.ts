/**
 * Escritor mínimo de .xlsx sin dependencias: estilos (fuente, relleno, bordes, formatos), celdas combinadas,
 * anchos, panel inmovilizado, filtro, imagen incrustada e impresión. Todo texto se guarda como texto
 * (nunca como fórmula), así que un valor que empiece por =, +, - o @ no se ejecuta en Excel.
 */

export type Side = { style: "thin" | "medium" | "hair"; color: string };
export type Style = {
  font?: { name?: string; size?: number; bold?: boolean; italic?: boolean; color?: string };
  fill?: string;
  border?: { top?: Side; bottom?: Side; left?: Side; right?: Side };
  align?: { h?: "left" | "center" | "right"; v?: "top" | "center" | "bottom"; wrap?: boolean; indent?: number };
  numFmt?: string;
};
export type CellValue = string | number | null | { f: string; v: number };
type Cell = { v: CellValue; s: number };
type Picture = { bytes: Uint8Array; row: number; col: number; width: number; height: number; offsetX: number; offsetY: number; alt: string };

const encoder = new TextEncoder();
const escapeXml = (text: string) => text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();

export function columnName(index: number) {
  let name = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

/** Serie de fecha de Excel para un día «AAAA-MM-DD» (sin hora). */
export function dateSerial(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, date) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

export class Sheet {
  readonly cells = new Map<number, Map<number, Cell>>();
  readonly merges: string[] = [];
  readonly widths = new Map<number, number>();
  readonly heights = new Map<number, number>();
  readonly pictures: Picture[] = [];
  frozenRows = 0;
  filter: [number, number, number, number] | null = null;
  tab = "";
  landscape = true;
  titleRow = 0;
  footer = "";
  readonly name: string;
  private readonly book: Workbook;
  constructor(name: string, book: Workbook) {
    this.name = name;
    this.book = book;
  }

  set(row: number, col: number, value: CellValue, style: Style = {}) {
    const line = this.cells.get(row) ?? new Map<number, Cell>();
    line.set(col, { v: value, s: this.book.styleId(style) });
    this.cells.set(row, line);
    return this;
  }
  /** Aplica un estilo a un rango sin tocar valores ya escritos (para bandas y celdas combinadas). */
  paint(r1: number, c1: number, r2: number, c2: number, style: Style) {
    for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) {
      const existing = this.cells.get(row)?.get(col);
      this.set(row, col, existing?.v ?? null, style);
    }
    return this;
  }
  merge(r1: number, c1: number, r2: number, c2: number) {
    this.merges.push(`${columnName(c1)}${r1}:${columnName(c2)}${r2}`);
    return this;
  }
  width(col: number, chars: number) { this.widths.set(col, chars); return this; }
  height(row: number, points: number) { this.heights.set(row, points); return this; }
  picture(bytes: Uint8Array, row: number, col: number, width: number, height: number, offsetX = 0, offsetY = 0, alt = "") {
    this.pictures.push({ bytes, row, col, width, height, offsetX, offsetY, alt });
    return this;
  }

  xml(index: number, hasDrawing: boolean) {
    const rows = [...new Set([...this.cells.keys(), ...this.heights.keys()])].sort((a, b) => a - b);
    let lastCol = 1, lastRow = 1;
    const body = rows.map((row) => {
      const line = this.cells.get(row) ?? new Map<number, Cell>();
      const cols = [...line.keys()].sort((a, b) => a - b);
      lastRow = Math.max(lastRow, row);
      const ht = this.heights.get(row);
      const cellsXml = cols.map((col) => {
        lastCol = Math.max(lastCol, col);
        const { v, s } = line.get(col)!;
        const ref = `${columnName(col)}${row}`;
        if (v === null) return `<c r="${ref}" s="${s}"/>`;
        if (typeof v === "object") return `<c r="${ref}" s="${s}"><f>${escapeXml(v.f)}</f><v>${Number.isFinite(v.v) ? v.v : 0}</v></c>`;
        if (typeof v === "number") {
          return Number.isFinite(v) ? `<c r="${ref}" s="${s}"><v>${v}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${v > 0 ? "∞" : "—"}</t></is></c>`;
        }
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
      }).join("");
      return `<row r="${row}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cellsXml}</row>`;
    }).join("");
    const widths = [...this.widths].sort((a, b) => a[0] - b[0]).map(([col, width]) => `<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`).join("");
    const pane = this.frozenRows ? `<pane ySplit="${this.frozenRows}" topLeftCell="A${this.frozenRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>` : "";
    const filter = this.filter ? `<autoFilter ref="${columnName(this.filter[1])}${this.filter[0]}:${columnName(this.filter[3])}${this.filter[2]}"/>` : "";
    const merges = this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
    const footer = this.footer ? `<headerFooter><oddFooter>${escapeXml("&L" + this.footer.replace(/&/g, "&&") + "&RPágina &P de &N")}</oddFooter></headerFooter>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheetPr>${this.tab ? `<tabColor rgb="${argb(this.tab)}"/>` : ""}<pageSetUpPr fitToPage="1"/></sheetPr>`
      + `<dimension ref="A1:${columnName(lastCol)}${lastRow}"/>`
      + `<sheetViews><sheetView showGridLines="0" workbookViewId="0"${index === 0 ? ` tabSelected="1"` : ""}>${pane}</sheetView></sheetViews>`
      + `<sheetFormatPr defaultRowHeight="16"/>`
      + (widths ? `<cols>${widths}</cols>` : "")
      + `<sheetData>${body}</sheetData>${filter}${merges}`
      + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>`
      + `<pageSetup paperSize="9" orientation="${this.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>`
      + footer + (hasDrawing ? `<drawing r:id="rId1"/>` : "") + `</worksheet>`;
  }
}

export class Workbook {
  readonly sheets: Sheet[] = [];
  title = "";
  author = "";
  private readonly styles = new Map<string, number>([["{}", 0]]);
  private readonly styleList: Style[] = [{}];

  sheet(name: string) {
    const sheet = new Sheet(name, this);
    this.sheets.push(sheet);
    return sheet;
  }
  styleId(style: Style) {
    const key = JSON.stringify(style);
    const known = this.styles.get(key);
    if (known !== undefined) return known;
    this.styleList.push(style);
    this.styles.set(key, this.styleList.length - 1);
    return this.styleList.length - 1;
  }

  private stylesXml() {
    const fonts: string[] = [], fills: string[] = [], borders: string[] = [], formats: string[] = [];
    const index = (list: string[], xml: string) => { const at = list.indexOf(xml); if (at >= 0) return at; list.push(xml); return list.length - 1; };
    const fontXml = (font: NonNullable<Style["font"]> = {}) => `<font>${font.bold ? "<b/>" : ""}${font.italic ? "<i/>" : ""}<sz val="${font.size ?? 11}"/><color rgb="${argb(font.color ?? "#1b2340")}"/><name val="${escapeXml(font.name ?? "Calibri")}"/><family val="2"/></font>`;
    const side = (tag: string, value?: Side) => value ? `<${tag} style="${value.style}"><color rgb="${argb(value.color)}"/></${tag}>` : `<${tag}/>`;
    index(fonts, fontXml());
    fills.push(`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`);
    borders.push(`<border><left/><right/><top/><bottom/><diagonal/></border>`);
    const xfs = this.styleList.map((style) => {
      const font = index(fonts, fontXml(style.font));
      const fill = style.fill ? index(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(style.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      const border = style.border ? index(borders, `<border>${side("left", style.border.left)}${side("right", style.border.right)}${side("top", style.border.top)}${side("bottom", style.border.bottom)}<diagonal/></border>`) : 0;
      let numFmt = 0;
      if (style.numFmt) {
        const at = formats.indexOf(style.numFmt);
        numFmt = 164 + (at >= 0 ? at : formats.push(style.numFmt) - 1);
      }
      const a = style.align;
      const alignment = a ? `<alignment${a.h ? ` horizontal="${a.h}"` : ""}${a.v ? ` vertical="${a.v}"` : ""}${a.wrap ? ` wrapText="1"` : ""}${a.indent ? ` indent="${a.indent}"` : ""}/>` : "";
      return `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="${numFmt ? 1 : 0}" applyFont="1" applyFill="${fill ? 1 : 0}" applyBorder="${border ? 1 : 0}" applyAlignment="${a ? 1 : 0}">${alignment}</xf>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + (formats.length ? `<numFmts count="${formats.length}">${formats.map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(code)}"/>`).join("")}</numFmts>` : "")
      + `<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders>`
      + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`
      + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }

  build(date = new Date()): Uint8Array {
    const files: { name: string; data: Uint8Array }[] = [];
    const add = (name: string, text: string) => files.push({ name, data: encoder.encode(text) });
    const rel = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
    const head = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    const withDrawing = this.sheets.map((sheet) => sheet.pictures.length > 0);
    let media = 0;

    const types = [
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`, `<Default Extension="xml" ContentType="application/xml"/>`, `<Default Extension="png" ContentType="image/png"/>`,
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`,
      ...this.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
      ...this.sheets.flatMap((_, i) => withDrawing[i] ? [`<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`] : []),
    ].join("");
    add("[Content_Types].xml", `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${types}</Types>`);
    add("_rels/.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel("rId1", "officeDocument", "xl/workbook.xml")}`
      + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>${rel("rId3", "extended-properties", "docProps/app.xml")}</Relationships>`);
    const iso = date.toISOString().replace(/\.\d+Z$/, "Z");
    add("docProps/core.xml", `${head}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
      + `<dc:title>${escapeXml(this.title)}</dc:title><dc:creator>${escapeXml(this.author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`);
    add("docProps/app.xml", `${head}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Bitácora de Trading</Application></Properties>`);

    const names = this.sheets.map((sheet, i) => {
      const titles = sheet.titleRow ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${sheet.name}'!$${sheet.titleRow}:$${sheet.titleRow}</definedName>` : "";
      const filter = sheet.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${sheet.name}'!$${columnName(sheet.filter[1])}$${sheet.filter[0]}:$${columnName(sheet.filter[3])}$${sheet.filter[2]}</definedName>` : "";
      return filter + titles;
    }).join("");
    add("xl/workbook.xml", `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews>`
      + `<sheets>${this.sheets.map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${names ? `<definedNames>${names}</definedNames>` : ""}<calcPr fullCalcOnLoad="1"/></workbook>`);
    add("xl/_rels/workbook.xml.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.sheets.map((_, i) => rel(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)).join("")}${rel(`rId${this.sheets.length + 1}`, "styles", "styles.xml")}</Relationships>`);

    this.sheets.forEach((sheet, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheet.xml(i, withDrawing[i])));
    this.sheets.forEach((sheet, i) => {
      if (!withDrawing[i]) return;
      add(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel("rId1", "drawing", `../drawings/drawing${i + 1}.xml`)}</Relationships>`);
      const rels: string[] = [];
      const anchors = sheet.pictures.map((picture, n) => {
        media++;
        files.push({ name: `xl/media/image${media}.png`, data: picture.bytes });
        rels.push(rel(`rId${n + 1}`, "image", `../media/image${media}.png`));
        const cx = picture.width * 9525, cy = picture.height * 9525;
        return `<xdr:oneCellAnchor><xdr:from><xdr:col>${picture.col}</xdr:col><xdr:colOff>${picture.offsetX * 9525}</xdr:colOff><xdr:row>${picture.row}</xdr:row><xdr:rowOff>${picture.offsetY * 9525}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>`
          + `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${n + 2}" name="Imagen ${n + 1}" descr="${escapeXml(picture.alt)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
          + `<xdr:blipFill><a:blip r:embed="rId${n + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
      });
      add(`xl/drawings/drawing${i + 1}.xml`, `${head}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join("")}</xdr:wsDr>`);
      add(`xl/drawings/_rels/drawing${i + 1}.xml.rels`, `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
    });
    add("xl/styles.xml", this.stylesXml());
    return zip(files, date);
  }
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP sin compresión (método 0). Basta para un .xlsx de unos pocos KB y no necesita librerías. */
export function zip(files: { name: string; data: Uint8Array }[], date = new Date()): Uint8Array {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day = ((Math.max(1980, date.getUTCFullYear()) - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const entries = files.map((file) => ({ ...file, nameBytes: encoder.encode(file.name), crc: crc32(file.data) }));
  const central = entries.reduce((total, entry) => total + 46 + entry.nameBytes.length, 0);
  const local = entries.reduce((total, entry) => total + 30 + entry.nameBytes.length + entry.data.length, 0);
  const out = new Uint8Array(local + central + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];
  for (const entry of entries) {
    offsets.push(at);
    view.setUint32(at, 0x04034b50, true); view.setUint16(at + 4, 20, true); view.setUint16(at + 6, 0x0800, true); view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, time, true); view.setUint16(at + 12, day, true); view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.data.length, true); view.setUint32(at + 22, entry.data.length, true);
    view.setUint16(at + 26, entry.nameBytes.length, true); view.setUint16(at + 28, 0, true);
    out.set(entry.nameBytes, at + 30); out.set(entry.data, at + 30 + entry.nameBytes.length);
    at += 30 + entry.nameBytes.length + entry.data.length;
  }
  const centralStart = at;
  entries.forEach((entry, i) => {
    view.setUint32(at, 0x02014b50, true); view.setUint16(at + 4, 20, true); view.setUint16(at + 6, 20, true); view.setUint16(at + 8, 0x0800, true); view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, time, true); view.setUint16(at + 14, day, true); view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.data.length, true); view.setUint32(at + 24, entry.data.length, true);
    view.setUint16(at + 28, entry.nameBytes.length, true); view.setUint32(at + 42, offsets[i], true);
    out.set(entry.nameBytes, at + 46);
    at += 46 + entry.nameBytes.length;
  });
  view.setUint32(at, 0x06054b50, true); view.setUint16(at + 8, entries.length, true); view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralStart, true); view.setUint32(at + 16, centralStart, true);
  return out;
}
