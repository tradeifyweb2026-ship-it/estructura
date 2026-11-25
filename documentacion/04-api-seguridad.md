# API y seguridad

## Autenticación

El perfil Cloudflare usa `worker/cloudflare.ts` y `worker/google-auth.ts`. `/entrar` inicia OAuth con Google mediante `state` y PKCE, `/oauth/google/callback` verifica el perfil y `/salir` revoca la sesión. El correo debe estar verificado.
POST /api/mi-cuenta exige sesión, origen y confirmación del cliente. La acción sessions revoca todas las sesiones propias. delete requiere ELIMINAR y limpia los datos y objetos anteriores del usuario.

Las cookies `__Host-` tienen Secure, HttpOnly, SameSite=Lax y firma HMAC. La sesión vence a los siete días y requiere una fila activa en `auth_sessions`. D1 guarda el hash de su identificador aleatorio. Una copia de cookie deja de autorizar después del logout. Se descartan las cabeceras `oai-authenticated-user-*` enviadas por el cliente antes de establecer la identidad verificada.

El perfil Sites recibe `oai-authenticated-user-id` y `oai-authenticated-user-email` de su plataforma. `app/chatgpt-auth.ts` lee esa identidad. Las rutas `/signin-with-chatgpt`, `/signout-with-chatgpt` y `/callback` corresponden a Sites. Su puerta de acceso debe proteger el Worker y controlar esas cabeceras. La simulación de identidad está limitada al desarrollo local.

Cada consulta se restringe por usuario. Las escrituras requieren `X-Bitacora-Request: 1`, comprueban Origin cuando está presente y rechazan `Sec-Fetch-Site: cross-site`. Los secretos OAuth y de firma se configuran en Runtime de Cloudflare. Consulta [la guía de instalación](10-cloudflare-github.md) para los nombres y tipos exactos.

## Límites y respuestas privadas

Cloudflare declara `AUTH_RATE_LIMITER` para `/entrar` y el callback, con 20 solicitudes por minuto por IP, y `API_RATE_LIMITER` para `/api/*`, con 120. La identidad de red procede de `CF-Connecting-IP`. El rechazo devuelve 429 y `Retry-After: 60`. Estos límites son aproximados por ubicación de Cloudflare. El perfil Sites depende de los límites de su plataforma.

Los Workers añaden Cache-Control privado/no-store, nosniff, Referrer-Policy y Permissions-Policy. La CSP limita base, objetos y formularios. Cloudflare permite marcos del mismo origen para la impresión y bloquea ancestros externos. La política estricta de scripts con nonces sigue pendiente de implementación y prueba.

## Diario

GET /api/bitacora devuelve accounts, setups, trades, captures, plan, planVersion y reviews. Carga completa, sin paginación.

POST /api/bitacora requiere application/json; máximo 3.000.000 bytes. El campo action selecciona:

| Acción | Campos adicionales |
| --- | --- |
| saveAccount | id, version, account |
| saveSetup | id, version, setup |
| saveTrade | id, version, trade |
| deleteTrade | id, version |
| savePlan | version, plan |
| saveReview | week, scope, version, review |
| importTrades | accountId, trades: 1–40 objetos {id,key,trade} |

Los objetos siguen `lib/journal.ts`; los retornos de acciones se definen en `db/repository.ts`. Tras escribir, recarga el diario para versiones actuales. Ejemplo desde sesión válida:

```json
{"action":"saveAccount","id":"b129d460-64ab-4245-8ce8-e89b908e6319","version":null,"account":{"name":"Demo","type":"Demo","currency":"USD","startingBalanceCents":1000000,"archived":false}}
```

## Capturas por enlace y legado R2

Los enlaces se escriben mediante `saveTrade`, con el esquema compartido `captureLinkSchema`. Se aceptan únicamente HTTPS y los hosts exactos `tradingview.com`, `www.tradingview.com` y `s3.tradingview.com`; no se acepta un comodín de subdominios. Máximo 300 caracteres, sin espacios, controles, credenciales, puerto no estándar, fragmentos, barras inversas ni HTML. Las variantes fuera de esa lista se rechazan. La existencia/disponibilidad de una captura y los formatos reales de todos los enlaces están **no verificados**; las pruebas usan URLs ficticias y no prometen que una URL sintácticamente válida contenga una imagen.

`/api/capturas?trade=UUID&slot=before` (o after) mantiene GET privado para imágenes heredadas y DELETE con revisión/origen para la limpieza existente. PUT ha sido eliminado y devuelve 405. La UI no sube ni elimina imágenes heredadas al editar un enlace. DELETE requiere `X-Bitacora-Request` y `X-Capture-Revision`, filtra por usuario y elimina R2 solo después de confirmar D1. La eliminación explícita de una operación mantiene su limpieza de adjuntos.

