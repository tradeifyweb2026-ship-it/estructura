# Entrega progresiva: catálogo, capturas y scripts privados · 22 de noviembre de 2026

**No está terminada toda V2 ni publicada.** Se completan catálogo y biblioteca privada, con correcciones de capturas y pruebas reales. Los prototipos Terminal/R/% no se cuentan como entregados.

Rama exclusiva: `mejoras-v2-2026-11-18`. Inicio de esta ampliación: `69521bea76ce97e5881f81a6b721619cabfcca4d`, descendiente de `404542cbbfa52bbaebfe67cd3644998b554b30ed`. Código completo probado: `ac044966838861dbd9288f16a0a02056c63ad48f`. Evidencia consolidada: `6936c042d7a61b3ce285d222e9a653460712c83a`. Este cierre documental se registra después y no modifica código.

Se conservan las cuatro anomalías antiguas corregidas, diez calculadoras, diez perfiles, paginación/agregados, riesgo, frases, administración, ayuda y todo el historial previo. No se reinicia el proyecto ni se retrocede al HEAD histórico de los adjuntos.

## Entregado y verificado

### Catálogo personal de activos

- Vacío por usuario, sin siembra ni asociación silenciosa. CRUD, nombres/alias normalizados, búsqueda, favoritos y recientes; botón + en el editor conserva el borrador.
- Los símbolos conocidos se proponen para revisión: agrupar no define contratos, cotizaciones ni conversiones monetarias.
- Asociación histórica con vista previa, confirmación y máximo de 20 operaciones por lote; comprueba mercado, revisión y versiones dentro de una transacción. Conflicto: ningún cambio parcial.
- Se añade referencia estable de mercado; se conserva el símbolo original. Precios, tamaños, stops, parciales, moneda, P&L y R permanecen intactos.
- Estadísticas, filtros y reportes agrupan por identificador estable, con nombre visible. Páginas del catálogo vinculadas a revisión; sin duplicados ni listas parciales aceptadas.
- JSON privado del catálogo: todas las páginas, máximo 10.000 activos/10 MB, fallo antes de descargar una copia incompleta. Restauración reanudable/idempotente para registros nuevos o idénticos, sin sobrescribir conflictos ni asociar historia.
- Migración 0014 aditiva, índices/triggers y recuperación/borrado comprobados. El adaptador Sites registra el principal con la política existente antes de usar sus relaciones; pendiente/bloqueado/cerrado no acceden.

### Biblioteca privada de scripts

Herramientas → Mis scripts comparte la ruta de calculadoras y mantiene sus diez herramientas. Permite crear, listar/buscar, abrir, copiar, editar, eliminar, bloquear, recuperar y exportar/restaurar scripts propios.

Código, título y descripción cifrados en el navegador. AES-GCM, clave aleatoria no extraíble tras importarla, PBKDF2 SHA-256 con 600.000 iteraciones y envolturas independientes de clave personal/recuperación. El servidor no recibe las claves ni el texto. Perder ambas credenciales impide abrir el contenido después de bloquear. Recuperar reenvuelve la misma clave de datos; copias antiguas siguen admitiendo su contraseña anterior.

El propietario aceptó expresamente **1.000 líneas en el editor normal**, con la posibilidad de superar ese contador desde un cliente modificado. El servidor verifica realmente bytes, cuotas, propietario y versión: 128 KiB normal/512 KiB propietario de código; presupuesto interno de biblioteca 5 MiB/25 MiB. Cuenta JSON cifrado más 512 bytes por registro. No equivale a facturación D1 ni a un contador de líneas descifradas en servidor.

CodeMirror 6 local y bajo demanda: líneas, resaltado léxico básico original, sangría, búsqueda, deshacer/rehacer, copia y Tab para salir. No compila, ejecuta ni publica Pine. Dependencias MIT fijadas, sin CDN ni corpus de terceros. Campos/borradores privados no se incluyen en reportes ni respuestas administrativas.

