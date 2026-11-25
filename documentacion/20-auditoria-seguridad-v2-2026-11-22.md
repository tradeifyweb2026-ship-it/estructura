# Seguridad V2 · 22 de noviembre de 2026

## Alcance y punto de partida

Auditoría iniciada sobre `84dc36a8a78e662ea04bdf70cc4e1bb3f74cea10`, HEAD local y remoto comprobados, rama `mejoras-v2-2026-11-18`, árbol limpio al inicio. Las conclusiones históricas de SEGURIDAD_INFORME.md no certifican esta versión. No hay autorización para desplegar ni modificar servicios de producción. Se conservan los cinco módulos y los diez perfiles terminados.

## Arquitectura y modelo de amenazas inicial

Navegador → Worker Cloudflare (`worker/cloudflare.ts`) → Google OAuth, sesiones D1, autorización y API Vinext → D1/R2 privados. Entrada Sites separada (`worker/index.ts`): depende de la identidad suministrada por la plataforma; esa frontera externa requiere verificación independiente. Cloudflare elimina las cabeceras de identidad entrantes y establece las verificadas. Google se consulta en dos URLs fijas, con PKCE/state; no se verifica un ID token recibido del cliente. El correo alternativo está desactivado (410). Propietario por correo configurado; no existe un rol administrador delegado independiente.

Actores: anónimo, usuario activo, pendiente, suspendido, vencido, bloqueado y propietario. Un usuario activo puede manipular sus solicitudes, IDs, filtros, versiones y archivos. Solo el propietario administra accesos, cuotas y mantenimiento; no debe acceder por ello a notas/capturas financieras ajenas. D1 conserva operaciones, importes, psicología, versiones de estrategias, revisiones, frases, preferencias, sesiones y auditoría; R2 conserva capturas. Los reportes se generan en cliente; JSON privado y respaldo operacional son productos distintos.

## Prioridades antes de cambios importantes

Estas diez prioridades proceden de código/documentación; una sospecha no equivale a explotación demostrada.

| Prioridad | Evidencia inicial | Estado inicial | Impacto a investigar |
|---|---|---|---|
| 1 | `/api/estado` retorna en google-auth.ts antes del limitador API | Vulnerabilidad confirmada por flujo; reproducción pendiente | Lecturas D1 públicas sin el límite declarado |
| 2 | `/api/mi-cuenta` usa request.json sin límite de bytes | Vulnerabilidad confirmada por flujo; reproducción pendiente | Memoria/CPU con cuerpo autenticado excesivo |
| 3 | Frases captura también el error 413 y lo convierte en 422; entradas JSON sin límite explícito de profundidad | Pendiente | Contrato de límites y estructuras excesivas |
| 4 | API_RATE_LIMITER usa solo IP; queries agregadas admiten usuarios con varias IP | Pendiente | Abuso autenticado distribuido por usuario |
| 5 | Eliminación de cuenta borra R2 antes de la transacción D1 | Pendiente | Datos inconsistentes ante fallo parcial; requiere ensayo |
| 6 | CSP sin script-src/default-src; widgets externos | Pendiente | Defensa XSS y cadena de terceros, compatibilidad real |
| 7 | Cuatro avisos moderados dev Drizzle/esbuild registrados | Pendiente | Exposición del servidor de desarrollo y arreglo compatible |
| 8 | JSON Bitácora excluye sesiones/frases/blobs; no hay ensayo operacional integral registrado | Pendiente | Recuperación y rollback no demostrados |
| 9 | Contacto/retención/legal y licencias heredadas pendientes en informe 19 | Pendiente | Publicación sin información/base de uso documentadas |
| 10 | Cold aggregates 20k medidos en Node; panel/métricas/identidad real no verificados | No verificable con evidencia anterior | Presupuesto Free y configuración efectiva |

## Primer módulo: límites y validación

| ID | Gravedad | Vulnerabilidad | Archivo | Evidencia | Corrección | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| V2-S01 | Media | Estado público omite limitador y permite lecturas D1 repetidas sin sesión | worker/google-auth.ts | Antes: 125 GET sin ningún 429 | Ejecutar limitador API antes de consultar estado | check-security-boundaries: 429/Retry-After, otra IP continúa | Corregido y verificado |
| V2-S02 | Media | JSON de sesiones/eliminación sin límite; requiere sesión propia válida y cabecera CSRF | worker/google-auth.ts | Antes: cuerpo >20 KB interpretado y 422 por acción desconocida | Límite streaming 16 KiB antes de parsear, JSON explícito | Cuerpo excesivo 413; texto 415; sesión preservada | Corregido y verificado |
| V2-S03 | Baja | Frases convierte 413 en 422 | app/api/frases/route.ts | Antes: 17 KB devuelve 422 | Conservar error tipado del lector común | Después 413 | Corregido y verificado |
| V2-S04 | Baja | JSON profundamente anidado en campos ignorados se acepta; impacto acotado por bytes, sin ejecución demostrada | lib/request-body.ts y consumidores | Frases acepta objeto de 64 niveles antes del cambio | Máximo 32 niveles antes de JSON.parse en cuenta/admin/bitácora/frases | Después 422, strings con llaves válidos | Corregido y verificado |

Los siete casos de frontera pasan después del cambio; cinco fallaban antes. [Antes](verificacion-seguridad-2026-11-22/antes/boundaries.json) y [después](verificacion-seguridad-2026-11-22/despues/boundaries.json). TypeScript, compilación Cloudflare con R2, suites Cloudflare y seguridad de aplicación aprobadas. Las solicitudes JSON de la suite Cloudflare ahora envían su Content-Type real, igual que la aplicación; no se redujeron sus expectativas.

## Segundo módulo: integridad de eliminación D1/R2

V2-S05 · **Media · Corregido y verificado**. El borrado de cuenta eliminaba blobs antes de confirmar D1. Un fallo posterior en la transacción dejaba la cuenta y referencias restauradas con la imagen perdida. La prueba introduce un trigger de aborto en D1: [antes](verificacion-seguridad-2026-11-22/antes/account-erasure.json) pierde la captura; [después](verificacion-seguridad-2026-11-22/despues/account-erasure.json) conserva blob, referencia y acceso autenticado.

Migración aditiva 0013: cola privada `storage_deletions`, índices y triggers que encolan desvinculaciones/reemplazos en la misma transacción D1. El Worker borra R2 únicamente después de confirmar D1. Un fallo parcial de R2 o de confirmación posterior deja la intención para reintento idempotente. No se borran objetos todavía referenciados. Lotes de 100, sin listar todo el bucket. La cuenta puede desaparecer de D1 y quedar una limpieza técnica pendiente; no se oculta ese estado: el propietario recibe conteo y alerta, y Privacidad explica el reintento.