Los enlaces se abren con `noopener noreferrer`. Solo se intenta vista previa de extensiones PNG/JPG/JPEG/WebP del host exacto s3.tradingview.com, mediante img en el navegador y sin proxy, fetch ni resolución de metadatos en el servidor. La vista previa no acredita que el enlace exista. El fallo muestra una alternativa y el botón permanece disponible.

## Frase diaria

POST `/api/frase-diaria` requiere sesión y cabecera de escritura. Devuelve el día de Ecuador y una frase, o `null` si es fin de semana o ya se entregó ese día. La actualización condicional de `daily_quote_progress` asegura una sola entrega entre solicitudes simultáneas. La identidad y la posición del catálogo las establece el servidor.

## Respuestas y errores

Errores: objeto JSON con error textual. Respuestas privadas: Cache-Control private,no-store y X-Content-Type-Options nosniff.

| Código | Motivo típico |
| --- | --- |
| 400 | Cuerpo vacío/mal formado |
| 401 | Falta identidad |
| 403 | Origen/cabecera de edición inválidos, o cuenta Google sin permiso |
| 404 | Registro/captura no disponible para usuario |
| 409 | Versión/revisión obsoleta |
| 413 | Tamaño excedido |
| 415 | Formato no admitido |
| 422 | Contrato/regla de negocio inválida |
| 429 | Límite de solicitudes; respetar Retry-After |
| 500 | Error inesperado sin detalles internos |
| 503 | Almacenamiento, configuración de acceso o servicio no disponible |

Un origen de acceso distinto de `TRADEIFY_ORIGIN` devuelve 421. Los errores de comunicación con Google devuelven mensajes públicos sin credenciales ni respuestas internas del proveedor.

Se registran eventos de creación/revocación de sesión, área y estado de respuestas de seguridad, y errores técnicos mínimos. La bitácora histórica de cambios, las alertas externas y las cuotas por usuario siguen pendientes. La retención y el contenido de los registros automáticos de la plataforma requieren revisión en el panel. El [informe de seguridad](../SEGURIDAD_INFORME.md) recoge la cobertura real y los avisos de dependencias restantes.

El correo usa dos POST del mismo origen, /correo/enviar y /correo/verificar. La sesión común verifica D1 en cada acceso. Cada código dura diez minutos, admite cinco intentos y se consume mediante borrado condicional. login_codes guarda HMAC-SHA-256 con la clave del servidor y fines separados para dirección y código. El limitador de acceso se aplica por IP y otra vez por hash de dirección. La identidad email:correo-normalizado se mantiene separada de google:sub.

## Control de acceso
Google es el único método habilitado en Cloudflare. /correo/enviar y /correo/verificar devuelven 410, incluso si permanecen las variables de Resend. Las sesiones antiguas de correo no autorizan datos privados. Los módulos de correo quedan como código sin ruta de acceso.

GET /api/admin devuelve usuarios paginados (50), filtros por correo/estado, últimas 50 acciones, reglas y hasta 100 sesiones del usuario seleccionado. POST acepta settings, invite, user y revoke, valida con Zod y registra cada cambio en la misma transacción D1. Bloquear, suspender o cambiar duración revoca las sesiones del objetivo. El objetivo es exclusivamente una identidad de Google registrada. La cuenta propietaria se protege frente a estas operaciones.

Estados pending y blocked impiden acceso. suspended impide acceso hasta su fecha o indefinidamente. access_until vence independientemente de la cookie de siete días. Los bloqueos se verifican en cada solicitud privada y en el callback. El modo closed rechaza altas sin autorización previa. approval conserva el alta pendiente. La duración inicial se aplica una sola vez y los siguientes accesos no la renuevan. La sesión que vence no renueva el permiso de la plataforma.

Las reglas globales y los registros administrativos son información exclusiva del propietario y por ello no se delimitan como una bitácora individual. Las acciones sobre usuarios y sesiones sí exigen su userId. Los cambios se aplican a las siguientes solicitudes. Una operación ya autorizada y en curso puede finalizar.