Se carga código al abrir o exportar; la búsqueda de nombres/descripciones se descifra en este navegador. Páginas por revisión, CAS de edición y alternativa Guardar como copia nueva; solo última versión. Borradores locales únicamente cifrados y por identidad, con error explícito si el navegador no permite conservarlos. Sobreviven al cierre de sesión; borrar la cuenta elimina su prefijo local y sus tablas propias.

Exportación privada completa, cifrada, hasta 40 MB; no genera archivos parciales. Restauración confirmada y reanudable, omite idénticos y rechaza versiones distintas/bibliotecas mezcladas. Restablecer exige BORRAR BIBLIOTECA y no toca operaciones ni cuentas de trading. Migración 0015 aditiva; el respaldo operacional incluye las dos tablas cifradas y el ensayo recupera/descifra un script con su clave ficticia.

Modelo de confianza: protege datos almacenados sin la clave; requiere navegador, dispositivo y JavaScript confiables. No protege frente a XSS, dispositivo comprometido u operador que sustituya la aplicación servida. No se promete borrado físico de cadenas de memoria ni auditoría criptográfica externa. [Contrato completo](24-scripts-criptografia-y-continuacion-2026-11-22.md).

### Capturas de TradingView

El componente común mantiene validación/enlace original. Una página nunca se interpreta como imagen. Una imagen permitida aparece tras carga/decodificación real; error/espera agotada muestran fallback compacto, sin icono roto ni hueco reservado. Se conserva borrador, quitar enlace y acceso a capturas privadas anteriores.

Editor/detalle comprobados en Chromium, incluido screenshot de fallback desplazado a la zona visible. La integración de ese componente en tarjeta nueva y página pública sigue pendiente de esas fases; no se afirma que la ruta pública exista.

## Pruebas y resultados reales

| Evidencia | Resultado y alcance |
|---|---|
| [Suite local final](verificacion-scripts-2026-11-22/final/resultados.json), `bfef507` | 17 comandos aprobados; un audit separado registra los cuatro moderados dev conocidos, sin ocultarlos. Ninguna prueba final fallida. |
| TypeScript/lint/lógica/matemáticas | Aprobados; lint conserva un aviso de imagen heredado, sin errores. |
| API Sites, restauración y migraciones | Worker compilado con D1/R2 ficticios, CRUD, cuotas, CSRF/aislamiento, JSON/CSV, catálogos y scripts aprobados. Migraciones 0014/0015 locales; no recursos reales. |
| Consultas/secciones | 100/1.000/10.000/20.000 operaciones; páginas, filtros y métricas completas conservadas. |
| Exportaciones | Diez perfiles, cinco contratos, privacidad, vacíos, multimoneda, inyección y 10.000 registros aprobados. |
| Scripts | Nueve grupos criptográficos, siete D1 —incluido llenar con sobres válidos hasta 5 MiB y rechazar exceso sin insertar/alterar consumo— y cinco casos de Enter real de CodeMirror. |
| Seguridad | [70 lecturas y 40 escrituras de estados denegados](verificacion-scripts-2026-11-22/final/access-matrix.json), BOLA/IDOR, administrador aislado, CSRF, bytes, abuso y mantenimiento aprobados. |
| Recuperación | [29 tablas con datos, 80 objetos de esquema y tres blobs](verificacion-scripts-2026-11-22/final/recovery.json); versiones/relaciones/hashes, corrupción rechazada y script cifrado recuperado/descifrado con clave ficticia. No certifica un backup real. |
| Cloudflare con y sin R2 | Ambas compilaciones y suites aisladas aprobadas; scripts no requieren R2. |
| [Chromium 45107587077](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45107587077), `ac044966` | **215 casos**, siete anchos (320, 360, 390, 768, 1024, 1440, 1920), dos temas, formularios/modales/teclado y flujos esenciales. API Sites compilada también aprobada en esta ejecución. |
| Accesibilidad automatizada | 48 análisis base + 4 catálogo + 4 editor: **56 sin infracciones**. No equivale a certificación WCAG universal ni lector/dispositivo físico. |
| [Widgets/CSP reales 45105586029](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45105586029), `550eddce` | Ejecución aprobada; se conserva limitación de proveedor para NAS100. No acredita dominio, Google ni configuración productiva. |
| Dependencias | Producción: cero avisos. Cuatro moderados de desarrollo en Drizzle Kit/esbuild; la solución automática retrocede Kit de 0.31 a 0.18 y no se aplica por incompatibilidad. Nuevas dependencias del editor MIT. |

