# Pruebas y alcance

## Reportes · 21 de noviembre de 2026

`npm run test:exports` ejecuta las regresiones anteriores y `check-report-profiles.mjs`: diez perfiles, formatos compartidos, privacidad, monedas, grupos sin cuenta, fechas/reflexiones, vacíos, entradas hostiles y 10000 filas. La suite completa y los códigos de salida están en [el registro actual](verificacion-reportes-2026-11-21/resultados.json).

`tests/check-report-browser.mjs` usa Chromium real y el conversor PNG real. El workflow `report-visual.yml` ejecuta en Ubuntu sin credenciales de producción; conserva PDF/capturas/PNG y resultados 14 días. Ver [informe y alcance visual](18-reportes-v2-2026-11-21.md). Esto no certifica flujos autenticados de toda la aplicación, proveedores ni Cloudflare real.

La revisión del 17 de noviembre de 2026 ejecutó estas comprobaciones con datos, correos y claves de prueba. Las escrituras se realizaron en entornos locales controlados.

| Comprobación | Alcance y resultado |
| --- | --- |
| TypeScript | Pasa `npx tsc --noEmit` |
| Compilaciones | Pasan Sites y Cloudflare con/sin R2 |
| `tests/check-api.mjs` | Pasa Worker compilado, D1/R2 desechables, CRUD, aislamiento, versiones, validación, cargas, SQL literal, campos internos, importación y deduplicación, identificadores heredados, planes, revisiones y frases |
| `tests/check-cloudflare.mjs` | Pasa Google simulado, PKCE/state, correo del dueño, email sin verificar, cookies, revocación, expiración, cabeceras, origen y 429 con Retry-After |
| `tests/check-capture-failures.mjs` | Pasa handler real con fallos simulados para confirmar que la limpieza conserva capturas cuando el resultado D1 es incierto |
| `tests/check-export.mjs` | Pasa privacidad del reporte, CSV, escapado HTML, XLSX, SVG y JSON |
| Migraciones | Wrangler aplica 0000, 0001 y 0002 localmente; una segunda ejecución encuentra cero pendientes |
| Empaquetado | Pasa `wrangler deploy --dry-run` con/sin R2 |
| Dependencias | Análisis completo con cuatro avisos moderados en una cadena de desarrollo; cero críticos/altos. Inventario npm con `--omit=dev`, cero avisos |
| Lint | La auditoría de seguridad reprodujo cinco errores y cinco advertencias preexistentes. La entrega UX conserva los cinco errores y elimina dos imports sin uso. El detalle actualizado está en UX_INFORME.md |
| Navegador | En la revisión UX posterior se usa Chrome mediante la vista local: seis secciones en ocho anchos CSS, modales, zoom 200%, orientación, fallos de red y 201 registros ficticios. Safari/Firefox, teléfono y teclado virtual reales, impresión final y accesibilidad/rendimiento exhaustivos siguen pendientes |

`check-api.mjs` requiere `npm run build` previo y simula la identidad que entrega Sites. `check-cloudflare.mjs` requiere `npm run build:cloudflare` y simula las respuestas de Google. Estas pruebas no confirman el inicio de sesión real en la cuenta de producción. Los comandos, la evidencia de los fallos reproducidos y la cobertura se detallan en [SEGURIDAD_INFORME.md](../SEGURIDAD_INFORME.md).

La prueba visual usa un visor de tamaños CSS y datos locales, sin modificar registros de producción. Los recorridos, medidas antes/después, capturas y límites del entorno están en [UX_INFORME.md](../UX_INFORME.md). El visor de apoyo no se incluye en public ni en los paquetes compilados.

## Implementado

Trades abiertos/cerrados, parciales, cuentas/setups, emociones/notas/checklist, métricas, curva desde cero, calendario, revisión semanal, CSV, capturas privadas y temas. No modifica operaciones de bróker.

## Límites y futuras mejoras

- El API pagina con cursor de 200 operaciones y la UI presenta el primer bloque mientras completa el historial en segundo plano. La memoria del navegador sigue creciendo con el historial; falta agregación estadística en servidor y pruebas masivas de carga.
- Sin conexión automática MT5/Myfxbook.
- Sin IA, push, PWA offline o enlaces públicos para compartir trades.
- Sin colaboración entre cuentas ni auditoría histórica. Los límites Cloudflare son por IP/ubicación; D1 controla las cuotas por usuario. La prueba de carga distribuida queda pendiente.
- Sin respaldo integral automático; CSV no incluye imágenes/configuración/revisiones.
- D1/R2 pueden necesitar limpieza de huérfanos tras fallos.
- Sin conversión de divisas o cálculo de dinero por punto.
- El perfil Google verifica sesiones en D1; Sites depende de su plataforma. Sus configuraciones reales necesitan revisión en el proveedor.
- Workers Builds está conectado a main. El resultado del despliegue debe verificarse en su log o en los checks que comunique la integración.

