# Auditoría de seguridad de Tradeify

Fecha: 17 de noviembre de 2026 (Ecuador). Alcance: repositorio privado `tradeifyweb2026-ship-it/Tradeify.web`, rama `main` en `6cbb4b8f853f2b7ceb170551b3a88914c357cd8e`. La copia local coincide con el árbol `13b35eb5d8c9267bfd0f7295bb5c39dd692d1a4a` y tiene una rama local `auditoria/seguridad` sin remoto.

## Resumen ejecutivo

Se corrigieron en una rama local las dependencias con avisos críticos/altos, la reutilización de cookies después del logout, la limpieza de capturas ante confirmaciones inciertas, los límites de frecuencia y cabeceras de protección.
El análisis de dependencias completo queda con 4 avisos moderados en una cadena de herramientas de desarrollo y 0 críticos/altos; el análisis npm de producción queda con 0 avisos.
Las pruebas locales con Workers compilados, D1, R2 y Google simulado verifican aislamiento, OAuth, sesiones, archivos, CSRF, límites 429 y exportaciones.
Las compilaciones Cloudflare con/sin R2, Sites, TypeScript y las migraciones locales pasan.
Las pruebas y correcciones de este informe corresponden a la fase local de auditoría. La publicación fue autorizada por el propietario en un mensaje posterior; su resultado se contrasta con el commit de GitHub y el log de Workers Builds.
Siguen pendientes la revisión del panel, el historial remoto completo, una CSP estricta, el endurecimiento de la herramienta de desarrollo y las comprobaciones visuales en un navegador disponible.
El lint global conserva 5 errores y 5 advertencias que se reproducen en la copia base; el lint de los archivos modificados pasa.

## Inventario inicial

| Componente | Tecnología y alcance |
| --- | --- |
| Interfaz | React y TypeScript, App Router, Vinext/Vite, Tailwind. Bitácora, cuentas, estadísticas, exportaciones, configuración y frase diaria. |
| Servidor | Dos entradas de Worker. `worker/cloudflare.ts` para el despliegue de GitHub y `worker/index.ts` para ChatGPT Sites. |
| Datos | Cloudflare D1 con Drizzle ORM. Cuentas, setups, operaciones, adjuntos, planes, revisiones y progreso de frases. R2 opcional en Cloudflare para capturas privadas. |
| Autenticación | OAuth de Google y correo de propietario en Cloudflare; identidad de ChatGPT suministrada por la plataforma en Sites. No hay gestión de contraseñas propia. |
| Rutas | `/`, `/api/bitacora` (GET/POST), `/api/capturas` (GET/PUT/DELETE) y `/api/frase-diaria` (POST). En Cloudflare, `/entrar`, `/oauth/google/callback` y `/salir` gestionan la sesión. |
| Límites de confianza | El navegador envía inputs y cookies. El Worker o la plataforma de identidad establece el usuario. El servidor consulta D1 y R2 mediante bindings privados y delimita las operaciones por ese usuario. El intercambio de código OAuth y la consulta de perfil se hacen en el servidor con Google. |
| Despliegue y accesos | GitHub `main` → Cloudflare Workers Builds. Proyecto Sites separado. Acceso de lectura a la revisión de GitHub y a la copia de trabajo; sin acceso al panel, a los registros privados ni a los secretos de producción. |

## Prioridades de revisión

| Prioridad | Sospecha o problema confirmado | Componente | Impacto posible | Evidencia y confianza |
| --- | --- | --- | --- | --- |
| P1 | Versiones con avisos críticos confirmadas; explotación del proyecto sin probar | React RSC/Next.js | Ejecución remota o disponibilidad si se alcanza un camino afectado | Alta sobre versiones en el lockfile y avisos del registro; alcance concreto contrastado con los endpoints |
| P2 | Posible clave de sesión tomada de un ejemplo compartido | Configuración Cloudflare | Falsificación de cookies de la versión anterior | Condicionada; el chat contiene un ejemplo y el panel no es accesible |
| P3 | Cookie reutilizable después del logout, confirmado | Autenticación Google | Persistencia de una cookie obtenida por otra vía | Alta; inspección del logout y fallo reproducido de 200 frente al 401 esperado |
| P4 | Acceso a registros ajenos, hipótesis revisada | D1/R2 y API | Lectura o modificación entre usuarios | Alta sobre la prueba de aislamiento y las consultas delimitadas por usuario; no se confirma una vulnerabilidad |
| P5 | Inputs, XSS e inyecciones, hipótesis revisadas | Zod, reportes y endpoints | Datos no autorizados o ejecución de contenido | Alta para los controles y casos concretos probados; sin fuzzing exhaustivo |
| P6 | Ausencia de límites y cabeceras en el código base, confirmado | Worker | Consumo de recursos y menor defensa del documento | Alta sobre el árbol del repositorio; reglas externas desconocidas |
| P7 | Limpieza insegura ante confirmación incierta, confirmado durante revisión | D1/R2 capturas | Pérdida de la imagen referenciada | Alta; reproducción con el handler real y fallos simulados |

## Hallazgos y verificación

