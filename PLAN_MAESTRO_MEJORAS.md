# Plan maestro Tradeify V2

## Checkpoint 17 — perfiles de reportes · 21 de noviembre de 2026

Inicio `2828c1dbda14b7e83ec88c9c246fd9aa935cffc9`. F04/05/06/07/08/09/10/11/12/15/16: implementados diez perfiles tipados con secciones sanitizadas compartidas por PDF/HTML, XLSX, CSV, PNG y texto; integración contextual, vista previa aislada, capital privado opcional y reflexión de revisión limitada al periodo/cuenta. Se conservan exportaciones anteriores y respaldos privados separados. Corrección multimoneda de totales CSV/XLSX. Pruebas de diez perfiles y 10000 registros añadidas.

F03/23: runner Chromium en GitHub Actions autorizado y ejecutado. La primera ejecución detectó desbordamiento real a 320 px; se corrigieron cabecera/cuadrícula y se conservó la misma aserción. Consultar resultado final y evidencia en el [informe vigente con las 25 fases](documentacion/18-reportes-v2-2026-11-21.md). No equivale a validar flujos autenticados de toda la app. Publicación pendiente.

Las cinco secciones con historial bajo demanda, frases, administración y ayuda no se han modificado en este checkpoint. Se mantienen sus pendientes específicos. Siguiente punto: completar validación integral del diálogo de reportes y optimizar lecturas dedicadas. Los checkpoints anteriores se conservan como historial.

Base: 913425d042c681d1682bd7df11facda70d26c4d2. Rama de respaldo: version-anterior-2026-11-18. No desplegar ni integrar main sin autorización.

| Fase | Alcance | Prioridad | Estado |
|---|---|---|---|
| 1 | Auditoría y preparación | Alta | En pruebas |
| 2 | Rendimiento y arquitectura | Alta | En pruebas |
| 3 | Sistema visual y accesibilidad | Media | En pruebas |
| 4 | Resumen | Alta | En pruebas |
| 5 | Bitácora | Alta | En pruebas |
| 6 | Editor y gestión de trades | Alta | En pruebas |
| 7 | Cuentas y movimientos | Media | En pruebas |
| 8 | Gestión de riesgo | Media | En pruebas |
| 9 | Estadísticas | Alta | En pruebas |
| 10 | Psicología | Media | En pruebas |
| 11 | Estrategias | Media | En pruebas |
| 12 | Revisión | Media | En pruebas |
| 13 | Mercados | Media | En pruebas |
| 14 | Calculadoras | Media | En pruebas |
| 15 | Configuración | Media | En pruebas |
| 16 | Exportar e importar | Alta | En pruebas |
| 17 | Frases diarias | Media | En pruebas |
| 18 | Administración | Alta | En pruebas |
| 19 | Autenticación | Media | En pruebas |
| 20 | Seguridad y privacidad | Alta | En pruebas |
| 21 | Ayuda | Media | En pruebas |
| 22 | Base de datos | Alta | En pruebas |
| 23 | Pruebas | Alta | En pruebas |
| 24 | Documentación | Media | En pruebas |
| 25 | Control y entrega | Media | En pruebas |

Criterio de cierre: evidencia de código y pruebas; sin ejecución verificable, marcar en pruebas. Migraciones solamente aditivas y no publicar producción. Conservar datos y funcionalidades.

## Checkpoint 2
- F02/F22: las páginas siguientes consultan operaciones y metadatos de capturas asociados a esas operaciones; no repiten cuentas, setups, plan ni revisiones. Todavía se carga todo el historial progresivamente para mantener exactitud; falta agregar estadísticas en servidor y paginar la UI de bitácora de forma independiente.
- F03/F07/F08/F11/F14/F15/F21: rutas independientes Cuentas, Riesgo, Estrategias, Calculadoras y Ayuda; menú móvil Más. Cuentas y estrategias reutilizan el CRUD existente; faltan flujos, fondeo y versionado. Riesgo inicial, no exposición viva. Calculadoras: 15 casos de lógica evaluados en aislamiento. Falta integración de navegador.
- F04/F09/F10: moneda uniforme por calendario, exportación de setup, etiquetas de calificación subjetiva. Pendiente auditoría estadística completa.
- F23: no se pudo clonar el repositorio ni instalar dependencias en entorno local por ausencia de resolución DNS. No se ejecutaron build, lint ni integración. Se incluyen pruebas reproducibles para calculadoras.
- F25: no modificar main ni desplegar Cloudflare. No se aplicaron migraciones.

## Checkpoint 3 — editor, riesgo, revisión y mercados
- F06: metadatos opcionales JSON para stop actual, fecha de cambio, fecha y P&L de cada parcial; se conserva stop inicial. Capturas vía enlace en editor. Autoguardado de borrador de sesión con protección de borrador previo; limpieza al cerrar sesión mediante enlaces de la app. No incluye historial de todos los cambios del stop ni ejecución real.
- F08: estimación de R por precio de parciales y stop registrado, separada de estadísticas cerradas. Sin cotización actual ni garantía de ejecución. 7 casos de lógica parcial evaluados en aislamiento.
- F12: borradores de revisión semanal separados por identidad/semana/cuenta y comparación con semana previa. Falta revisión mensual persistida, exportación específica y prueba de navegador.
- F13: persistencia local de símbolo, temporalidad y pestaña, lista personalizada de hasta 12 símbolos; no se modifican atributos de widgets ni se promete soporte de intervalos nuevos. Persistencia por dispositivo, no sincronización de cuenta.
- F22: sin migraciones SQL; campos opcionales en JSON. La versión anterior puede leer registros, pero al editar con su esquema puede descartar metadatos nuevos; exportar respaldo privado antes de bajar de versión después de usar V2.
- F23: 7 casos aislados de parciales y script reproducible. Compilación, lint, API, seguridad, navegador y Cloudflare siguen sin ejecutarse.

## Checkpoint 4 — cuentas y estrategias
- F07: campos opcionales bróker, plataforma, fecha, estado, observaciones, tipos adicionales, condiciones manuales de fondeo. Hasta 100 movimientos por cuenta en JSON, con ID, fecha, importe y nota. Saldo estimado, sin doble cómputo de parciales cerrados, no mezcla divisas. Rentabilidad simple solo sin flujos y con datos monetarios completos. Bloqueo de cambios de moneda si la cuenta tiene movimientos existentes. 8 casos matemáticos aislados.
- F11: activos, temporalidades, sesiones, reglas de riesgo, ejemplos, duplicación de estrategias y rendimiento básico. Snapshot de estrategia generado en servidor para operaciones nuevas o reasignadas, se preserva en ediciones. Historial anterior no se retroatribuye; falta catálogo histórico de versiones y comparación avanzada.
- F22: sin migración SQL; nuevos campos se guardan en JSON. La versión estable puede perder estos campos al editar; los nuevos tipos tampoco se pueden editar con el esquema anterior. Respaldo de datos obligatorio antes de revertir después de usar V2. No hay ejecución en producción.
- F23: tests/check-account-totals.mjs con 8 casos reproducibles. No ejecutados build/lint/API/UI; la prueba aislada de la función sí se realizó.

