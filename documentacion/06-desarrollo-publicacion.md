# Desarrollo y publicación

**Procedimiento vigente V2:** [publicación y pasos del propietario](30-publicacion-v2-y-pasos-del-propietario.md). No crear otra base de producción ni integrar en main automáticamente. Desde este cierre, publicar no aplica migraciones; cada cambio D1 se revisa por separado.

Node >=22.13 para aplicación; >=22.18 para la prueba que importa TypeScript nativamente. Conserva package-lock.json. Desde raíz:

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wild_thundra.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_magical_spot.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_auth_sessions.sql
npm run dev
```

Los comandos SQL anteriores preparan una base local vacía para el perfil Sites. En bases existentes, conserva las migraciones aplicadas y ejecuta únicamente las pendientes. La 0001 incorpora frases y la 0002 sesiones Google. `npm run start` necesita la compilación y las tablas. En el perfil Cloudflare, `release:inspect` comprueba esquema/registro sin escribir. Las migraciones se ejecutan por separado, con respaldo y aprobación específica en producción; deploy exige esquema listo.

| Comando | Función |
| --- | --- |
| npm run install:ci | Instalación adaptada al entorno |
| npm run dev | Desarrollo |
| npm run build | Cliente y Worker en dist |
| npm run build:cloudflare | Cliente y Worker independiente con bindings de la cuenta seleccionada |
| npm run deploy:cloudflare | Publicación del artefacto sellado, sin aplicar migraciones; producción exige SHA aprobado |
| npm run release:inspect -- --remote | Lectura del esquema/registro/relaciones del destino revisado |
| npm run release:dry-run | Empaquetado sin subir el Worker |
| npm run start | Worker local compilado |
| npm run lint | ESLint |
| npx tsc --noEmit | Tipos |
| npm run db:generate | Generar migraciones |
| node tests/check-api.mjs | Integración después del build |
| node tests/check-cloudflare.mjs | Google simulado, sesiones y límites después del build Cloudflare |
| node tests/check-export.mjs | Reportes, formatos y privacidad de exportaciones |
| node tests/check-capture-failures.mjs | Fallos de confirmación D1/R2 sobre el handler de capturas |

## Configuración

`.openai/hosting.json` identifica el proyecto y bindings del perfil Sites. El proyecto actual es appgprj_6afb534caa04819191877ec07e2636e6. El perfil Cloudflare usa `wrangler.cloudflare.jsonc`, `TRADEIFY_D1_ID` y el bucket opcional `TRADEIFY_R2_BUCKET` para producir `dist/server/wrangler.json`. El plugin resuelve `migrations_dir` desde la raíz del proyecto y lo adapta a esa configuración generada.

Los scripts adaptan entorno gestionado/portable. Desarrollo portable puede simular identidad; gestionado la desactiva. La simulación corresponde exclusivamente al servidor local. Las claves OAuth y la firma de sesión se configuran en el servidor para el perfil Google. Conserva tokens, `.env`, `.dev.vars` y respaldos fuera del repositorio.

## Publicación Cloudflare desde GitHub

La instalación de https://tradeify.tradeify-web-2026.workers.dev/ está conectada a `tradeifyweb2026-ship-it/Tradeify.web`, rama `main`. Workers Builds ejecuta `npm run build:cloudflare` y después `npm run deploy:cloudflare`.

El deploy valida configuración, fuente limpia, SHA y huellas del artefacto, exige esquema/registro/relaciones correctos y publica con `--keep-vars`. Nunca aplica migraciones. Las credenciales OAuth permanecen en Runtime variables and secrets. Antes de actualizar, seguir el informe 30 y obtener las aprobaciones específicas; main no se modifica sin autorización. Workers Builds necesita destino production, identificadores reales y SHA aprobado; el modo predeterminado validation bloquea publicación remota. El commit identifica la fuente; el log de Cloudflare confirma el despliegue. Los checks de GitHub dependen de que la integración los comunique.

La guía [Cloudflare desde GitHub](10-cloudflare-github.md) contiene la configuración completa, el cambio de formato de sesiones y el diagnóstico de errores.

## Perfil alternativo Sites

https://bitacora-de-trading.assuredopal.chatgpt.site/ es un sitio privado. Sites administra Worker, puerta de acceso y bindings. Para actualizar: preparar cambios, comprobar tipos/build/pruebas, generar migración si procede, publicar mediante el flujo Sites del proyecto y verificar acceso/lectura/escritura con una sesión autorizada.

La publicación Sites se realiza mediante su propio flujo. La conexión de Workers Builds de la cuenta Cloudflare despliega el perfil Google. Los registros alojados se respaldan de forma separada.

## Otra cuenta Cloudflare

El perfil independiente incluye configuración de Worker, migraciones y acceso privado con Google. Sigue la [guía de Cloudflare y GitHub](10-cloudflare-github.md) para crear los recursos en tu cuenta y enlazar la rama `main`.