| ID | Categoría | Gravedad | Problema | Ubicación | Evidencia | Corrección | Estado | Verificación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Dependencias | Crítica según avisos, explotación remota del proyecto no probada | Versiones con avisos críticos de Next.js y React Server Components | `package.json`, `package-lock.json` | El análisis inicial registra 2 paquetes críticos, 14 altos, 16 moderados y 1 bajo. React incluye GHSA-xqc2-xf4c-x3h3. Next.js incluye rutas de imagen/cache que la aplicación no define. | Actualización dirigida de React/RSC/Next.js, Vinext/Vite, herramientas compatibles, Zod y transitivas afectadas | Corregido y verificado | Análisis completo final sin críticos/altos y compilación/integraciones de ambos perfiles satisfactorias. No se ejecuta una prueba RCE. |
| S02 | Sesiones | Media | El logout no revocaba una copia de la cookie | `worker/google-auth.ts`, ruta `/salir` | Antes de corregir, una cookie reutilizada después de salir recibe 200 al pedir la bitácora. Requiere disponer de la cookie. | Cookie firmada con identificador aleatorio, hash de sesión activa en D1 y revocación al salir | Corregido y verificado | La prueba reproducida antes falla con 200 frente al 401 esperado. Después del cambio recibe 401 y D1 queda sin esa sesión. También se comprueba expiración en D1. |
| S03 | Cabeceras | Baja | Faltaban controles de caché y protección del documento raíz | `worker/cloudflare.ts`, `worker/index.ts`, nuevo `worker/security-headers.ts` | El árbol base solo declara no-store/nosniff en las respuestas de la API. | Cabeceras comunes y protección de marcos externos en Cloudflare | Corregido y verificado | Aserciones sobre el documento raíz compilado; CSP estricta y navegador real pendientes. |
| S04 | Disponibilidad | Media | Rutas OAuth y de datos sin límite de frecuencia en el repositorio | `worker/google-auth.ts`, `wrangler.cloudflare.jsonc`, `cloudflare-env.d.ts` | El árbol base carece de bindings de rate limit y llamadas al limitador; reglas externas desconocidas. | Límites por IP de autenticación y API | Corregido y verificado | Bindings Miniflare, 429 con Retry-After y otra IP permitida, con/sin R2. Su activación externa requiere despliegue. |
| S05 | Dependencias de desarrollo | Media | Aviso de esbuild a través de Drizzle Kit | `package-lock.json` | GHSA-67mh-4wv8-2f99; cuatro paquetes de una misma cadena. | Requiere una versión compatible de la cadena de herramientas | Pendiente | Análisis final confirma el aviso; no se usa su servidor de desarrollo ni se empaqueta en el Worker. |
| S06 | Clave de sesión | Alta si se copió el ejemplo compartido | Posible uso del valor mostrado antes en el chat como clave activa | Variable de Cloudflare `TRADEIFY_SESSION_SECRET` | El chat incluyó un valor de ejemplo. El valor del panel no es accesible. | Si se usó ese valor, generar una clave aleatoria en privado y sustituirla en el panel | No verificable | Solo el propietario puede confirmar el valor activo. Se documentan instrucciones sin repetir la clave. |
| S07 | Integridad de capturas | Media | Una confirmación D1 fallida después de guardar podía borrar el objeto R2 activo | `app/api/capturas/route.ts:65` | Un fallo simulado después de confirmar la escritura y otro al consultar provocan que la limpieza borre el objeto al que apunta D1. La prueba previa falla. | Conservar los objetos mientras el resultado D1 sea desconocido y limpiar solo cuando puede confirmarse el estado | Corregido y verificado | Tres pruebas sobre el handler real con infraestructura sustituida comprueban resultado desconocido, commit confirmado y escritura fallida. La integración D1/R2 normal también pasa. |

## Bloque A — Secretos y base de datos

- **OK verificado** para la separación de secretos en el código Cloudflare revisado. OAuth y HMAC se leen de variables del servidor. Una búsqueda de patrones en los 166 archivos base no encontró credenciales privadas reconocibles. El ID de proyecto, el nombre del bucket y el identificador de base no son contraseñas.
- **OK verificado** en la inspección estática de las consultas de la aplicación. Se usan los parámetros de Drizzle y los `user_id` establecidos por el servidor. Las claves y relaciones compuestas incluyen `user_id`. La API no expone un acceso SQL arbitrario.
- **No verificable** para los valores de secretos y permisos de tokens del panel, el acceso público de R2, las copias de seguridad y la revisión exhaustiva del historial de GitHub. La revisión remota confirma `main` y su último cambio, y la copia coincide con su árbol completo.
- **Pendiente** si se utilizó la clave de ejemplo que se mostró antes en el chat para `TRADEIFY_SESSION_SECRET`. Debe sustituirse por una clave aleatoria generada en privado, pues un ejemplo compartido no constituye una clave secreta. Nunca se replica su valor en este informe.

## Bloque B — Autenticación y sesiones