PNG y resultados de Chromium se conservaron en Git: [manifiesto con hashes](verificacion-scripts-2026-11-22/chromium/manifest.json). El ZIP aprobado se verificó con SHA-256 `19965078e2a1ae1e692fbf54cdf05e9caca55b4b465813a7d48cb874dee07678`. Se inspeccionaron manualmente capturas de 320 px en claro/oscuro; también se preserva muestra del editor a 1440. Datos ficticios, OAuth simulado y recursos desechables: no se certifican servicios reales.

Correcciones obtenidas durante las pruebas, con fallos originales conservados: selectores ambiguos y espera de restauración por animation frame; recarga que competía con history.back del modal; índices únicos antes de insertar al reconstruir SQLite; salto simulado de Enter; nombre accesible del código de recuperación; sincronización que podía sobreescribir texto nuevo con ecos antiguos de React; estado explícito de cambios de CodeMirror para confirmar al cerrar; limpieza de desconexión entre pruebas. La prueba nativa verifica pegado/copia íntegros de 1.001 líneas antes del límite y descifra el registro del propietario para contar sus líneas. No se cambiaron expectativas financieras para hacer pasar pruebas.

## Nueve fases nuevas

| Fase | Estado |
|---|---|
| 01 Inspección | Completada para ejecutar; adjuntos y decisiones revisados. |
| 02 Activos | Implementada y verificada; no repetir. |
| 03 Scripts | Implementada y verificada dentro del alcance y aclaración expresa sobre el conteo de líneas en servidor. |
| 04 Terminal | Prototipos locales avanzados; sin commit ni recorrido nativo de la nueva integración. No entregada todavía. |
| 05 R/%/ambos | Fórmula aprobada y prototipo local probado; integración sin commit. No entregada todavía. |
| 06 Capturas | Editor/detalle completados; tarjeta/página pública pendientes de sus módulos. |
| 07 Snapshot/QR | Pendiente: no ruta pública, token ni QR ficticio. Decisión vigente: 30 días, congelado, mínimo activo/dirección/fecha/estado/R, extras expresos y revocación/borrado reales. |
| 08 UX | Herramientas/Mis scripts, selector, mensajes y ayuda implementados. Separación adicional Compartir/Exportar/Respaldar y refinamientos restantes pendientes. |
| 09 Cierre global | Suites del código entregado aprobadas; faltan nuevas fases y condiciones externas. |

## Estado actualizado de las 25 fases originales

