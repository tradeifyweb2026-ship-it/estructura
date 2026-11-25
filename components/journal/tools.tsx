"use client";
import {HelpLink} from "./help-center";
import {lazy,Suspense,useState} from "react";
import {drawdownControls} from "@/lib/drawdown";
import {dailyRisk,openRisk,accountRisks} from "@/lib/risk";
import {calculateRisk,calculatePosition,calculateRR,calculateRecovery,calculatePartials,riskPercent,resultMultiple,simpleReturn,drawdownPercent,breakEvenPrice} from "@/lib/calculators.mjs";
import {formatMoney,numberText,rLabel,type Journal,type Trade} from "@/lib/journal";
import {sum,summarize} from "@/lib/stats";
import {Button,Empty,Field,Panel} from "./ui";
import {TradeList} from "./trade-list";

const ScriptsLibrary=lazy(()=>import('./scripts-library'));
export function ToolsHub({draftOwner}:{draftOwner?:string}){
 const [tab,setTab]=useState<'calculators'|'scripts'>('calculators');
 return <><div className="group-buttons" role="group" aria-label="Herramientas privadas"><Button aria-pressed={tab==='calculators'} onClick={()=>setTab('calculators')}>Calculadoras</Button><Button aria-pressed={tab==='scripts'} onClick={()=>setTab('scripts')}>Mis scripts</Button></div>{tab==='calculators'?<Calculators/>:draftOwner?<Suspense fallback={<p role="status">Cargando biblioteca privada…</p>}><ScriptsLibrary key={draftOwner} draftOwner={draftOwner}/></Suspense>:<p>Inicia sesión para usar tu biblioteca privada.</p>}</>;
}