## Checkpoint 5 — exportaciones y restauración
- F16: controles para ocultar cuenta, estrategias, precios y capturas; vista previa de texto y PNG 1:1, 4:5 y 9:16 mediante ajuste sin recorte; XLSX bajo demanda. PDF sigue usando impresión del navegador; faltan reportes específicos y vista previa gráfica. Archivos privados no se someten a los controles de compartir.
- F16/F22: restauración JSON formato 1 con validación previa, relaciones, omisión de registros idénticos y rechazo de conflictos. Inserciones por lotes de hasta 10, limitadas por las cuotas existentes; cada lote es independiente, los anteriores permanecen si uno falla. No reemplaza ni borra. No restaura imágenes físicas ni claves de deduplicación CSV, por lo que reimportar el CSV original puede crear duplicados con IDs diferentes. No importa identidad, permisos ni sesiones. Límite de archivo 20 MB. Pendiente prueba real de D1 y navegador, optimización de restore para historiales grandes y soporte de otros formatos.
- F23: 6 pruebas aisladas de comparación de datos ejecutadas, script reproducible. Build/lint/API no ejecutados. No publicar main.

## Checkpoint 6 — administración, acceso y seguridad
- F18: contadores globales, filtros de actividad por actor/destino y acción, paginación de eventos e invitaciones, revocación de invitación independiente de permisos de cuenta. Invitaciones vencidas no autorizan nuevos registros; no reactivan usuarios bloqueados/suspendidos. Fecha de administración Ecuador. Límite de cuerpo 16 KiB. Datos internos de eventos no se devuelven; nuevas acciones de revocación no registran el hash de sesión. No se añadió migración. Pendientes: consumo de cuotas, mantenimiento y límites individuales. La paginación de sesiones se incorporó en el checkpoint 11 y las fechas de invitaciones en el checkpoint 13.
- F19/F20: estado efectivo unificado, estado desconocido falla cerrado; cierre global de sesiones y eliminación también limpian borradores locales del usuario. HSTS para modo Cloudflare y permisos del navegador restringidos. CSP script-src no se aplicó por falta de verificación de compatibilidad con Vinext y TradingView. Google sigue como único acceso público.
- F20: privacidad/condiciones más claras, contacto desde TRADEIFY_SUPPORT_EMAIL existente; propietario debe confirmar contacto e identidad legal, retención y revisión jurídica. No se presupone cumplimiento legal. No se hizo auditoría de dependencias/secretos ni prueba externa de penetración.
- F23: 10 casos aislados de estados de acceso aprobados; se amplió check-cloudflare.mjs, no ejecutado. Build/lint/API/browser pendientes. No se modificó producción.

## Checkpoint 7 — estadísticas, psicología y revisión mensual
- F09: filtros por activo/dirección/setup con exportación; distribución R, orden diario de entrada por cuenta, rendimiento por cuenta, factor de recuperación, duración, tasas de pérdida y BE. Factor y caída en R compartidos con reportes; se conserva factor monetario por unidad.
- F10: frecuencia emocional, resultado asociado a errores, comparación con riesgo habitual actual; no inferir causalidad.
- F12: revisión mensual persistente mediante clave month:AAAA-MM en columna week existente; comparación anterior e historial. Sin migración, versión anterior no reconoce claves mensuales.
- F02: actualización de día Ecuador sin recarga completa. Sigue pendiente paginación real de UI/agregación servidor.
- F23: 16 casos aislados de estadísticas y meses aprobados. Pruebas API ampliadas, no ejecutadas. Compilación/lint/navegador pendientes.

## Checkpoint 7b — frases diarias
- F17: frase asignada idempotente por usuario y día, reintentos recuperan la misma frase. Aviso por sesión de pestaña; otro dispositivo puede mostrarla el mismo día. Horario mínimo Ecuador (solo con app abierta), favoritas e historial por navegador y usuario, 100 de cada uno. Créditos marcados no verificados, no se inventaron autores. Pendiente categorías, compartir imagen, sincronización y limpieza de favoritos al borrar cuenta.
- F23: check-api.mjs actualizado para comprobar dos solicitudes concurrentes devuelven el mismo ID. No ejecutado; D1, navegador, compilación pendientes. Sin migraciones.

## Checkpoint 8 — estabilización y rendimiento incremental
- F02: alta/edición devuelve el registro persistido con versión y snapshot; UI actualiza solo ese registro o elimina la fila/capturas correspondientes. Las recargas obsoletas se cancelan, se conserva reconciliación al volver a la pestaña. Todavía no hay agregación estadística ni filtros/paginación UI en servidor.
- F04: escala de curva por fecha de cierre opcional, con selección de punto por búsqueda binaria y origen de resultados cero (no saldo inicial).
- F05: página se reinicia al cambiar cuenta/periodo. F06: evita autoguardado en paralelo con guardar y conserva borrador si falla.
- F16: confirmación de CSV privado sin filtros; restauración valida vínculos de cuenta/setup en servidor y limita todas las consultas al usuario.
- F23: test:logic agrupa ocho módulos de lógica pura y typecheck verifica TS; se agregó caso de respuesta de guardado en test API. No se ejecutó build ni pruebas API: la red del entorno no resuelve GitHub ni npm. No hay publicación ni migración.

## Checkpoint 8b — calculadoras y pruebas de restauración
- F14: añadidos riesgo porcentual, R realizado, rentabilidad simple, caída porcentual entre dos valores y precio teórico break-even con costes. Total diez calculadoras. 17 casos adicionales evaluados de manera aislada (79 acumulados); tolerancia 1e-9 para aritmética de coma flotante. No incluyen operaciones de bróker o pruebas de interfaz.
- F16/F23: prueba API añadida para restaurar con vínculos ajenos (rechazo), restauración válida, reintento idéntico y conflicto sin reemplazo. No ejecutada debido al bloqueo de compilación. La versión V2 permanece aislada.

## Checkpoint 9 — integridad de agregados monetarios
- F04/F09/F23: se detectó que el resumen podía sumar únicamente las operaciones con P&L disponible y presentar ese subtotal como si fuera el total; también podía escoger una sola moneda ignorando operaciones cerradas de otra moneda sin P&L. Ahora el P&L monetario, expectativa, factor y curva en dinero solo se habilitan cuando todos los cierres del filtro tienen resultado monetario y comparten una moneda. Si la cobertura es parcial se informa cuántos registros tienen P&L y se evita totalizar. La curva y calendario dejan de sugerir una serie monetaria incompleta.
- F09: las métricas en R siguen indicando su muestra calculable; el factor y drawdown globales se eligen solo de una serie completa en dinero o R. Se mantiene la posibilidad de consultar estadísticas por muestra R donde la interfaz muestra su cobertura.
- F23: agregado módulo puro y casos para cobertura completa, parcial, multi-moneda y sin operaciones. No se ejecutó compilación ni test:logic por limitación del entorno remoto; verificar localmente antes de integrar.

- F09/F23: cobertura de R visible en profit factor, drawdown, recuperación y ratio de ganancias/pérdidas; el factor general deja de etiquetar como R una muestra que no puede calcularse.

## Checkpoint 10 — carga progresiva y reconciliación local
- F02/F05/F23: la bitácora muestra el primer bloque (200) al recibirlo y continúa cargando páginas en segundo plano; la interfaz informa que las métricas todavía son provisionales y avisa si falla la continuación. La paginación API sigue basada en cursor de fecha/ID. La carga incremental conserva actualizaciones locales y evita reinsertar operaciones eliminadas mientras termina la descarga. Guardar/editar/eliminar una operación ya cargada actualiza el estado local sin abortar ni reiniciar el historial.
- F23: helper puro de merge/upsert/delete y merge de capturas con ocho casos para deduplicación, preservar la versión local, omitir eliminados, ordenar y reconciliar capturas. No se ejecutó build, typecheck ni test:logic de repo por falta de entorno de ejecución conectado.

