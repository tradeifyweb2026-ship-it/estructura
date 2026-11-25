# Continuación Tradeify V2 — paginación, estadísticas completas y riesgo

> Checkpoint histórico. Los perfiles de reportes y su estado de validación se actualizan en [el informe siguiente](18-reportes-v2-2026-11-21.md). Conservar las implementaciones anteriores de paginación y drawdown.

Fecha: 20 de noviembre de 2026 (Ecuador). Inicio obligatorio: `404542cbbfa52bbaebfe67cd3644998b554b30ed`. Rama: `mejoras-v2-2026-11-18`. No se modificó main ni se ejecutaron escrituras/migraciones de producción.

**Entrega progresiva funcional; no lista para publicación.** Se implementan los pendientes prioritarios de consultas/paginación y drawdown registrado. Los flujos nuevos compilan y sus contratos/matemáticas se verifican automáticamente; la validación visual sigue bloqueada. No se vuelven a implementar las cuatro anomalías de la entrega anterior.

## Cambios y commits

| Commit | Módulo |
|---|---|
| `0403b63cf8bb89847d97994ba66171410cbf59bf` | Paginación real, filtros, agregados SQL, revisiones e integración de Resumen/Bitácora/Estadísticas |
| `1691a37cc33849cc12dc37643be84236e1e8c23f` | Drawdown configurable y seguimiento nominal de fondeo |
| `a9804bf245bdc75e3ad66035ffaf83673de2bfc0` | Actualización compatible de drizzle-kit 0.31.10 → 0.31.11 y script test:queries |
| `6158482e91b5744dda4cf46b89639d3d706374ab` | Espera acotada por 429, cancelación y progreso de exportación |

Archivos modificados respecto a `404542c`: 62, incluidos código, pruebas, migración, documentación y evidencia. El HEAD final de documentación se identifica en la respuesta de entrega; no se inserta su propio hash dentro del commit.

## Primera prioridad implementada

### Servidor

- API nueva por modo: `metadata`, `list`, `analytics`, `detail` y `daily-risk`; los contratos anteriores se mantienen para clientes compatibles.
- `metadata` entrega cuentas, setups, plan, revisiones y conteo, con **cero operaciones**. Conserva el activo reciente para Mercados mediante una consulta limitada.
- Bitácora pagina por cursor de `(valor de orden, ID)` con tamaños 1–200. Orden por fecha reciente/antigua, R o duración; los empates se resuelven siempre por ID.
- Filtra cuenta, rango de fechas Ecuador, activo, setup, dirección, emoción, estado, resultado y texto en activo/setup/notas. La búsqueda no interpreta `%`, `_` ni texto como SQL; admite diferencias de acentos en español.
- Estadísticas calculadas en D1 sobre **todos los registros filtrados**: cobertura, dinero, R, factores, expectativa, drawdown, recuperación, duración, rachas, calificación y R:B planificado. Conserva ausencia de resultados, cobertura incompleta y separación de divisas. `Infinity` tiene un contrato explícito para los factores sin pérdidas.
- Distribuciones por setup, activo, dirección, mes, hora, día, cuenta y banda R. Orden diario y resultado tras pérdida consultan el historial de la cuenta, aun si el periodo visible es menor.
- Índices por usuario/fecha de resultado, cuenta/fecha de resultado, cuenta/fecha de cierre y cuenta/apertura. `EXPLAIN QUERY PLAN` comprueba uso del índice de cuenta/periodo.

### Cliente

- Resumen, Bitácora y Estadísticas ya no esperan ni almacenan automáticamente todas las operaciones. La Bitácora consulta solo su página. Las métricas no se calculan sobre esa página.
- Resumen conserva indicadores, curva, calendario y recientes. La curva diaria agregada es la carga inicial; la curva exacta por operación se solicita mediante su control. El calendario consulta el mes y las operaciones del día por páginas.
- Los filtros detallados de Estadísticas consultan agregados nuevos y exportan su conjunto completo. Se conservan las métricas y distribuciones anteriores.
- Se cancelan consultas obsoletas al cambiar filtros o desmontar sus vistas. Un cambio propio reinicia el cursor de Bitácora conservando sus filtros.
- El detalle recupera el registro actual y sus capturas por ID, con aislamiento por usuario. Un registro eliminado no abre datos obsoletos. Se conserva una caché pequeña para el modal; los historiales completos se liberan al abandonar las secciones que los necesitan.