| Fase | Estado vigente |
|---|---|
| 01 Arquitectura | Dominio privado de activos y scripts integrado; adaptador Sites registra la identidad con la política de acceso existente. Configuración externa pendiente. |
| 02 Rendimiento | Paginación/agregados hasta 20.000 conservados; catálogo por revisión, listado cifrado solo de metadatos y código bajo demanda. Consumo real sin medir. |
| 03 Diseño/accesibilidad | Chromium: siete anchos/dos temas, 215 casos y 56 análisis automáticos aprobados. No certifica lectores, dispositivos físicos ni accesibilidad universal. |
| 04 Resumen | Métricas completas existentes preservadas y recorrido aprobado. |
| 05 Bitácora | Catálogo, selector y asociación confirmada añadidos; símbolo original, filtros y páginas preservados. |
| 06 Operaciones | CRUD/parciales/stop conservados; capturas corregidas y borradores comprobados. Tarjeta nueva no entregada aún. |
| 07 Cuentas | Datos/límites existentes preservados; borrado D1/R2 y cascada de catálogos/bibliotecas propias comprobados. |
| 08 Riesgo | Drawdown/fondeo/parciales/riesgo restante existentes preservados; no hay exposición real de bróker. |
| 09 Estadísticas | Agregados completos y agrupación estable por mercado; independientes de la página visible. |
| 10 Psicología | Modelo, filtros y privacidad existentes preservados. |
| 11 Estrategias | Historial/restauración previos preservados; scripts son biblioteca separada, con última versión únicamente. |
| 12 Revisiones | Periodos, notas, historial y conflictos existentes preservados. |
| 13 Mercados | CSP/widgets conservados; prueba real 45105586029 aprobada. Limitación del proveedor para NAS100 y producción siguen documentadas. |
| 14 Herramientas | Diez calculadoras conservadas y probadas. Mis scripts completo y verificado en Herramientas, sin otra sección principal. |
| 15 Configuración | Catálogo, respaldo privado, bloqueo/recuperación de scripts y borrado propio integrados. Datos legales externos pendientes. |
| 16 Importar/exportar | Diez perfiles y formatos conservados; catálogo JSON y scripts cifrados separados. Nuevo Terminal/R/% sin commit; separación adicional de flujos pendiente. |
| 17 Frases | Módulo anterior conservado; derechos de textos heredados siguen pendientes de confirmación. Sin nuevas atribuciones inventadas. |
| 18 Administración | Cuotas/mantenimiento/auditoría previos conservados. Bytes y presupuestos de scripts se aplican por rol en servidor; no se presenta consumo interno como facturación. |
| 19 Autenticación | Protocolos/roles/CSRF/estados y adaptador Sites comprobados con identidades ficticias. Google real sigue sin certificar. |
| 20 Seguridad/legal | Cifrado/aislamiento comprobados dentro de su modelo; cuatro moderados dev conocidos. Retención, derechos y datos legales/configuración reales pendientes. |
| 21 Ayuda | 87 artículos, con tres nuevos de scripts, dos de activos y uno de capturas sobre la base anterior. No se reconstruyó el centro. |
| 22 Datos | Migraciones 0014/0015 aditivas; 29 tablas pobladas y tres blobs recuperados en recursos desechables. Respaldo/reversión/migraciones reales pendientes. |
| 23 Pruebas | Suite local final, Chromium, API y seguridad aprobados por SHA y alcance; Terminal/QR nuevos aún no certificados. |
| 24 Documentación | Informes 23–25, decisiones, commits, matriz, resultados y PNG conservados en V2. |
| 25 Entrega | Avance funcional guardado. NO PUBLICADO y NO APTO PARA PUBLICACIÓN DEFINITIVA mientras falten nuevas fases y condiciones externas. |

## Commits de esta ampliación

Inicio `69521bea76ce97e5881f81a6b721619cabfcca4d`; se conservan todos los ancestros de V2. Diecisiete commits hasta la evidencia `6936c042d7a61b3ce285d222e9a653460712c83a`; este informe, el Plan Maestro y el registro de cierre constituyen un decimoctavo commit documental identificable en el historial y en la respuesta de entrega.