## Checkpoint 11 — administración: sesiones y actividad
- F18/F23: sesiones activas ahora se consultan por páginas de 50 y muestran el total del usuario seleccionado; se evita el límite silencioso de 100 sesiones. Se conserva la revocación individual y global, siempre acotada al user_id.
- F18: actividad administrativa admite rango Desde/Hasta interpretado en hora de Ecuador, además de búsqueda por usuario/administrador y tipo de acción; el total y la lista usan los mismos filtros.
- No se alteró el esquema D1. No se ejecutaron pruebas D1, build ni typecheck; verificar SQL y UI en Miniflare antes de integrar.

- F18/F23: `tests/check-cloudflare.mjs` ampliado con pruebas Miniflare para 55 sesiones (páginas de 50 y 5) y filtro de eventos por rango de fechas. La prueba está escrita, pero no ejecutada en este entorno.

- F09/F16: los reportes HTML/PDF, Excel, CSV y texto muestran la cobertura de muestra R en factor, expectativa y drawdown. La curva y el calendario muestran cobertura cuando se usa R; no se presenta una muestra parcial como historial completo.

- F04/F09: se completa la cobertura visible de R también en la expectativa, drawdown, curva, calendario, revisión y KPI de resultado acumulado.

- F23: afinados los contratos JSDoc genéricos de los helpers nuevos para conservar los tipos de moneda y de Trade al importar desde TypeScript. El typecheck real sigue pendiente.

- F23: el helper de reconciliación declara explícitamente las tuplas de Map para conservar el tipo genérico de Trade en TypeScript.

- F02/F16: mientras se carga o queda incompleto el historial, se bloquean las exportaciones agregadas y las alertas de límite diario para no generar reportes o avisos basados en una muestra parcial. Compartir una operación individual sigue disponible.

- F16: la tarjeta PNG también incluye el detalle abreviado de cada KPI, de modo que la cobertura de muestra no se pierde al compartir una imagen.

## Checkpoint 12 — capturas vinculadas a páginas
- F02/F06: la primera respuesta de bitácora ya no descarga metadatos de todas las capturas del usuario; solo consulta las capturas asociadas a las 200 operaciones visibles. Cada página posterior trae las capturas de sus operaciones y la UI combina por trade/slot sin duplicar, actualizando revisiones.
- Se mantiene el aislamiento por user_id en la consulta de adjuntos. No se descargan objetos R2 ni imágenes; solo metadatos de revisión. Se añade prueba pura de merge de capturas, integrada en check-journal-pages (8 casos en ese módulo).
- F23: prueba D1/Worker para la respuesta paginada no ejecutada; requiere build y Miniflare. No hay migración.

- F02: la selección de metadatos de capturas usa una subconsulta de IDs de la página dentro del mismo lote D1, evitando una segunda ida de red y evitando leer todos los adjuntos del usuario.

- F23: `tests/check-api.mjs` ampliado con 205 trades de fixture para comprobar que la primera página devuelve 200 registros y solo sus capturas, y que la página por cursor devuelve las 26 restantes con sus metadatos. La prueba está escrita, pendiente de ejecución con Worker/D1/R2 compilados.

- F09/F23: `tests/check-api.mjs` incorpora regresiones para P&L incompleto y cuentas USD/EUR mezcladas: no debe devolver subtotal monetario, expectativa monetaria ni moneda combinada. Pendiente ejecutar el Worker compilado.

- F02/F06: el plan de lectura de capturas se actualizó para reflejar que cada página incluye únicamente los metadatos de sus propias operaciones, en el mismo lote D1.

## Checkpoint 13 — fechas de invitaciones
- F18: el listado de invitaciones muestra fecha inicial y último envío a partir de los eventos administrativos persistidos. El cálculo reinicia el ciclo después de una revocación, por lo que no confunde una autorización nueva con una anterior. Los registros históricos sin evento muestran fecha no registrada; no se inventa una fecha.
- No requiere migración D1. `check-cloudflare.mjs` incluye prueba de creación y renovación conservando fecha inicial y actualizando último envío; pendiente ejecutar en Miniflare.

- F18/F23: el corte de ciclos de invitación usa el orden de inserción (rowid) del registro de revocación, no solo milisegundos de reloj; así una invitación creada inmediatamente después de revocar no hereda la fecha del ciclo anterior.

- F18/F23: se documentan las fechas de invitación derivadas de auditoría; las fechas históricas sin evento permanecen explícitamente desconocidas.

## Checkpoint 14 — historial de estrategias
- F11/F16/F23: cada cambio real en un setup guarda una instantánea de la versión anterior (hasta 20), con fecha, reglas, activos, temporalidades, sesiones, color y gestión de riesgo. El historial es de solo lectura en el editor; las operaciones conservan su setupSnapshot original. La API ignora versiones enviadas por el cliente y conserva la historia del servidor.
- No requiere migración SQL: el historial es un campo JSON opcional compatible con registros antiguos. La versión anterior puede descartarlo al editar; la reversión después de usar V2 requiere respaldo JSON.
- tests/check-api.mjs incluye actualización, protección frente a historial manipulado por el cliente y preservación del snapshot de un trade. Pendiente ejecutar Worker/D1 y typecheck.

- F11/F24: documentación de snapshots de estrategias añadida al modelo de datos, README e índice de documentación.

- F12/F23: se corrigió una cadena sin comillas en el guardado de revisiones que impedía compilar analytics.tsx. El typecheck general sigue pendiente; revisar el resto de archivos modificados antes de integrar.

- F11/F14: el historial de setups está limitado a 20 snapshots por estrategia y se almacena en JSON; no se creó una tabla ni migración nueva.

## Checkpoint 15 — correcciones y validación automatizada · 20 de noviembre de 2026

Rama: `mejoras-v2-2026-11-18`. Inicio: `c95398c66414aef8ea843d95b6b464d16e47d871`. Código verificado: `f4933f4a930453f1d3cc08126f1566f7b18ba5eb` (precedido por `fc5965853f544b06e46a0841d93af644ecff4daa` y `566ae61164149552cb5002af5387a8f7007cbb33`). Fecha local Ecuador. Todos los checkpoints anteriores se conservan.

El encargo vigente autoriza desarrollar y publicar solamente si se satisfacen TODOS sus requisitos. Sustituye las restricciones antiguas de falta de autorización; no elimina las condiciones de pruebas, integridad y recuperación. En esta entrega no se cumplen todas las condiciones y no hay publicación ni cambios en main.

Las cuatro anomalías se corrigieron en código con regresiones aprobadas. Se añadieron restauración histórica de estrategias, límites por cuenta y cuotas administrativas individuales. Se corrigen errores de TypeScript/lint y se reduce la recarga del historial tras guardar metadatos. La revisión de fases que sigue es trazable a código/documentación/pruebas; no certifica comportamiento integral sin las pruebas indicadas.

