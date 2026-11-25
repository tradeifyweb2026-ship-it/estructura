"use client";
import Link from "next/link";
import {Brand,Button} from "../components/journal/ui";
export default function ErrorPage({reset}:{reset:()=>void}){
 return <main className="access-page"><section className="access-card"><Brand/><h1>No pudimos abrir esta pantalla</h1><p>Inténtalo otra vez. Tus registros guardados siguen en tu cuenta.</p><Button tone="primary" onClick={reset}>Reintentar</Button><Link className="button" href="/">Volver al inicio</Link></section></main>;
}
