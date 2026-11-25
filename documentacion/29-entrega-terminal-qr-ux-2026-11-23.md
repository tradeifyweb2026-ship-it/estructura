# Entrega progresiva V2: Terminal, R/%, QR y UX · 23 de noviembre de 2026

**Código funcional verificado: `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`. NO PUBLICADO / NO APTO PARA PUBLICACIÓN DEFINITIVA.** Las nueve fases nuevas quedan implementadas y verificadas en el alcance local autorizado; la validación de servicios/recursos reales y requisitos legales sigue pendiente. Esta entrega no certifica un bróker ni Google OAuth real.

## Inicio, protección y commits

Ancestro obligatorio conservado: `404542cbbfa52bbaebfe67cd3644998b554b30ed`. Inicio de esta continuación: `18ec6e042e80b10026fd15ea68900474250b2a33`. Se preservaron los módulos previos, incluidos catálogo privado, scripts cifrados, diez calculadoras y las cuatro anomalías ya corregidas. Se recuperó el ejecutor, se archivaron 37 archivos locales y se reconciliaron los documentos remotos sin descartar los prototipos.

Rama exclusiva `mejoras-v2-2026-11-18`. Main y respaldo siguen en `913425d042c681d1682bd7df11facda70d26c4d2`, comprobados por API. No hubo fuerza sobre referencias, reescritura de historia, migraciones/despliegues reales, rotación de secretos, compras, mensajes a terceros o borrado de datos de usuarios reales.

| Commit creado | Cambio |
|---|---|
| `98a6b904765125f1c1b2a337f8645ca05c71713d` | feat(sharing): add private Terminal cards with verified net return and existing report exports |
| `6fb88ae09aacbe63845a988c72beca58d46c2599` | test(sharing): locate labelled selects correctly and isolate browser identities before switching cookies |
| `9616c4f0e3a149d774c54452e23ef589f455e36a` | feat(sharing): add confirmed 30-day public snapshots and revocable QR in Terminal cards |
| `262cd0e966de08fc6f6ff121467caa7e85c91716` | feat(ux): separate sharing reports and backups, group navigation and replace native confirmations |
| `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35` | fix(ux): keep the mobile menu above daily phrases and verify explicit restore and public privacy flows |

El commit posterior de documentación/evidencias queda identificado por HEAD de la entrega; no se incluye un hash autorreferente imposible dentro de su propio contenido. Los 18 commits anteriores se detallan en el informe 25. [Lista completa de los 49 archivos de código/documentación modificados antes del cierre](verificacion-terminal-2026-11-23/archivos-codigo.json); la evidencia del cierre se inventaría por manifiestos y Git.

## Funcionalidades implementadas y corregidas

- Terminal solo en tarjetas compartibles: tres formatos, dos temas, compacto/detallado, estados financieros y datos incompletos. Curva identificada como decorativa. SVG/fuente comunes para preview y PNG; escalado según dimensiones intrínsecas corregido. Tarjetas internas intactas.
- Solo R / Solo % / R y %. Porcentaje sobre P&L neto explícito / capital inicial registrado; nunca doble descuento de comisiones/parciales ni equity inventado. No disponible con datos insuficientes. Privacidad de imagen independiente de reportes y enlaces.
- Snapshot público de una sola operación, mínimo por defecto y extras confirmados. Token aleatorio de 32 bytes, hash SHA-256 indexado, 30 días, datos congelados, cuotas D1, CAS de fuente y revocación/borrado reales en recursos desechables. Sin IDs/cuentas/correo/scripts/historial vecino ni capturas privadas almacenadas.
- QR real opcional en la misma tarjeta, ECC Q/margen de cuatro módulos/cuadrícula entera. Ocultarlo no revoca; revocarlo sí invalida el acceso. La URL secreta se entrega solo en el diálogo de creación: guardar enlace o QR; la lista propia permite revocar sin recuperar el token.
- Capturas: componente común del editor/detalle, tarjeta y página pública. Página TradingView ofrece fallback y botón; imagen directa requiere carga real. No scraping, proxy arbitrario ni páginas convertidas a imágenes. PNG muestra direcciones autorizadas.
- Compartir / Exportar / Respaldar separados. Todos los formatos y diez perfiles conservados. JSON completo obtenido del servidor y CSV privado con confirmación accesible; catálogo/scripts privados separados y explicados. PDF móvil conserva impresión/Guardar como PDF cuando esté disponible, sin conversor remoto.
- Doce secciones agrupadas en Diario / Análisis / Gestión / Herramientas. Más móvil probado mediante navegación real; corregida la superposición de la frase diaria sin cerrar/borrar la frase. Cuatro confirmaciones nativas sustituidas: CSV/JSON privados, quitar movimiento y restaurar estrategia. Cancelar conserva registros; quitar exige guardar; restauración conserva snapshots.
- Ayuda ampliada puntualmente a 90 artículos. Administración existente preservada con estados/pendientes/vencimientos, recursos/mantenimiento, alertas/incidencias/auditoría y propietario protegido. No se duplican funciones ni se llama facturación a un conteo interno.

## Resultados reales y evidencia

[Suite local final por comando](verificacion-terminal-2026-11-23/release-final/resultados.json): **18 aprobados**, cero fallos, auditoría dev registrada aparte con cuatro moderados conocidos. Incluye TypeScript, lint (un aviso previo de img; cero errores), lógica/matemáticas, módulos avanzados, consultas 100/1.000/10.000/20.000, restauración/migraciones, exportaciones diez perfiles y 10.000 registros, build/API Sites, build/Worker con y sin R2, seguridad, recuperación y API pública. Producción sin vulnerabilidades reportadas. El arreglo automático dev propone una degradación incompatible de Drizzle Kit: no aplicada. El primer clasificador de auditoría tropezó con un aviso npm antes del JSON; se conserva su intento y se documenta la clasificación corregida sin cambiar expectativas.