| Fase | Alcance | Implementado / corregido | Evidencia ejecutada | Pendiente / limitación | Estado |
|---|---|---|---|---|---|
| 1 | Arquitectura y preparación | Módulos separados de restauración, riesgo y reconciliación; imports JS válidos. | TypeScript, lint y compilaciones aprobados. | Revisión integral de arquitectura y comportamiento real de todos los módulos aún no certificada. | En pruebas |
| 2 | Rendimiento y arquitectura | Páginas API de 200 existentes; actualizaciones locales de trades, cuentas, setups, planes y revisiones; protege respuestas iniciales obsoletas. | API paginada y pruebas de reconciliación aprobadas. | Faltan agregados y filtros por cuenta/periodo en servidor, UI paginada independiente, notas bajo demanda y carga masiva. Se sigue completando el historial y no existe snapshot transaccional entre páginas. | En pruebas |
| 3 | Sistema visual y accesibilidad | Se conserva el sistema visual, formularios, navegación y componentes actuales. | Compila; revisión visual nueva bloqueada. | Escritorio/móvil/tablet, temas, teclado, lectores y contraste requieren navegador accesible. Las capturas anteriores no certifican estos cambios. | En pruebas |
| 4 | Resumen | Advertencia diaria comparte evaluación con Riesgo; informa cobertura incompleta y cuentas que alcanzaron límite. Calendario/curva existentes. | Cálculos y cobertura financiera aprobados. | Recorrido visual y actualización real de calendario/curva pendientes. | En pruebas |
| 5 | Bitácora | Búsqueda, filtros, orden y vistas existentes; merge sin reinsertar eliminados ni sus capturas. | Paginación API y helpers aprobados. | Paginación visual todavía local sobre historial; revisar búsquedas/acciones rápidas en navegador. | En pruebas |
| 6 | Editor y gestión de trades | Stops, parciales, notas, enlaces y borradores existentes; cero negativo y desbordamientos normalizados. | Parciales, BE long/short, esquema, CRUD y capturas aprobados. | Autoguardado, recuperación y formularios completos no recorridos visualmente en esta entrega. | En pruebas |
| 7 | Cuentas y movimientos | Flujos y condiciones manuales existentes; límites por cuenta añadidos; persistencia local de respuesta del servidor. | Matemática de cuentas, divisas y migración aprobadas. | Verificar editor, movimientos y fondeo en dispositivos; las condiciones externas no se validan contra el bróker. | En pruebas |
| 8 | Gestión de riesgo | Datos incompletos fallan cerrado; R calculado/estimado, parciales fechados, riesgo restante, límites diarios/por operación/simultáneos por cuenta. | Pruebas deterministas de cobertura, BE, parciales y cuentas aprobadas. | Falta completar controles configurables de drawdown según política de fondeo, y revisión visual. Sin exposición viva ni bloqueo de órdenes. | En pruebas |
| 9 | Estadísticas | Se auditan resultados, tasas, factor, expectativa, R, drawdown, recuperación, rachas y cobertura; no se totaliza dinero incompleto/multimoneda. | Suite financiera y regresiones API aprobadas. | Verificación integral de todas las visualizaciones y escalabilidad pendiente. | En pruebas |
| 10 | Psicología | Emociones, intensidad, checklist, errores y asociaciones descriptivas existentes; corregido tipo de errores. | TypeScript y funciones estadísticas aprobados. | Evolución/calidad/sobreoperación y cohortes requieren revisión funcional y visual adicional; no se afirma causalidad. | En pruebas |
| 11 | Estrategias | Nueva restauración histórica por servidor con versión actual, límite de 20 y snapshots de trades preservados. | API valida restauración, conflicto, versión inexistente e IDOR. | Botón/historial no probados en navegador; comparación visual avanzada sigue pendiente. | En pruebas |
| 12 | Revisión | Revisiones semanales/mensuales, borradores, comparación e historial existentes; guardar no recarga trades. | Persistencia API y restauración de revisión mensual aprobadas. | Exportaciones especializadas y recorrido de borradores/impresión pendientes. | En pruebas |
| 13 | Mercados | 11 módulos de widgets, preferencias y carga diferida existentes conservados. | Prueba de módulos, carga única, fallo/reintento y símbolos aprobada con DOM simulado. | TradingView, datos externos, calendario/noticias y adaptación móvil reales no verificados. | En pruebas |
| 14 | Calculadoras | Diez calculadoras existentes conservadas; regresiones de extremos, precisión, long/short y BE. | 32 casos de calculadoras más parciales/finanzas aprobados. | Validación de unidades y experiencia de formularios en navegador pendiente. | En pruebas |
| 15 | Configuración | Plan, apariencia, cuentas, exportación y privacidad existentes; nuevos límites individuales por cuenta. Hora de Ecuador documentada. | Esquema y guardados API aprobados. | Revisar todas las preferencias/perfil/sesiones en UI; no se añade selector global de zona horaria. | En pruebas |
| 16 | Exportar e importar | Restauración con vista previa detallada, recibos, atomicidad por lote, conflictos, retry e informe descargable. CSV y reportes XLSX/PNG/PDF por impresión existentes. | D1/API y exportaciones/privacidad aprobadas. | No hay lector de importación XLSX ni vista previa gráfica completa/reportes especializados; falta UI y archivo máximo de 20 MB. JSON no incluye blobs R2 ni importKey CSV. | En pruebas |
| 17 | Frases diarias | Asignación diaria existente y favoritos/historial locales; limpieza de datos locales al borrar cuenta añadida. | Concurrencia de frase cubierta por API; cambio de limpieza compila. | Categorías, imagen compartida y sincronización de favoritos/historial siguen sin implementar; TTS/sonido requieren prueba real y procedencia/licencia del catálogo pendiente. | En pruebas |
| 18 | Administración | Cuotas individuales aplicadas en D1; uso visible, auditoría, protección del propietario y corrección de ciclos de invitación con mismo milisegundo. | Cloudflare simulado: permisos, cuotas, sesiones 50+5, fechas y origen aprobados. | Mantenimiento/consumo detallado de recursos y revisión visual del panel pendientes. | En pruebas |
| 19 | Autenticación | Google, sesiones revocables y estados de acceso existentes conservados; correo sigue desactivado. | PKCE, cookies, revocación, vencimiento y roles aprobados con Google simulado. | OAuth real, consolas/configuración y acceso con identidades de prueba reales no verificados. | En pruebas |
| 20 | Seguridad y privacidad | Aislamiento por usuario, CSRF, validación, cuotas, snapshots y limpieza de recibos/locales al eliminar cuenta. | Regresiones de API/Cloudflare/exports aprobadas; audit producción sin avisos. | Auditoría completa retorna 4 moderados de herramientas; CSP script-src completa, revisión exhaustiva y datos legales/retención/contacto reales siguen pendientes. | En pruebas |
| 21 | Ayuda | FAQ existente y documentación ampliada para restauración, riesgo, cuotas y recuperación. | Documentación contrastada con contratos y pruebas. | Centro de ayuda en aplicación no ampliado a todos los temas solicitados ni recorrido en navegador. | En pruebas |
| 22 | Base de datos | Migraciones aditivas 0006/0007; snapshots/recibos transaccionales y referencias protegidas. | Upgrade con datos previos y claves foráneas aprobado en D1 local. | Respaldo D1/R2 de producción, migraciones reales y ensayo de recuperación pendientes. No se ejecutaron migraciones remotas. | En pruebas |
| 23 | Pruebas | 14 módulos de lógica, nuevas suites D1, API extendida y Cloudflare con/sin R2. Node 22.22.0 y Node 24.22.3. | 17/18 comandos del registro salen 0; audit-all sale 1 por 4 moderados. | Interfaz, rendimiento masivo, proveedores reales y seguridad exhaustiva siguen pendientes; no se desactivó ninguna prueba. | En pruebas |
| 24 | Documentación | README, datos, API, operación, pruebas, administración, estrategias, reversión, informe y Plan Maestro actualizados. | Registros de comandos y resultados incluidos; historial anterior conservado. | Completar documentos finales al resolver funciones, pruebas y bloqueos restantes. | En pruebas |
| 25 | Control y entrega | Cambios registrados en V2 y preparación de paquete por dry-run; main intacta. | Compilaciones y empaquetado local aprobados. | No terminado ni publicado: requisitos pendientes, UI bloqueada, credenciales/bindings/OAuth/backup/rollback y requisitos legales no verificados. | En pruebas |