- Las comprobaciones iniciales con Google simulado validan PKCE, `state`, rechazo del correo distinto al dueño, rechazo de una firma alterada y cookies `__Host-`, Secure, HttpOnly y SameSite=Lax.
- La entrada Cloudflare descarta las cabeceras `oai-authenticated-user-*` enviadas por el cliente antes de establecer la identidad validada. La entrada Sites necesita la puerta de acceso de su plataforma; su protección externa queda **No verificable** desde esta copia.
- **Corregido y verificado** el cierre de sesión con revocación y la caducidad del registro D1. El cambio de formato obliga a volver a iniciar sesión después de aplicar la migración y desplegarlo.

## Matriz de acceso

| Actor | Página de acceso y ejemplo | Leer bitácora | Guardar, importar o borrar | Leer o modificar capturas | Sesiones Google |
| --- | --- | --- | --- | --- | --- |
| Visitante | Permitido | 401 | 401 | 401 | Iniciar flujo con `state` y PKCE |
| Cuenta Google distinta del dueño o correo sin verificar | Permitido | 401 | 401 | 401 | Callback 403 sin sesión |
| Propietario validado | Permitido | Sus datos | Sus datos validados | Sus operaciones y revisión vigente | Sesión con expiración y logout |
| Usuario Sites autenticado por la plataforma | Permitido | Sus datos | Sus datos validados | Sus operaciones y revisión vigente | Sesión administrada por Sites |
| Cabeceras de identidad enviadas desde Internet al Worker Cloudflare | Permitido | 401 | 401 | 401 | Se eliminan antes del enrutamiento |

## Bloque C — Entradas, inyecciones y archivos

- **OK verificado** en la integración local para tipos, rangos y campos permitidos de las acciones. Las claves internas adicionales se descartan por Zod y la identidad procede del servidor. Un nombre de cuenta con texto SQL se almacena como texto y la tabla permanece accesible.
- **OK verificado** para el aislamiento entre dos usuarios de prueba en D1/R2, actualizaciones con versión y revisiones de captura. Se prueban intentos de editar o borrar cuentas, setups, trades y capturas del otro usuario.
- **OK verificado** para JSON inválido (400), cuerpos superiores a 3 MB (413), capturas mayores a 4 MiB (413), SVG o texto con MIME PNG falso (415). El servidor determina PNG/JPEG/WebP por firma y devuelve `nosniff`. Las claves R2 son aleatorias y su descarga pasa por la autorización.
- La comprobación de firma de imagen no es una decodificación integral. **Pendiente** el análisis de imágenes malformadas y consumo del decodificador del navegador. No se ejecutan SVG ni archivos subidos en el servidor.
- **Corregido y verificado** S07. La limpieza ya no convierte un fallo de verificación D1 en ausencia confirmada. Se conservan ambas imágenes si no se puede conocer el resultado. Puede quedar un objeto huérfano cuando falla la confirmación; una reconciliación diferida es un pendiente operativo que debe verificar las referencias antes de borrar.
- **OK verificado** en las pruebas de funciones puras para escapado de HTML en informes y neutralización de fórmulas en CSV/XLSX. El único `dangerouslySetInnerHTML` encontrado está en el componente genérico de gráficos y usa configuración de estilos del código; no se encontró un flujo desde el JSON del usuario hacia él.
- **No aplica** NoSQL, comandos suministrados por usuarios, plantillas ejecutables y consultas de URLs arbitrarias. Las URLs de Google están fijadas en el servidor. Las funciones de exportación usan el navegador.

## Bloque D — APIs y límites

- Se revisaron los tres endpoints de datos y las tres rutas de acceso Google. No hay registro de contraseñas propio, recuperación, IA facturable ni formularios públicos que creen registros.
- **Corregido y verificado** el límite local de `/entrar` y callback (20/minuto por IP) y `/api/*` (120/minuto por IP). Las pruebas con los bindings reales de Miniflare reciben 429 y `Retry-After: 60`, y otra IP puede continuar. Los namespaces preparados son `9976001` y `9976002`, con claves prefijadas por Tradeify. Su activación de producción queda pendiente del despliegue.
- Los límites nativos de Cloudflare son aproximados y por ubicación; no constituyen un cupo global estricto ni detienen una red distribuida. La puerta externa de Sites y las reglas WAF de la cuenta no son inspeccionables aquí.
- **OK verificado** el rechazo de escrituras desde otro Origin, de metadatos `Sec-Fetch-Site: cross-site` y de solicitudes que omiten la cabecera de la aplicación.
- **Pendiente** la paginación para historiales muy grandes. `loadJournal` carga todos los registros propios. No se mide el comportamiento con volúmenes de producción.

## Bloque E — Infraestructura y despliegue