Se prepara un evento programado cada diez minutos, sin activarlo remotamente en esta auditoría. **Su ejecución real y capacidad para vaciar el backlog deben verificarse antes del lanzamiento.** No se promete un plazo de eliminación del proveedor ni se supone que Sites disponga de ese scheduler. Si BUCKET falta y la cuenta tiene capturas, el borrado se rechaza conservando datos. Esquema/snapshot coherentes y actualización desde V2 previa aprobada; sin DROP de datos o migraciones remotas.

[Pruebas de limpieza](verificacion-seguridad-2026-11-22/storage-cleanup.txt): aislamiento, R2 parcial, confirmación D1 fallida, idempotencia, objetos referenciados y límite 100. Las suites de restauración/migraciones, aplicación y módulos avanzados pasan con D1/R2 desechables. No acreditan permisos públicos del bucket real.

## Tercer módulo: abuso autenticado

V2-S06 · **Media · Corregido y verificado**. El límite solo por IP permitía 65 lecturas completas con la misma sesión cambiando de IP. La prueba [antes](verificacion-seguridad-2026-11-22/antes/user-abuse.json) no obtiene ningún 429; [después](verificacion-seguridad-2026-11-22/despues/user-abuse.json), 60 permitidas y cinco limitadas en Miniflare. Otra cuenta continúa. Se añade USER_RATE_LIMITER (600 unidades/minuto por usuario/ubicación): lectura completa/analytics 10, sección 5, resto GET 1, escrituras 5. Se mantiene el límite por IP. Solo una sesión activa comprobada en D1 puede consumir el presupuesto del usuario, impidiendo gastarlo con una cookie revocada o cabeceras falsificadas.

Es una mitigación aproximada por ubicación, no una cuota mundial ni una defensa DDoS completa; las cuotas de datos siguen siendo transaccionales en D1. Exportar archivos es trabajo del navegador; sus lecturas completas están cubiertas, con la paginación/revisión existentes intactas. El namespace y comportamiento reales necesitan comprobación de despliegue autorizado. Los pesos se deben ajustar con métricas reales; no se promete que 20.000 operaciones quepan en CPU Free.

## Procedencia de frases

V2-I01 · **Media · Corregido y verificado** en las funciones de exportación. La biblioteca privada conservaba correctamente textos heredados de procedencia desconocida, pero ofrecía compartirlos como texto/PNG. Se conservan historial y favoritas; esas entradas ya no ofrecen compartir, y ambas funciones generadoras rechazan la procedencia no verificada. Las pruebas conservan los originales y verifican escapado SVG. No es DRM ni impide copiar manualmente un texto propio desde el navegador. La declaración de originalidad de las 480 entradas antiguas sigue requiriendo confirmación del responsable; los trece textos nuevos están identificados como redacción de esta entrega. No se inventa una licencia de terceros ni se reintroducen autores sin evidencia.

## CSP y verificación continua

V2-H01 · **Media · Corrección implementada sin verificar en navegador** (endurecimiento, sin XSS explotable confirmado). Cloudflare genera un nonce criptográfico de 128 bits por respuesta, reemplaza cualquier política enviada por el cliente y usa la integración CSP de Vinext 1.4.6 para los scripts RSC/SSR. Se permiten scripts propios y dos orígenes oficiales de widgets; sin comodines, unsafe-inline o unsafe-eval en script-src. Los handlers inline están prohibidos. Las cabeceras previas se conservan. No se presenta esto como una CSP restrictiva de todos los tipos de recursos; Sites conserva la política compatible con su frontera separada.

`check-csp` comprueba rotación, exclusión del nonce del cliente y coincidencia de cada script inline de HTML con la política. La matriz real de navegador conserva 208 recorridos; Axe se ejecuta desde la instrumentación de Playwright sin habilitar bypassCSP ni cambiar la política de la aplicación. Se añade una ejecución independiente con proveedores TradingView reales, sin interceptarlos, que conserva peticiones, consola, resultados y capturas. El resultado remoto sigue pendiente en este checkpoint. Chromium local vuelve a abortar con `socket() failed: Operation not permitted` y salida 134; [log](verificacion-seguridad-2026-11-22/chromium-local.txt).

GitHub Actions queda con contenidos de solo lectura, checkout sin credenciales persistentes y acciones oficiales fijadas a SHAs comprobados por API. No hay credenciales de producción ni paso de deploy en esos workflows. Las pruebas nuevas cubren cuerpos, CSP, abuso por usuario, matriz de permisos, limpieza y recuperación. La instalación reproducible y las pruebas visuales deben terminar realmente en CI antes de cerrar la verificación.

## Búsqueda administrativa y ajuste del entorno visual

V2-S07 · **Baja · Corregido y verificado**. Las búsquedas administrativas permitían 254 caracteres pero usaban LIKE, cuyo patrón en D1 está limitado a 50 bytes. Un correo largo válido devuelve 503 en el Worker anterior ([antes](verificacion-seguridad-2026-11-22/antes/admin-search.txt)). Se usa búsqueda literal parametrizada con instr/lower en usuarios, invitaciones y eventos: conserva coincidencias parciales y evita ese límite. [Después](verificacion-seguridad-2026-11-22/despues/admin-search.txt): correo largo/mayúsculas, símbolos literales y texto SQL aprobados. No había SQL Injection demostrada; se corrige disponibilidad de búsqueda del propietario.

CI detectó dos 429 inesperados al acumular cientos de capturas y todas las interacciones en una única cuenta sintética: ejecución [45049897935](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45049897935), último control de consola fallido aunque los recorridos anteriores pasaban. **Se conserva el límite de producción y la expectativa de cero errores inesperados**. La matriz visual usa identidades ficticias independientes por tamaño/tema, con los mismos datos financieros de prueba, y reserva la cuenta normal inicial para las interacciones. La suite específica de abuso sigue agotando el presupuesto de una sola cuenta al cambiar de IP, incluido acceso concurrente y continuidad de otra cuenta. No se desactivan bindings ni se acepta cualquier 429 como ruido de consola.

## Ensayos de proveedores y reversión

La ejecución real [45050473367](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45050473367) conserva imágenes y 691 respuestas de proveedores, pero su prueba inicial falla: buscaba Resumen estando en Gráfico y examinaba shadowRoot desde JavaScript, inaccesible en componentes oficiales con raíz cerrada. Se inspeccionaron las capturas: Gráfico y otros widgets sí muestran contenido real. La instrumentación también registra una violación eval que se debe resolver/atribuir antes de cerrar la CSP. No se declara aprobada esa ejecución. Se corrige la observación usando el DOM nativo de Chromium por CDP, frames renderizados y capturas, sin habilitar bypassCSP ni unsafe-eval, y se vuelve a ejecutar. La carga real no acredita exactitud de cotizaciones ni configuración de producción.

