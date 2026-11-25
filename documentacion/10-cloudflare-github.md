# Publicar Tradeify en Cloudflare desde GitHub

**Guía histórica de instalación; para la instalación existente de V2 seguir primero el [informe 30](30-publicacion-v2-y-pasos-del-propietario.md).** No crear ni reemplazar su D1. No fusionar main ni lanzar Builds sin las aprobaciones y el respaldo exigidos. Los pasos de creación siguientes solo corresponden a una instalación nueva explícitamente autorizada.

El perfil de Cloudflare conserva la bitácora, las estadísticas, las exportaciones y la frase diaria. Usa Google para identificar a cada persona y D1 para guardar sus registros. Conserva R2 para las capturas antiguas.

## 1. Crear los recursos

1. En Cloudflare, abre **Workers & Pages** y crea un Worker de ejemplo llamado **tradeify**. Copia su dirección HTTPS `https://tradeify.<tu-subdominio>.workers.dev`. Puedes usar ese enlace con tu cuenta gratuita o configurar tu propio dominio.
2. En **Storage & databases → D1**, crea una base llamada **tradeify** y copia su **Database ID**.
3. Para adjuntar capturas, activa R2 y crea un bucket privado, por ejemplo **tradeify-capturas**, con clase Standard. Puedes dejar esta conexión vacía y habilitarla después. R2 exige activar su suscripción y cobra el uso que excede la cuota gratuita.

## 2. Preparar el acceso privado

