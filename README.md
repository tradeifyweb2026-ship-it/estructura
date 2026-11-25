# Tradeify · Bitácora de Trading

**Estado V2 (21 de noviembre de 2026):** desarrollo en `mejoras-v2-2026-11-18`. Diez perfiles de reportes y exportaciones contextuales implementados; lanzamiento pendiente. [Continuación y estado vigente de las 25 fases](documentacion/18-reportes-v2-2026-11-21.md).

**Documentación completa:** [Índice](documentacion/README.md).

**Despliegue en tu cuenta de Cloudflare desde GitHub:** [Guía de instalación](documentacion/10-cloudflare-github.md).

**Tradeify en Cloudflare:** https://tradeify.tradeify-web-2026.workers.dev/

**Informe de seguridad:** [Hallazgos, pruebas y pendientes](SEGURIDAD_INFORME.md).

**Revisión de usabilidad:** [Correcciones, recorridos y evidencia visual](UX_INFORME.md).

Este repositorio contiene el código de interfaz y servidor, migraciones, configuración, recursos y pruebas. Cloudflare Workers Builds está conectado a `main` y ejecuta `npm run build:cloudflare` y `npm run deploy:cloudflare`. Los registros y capturas viven en D1/R2 y sus respaldos se conservan fuera de GitHub.

El perfil alternativo de ChatGPT Sites usa su propia autenticación y publicación. Su dirección es https://bitacora-de-trading.assuredopal.chatgpt.site/.

Bitácora privada para registrar entradas y salidas, revisar el rendimiento y guardar el diario de ejecución. La cuenta del usuario empieza vacía.

## Uso

- Registra una operación abierta con su entrada y stop inicial. Desde el detalle puedes editarla, cerrarla, añadir parciales y pegar enlaces de TradingView de entrada y salida.
- Crea cuentas, setups, metas y checklist desde **Configuración**. Archivar una cuenta o setup conserva su historial. En V2, los setups mantienen hasta 20 versiones anteriores. Puedes restaurar una de ellas como versión actual sin cambiar los snapshots históricos de operaciones.
- En **Bitácora** puedes filtrar, exportar CSV e importar operaciones cerradas. La plantilla muestra los encabezados admitidos. La vista previa señala las filas incompatibles antes de importar. Si un bróker usa otra zona, convierte sus fechas a Ecuador o incluye su offset ISO en el CSV.
- La curva muestra resultados netos acumulados desde cero. En R se usa P&L neto dividido por riesgo inicial monetario cuando ambos existen. Como alternativa se calcula con precios y stop inicial, ponderando los parciales. Los totales monetarios solo aparecen cuando todos los cierres del filtro tienen P&L y comparten una moneda; si no, se evita totalizar dinero y se indica la cobertura de R disponible.
- La revisión semanal o mensual guarda una reflexión por periodo y cuenta. **Imprimir / PDF** abre el diálogo de impresión del navegador.

## Implementación

La interfaz usa App Router, React, TypeScript y Vinext sobre Cloudflare Workers. El perfil Cloudflare autentica a cada usuario con Google o, si está habilitado, con un código enviado por correo y verifica sesiones revocables en D1. R2 se conserva para consultar y limpiar capturas privadas anteriores; no se admiten nuevas subidas. Los enlaces nuevos se guardan como texto en D1. El perfil Sites recibe la identidad de su plataforma. El identificador del usuario delimita las consultas y las relaciones de la base. Los valores de dinero se guardan en centavos enteros y las fechas con época UTC. La interfaz muestra hora de Ecuador continental.

Las escrituras validan tipos, límites y origen. Cloudflare aplica límites aproximados por IP de 20 solicitudes por minuto a las rutas de acceso y 120 a la API. El cierre de sesión revoca la sesión en el servidor. La tabla `auth_sessions` se incorpora mediante `0002_auth_sessions.sql`.

## Desarrollo