- **Corregido y verificado** en el Worker Cloudflare compilado el cacheado privado, `nosniff`, Referrer-Policy, restricciones de cámara/micrófono/geolocalización y protección contra marcos externos. La política CSP limita base, objetos, formularios y ancestros. **Pendiente** una política estricta para scripts con nonces y su prueba completa con el streaming RSC.
- Sites comparte las cabeceras de privacidad y conserva su inserción en la plataforma. El permiso de ancestros de esa plataforma sigue **No verificable**.
- El perfil Cloudflare usa su entrada de Google, excluye los plugins de identidad simulada y publica `preview_urls: false`. La opción de simulación de Sites solo está en su servidor local de desarrollo.
- El actualizador de Cloudflare conserva las variables del panel mediante `--keep-vars`. Antes del deploy aplica migraciones remotas; ese comando no se ejecuta durante la auditoría. La actualización de herramientas requirió adaptar `migrations_dir` a la resolución actual del plugin. El resultado generado apunta a `../../drizzle` desde `dist/server`. Wrangler lista y aplica las tres migraciones localmente y la segunda aplicación indica que no quedan migraciones.
- No se encontraron workflows `.github` en el árbol auditado. **No verificable** para permisos de GitHub, protección de rama, tokens de builds, preview builds del panel, HTTPS/HSTS efectivos, reglas WAF y bloqueo público de R2.

## Bloque F — Dependencias

- **Corregido y verificado** en el inventario del lockfile el paso de 33 paquetes señalados (2 críticos y 14 altos) a 4 moderados, sin críticos ni altos. Con `--omit=dev`, el inventario npm pasa de 6 a 0 avisos. Esto clasifica dependencias según npm; Vinext y RSC se empaquetan aunque figuren como herramientas, por lo que también se revisa el inventario completo.
- Se actualizaron de forma dirigida Next.js, React, React DOM, RSC, Vinext, Vite y sus herramientas compatibles, Zod y transitivas afectadas. Los overrides limitados fijan `sharp` de Miniflare en 0.35.5 y `fflate` de Satori en 0.7.5. Zod 4 requiere convertir explícitamente a texto un segmento de ruta al mostrar errores de CSV. Se usa `guid()` para conservar el formato de identificadores que admitía Zod 3; se comparó la validación de ambas versiones y se prueba la edición de un ID heredado.
- **Pendiente**, gravedad media, GHSA-67mh-4wv8-2f99 en el esbuild 0.18 transitivo de `drizzle-kit`. Los cuatro paquetes del aviso son la misma cadena `drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild`. La generación de migraciones funciona y esta herramienta no forma parte de los Workers. No se utiliza su servidor de desarrollo. El supuesto arreglo automático propone bajar Drizzle Kit de versión; se descarta por riesgo sobre las migraciones.

## Bloque G — Registro y respuesta

- Se añadieron eventos de creación/revocación de sesión, respuestas de seguridad por área y status, y fallo genérico del Worker. El código de aplicación evita emitir tokens, cookies, correos, cuerpos y consultas URL en estos eventos.
- **No verificable** para la activación y retención de Workers Logs en la cuenta, capturas automáticas de cabeceras/URLs de la plataforma, permisos de lectura, destinos de exportación y alertas. No se ha simulado un incidente externo.

## Bloque H — Privacidad y revisión documental

| Datos | Finalidad y ubicación observadas |
| --- | --- |
| Identificador y correo Google | Autorizar al dueño. El correo y el identificador van dentro de la cookie firmada y los identificadores delimitan los registros D1. El nuevo registro de sesión almacena hash del identificador aleatorio, ID de usuario y caducidad. |
| Operaciones, balances, emociones y notas | Bitácora personal y estadísticas. Se almacenan en D1 por usuario. |
| Capturas | Adjuntos de la operación en R2 cuando está disponible. La base conserva la referencia al objeto. |
| Preferencias de tema, frase y exportación | Almacenamiento local del navegador. No se encontró una copia de la bitácora ni credenciales OAuth en localStorage. |
| Exportaciones | Archivos y acciones de compartir iniciados por el usuario. El respaldo JSON y el CSV de datos son completos; los reportes limitan dinero/notas por opciones. |

- Se revisaron la sesión funcional, preferencias locales y rutas de exportación. No se encontraron etiquetas de analítica/marketing ni píxeles de terceros en el código de la aplicación. La infraestructura de Google y Cloudflare tiene su propio tratamiento, que requiere revisar sus configuraciones y condiciones.
- **Pendiente** una política documentada de conservación/eliminación y la revisión de privacidad si se añaden personas, publicaciones, terceros o uso comercial. El repositorio no contiene aviso legal, política de privacidad ni registro de aceptación de documentos. Se permite borrar trades individualmente y exportar el historial; no hay un borrado integral de cuenta.
- La instalación revisada es una bitácora para un propietario. La aplicabilidad concreta de la LOPDP y de la norma ecuatoriana sobre actividades familiares o domésticas requiere determinar su uso real. Se consultaron los textos oficiales identificados al final; esta revisión no certifica cumplimiento ni determina una base jurídica. No se añadieron casillas ni consentimientos sin determinar esa necesidad.
- **No aplica** al flujo observado una revisión de pagos, reembolsos o contratos de venta, pues no se encontraron cobros ni una tienda. La revisión jurídica y contractual de proveedores queda **No verificable**.

## Bloque I — Licencias y recursos