| Commit | Cambio |
|---|---|
| [`7a5366e3`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/7a5366e3802510dfad7aeb189732064247c51c58) | fix(captures): show compact TradingView fallbacks without broken images |
| [`e1563871`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/e156387171e1b77fbffa69dd17a203a3e9ec8c31) | docs(v2): record the approved catalog, encryption, percentage and QR policies |
| [`06a1a68f`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/06a1a68f66d85ad44396f35b79b8e659d8d4b4af) | test(captures): await the draft restoration animation frame before checking fields |
| [`ca630f3b`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/ca630f3b9c82d7a370e0d85a8a8bd3689c975f91) | feat(assets): add a private catalog and confirmed market associations without changing financial data |
| [`2db24e98`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/2db24e98ce985dc18d2dfdbc58b1cfe424b781fd) | test(assets): scope catalog controls to their section instead of its header |
| [`8318f642`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/8318f6429052c71c16dfbd4c49266ad6d2168fc1) | test(assets): distinguish original symbols and journal restoration from new catalog controls |
| [`fb8744f0`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/fb8744f0e9bb05070069c0b70a34656af0269841) | test(assets): identify the original asset field when editing an existing trade |
| [`9e961664`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/9e96166486ff302c2ec252566fbd1c91e04396c3) | fix(assets): register authenticated Sites principals under the existing access policy |
| [`de1fe0d9`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/de1fe0d9e5f5317b440d532e31478e005d7029f1) | feat(scripts): preserve browser encryption and recovery primitives with adversarial tests |
| [`18db41c6`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/18db41c602425f78dcc96496523d1edefbc664ce) | fix(assets): present suggested symbols without asserting financial equivalence |
| [`61e14de6`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/61e14de61aac403d21edea3d14324eed88930a77) | fix(scripts): reject invalid Unicode instead of changing private source text |
| [`36693a83`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/36693a83797b05249c6a5abebbae5e9e77a48991) | feat(scripts): add an encrypted private library, local editor and server-enforced byte quotas |
| [`bfef5071`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/bfef507157bd2ba8dce6a63aa2b1f9ebb4933438) | test(recovery): restore unique indexes before loading composite foreign keys |
| [`550eddce`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/550eddcea458c2f2496079da6c053402c3bcc7e6) | fix(scripts): correct Enter indentation and recovery accessibility; stabilize browser navigation |
| [`1def2e3e`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/1def2e3eaf321f62fd6c6126b379f1eb604f4a36) | fix(scripts): preserve the editor document during React updates and verify real clipboard paste |
| [`ac044966`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/ac044966838861dbd9288f16a0a02056c63ad48f) | fix(scripts): protect CodeMirror changes when closing and isolate offline browser tests |
| [`6936c042`](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/commit/6936c042d7a61b3ce285d222e9a653460712c83a) | docs(scripts): preserve complete local checks and approved Chromium evidence with screenshots |

## Archivos modificados

125 rutas en el comparativo hasta `6936c042d7a61b3ce285d222e9a653460712c83a`: 62 de evidencia y 63 de código/pruebas/configuración/documentos. El cierre añade al comparativo Plan Maestro, este informe y `verificacion-scripts-2026-11-22/cierre.json`, y actualiza el informe 23. [Comparativo de la rama](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/compare/69521bea76ce97e5881f81a6b721619cabfcca4d...mejoras-v2-2026-11-18).