Se compila por separado el Worker anterior `e26d644` y se ejecuta contra una copia D1/R2 recuperada con esquema 0013: [ensayo de reversión local](verificacion-seguridad-2026-11-22/rollback-local.json). Coteja todas las tablas, versiones, consultas, autenticación revocada/reemitida y capturas; no se limita a hacer checkout. El destino conserva el fallo administrativo de correos largos, documentado en el procedimiento: no se recomienda como lanzamiento definitivo. El version_id y rollback remoto siguen sin verificar.

## Causa confirmada de la violación CSP y corrección

V2-H02 · **Baja · Corregido y verificado en navegador real**. La ejecución [45052699650](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45052699650) localiza eval en el chunk propio de Zod, línea 2/columna 16850; también ocurre en Resumen antes de entrar en Mercados. El código instalado de Zod confirma la prueba de disponibilidad `Function(\`\`)`, capturada internamente pero visible para CSP. No era una exigencia de TradingView. Se centraliza Zod en lib/validation.ts con `jitless:true` **antes** de definir los esquemas, usando la opción oficial, sin permitir unsafe-eval ni cambiar validaciones. La regresión sustituye Function por un guard que contabiliza/falla cualquier intento: esquema real válido pasa, inválido se rechaza y contador queda en cero. TypeScript, lógica, lint, build y seguridad locales pasan. [Documentación oficial de Zod](https://zod.dev/compile).

El último fallo de consola de la matriz b19f fue un 401 de una lectura de frases en vuelo al revocar sesión. Se espera que el servidor la deniegue; el ensayo ahora espera terminar las lecturas antes de pulsar logout y comprueba expresamente que la cookie anterior recibe 401. No se relaja la expectativa general de consola ni se habilita el acceso después del logout.

## Decisión de lanzamiento

**NO APTO PARA PUBLICACIÓN.** Las correcciones y pruebas locales descritas están guardadas en V2. La revisión A–J tiene límites explícitos y faltan configuraciones, respaldo, presupuesto y obligaciones documentales reales. El navegador con Google ficticio no certifica OAuth ni la cuenta Cloudflare. El resultado final de los proveedores se registra en el apartado de cierre; no se deduce su aprobación de una compilación o de la ejecución inicial con mocks.

## Inventario de endpoints y fronteras

Cloudflare comprueba origen configurado, firma/caducidad, sesión activa D1 y estado actual del usuario. Las escrituras requieren cabecera propia y origen no ajeno; cuenta/administración exigen Origin exacto. Sites depende además de la autenticación de su plataforma: no se presenta su cabecera de identidad como un mecanismo utilizable desde Internet. La matriz nueva contiene 60 combinaciones de lectura y 30 de escritura denegadas, más casos activos, BOLA y asignación masiva; [resultado](verificacion-seguridad-2026-11-22/access-matrix.json).

| Ruta/método | Función y actor | Entradas/validación/límites | Respuesta y controles comprobados |
|---|---|---|---|
| GET `/entrar` | Iniciar Google, anónimo | Origen fijo; 20/minuto/IP compartido con callback | Redirección a URL fija, state/verifier aleatorios, PKCE S256, cookie __Host HttpOnly Secure SameSite=Lax, 10 minutos |
| GET `/oauth/google/callback` | Completar acceso | Flujo firmado vigente + state; intercambio en dos URLs Google fijas; email verificado y sub acotado | Estado/aprobación antes de emitir sesión; cookie de siete días + hash D1; errores genéricos. Proveedor real no comprobado |
| GET `/salir` | Revocar sesión propia | Firma y bloqueo de petición cross-site/Origin ajeno | DELETE de hash+usuario, cookie caducada, sin borrar bitácora; cookie revocada no recupera acceso |
| `/correo/enviar`, `/correo/verificar` | Mecanismo antiguo desactivado | Limitador de autenticación | 410; no códigos nuevos ni mensajes al proveedor de correo |
| GET `/api/estado` | Estado público mínimo | Límite API antes de D1, 120/minuto/IP | Solo mantenimiento; sin usuario que lo cambió ni datos financieros; privado/no-store |
| GET `/api/bitacora` | Datos del usuario activo/propietario | Modos metadata/detail/list/analytics/daily-risk/section; filtros Zod, órdenes permitidos, UUID/cursor/revisión; listas 20 o lectura explícita hasta 200; guardas de revisión 409 | Datos propios. Cinco secciones agregadas preservadas. La ruta histórica completa existe por compatibilidad: tiene mayor peso de frecuencia; no se utiliza para la navegación ordinaria |
| POST `/api/bitacora` | CRUD, plan, revisión, importación y restauración propios | JSON 3.000.000 bytes, profundidad 32, esquemas/rangos/enums/arrays; importación hasta 40 por lote; restore acotado y recibo idempotente; relaciones por propietario | Versiones/concurrencia/cuotas D1, transacciones, fuentes no confiables descartadas. No admite eliminar cuentas/setups por una acción inexistente: se archivan mediante sus modelos. Borrado de operación y capturas con cola segura |
| GET `/api/capturas` | Captura propia anterior | Trade UUID + slot permitido, binding R2 y consulta D1 por usuario/trade/slot | R2 privado mediante Worker, nosniff y MIME conservado; no permite elegir object_key desde URL |
| DELETE `/api/capturas` | Desvincular captura propia | Identidad/CSRF, UUID/slot/revisión | 409 si no coincide propietario/revisión; intención D1 atómica antes de borrar R2. PUT no existe |
| POST `/api/frase-diaria` | Compatibilidad de entrega diaria | Identidad/CSRF, día Ecuador, progreso propio idempotente | Catálogo elegible original, sin entregas nuevas del archivo sin procedencia |
| GET `/api/frases` | Historial/favoritas propios | Páginas de 20, q acotada, categoría, orden permitido | Snapshot privado, sin autores inventados, preferencias/versiones por usuario |
| POST `/api/frases` | Preferencias/favoritas/entrega/migración propios | JSON 16.000 bytes/profundidad 32; esquema; IDs; importación hasta 100 favoritas y 100 históricas; nonce manual UUID y máximo diario | Versión CAS y selección transaccional antirrepetición; cola cliente reintenta sin descartar datos |
| POST `/api/mi-cuenta` | Revocar todas las sesiones o borrar cuenta propia | Origin exacto/CSRF; JSON 16 KiB/profundidad 32; acción permitida y confirmación ELIMINAR | Propietario no eliminable; borrado D1 transaccional, limpieza R2 con reintento y revocación; cachés/biblioteca/drafts locales del usuario se limpian desde la interfaz |
| GET `/api/admin` | Usuarios/sesiones/eventos/invitaciones/recursos | Solo propietario; filtros parametrizados y páginas 50, alertas 20; búsquedas literales hasta 254 caracteres | Metadatos de administración/conteos, no notas ni operaciones financieras ajenas. No token de sesión en claro; hashes no permiten iniciar sesión |
| POST `/api/admin` | Accesos, invitaciones, revocación, cuotas, mantenimiento y alertas | Solo propietario + Origin exacto/CSRF, JSON 16 KiB/profundidad 32, unión de acciones Zod | Cuenta propietaria protegida; cuotas efectivas del servidor; mantenimiento reversible con acceso del propietario; evento administrativo transaccional |
| Evento programado | Reintentar limpieza técnica | Binding D1+R2, lotes de 100, claves procedentes de cola, comprobación de referencias | No endpoint público de barrido ni borrado arbitrario; ejecución remota pendiente |
| PDF/XLSX/CSV/PNG/texto/JSON | Generación en navegador | Fuentes privadas anteriores; selección y filtros, confirmación de backup privado; JSON de restauración 20 MB en cliente | Diez perfiles existentes, privacidad y moneda preservadas. No existe un endpoint secreto de generación de archivos ni un exportador que salte la autorización |

No hay contraseñas, JWT adicional, administradores delegados ni órdenes a un bróker. No aplica auditar un sistema de recuperación de contraseñas inexistente. No se afirman cotizaciones, exposición de bróker o patrimonio real.

## Resultado por bloque A–J y cobertura real

| Bloque | Estado de controles comprobados | Evidencia y limitaciones |
|---|---|---|
| A · Secretos/D1/R2 | OK verificado en fuentes y pruebas; V2-S01/S02/S05 corregidos | Escaneo local de historial/textos/build/config; además 16 commits main, 16 árboles y 215 blobs de texto adicionales por API, sin omisiones reportadas. Ocho candidatos remotos son secretos ficticios explícitos de fixtures; no se copian valores. Ramas main/respaldo mantienen 913425d. No verifica secretos efectivos del panel, objetos binarios arbitrarios ni todos los formatos posibles de credenciales. D1/R2 cruzados y fallos parciales probados localmente |
| B · Autenticación/permisos | OK verificado con Google simulado | PKCE/state, perfil verificado, identidad eliminada/reestablecida por Worker, cookies, caducidad/revocación, sesiones de estados denegados, propietario, CSRF y campos internos. Restaurar datos de otra identidad no modifica esa identidad. OAuth real y frontera Sites externa: No verificable |
| C · Entradas/inyecciones/archivos | Corregido y verificado en casos cubiertos | Límites streaming/profundidad; SQL parametrizado y órdenes permitidos; texto SQL/HTML almacenado como texto sin cambiar estructuras/roles/versiones. Exportaciones existentes protegen HTML/SVG/XML y fórmulas CSV; XLSX usa texto explícito para entradas. Suites de restauración/importación/concurrencia/privacidad aprobadas. No es fuzzing universal, antivirus ni decodificación exhaustiva de imágenes |
| D · API/abuso | Corregido y verificado localmente | Límite público, IP y usuario con pesos; 429/Retry-After, cambio de IP, concurrencia y continuidad de otra cuenta. Cuotas D1 existentes conservadas. No hay WAF/Turnstile de cuenta inspeccionado, ni límite mundial estricto por los bindings aproximados. No se añaden desafíos ni compras sin justificación |
| E · Infraestructura/CSP/CI | Corrección implementada; navegador final en curso | CSP por nonce, cabeceras, aislamiento de tests y SHAs de acciones; build con/sin R2. Configuración efectiva de Workers Builds, permisos de cuenta, dominios, staging, rutas, HSTS del dominio real y bindings de producción: No verificable. El intento de lectura normal de la URL pública desde la herramienta web devuelve «not accessible via this tool»; no se probó un ataque ni se deduce que el servicio esté caído |
| F · Dependencias | OK verificado para inventario/audit; residual pendiente | 881 entradas de lockfile con licencia declarada; siete paquetes con scripts nativos/de instalación inventariados. No se revisó manualmente todo el código de terceros. Producción audit 0; desarrollo conserva cadena de cuatro moderados descrita abajo; sin degradación forzada |
| G · Monitoreo/respuesta | OK verificado en mecanismos existentes; Pendiente cierre operacional | Logs genéricos de auth/revocación/401/403/429/5xx; eventos administrativos D1, recibos de restauración, incidencias muestreadas y nueva alerta de cola. No se guardan cuerpos financieros o cookies en logs añadidos. No existe auditoría persistente completa de cada descarga local, ni se certifica integridad inmutable contra el operador D1. Retención, expurgo, alertas reales, destinos y permisos de logs deben confirmarse; procedimiento de incidentes preparado |
| H · Privacidad/legal | Pendiente; revisión preliminar | Flujo/datos reales inventariados, privacidad/condiciones existentes revisadas. Identidad/contacto/retención/bases/derechos y términos comerciales requieren al responsable y revisión jurídica; no se inventan consentimientos históricos ni licencias financieras. Las páginas no se presentan como documentos legales finalizados |
| I · Licencias/recursos | Corrección de compartir verificada; derechos pendientes | OFL de Geist presente, licencias declaradas de paquetes e iconos inventariadas, atribución TradingView conservada, archivo de frases sin autores no acreditados fuera de entregas y ahora de compartir. Originalidad/derechos definitivos de marca/480 textos y uso real de capturas: no acreditados por esta revisión técnica |
| J · Disponibilidad/recuperación | OK verificado localmente; capacidad remota pendiente | Suite hasta 20.000, invalidación/caché/409/paridad preservadas; lecturas completas explícitas, cola acotada y recuperación de cada tabla/blob, revocación y nuevo login ficticio. Compilación de Worker anterior contra datos recuperados probada. No acredita CPU/latencia/consumo del plan real, Time Travel o recuperación física remota |

Se usaron OWASP Top 10, API Security Top 10 (BOLA, propiedades, consumo y funciones) y las áreas de autenticación/sesiones/autorización/validación de ASVS como guías. No se asigna una certificación ni un nivel ASVS aprobado. Los escenarios de fuzzing exhaustivo, navegadores físicos/Safari/lectores de pantalla, persistencia offline tras eliminar y recrear una cuenta desde otro dispositivo y recuperación de una infraestructura real no se han verificado exhaustivamente; no se convierten en resultados aprobados por compilar.

## Dependencias: los cuatro avisos moderados

Se repiten los cuatro avisos ya conocidos, no cuatro fallos independientes de producción. [Audit completo](verificacion-seguridad-2026-11-22/audit-all.json), [producción](verificacion-seguridad-2026-11-22/audit-production.json), [inventario](verificacion-seguridad-2026-11-22/dependencies.json), [Kit vigente](verificacion-seguridad-2026-11-22/drizzle-current.json).

| Paquete afectado | Versión fijada | Introducción y exposición | Solución y evaluación |
|---|---|---|---|
| esbuild | 0.18.20 anidado | core-utils → esm-loader → drizzle-kit, solo desarrollo | GHSA-67mh-4wv8-2f99, corregido upstream desde 0.25.0; afecta a serve/CORS de un servidor de desarrollo accesible a un navegador que visite una web maliciosa |
| @esbuild-kit/core-utils | 3.3.2 | Dependencia anterior; usa transform/transformSync en el recorrido revisado | Paquete deprecado e integrado en tsx. No sustituir su dependencia por un salto incompatible sin prueba específica del proveedor |
| @esbuild-kit/esm-loader | 2.6.5 | Lo introduce Kit; metadatos deprecados, integrado en tsx | La versión estable consultada de Kit todavía lo declara. No asumir que cambiar el nombre del loader mantiene su contrato |
| drizzle-kit | 0.31.11 | Herramienta de esquema/migraciones dev; ORM de ejecución separado 0.45.2 | npm propone 0.18.1 como arreglo mayor/incompatible. Se rechaza esa degradación; no se usa audit fix --force ni un override amplio que oculte el aviso |

El proyecto no invoca esbuild serve ni Drizzle Studio en los scripts revisados; el código de la cadena usa transformaciones. El aviso no se encuentra en el árbol de dependencias de producción. Esto reduce la exposición del flujo actual, sin demostrar que un desarrollador no pueda iniciar el servidor vulnerable por otro medio. Evitar exponer esas herramientas y revisar una actualización estable compatible del proveedor. Estado residual: **Pendiente**, gravedad media de desarrollo, sin RCE o filtración de producción demostrada. Los scripts de instalación y las dependencias transitivas pueden ejecutar código durante npm ci: hashes/SHAs/read-only no son una auditoría de cada implementación de tercero.

## Privacidad y requisitos legales preliminares

Datos efectivos: sub/correo Google, estados de acceso, hashes de sesión/dispositivo/fechas, cuentas/importes/operaciones/psicología/notas, estrategias/historia, revisiones, frases/preferencias/favoritas, capturas privadas, eventos administrativos y copias/colas técnicas. No hay contraseñas propias, pagos, ejecución de órdenes ni integración autorizada de bróker. El propietario administra metadatos/accesos; no se ofrece una API administrativa de lectura de notas/capturas financieras ajenas. El operador de la infraestructura conserva acceso técnico potencial: no se promete cifrado extremo a extremo.

Las cookies de sesión y flujo son de autenticación; preferencias y borradores usan almacenamiento del navegador, sin cifrado propio. No se identificó analítica propia añadida por la app. **Los widgets reales sí contactan servicios de telemetría/pixel de TradingView**, además de recursos/datos, observados en CI; no declarar ausencia universal de seguimiento por terceros basándose solo en una FAQ. No se incluyen notas, operaciones o importes como configuración del widget; usa símbolos/tema/intervalo. Una dependencia de terceros ejecutada en la página sigue siendo una frontera de confianza que debe aceptar/revisar el responsable.

Antes de publicación, el responsable y su asesor deben completar:

| Documento/decisión | Situación real | Validación necesaria |
|---|---|---|
| Responsable y contacto para derechos/soporte | Identidad legal, domicilio/contactos indispensables no confirmados; variable de soporte opcional | Datos auténticos y canal atendido, visibles en política; solicitud de prueba tramitada |
| Finalidades/base jurídica | Registro/análisis y control de acceso identificados; no se presume consentimiento para todo | Determinar base apropiada por tratamiento, destinatarios/encargados y transferencias/garantías; revisar contratos Google/Cloudflare/TradingView |
| Conservación | Cookie siete días y flujo diez minutos son duraciones técnicas; no definen plazo de todos los registros/backups/logs | Definir y documentar plazo/criterio por familia, expurgo y excepciones legítimas. No inventar un número común ni borrar usuarios para certificarlo |
| Acceso/rectificación/eliminación/portabilidad | Editor, exportaciones y eliminación propios existentes; JSON Bitácora no incluye toda la biblioteca ni respaldo operacional | Canal para derechos sobre todos los datos personales, respuesta y verificación de identidad proporcionadas, manejo de copias y borrado técnico |
| Cookies/servicios opcionales | Cookies necesarias identificadas, preferencias/frases locales y widgets cuando se entra en Mercados | Revisar datos observados del proveedor y base aplicable, información/controles y retirada si procede; no crear consentimiento histórico ficticio |
| Condiciones de contratación | Bitácora/análisis; no intermediación ni custodia de fondos detectadas | Confirmar modalidad, precio si lo hay, restricciones, soporte y derechos del consumidor. No suponer una licencia financiera por el nombre del producto |
| Versión/aceptación | Páginas tienen fecha, no evidencia histórica de aceptación contractual | Aprobar versión final y determinar si corresponde registrar aceptación futura; no afirmar aceptación anterior ni forzar consentimiento indiscriminado |

La LOPDP y su reglamento exigen examinar información al titular, bases, derechos, seguridad, conservación y destinatarios; la SPDP mantiene normativa secundaria que debe revisar el asesor según el caso. Para servicios electrónicos, revisar información al consumidor y condiciones conforme a la legislación aplicable. Esta es una revisión técnica preliminar, no un dictamen de cumplimiento.

## Licencias y recursos

| Recurso | Clasificación | Evidencia/pendiente |
|---|---|---|
| Geist | Uso acreditado documental | Archivo public/Geist-OFL.txt conservado con la fuente; no eliminar el aviso al distribuir |
| Iconos/componentes/gráficos/dependencias | Licencia declarada inventariada; distribución final pendiente de revisión | 881 metadatos en lockfile, sin campos de licencia ausentes. No prueba que cada archivo/aviso o uso comercial esté jurídicamente verificado |
| Logo/SVG de marca | Pendiente de verificar | Código de marca en repositorio; responsable debe confirmar titularidad/originalidad y conflictos de marca |
| TradingView | Uso condicionado documentado; revisión final pendiente | Widgets oficiales y atribución visible conservada; términos/limitaciones de datos se mantienen. No usar branding del proveedor como marca propia ni quitar sus avisos |
| Trece frases nuevas | Redacción original de esta entrega identificada | Asistencia de IA declarada, sin citas nuevas de terceros. No se inventa exclusividad de derechos |
| 480 frases antiguas declaradas originales | Pendiente de verificar | Declaración del archivo no equivale a prueba independiente de derechos; confirmar procedencia con el responsable |
| 1.539 entradas antiguas no acreditadas | Uso potencialmente no autorizado para difusión; limitado al archivo privado | Sin autores inventados, sin entregas nuevas y compartir texto/PNG desactivado; no se borra el historial del usuario |
| Capturas/enlaces de usuarios | Pendiente según contenido | No se auditan derechos de cada archivo privado; compartir exige derechos/atribución correspondientes. No certificar permiso de terceros por ser un archivo subido |
| Imágenes externas nuevas/servicios de pago | No aplica en esta entrega | No se incorporan recursos ni servicios comerciales nuevos |

## Presupuesto Cloudflare: límites publicados, no consumo real

Fuentes oficiales consultadas el 22 de noviembre de 2026. No hay sesión/API de la cuenta Cloudflare independiente ni credenciales Google del proyecto en este entorno; las capacidades Sites disponibles corresponden a otra frontera y no acreditan el Worker configurado aquí.

| Recurso | Referencia publicada relevante | Evidencia real de esta cuenta |
|---|---|---|
| Workers Free | 100.000 solicitudes/día, CPU 10 ms, memoria 128 MB | No disponible; Node/Miniflare/Chromium no miden CPU facturable del Worker desplegado |
| D1 Free | 5 millones de filas leídas/día, 100.000 escritas/día, 500 MB por base/5 GB totales | No disponible; prepared statements del benchmark no son filas leídas ni consumo del panel |
| D1 por invocación | 50 consultas Free; un batch cuenta como una consulta para ese límite, con límites por sentencia conservados; 100 parámetros | Consultas/restore/migraciones probadas en emulador, no se extrapola coste físico |
| D1 entradas/búsquedas | Fila hasta 2 MB; sentencia 100 KB; patrón LIKE 50 bytes | Búsqueda administrativa corregida para no usar LIKE; solicitudes/lotes actuales acotados |
| D1 Time Travel | Siete días Free/treinta Paid según documentación del subsistema vigente | Bookmark, subsistema y recuperación efectiva del recurso real no inspeccionados |
| R2 Standard gratuito | 10 GB-mes, 1 millón operaciones A y 10 millones B/mes; borrado sin cargo según tarifa publicada | Plan/clase/objetos/consumo reales no disponibles; no se certifica gratuidad de otro servicio o clase |
| Límites nativos | Aproximados por ubicación, pesos permitidos; no límite estricto mundial | Configuración local y SDK probados; namespaces, efectividad y reglas de cuenta pendientes |

Medidas verificadas: caché por usuario/revisión, páginas y proyecciones, lectura completa explícita, lotes y quotas, límite antes de la consulta pública y por sesión válida, limpieza R2 por cola/lotes sin listado global. El scheduler propuesto ejecutaría hasta 144 invocaciones/día si se activa cada diez minutos; es una estimación de calendario, no métrica ni autorización de activación. Las pruebas grandes hasta 20.000 no garantizan que una consulta fría/SSR cumpla 10 ms en Free. Antes de abrir: medir CPU, percentiles/errores, filas leídas/escritas por ruta, almacenamiento y crecimiento, cuotas de cuenta y cola; acordar capacidad y alarmas sin contratar nada automáticamente.

## Fuentes primarias

- [OWASP API Security](https://owasp.org/projects/api-security-project) y [ASVS](https://asvs.owasp.org/).
- [Google: OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).
- [Cloudflare: límites Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1](https://developers.cloudflare.com/d1/platform/limits/), [precios D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/) y [límites por binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- [esbuild: aviso original](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99); metadatos npm de Kit/paquetes conservados en evidencia.
- [SPDP: normativa vigente](https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/general/normativa/), [responsable](https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/general/responsable-del-tratamiento/) y [derechos](https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/cuales-son-mis-derechos/).
- [LOPDP, publicación oficial](https://www.gob.ec/sites/default/files/regulations/2025-01/01%20Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf), [comercio electrónico en WIPO Lex](https://www.wipo.int/wipolex/es/legislation/details/8118).
- [TradingView: FAQ oficial](https://www.tradingview.com/widget-docs/faq/general/) y [condiciones/atribución](https://www.tradingview.com/policies/). La observación del proveedor real complementa la documentación y no certifica sus prácticas internas.

## Matriz de lanzamiento y responsables

«Verificado local/CI» describe el entorno de la evidencia, sin convertirlo en configuración de producción. No se encontraron vulnerabilidades críticas o altas confirmadas en los escenarios de código probados; ello no demuestra su ausencia en los controles externos no inspeccionados.

| Requisito | Estado | Evidencia | Bloqueo o alcance |
|---|---|---|---|
| Auditoría A–J | Pendiente | Modelo, inventario, hallazgos y cobertura en este informe | Cierre de controles externos, legales y operacionales; no auditoría universal de todos los terceros |
| Vulnerabilidades críticas | Pendiente | Ninguna confirmada en escenarios cubiertos | Configuración efectiva y superficies externas no inspeccionadas |
| Vulnerabilidades altas | Pendiente | Ninguna confirmada en escenarios cubiertos | Mismo límite; no interpretar npm audit como certificación global |
| Riesgos residuales | Pendiente | Cuatro moderados dev y límites de cobertura documentados | Revisar solución compatible del proveedor; acordar observabilidad/retención y presupuesto |
| Secretos/credenciales | Bloqueado | Escaneos de historial, mensajes, configuraciones y build sin credencial real identificada; candidatos ficticios redactados | Valores/permisos/rotación necesaria del entorno real sin inspeccionar; tags no admitidos por el conector |
| Autenticación de aplicación | Verificado | PKCE/state, perfil, cookies y fallos del proveedor simulado | No sustituye prueba Google real |
| Sesiones | Verificado | Revocación/caducidad/fijación/estados, recuperación y nuevo login ficticio | Política y permisos reales del proveedor pendientes |
| Roles/autorización | Verificado | Matriz 60 lecturas/30 escrituras denegadas, BOLA, propietario y asignación masiva | Aplicación compilada aislada; frontera Sites externa no certificada |
| D1 | Bloqueado | Migración 0013/upgrade, cuotas, transacciones, filtros, cachés y recuperación local aprobados | Identificador, esquema efectivo, capacidad, permisos y backup reales |
| R2 | Bloqueado | Aislamiento, fallos parciales, hashes y cola de limpieza local aprobados | Bucket/ACL/dominios públicos, permisos y scheduler reales |
| Worker Cloudflare | Bloqueado | Dos compilaciones y entrypoint standalone comprobados | Cuenta/entorno/rutas/versiones/bindings/builds efectivos desconocidos |
| Google OAuth real | Bloqueado | URLs/configuración esperada y pruebas ficticias | Acceso al proyecto, dominios/redirect y flujo autorizado real |
| CSP/TradingView | Verificado en CI | Nonces, Zod sin JIT; 12/12 casos con proveedor real y contenido reforzado en 45072637654 | Restricción real de PEPPERSTONE:NAS100; AAPL elegido explícitamente sí muestra análisis. Dominio final aún sin verificar |
| Dependencias | Pendiente | Prod 0; cuatro moderados dev de una cadena, sin downgrade incompatible; lockfile/licencias inventariados | Solución estable compatible de Kit o gestión documentada del riesgo residual |
| APIs/límites | Verificado | Cuotas D1, 429/Retry-After, IP y sesión válida entre IP, entrada acotada | Límites aproximados por ubicación, no protección mundial o de facturación garantizada |
| Privacidad | Pendiente | Borrado propio, privacidad en formatos, cachés/drafts por usuario, datos/terceros inventariados | Retención, expurgo, derechos completos y tratamiento de terceros por responsable |
| Licencias | Pendiente | Avisos de paquetes/fuente y atribución; archivo no acreditado fuera de compartir | Confirmación de marca/480 textos originales antiguos y obligaciones de distribución |
| Requisitos legales | Bloqueado | Borradores y revisión preliminar con fuentes oficiales | Identidad/contacto, bases/encargados/transferencias, conservación, derechos y condiciones auténticas |
| Respaldo recuperable | Bloqueado | Procedimiento integral D1/R2 preparado | No existe un respaldo real obtenido/verificado por esta auditoría |
| Restauración probada | Verificado | 25 tablas con datos, tres blobs, relaciones, versiones, hashes y sesiones en dos recursos locales | No es restauración sobre copia del recurso real ni Time Travel remoto |
| Reversión | Pendiente | Worker anterior compilado y ejecutado sobre datos recuperados | Falta version_id remoto seguro y ensayo operacional; candidato anterior tiene limitaciones conocidas |
| Presupuesto Cloudflare | Bloqueado | Límites oficiales separados de medidas locales; mitigaciones de consultas y limpieza | Plan, CPU, lecturas/escrituras, almacenamiento y crecimiento reales sin métricas |
| Pruebas integrales | Verificado en entorno aislado/CI | Suite final 17 aprobados + audit dev conocido; Chromium final 208/48 y TradingView real 12/12 | OAuth/Cloudflare reales, WCAG completo y dispositivos físicos no certificados |
| Preparación de despliegue | Bloqueado | Configuración de código, migración aditiva, procedimiento y commits V2 | Faltan los gates anteriores y autorización específica de operación real |

| Bloqueo concreto | Qué falta y por qué | Quién/cómo resolverlo | Prueba de cierre |
|---|---|---|---|
| Cuenta/recursos Cloudflare | No hay acceso autorizado a la cuenta independiente ni métricas reales; un build con UUID ficticio no demuestra permisos o capacidad | Operador habilita lectura del proyecto correcto y revisa Worker/origen/rutas/entrypoint, D1, R2 privado, namespaces, cron y entornos. Cambios reales solo con autorización específica | Inventario redactado contrastado con configuración, esquema/migraciones y permisos; ejecución programada registrada y cola reducida sin borrar objetos referenciados |
| Google real | No se dispone del proyecto ni de una sesión autorizada para certificar dominio/redirect/secretos y acceso | Responsable verifica aplicación Google, URLs exactas y secretos en proveedor; realiza login en staging autorizado y revocación | Flujo real del propietario y usuario, rechazos esperados, cookie revocada 401 y cero datos ajenos, sin copiar tokens |
| Respaldo operacional real | El JSON Bitácora no incluye todo D1/R2; solo existe un ensayo ficticio | Operador sigue informe 21, copia privada/cifrada de D1/esquema/migraciones/todas las tablas y todos los objetos R2, con manifiesto y control de escrituras | Restauración en recursos nuevos autorizados; recuentos, integridad lógica/FK, versiones, muestras privadas, hashes y autenticación nueva comprobados |
| Reversión real | Git no recupera datos/configuración ni identifica el despliegue compatible | Operador conserva versión/artefactos y version_id seguro, revisa compatibilidad de schema/cliente y plan de sesiones; autoriza ensayo sobre copia | API/datos/assets/capturas/OAuth/cola correctos tras volver a versión segura, sin DROP ni pérdida de tablas nuevas |
| Presupuesto/observabilidad | No se puede prometer funcionamiento Free a partir de CPU Node, conteos de sentencias o muestras de incidencias | Operador obtiene plan y métricas por ruta, revisa cuotas, logs, permisos, retención y alertas; desarrollador ajusta controles con esas medidas | Prueba de carga representativa en staging, CPU/errores/filas/almacenamiento dentro del presupuesto acordado, alertas y backoff comprobados |
| Privacidad/legal | Identidad/contacto/base/retención/derechos/terceros/condiciones sin confirmar | Responsable aporta datos auténticos y asesor revisa obligaciones aplicables; completar versiones y controles/expurgo que resulten necesarios | Políticas finales visibles y coherentes con el sistema, canal de derechos probado, conservación/expurgo comprobados y sin consentimientos históricos inventados |
| Derechos de recursos | La declaración «original» antigua y la presencia de una licencia en package.json no acreditan por sí solas todos los usos | Responsable confirma procedencia/titularidad, avisos de distribución y términos de widgets/capturas; conservar contenido no acreditado privado hasta resolverlo | Registro de procedencia/licencias y avisos; nuevas entregas/compartir no contienen material rechazado |
| Permisos de lanzamiento | La autorización general antigua no autoriza esta operación de producción | Solicitar autorización específica solamente cuando los gates estén comprobados y el despliegue/reversión sean concretos y revisables | Confirmación del responsable para el recurso/versión/migración concretos; ninguna publicación automática de esta auditoría |

Continuación exacta: utilizar los commits y registros de este informe como punto de partida, resolver los gates con el acceso/datos del responsable y repetir únicamente comprobaciones afectadas. No volver a reimplementar paginación, riesgo, calculadoras, reportes, biblioteca o ayuda ya comprobados. Las funciones de monitoreo/expurgo o documentación que dependan de una política auténtica deben completarse antes de considerar cerrada la versión.


## Cierre verificable de esta entrega

El endurecimiento inicial de ejecución llega a `332119497b918152d68a3a6e834b504163aada65`; la corrección adicional de sincronización de frases y su regresión determinista están en `339d2eb8bc550c3766161540b77c27781d8f3437`. Los ensayos reforzados anteriores están en `2b8d17e7474b4bb1f9eb1084874bab7ca9ec6989`. Los commits siguientes conservan evidencia y documentación. La suite completa local registra 17 comandos aprobados y un audit completo con salida 1 por cuatro moderados dev; no se convierte este último en aprobación. La repetición completa tras corregir también la cola de frases está en [final/resultados.json](verificacion-seguridad-2026-11-22/final/resultados.json), con sus logs de seguridad/lint; los registros previos se conservan.

La prueba reforzada [45072637654](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45072637654) aprueba **12/12 casos** de TradingView real y CSP. Registra 721 respuestas externas, cero violaciones CSP antes de las dos inyecciones deliberadas; ambas se bloquean y no se ejecutan. El artefacto 14773424966 y ZIP descargado coinciden en SHA-256 `a2e334f1e977d34d641739425c421c67275cfb1b4abef1ea5424e2f500da462d`. [Resultados íntegros](verificacion-seguridad-2026-11-22/tradingview-resultados.json), [CSP inicial](verificacion-seguridad-2026-11-22/tradingview-csp-baseline.json) y capturas de muestra conservadas con atribución.

La revisión manual de capturas detectó que una ejecución inicialmente aprobada aceptaba el pie de marca de un mapa aún vacío. Se reforzó la prueba: los mapas exigen píxeles de datos coloreados en la captura nativa; análisis técnico exige aguja/arcos coloreados y recomendación. Los mapas finales contienen 337.941 y 3.940 píxeles coloreados, y el análisis AAPL 2.313 más la etiqueta «Venta». No se inventan contadores que el componente compacto no presenta. Se conservan los fallos intermedios 45070478702, 45071381734 y 45071862718 como diagnóstico, sin declararlos aprobados.

**Restricción externa confirmada:** el análisis técnico de `PEPPERSTONE:NAS100` muestra «Permiso denegado» del proveedor y enlace a TradingView. La prueba registra esa indisponibilidad y después elige `NASDAQ:AAPL` explícitamente mediante el formulario, que sí carga. No se cambia el símbolo del usuario de forma silenciosa ni se afirma que todos los instrumentos tengan autorización de incrustación. No es un bloqueo de la CSP y no se relajan sus orígenes.

La ejecución 45071862659 falló en el ensayo de cuota: sus 65 solicitudes se repartieron entre 21:25:58 y 21:26:00 UTC, dos ventanas legítimas del limitador. `tests/rate-window.mjs` reserva al menos 15 segundos del minuto antes de los tres ensayos de ráfaga. Conserva todos los límites y expectativas de 429; solo corrige el calendario de la prueba. La repetición local permite 60 lecturas completas y limita las cinco siguientes, incluidas ocho peticiones concurrentes adicionales; otro usuario mantiene acceso.

El escáner de cierre sobre `12d56f7` revisó 71 commits locales, 733 blobs, 521 archivos tracked y 243 archivos compilados: 14 ubicaciones candidatas revisadas, todas secretos ficticios explícitos de fixtures, ninguna credencial real identificada. El barrido remoto separado conserva la revisión de main/respaldo y blobs ausentes del historial local. Alcance y limitaciones constan en sus JSON; no certifican secretos de panel, formatos desconocidos ni tags no accesibles.

Quedan pendientes de implementación o decisión auténtica, además de los gates externos: política y controles de conservación/expurgo, cobertura completa de auditoría de exportaciones generadas en cliente y decisiones de observabilidad basadas en métricas reales. La auditoría no es inmutable frente al operador D1. La recuperación de cola offline tras borrado y recreación de identidad no está certificada exhaustivamente. Estas limitaciones se conservan para continuación; no se declara terminada toda V2.


## Corrección de sincronización descubierta al repetir el navegador

V2-S08 · **Baja · Corregido y verificado con secuencia controlada en Chromium**. La ejecución [45072637697](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45072637697) aprueba 207 comprobaciones y falla favoritas: una acción añadida mientras `flush` esperaba su última lectura quedaba pendiente hasta el temporizador de 30 segundos. La captura muestra «Biblioteca sincronizada» junto a una acción pendiente; la cola duradera conserva la acción, pero su envío inmediato no estaba garantizado. [Evidencia anterior](verificacion-seguridad-2026-11-22/antes/quote-sync-browser.json).

Se mantiene un único envío activo también durante la lectura, y `drainQuoteSync` vuelve a drenar si apareció trabajo mientras se refrescaba. Ante fallo se propaga el error y se conserva la cola; al cambiar propietario se detiene. Prueba determinista local: encolar durante refresh, error sin pérdida y aislamiento al cambiar propietario. El navegador retiene **la respuesta real** de una lectura, añade «Otra frase» en ese intervalo, libera la lectura y exige respuesta del envío manual antes de 15 segundos. No usa una respuesta inventada ni amplía el timeout para esperar al temporizador. Se repite la suite completa local en [final/resultados.json](verificacion-seguridad-2026-11-22/final/resultados.json), conservando el registro anterior.

La repetición de TradingView sobre el arreglo final `339d2eb` también aprueba **12/12** en [45073382488](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45073382488): 718 respuestas externas, CSP inicial sin violaciones y dos inyecciones deliberadas bloqueadas. Artefacto 14774715380; ZIP descargado SHA-256 `deb3038bdc5bc046689d0a34982101e899a32671b362b35206c7d2e30d31a099`. [Registro final](verificacion-seguridad-2026-11-22/tradingview-final.json). Las muestras gráficas previas conservan su commit de procedencia en el manifiesto.


## Resultado final del navegador y punto de entrega

La repetición [45073382497](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45073382497), sobre `339d2eb`, aprueba **208/208** comprobaciones, incluidas favoritas y la nueva secuencia de acción durante refresh retenido. **48** análisis axe sin infracciones automáticas; cero excepciones JavaScript, cero errores de consola inesperados y cero respuestas 429 en la matriz. Las 19 entradas de consola están clasificadas en el JSON, incluidas fallas de proveedor deliberadamente simulado/desconexión; la prueba separada de TradingView utiliza el proveedor real sin esa interceptación. Artefacto 14774825842; ZIP descargado SHA-256 `932efdf3522ef002e8d69ade876f2415d23c216042c7df8d0388a9c587cec358`. [Resultado](verificacion-seguridad-2026-11-22/browser-final-resultados.json), [accesibilidad](verificacion-seguridad-2026-11-22/browser-final-accesibilidad.json), [consola](verificacion-seguridad-2026-11-22/browser-final-consola.json) y [límites](verificacion-seguridad-2026-11-22/browser-final-limites.json).

La suite local completa se repitió sobre ese commit: 17 comandos aprobados, un audit conocido con cuatro moderados dev; compilaciones/pruebas con y sin R2 aprobadas. El [informe de entrega](22-entrega-verificada-v2-2026-11-22.md) y [manifiesto](verificacion-seguridad-2026-11-22/entrega.json) consolidan commits, archivos, hashes y continuación. Los gates externos/documentales y los controles dependientes de política siguen abiertos; **NO APTO PARA PUBLICACIÓN** y ninguna modificación de producción.