- **OK verificado** para la presencia y lectura de `public/Geist-OFL.txt`, la licencia MIT del plugin Sites y la atribución de Shadcn en `vendor`. React, Lucide, Recharts y Base UI incluyen licencia en sus paquetes instalados. Esto verifica esos documentos, sin certificar el cumplimiento de todas las obligaciones de distribución.
- El lockfile declara licencias en sus entradas. Se identificaron MIT/Apache/ISC/BSD y también MPL, CC-BY y LGPL en herramientas y binarios de terceros. Su inclusión efectiva y obligaciones deben revisarse antes de redistribuir binarios a terceros.
- **Pendiente** la procedencia y el permiso de reproducción de las 2019 frases, sus atribuciones individuales y el diseño de marca. La presencia del autor en JSON no prueba licencia de reproducción. No se observó una imagen externa de marketing ni vídeo incorporado por la aplicación.

## Bloque J — Estabilidad y comprobaciones opcionales

- **OK verificado** mediante TypeScript, compilaciones de los dos perfiles, integración de datos y exportaciones. El paquete Cloudflare se valida con `wrangler deploy --dry-run` con/sin R2 y conserva los bindings esperados. El paquete con R2 mide aproximadamente 456 KiB comprimido; el dry-run no mide CPU real ni carga.
- El lint global devuelve 5 errores y 5 advertencias. Se reprodujo exactamente el recuento en la copia base con sus dependencias originales. Los archivos afectados (`app/page.tsx`, `components/journal/app.tsx`, `lib/chart.ts` y avisos de otros componentes) no se modificaron. El lint de todos los archivos modificados pasa. La auditoría no califica el lint global como satisfactorio.
- **No verificable** la comprobación visual planificada con Chromium. El proceso no llega a iniciar porque el entorno deniega la creación del socket que utiliza el navegador. El guardado mediante la UI, la impresión en iframe, el viewport 370 px y las métricas de accesibilidad/rendimiento quedan pendientes de prueba manual. Las exportaciones sí se verificaron como funciones y archivos, y las APIs como Worker compilado.
- El CSS y los componentes visuales de la bitácora coinciden con la base. La nueva CSP permite marcos del mismo origen para la impresión existente, pero falta verificar ese comportamiento con el navegador.

## Pruebas ejecutadas

Todas las escrituras de prueba se hacen con D1 y R2 desechables de Miniflare o con persistencia exclusivamente local. Los identificadores, claves y correos usados en pruebas son ficticios. No se cargaron variables de producción ni se ejecutó `npm run deploy:cloudflare`.

| Prueba | Comando o procedimiento | Entorno | Resultado y límites |
| --- | --- | --- | --- |
| Identidad del código | Árbol local obtenido con `git write-tree`, comparado con `main` confirmado por el conector GitHub | Lectura remota y copia local | Coincide con `13b35eb5d8c9267bfd0f7295bb5c39dd692d1a4a`, revisión `6cbb4b8...` |
| Búsqueda de secretos | Búsqueda por patrones de tokens y claves privadas en todos los archivos base versionados | Copia local | Sin coincidencias de credenciales reconocibles. No sustituye la inspección de los valores del panel ni el historial completo. |
| Regresión de logout antes del cambio | Aserción de reutilización de cookie añadida a `node tests/check-cloudflare.mjs`, contra el Worker base | Miniflare, Google simulado | Falla con `200 !== 401`, demostrando el problema |
| Compilación Cloudflare con R2 | `npm run build:cloudflare` con UUID de prueba y bucket ficticio | Local | Pasa |
| OAuth, sesión y cabeceras | `node tests/check-cloudflare.mjs` | Worker Cloudflare compilado, Google simulado | Pasa PKCE, state, dueño, email sin verificar, firma alterada, revocación, expiración D1, origen, cabeceras y 429 |
| Cloudflare sin R2 | Compilar sin `TRADEIFY_R2_BUCKET` y repetir `node tests/check-cloudflare.mjs` | Local | Pasa; capturas indican 503 cuando falta almacenamiento |
| Compilación Sites | `npm run build` | Local | Pasa |
| Bitácora y capturas | `node tests/check-api.mjs` después del build Sites | Worker compilado con D1/R2 e identidades de prueba | Pasa CRUD, permisos entre usuarios, versiones, capturas, límites de tamaño, MIME, SQL literal, campos internos, CSV, deduplicación, planes, revisiones y frase diaria. La identidad Sites se simula; la plataforma externa no se prueba. |
| Fallos de confirmación D1/R2 | `node tests/check-capture-failures.mjs` | Handler PUT real con DB y almacenamiento sustituidos para inyectar el fallo | La prueba previa reproduce la pérdida del objeto activo. Con el cambio pasan los tres escenarios de confirmación y limpieza. Es una prueba de comportamiento con fallos simulados, complementada por la integración normal. |
| Exportaciones | `node tests/check-export.mjs` | Node, datos ficticios | Pasa privacidad del reporte, protección CSV, escapado HTML, XLSX, SVG y JSON. No verifica impresión o renderizado visual en un navegador. |
| Tipos | `node node_modules/typescript/bin/tsc --noEmit` | Local | Pasa |
| Lint de cambios | ESLint sobre workers, servidor HTTP, CSV, esquema, configuración y pruebas modificadas | Local | Pasa |
| Lint global y base | `npm run lint`; comando equivalente en la copia original | Local | Ambos con 5 errores y 5 advertencias; pendiente de mantenimiento |
| Migraciones | `wrangler d1 migrations list/apply DB --local --config dist/server/wrangler.json --persist-to ../migracion-prueba` y segunda aplicación | D1 local desechable | Lista y aplica 0000, 0001, 0002. La repetición informa que no hay migraciones pendientes. |
| Empaquetado | `wrangler deploy --dry-run --config dist/server/wrangler.json` con/sin R2 | Local, sin subir Worker | Pasa |
| Dependencias | `npm audit --package-lock-only --audit=true` y repetición con `--omit=dev` | Registro npm, sin tocar producción | Inicial 33 avisos / final 4 moderados. Producción npm inicial 6 / final 0. |
| Navegador | Intento de Chromium headless con Playwright contra el Worker local | Local | Bloqueado al iniciar por permisos del entorno. Pruebas visuales no ejecutadas. |