Evidencia: [resultados de comandos](documentacion/verificacion-2026-11-20/resultados.json) e [informe](documentacion/16-cierre-v2-2026-11-20.md). `npm ci` aprobado. Compilaciones Cloudflare con identificador/bucket de fixture únicamente; el build sin configuración real falla explícitamente y se documenta. `npm audit --omit=dev`: cero avisos; auditoría completa: cuatro moderados en la cadena de drizzle-kit. No se degrada una dependencia ni se fuerza un override para esconderlos.

Estado final: **25 áreas revisadas; 0 fases certificadas integralmente como completadas**. Las tres funciones nuevas están verificadas en servidor/lógica, con UI pendiente. Persisten funciones solicitadas sin implementar y bloqueos obligatorios. No se considera el proyecto terminado.

## Checkpoint 16 — paginación real y drawdown · 20 de noviembre de 2026

Inicio: `404542cbbfa52bbaebfe67cd3644998b554b30ed`. Rama V2. Código por módulos: `0403b63cf8bb89847d97994ba66171410cbf59bf` (consultas/UI), `1691a37cc33849cc12dc37643be84236e1e8c23f` (drawdown/fondeo), `a9804bf245bdc75e3ad66035ffaf83673de2bfc0` (Kit 0.31.11). Seguimiento de exportación: `6158482e91b5744dda4cf46b89639d3d706374ab`. Se conserva todo el historial anterior.

- F02/F04/F05/F09: implementados filtros y búsqueda SQL, cursor vinculado a usuario/filtros/revisión, cuatro órdenes, índices y agregados completos. Resumen, Bitácora y Estadísticas dejan de cargar todo el historial al entrar; mantienen indicadores, distribuciones y curvas. Calendario y detalles se consultan bajo demanda.
- F02/F16/F22: migración aditiva 0008 con revisión por usuario y triggers. Los cambios entre páginas producen 409 y reinicio de lectura. Exportación/restauración completas usan una revisión fija y nunca devuelven una colección parcial. Reintentos acotados por 429, progreso y cancelación en preparación de exportación. Psicología/Revisión/Cuentas/Estrategias/Riesgo siguen leyendo el historial completo solo al abrir esas secciones; su optimización dedicada permanece pendiente.
- F07/F08: implementados drawdown máximo/diario/total configurables con base en cierres o saldo realizado con parciales fechados. Seguimiento nominal de fondeo por fase, objetivo, entradas por día y consistencia. Datos ausentes, movimientos de capital, fechas futuras o posiciones que cruzan la fase impiden un estado favorable. Sin equity ni conexión de bróker.
- F20: investigados los cuatro avisos moderados; actualización patch compatible de Kit a 0.31.11 sin degradar ORM. La cadena antigua de desarrollo permanece y la auditoría completa sigue saliendo 1. Producción sin avisos. CSP revisada en código; no se impuso script-src sin poder verificar los widgets reales.
- F23: 10000 operaciones en D1 desechable verifican paridad de métricas, filtros, cuatro órdenes, cohortes, índices, exportación íntegra, 429/cancelación y concurrencia. 15/15 módulos de lógica. API, migración desde datos previos, exportaciones y Cloudflare con/sin R2 aprobados. Node 22.22.0 aprobado.
- F03/F13/F25: nuevo intento de Chromium falla con `socket() failed: Operation not permitted`. No se ejecutó ni certificó revisión visual. Ninguna publicación o migración remota.
- F24: [informe vigente y estado de las 25 fases](documentacion/17-continuacion-v2-2026-11-20.md) y [registros verificables](documentacion/verificacion-continuacion-2026-11-20/resultados.json). Los checkpoints anteriores se conservan como historia y sus pendientes resueltos se interpretan con esta actualización.

Siguiente punto: perfiles profesionales en `lib/report.ts` y consumidores de exportación. Después frases, administración, ayuda y optimización de las secciones bajo demanda. Permanecen en pruebas las 25 fases hasta cerrar sus requisitos y la revisión visual/externa correspondiente. No volver a implementar las cuatro anomalías ni marcar como ausentes la paginación, agregación o los controles de drawdown que ya cuentan con pruebas.


## Checkpoint 17 — cinco módulos e interfaz integral · 22 de noviembre de 2026

Este checkpoint es el estado vigente y sustituye los pendientes ya resueltos en los checkpoints anteriores. Inicio comprobado `e1f0283f3c9f0ba2d5f5fad265f1f80b29d9ad8c`, descendiente del commit `404542cbbfa52bbaebfe67cd3644998b554b30ed`. Rama exclusiva V2; no se publicó ni se modificó producción.

| Módulo | Implementado y comprobado |
|---|---|
| Interfaz | Chromium real sobre HTTPS y Worker compilado con D1/R2 desechables; siete anchos, dos temas, formularios, foco/teclado, filtros/páginas, CRUD, parciales, stop, importación y restauración, diez calculadoras, diez perfiles y descargas, administración y sesiones. Ejecución final 45045134407 aprobada sobre `b806ca0`: 208 comprobaciones y 48 análisis automáticos de accesibilidad sin infracciones. Incluye diagnóstico de consola, restauración de versiones y cambio concurrente de cuenta/divisa. |
| Cinco secciones | Psicología, Revisiones, Cuentas, Estrategias y Riesgo usan modelos de servidor, proyecciones y caché por revisión. No descargan automáticamente operaciones completas. Paridad con 100/1.000/10.000/20.000 registros, revisiones históricas paginadas y reconciliación de metadata concurrente aprobadas. |
| Frases | Trece categorías, preferencias D1, historial/favoritas paginados, cola por usuario, recuperación, migración idempotente con no repetición, PNG en tres formatos y voz del navegador. Catálogo sin atribuciones externas no acreditadas en nuevas entregas. |
| Administración | Recursos internos verificables, métricas externas expresamente no disponibles, alertas con búsqueda/páginas, incidencias sin secretos, mantenimiento reversible impuesto por servidor y auditoría/protección del propietario. |
| Ayuda | 81 artículos en 27 categorías, diez guías de calculadoras, treinta términos, quince FAQ, búsqueda y enlaces contextuales sin perder formularios. |

Migraciones aditivas 0009–0012, esquema y snapshots coherentes. Suite completa local aprobada, incluidas API, restauración/migración, seguridad, sitio y Cloudflare con/sin R2. Auditoría de producción sin avisos; auditoría completa conserva cuatro moderados de desarrollo y no se degrada Drizzle Kit para ocultarlos. No se repitieron las anomalías ni los diez perfiles existentes.

El [informe vigente con las 25 fases](documentacion/19-modulos-v2-2026-11-22.md) detalla alcance, pruebas, commits, limitaciones y continuación. [Evidencia reproducible](documentacion/verificacion-modulos-2026-11-22/resultados.json). Las comprobaciones de navegador verifican la aplicación aislada; no certifican OAuth, TradingView ni servicios reales.

Para publicación todavía se requieren: configuración real y presupuesto de Cloudflare, D1/R2 y OAuth reales, respaldo recuperable y ensayo de reversión, requisitos legales/contacto/retención y CSP con proveedores reales. No se conocen equity ni exposición del bróker. Los lectores de pantalla, Safari y el teclado virtual físico no se certifican con Chromium/Linux. Estos bloqueos no convierten en pendientes las funciones ya implementadas y comprobadas.

## Checkpoint 18 — seguridad, integridad y recuperación · 22 de noviembre de 2026

Inicio de esta auditoría: `84dc36a8a78e662ea04bdf70cc4e1bb3f74cea10`. Solo rama V2. Los cuatro arreglos antiguos, cinco módulos, diez calculadoras y diez perfiles se conservan. El [informe 20](documentacion/20-auditoria-seguridad-v2-2026-11-22.md) contiene modelo de amenazas, inventario de endpoints, hallazgos A–J, pruebas antes/después, riesgos residuales y matriz de lanzamiento. [Procedimiento operacional](documentacion/21-operacion-recuperacion-v2-2026-11-22.md).