### Concurrencia, exportación y restauración

La migración **0008_query_indexes_revisions.sql** añade `journal_revisions` y triggers para operaciones, cuentas, setups, plan, revisiones y capturas. No reescribe ni borra registros existentes.

Cada lote de lectura obtiene datos y revisión en la misma transacción D1. El cursor está vinculado a usuario, filtros, orden y revisión. Una alta, edición, eliminación o cambio relacionado entre páginas devuelve **409**. La UI pide actualizar y comienza una nueva lectura; no mezcla versiones, no deduplica ocultando pérdidas ni aparenta un snapshot histórico que D1 no conservó.

`readCompleteJournal` solo se llama al exportar/restaurar o entrar en una sección que necesita los registros completos. Recupera todas las páginas del filtro con la revisión fija, detecta duplicados/no avance y **no devuelve resultados parciales**. Ante cambio de revisión, el archivo no se genera. Ante 429 espera Retry-After y reintenta el mismo segmento con un máximo de dos reintentos por segmento. La preparación de exportación informa progreso y permite cancelar. No se desactiva el limitador.

El JSON completo se carga por separado al elegirlo; abrir el reporte de una página nunca convierte esa página en un respaldo completo. Restaurar conserva la lectura íntegra, los recibos y la recuperación de lotes ya implementados. La actualización automática por visibilidad se suspende durante esos flujos para no interrumpirlos.

**Alcance pendiente acotado de rendimiento:** Psicología, Revisión, Cuentas, Estrategias y Riesgo todavía usan una lectura completa bajo demanda para conservar cálculos y funciones previos. No ocurre al entrar en las tres vistas anteriores; convertir esas secciones a modelos agregados/detalles dedicados sigue pendiente. Las páginas aún incluyen los datos del registro, incluidas notas; el detalle es bajo demanda, pero no se ha introducido un tipo de fila con todos los campos privados omitidos. No se certifican costes reales de Cloudflare ni rendimiento visual masivo. El restaurador JSON conserva sus límites previos de 20 MB y 20000 operaciones; no se ha añadido un formato multipartes para cuentas mayores.

## Segunda prioridad implementada

Las cuentas pueden configurar `drawdownBasis` (`realized` o `closed`), `maxDrawdownPercent`, `dailyDrawdownPercent` y `totalLossPercent` en JSON opcional. Los respaldos antiguos siguen siendo válidos.

- **Serie de cierres:** capital inicial + P&L neto de posiciones cerradas. Describe ese historial, sin afirmar saldo flotante real.
- **Serie realizada:** añade parciales con fecha e importe y descuenta esos importes al registrar el cierre final. No suma un parcial dos veces. Distingue el saldo al inicio del día del resultado total de una posición que cerró hoy.
- Drawdown máximo desde máximos sucesivos, drawdown diario desde máximo del día y pérdida total máxima desde el capital inicial. Un cruce histórico no desaparece porque el saldo se recupere más tarde.
- Fondeo evalúa umbrales nominales de pérdida diaria desde el saldo inicial del día y pérdida total desde el capital de fase; usa fechas de fase registradas, objetivo, días con entradas y mejor día/beneficio neto positivo como medida de consistencia. Las posiciones que cruzan el inicio de fase requieren conciliación y no reciben estado favorable.
- Capital sin definir, importes/fechas ausentes, fechas futuras o movimientos que alteran la base impiden certificar un límite. Depósitos/retiros no se cuentan como ganancias de trading. Se muestran las razones.
- Se conservan los controles anteriores de riesgo por operación, simultáneo, stops y parciales. La nueva vista añade alertas por límites alcanzados y explica la base de cálculo.

**Límite externo:** los controles son sobre registros manuales y día Ecuador. No conocen equity, precios, trailing del proveedor ni su horario real de reinicio. No certifican cumplimiento del bróker/empresa, no bloquean órdenes y no inventan una integración. La comparación real con la cuenta de fondeo requiere su definición exacta y datos autorizados.