Se requiere Node.js 22.13 o posterior. Desde la raíz ejecuta `npm run install:ci`, `npm run build` y aplica la migración al entorno local antes de abrir la aplicación.

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wild_thundra.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_magical_spot.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_auth_sessions.sql
npm run dev
```

Para cambios de esquema usa `npm run db:generate` y conserva las migraciones aplicadas. La publicación crea y conecta los bindings `DB` y `BUCKET` declarados en el manifiesto. La fuente Geist incluye su licencia en `public/Geist-OFL.txt`.

## Verificación

```sh
npm run typecheck
npm run test:logic
npm run build
node tests/check-api.mjs
node tests/check-export.mjs
node tests/check-capture-failures.mjs
```

Para ejecutar las pruebas con imports TypeScript nativos utiliza Node.js 22.18 o posterior. La integración usa D1/R2 desechables en Miniflare. Después de `npm run build:cloudflare`, `node tests/check-cloudflare.mjs` verifica Google simulado, sesiones, origen, cabeceras y límites. Los requisitos y comandos para ambos perfiles están en [Pruebas y alcance](documentacion/08-pruebas-alcance.md).

La revisión de seguridad del 17 de noviembre de 2026 deja el análisis completo de dependencias con cuatro avisos moderados en una herramienta de desarrollo y sin críticos/altos. El informe detalla esos avisos y los errores de lint históricos; la verificación V2 del 20 de noviembre corrige los errores y mantiene una advertencia de imagen externa. La revisión posterior de usabilidad prueba Chrome, seis secciones en ocho anchos CSS, zoom 200% y datos ficticios; documenta las pruebas de teléfono, impresión y accesibilidad todavía pendientes.

La administración privada, las reglas de registro y los vencimientos se describen en documentacion/12-administracion.md. Google es el único acceso habilitado en la versión administrativa.

## Restauración y límites en V2

La restauración exige historial completo y admite JSON formato 1 de hasta 20 MB. La vista previa identifica registros nuevos, idénticos, conflictos y referencias ausentes. Cada lote D1 es atómico; los lotes anteriores confirmados permanecen si falla el siguiente. Un recibo por usuario y solicitud permite repetir un envío con la misma respuesta tras una desconexión. No reemplaza registros existentes ni restaura objetos físicos R2. Puede descargarse el detalle de la restauración.

Riesgo separa importes iniciales, riesgo restante estimado hasta el stop y resultados diarios calculados o estimados. Los parciales sin fecha que pudieran corresponder al día impiden declarar el límite evaluable. Las cuentas se evalúan individualmente y no se compensan sus límites entre sí. Puedes configurar límites de operación, pérdida diaria y riesgo simultáneo por cuenta; no bloquean órdenes del bróker. Las cuotas individuales de registros se administran desde el panel y se aplican en D1, también al importar o restaurar.

V2 añade las migraciones aditivas `0006_restore_receipts.sql` y `0007_individual_quotas.sql`. Se probaron con registros anteriores en D1 local; no se aplicaron a producción. Antes de publicarlas se requiere un respaldo real recuperable, verificación de bindings y un punto de reversión del Worker.

```sh
npm run test:restore
npm run test:exports
# Después de build Sites:
npm run test:api
# Después de build:cloudflare con bindings de prueba:
npm run test:cloudflare
```

## Consultas escalables y drawdown

Resumen, Bitácora y Estadísticas consultan páginas y agregados SQL completos por cuenta/periodo; los resultados no dependen de las filas visibles. La curva diaria se carga primero y el detalle por operación se solicita con su control. Exportaciones/restauraciones recogen los registros completos solo al pedirlos y rechazan cambios entre páginas, sin generar archivos parciales. Preparar una exportación respeta 429/Retry-After, muestra progreso y permite cancelar.

La migración aditiva `0008_query_indexes_revisions.sql` incorpora índices y revisiones por usuario. Los cursores se invalidan con 409 si cambia el conjunto; actualiza para iniciar una nueva lectura. Psicología, Revisiones, Cuentas, Estrategias y Riesgo también usan consultas dedicadas, proyecciones y caché por revisión. Sus agregados no descargan operaciones completas al navegador; se comprueban las versiones de metadata ante cambios concurrentes.

En Cuentas se pueden configurar drawdown máximo/diario, pérdida total y su base (cierres o saldo realizado con parciales). Riesgo explica datos incompletos y umbrales nominales de fondeo; no conoce equity ni certifica las reglas reales del proveedor.

```sh
npm run test:queries
```

La suite prueba 100, 1.000, 10.000 y 20.000 operaciones en D1 local, incluida paridad con las fórmulas existentes, filtros, orden, exportación y concurrencia. `drizzle-kit` se actualiza a 0.31.11; cuatro avisos moderados de su cadena de desarrollo permanecen documentados. No hay publicación de esta continuación.

### Continuación V2 del 22 de noviembre

Los cinco módulos pendientes tienen implementación y pruebas aisladas: consultas dedicadas, frases sincronizadas, administración/mantenimiento, ayuda y aplicación en Chromium. Consulta [el estado vigente de las 25 fases](documentacion/19-modulos-v2-2026-11-22.md) y [los resultados reproducibles](documentacion/verificacion-modulos-2026-11-22/resultados.json). No hay publicación de esta entrega; las condiciones externas se detallan en el informe.