Correcciones nuevas verificadas: límite delante del estado público; JSON acotado/profundidad y estado 413; cuotas temporales por usuario con pesos y sesión vigente; búsqueda administrativa sin el límite LIKE de D1; eliminación D1/R2 con intención transaccional y reintento; bloqueo de compartir frases sin procedencia; CSP por nonce y Zod sin compilación dinámica; drenaje inmediato de acciones de frases añadidas durante la lectura final. Migración 0013 aditiva con cola, triggers e índices; sin migración remota ni alteración de main/respaldo.

La [suite local final](documentacion/verificacion-seguridad-2026-11-22/final/resultados.json) sobre código `339d2eb` pasa 17 comandos; el audit completo registra aparte los cuatro moderados de desarrollo conocidos, salida 1, sin ocultarlos ni degradar Kit. Producción audit: cero avisos. Chromium final [45073382497](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45073382497), sobre `339d2eb`, aprueba 208 comprobaciones, 48 análisis automáticos de accesibilidad sin infracciones, cero excepciones y cero errores inesperados/429 en la matriz. Las nuevas pruebas de abuso sí agotan explícitamente la cuota de un usuario entre varias IP, sin desactivar bindings.

Recuperación local: dos D1/R2 independientes, las 25 tablas con datos ficticios, tres blobs, esquema/índices/triggers/versiones/relaciones/hashes, recibo idempotente y revocación/reemisión de sesión comprobados. Se ensaya también el Worker anterior `e26d644` contra la copia recuperada; conserva un defecto de búsqueda larga y el sondeo JIT antiguo, por lo que no es una publicación definitiva ni se identifica un version_id remoto seguro. No se restaura sobre producción ni se confunde JSON Bitácora con respaldo operacional.

| Fase | Estado vigente tras esta auditoría |
|---|---|
| 1 Arquitectura | Fronteras Cloudflare/Sites documentadas; lector de entrada y configuración Zod centralizados. |
| 2 Rendimiento | Paginación, agregados y cachés preservados y comprobados hasta 20.000; protección adicional de consumo. Métricas/CPU reales pendientes. |
| 3 Diseño/accesibilidad | Sin rediseño; 208 comprobaciones reales en siete anchos/dos temas y 48 análisis automáticos aprobados. No certifica todo WCAG ni dispositivos físicos. |
| 4 Resumen | Métricas completas y curva preservadas; pruebas locales y recorrido Chromium aprobados. |
| 5 Bitácora | Filtros/órdenes/páginas completos y consistentes preservados; lecturas completas explícitas protegidas por límites. |
| 6 Operaciones | CRUD/parciales/stop preservados; capturas se desvinculan en D1 antes de limpiar R2, con reintento duradero. |
| 7 Cuentas | Modelos, movimientos/divisas y límites preservados; eliminación protegida ante rollback D1 y acceso cruzado. |
| 8 Riesgo | Drawdown/fondeo/parciales/riesgo restante y cobertura existentes preservados; matemáticas y UI aprobadas. Sin exposición del bróker en vivo. |
| 9 Estadísticas | Agregados sobre todos los filtros preservados, independientes de la página; no se reimplementaron. |
| 10 Psicología | Modelo completo y privacidad de notas preservados; aislamiento y UI comprobados. |
| 11 Estrategias | Historial/versiones/restauración existentes preservados; versiones incluidas en recuperación operacional. |
| 12 Revisiones | Periodos, notas propias, historial y conflictos preservados; recuperación de sus datos y versiones probada. |
| 13 Mercados | CSP con nonce y sondeo Zod corregidos. Prueba reforzada real 45073382488 sobre código final: 12/12, contenido nativo/capturas y bloqueo inline. Restricción del proveedor para NAS100 registrada; AAPL explícito carga. No acredita OAuth o el dominio de producción. |
| 14 Calculadoras | Diez calculadoras conservadas; casos matemáticos y diez formularios reales aprobados. |
| 15 Configuración | Preferencias, privacidad, borrado y revocación conservados; política describe cookies, datos locales y servicios externos reales. Identidad legal/retención sin inventar. |
| 16 Importar/exportar | Diez perfiles y todos los formatos conservados; límites, fórmulas, escape, privacidad/restauración y descargas aprobados. No se incorpora XLSX de importación innecesario. |
| 17 Frases | Biblioteca original preservada; cola drena acciones añadidas durante refresh final; material heredado sin procedencia sigue privado y ya no ofrece compartir. Derechos definitivos de 480 textos antiguos requieren confirmación. |
| 18 Administración | Cuotas/roles/mantenimiento/auditoría existentes preservados; búsqueda literal larga y alerta/conteo de limpieza añadidos. Consumo externo sin acceso. |
| 19 Autenticación | Sesiones/PKCE/state/roles/revocación probados con proveedor ficticio. OAuth y configuración Google reales siguen bloqueados por acceso. |
| 20 Seguridad/legal | Hallazgos comprobados corregidos con regresiones; cuatro moderados dev evaluados, CSP reforzada. Retención, datos legales, derechos/terceros y configuración efectiva pendientes. Sin certificación universal. |
| 21 Ayuda | Se conserva el centro de 81 artículos y diez guías; no se duplican pantallas ni explicaciones. |
| 22 Datos | Migración aditiva 0013/actualización y recuperación completa local aprobadas; backup, permisos y ensayo remoto reales pendientes. |
| 23 Pruebas | Suite local completa y Chromium principal aprobados; comprobación reforzada de proveedores y evidencia final documentadas en informe 20. |
| 24 Documentación | Informes 20/21, estados A–J, fuentes oficiales, registros antes/después y procedimientos preparados; evidencias y commits en V2. |
| 25 Entrega | Código funcional en V2; ninguna publicación ejecutada. **NO APTO PARA PUBLICACIÓN** mientras falten los requisitos externos y documentales de la matriz. |

Continuación indispensable: confirmar recursos/configuración/plan y Google reales mediante acceso autorizado; obtener respaldo cifrado recuperable y ensayar sobre copia autorizada; confirmar responsable/contacto, bases y retención/expurgo, derechos/terceros y licencias; comprobar cron/cola y observabilidad efectivos, medir presupuesto y registrar version_id compatible. Cualquier migración/rotación/restauración/despliegue real requiere autorización específica. No volver a declarar pendientes los módulos funcionales ya terminados.


## Checkpoint 19 — catálogo, capturas y biblioteca cifrada · 22 de noviembre de 2026

Inicio de esta ampliación `69521bea76ce97e5881f81a6b721619cabfcca4d`, preservando los ancestros de `404542c`. Rama exclusiva V2; main y respaldo comprobados sin cambios en `913425d042c681d1682bd7df11facda70d26c4d2`.

Se completaron catálogo privado vacío por usuario, alias/favoritos/recientes, selector +, asociación histórica confirmada y transaccional, agrupación estable sin alterar finanzas, respaldo/restauración del catálogo y adaptador Sites. Capturas: fallback compacto, carga real, borradores/enlaces y componente común.

Herramientas → Mis scripts ya contiene biblioteca cifrada en navegador, clave personal/recuperación, editor CodeMirror local, búsqueda privada de metadatos, código bajo demanda, versiones CAS/última versión, borradores cifrados, exportación/restauración privada y recuperación operacional. La política aprobada es 1.000 líneas en el editor normal; un cliente modificado puede superar ese contador. El servidor verifica bytes/cuotas/rol/versión (128/512 KiB de código, 5/25 MiB de biblioteca), sin recibir texto ni claves. Migraciones 0014/0015 aditivas solo en recursos desechables.