En [Google Auth Platform](https://console.cloud.google.com/auth/clients), crea un cliente OAuth de tipo **Aplicación web** con esta URI de redirección autorizada:

```text
https://tradeify.<tu-subdominio>.workers.dev/oauth/google/callback
```

Usa la dirección real del paso 1. Si la audiencia está como **Externa** y en modo **Pruebas**, añade tu correo en usuarios de prueba. La política de acceso de Tradeify se configura por entorno; cerrar staging antes de exponerlo. Los scopes básicos no garantizan que la lista de usuarios de prueba de Google restrinja el acceso.

En **Worker → Settings → Runtime variables and secrets → Production** añade estas variables de ejecución. Guarda los secretos como tipo **Secret**.

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `TRADEIFY_ORIGIN` | Texto | URL HTTPS del Worker sin ruta, por ejemplo `https://tradeify.<tu-subdominio>.workers.dev` |
| `TRADEIFY_OWNER_EMAIL` | Texto | Correo verificado del propietario real; necesario para administrar y cerrar staging |
| `TRADEIFY_GOOGLE_CLIENT_ID` | Texto | ID de cliente de Google OAuth |
| `TRADEIFY_GOOGLE_CLIENT_SECRET` | Secreto | Secreto del cliente de Google |
| `TRADEIFY_SESSION_SECRET` | Secreto | Valor aleatorio de al menos 32 caracteres, generado abajo |

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Los secretos permanecen en Cloudflare. Cambiar el secreto de sesión cierra las sesiones vigentes. Si cambias de dominio, actualiza `TRADEIFY_ORIGIN` y registra la nueva URI de redirección en Google.

Genera la clave de sesión en tu dispositivo y conserva su valor en privado. Si utilizaste un ejemplo compartido en mensajes o documentación, sustitúyelo por uno generado para tu instalación.

## 3. Enlazar GitHub y desplegar

En **Worker → Settings → Builds** conecta `tradeifyweb2026-ship-it/Tradeify.web` y permite que Cloudflare acceda a ese repositorio. Aplica estos ajustes.

| Ajuste | Valor |
| --- | --- |
| Rama de producción | `main` |
| Directorio raíz | `/` |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npm run deploy:cloudflare` |
| Otras ramas | Desactiva builds de vista previa |
| Variable de build `NODE_VERSION` | `22.22.0` o una versión posterior compatible |
| Variable de build `TRADEIFY_D1_ID` | UUID de la base D1 creada en el paso 1 |
| Variable de build `TRADEIFY_R2_BUCKET` | Nombre de tu bucket, si decidiste activar R2 |

Las variables de compilación se añaden en **Builds → Variables and secrets**. `TRADEIFY_D1_ID` debe contener el Database ID real, sin espacios. R2 es opcional; omite `TRADEIFY_R2_BUCKET` cuando no tengas bucket. Las descripciones de la tabla explican qué valor introducir y deben sustituirse por los datos de tu instalación.

Usa permisos mínimos para publicar el Worker y consultar el esquema D1. La ejecución de migraciones tiene permisos y aprobación separados; deploy no las aplica. Con R2, añade **Workers R2 Storage: Edit** si Cloudflare requiere validar el bucket con ese token. Configura el token en **Builds**, separado de las variables y secretos de ejecución.

Antes de cualquier despliegue seguir el informe 30: staging aislado, respaldo, migraciones aprobadas por separado, destino real, pruebas y aprobación final del SHA. No activar publicación automática de main durante esta preparación. El comando solo sube el Worker compilado cuando el esquema está listo. Abre tu URL y pulsa **Iniciar sesión con Google**. Comprueba que puedes guardar un trade, exportar y, si activaste R2, adjuntar una captura.

## 4. Actualizar una instalación existente

La versión de seguridad añade `drizzle/0002_auth_sessions.sql`. El operador debe comprobar esa migración en el destino; deploy ya no ejecuta migraciones automáticamente. Las tablas de la bitácora conservan su contenido y las sesiones anteriores requieren un nuevo inicio de sesión. El cierre de sesión pasa a revocarse en D1.

`wrangler.cloudflare.jsonc` declara `AUTH_RATE_LIMITER` (20 solicitudes/minuto) y `API_RATE_LIMITER` (120/minuto), con claves por IP. Los namespaces preparados son `9976001` y `9976002`. Cloudflare los declara durante el deploy. La API nativa aplica límites aproximados por ubicación. Los eventos 429 incluyen `Retry-After: 60`.

Antes de actualizar, conserva una copia de datos y revisa el commit. Después, comprueba el log de Workers Builds, las migraciones aplicadas y la dirección del Worker. Los checks de GitHub pueden reflejar ese estado si la integración los comunica. Una actualización de código en GitHub y un despliegue terminado se comprueban por separado.

| Síntoma | Comprobación |
| --- | --- |
| Configura TRADEIFY_D1_ID | Database ID válido en las variables de Builds |
| Completa la configuración de acceso | Cinco valores de Runtime y binding DB |
| Google no pudo confirmar el acceso | ID y secreto del mismo cliente, y callback registrado exactamente |
| Esta cuenta de Google no tiene acceso | Cuenta elegida y correo verificado |
| Tabla auth_sessions inexistente | Migración 0002 aplicada en la misma base que usa el Worker |
| 429 | Esperar Retry-After y revisar solicitudes repetidas desde la misma IP |

La auditoría y las pruebas locales están en [SEGURIDAD_INFORME.md](../SEGURIDAD_INFORME.md). El cambio de clave de sesión, los permisos y los registros del panel requieren intervención del propietario de la cuenta.

## Datos existentes y comprobación local

La base nueva empieza vacía. Para trasladar historiales, exporta e importa operaciones por cuenta mediante CSV. Las capturas, las reglas y las revisiones requieren traslado separado. Un traslado integral requiere copiar los objetos R2 y reasignar las filas D1 a la identidad estable de Google, que difiere de la identidad de ChatGPT. Conserva el respaldo fuera del repositorio.

Después de instalar dependencias con `npm ci`, ejecuta `npm run build:cloudflare` con `TRADEIFY_D1_ID` configurado, seguido de `node tests/check-cloudflare.mjs` para comprobar el Worker en un D1 local con una respuesta simulada de Google. La prueba local no usa secretos ni datos reales.

Referencias de configuración: [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [migraciones D1](https://developers.cloudflare.com/d1/reference/migrations/) y [OAuth de Google](https://developers.google.com/identity/protocols/oauth2/web-server).

## Fase 1 local: transición de capturas

No hay migraciones ni variables nuevas para captureLinks. Mantén el binding BUCKET, la variable TRADEIFY_R2_BUCKET y la tabla attachments: los archivos heredados siguen consultándose. No se ha desplegado esta fase ni cambiado secretos.

Retiro posterior de R2 (fuera de esta entrega): inventariar adjuntos por propietario, realizar copia de seguridad, permitir que cada dueño sustituya los archivos por enlaces y confirme que ya no los necesita; verificar referencias y permisos, retirar GET/DELETE y limpieza solo cuando no queden consumidores; por último retirar binding y bucket con autorización explícita. Guardar un enlace no elimina un adjunto antiguo ni prueba que éste ya no sea necesario. Nunca borrar masivamente basándose solo en la presencia de captureLinks.

### Registro público
En Google Auth Platform selecciona público externo, completa marca, contacto y páginas legales y pasa de pruebas a producción. Registra el origen HTTPS del Worker y exactamente ese origen seguido de /oauth/google/callback como URI de redirección. Configuración real de consola: no verificado. El propietario debe completar el contacto en ambas páginas antes de lanzar. TRADEIFY_OWNER_EMAIL es necesario para la administración protegida. Los registros conservan su identidad google:sub.
TRADEIFY_MAX_TRADES es una variable de ejecución opcional. Tras aplicar la migración user_limits, el valor predeterminado es 5000 por usuario.

La configuración antigua de Resend queda retirada: V2 desactiva las rutas de autenticación por correo y usa Google. No crear esas credenciales ni reactivar dichas rutas. Verificar todas las migraciones del esquema vigente con el procedimiento del informe 30.

TRADEIFY_MARKET_SYMBOL es opcional (por ejemplo OANDA:EURUSD). En Mercados se prefiere el último activo si tiene formato EXCHANGE:NAME. El catálogo disponible depende de TradingView. Ruta española de los módulos y funcionamiento en vivo de los dos widgets: no verificado. La integración usa /w/en/.

### Administración privada
Antes de activar la versión administrativa, comprueba TRADEIFY_OWNER_EMAIL con el correo real verificado del propietario y aplica 0005_administration en D1. No se inventa este valor ni se cambia en el código. Si no está configurado, nadie recibe acceso administrativo. El enlace Administración aparece solo en la cuenta propietaria. Se conserva registro público e ilimitado por defecto hasta que el propietario cambie las reglas.

Elimina TRADEIFY_EMAIL_API_KEY y TRADEIFY_EMAIL_FROM en el panel si todavía existen. La versión nueva ya desactiva ambas rutas de correo independientemente de esas variables. Su retirada del panel está no verificada. No se han cambiado secretos ni configuraciones externas durante la implementación.

Para mostrar Contactar al responsable en las pantallas de acceso puedes añadir TRADEIFY_SUPPORT_EMAIL como variable de texto en ejecución. Es opcional y no afecta a los permisos. Esta entrega no requiere nuevas migraciones ni cambios en las claves existentes. La publicación se realiza con las pruebas aprobadas y la autorización del usuario.