Chromium real [45189916983](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45189916983), fuente `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`: **219/219**, cero excepciones JavaScript y cero errores de consola inesperados; 24 entradas de consola conservadas, incluidas pruebas intencionales de conflicto/desconexión. **68 análisis axe, cero infracciones automáticas**. Siete anchos (320, 360, 390, 768, 1024, 1440, 1920), dos temas, formularios, modales, teclado, JSON, administración y reportes. Incluye snapshots mínimos/ricos desde navegador, %/dinero/captura autorizados, fallback público, aislamiento, tres PNG nativos y sus QR decodificados antes/después de JPEG a 720 px/calidad 65, ocultación y revocación; también JSON completo de más de veinte filas y restauración de estrategia sin modificar trades.

[Manifiesto con hashes, resultados y PNG representativos](verificacion-terminal-2026-11-23/chromium-final/manifest.json). ZIP completo: 337 archivos, 51.296.143 bytes, SHA-256 `ed50eceedbb56da9b7c7ab243022ebc3b8037dffd6c572e3c43e76a2676d3b96`; artifact 14826705702 vence el 7 de diciembre de 2026. Los archivos representativos quedan en Git para conservar evidencia después de ese vencimiento. Se revisaron manualmente, entre otros, PNG de tarjeta 1:1/9:16, página pública a 320 px, navegación móvil, confirmación de respaldo y snapshot rico con fallback. Los intentos fallidos 98a/961/262 se conservan; no se presentan como aprobados ni se relajan expectativas financieras.

TradingView/CSP reales: [45186254867](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45186254867), aprobado sobre 9616c4f. Documentos en Chromium: [45183268912](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45183268912), aprobado sobre 98a6b90; sus plantillas se conservan y el flujo PDF final se prueba además en la suite final. Ninguno acredita Google real, un dominio productivo o exposición del bróker.

Recuperación final: **30 tablas, 87 objetos de esquema, tres blobs**, índices/triggers/relaciones y script recuperado descifrable. El snapshot se copia íntegro y se revoca, junto con sesiones, antes de reabrir el destino. No es una restauración de producción ni un ensayo real de Time Travel. 0016 es aditiva, probada desde esquema previo; sin migración inversa destructiva.

## Nueve fases nuevas

| Fase | Estado vigente |
|---|---|
| 01 Inspección/decisiones | Completa; decisiones del usuario aplicadas, sin reiniciar proyecto. |
| 02 Activos | Completa y preservada; catálogo vacío por usuario, asociación confirmada, respaldo privado. |
| 03 Scripts | Completa y preservada; cifrado en navegador, recuperación, editor, cuotas servidor, última versión y respaldo. Límite de líneas solo en editor por decisión expresa. |
| 04 Terminal | Completa y verificada: tres formatos, dos temas, estados, privacidad y PNG real. |
| 05 R/% | Completa y verificada: denominador aprobado, neto explícito y datos insuficientes. |
| 06 Capturas | Completa y verificada en las tres superficies, sin scraping ni imágenes privadas públicas. |
| 07 Snapshot/QR | Completa y verificada con 30 días, mínimo/opt-in, CAS, cuota, hash, anonimato, caducidad y revocación/borrado. |
| 08 UX | Completa en alcance aprobado; flujos/grupos/confirmaciones/ayuda; módulos existentes preservados. PDF directo móvil secundario evaluado, se conserva impresión. |
| 09 Verificación/documentación | Completa para este código y fixtures: suites, registros, PNG/hashes, matrices y commits. Servicios/requisitos externos siguen fuera de certificación. |

## Estado actualizado de las 25 fases originales

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

## Pendientes reales, límites y siguiente continuación

1. Inspección autorizada de cuenta/origen/rutas/plan/presupuesto y bindings reales Cloudflare, D1 y R2; verificar consumo, cron/limpieza y observabilidad efectivos. No extrapolar cuotas/billing desde fixtures.
2. Probar Google OAuth real en el dominio correcto y revisar la configuración/autorizaciones de Google. No inventar credenciales ni dar por válido un proveedor ficticio.
3. Obtener respaldo cifrado recuperable real y ensayar recuperación/reversión sobre copia autorizada; registrar version_id compatible y proteger migraciones/activos. Al recuperar, revocar todos los enlaces públicos y sesiones restaurados antes de habilitar tráfico.
4. Completar datos indispensables del responsable/contacto/bases/retención/expurgo y derechos de contenido/terceros. Las 480 frases heredadas sin procedencia suficiente siguen restringidas según el cierre anterior; no se inventan licencias ni autores.
5. Conservar seguimiento de los cuatro moderados dev y aplicar solo una actualización compatible y comprobada cuando exista. No degradar Drizzle Kit para silenciar el audit.
6. Publicación requiere autorización adicional según el PDF vigente y todas las condiciones externas. **No publicar ni aplicar 0014/0015/0016 en D1 real con esta entrega.**

Las nueve fases nuevas ya verificadas no deben volver a listarse como pendientes de desarrollo. Continuar desde `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35` y el commit de cierre que lo sucede, exclusivamente en V2. No reconstruir calculadoras, catálogo, scripts, paginación/riesgo/reportes o las anomalías originales. La prueba de escritorio Chromium no certifica móviles físicos, todos los lectores de pantalla o la compresión efectiva de cada servicio de mensajería; las imágenes rasterizadas locales no se presentan como sustituto del navegador.