Los puntos anteriores permanecen pendientes según su alcance. La revisión de capacidad y acceso de la cuenta real requiere el entorno definitivo. Las licencias de terceros se conservan junto a fuentes y recursos; la procedencia y los permisos de reproducción de las frases siguen pendientes de documentación.

### Consumo por persona
La migración user_limits protege cada inserción, incluso concurrente o por CSV. El límite predeterminado es 5.000 operaciones, 100 cuentas y 200 estrategias. Editar registros no consume cupo. Las notas conservan hasta 30 bloques de 2.500 caracteres. En la muestra ficticia, 29 operaciones ocuparon aproximadamente 863 bytes de JSON cada una. Excluye índices y sobrecarga SQLite. Paginación pendiente: filtrar por cuenta y periodo en el servidor, usar cursor de fecha e id y devolver estadísticas agregadas sin enviar notas.

La integración Cloudflare usa un proveedor de correo falso y Google simulado. Comprueba expiración, rechazo tras cinco intentos, consumo de un solo uso, correo incorrecto, sesión activa y separación de identificadores. Entrega de correo real y configuración de la consola de Google: no verificado.

check-markets prueba la selección del símbolo, carga única y rechazo por fallo del módulo con un documento simulado. La apariencia y datos de terceros en navegadores reales siguen pendientes.

La carga del historial usa páginas de servidor de 200 operaciones ordenadas por apertura e identificador. La interfaz conserva el conjunto recibido para estadísticas y exportaciones completas. Todavía puede consumir memoria proporcional al historial. El cálculo agregado en servidor y la lectura de notas bajo demanda quedan como optimizaciones futuras.

La integración ampliada comprueba dos identidades Google, bloqueo con conservación de datos, cookie revocada, vencimiento, suspensión, renovación, rechazo de administración a una cuenta normal y cabecera falsa, protección del propietario, CSRF, auditoría y los modos aprobación/cerrado con autorización previa. El correo está rechazado con 410. La paginación de historial usa cursor de fecha e id para evitar el desplazamiento de páginas al añadir operaciones nuevas. Cambios concurrentes en fechas de operaciones durante la lectura no constituyen una instantánea transaccional del historial.

No verificado: acceso real con Google en varios dispositivos, aspecto del panel administrativo en teléfonos reales, datos de TradingView y rutas españolas de los widgets. El acceso a proveedores reales necesita la intervención del propietario. La configuración actual de Google y los secretos activos del panel no se inspeccionaron.

Corrección de acceso al panel: se reprodujo un 401 al abrir /administracion con una sesión válida del propietario. La comprobación final del Worker ahora conserva la autorización administrativa ya verificada. La regresión exige respuesta 200 y el contenido del panel para el propietario, 403 para un usuario normal y 401 para visitantes y cabeceras administrativas falsas.

## Revisión de pantallas y ventanas
TypeScript, lint, compilaciones Sites/Cloudflare e integración se ejecutan sobre datos ficticios. check-status-pages.mjs comprueba estados, escapado de identidad, ausencia de cabeceras personales en la respuesta, códigos HTTP, errores JSON y validación de borradores. check-cloudflare comprueba el contenido de la pantalla de aprobación, el acceso del propietario al panel y las restricciones de usuarios normales. Se mantiene el aislamiento D1 y los limitadores.

En Chrome local se revisaron la lista administrativa y las reglas con datos ficticios, los valores ya guardados de aprobación/15 días, la suspensión existente, el resumen antes de confirmar, la pantalla de aprobación y la recuperación de precio/emoción/fecha de un borrador después de recargar. No se ejecutaron cambios administrativos sobre usuarios reales. A 390×844 píxeles CSS se comprobó el listado móvil y una ficha de ancho 390 y alto 844. Es una revisión con iframe de tamaño fijo, no un teléfono ni teclado virtual real. Las capturas de documentacion/ui-evidencias contienen exclusivamente ejemplos ficticios.

Las rutas y archivos temporales de QA se retiraron antes de las compilaciones finales y no forman parte de la entrega. Siguen sin comprobarse Safari/iOS, TalkBack/VoiceOver, el teclado virtual y una revisión exhaustiva de contrastes. En esa revisión base los borradores requerían pulsar Guardar borrador. V2 incorpora autoguardado en la pestaña y protección del borrador previo. La apariencia de las pantallas de rechazo sigue el modo claro/oscuro del sistema. Las páginas privadas conservan el selector de tema de la aplicación.

Resultado de cierre de esta entrega: pasan TypeScript, lint (cero errores y una advertencia por la vista previa img externa), ambas compilaciones y todos los scripts de tests. La prueba administrativa exige que el enlace esté dentro de shell y que no aparezca para usuarios normales aunque envíen una cabecera falsa. El registro cerrado admite a identidades existentes autorizadas y rechaza altas no invitadas. La cuenta y la duración de acceso siguen protegidas por el servidor.


## Estado de la rama V2 · 18 de noviembre de 2026

Los resultados históricos de la revisión base del 17 de noviembre se conservan arriba y no certifican la rama de desarrollo. La rama `mejoras-v2-2026-11-18` está aislada de `main` y de `version-anterior-2026-11-18`.