Código probado `ac044966838861dbd9288f16a0a02056c63ad48f`; evidencia `6936c042d7a61b3ce285d222e9a653460712c83a`. Suite local: 17 comandos aprobados, cuatro moderados dev aparte y cero avisos de producción. Chromium 45107587077: 215 casos, 56 análisis automáticos sin infracciones, siete anchos/dos temas; API Sites compilada también aprobada. Recuperación: 29 tablas pobladas, 80 objetos de esquema y tres blobs, incluido descifrado de un script recuperado. Widgets/CSP reales 45105586029 aprobados con las limitaciones previas, sin certificar Google o producción.

[Informe vigente con commits, archivos, 25 fases, pruebas y continuación](documentacion/25-entrega-progresiva-activos-scripts-2026-11-22.md), [nueve fases nuevas y decisiones](documentacion/23-nuevas-fases-v2-2026-11-22.md), [contrato y cierre de scripts](documentacion/24-scripts-criptografia-y-continuacion-2026-11-22.md), [PNG y hashes de Chromium conservados](documentacion/verificacion-scripts-2026-11-22/chromium/manifest.json).

| Fase original | Estado vigente |
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

El ejecutor quedó indisponible otra vez durante tarjetas Terminal/R/%: esos prototipos locales no tienen commit ni prueba nativa final y **no se cuentan como entregados**. Reabrir, archivar y reconciliar el árbol sin descartar cambios; continuar exactamente los archivos listados en el informe 25. Después snapshot de una operación, token revocable/30 días y QR integrado real, UX y cierre global. No reconstruir módulos ya terminados.

**NO PUBLICADO / NO APTO PARA PUBLICACIÓN DEFINITIVA.** Además de esas fases faltan configuración/presupuesto/Google/bindings reales, respaldo y reversión autorizados, requisitos legales, retención y derechos indispensables. Ninguna migración/despliegue/rotación real ni cambio de main.


## Checkpoint 20 — Terminal, snapshot/QR y UX · 23 de noviembre de 2026

Código final comprobado `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`; inicio de continuación `18ec6e0`, conservando el ancestro obligatorio `404542c`. Cinco commits de implementación/pruebas y cierre de evidencia separado. 49 archivos de código/documentación antes del cierre. Main/respaldo intactos `913425d`; sin publicación ni escrituras en producción. Este checkpoint sustituye los pendientes de tarjetas/QR/UX del checkpoint 19.

Terminal compartible 1:1/4:5/9:16, R/% con denominador aprobado, privacidad independiente, capturas comunes y QR real con snapshot mínimo confirmado, hash/token, 30 días, CAS, cuota, revocación y cascadas. Flujos separados, confirmaciones accesibles, navegación agrupada y ayuda de 90 artículos. Diez calculadoras y módulos previos conservados. Nueve fases nuevas completas dentro del alcance local aprobado; PDF directo móvil secundario evaluado, se conserva impresión.

Suite local final: 18 comandos aprobados y cuatro moderados dev conocidos aparte; producción sin avisos. Chromium 45189916983: 219/219, 68 axe sin infracciones automáticas, siete anchos/dos temas, QR/PNG nativos y snapshot mínimo/rico comprobados. Recuperación: 30 tablas/87 objetos/tres blobs y revocación de enlaces/sesiones antes de reabrir. 0016 aditiva únicamente en bases desechables.

[Informe vigente con commits, archivos, resultados, nueve fases y bloqueos](documentacion/29-entrega-terminal-qr-ux-2026-11-23.md), [manifiesto Chromium](documentacion/verificacion-terminal-2026-11-23/chromium-final/manifest.json), [suite local final](documentacion/verificacion-terminal-2026-11-23/release-final/resultados.json), [cierre legible por máquina](documentacion/verificacion-terminal-2026-11-23/cierre.json).

| Fase original | Estado vigente al 23 de noviembre de 2026 |
|---|---|
| 01 Arquitectura | Catálogo, biblioteca cifrada y snapshots públicos integrados en los dominios existentes. Configuración externa pendiente. |
| 02 Rendimiento | Paginación/agregados hasta 20.000 preservados; código bajo demanda y snapshot por índice hash. No se afirma consumo facturado real. |
| 03 Diseño/accesibilidad | Chromium real: siete anchos/dos temas, 219 casos y 68 análisis axe sin infracciones. No certifica todos los dispositivos o lectores. |
| 04 Resumen | Métricas completas y calendario preservados; compartir/exportar/respaldar separados sin reducir estadísticas a una página. |
| 05 Bitácora | Filtros/páginas/orden/catálogo y asociación confirmada preservados. Tarjetas internas conservan el diseño anterior. |
| 06 Operaciones | CRUD/parciales/stop/borradores preservados; capturas comunes y tarjetas Terminal 1:1/4:5/9:16, R/% y QR verificados. |
| 07 Cuentas | Límites y movimientos preservados; quitar movimiento exige confirmar y guardar. Borrado revierte sin pérdida e invalida enlaces propios. |
| 08 Riesgo | Drawdown diario/total/máximo, fondeo, parciales y riesgo restante previos conservados. No hay equity/cotizaciones ni exposición real del bróker. |
| 09 Estadísticas | Agregados completos por filtros y agrupación estable por mercado; independientes de la página visible. Casos grandes aprobados. |
| 10 Psicología | Modelo/filtros/privacidad/reportes preservados y recorrido nativo aprobado. |
| 11 Estrategias | Historial/restauración preservados; confirmación accesible y snapshots de trades intactos. Scripts cifrados separados, solo última versión. |
| 12 Revisiones | Semanal/mensual, persistencia, filtros y reportes contextuales preservados y comprobados. |
| 13 Mercados | CSP/widgets reales aprobados en 45186254867; se conserva la limitación documentada del proveedor para NAS100. Producción sin certificar. |
| 14 Herramientas | Sí: diez calculadoras conservadas y probadas, además de Mis scripts cifrados. Sin nueva sección principal. |
| 15 Configuración | Privacidad, catálogo, scripts, respaldos y borrado propios preservados. Datos legales/retención externos siguen pendientes. |
| 16 Importar/exportar | Diez perfiles y PDF/Excel/CSV/PNG conservados. Flujos separados, JSON completo y CSV privado con confirmación; PDF móvil mediante impresión disponible. |
| 17 Frases | Categorías/favoritos/historial/offline/voz existentes preservados. El menú móvil ya no queda tapado por la frase. Derechos heredados pendientes; sin atribuciones nuevas. |
| 18 Administración | Cuotas/roles/propietario/mantenimiento/auditoría/alertas anteriores conservados. Cuota de 100 enlaces se aplica en D1; métricas externas no inventadas. |
| 19 Autenticación | PKCE/sesiones/estados/roles/CSRF y acceso anónimo exclusivo a snapshots probados con identidades ficticias. Google real pendiente. |
| 20 Seguridad/legal | Aislamiento, hash de tokens, cifrado y límites comprobados. Producción: cero avisos; cuatro moderados dev conocidos. Legal/retención/derechos reales sin completar. |
| 21 Ayuda | 90 artículos en español; añadidos únicamente temas de Terminal, enlace/QR y flujos/navegación. |
| 22 Datos | 0016 aditiva verificada desde esquema previo. Recuperación local: 30 tablas, 87 objetos y tres blobs; revocación de sesiones/enlaces antes de reabrir. Ensayo real pendiente. |
| 23 Pruebas | Suite local final: 18 comandos aprobados + auditoría dev con avisos conocidos. Chromium 219/219, 68 axe; API/builds y R2 presente/ausente aprobados. |
| 24 Documentación | Plan e informes 23–29 actualizados; fuentes, commits, lista de archivos, logs, intentos fallidos, PNG y hashes conservados. |
| 25 Entrega | Código funcional y verificable en V2. NO PUBLICADO / NO APTO PARA PUBLICACIÓN DEFINITIVA por las condiciones externas documentadas. |