## Pruebas y evidencia

[resultados.json](verificacion-continuacion-2026-11-20/resultados.json) contiene comandos, códigos de salida, duración de la suite y registros. D1/R2 son desechables y Google está simulado; no hay datos personales reales en las pruebas.

| Verificación | Resultado real |
|---|---|
| npm ci | Aprobado con lock actualizado |
| TypeScript | Aprobado |
| Lint | 0 errores; 1 advertencia preexistente de imagen externa |
| Lógica | 15/15 módulos, incluida nueva matemática de drawdown |
| Consultas | 10000 operaciones; paridad de todos los campos de Summary frente a summarize, cuatro órdenes, fechas/cuentas, filtros, cohortes, índices, exportación completa, 429/cancelación y cambios concurrentes |
| API compilada | Aprobada; modos nuevos, detalles/capturas privados, cursores, entradas hostiles y revisión 409; regresiones anteriores conservadas |
| Restauración/migraciones | Aprobadas; actualización de registros antiguos hasta 0008 sin pérdida ni FK rotas, recibos y carreras anteriores |
| Exportaciones | Aprobadas para formatos existentes; no se declaran creados los perfiles profesionales pendientes |
| Cloudflare | Compilación y pruebas aprobadas con y sin R2; recursos de prueba, OAuth simulado |
| Node 22 | Suite de lógica aprobada en 22.22.0 |
| Dependencias | Producción: 0 avisos. Auditoría completa: salida 1, cuatro moderados de desarrollo; no se oculta el resultado |
| Navegador | Bloqueado: Chromium falla al crear socket con `Operation not permitted`; no se prueba visualmente ningún ancho/tema/flujo en esta sesión |

La suite con 10000 registros incluye su inserción y varias consultas/verificaciones; su tiempo es el de toda la suite local, **no** una promesa de latencia ni de consumo en producción. Los documentos simulados de Mercados tampoco certifican widgets reales.

## Dependencias y CSP

Se investigó la cadena de los cuatro moderados y se aplicó la actualización patch estable `drizzle-kit 0.31.11`. El registro npm sigue declarando `@esbuild-kit/esm-loader`; por esa cadena permanece esbuild antiguo. El aviso original afecta al servidor de desarrollo de esbuild y el mantenedor identifica la corrección desde 0.25.0. No se usó `npm audit fix --force`, una degradación a drizzle-kit 0.18.1 ni un cambio a ORM/Kit release-candidate.

Fuentes primarias consultadas:

- [Advisory del mantenedor esbuild GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99).
- [Releases oficiales de Drizzle](https://github.com/drizzle-team/drizzle-orm/releases).
- [Manifest oficial de drizzle-kit](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-kit/package.json).
- [Metadatos npm consultados](verificacion-continuacion-2026-11-20/registry-drizzle.txt).

Se revisó la CSP actual y su uso en código: mantiene base-uri, object-src, form-action y frame-ancestors, pero **no tiene todavía una script-src completa**. Vinext tiene soporte de nonce; los widgets cargan módulos desde `widgets.tradingview-widget.com` y Fundamentales usa `s3.tradingview.com`. Imponer una allowlist o nonce sin comprobar módulos, iframes y scripts generados podría romperlos. No se cambió la política ni se declara cerrada esta verificación: sigue pendiente un navegador compatible y observación del contenido oficial. No se añadieron comodines permisivos para aparentar compatibilidad.

## Estado actualizado de las 25 fases

| Fase | Avance en esta continuación | Estado / siguiente comprobación |
|---|---|---|
| 1 | Capas de consulta, lectura cliente y UI separadas; contratos anteriores conservados | En pruebas integrales |
| 2 | Paginación real, filtros de servidor, estadísticas SQL completas, revisiones e índices implementados | Automatizado aprobado; optimizar las secciones bajo demanda restantes y medir UI/Cloudflare real |
| 3 | Diseño actual conservado | Navegador bloqueado; pendientes anchos, temas, teclado y lectores |
| 4 | Resumen SQL, curva diaria/por operación bajo demanda y calendario por mes/día | Compila y API probada; recorrido visual pendiente |
| 5 | Bitácora con cursor real y filtros/backend | Servidor probado; recorrido visual pendiente |
| 6 | Editor y anomalías previas conservados | Regresiones aprobadas; interfaz pendiente |
| 7 | Configuración ampliada de drawdown y fase | Matemática/configuración aprobadas; UI pendiente |
| 8 | Drawdown máximo/diario/total y fondeo nominal implementados | Pruebas aprobadas; no equivale a patrimonio real ni reglas externas verificadas |
| 9 | Métricas y distribuciones SQL sobre todo el filtro | Paridad automática aprobada; UI pendiente |
| 10 | Psicología conserva el historial completo bajo demanda | Agregados dedicados y revisión visual pendientes |
| 11 | Restauración histórica anterior conservada | API de regresión aprobada; UI pendiente |
| 12 | Semanal/mensual conservadas | Reportes específicos y lectura dedicada pendientes |
| 13 | Widgets actuales conservados | Pruebas alternativas aprobadas; proveedor/navegador/CSP pendientes |
| 14 | Calculadoras conservadas | Lógica aprobada; UI pendiente |
| 15 | Límites nuevos editables con base explícita | TypeScript aprobado; flujos/preferencias en navegador pendientes |
| 16 | Exportación de todo el filtro y respaldo íntegro separados de la página | Consistencia probada; perfiles, vista previa gráfica y PDF especializado pendientes |
| 17 | Sin cambios de funcionalidad | Categorías, imagen, sincronización y licencia del catálogo pendientes |
| 18 | Cuotas existentes conservadas | Consumo/mantenimiento/alertas administrativos pendientes |
| 19 | Modos API usan la misma autenticación y aislamiento | Simulado aprobado; OAuth real pendiente |
| 20 | Patch estable aplicado; cuatro moderados investigados; CSP revisada | Avisos moderados persisten; CSP y requisitos legales pendientes |
| 21 | Sin cambios en el centro de ayuda | Ampliación temática y navegación pendientes |
| 22 | Migración aditiva 0008, índices y revisión por usuario | D1 local aprobado; backup/migración/recuperación reales pendientes |
| 23 | Suite de 10000 operaciones y matemática de drawdown añadidas | Automatizado aprobado; visual/rendimiento real pendientes |
| 24 | Este informe, contratos, modelo y Plan Maestro actualizados | Documentación de cierre final depende de lo restante |
| 25 | Commits verificables y continuación definida | No terminado; no publicado |

No se certifica ninguna fase integralmente como completada sin sus pruebas obligatorias. La implementación verificada de paginación, agregados y drawdown ya no figura como funcionalidad ausente.

## Punto exacto de continuación

1. **Siguiente módulo: reportes profesionales.** Partir de `lib/report.ts`, que aún usa `kind: periodo|operacion`; añadir perfiles de sección y un modelo compartido por HTML/PDF, XLSX, CSV, PNG y texto, con filtros y privacidad. Aprovechar `readCompleteJournal(query)` para la selección y `queryAnalytics` para cifras completas. Añadir revisión semanal/mensual y vistas previas sin mezclar datos de otras secciones. No se ha decidido que haga falta importar XLSX.
2. Convertir Psicología/Revisión/Cuentas/Estrategias/Riesgo a lecturas dedicadas donde resulte útil; no quitar sus funciones ni usar una página como historial. La base de consultas y revisión ya está disponible.
3. Seguir con frases (categorías, imagen, sincronización/licencia), administración (consumo/mantenimiento/alertas) y ayuda. Se mantienen pendientes, no se duplican las funciones previas.
4. Resolver entorno de navegador para validar 320/360/390/768/1024/1440/1920, temas y flujos esenciales; después cerrar CSP con widgets reales.
5. Antes de publicar: completar requisitos restantes, verificar OAuth/bindings reales, backup recuperable, migraciones, rollback y datos legales. Nada de eso se sustituye con los fixtures locales.

## Publicación

**No publicada.** No se ejecutaron deploys ni migraciones remotas. Se mantienen sin verificar acceso/configuración real Cloudflare, Google OAuth, respaldo D1/R2, rollback e identidad/contacto/retención/licencias. El bloqueo visual y las funciones aún pendientes impiden satisfacer la autorización condicional de lanzamiento.