### Repetir las comprobaciones principales

Node.js 22.13 o posterior para herramientas. Node.js 22.18 o posterior para importar TypeScript en los scripts de prueba.

```sh
npm ci
export TRADEIFY_D1_ID=11111111-1111-4111-8111-111111111111
export TRADEIFY_R2_BUCKET=tradeify-test
npm run build:cloudflare
node tests/check-cloudflare.mjs
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config dist/server/wrangler.json
unset TRADEIFY_R2_BUCKET
npm run build:cloudflare
node tests/check-cloudflare.mjs
npm run build
node tests/check-api.mjs
node tests/check-capture-failures.mjs
node tests/check-export.mjs
node node_modules/typescript/bin/tsc --noEmit
npm audit --audit=true
```

El UUID y el bucket anteriores son ficticios y solo se utilizan para producir la configuración de prueba. El script de despliegue real comprueba que coincidan con sus variables de producción. Para repetir el dry-run con otra carpeta de salida, usa `--outdir`.

## Archivos modificados y reversión

| Archivos | Función |
| --- | --- |
| `package.json`, `package-lock.json` | Versiones corregidas, resolución compatible y overrides acotados |
| `lib/csv.ts`, `lib/journal.ts` | Compatibilidad del mensaje de validación y de los identificadores heredados con Zod 4 |
| `app/api/capturas/route.ts` | Limpieza conservadora ante fallos de confirmación de escrituras D1 |
| `worker/google-auth.ts` | Sesiones verificables y revocables en D1, forma del payload, origen del logout, límites de frecuencia y eventos sin datos sensibles |
| `db/schema.ts`, `drizzle/0002_auth_sessions.sql`, `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json` | Tabla adicional de sesiones y metadatos generados por Drizzle |
| `worker/security-headers.ts`, `worker/cloudflare.ts`, `worker/index.ts` | Cabeceras HTTP, respuesta controlada a fallos y registro mínimo de estado |
| `lib/server-http.ts` | Comprobación explícita del origen y metadatos de escritura |
| `cloudflare-env.d.ts`, `wrangler.cloudflare.jsonc` | Bindings nativos de límites y tipos |
| `vite.config.ts` | Resolución de migraciones con el plugin actualizado |
| `tests/check-cloudflare.mjs`, `tests/check-api.mjs`, `tests/check-capture-failures.mjs` | Regresiones de seguridad, fallos de confirmación y API compatible de Miniflare |
| `SEGURIDAD_INFORME.md` | Inventario, evidencia, pendientes y pasos manuales |

Se conserva la base en el primer commit de la rama local `auditoria/seguridad`, sin remoto. El árbol base corresponde exactamente a la revisión GitHub `6cbb4b8f853f2b7ceb170551b3a88914c357cd8e` y se conserva también la carpeta de trabajo original. Para revertir, recuperar los archivos de esa revisión en una rama nueva y reinstalar con su lockfile. Las tablas nuevas pueden conservarse al revertir el código. Si se despliega una versión anterior que carece de revocación, reaparece el riesgo S02. Un rollback debe evaluarse con esa consecuencia. La publicación posterior se realiza tras la autorización expresa del propietario.

## Acciones manuales y configuraciones externas

