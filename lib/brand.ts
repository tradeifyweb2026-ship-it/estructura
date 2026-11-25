// Identidad visual única para todo lo que sale de la app (PDF, Excel, CSV, imagen y texto).
// Los colores salen de app/globals.css (tema claro y oscuro) y el logo de public/favicon.svg.

export const BRAND = {
  name: "Bitácora",
  caption: "DE TRADING",
  full: "Bitácora de Trading",
  // Banda de cabecera y tarjeta compartida (tema oscuro de la app)
  deep: "#0c0f1b", navy: "#14192b", navyLine: "#262e47", onNavy: "#f2f3fb", onNavyMuted: "#a9b1ca",
  // Cuerpo de documentos (tema claro de la app)
  ink: "#1b2340", muted: "#53607b", line: "#dee2ed", surface: "#f6f7fc",
  violet: "#6243c4", violetSoft: "#ae9bff", tint: "#ede8fb",
  pos: "#0e7354", posBg: "#d9f5e9", posOnDark: "#70e0b4",
  neg: "#a3314a", negBg: "#fbe6eb", negOnDark: "#ffa0ad",
  amber: "#845218", amberBg: "#faebd3",
} as const;

export type Tone = "pos" | "neg" | "zero";

/** Logo vectorial (igual que public/favicon.svg). */
export function logoSvg(size = 40) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#ae9bff"/><path d="M13 24v13m11-27v25m11-20v20" stroke="#1c1734" stroke-width="2.5" stroke-linecap="round"/><path d="M9.5 25h7v7h-7zm11-9h7v11h-7zm11 5h7v8h-7z" fill="#ae9bff" stroke="#1c1734" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

/** El mismo logo en PNG de 144 px (para incrustarlo en el Excel). */
export const LOGO_PNG_BASE64 = "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";
