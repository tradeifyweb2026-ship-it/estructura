import Link from "next/link";
import { LockKeyhole, ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { headers } from "next/headers";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { dayKey } from "../lib/journal";
import { JournalApp } from "../components/journal/app";
import { Brand } from "../components/journal/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, requestHeaders] = await Promise.all([getChatGPTUser(), headers()]);
  const google = requestHeaders.get("x-tradeify-provider") === "google";
  const today = dayKey(new Date().getTime());
  const signInHref = google ? "/entrar" : chatGPTSignInPath("/");
  if (user) return <JournalApp admin={requestHeaders.get("x-tradeify-admin") === "1"} draftOwner={user.userId} marketDefault={requestHeaders.get("x-tradeify-market") ?? undefined} today={today} displayName={user.fullName ?? undefined} signInHref={signInHref} signOutHref={google ? "/salir" : chatGPTSignOutPath("/")}/>;
  return <main className="access-page">
    <div className="access-card">
      <Brand/>
      <div className="access-visual" aria-hidden="true"><ChartNoAxesCombined size={54}/><div/></div>
      <h1>Tu bitácora de trading</h1>
      <ul><li>Registra entradas, salidas y capturas.</li><li>Compara resultados por cuenta y estrategia.</li><li>Revisa tus decisiones cada semana.</li></ul>
      <a href={signInHref} target="_top" className="button button-primary"><LockKeyhole size={17}/>Iniciar sesión con {google ? "Google" : "ChatGPT"} <ArrowRight size={16}/></a>
<details><summary>¿Tradeify opera por mí?</summary><p>No. Registra y analiza tus operaciones; no ejecuta órdenes ni se conecta automáticamente al bróker.</p></details><details><summary>¿Cómo protejo mis datos?</summary><p>Tu acceso es privado. Puedes exportar respaldos, administrar sesiones y eliminar tu cuenta desde Configuración.</p></details>
<p><Link href="/privacidad">Privacidad</Link> · <Link href="/condiciones">Condiciones</Link></p>
    </div>
  </main>;
}
