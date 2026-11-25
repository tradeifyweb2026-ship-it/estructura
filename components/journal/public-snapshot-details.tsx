import type {PublicSnapshot} from '@/lib/public-share';
/** Full authorized text, including fields that a compact image may truncate. */
export function PublicSnapshotDetails({snapshot:s}:{snapshot:PublicSnapshot}){
 return <dl className="public-trade-details"><dt>Activo</dt><dd>{s.asset}</dd><dt>Dirección</dt><dd>{s.side}</dd><dt>Fecha</dt><dd>{s.date}</dd><dt>Estado</dt><dd>{s.status}</dd><dt>Resultado R</dt><dd>{s.r}</dd>{s.percent&&<><dt>Resultado %</dt><dd>{s.percent} · {s.percentReason}</dd></>}{s.money&&<><dt>Resultado neto autorizado</dt><dd>{s.money}</dd></>}{s.prices?.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{s.setup&&<><dt>Estrategia autorizada</dt><dd>{s.setup}</dd></>}{s.note&&<><dt>Nota autorizada</dt><dd>{s.note}</dd></>}{s.links?.map(([label,url])=><div key={label}><dt>Captura de {label.toLowerCase()}</dt><dd>{url}</dd></div>)}</dl>;
}
