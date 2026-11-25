# Publicación V2 y pasos del propietario

**Continuación vigente:** el propietario informa D1 `tradeify`, binding DB y registro 0000–0005, sin BUCKET observado. Falta contrastarlo con acceso real. Google completó la confirmación del dispositivo, pero Cloudflare devolvió «Unable to sign in. Try again or use your email and password». No se ha accedido al panel ni aplicado migraciones/despliegues remotos. Véase la sección I; la antigua nota de contraseña rechazada de A es histórica y queda sustituida por este resultado.

Actualizado el 23 de noviembre de 2026 (Ecuador). Inicio de esta preparación: `7758c55007b07339fa74de2c66ba0a32ba209b89`, rama exclusiva `mejoras-v2-2026-11-18`. Este documento continúa la entrega 29; no vuelve a desarrollar sus funcionalidades. **La V2 nueva todavía no está publicada. No ejecutar cambios en producción siguiendo solo una lista de comandos: primero identificar el destino, recuperar y ensayar su respaldo, aprobar el plan D1 y después aprobar el despliegue final.**

## A. Estado real de publicación

| Elemento | Evidencia y estado |
|---|---|
| Web existente | Abierta realmente en navegador: [tradeify.tradeify-web-2026.workers.dev](https://tradeify.tradeify-web-2026.workers.dev/). HTTPS; bienvenida «Tu bitácora de trading», acceso Google y páginas legales enlazadas. Esto no prueba login, datos, capturas ni que contenga V2. |
| Worker y cuenta | `tradeify`. Un check real de GitHub «Workers Builds: tradeify», exitoso sobre main `913425d042c681d1682bd7df11facda70d26c4d2`, enlaza a la cuenta `737181f887017ea0f0cdbd6acd6a45d0`. Falta contrastar esa cuenta en el panel autenticado. |
| Versión que sirve ahora | **No determinada.** Un build histórico exitoso no demuestra la versión actualmente activa. Registrar `version_id`, despliegue activo y fuente desde Deployments antes de cambiarla. |
| Fuente V2 en GitHub | Referencia inicial `7758c55007b07339fa74de2c66ba0a32ba209b89`, con las funciones de la entrega 29. Código de preparación comprobado: `2272e9580a795411dca035a2ec064869c2a57752`. El commit de cierre posterior solo incorpora documentación/evidencia y se identifica por HEAD, sin hash autorreferente. |
| Staging publicado | **No creado ni desplegado en esta preparación.** Se ensaya localmente un destino ficticio separado; no se presenta como servicio real. |
| Producción V2 | **No desplegada.** Main y la base productiva permanecen sin cambios de esta preparación. |
| D1 real | UUID, esquema, registro de migraciones y filas no inspeccionados: falta acceso autenticado. No se afirma que 0014–0016 estén pendientes en esa base. |
| R2 real | Bucket, privacidad, objetos, permisos y plan no inspeccionados. No se afirma que esté ausente ni que funcione. |
| Google real | No probado. El botón visible no demuestra que el cliente, callback o propietario estén configurados. |
| Acceso Cloudflare | `wrangler whoami` informa ausencia de autenticación. El navegador llega al login. Un error transitorio de verificación se resolvió con una recarga. Se eligió Google mediante formulario seguro, pero Google rechazó la contraseña; no se completó el acceso. No se guardan credenciales ni URLs de autenticación en esta evidencia. No se declara un bloqueo permanente del sitio. |
| Perfil alternativo Sites | `.openai/hosting.json` conserva `appgprj_6afb534caa04819191877ec07e2636e6`, DB/BUCKET. La consulta con el acceso actual devuelve NOT_FOUND; no se recrea ni sustituye su identidad. El URL alternativo documentado no acredita una publicación V2. |

En GitHub se conservan catálogo privado vacío, asociación histórica confirmada, scripts cifrados con recuperación, **diez calculadoras**, bitácora paginada y agregados completos, riesgo/cuentas, estrategias/psicología/revisiones, diez perfiles de reportes, Terminal 1:1/4:5/9:16, R/% y privacidad, QR y snapshot de 30 días revocable, capturas/fallback, flujos separados, móvil, administración, ayuda y frases. [Entrega funcional, 25 fases y evidencia previa](29-entrega-terminal-qr-ux-2026-11-23.md). Ninguna de esas funciones se cuenta aquí como verificada en producción.

### Protección de publicación implementada

Se corrigió un riesgo verificable del procedimiento anterior: `deploy:cloudflare` ejecutaba migraciones remotas automáticamente. Ahora:

1. `validation` es el destino predeterminado y no permite operaciones remotas del asistente de release.
2. Staging requiere Worker y D1 distintos de los identificados como producción; si tiene R2, exige un bucket distinto y conocer el productivo. `NONE` solo significa que el operador confirmó que producción no tiene R2.
3. La compilación conserva commit, estado limpio de fuente, destino, hashes de migraciones y huella de **todos** los archivos servidor/cliente. Publicar rechaza cambios, artefactos alterados, build de otra fuente/destino o build realizado con cambios sin registrar.
4. La inspección lee esquema/registro y `PRAGMA foreign_key_check`; no crea tablas, no aplica SQL ni marca migraciones como ejecutadas.
5. Deploy exige esquema y registro compatibles, vuelve a verificar el artefacto y usa `--keep-vars`; **no ejecuta migraciones**.
6. Producción exige `TRADEIFY_APPROVED_DEPLOY_SHA` igual al SHA completo del artefacto. Este valor registra la decisión del operador: **no demuestra por sí solo respaldo, aprobación del usuario, pruebas remotas o requisitos legales**. No se configura aquí sin aprobación final.

Estas protecciones cubren los comandos del repositorio. Un operador con credenciales puede usar Wrangler directamente; no sustituyen el control de permisos. La repetición actual sobre `2272e95` aprobó **219/219 en Chromium real, 68 análisis axe sin infracciones automáticas**, cero excepciones JavaScript y cero entradas de consola inesperadas (24 esperadas conservadas). [Ejecución actual](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45202177791) y [manifiesto/hashes](verificacion-publicacion-2026-11-23/chromium/manifest.json). Son pruebas aisladas con Google ficticio, no un despliegue V2 ni validación del cliente OAuth real.

## B. Lo que tú tienes que hacer en Cloudflare

### 1. Entrar y reconocer la instalación existente

1. Abre [dash.cloudflare.com](https://dash.cloudflare.com/) e inicia sesión con la cuenta que administra Tradeify. Usa el formulario seguro; **no envíes contraseña, tokens ni secretos al chat**.
2. En el selector de cuenta, busca la que contiene el Worker **tradeify**. El ID observado en el check es `737181f887017ea0f0cdbd6acd6a45d0`. Si no aparece, cambia de cuenta o solicita al administrador acceso; no crees otro Worker para sustituirlo.
3. Abre **Workers & Pages → tradeify → Deployments**. Anota, en un registro privado, la versión activa (`version_id`), fecha, URL y último despliegue que funciona. Conserva la referencia de [Builds observada](https://dash.cloudflare.com/737181f887017ea0f0cdbd6acd6a45d0/workers/services/view/tradeify/production/builds/0a4f5ce5-a8d7-42c9-a196-024fdb4a7fbc).
4. Abre **Bindings** (en algunas vistas, **Settings → Bindings**). Debe existir binding **DB**, tipo D1. Pulsa su recurso y anota **nombre y Database ID**. Si hay **BUCKET**, anota el bucket real. No copies valores de secretos ni sustituyas recursos.
5. En **Settings → Domains & Routes**, comprueba que corresponde al origen HTTPS observado. No agregues un dominio nuevo todavía. Revisa **Settings → Builds**: el repositorio documenta main como rama automática. Antes de una integración autorizada, revisar o pausar sus disparadores para impedir una publicación accidental; anotar cómo reanudarlos. En esta preparación no se cambia main ni esa conexión.

**Resultado esperado:** identificar sin ambigüedad cuenta, Worker, D1, bucket y versión activa. Si DB no figura, aparece otra cuenta o hay errores de permisos, detener cambios y resolver el acceso. No inventar los valores que faltan.

### 2. Crear pruebas aisladas, cuando esté confirmado el destino

Nombres propuestos, **no recursos ya existentes**: Worker `tradeify-v2-staging`, D1 `tradeify-v2-staging`, bucket privado `tradeify-v2-staging-capturas`. Si ya existen, comprobar propietario/uso y no reutilizarlos a ciegas.

1. En **Storage & databases → D1 → Create database**, crear la base de staging vacía y copiar su UUID real. Compararlo con el de producción: deben ser distintos. No importar datos privados de producción sin autorización para esa copia.
2. En **R2 Object Storage**, comprobar primero el plan y la activación existente. Crear el bucket de staging solo si no requiere aceptar una suscripción, pagar o ampliar el plan sin tu decisión. Elegir **Standard**, mantener **Public access/r2.dev y Custom domains desactivados**. No publicar el bucket. Sin un R2 real se puede ensayar la alternativa sin adjuntos, pero no certificar capturas ni recuperación R2.
3. El Worker de staging se puede crear al desplegar el artefacto por CLI. Si se crea desde el panel, no conectarlo a main ni usar la plantilla para reemplazar el Worker productivo. Usar bindings **DB** y **BUCKET** con esos recursos de staging exclusivamente.
4. Aplicar las migraciones solo a la nueva D1 vacía, cerrar el registro de pruebas con el SQL de C y configurar el correo propietario real **antes de exponer la aplicación**. Configurar un secreto de sesión propio de staging y preferiblemente un cliente Google separado.
5. Desplegar staging, configurar su origen real y su callback en Google y ejecutar la matriz de pruebas. El URL de staging debe obtenerse del resultado real del despliegue/panel; no se inventa a partir del nombre.

### 3. Variables de compilación y de ejecución

Son dos grupos distintos. Las variables de compilación seleccionan **a dónde se publica**; las de ejecución definen **cómo funciona el Worker**. Nunca usar prefijo `VITE_` para claves privadas.

| Compilación: Builds → Variables and secrets, o PowerShell local | Valor que corresponde |
|---|---|
| `TRADEIFY_DEPLOY_ENV` | `staging` o `production`. Predeterminado `validation`, que bloquea operaciones remotas del release. |
| `CLOUDFLARE_ACCOUNT_ID` | ID de la cuenta contrastado en el panel; no es API token. |
| `TRADEIFY_WORKER_NAME` | `tradeify` en la instalación productiva confirmada; nombre distinto para staging. |
| `TRADEIFY_D1_NAME` | Nombre exacto del recurso D1 real seleccionado. |
| `TRADEIFY_D1_ID` | UUID real del D1 seleccionado, obtenido en Bindings/D1. |
| `TRADEIFY_R2_BUCKET` | Bucket privado real del entorno. Omitir solo si se verificó que ese entorno no utiliza R2. No retirar el de producción si conserva capturas. |
| `TRADEIFY_PRODUCTION_D1_ID` | Obligatorio al compilar staging; UUID de producción para impedir que coincidan. |
| `TRADEIFY_PRODUCTION_WORKER_NAME` | Productivo confirmado; predeterminado `tradeify`. |
| `TRADEIFY_PRODUCTION_R2_BUCKET` | Para staging con R2: bucket productivo confirmado; `NONE` solo si se comprobó su ausencia. |
| `TRADEIFY_APPROVED_DEPLOY_SHA` | Solo después de la aprobación final de producción: SHA Git completo, exacto y ya probado. No es secreto ni una aprobación automática. |
| `NODE_VERSION` | Node 24 compatible; en esta preparación se utiliza 24.22.3. Mantener package-lock y ejecutar npm ci. |

| Ejecución: Worker → Settings → Variables and Secrets | Tipo y valor |
|---|---|
| `TRADEIFY_ORIGIN` | Texto. Producción actual: `https://tradeify.tradeify-web-2026.workers.dev`, sin barra final ni ruta. En staging, el origen real diferente. |
| `TRADEIFY_OWNER_EMAIL` | Texto. **Tu correo Google real verificado**, elegido por ti; da administración. No se deduce de tu cuenta GitHub. |
| `TRADEIFY_GOOGLE_CLIENT_ID` | Texto. Client ID del cliente web de Google de ese entorno. |
| `TRADEIFY_GOOGLE_CLIENT_SECRET` | **Secret**. Secreto de ese mismo cliente; copiar desde Google directamente al campo secreto de Cloudflare. |
| `TRADEIFY_SESSION_SECRET` | **Secret**, aleatorio y con al menos 32 caracteres. Propio de staging. No reemplazar el productivo como parte rutinaria del despliegue: invalida sesiones. |
| `TRADEIFY_MAX_TRADES` | Texto opcional; 5000 por defecto. Las cuotas individuales se administran en Tradeify y se aplican en servidor. No equivale al límite de facturación D1. |
| `TRADEIFY_MARKET_SYMBOL` | Texto opcional; por ejemplo `OANDA:EURUSD`. Disponibilidad según TradingView. |
| `TRADEIFY_SUPPORT_EMAIL` | Texto opcional, contacto real de soporte. No inventar uno para completar la pantalla. |

Para un entorno **nuevo**, genera el secreto de sesión en tu dispositivo: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Mantén la terminal privada, pégalo en **Add → Secret**, conserva recuperación en tu gestor seguro y cierra esa terminal. No pegarlo aquí. La clave personal y el código de recuperación de Pine Script se generan y usan en el navegador; no son secretos que deban copiarse a Cloudflare.

Las antiguas variables Resend no habilitan autenticación por correo en V2; esas rutas están desactivadas. No crear un servicio de correo para este lanzamiento.

### 4. Cron, logs y presupuesto

En **Settings → Trigger Events/Cron Triggers**, el código declara `*/10 * * * *` (cada diez minutos). Verificar que el cron exista realmente y que **Observability → Logs** registre ejecuciones correctas y reducción de la cola de limpieza. No declarar éxito porque aparezca en el archivo. No vaciar colas manualmente.

Revisar **Metrics/Observability**, **D1 → Metrics**, **R2 → Metrics** y **Billing/Usage** de la cuenta. El panel administrativo de Tradeify muestra medidas internas, cuotas e incidencias; no sustituye factura ni todos los consumos de Cloudflare. Registrar plan, límites, presupuesto y canal de alertas reales. La capa gratuita de R2 Standard no impide cargos por exceso; no activar planes, facturación o alertas de pago sin tu decisión. Mantener logs sin cuerpos financieros, cookies o secretos y definir su retención.

## C. Lo que tú tienes que hacer en D1

### ¿Crear otra base?

**Para producción existente: no.** Primero reconocer el binding actual para conservar las operaciones. **Para staging: sí, una nueva vacía y distinta**, salvo que se confirme un recurso de pruebas ya aislado. Reemplazar DB por una base vacía puede hacer que el historial parezca perdido aunque siga en el recurso original.

### Preparar los comandos en tu computadora

Abrir PowerShell dentro de la carpeta clonada **Tradeify.web**. Instalar Git y Node 24 de fuentes oficiales si faltan. Si ya tienes cambios locales, guardar y revisar antes; no usar reset/clean para descartarlos.

```powershell
git status --short
git fetch origin
git switch mejoras-v2-2026-11-18
git pull --ff-only origin mejoras-v2-2026-11-18
git rev-parse HEAD
npm ci
node node_modules/wrangler/bin/wrangler.js login
node node_modules/wrangler/bin/wrangler.js whoami
```

El login ocurre en tu navegador. No crear ni enviarnos un token por chat. Verificar que la cuenta que muestra whoami coincida con el Worker. Un token, si el administrador lo necesita para automatización, se guarda como secreto del entorno de ejecución de la herramienta, con alcance mínimo; no en Git ni en los ejemplos siguientes.

**Plantilla de staging**: reemplazar todos los textos `REEMPLAZAR_...` por los valores obtenidos del panel. Son marcadores, no nombres confirmados. No copiar UUID de tests. Las variables siguientes no son credenciales.

```powershell
$env:TRADEIFY_DEPLOY_ENV = 'staging'
$env:CLOUDFLARE_ACCOUNT_ID = 'REEMPLAZAR_ID_CUENTA_CONFIRMADO'
$env:TRADEIFY_WORKER_NAME = 'tradeify-v2-staging'
$env:TRADEIFY_D1_NAME = 'REEMPLAZAR_NOMBRE_D1_STAGING'
$env:TRADEIFY_D1_ID = 'REEMPLAZAR_UUID_D1_STAGING'
$env:TRADEIFY_PRODUCTION_D1_ID = 'REEMPLAZAR_UUID_D1_PRODUCCION'
$env:TRADEIFY_R2_BUCKET = 'REEMPLAZAR_BUCKET_PRIVADO_STAGING'
$env:TRADEIFY_PRODUCTION_R2_BUCKET = 'REEMPLAZAR_BUCKET_PRIVADO_PRODUCCION'
npm run build:cloudflare
npm run release:dry-run
npm run release:inspect -- --remote --output work/inspeccion-staging.json
```

Si staging realmente no usa R2, quitar su variable con `Remove-Item Env:TRADEIFY_R2_BUCKET -ErrorAction SilentlyContinue`. Esa variante no certifica R2. Estas variables eligen un perfil de compilación propio del proyecto; no añadir `--env staging` a Wrangler ni retargetear/editando dist. Compilar de nuevo al cambiar destino, fuente o migraciones.

### Inspección sin modificar la base

`release:inspect` compara el esquema efectivo (tablas/columnas a través del SQL, índices y triggers), registro de migraciones y relaciones con las 17 migraciones 0000–0016. Guarda un informe privado en `work/`, ignorado por Git. Si falla la lectura no interpreta la base como vacía.

- `ready: true`, sin diferencias y `foreignKeyViolations: 0`: se cumple la comprobación estructural; **no prueba los datos, el backup ni el funcionamiento remoto completo**.
- `not-recorded`: falta el registro de esa migración; revisar objetos y plan antes de aplicarla.
- `unknown-registry-absent` y `baselineRequired: true`: hay tablas pero no registro confiable. **Detenerse**. No aplicar 0000 a ciegas ni marcar todas como ejecutadas. Comparar/restaurar sobre copia y proponer un plan específico.
- `different` o `missing`: detener el despliegue e investigar en una copia. Una marca «aplicada» no garantiza que los triggers estén presentes.

**Importante en Wrangler 4.164.0:** `d1 migrations list` inicializa `d1_migrations` con CREATE TABLE si falta. Por eso no se usa como primera lectura de una producción que todavía no tiene respaldo y aprobación. El inspector nuevo solo usa SELECT y `PRAGMA foreign_key_check`.

| Migración nueva de la entrega anterior | Qué incorpora | Estado en D1 de producción |
|---|---|---|
| `0014_asset_catalog.sql` | Catálogo privado, alias y revisiones asociadas. | No inspeccionado; no afirmar pendiente/aplicada. |
| `0015_private_scripts.sql` | Bóvedas y scripts cifrados, control de tamaño/cuotas. | No inspeccionado. |
| `0016_public_trade_shares.sql` | Snapshot público, índices hash/propietario/caducidad, congelación, cuotas y cascadas. | No inspeccionado. |

Estas tres son aditivas. No se elimina historial con ellas, pero cualquier aplicación sobre datos reales requiere verificar esquema y respaldo. Las migraciones anteriores también deben corresponder exactamente al destino; no ejecutar un lote elegido solo por su número. El registro existente no guarda hashes del contenido; se conserva la huella de los archivos revisados junto con el plan y se compara el esquema.

### Ensayar en staging vacío

**Escritura remota, solo staging nuevo comprobado.** No ejecutar si el UUID corresponde a producción o hay datos no autorizados en esa base.

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config dist/server/wrangler.json
node node_modules/wrangler/bin/wrangler.js d1 execute DB --remote --config dist/server/wrangler.json --command "UPDATE access_settings SET mode='closed', default_days=NULL WHERE id=1;"
npm run release:inspect -- --remote --output work/inspeccion-staging-despues.json
```

El segundo comando cierra el acceso de nuevos usuarios a **staging**, manteniendo el acceso del correo propietario configurado. No es una instrucción para cerrar o alterar producción. El entorno de pruebas debe estar cerrado antes de abrir su URL. El modo Testing de Google con scopes básicos no sustituye este control.

Después de configurar runtime/Google y con una copia Git limpia:

```powershell
npm run build:cloudflare
npm run release:dry-run
npm run deploy:cloudflare
```

El manifiesto debe indicar fuente limpia. No guardar informes privados dentro de rutas versionadas. No eliminar archivos ajenos para conseguir estado limpio: conservarlos fuera de la copia de despliegue o utilizar otra copia limpia del mismo commit. La salida de deploy y el panel dan URL y versión reales. Registrar ambas y probarlas.

### Respaldo recuperable de producción: antes de cambios

Este respaldo **no existe todavía en la evidencia de esta preparación**. El JSON que exporta Bitácora no contiene toda la base administrativa ni todos los blobs. Seguir el [procedimiento completo de operación/recuperación](21-operacion-recuperacion-v2-2026-11-22.md): ventana consistente, escrituras detenidas incluyendo propietario y cron cuando corresponda, SQL completo, R2 completo, metadatos, configuración, hashes y restauración en copia. El mantenimiento permite al propietario escribir: por sí solo no congela todos los datos.

Para preparar **solo lectura/exportación**, abrir una terminal separada y seleccionar producción con los valores reales verificados. No reutilizar inadvertidamente el dist compilado para staging:

```powershell
$env:TRADEIFY_DEPLOY_ENV = 'production'
$env:CLOUDFLARE_ACCOUNT_ID = 'REEMPLAZAR_ID_CUENTA_CONFIRMADO'
$env:TRADEIFY_WORKER_NAME = 'tradeify'
$env:TRADEIFY_D1_NAME = 'REEMPLAZAR_NOMBRE_D1_PRODUCCION'
$env:TRADEIFY_D1_ID = 'REEMPLAZAR_UUID_D1_PRODUCCION'
$env:TRADEIFY_R2_BUCKET = 'REEMPLAZAR_BUCKET_PRIVADO_PRODUCCION'
npm run build:cloudflare
npm run release:inspect -- --remote --output work/inspeccion-produccion-antes.json
```

Si se confirmó que producción no utiliza R2, omitir esa variable; si tiene objetos o binding, preservarlo. Compilar e inspeccionar no publica. Estos pasos no necesitan configurar `TRADEIFY_APPROVED_DEPLOY_SHA`.

Seleccionar una carpeta privada **fuera del repositorio**, en una unidad cifrada que tú controles; poner su ruta real en lugar del marcador. No guardar SQL, claves de objetos o filas en Git/Actions:

```powershell
$BackupDir = 'REEMPLAZAR_RUTA_PRIVADA_CIFRADA_FUERA_DEL_REPOSITORIO'
New-Item -ItemType Directory -Force -Path $BackupDir
node node_modules/wrangler/bin/wrangler.js d1 export DB --remote --config dist/server/wrangler.json --output "$BackupDir/d1-antes-v2.sql"
Get-FileHash "$BackupDir/d1-antes-v2.sql" -Algorithm SHA256
node node_modules/wrangler/bin/wrangler.js d1 time-travel info DB --config dist/server/wrangler.json
```

La exportación puede bloquear temporalmente solicitudes D1; coordinar la ventana. Guardar el bookmark de Time Travel y la versión del Worker en el manifiesto privado. Time Travel no respalda R2 ni sustituye la restauración ensayada; su ventana depende del plan real (documentación: Free 7 días / Paid 30).

Para R2, el operador debe inventariar **todas las páginas ListObjectsV2**, copiar cada objeto mediante GetObject y conservar claves, metadatos HTTP/custom y SHA-256 de bytes, de acuerdo con la API S3 oficial. No basta con descargar una captura desde el panel. No hay en este cierre un recolector ejecutado contra R2 real ni credenciales concedidas para él; por eso este paso sigue **bloqueante**, no se marca como resuelto. Si necesitas crear acceso S3, lo autoriza el propietario con alcance mínimo al bucket; no crear credenciales persistentes sin tu decisión. Nunca habilitar acceso público ni usar sync con borrado.

Restaurar SQL/objetos en **otra** D1/R2 aislada, comparar filas, relaciones, índices, triggers, referencias y hashes, descifrar un script de prueba usando su recuperación autorizada y probar login nuevo. Antes de abrir una copia recuperada revocar sesiones y snapshots públicos restaurados: de otro modo podrían revivir enlaces ya revocados. Conservar prueba de recuperación y una segunda copia protegida antes de considerar el respaldo recuperable.

### Aplicar D1 en producción: aprobación específica pendiente

**COMANDO QUE MODIFICA PRODUCCIÓN — NO EJECUTADO.** Primero entregar para tu aprobación: cuenta y UUID, plan ID de inspección, lista exacta de pendientes y sus hashes, diferencias resueltas, respaldo/ensayo y su evidencia, ventana, compatibilidad del Worker activo, verificación posterior y reversión. Si no existe registro de migraciones confiable, preparar un plan de conciliación específico; el siguiente comando no resuelve esa situación.

Solo después de tu aprobación específica de ese plan, con el dist de producción revisado:

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config dist/server/wrangler.json
npm run release:inspect -- --remote --output work/inspeccion-produccion-despues.json
```

Wrangler puede confirmar automáticamente en entornos CI/no interactivos: su prompt no es nuestro mecanismo de aprobación. No usar DROP, borrar registros ni migraciones inversas para «deshacer». Una migración fallida se investiga sobre copia. Revertir el Worker no revierte D1/R2.

## D. Lo que tú tienes que hacer en Google

1. Abre [Google Cloud Console](https://console.cloud.google.com/) y elige el proyecto del cliente que ya usa Tradeify. No rotar ni borrar sus credenciales. Para staging, preferir otro cliente web separado (y proyecto separado si procede).
2. En el menú busca **Google Auth Platform**. En proyectos antiguos aparece **APIs & Services → OAuth consent screen/Credentials**. En **Branding**, poner nombre de aplicación, correo de soporte y contacto real, página inicial y URLs reales de privacidad/términos. No inventar una empresa, domicilio ni una política ya aprobada.
3. En **Audience**, seleccionar la audiencia que corresponde a tus usuarios (External si no está limitada a una organización Workspace). Para pruebas, seguir las indicaciones de usuarios de prueba que muestre Google. **Con scopes básicos de identidad hay una excepción a la lista de pruebas: no usar esa lista como barrera de staging; mantener el acceso cerrado en Tradeify.**
4. En **Data Access/Scopes**, solicitar únicamente los scopes usados por el código: `openid` y `email`. No habilitar Gmail, Drive, Calendar, permisos financieros ni crear cuentas de servicio.
5. En **Clients → Create client**, elegir **Web application** cuando haga falta un cliente nuevo. En producción existente, abrir el cliente ya configurado y revisar, no reemplazar por defecto.
6. En **Authorized redirect URIs**, registrar exactamente el callback del entorno. Para el origen actual confirmado:

   `https://tradeify.tradeify-web-2026.workers.dev/oauth/google/callback`

   En staging: **origen real obtenido de Cloudflare** seguido de `/oauth/google/callback`. Sin barra extra, sin comodines, sin otro puerto o protocolo. Si después eliges dominio propio hay que registrar su callback exacto antes de cambiar `TRADEIFY_ORIGIN`.
7. El flujo de este código redirige al servidor; no usa un SDK de Google en el navegador. **Authorized JavaScript origins no es necesario para este flujo.** Si ya hay otros consumidores del cliente, no borrar sus orígenes. Un origen, si se autoriza para otro uso, lleva solo esquema/host, nunca el callback completo.
8. Copiar **Client ID** a `TRADEIFY_GOOGLE_CLIENT_ID` de ejecución en Cloudflare. Copiar **Client secret** directamente al campo tipo **Secret** `TRADEIFY_GOOGLE_CLIENT_SECRET`. No pegarlo en Builds, Vite, Git, documentos, capturas o chat. Ambos deben pertenecer al mismo cliente.
9. Revisar **Verification Center/Publish app** y los requisitos que muestre Google para marca, audiencia y dominios. Los scopes básicos no implican automáticamente que toda marca o dominio esté aprobado. No añadir `workers.dev` como si fuera un dominio propio controlado: si Google exige verificar dominio de marca, usar un dominio que realmente controles y verificarlo por su procedimiento. No declarar cumplido sin comprobar la consola.
10. En el entorno de staging autorizado, abrir un navegador, pulsar **Iniciar sesión con Google**, elegir tu cuenta, consentir lo que corresponda y comprobar vuelta al origen correcto, administración de propietario, guardado, cierre de sesión y nuevo acceso. Probar otra cuenta autorizada de pruebas para aislamiento. No registrar code/state, cookies, ID tokens o secretos en la evidencia.

| Error | Qué revisar |
|---|---|
| `redirect_uri_mismatch` | Callback exacto en el cliente correspondiente al Client ID de ese Worker y `TRADEIFY_ORIGIN` sin ruta/barra final. |
| Cliente inválido | ID y secreto del mismo cliente/proyecto; tipo Secret en ejecución, no variable pública. |
| Acceso denegado | Correo verificado, audiencia de Google y política de acceso de Tradeify; propietario correcto. No abrir el registro para solucionar a ciegas. |
| Configuración incompleta | Cinco valores de ejecución requeridos, DB correcto y tablas efectivas; mirar errores sin imprimir secretos. |

**Estado actual: ninguna de estas comprobaciones reales de OAuth se ha superado todavía.** Las pruebas anteriores usan identidades ficticias y verifican lógica, no tu configuración Google.

## E. Otras decisiones que te corresponden

- **Dominio:** puedes seguir con el workers.dev observado si tu configuración Google/legal lo permite, o autorizar un dominio que controles. Registrar DNS/HTTPS, origen y callback reales; no comprar dominios ni cambiar DNS sin tu decisión.
- **Presupuesto:** confirmar plan actual y límite de gasto aceptado. No se contrata R2 ni se cambia Workers a Paid para superar un bloqueo. Acordar alertas y comportamiento al agotar cuotas.
- **Responsable y soporte:** aportar identidad real del responsable, contacto válido, jurisdicción aplicable y canales para derechos/incidentes. Revisar privacidad/términos con asesoramiento apropiado; no son campos que Codex pueda inventar.
- **Retención:** decidir y documentar plazos de datos operativos, capturas, auditoría, logs y respaldos, procedimiento de baja/expurgo y responsables. El código de limpieza no acredita una política legal aprobada ni ejecución real del cron.
- **Contenido y terceros:** confirmar procedencia/licencias de las 480 frases heredadas restringidas, material propio/importado y condiciones de widgets/capturas de TradingView. No liberar textos sin evidencia ni atribuir autores inventados. Revisar autorización de uso de la marca Tradeify; este informe no certifica disponibilidad del nombre.
- **Scripts y recuperación:** conservar clave personal y recuperación fuera del servidor; perder ambas impide recuperar código. Solo se guarda la última versión. El límite de 1000 líneas lo aplica el editor; el servidor impone bytes/cuotas, conforme a tu decisión.
- **Publicación final:** aprobar un SHA concreto y plan concreto cuando staging, Google, backup, reversión y requisitos indispensables estén completos. Main no se integra por el mero hecho de aprobar una migración.

## F. Tareas ordenadas para ti

| Prioridad | Plataforma | Acción exacta | Dónde hacerlo | ¿Es obligatorio? | Riesgo | Estado |
|---|---|---|---|---|---|---|
| 1 | Cloudflare | Iniciar sesión y seleccionar la cuenta que contiene tradeify; no enviar claves al chat. | dash.cloudflare.com → selector de cuenta → Workers & Pages. | Sí | Acceso a la cuenta; usar flujo seguro. | Falta acceso autenticado. |
| 2 | Cloudflare | Anotar versión activa, DB/UUID, BUCKET y plan. No sustituirlos. | tradeify → Deployments/Bindings; Billing/Usage. | Sí | Elegir otra DB dejaría de mostrar tu historial. | No inspeccionado. |
| 3 | Google/propietario | Confirmar correo propietario real y cliente existente; guardar secretos solo en Cloudflare. | Google Auth Platform y Variables and Secrets. | Sí | Administrador equivocado/credencial expuesta. | Sin confirmar. |
| 4 | Cloudflare | Crear o identificar D1 y R2 privado de staging distintos; revisar coste antes. | D1/R2, pasos B y C. | Sí para ensayo completo | Nunca reutilizar recursos productivos. | No creado/desplegado. |
| 5 | Operación | Ejecutar inspección, migraciones de staging vacío y cierre de su acceso. | Terminal en repo; C. | Sí | Escribe solo staging confirmado. | Ensayo local aprobado; remoto pendiente. |
| 6 | Google/Cloudflare | Configurar callback de staging y probar login nuevo y aislamiento. | Auth Platform/Worker/navegador. | Sí | Acceso externo; no publicar secretos. | No verificado. |
| 7 | Navegador | Completar matriz de funciones sobre URL de staging y guardar evidencia sin datos privados. | G. | Sí | Datos exclusivamente de prueba autorizados. | Pendiente remoto. |
| 8 | Operación | Respaldar D1+R2 completos y restaurar en copia; fijar versión de reversión compatible. | Directorio cifrado fuera de Git; informe 21. | Sí | Privacidad y consistencia; no sobrescribir producción. | No hay respaldo real certificado. |
| 9 | Responsable | Completar identidad/contacto/retención/licencias/marca y decisión de presupuesto/dominio. | E y documentos legales reales. | Sí según alcance legal | No inventar ni marcar cumplido sin decisión. | Pendiente. |
| 10 | Propietario | Aprobar plan D1 con UUID, hashes, backup/ensayo y ventana, si hay cambios reales pendientes. | Informe de inspección privado y aprobación expresa. | Sí si cambia D1 | Modifica datos/esquema reales. | No solicitado sin plan real; no ejecutado. |
| 11 | Propietario | Aprobar despliegue final del SHA probado y, por separado, cualquier integración de main. | Confirmación expresa con plan concreto. | Sí | Cambia aplicación pública; main no autorizado. | No ejecutado. |
| 12 | Operación | Publicar, verificar versión activa, smoke real, métricas, cron y reversión disponible. | Worker → Deployments/Observability + navegador. | Sí | Revertir código no restaura datos. | Bloqueado por pasos previos. |

**Primer paso práctico: completar el acceso seguro a Cloudflare (Google rechazó la contraseña del intento) y reconocer el Worker tradeify con sus bindings; no crear una nueva base productiva.** Con ese acceso se puede continuar inspección y staging sin pedirte que manejes todos los comandos manualmente. Si prefieres hacerlo tú, las secciones anteriores indican qué copiar y dónde, sin compartir secretos.

## G. Checklist de cierre y publicación

### Preparación del repositorio

- [x] Continuación desde 7758; rama V2 y funciones de la entrega 29 preservadas.
- [x] Retirada de migraciones automáticas en deploy; destino separado y aprobación por SHA.
- [x] Inspector de esquema/registro/relaciones sin inicializar tablas; detector de baseline incierto.
- [x] Ensayo de las 17 migraciones en D1 local desechable y comparación estructural real con Wrangler local.
- [x] Suite local sobre `2272e95`: 19 comprobaciones aprobadas + auditoría dev registrada con cuatro moderados conocidos, cero avisos de producción. [Resultados](verificacion-publicacion-2026-11-23/local/resultados.json). Build de staging ficticio desde checkout limpio, dry-run sin subida y 17 migraciones/inspector aprobados; no son servicios publicados.

### Antes de migrar o publicar producción

- [ ] Cuenta, plan, Worker/versión, rutas/HTTPS, D1/UUID y R2 privados reales contrastados.
- [ ] Acceso mínimo, staging aislado/cerrado, runtime y Google de staging correctos.
- [ ] Staging desplegado desde SHA y artefactos exactos, con URL/version_id registrados.
- [ ] Google real: entrada, salida, sesión nueva, propietario y segundo usuario autorizados.
- [ ] Matriz real de funciones y navegadores completada; sin fallos críticos.
- [ ] Backup consistente D1+R2+metadatos+configuración, protegido, con hashes y recuperación ensayada.
- [ ] Reversión a versión compatible identificada y ensayada sobre copia; no DROP ni borrado inverso.
- [ ] Contacto/legal/retención/expurgo/licencias/marca y presupuesto indispensables completados.
- [ ] Plan D1 concreto aprobado antes de modificar producción, si hace falta; inspección posterior compatible.
- [ ] Aprobación final del SHA y ventana; aprobación independiente para integrar main si se elige ese camino.

### Matriz que se ejecutará en la URL realmente desplegada

| Grupo | Comprobación y evidencia necesaria |
|---|---|
| HTTPS/origen | Página principal, legales y rutas; versión activa igual al artefacto aprobado. Sin bucles ni errores de consola inesperados. |
| Google/usuarios | Login real nuevo, cierre/revocación, propietario, segundo usuario autorizado sin acceso a datos ajenos y sin APIs privadas anónimas. |
| Datos | Crear/editar cuentas y trades ficticios, parciales/BE/stop, filtros/cursor/orden y agregados completos, asociación de activo confirmada. |
| Scripts/calculadoras | Catálogo vacío por usuario; cifrar, cerrar/abrir, recuperar un script de prueba; las diez calculadoras con sus unidades y límites. |
| Análisis | Riesgo/DD/fondeo y datos insuficientes; estadísticas, psicología, estrategias/restauración y revisión semanal/mensual. Sin afirmar exposición real de bróker. |
| Documentos | Diez perfiles con sus filtros, PDF/Excel/CSV/PNG y privacidad; backup completo obtenido del servidor e importación/restauración en cuenta de pruebas. |
| Terminal/QR | Tres formatos, R/%/ambos, curva decorativa, campos mínimos/opt-in, QR dentro activado/desactivado y leído desde imagen real. |
| Página pública | Un único snapshot congelado; sin cuentas/correos/scripts ni capturas privadas. Revocar y confirmar acceso inválido; comprobar vencimientos controlados sin alterar fechas de datos reales ni afirmar haber esperado 30 días. |
| R2/capturas | Carga y lectura privadas con Google real; otro usuario y anónimo no acceden. TradingView real/fallback y CSP; bucket sin acceso público. |
| Administración | Cuotas efectivas desde servidor, propietario protegido, invitaciones, auditoría/paginación, mantenimiento reversible y acceso administrativo para desactivarlo. |
| UX/ayuda/frases | Siete anchos 320/360/390/768/1024/1440/1920, claro/oscuro, teclado, modales/menú, ayuda y frases sin pérdida offline. Navegador real; no DOM simulado como prueba visual. |
| Operación | Cron/cola/observabilidad reales, sin datos privados en logs, consumo dentro del presupuesto y contactos operativos válidos. |

**Despliegue final, todavía no autorizado ni ejecutado:** usar un checkout limpio del SHA aprobado, compilar de nuevo con destino production y bindings reales, ejecutar inspección y dry-run. Solo tras la aprobación final establecer `TRADEIFY_APPROVED_DEPLOY_SHA` al SHA completo y ejecutar `npm run deploy:cloudflare`. No cambiar main para conseguirlo: es posible publicar manualmente el SHA aprobado de V2 sin fusionar ramas. Si se elige Workers Builds, primero revisar disparadores, permisos y variables y obtener aprobación de la integración; no introducir un ciclo de publicación automática sin las mismas puertas.

Después registrar URL, `version_id`, SHA, esquema, resultado real del smoke, errores y procedimiento de reversión. Hasta entonces: **código preparado en GitHub ≠ staging desplegado ≠ producción actualizada.**

## Referencias oficiales y trazabilidad

- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
- [D1: migraciones](https://developers.cloudflare.com/d1/reference/migrations/), [comandos](https://developers.cloudflare.com/d1/wrangler-commands/), [importación/exportación](https://developers.cloudflare.com/d1/best-practices/import-export-data/) y [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- [R2: precios](https://developers.cloudflare.com/r2/pricing/) y [API S3](https://developers.cloudflare.com/r2/api/s3/api/).
- [Google: OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [preparación para producción/audiencia](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) y [políticas](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
- Comportamiento concreto «migrations list crea registro»: código instalado de Wrangler **4.164.0**, handler de listado e `initMigrationsTable`, inspeccionado durante esta preparación. No se extrapola sin verificar versiones futuras.
- [Recuperación/reversión](21-operacion-recuperacion-v2-2026-11-22.md), [estado funcional anterior y 25 fases](29-entrega-terminal-qr-ux-2026-11-23.md). Fuentes oficiales consultadas el 23 de noviembre; no certifican planes o configuraciones de una cuenta sin inspección.

## H. Cierre técnico de esta preparación

Código comprobado `2272e9580a795411dca035a2ec064869c2a57752`; inicio `7758c55007b07339fa74de2c66ba0a32ba209b89`. El commit posterior de este cierre registra documentos y evidencia, sin nuevos cambios funcionales. Rama V2 exclusivamente; no integración de main ni cambio de producción.

- [19 comprobaciones locales aprobadas](verificacion-publicacion-2026-11-23/local/resultados.json), incluida suite avanzada con seis grupos de release, TypeScript/lint/lógica, consultas grandes, restauración/migraciones, reportes, API Sites, builds Cloudflare y API con/sin R2, seguridad, recuperación y dry-run. Auditoría dev aparte: cuatro moderados conocidos; producción: cero avisos. No se aplicó la degradación incompatible de Drizzle Kit propuesta por audit fix.
- [Chromium actual](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45202177791): 219 casos aprobados, 68 análisis axe sin infracciones, siete anchos/dos temas; cero excepciones y cero errores inesperados. ZIP de 51.269.394 bytes, SHA-256 `ae0532747963b66319cdb692420e95fdc8897cfabfe1571876ea1d9976f31ffc`, artifact 14832468830, vence el 7 de diciembre de 2026. JSON y PNG representativos conservados en Git con el inventario completo/hashes. Revisados visualmente el PNG Terminal exportado y el diálogo a 320 px; no se presenta un render DOM como captura de navegador.
- [TradingView/CSP actual](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45202177758): 12 casos aprobados con el proveedor real, incluido fallback por restricciones del proveedor ya documentadas. ZIP 2.940.409 bytes, SHA-256 `4cac9520136ad6ec036273a8db457e30a183a70baf890477b0fd2eae628e32b8`. No certifica precios, OAuth de Tradeify ni producción.
- [Staging ficticio local](verificacion-publicacion-2026-11-23/staging-local-schema.json): build desde checkout limpio del SHA probado, artefacto sellado, dry-run sin subir recursos, 17 migraciones registradas, sin objetos requeridos faltantes/diferentes ni errores de claves foráneas. No se crearon recursos Cloudflare reales.
- Escaneo heurístico: 1016 blobs históricos y 281 archivos compilados, con 16 candidatos redactados ubicados en constantes de fixtures; ningún candidato del código nuevo de release ni del dist escaneado. No acredita los secretos remotos ni ausencia universal de credenciales. [Registro](verificacion-publicacion-2026-11-23/secret-scan.json).
- Recuperación repetida en local: 30 tablas, 87 objetos de esquema y tres blobs; revocación de sesiones/enlaces restaurados antes de reabrir la copia. No equivale a tu respaldo real.
- [Cierre legible por máquina](verificacion-publicacion-2026-11-23/cierre.json) y [archivos de esta preparación](verificacion-publicacion-2026-11-23/archivos.json). Los logs locales preexistentes de verificación de activos se conservan sin borrarlos ni atribuirlos como trabajo nuevo; usar un checkout limpio para publicar.

**Siguiente continuación exacta:** completar el acceso seguro pendiente a Cloudflare, contrastar cuenta/Worker/DB/BUCKET/versión/plan, generar inventario estructural privado de solo lectura y preparar staging cerrado aislado. Solo entonces se puede cerrar el plan real de migraciones/backup; hoy no conocemos qué migraciones faltan en producción. Google elegido para entrar al panel de Cloudflare no es una prueba del OAuth de Tradeify. No volver a implementar las diez calculadoras ni los módulos completos.

## I. Continuación: transición 0005–0016 y acceso real pendiente

El 23 de noviembre (Ecuador) se retomó desde `1b8ecc0d19723807ced0848c5797f3abc189ffea`, sin cambios previos descartados. El propietario confirmó por su revisión del panel: Worker `tradeify`, misma URL, D1 `tradeify` con binding DB, registro 0000–0005 y ausencia de BUCKET entre los bindings observados. Es información aportada por el propietario, **todavía sin inspección independiente**; no se convierte en certificado del esquema, de la cuenta o de inexistencia de un bucket R2 en la cuenta.

### Intento real de acceso

El nuevo navegador comenzó sin pestañas y Cloudflare redirigió a su login. Wrangler también indicó «You are not authenticated». Se hizo el flujo seguro Google: la contraseña fue aceptada, se pidió confirmación al dispositivo y el propietario confirmó el número mostrado. Al regresar, Cloudflare mostró **«Unable to sign in. Try again or use your email and password»**. No hay señal de sesión iniciada en Cloudflare. No se diagnostica un bloqueo de bots ni una causa que el sitio no explicó. No se repitió automáticamente el intento ni se cambiaron contraseñas, permisos o credenciales.

Para continuar: completar manualmente el acceso en la pestaña Cloudflare conservada, utilizando el método válido de esa cuenta; el sitio ofrece correo/contraseña como alternativa. No compartir credenciales en chat, no crear otra cuenta y no crear otra D1 de producción. Una sesión en tu navegador personal no se transfiere automáticamente al navegador de esta tarea. Después se comprobará el panel y, si hace falta CLI, se realizará su autorización normal sin extraer cookies ni secretos del navegador.

### Revisión concreta de las once migraciones

| Archivo | Cambio y control previo a producción |
|---|---|
| 0006_restore_receipts | Tabla nueva de recibos de restauración; comprobar que no exista una versión divergente. |
| 0007_individual_quotas | Columna nullable custom_trades en user_limits. Conserva el valor anterior de trades y añade NULL, no cero. Comprobar que la columna no se haya añadido manualmente. |
| 0008_query_indexes_revisions | Tabla de revisiones, índices sobre fechas/JSON y triggers de revisión de escrituras futuras. Exige JSON válido en trades; puede requerir ventana por la creación de índices. |
| 0009_section_cache | Caché nueva por usuario/revisión y su índice; no transforma operaciones existentes. |
| 0010_quote_library | Estado, entregas y favoritos nuevos. No elimina daily_quote_progress ni libera contenido heredado sin derechos. |
| 0011_admin_operations | Estado de mantenimiento y alertas nuevos. Inserta un singleton nuevo con mantenimiento inactivo; no modifica access_settings ni abre el registro cerrado. |
| 0012_operational_incidents | Tabla nueva de incidencias agrupadas; no borra auditoría anterior. |
| 0013_storage_deletions | Cola e índices/triggers para eliminaciones futuras de adjuntos. No borra blobs al instalar; inventariar R2 y adjuntos antes de activar limpieza real. |
| 0014_asset_catalog | Catálogo y alias vacíos, claves/revisiones e índice JSON de mercado. No asocia históricos automáticamente. Comprobar integridad JSON y objetos previos. |
| 0015_private_scripts | Bóvedas/scripts cifrados, relaciones y triggers de cuotas. No guarda claves personales ni migra texto privado automáticamente. |
| 0016_public_trade_shares | Snapshots nuevos inicialmente vacíos, índices, cuota/congelación y cascadas futuras. No publica operaciones existentes al instalarlo. |

Esta revisión de archivos no decide que se puedan aplicar once cambios sobre la base real a ciegas. Antes: obtener su UUID, comparar objetos/columnas/índices/triggers y registro con el inspector; resolver diferencias sobre copia; cotejar integridad y tipos; obtener backup consistente y recuperación ensayada; verificar versión activa/compatibilidad, ventana y reversión. Registrar hashes del lote y aprobación específica del plan.

Lectura adicional que se debe realizar sobre el DB real confirmado antes de crear índices JSON (no ejecutada contra producción):

```sql
SELECT COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN json_valid(data) THEN 0 ELSE 1 END), 0) AS invalid_json
FROM trades;
```

Si invalid_json es mayor que cero, detener migraciones 0008/0014 y revisar registros sobre copia privada. No borrarlos, normalizarlos ni alterar finanzas automáticamente para que pase la migración. La consulta entrega cantidades, no datos financieros. Su lectura completa se coordina con la ventana y tamaño reales.

### Avance independiente guardado

Se amplió `tests/check-migration-upgrade.mjs`: prepara el esquema real de archivos 0000–0005, pobla sus **14 tablas anteriores**, dos usuarios, cuentas separadas, sesiones, invitaciones, acceso cerrado, auditoría, progreso diario y 1001 trades. Después de **cada** una de las once migraciones compara todas las columnas originales y todas las filas, verifica relaciones y conserva el prefijo del registro de migraciones hasta completarlo en 17. La columna nueva nullable de cuotas se verifica por separado.

Otro D1 desechable contiene JSON antiguo inválido: 0008 debe fallar, revertir su lote sin dejar tabla/índice parcial y conservar intacta la operación problemática. No se repara ni se elimina ese registro. Esto demuestra por qué el backup y la lectura de datos reales son necesarios aunque el esquema 0005 coincida.

[Resultados con hashes y alcance local](verificacion-transicion-0005-0016-2026-11-23/resultados.json). Se ejecutaron restauración/migraciones, las seis comprobaciones de release y lint: los tres comandos terminaron con código 0. Lint conserva un aviso previo de img en capture-preview.tsx y cero errores; sus salidas se guardan junto al resultado. Las compilaciones/219 pruebas Chromium de la sección H continúan siendo la evidencia anterior de la aplicación; no se presentan como una nueva publicación ni como pruebas de este acceso Cloudflare.

**Sin modificación de producción:** no se obtuvo todavía backup real D1/R2/configuración, no se crearon recursos remotos, no se aplicaron migraciones y no se publicó staging ni producción. Main y la D1 original se preservan. La siguiente acción dependiente es terminar el acceso Cloudflare; no se solicita aprobación D1 o de publicación sin un plan real verificable.