type Kind="risk"|"position"|"rr"|"recovery"|"partials"|"riskPercent"|"multiple"|"return"|"drawdown"|"be";
const specifications: Record<Kind,{label:string;fields:{key:string;label:string}[];hint:string}> = {
 riskPercent:{label:"Riesgo porcentual",fields:[{key:"capital",label:"Capital de referencia"},{key:"risk",label:"Riesgo monetario"}],hint:"Capital y riesgo deben estar expresados en la misma moneda."},
 multiple:{label:"Resultado en R",fields:[{key:"pnl",label:"Resultado neto"},{key:"risk",label:"Riesgo inicial monetario"}],hint:"Usa el riesgo original y el resultado neto de toda la operación."},
 return:{label:"Rentabilidad simple",fields:[{key:"capital",label:"Capital inicial"},{key:"pnl",label:"Resultado neto del periodo"}],hint:"Solo aplicable sin depósitos, retiros ni ajustes durante el periodo."},
 drawdown:{label:"Drawdown porcentual",fields:[{key:"peak",label:"Máximo previo del saldo o patrimonio"},{key:"current",label:"Valor posterior"}],hint:"Usa una serie comparable, sin flujos de capital. Mide la caída entre estos dos puntos, no la máxima caída histórica."},
 be:{label:"Precio teórico de break-even",fields:[{key:"entry",label:"Precio de entrada"},{key:"costs",label:"Costes totales estimados de ida y vuelta"},{key:"point",label:"Valor por unidad de precio y tamaño"},{key:"size",label:"Tamaño de posición"}],hint:"Modelo lineal de una posición completa. No incluye parciales ni deslizamiento; usa costes en la moneda del valor por punto y el paso de precio de tu instrumento."},
 risk:{label:"Riesgo monetario",fields:[{key:"capital",label:"Capital de referencia"},{key:"percent",label:"Riesgo (%)"}],hint:"Resultado en la misma moneda del capital."},
 position:{label:"Tamaño de posición",fields:[{key:"risk",label:"Riesgo monetario"},{key:"distance",label:"Distancia al stop (puntos)"},{key:"point",label:"Valor de un punto por unidad de tamaño"},{key:"step",label:"Incremento mínimo de tamaño"}],hint:"Introduce las especificaciones de tu bróker y convierte el valor del punto a la moneda de tu cuenta. Se redondea hacia abajo. No incluye comisiones ni deslizamiento."},
 rr:{label:"Relación riesgo-beneficio",fields:[{key:"entry",label:"Precio de entrada"},{key:"stop",label:"Stop inicial"},{key:"target",label:"Objetivo"}],hint:"El stop y el objetivo deben estar en el lado correcto de la entrada."},
 recovery:{label:"Recuperación de pérdidas",fields:[{key:"loss",label:"Pérdida previa (%)"}],hint:"Porcentaje de ganancia necesario sobre el capital restante para recuperar el capital inicial."},
 partials:{label:"Cierres parciales",fields:[{key:"percent",label:"Porcentaje inicial cerrado"},{key:"closed",label:"R de esa salida a posición completa"},{key:"remaining",label:"R de la salida del resto a posición completa"}],hint:"Pondera ambas salidas por su porcentaje de la posición original, sin sumar dos veces el parcial. Usa 0 R para una salida teórica a break-even; no incluye costes."}
};
export function Calculators(){
 const [kind,setKind]=useState<Kind>("risk");
 const [values,setValues]=useState<Record<string,string>>({});
 const [direction,setDirection]=useState("long");
 const config=specifications[kind];
 const n=(key:string)=>values[key]?.trim()?Number(values[key]):NaN;
 const value=kind==="risk"?calculateRisk(n("capital"),n("percent")):kind==="position"?calculatePosition(n("risk"),n("distance"),n("point"),n("step")):kind==="rr"?calculateRR(n("entry"),n("stop"),n("target"),direction):kind==="recovery"?calculateRecovery(n("loss")):kind==="riskPercent"?riskPercent(n("capital"),n("risk")):kind==="multiple"?resultMultiple(n("pnl"),n("risk")):kind==="return"?simpleReturn(n("capital"),n("pnl")):kind==="drawdown"?drawdownPercent(n("peak"),n("current")):kind==="be"?breakEvenPrice(n("entry"),direction,n("costs"),n("point"),n("size")):calculatePartials(n("percent"),n("closed"),n("remaining"));
 return <Panel title="Calculadoras de trading" description="Herramientas de planificación. No conectadas al bróker.">
   <div className="calculator-workbench"><nav className="calculator-menu" aria-label="Diez calculadoras">{Object.entries(specifications).map(([key,item])=><Button key={key} aria-pressed={kind===key} onClick={()=>{setKind(key as Kind);setValues({});}}>{item.label}</Button>)}</nav><div className="form-grid v2-tools"><HelpLink topic={({risk:"calc-riesgo",riskPercent:"calc-porcentaje",position:"calc-posicion",rr:"calc-rr",partials:"calc-parciales",multiple:"calc-r",return:"calc-rentabilidad",be:"calc-be",drawdown:"calc-dd",recovery:"calc-recuperacion"} as const)[kind]} label="Fórmula y ejemplo de esta calculadora"/>
    <Field wide label="Calculadora"><select value={kind} onChange={e=>{setKind(e.target.value as Kind);setValues({})}}>{Object.entries(specifications).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}</select></Field>
    {(kind==="rr"||kind==="be")&&<Field label="Dirección"><select value={direction} onChange={e=>setDirection(e.target.value)}><option value="long">Compra</option><option value="short">Venta</option></select></Field>}
    {config.fields.map(field=><Field key={field.key} label={field.label}><input type="number" step="any" value={values[field.key]??""} onChange={e=>setValues({...values,[field.key]:e.target.value})}/></Field>)}
    <div className="v2-result span-all" role="status" aria-live="polite"><small>Resultado</small><strong>{value===null?"—":kind==="rr"?"1:"+numberText(value):["recovery","riskPercent","return","drawdown"].includes(kind)?numberText(value)+" %":kind==="partials"||kind==="multiple"?rLabel(value):kind==="position"||kind==="be"?String(Number(value.toPrecision(12))):numberText(value)}</strong><p>{value===null?"Completa los campos con valores válidos.":kind==="position"&&value===0?"El riesgo disponible no permite el tamaño mínimo indicado.":config.hint}</p></div>
    <Button tone="quiet" onClick={()=>setValues({})}>Limpiar</Button>
   </div></div>
 </Panel>;
}
export function RiskView({journal,trades,today,onDetail,historyComplete}:{historyComplete:boolean;journal:Journal;trades:Trade[];today:string;onDetail:(trade:Trade)=>void}){
 const open=trades.filter(t=>t.closedAt===null);
 const daily=dailyRisk(trades,today,journal.plan.dailyLossR,historyComplete);
 const accountGroups=journal.accounts.map(a=>({account:a,trades:open.filter(t=>t.accountId===a.id)})).filter(g=>g.trades.length);
 const unassigned=open.filter(t=>!journal.accounts.some(a=>a.id===t.accountId));
 const summary=summarize(trades,journal.accounts);
 const perAccount=accountRisks(trades,journal.accounts,today,journal.plan.dailyLossR,historyComplete);
 const reachedAccounts=perAccount.filter(g=>g.daily.status==="reached");
 return <div className="nebula-risk">
  <Panel title="Riesgo diario realizado" description="Resultados realizados hoy en Ecuador, con parciales fechados. No incluye pérdidas flotantes.">
   <dl className="stat-list v2-tools"><div><dt>Resultado realizado {daily.estimated?"estimado por precios":"calculado"}</dt><dd>{daily.total===null?"Sin R calculable":rLabel(daily.total)}{!daily.complete&&" · subtotal incompleto"}</dd></div><div><dt>Operaciones cerradas con R</dt><dd>{daily.closedKnown} / {daily.closedCount}</dd></div><div><dt>Límite del plan</dt><dd>{journal.plan.dailyLossR===null?"Sin configurar":rLabel(-journal.plan.dailyLossR)}</dd></div><div><dt>Estado del límite</dt><dd>{{incomplete:"No evaluable: información incompleta",unconfigured:"Sin límite configurado","no-activity":"Sin resultados realizados hoy",reached:"Límite alcanzado",within:reachedAccounts.length?"Una cuenta alcanzó su límite; revisa el detalle por cuenta":daily.estimated?"Dentro del límite según estimación registrada":"Dentro del límite según R calculado"}[daily.status]}</dd></div><div><dt>Registros sin información suficiente</dt><dd>{daily.missing}{!historyComplete&&" · historial sin completar"}</dd></div></dl>
  </Panel>
  <Panel title="Controles por cuenta" description="Cada cuenta se evalúa por separado, sin compensar sus pérdidas con ganancias de otra cuenta."><div className="v2-tools">{perAccount.map(g=><section key={g.account?.id??"unassigned"}><h3>{g.account?.name??"Sin cuenta"}</h3><dl className="stat-list"><div><dt>Resultado diario / estado</dt><dd>{rLabel(g.daily.total)} · {{incomplete:"Información incompleta",unconfigured:"Sin configurar","no-activity":"Sin resultados hoy",reached:"Límite alcanzado",within:g.daily.estimated?"Estimación dentro del límite":"Dentro del límite calculado"}[g.daily.status]}</dd></div><div><dt>Riesgo simultáneo estimado sobre saldo registrado</dt><dd>{g.simultaneousPercent===null?"No disponible":numberText(g.simultaneousPercent)+" %"} · {{incomplete:"Información incompleta",unconfigured:"Sin límite configurado",reached:"Límite superado",within:"Dentro del límite estimado"}[g.simultaneousStatus]}</dd></div><div><dt>Operaciones por encima del riesgo individual configurado</dt><dd>{g.aboveTradeLimit??"Sin configurar"}</dd></div></dl></section>)}</div></Panel>
  <Panel title="Operaciones abiertas" description="Riesgo inicial y riesgo restante estimado hasta el stop registrado. Exposición en vivo no disponible; no incluye costes ni deslizamiento.">
   <dl className="stat-list v2-tools"><div><dt>Abiertas / con parciales</dt><dd>{open.length} / {open.filter(t=>t.partials.length>0).length}</dd></div>{accountGroups.map(({account,trades})=>{const risk=trades.map(openRisk);const initial=risk.flatMap(r=>r.initialCents??[]);const remaining=risk.flatMap(r=>r.remainingCents??[]);return <div key={account.id}><dt>{account.name} · {initial.length}/{trades.length} con riesgo inicial · {remaining.length}/{trades.length} con riesgo restante estimable</dt><dd>Inicial: {initial.length?formatMoney(sum(initial),account.currency,false):"—"}<br/>Restante: {remaining.length===trades.length?formatMoney(sum(remaining),account.currency,false):"Información incompleta"}</dd></div>})}{unassigned.length>0&&<div><dt>Sin cuenta identificada · exposición no disponible</dt><dd>{unassigned.length}</dd></div>}</dl>
   {open.length?<TradeList rows={open} journal={journal} onDetail={onDetail} compact/>:<Empty title="No hay operaciones abiertas."/>}
  </Panel>
  {journal.accounts.filter(a=>trades.some(t=>t.accountId===a.id)).map(account=>{const model=drawdownControls(account,trades.filter(t=>t.accountId===account.id),today);return <Panel key={account.id} title={"Drawdown y fondeo · "+account.name} description={model.basisLabel+". No incluye pérdidas flotantes ni certifica el cumplimiento real del proveedor."}><div className="v2-tools">{(!model.complete||!historyComplete)&&<p role="alert" className="informative-note">Información insuficiente para certificar límites: {model.missingClosed} cierres y {model.missingRealized} parciales/resultados sin importe o fecha; {model.movements} movimientos de capital.{model.future&&" Hay fechas futuras."} Los movimientos se excluyen de la serie de trading y requieren conciliar la base de capital.</p>}<dl className="stat-list">{[...model.checks,...model.fundingChecks].map(check=><div key={check.key}><dt>{check.label}<small className="table-sub">{check.basis}</small></dt><dd>{check.value===null?"No evaluable":numberText(check.value)+" %"} / {check.limit??"—"} % · {{unconfigured:"Sin configurar",incomplete:"Información incompleta",reached:"Límite alcanzado",within:"Dentro del umbral registrado"}[!historyComplete&&check.limit!==null?"incomplete":check.status]}</dd></div>)}</dl>{account.funding?.company&&<>{model.funding.crossesPhase&&<p role="alert">Hay posiciones que cruzan el inicio de la fase. Concilia su capital y resultados antes de evaluar los límites de fondeo.</p>}<p>Objetivo nominal: {model.funding.targetCents===null?"Sin configurar":formatMoney(model.funding.targetCents,account.currency)} · resultado realizado de fase: {model.funding.profit===null?"No disponible":formatMoney(model.funding.profit,account.currency)}.</p><p>{model.funding.tradingDays} días con entradas registradas / {model.funding.minDays??"—"} mínimos registrados. {model.funding.expired?"La fecha de fin registrada ya pasó.":"Fin registrado: "+(model.funding.endsOn??"Sin definir")}</p><p className="muted">La empresa puede usar equity, otra zona de reinicio, trailing o reglas de consistencia diferentes. Su exposición y estado real no están disponibles.</p></>}</div></Panel>})}
  <Panel title="Caída máxima histórica" description="Sobre la serie de resultados registrados. No incluye pérdidas flotantes."><div className="v2-tools">{summary.drawdown===null?"Sin datos suficientes":!summary.cashComplete||!summary.currency?rLabel(-summary.drawdown):formatMoney(-summary.drawdown,summary.currency)}</div></Panel>
  <Panel title="Configurar límites"><div className="v2-tools"><a className="button" href="#configuracion">Editar plan personal</a></div></Panel>
 </div>;
}

export {HelpCenter as HelpView} from "./help-center";