En V2 se añadieron: carga progresiva del historial, reconciliación local de operaciones durante la carga, metadatos de capturas limitados a cada página mediante subconsulta D1, protección de exportaciones agregadas hasta completar el historial, cobertura de muestras monetarias/R en resúmenes y reportes, historial de hasta 20 versiones por estrategia, paginación de sesiones administrativas, fechas de creación/último envío de invitaciones y filtros de actividad por fecha. También se añadieron pruebas puras y se ampliaron las pruebas Miniflare para restauración, paginación y administración. La prueba API añade 205 operaciones de fixture para verificar 200 en la primera página y 26 en la siguiente, con sus capturas.

**Estado histórico al 18 de noviembre:** no se habían ejecutado `npm run typecheck`, `npm run test:logic`, compilaciones, lint, `tests/check-api.mjs` ni `tests/check-cloudflare.mjs` sobre el commit actual. Se revisó de forma aislada la lógica de dos helpers nuevos y se simuló la sintaxis SQL de paginación/filtros en SQLite, pero eso no sustituye pruebas TypeScript, D1/Miniflare ni navegador. GitHub no reporta checks para el commit actual y no hay ejecuciones de Actions asociadas.

No se aplicaron migraciones, no se integró en `main` y no se publicó en Cloudflare. La versión anterior permanece intacta. Consulta [Versiones y reversión segura](14-versiones-y-reversion.md).

## Verificación V2 del 20 de noviembre de 2026

El [informe actual](16-cierre-v2-2026-11-20.md) y [resultados.json](verificacion-2026-11-20/resultados.json) distinguen comprobaciones locales, configuración de prueba y bloqueos de producción. Los resultados de fechas anteriores se conservan como historial.

La suite pura incluye sintaxis de todos los JS/MJS, fórmulas, cobertura financiera, riesgo diario y por cuenta, reconciliación local, planificación de restauración y acceso. `test:restore` usa D1 desechable y fuerza una modificación entre lectura y escritura: debe rechazar el lote entero y no crear recibo. También actualiza una base con registros previos desde las migraciones 0000–0005 a 0006–0007 y verifica conservación de datos, versiones y claves foráneas.

La prueba API amplía la cobertura con recibos concurrentes, pérdida de respuesta después de commit, reutilización hostil del requestId, duplicados, conflictos, lotes que exceden cuota, reintento tras error, planes y revisiones históricas. Cloudflare amplía las comprobaciones con cuotas individuales y ciclos de invitación en el mismo milisegundo. Google se simula; no certifica OAuth real.

La revisión visual de esta entrega está bloqueada: Chromium local no pudo iniciarse por restricciones de sockets y el navegador remoto no pudo acceder al servidor localhost. No se atribuyen a esta entrega las capturas históricas ni se afirma que se hayan probado móvil, tablet, contraste, teclado, lectores de pantalla o TradingView real. Los 25 estados del Plan Maestro se mantienen en pruebas.

## Continuación posterior al checkpoint 15

La [evidencia vigente](verificacion-continuacion-2026-11-20/resultados.json) corresponde a los módulos de consultas y drawdown. Incluye `test:queries` con 10000 registros y 15 módulos puros. Se preservan las suites de la entrega anterior y se amplían API/Cloudflare y migración a 0008. No equivale a una prueba visual o un coste medido en la cuenta Cloudflare real. Chromium volvió a fallar por sockets no permitidos; las dimensiones, temas, modales y teclado siguen sin certificación nueva.


## Suite integral de aplicación V2

`npm run test:queries` incluye las cinco secciones y tamaños 100/1.000/10.000/20.000. `npm run test:advanced` comprueba frases, concurrencia, recuperación, migración sin repeticiones, mantenimiento/alertas y ayuda. `npm run test:app-security` requiere una compilación Cloudflare local y valida roles, CSRF, cuotas, mantenimiento reversible, biblioteca y borrado de cuenta con OAuth/D1/R2 ficticios.

`npm run test:app-browser` se ejecuta mediante [app-browser.yml](../.github/workflows/app-browser.yml), con Chromium y un servidor HTTPS efímero de prueba. Verifica siete anchos y ambos temas, acciones reales, foco/teclado, reportes y descargas, voz/PNG y administración. Axe-core, ya presente en las herramientas de desarrollo, analiza 48 combinaciones de sección/tema/tamaño; no se certifican lectores de pantalla ni dispositivos físicos. Los widgets y Google externos están expresamente simulados.

Cada caso de la matriz representa un cliente ficticio distinto para no confundir cientos de capturas de prueba con el límite 429 de un único cliente. Los límites reales siguen habilitados y tienen una suite específica. Las excepciones y mensajes de consola, incluidas fallas de red deliberadas o de proveedores simulados, se registran por separado.

`node scripts/check-release-local.mjs` reproduce en orden tipos, lint, lógica, D1, restauración, reportes, sitio/API y Cloudflare con/sin R2. No desplegar ni usar credenciales de producción para estas pruebas. [Resultados y alcance vigentes](19-modulos-v2-2026-11-22.md).