La presentación nueva conserva 400/401/403/410/421/429/503 y el control de acceso. Los datos personales que aparecen en la pantalla proceden del usuario verificado por Google o de su sesión firmada, se escapan como HTML y no se incluyen en parámetros de URL. /api/* devuelve errores JSON y no una pantalla HTML. Se conserva Cache-Control privado sin almacenamiento. No se ejecutan scripts remotos para mostrar rechazos.

TRADEIFY_SUPPORT_EMAIL es opcional y solo debe contener un correo de contacto público autorizado. No se reutiliza automáticamente el correo del administrador. Los borradores locales contienen datos de la operación cuando el usuario pulsa Guardar borrador y se delimitan por identidad. Cerrar el registro permite el reingreso de identidades existentes según su permiso, conservando los controles de bloqueo y vencimiento.

## Contratos V2 del 20 de noviembre

- `restoreBatch` admite `requestId` GUID opcional (la UI lo reutiliza por lote). Responde `{imported,skipped,records:[{key,status}]}`. Un mismo usuario/requestId con distinto contenido devuelve 409; con el mismo contenido devuelve el recibo original. Clientes anteriores sin requestId siguen siendo válidos, con comparación idempotente del contenido existente. Los conflictos/referencias ausentes identifican el registro en el error y no escriben el lote.
- Una comprobación de snapshot y las inserciones/recibo están dentro del mismo `db.batch`. Si cambió un registro entre lectura y escritura, la comprobación falla y D1 revierte todo el lote. Las claves foráneas conservan las relaciones de trades; las revisiones verifican su scope dentro del mismo lote.
- `restoreSetupVersion` exige ID, versión actual y `sourceVersion`. El servidor busca el historial del mismo usuario; no acepta reglas históricas arbitrarias suministradas por el cliente.
- `saveAccount` y `saveSetup` devuelven el registro persistido con versión; la UI reconcilia el estado sin descargar otra vez todas las operaciones. `savePlan`/`saveReview` devuelven la nueva versión.
- Administración admite `quota` con `userId` y `maxTrades` (1–100000 o null). Solo propietario, con origen y sesión verificados; conserva los datos y registra el evento. El trigger de D1 impide inserciones por encima de la cuota también para CSV y restauración.

## Lectura V2 paginada y agregada

GET `/api/bitacora?mode=...` conserva la misma autenticación y caché privada:

| Modo | Respuesta / alcance |
|---|---|
| metadata | Cuentas, setups, plan, revisiones, revisión y conteo; trades/captures vacíos |
| list | Página de 1–200 trades, capturas de esa página, next y revision; count=1 solicita total |
| analytics | Métricas SQL completas y serie diaria; details=1 añade distribuciones; granularity=trade solicita serie exacta por operación |
| detail | ID del propio usuario; registro actual y capturas; 404 si ya no existe |
| daily-risk | Día Ecuador y cuenta: evaluación de cierres/parciales relevantes, sin posiciones flotantes |

Filtros: scope, from/to inclusivos en día Ecuador, q literal (activo/setup/notas), setup, asset, emotion, direction, state, result y sort (latest/oldest/r/duration). Los valores se validan y se enlazan como parámetros SQL. El cursor base64url incluye revisión, valor de orden, ID y fingerprint de usuario/filtros/orden. No concede acceso a otros usuarios; es paginación, no una credencial.

Cada consulta consistente usa un único batch D1 para revisión y lecturas. Revision incorrecta devuelve 409 y no permite continuar un respaldo mezclado. Cursor incompatible o filtro inválido devuelve 422. Los factores infinitos se serializan como `"Infinity"` y el cliente los interpreta explícitamente; no se convierten accidentalmente en null.


## Contratos V2 añadidos el 22 de noviembre

- `GET /api/bitacora?mode=section&section=...`: Psicología, Revisiones, Cuentas, Estrategias y Riesgo. Respuesta `section/model/metadata/revision/cache`; metadata contiene ID/versión de cuentas, estrategias y plan para comprobar coherencia, no operaciones. Las consultas conservan aislamiento del usuario y revisión transaccional.
- Psicología admite cuenta y fechas de cohorte. Revisiones utiliza `start/end/previous/reviewKey`, fin exclusivo y `historyBefore` para páginas de veinte claves. Cuentas, Estrategias y Riesgo usan historial de cuenta completo en servidor. Los filtros de operación no admitidos devuelven 422; no se ignoran silenciosamente.
- `mode=metadata` no incluye reflexiones por defecto. `reviews=all` se reserva para la lectura completa explícita de respaldos/exportaciones. Un cambio de configuración concurrente exige metadata coherente antes de renderizar los agregados.
- `GET /api/frases`: `view=history|favorites`, `page`, `q`, `category`, `order=newest|oldest`; veinte resultados y total. `POST` admite preferencias con versión, favorita, entrega con nonce manual y migración del historial local. Cuerpo hasta 16 KB, validación y CSRF; todas las filas se acotan al usuario autenticado.
- `GET /api/estado`: mensaje/versión/fechas del mantenimiento, sin identidad administrativa ni información de usuarios. En modo activo, las escrituras normales reciben 503 con Retry-After; la cuenta propietaria conserva el acceso administrativo.
- `GET /api/admin?mode=resources`: conteos internos, comparación de altas por fechas y alertas. `alertPage/alertFilter/alertQ` paginan y buscan en servidor. Las métricas externas se devuelven no disponibles. Acciones administrativas `maintenance` (versión, estado, mensaje, finalización) y `alert` (revisada/resuelta) conservan CSRF, protección del propietario y auditoría.
- Los incidentes técnicos guardan únicamente códigos/fechas/muestras, sin cuerpos, credenciales, enlaces privados ni errores completos de proveedores.

Los contratos y su verificación se detallan en [el informe vigente](19-modulos-v2-2026-11-22.md). No se añadieron accesos de prueba al Worker publicado.
