import { currencyOf, dayKey, formatMoney, numberText, resultR, rLabel } from "./journal.ts";
import { assetGroups, groups, summarize, type Summary } from "./stats.ts";
import { openRisk, accountRisks } from "./risk.ts";
import { drawdownControls } from "./drawdown.ts";
import type { Report, ReportColumn, ReportSection, ReportSource } from "./report.ts";

/** Sections contain sanitized values only. Every output consumes these same cells. */
export function sectionCell(value:string|number|null,column:ReportColumn):string{
 if(value===null)return "—";
 if(typeof value!=="number")return value;
 if(column.type==="money")return formatMoney(value*100,column.currency);
 if(column.type==="percent")return numberText(value*100)+"%";
 if(column.type==="r")return rLabel(value);
 return numberText(value);
}
export function profileContent(report:Report,source:ReportSource,summary:Summary){
 const p=report.profile!,o=report.options,trades=source.trades;
 const add=(title:string,columns:ReportColumn[],rows:ReportSection["rows"],note?:string)=>report.sections.push({title,columns,rows,note});
 const col=(label:string,type:ReportColumn["type"]="text"):ReportColumn=>({label,type});
 const count=(label:string,value:number,detail:string)=>({label,value:String(value),detail,tone:"zero" as const});
 const grouped=(title:string,key:(t:typeof trades[number])=>string)=>add(title,[col("Grupo"),col("Operaciones","number"),col("Con R","number"),col("Resultado R","r")],groups(trades,key).map(g=>[g.label,g.count,g.withR,g.value]));
 const moneyRows=trades.filter(t=>t.closedAt!==null&&t.pnlCents!==null&&source.journal.accounts.some(a=>a.id===t.accountId));
 const estimated=trades.filter(t=>t.closedAt!==null&&resultR(t)!==null&&(t.pnlCents===null||t.riskCents===null)).length;
 report.warnings=[`${summary.rCount}/${summary.closed} cierres con R calculable; ${estimated} calculados por precios (estimación).`,"Los parciales no se vuelven a sumar al P&L neto del cierre."];
 if(summary.cash===null&&o.money)report.warnings.push("No hay total monetario comparable: datos incompletos o monedas diferentes.");
 if(o.money&&trades.some(t=>!source.journal.accounts.some(a=>a.id===t.accountId)))report.warnings.push("Operaciones sin cuenta/divisa confirmada: se omiten de totales y tablas monetarias; sus resultados en R se conservan.");
 if(!trades.length)report.warnings.push("Sin operaciones en la selección.");
 // General distributions are relevant only to summary/statistics/strategy profiles.
 if(!["resumen","estadisticas","estrategias"].includes(p)){report.setups=[];report.assets=[];report.weekdays=[];}
 if(!["resumen","estadisticas","semanal","mensual"].includes(p))report.curve=null;
 if(p==="resumen"){
  add("Cobertura de resultados",[col("Cerradas","number"),col("Abiertas","number"),col("Con R","number"),col("Con importe","number")],[[summary.closed,summary.open,summary.rCount,summary.cashCount]]);
 }else if(p==="bitacora"||p==="operacion"){
  report.kpis=[count("Operaciones seleccionadas",trades.length,`${summary.open} abiertas`),count("Cierres con R",summary.rCount,`${summary.closed} cierres`)];
  add(p==="operacion"?"Detalle de operación":"Registro de operaciones",[col("Fecha","date"),col("Activo"),col("Dirección"),col("Estado"),col("R","r"),...(o.strategies!==false?[col("Estrategia")]:[]),...(o.account!==false?[col("Cuenta")]:[])],report.trades.map(t=>[t.day,t.asset,t.side,t.status,t.r,...(o.strategies!==false?[t.setup]:[]),...(o.account!==false?[t.account]:[])]));
  if(p==="operacion")add("Cierres parciales",[col("Fecha","date"),col("Porción de posición","percent"),...(o.prices!==false?[col("Precio","number")]:[])],trades.flatMap(t=>t.partials.map(f=>[f.at==null?null:dayKey(f.at),f.percent/100,...(o.prices!==false?[f.price]:[])])),"El resultado final incluye los parciales; esta tabla describe las salidas.");
  if(o.notes)add("Notas y emociones",[col("Activo"),col("Emociones"),col("Calificación","number"),col("Errores"),col("Notas")],report.trades.map(t=>[t.asset,t.emotion,t.grade,t.errors,t.note]));
  if(o.captures)add("Enlaces de capturas",[col("Activo"),col("Antes"),col("Después")],report.trades.map(t=>[t.asset,t.captureBefore,t.captureAfter]));
  if(o.prices!==false)add("Precios registrados",[col("Activo"),col("Entrada","number"),col("Stop inicial","number"),col("Objetivo","number"),col("Salida media","number")],report.trades.map(t=>[t.asset,t.entry,t.stop,t.target,t.exit]));
 }else if(p==="estadisticas"){
  add("Distribución por activo",[col("Grupo"),col("Operaciones","number"),col("Con R","number"),col("Resultado R","r")],assetGroups(trades).map(g=>[g.label,g.count,g.withR,g.value]));grouped("Distribución por dirección",t=>t.direction==="long"?"Compra":"Venta");
 }else if(p==="psicologia"){
  const grades=trades.flatMap(t=>t.grade??[]);
  report.kpis=[count("Con emoción previa",trades.filter(t=>t.before).length,"Registros de la selección"),count("Con calificación",grades.length,"Escala de 1 a 5")];
  if(o.notes){grouped("Emoción antes de operar",t=>t.before?.name??"Sin registro");grouped("Emoción posterior",t=>t.after?.name??"Sin registro");add("Errores registrados",[col("Error"),col("Operaciones","number")],[...new Set(trades.flatMap(t=>t.errors))].map(e=>[e,trades.filter(t=>t.errors.includes(e)).length]));}
  else report.warnings.push("Emociones, errores y notas ocultos por privacidad.");
 }else if(p==="cuentas"){
  const selectedAccounts=source.journal.accounts.filter(a=>source.scope?source.scope==="all"||a.id===source.scope:trades.some(t=>t.accountId===a.id));
  const unassigned=trades.filter(t=>!source.journal.accounts.some(a=>a.id===t.accountId));
  report.kpis=[count("Cuentas en selección",selectedAccounts.length+(unassigned.length?1:0),"Sin cuenta se informa por separado; no combina monedas")];
  for(const a of selectedAccounts){
   const s=summarize(trades.filter(t=>t.accountId===a.id),source.journal.accounts,a.currency);
   add(o.account===false?"Cuenta oculta":a.name,[col("Moneda"),col("Cierres","number"),col("Abiertas","number"),col("R","r"),...(o.money?[{label:"P&L neto",type:"money" as const,currency:a.currency}]:[]),...(o.capital&&o.money?[{label:"Capital inicial registrado",type:"money" as const,currency:a.currency}]:[])],[[a.currency,s.closed,s.open,s.totalR,...(o.money?[s.cash===null?null:s.cash/100]:[]),...(o.capital&&o.money?[a.startingBalanceCents/100]:[])]],"Resultado del periodo. No equivale al saldo ni al patrimonio actual.");
  }
  if(unassigned.length){const s=summarize(unassigned,source.journal.accounts,source.assumedCurrency);add("Sin cuenta",[col("Cierres","number"),col("Abiertas","number"),col("R","r")],[[s.closed,s.open,s.totalR]],"Divisa y capital sin confirmar: no se asigna un importe agregado.");}
 }else if(p==="riesgo"){
  const open=trades.filter(t=>t.closedAt===null);
  report.kpis=[count("Posiciones abiertas seleccionadas",open.length,"Exposición estimada desde registros"),count("Sin riesgo restante calculable",open.filter(t=>openRisk(t).remainingR===null).length,"Requieren datos")];
  add("Riesgo restante estimado",[col("Activo"),col("R restante estimado","r"),col("Riesgo inicial","percent")],open.map(t=>[t.asset,openRisk(t).remainingR,t.riskPercent===null?null:t.riskPercent/100]));
  report.warnings.push("La selección por periodo puede excluir posiciones abiertas antes de él. No certifica exposición simultánea, drawdown de cuenta ni cumplimiento de fondeo. Consulta Riesgo con historial completo; sin cotizaciones ni equity del bróker.");
  if(source.completeHistory){
   report.warnings.pop();
   const today=dayKey(source.now),accounts=source.journal.accounts.filter(a=>source.scope==="all"||a.id===source.scope||trades.some(t=>t.accountId===a.id));
   for(const a of accounts){
    const controls=drawdownControls(a,trades.filter(t=>t.accountId===a.id),today);
    add(o.account===false?"Límites de cuenta oculta":"Límites · "+a.name,[col("Control"),col("Límite","percent"),col("Valor registrado","percent"),col("Estado"),col("Base")],[...controls.checks,...controls.fundingChecks].map(c=>[c.label,c.limit===null?null:c.limit/100,c.value===null?null:c.value/100,({within:"Dentro del límite registrado",reached:"Límite alcanzado",incomplete:"Información insuficiente",unconfigured:"Sin configurar"})[c.status],c.basis]));
   }
   const risks=accountRisks(trades,accounts,today,source.journal.plan.dailyLossR,true);
   add("Riesgo simultáneo estimado",[col("Cuenta"),col("Sobre saldo registrado","percent"),col("Estado")],risks.map(g=>[o.account===false?"Oculta":g.account?.name??"Sin cuenta",g.simultaneousPercent===null?null:g.simultaneousPercent/100,g.simultaneousStatus]));
   report.warnings.push("Historial completo de la cuenta seleccionada. Limites sobre registros; no certifica equity, cotizaciones ni reglas del proveedor. Datos faltantes impiden un estado favorable.");
  }
 }else if(p==="estrategias"){
  report.kpis=[count("Estrategias utilizadas",new Set(trades.map(t=>t.setupId)).size,"Incluye operaciones sin estrategia")];
  if(o.strategies!==false)grouped("Resultados por estrategia",t=>source.journal.setups.find(s=>s.id===t.setupId)?.name??"Sin estrategia");
  else report.warnings.push("Nombres de estrategias ocultos.");
 }else{
  grouped(p==="semanal"?"Resultados de la semana por día":"Resultados del mes por día",t=>dayKey(t.closedAt??t.openedAt));
  const review=source.journal.reviews.find(r=>r.week===source.reviewKey&&r.scope===source.scope);
  if(o.notes&&review)add("Reflexión guardada del periodo",[col("Tema"),col("Respuesta")],[["Reglas seguidas",review.followed],["Qué repetir",review.repeat],["Qué cambiar",review.change]]);
  report.warnings.push("Revisión descriptiva de la selección; no incluye borradores ni revisiones privadas de otros periodos.");
 }
 if(o.money&&(p==="bitacora"||p==="operacion"))for(const currency of new Set(moneyRows.map(t=>currencyOf(t,source.journal.accounts)))){
  add("Importes · "+currency,[col("Fecha","date"),col("Activo"),{label:"P&L neto",type:"money",currency},{label:"Comisiones informadas",type:"money",currency}],moneyRows.filter(t=>currencyOf(t,source.journal.accounts)===currency).map(t=>[dayKey(t.closedAt??t.openedAt),t.asset,t.pnlCents===null?null:t.pnlCents/100,t.feesCents===null?null:t.feesCents/100]),"P&L registrado neto; las comisiones no se descuentan nuevamente.");
 }
 const first=report.kpis[0];if(first)report.headline={label:first.label,value:first.value,tone:first.tone};
 // No raw journal or unrelated trade table survives the shared profile model.
 report.trades=[];
}