**NO PUBLICADO / NO APTO PARA PUBLICACIÓN DEFINITIVA.** Pendiente validación real de Cloudflare/Google/bindings/presupuesto, respaldo/reversión autorizados, cron/observabilidad y requisitos legales/retención/derechos. No se vuelven a señalar como pendientes módulos ya implementados y verificados. Próximo punto: condiciones externas del informe 29, sin reconstruir las nueve fases nuevas y sin migraciones/despliegue real sin autorización adicional.


## Checkpoint 21 — preparación segura de publicación y guía del propietario · 23 de noviembre de 2026

Inicio `7758c55007b07339fa74de2c66ba0a32ba209b89`; código de preparación comprobado `2272e9580a795411dca035a2ec064869c2a57752`. Main y producción no modificados. Se elimina la aplicación automática de migraciones de deploy y se añaden destinos separados, bloqueo de fixtures remotos, inspección de esquema/registro/relaciones sin CREATE, sellado de artefactos/fuente limpia y aprobación exacta por SHA para producción. No se reconstruyeron módulos.

[Guía vigente de publicación y pasos del propietario, A–H](documentacion/30-publicacion-v2-y-pasos-del-propietario.md), [cierre/evidencias](documentacion/verificacion-publicacion-2026-11-23/cierre.json). Suite local actual: 19 comprobaciones aprobadas + cuatro moderados dev conocidos aparte; producción sin avisos. Chromium 45202177791: 219/219, 68 axe sin infracciones automáticas; TradingView/CSP real 45202177758: 12 casos aprobados. Staging **solo ficticio local**: build de fuente limpia, dry-run y 17 migraciones/inspector aprobados. No recursos remotos aprovisionados ni migraciones reales.

| Fase original | Estado vigente |
|---|---|
| 01 Arquitectura | Dos perfiles conservados; release Cloudflare separa staging/producción y bloquea destinos inconsistentes. Recursos reales pendientes de acceso. |
| 02 Rendimiento | Paginación/agregados completos y pruebas grandes aprobados nuevamente; consumo real sin medir. |
| 03 Diseño/accesibilidad | Repetición Chromium real 219 casos, siete anchos/dos temas, 68 axe sin infracciones; no certificación universal. |
| 04 Resumen | Funciones existentes y flujos separados preservados y comprobados. |
| 05 Bitácora | Catálogo/filtros/orden/paginación y asociación confirmada preservados; estadísticas completas. |
| 06 Operaciones | CRUD/parciales/stop, Terminal/capturas/QR/R/% y privacidad conservados; regresiones aprobadas. |
| 07 Cuentas | Límites/movimientos y confirmaciones preservados; aislamiento/borrado comprobados en fixtures. |
| 08 Riesgo | Drawdown/fondeo/parciales/riesgo restante conservados; ninguna integración de exposición real de bróker. |
| 09 Estadísticas | Agregados y agrupación completos por filtros; pruebas grandes aprobadas de nuevo. |
| 10 Psicología | Modelo/filtros/reportes conservados; recorrido Chromium repetido. |
| 11 Estrategias | Historial/restauración, snapshots y biblioteca cifrada preservados y comprobados. |
| 12 Revisiones | Semanal/mensual y reportes contextuales conservados y comprobados. |
| 13 Mercados | TradingView/CSP real repetido: 12 casos aprobados y limitación/fallback del proveedor conservados. Producción no certificada. |
| 14 Herramientas | Diez calculadoras y Mis scripts cifrados completos; pruebas repetidas. |
| 15 Configuración | Privacidad, catálogo, recuperación/respaldos conservados; valores legales y runtime reales pendientes. |
| 16 Importar/exportar | Diez perfiles, PDF/Excel/CSV/PNG y respaldos separados preservados; pruebas aprobadas. |
| 17 Frases | Categorías/favoritos/historial/offline/voz conservados; derechos heredados requieren evidencia. |
| 18 Administración | Cuotas/mantenimiento/invitaciones/auditoría/propietario protegidos y comprobados en fixtures; plan/metrics/cron reales pendientes. |
| 19 Autenticación | PKCE/sesiones/CSRF/roles probados con identidades ficticias. Login de panel Cloudflare vía Google no completado: contraseña rechazada en formulario seguro. OAuth real de Tradeify sigue sin verificar. |
| 20 Seguridad/legal | Release sin migraciones implícitas y aprobación por SHA; producción sin avisos, cuatro moderados dev conocidos. Contacto/retención/licencias/marca/configuración real pendientes. |
| 21 Ayuda | 90 artículos anteriores conservados; guía externa de configuración A–H añadida sin duplicar pantallas. |
| 22 Datos | 17 migraciones e inspector comprobados en D1 local; recuperación de 30 tablas/87 objetos/tres blobs repetida. Estado D1/backup/reversión real no inspeccionado. |
| 23 Pruebas | 19 comprobaciones locales actuales, Chromium 219/219 y 68 axe, TradingView/CSP 12/12. No equivalen a staging publicado ni Google real. |
| 24 Documentación | Informe 30 con pasos exactos, comandos protegidos, evidencia/hash/commits; guías 06/10 corregidas para retirar migración automática e instrucciones antiguas contradictorias. |
| 25 Entrega | Código y guía guardados en V2. V2 nueva NO PUBLICADA; se continúa con acceso, staging real, backup/legal y aprobaciones concretas. |

Próximo paso: completar login seguro de Cloudflare y contrastar recursos de la instalación existente. Nunca sustituir DB productiva por una vacía. No se solicitan aprobaciones D1/finales sin un plan real y recuperable; siguen pendientes las condiciones expresas del usuario. La web antigua abre por HTTPS, pero su versión activa y bindings no se certifican a partir de un check histórico.


## Checkpoint 22 — ensayo reforzado desde 0005 y bloqueo real de acceso

Continuación desde `1b8ecc0d19723807ced0848c5797f3abc189ffea`, exclusivamente V2. Se preservan los estados funcionales de las 25 fases del checkpoint 21; no se reconstruye ninguna función. Fases 22/23: ampliada la prueba D1 0005→0016 a las 14 tablas heredadas, dos usuarios, 1001 operaciones y comparación después de cada migración; registro completo y acceso cerrado preservados, además de rechazo atómico de JSON inválido al crear índices. Fase 24: guía 30 sección I actualizada con lote/requisitos y evidencia local. Fase 25: V2 aún no publicada.

El propietario informa que producción registra 0000–0005 y no observó BUCKET. El asistente todavía no ha contrastado UUID/esquema/R2. El flujo Google de acceso al panel avanzó y se confirmó el dispositivo, pero Cloudflare devolvió «Unable to sign in. Try again or use your email and password»; no se obtuvo sesión del panel. No es una prueba del OAuth de Tradeify. No hay backup real certificado, staging remoto, migración remota ni despliegue; no se modifica main ni se reemplaza DB. Continuar completando manualmente el acceso Cloudflare y luego inspección/backup/staging. [Detalle y controles](documentacion/30-publicacion-v2-y-pasos-del-propietario.md#i-continuación-transición-00050016-y-acceso-real-pendiente).