- `.github/workflows/app-browser.yml`
- `app/api/activos/route.ts`
- `app/api/bitacora/route.ts`
- `app/api/scripts/route.ts`
- `app/globals.css`
- `components/journal/account-access.tsx`
- `components/journal/analytics.tsx`
- `components/journal/app.tsx`
- `components/journal/asset-picker.tsx`
- `components/journal/capture-preview.tsx`
- `components/journal/script-code-editor.tsx`
- `components/journal/scripts-library.tsx`
- `components/journal/settings.tsx`
- `components/journal/tools.tsx`
- `components/journal/trade-detail.tsx`
- `components/journal/trade-editor.tsx`
- `components/journal/trade-list.tsx`
- `components/journal/ui.tsx`
- `db/asset-catalog.ts`
- `db/journal-query.ts`
- `db/private-scripts.ts`
- `db/repository.ts`
- `db/schema.ts`
- `db/section-query.ts`
- `documentacion/23-nuevas-fases-v2-2026-11-22.md`
- `documentacion/24-scripts-criptografia-y-continuacion-2026-11-22.md`
- `documentacion/verificacion-scripts-2026-11-22/access-matrix.json`
- `documentacion/verificacion-scripts-2026-11-22/account-erasure.json`
- `documentacion/verificacion-scripts-2026-11-22/advanced.txt`
- `documentacion/verificacion-scripts-2026-11-22/api.txt`
- `documentacion/verificacion-scripts-2026-11-22/app-security.txt`
- `documentacion/verificacion-scripts-2026-11-22/audit-development.txt`
- `documentacion/verificacion-scripts-2026-11-22/audit-production.txt`
- `documentacion/verificacion-scripts-2026-11-22/boundaries.json`
- `documentacion/verificacion-scripts-2026-11-22/browser-initial.txt`
- `documentacion/verificacion-scripts-2026-11-22/build-cloudflare-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/build-cloudflare-without-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/build-site.txt`
- `documentacion/verificacion-scripts-2026-11-22/chromium/accesibilidad.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/activos-accesibilidad.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/capturas-fallback-320-dark.png`
- `documentacion/verificacion-scripts-2026-11-22/chromium/capturas-fallback-320-light.png`
- `documentacion/verificacion-scripts-2026-11-22/chromium/consola.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/limites.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/manifest.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/resultados.json`
- `documentacion/verificacion-scripts-2026-11-22/chromium/script-editor-1440-dark.png`
- `documentacion/verificacion-scripts-2026-11-22/chromium/script-editor-320-dark.png`
- `documentacion/verificacion-scripts-2026-11-22/chromium/script-editor-320-light.png`
- `documentacion/verificacion-scripts-2026-11-22/chromium/scripts-accesibilidad.json`
- `documentacion/verificacion-scripts-2026-11-22/cloudflare-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/cloudflare-without-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/exports.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/access-matrix.json`
- `documentacion/verificacion-scripts-2026-11-22/final/account-erasure.json`
- `documentacion/verificacion-scripts-2026-11-22/final/advanced.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/api.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/app-security.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/audit-development.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/audit-production.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/boundaries.json`
- `documentacion/verificacion-scripts-2026-11-22/final/build-cloudflare-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/build-cloudflare-without-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/build-site.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/cloudflare-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/cloudflare-without-r2.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/exports.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/lint.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/logic.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/operational-recovery.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/queries.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/recovery.json`
- `documentacion/verificacion-scripts-2026-11-22/final/restore.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/resultados.json`
- `documentacion/verificacion-scripts-2026-11-22/final/security-regressions.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/typecheck.txt`
- `documentacion/verificacion-scripts-2026-11-22/final/user-abuse.json`
- `documentacion/verificacion-scripts-2026-11-22/lint.txt`
- `documentacion/verificacion-scripts-2026-11-22/logic.txt`
- `documentacion/verificacion-scripts-2026-11-22/operational-recovery.txt`
- `documentacion/verificacion-scripts-2026-11-22/queries.txt`
- `documentacion/verificacion-scripts-2026-11-22/recovery-followup.txt`
- `documentacion/verificacion-scripts-2026-11-22/recovery.json`
- `documentacion/verificacion-scripts-2026-11-22/restore.txt`
- `documentacion/verificacion-scripts-2026-11-22/resultados.json`
- `documentacion/verificacion-scripts-2026-11-22/security-regressions.txt`
- `documentacion/verificacion-scripts-2026-11-22/typecheck.txt`
- `documentacion/verificacion-scripts-2026-11-22/user-abuse.json`
- `drizzle/0014_asset_catalog.sql`
- `drizzle/0015_private_scripts.sql`
- `drizzle/meta/0014_snapshot.json`
- `drizzle/meta/0015_snapshot.json`
- `drizzle/meta/_journal.json`
- `lib/asset-catalog.ts`
- `lib/csv.ts`
- `lib/domain-user.ts`
- `lib/editor-draft.ts`
- `lib/help-content.ts`
- `lib/journal-query.ts`
- `lib/journal.ts`
- `lib/pine-editor.ts`
- `lib/report-profiles.ts`
- `lib/report.ts`
- `lib/script-crypto.ts`
- `lib/script-protocol.ts`
- `lib/section-models.ts`
- `lib/stats.ts`
- `package-lock.json`
- `package.json`
- `tests/app-asset-interactions.mjs`
- `tests/app-capture-interactions.mjs`
- `tests/app-interactions.mjs`
- `tests/app-script-interactions.mjs`
- `tests/check-access-matrix.mjs`
- `tests/check-account-erasure.mjs`
- `tests/check-api.mjs`
- `tests/check-app-browser.mjs`
- `tests/check-app-security.mjs`
- `tests/check-asset-catalog.mjs`
- `tests/check-cloudflare.mjs`
- `tests/check-migration-upgrade.mjs`
- `tests/check-operational-recovery.mjs`
- `tests/check-private-scripts.mjs`
- `tests/check-script-crypto.mjs`
- `tests/check-script-editor.mjs`

