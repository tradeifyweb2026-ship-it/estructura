import type { Metadata } from "next";
import "./globals.css";
import "./obsidian-nebula.css";

export const metadata: Metadata = {
  title: "Bitácora de Trading",
  description: "Bitácora privada para registrar operaciones, revisar resultados y seguir tu disciplina de trading.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A tiny same-origin script must run before paint; script-src self is preserved.
  // eslint-disable-next-line @next/next/no-sync-scripts
  return <html lang="es" suppressHydrationWarning><head><script src="/theme-init.js"/></head><body>{children}</body></html>;
}