1. **Clave de sesión**. Si `TRADEIFY_SESSION_SECRET` usa el ejemplo del chat, generar una clave nueva en tu dispositivo mediante `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Guardarla como Secret en Worker → Settings → Runtime variables and secrets → Production. Esto cierra las sesiones existentes. No copiar su valor a informes, commits o mensajes.
2. **Revisar la publicación de la corrección**. El comando existente `npm run deploy:cloudflare` aplica `0002_auth_sessions.sql` y despliega con `--keep-vars`. La migración añade una tabla e índice. El recurso D1 y su copia de seguridad se revisan en la cuenta. El propietario autorizó publicar después de la auditoría local; la confirmación de despliegue y migración se obtiene del log de Workers Builds correspondiente al commit publicado.
3. **Validar acceso real después del despliegue**. Iniciar sesión con el dueño, guardar un trade y una captura si R2 está activado, exportar Excel/PDF, cerrar sesión y comprobar que la API exige autenticación. Repetir en móvil de 370 px. La auditoría usa Google simulado; no confirma el OAuth real después de estas correcciones.
4. **R2**. Si se habilitan capturas, abrir el bucket en Cloudflare → Settings y revisar Public Development URL y Custom Domains. Las capturas privadas deben servirse mediante la API autenticada. Si existe una vía pública innecesaria, deshabilitarla tras revisar sus consumidores. No se inspeccionó ni cambió un bucket real.
5. **GitHub y builds**. Revisar colaboradores, protección de `main`, permisos de la instalación GitHub y del token de builds. El despliegue necesita edición de scripts de Workers y D1 para migraciones, y R2 si se utiliza. Mantener secretos de ejecución en el panel; comprobar las variables de build y las vistas previas en la cuenta.
6. **Observabilidad**. Revisar Worker → Settings → Observability y los eventos en Logs. Comprobar quién puede leerlos y si los registros automáticos incluyen la URL de callback con parámetros OAuth. Los eventos añadidos por el código no incluyen esos valores. Definir alertas según el volumen real antes de activar exportaciones o contratar destinos.
7. **Copias de seguridad y respuesta**. Comprobar Time Travel en D1 y ensayar una restauración sobre una copia de prueba. Cloudflare documenta 7 días en Workers Free para Time Travel y 3 días de retención de Workers Logs Free; no se comprobó la configuración ni el consumo de esta cuenta. Si se observa una credencial expuesta, revocarla desde su proveedor y revisar sus accesos.
8. **Pendientes del código**. Evaluar la siguiente versión compatible de Drizzle Kit, resolver el lint base, medir un historial grande y desarrollar una CSP de scripts con nonces antes de activarla. Revisar atribuciones y licencias de las frases antes de difundirlas públicamente.

### Variables y bindings

| Nombre | Propósito | Entorno y configuración |
| --- | --- | --- |
| `TRADEIFY_D1_ID` | Seleccionar la base D1 del build/deploy | Cloudflare Builds → Variables and secrets; local usa UUID de prueba |
| `TRADEIFY_R2_BUCKET` | Bucket opcional de capturas | Cloudflare Builds → Variables and secrets; omitir si no se usa |
| `TRADEIFY_ORIGIN` | Origen HTTPS permitido para la aplicación | Worker, Runtime, Production; texto |
| `TRADEIFY_OWNER_EMAIL` | Correo Google autorizado | Worker, Runtime, Production; texto |
| `TRADEIFY_GOOGLE_CLIENT_ID` | Identificador OAuth | Worker, Runtime, Production; texto |
| `TRADEIFY_GOOGLE_CLIENT_SECRET` | Secreto para el intercambio OAuth | Worker, Runtime, Production; Secret |
| `TRADEIFY_SESSION_SECRET` | Clave de firma HMAC de cookies | Worker, Runtime, Production; Secret aleatorio generado en privado |
| `DB` | Acceso privado a D1 | Binding generado desde el build; incluye tabla de sesiones |
| `BUCKET` | Almacenamiento privado de imágenes | Binding opcional generado desde el build |
| `AUTH_RATE_LIMITER`, `API_RATE_LIMITER` | Límites aproximados por IP | Bindings declarados en `wrangler.cloudflare.jsonc`; sin claves secretas |

## Cobertura real

| Bloque | Cobertura | Limitación principal |
| --- | --- | --- |
| Reconocimiento | Revisado completamente en el árbol identificado | La plataforma y paneles externos no forman parte del árbol |
| A — Secretos/Datos | Revisado parcialmente | Historial remoto completo, permisos del panel, claves activas y backups sin acceso |
| B — Auth/Sesiones | Revisado parcialmente | Flujo real Google y puerta Sites externa sin probar |
| C — Entradas/Inyecciones/Archivos | Revisado parcialmente | Casos prioritarios cubiertos; sin fuzzing exhaustivo ni decodificación completa de imágenes |
| D — APIs/Límites/Bots | Revisado parcialmente | No se prueba tráfico distribuido ni WAF externo |
| E — Infraestructura | Revisado parcialmente | Configuraciones reales de producción y CSP estricta pendientes |
| F — Dependencias | Revisado parcialmente | Inventario completo analizado; sigue un aviso moderado transitivo en cuatro paquetes y no se auditó cada fuente de tercero |
| G — Monitoreo | Revisado parcialmente | Eventos revisados en código; alertas/retención externa sin comprobar |
| H — Privacidad/Legal | Revisado parcialmente, documental | No hay dictamen jurídico ni comprobación del uso real y contratos |
| I — Licencias | Revisado parcialmente | Frases y obligaciones de distribución sin documentación suficiente |
| J — Rendimiento/Estabilidad | Revisado parcialmente | Build/API verificados; navegador bloqueado, lint base pendiente, sin auditoría completa de rendimiento/accesibilidad |

No queda un bloque A–I totalmente sin revisar. El análisis exhaustivo de historial, proveedor, infraestructura, licencias y legalidad, el fuzzing y las pruebas visuales/rendimiento quedan expresamente fuera de la cobertura completada.

## Referencias consultadas

- React, aviso de RCE y versiones corregidas. https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3
- Next.js, condiciones del aviso de ImageResponse. https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
- Aviso de la cadena esbuild pendiente. https://github.com/advisories/GHSA-67mh-4wv8-2f99
- Cloudflare, API nativa de límites y alcance aproximado por ubicación. https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Cloudflare, acceso público de R2. https://developers.cloudflare.com/r2/buckets/public-buckets/
- Cloudflare, copias de seguridad D1. https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare, Workers Logs y retención. https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- SPDP, marco normativo ecuatoriano. https://www.spdp.gob.ec/marco-normativo/
- SPDP, norma de actividades familiares o domésticas, resolución 2026-0003-R. https://spdp.gob.ec/wp-content/uploads/2026/01/03.01.01-SPSP-SPD-2026-0003-R-Norma-general-para-el-tratamiento-en-actividades-familiares-o-domesticas-signed.pdf

## Publicación posterior a la auditoría

El 17 de noviembre de 2026 el propietario solicitó publicar las correcciones y actualizar la documentación. La entrega incluye los cambios de seguridad y la actualización del README, arquitectura, datos, API, instalación, operación, pruebas y guía Cloudflare. La fuente publicada se identifica en la rama `main` de `tradeifyweb2026-ship-it/Tradeify.web` y su historial de commits. Workers Builds aplica las migraciones pendientes mediante el comando de deploy configurado. El estado externo se verifica con los checks que comunique Cloudflare y su log de build/deploy; las pruebas del presente informe siguen siendo locales.

## Actualización trazable V2 · 22 de noviembre de 2026

Los apartados anteriores describen la auditoría histórica y no se borran. La revisión nueva comienza en `84dc36a8a78e662ea04bdf70cc4e1bb3f74cea10`, exclusivamente en `mejoras-v2-2026-11-18`. El [informe 20](documentacion/20-auditoria-seguridad-v2-2026-11-22.md) reemplaza sus conclusiones como estado vigente de V2; conserva la diferencia entre corrección local, proveedor real y configuración de producción. [Operación/recuperación](documentacion/21-operacion-recuperacion-v2-2026-11-22.md).

Se reproducen y corrigen omisión del limitador en estado público, JSON de cuenta sin límite, 413 convertido en 422, profundidad excesiva admitida, pérdida R2 ante rollback D1, abuso autenticado entre IP y búsqueda larga incompatible con D1 LIKE. Se conserva material privado de frases sin procedencia y se bloquea compartirlo; se endurecen scripts con nonce y se desactiva el sondeo/compilación JIT de Zod con su configuración oficial. La migración 0013 añade cola/índices/triggers de limpieza, sin ejecutar cambios remotos. No se reconstruyen las funciones financieras ni los diez reportes.

Estado histórico actualizado: paginación y agregados de las cinco secciones ya están implementados; no siguen pendientes. El lint actual no tiene errores y mantiene una advertencia previa de imagen. Chromium ya está disponible en Actions: 208 comprobaciones y 48 análisis automáticos aprobados en la repetición final 45073382497 sobre `339d2eb`. TradingView real/CSP aprueba 12/12 casos reforzados en 45073382488 sobre código final, con contenido nativo/capturas; la restricción del proveedor para NAS100 y el análisis AAPL explícito quedan registrados en el informe 20. La imposibilidad de iniciar Chromium local persiste con error de socket y no se oculta.

Suite local repetida sobre `339d2eb`: 17 comandos aprobados; audit completo conserva cuatro moderados de desarrollo, no corregidos mediante degradación. Audit de producción: cero avisos, sin que eso certifique toda la aplicación. Historial remoto main y respaldo inventariados por API, fuentes/configuración/build y candidatos de fixtures revisados sin copiar valores secretos; secretos y permisos efectivos de la cuenta externa no se han inspeccionado.

El ensayo operacional restaura datos en las 25 tablas, tres blobs y sus metadatos, comprueba relaciones/versiones, recibos, consultas, autenticación y cola; también prueba un Worker anterior sobre la copia. No representa un respaldo recuperable de producción, Time Travel real ni un rollback remoto autorizado. El JSON privado de Bitácora sigue sin ser el respaldo completo del sistema.

Decisión actual: **NO APTO PARA PUBLICACIÓN**. Faltan configuración/métricas de cuenta Cloudflare, D1/R2 y Google reales, backup y procedimiento operacional real, datos legales/retención/derechos/licencias y observabilidad efectiva. No se ha ejecutado un despliegue, una migración remota, una rotación activa ni una restauración de datos reales. La autorización antigua descrita arriba no autoriza automáticamente el lanzamiento V2 de esta auditoría.

La repetición de navegador encontró una acción de frases pendiente durante la lectura final de sincronización. Se corrige en `339d2eb` con drenaje continuo, conservación de cola ante fallo y aislamiento de propietario; pruebas locales deterministas y retención controlada de una respuesta real en Chromium. El informe 22 y el manifiesto registran el resultado final, sin borrar el fallo anterior.