## Interrupción exacta y siguiente continuación

El ejecutor quedó dos veces `unavailable`. En la primera recuperación se archivaron 38 archivos antes de reconciliar cinco commits remotos; objetos/árboles Git comprobados, sin descartar prototipos. La segunda caída ocurrió al ampliar capturas en las tarjetas y devolvió:

`exec-server transport disconnected; failed to resume exec-server session: recovery timed out after 45s`

No se declara recuperado el segundo bloqueo ni conservados/perdidos los archivos locales sin revisarlos. La rama remota funciona y contiene la biblioteca completa y su evidencia. No se certifica como entregado un cambio solo por existir en ese ejecutor.

Al reabrir:

1. Comprobar V2, HEAD y estado; archivar todo cambio local modificado/no seguido **antes de sincronizar**. No usar reset/clean/checkout forzados. El cierre documental remoto puede ser posterior al HEAD local `6936c042`.
2. Reconciliar el cierre sin perder los prototipos. `session-helpers.json` tiene helpers/HEAD de ese punto; verificar primero el HEAD remoto y no utilizar un expected SHA antiguo.
3. Revisar y continuar estos archivos locales, que estaban sin commit: `lib/share-return.ts`, `lib/terminal-card.ts`, `components/journal/trade-share-panel.tsx`, `tests/check-share-return.mjs`, `tests/check-terminal-card.mjs`, `tests/app-terminal-interactions.mjs`; cambios en export-dialog, share.ts, globals.css, help-content, package.json y app-interactions. También hay evidencia anterior de activos sin seguir; conservarla.
4. El prototipo de porcentaje usa neto explícito / capital inicial registrado, sin sumar parciales ni restar costes otra vez; NA sin cuenta/divisa/capital/neto válidos. El SVG tiene temas, estados, tres formatos y curva marcada decorativa. Se probaron 108 variantes y seis PNG con Sharp; **no es prueba de navegador**. La integración separa privacidad de tarjeta/reportes y ajusta conversión PNG a dimensiones intrínsecas. Todo debe verificarse de nuevo al recuperar los archivos.
5. El último comando para añadir enlaces y reutilizar CapturePreview no consiguió iniciar proceso: inspeccionar el contenido real, no asumir ese parche aplicado. También falta verificar la prueba nativa nueva de Terminal y actualizar documentación antes de registrar su módulo.
6. Tras completar/verificar/commitear fases 04/05 y la parte compartible de 06, implementar fase 07: snapshot servidor mínimo, token aleatorio con hash, 30 días, revocación/borrado real y QR integrado que se escanee desde PNG/comprimido. Sin URL pública autorizada, no generar QR falso ni un segundo diseño/tarjeta.
7. Completar UX y cierre de regresiones. No rehacer biblioteca, catálogo, calculadoras, reportes, riesgo ni anomalías antiguas sin error verificable.

## Publicación y bloqueos externos

**NO PUBLICADO / NO APTO PARA PUBLICACIÓN DEFINITIVA.** Faltan las nuevas fases indicadas, además de configuración y presupuesto efectivos de Cloudflare, Google OAuth real, bindings/permisos D1/R2 reales, respaldo recuperable y ensayo de reversión autorizados, datos legales/contacto/retención y derechos/licencias indispensables. No se inventan credenciales, contactos ni certificaciones.

`main` y `version-anterior-2026-11-18` se comprobaron en `913425d042c681d1682bd7df11facda70d26c4d2` y no se modificaron. No se aplicaron migraciones remotas, se alteraron secretos, se contrataron servicios ni se borraron registros reales. El Worker antiguo de los ensayos previos no garantiza escritura compatible de los nuevos metadatos: un rollback requiere copia y versión compatible o congelación de escrituras antes de reabrir.
