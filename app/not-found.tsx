import Link from "next/link";
import {Brand} from "../components/journal/ui";
export default function NotFound(){
 return <main className="access-page"><section className="access-card"><Brand/><h1>No encontramos esta página</h1><p>El enlace puede haber cambiado. Vuelve a tu bitácora para continuar.</p><Link className="button button-primary" href="/">Volver a Tradeify</Link></section></main>;
}
