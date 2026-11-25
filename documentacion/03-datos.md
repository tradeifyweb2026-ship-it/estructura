# Modelo de datos

La migración `0001_magical_spot.sql` añade `daily_quote_progress`, con una fila por identidad autenticada, fecha del último aviso y posición en el catálogo. El POST autenticado a `/api/frase-diaria` consume una frase como máximo por fecha hábil de Ecuador. Un solo cambio condicional en D1 resuelve peticiones simultáneas. El catálogo proviene de `Frases_por_categoria_sin_repetidas(1).csv` y alterna sus 16 categorías al principio de la rotación. Tras 2.019 entregas reinicia. Mantén los registros existentes en el mismo orden si amplías el catálogo.

El navegador guarda visibilidad, sonido y volumen en `trading-journal-daily-quote`. El servidor puede registrar una frase como entregada aunque la conexión se interrumpa antes de mostrar la tarjeta. La siguiente apertura de ese día no vuelve a consumir una frase.

| Tabla | Clave | Datos |
| --- | --- | --- |
| accounts | usuario + id | Versión, JSON de cuenta |
| setups | usuario + id | Versión, JSON de setup |
| trades | usuario + id | Versión, apertura, cuenta, setup, importKey y JSON |
| attachments | usuario + trade + slot | objectKey R2 y revisión UUID |
| plans | usuario | Versión y JSON de plan |
| reviews | usuario + semana + alcance | Versión y JSON de revisión |
| daily_quote_progress | usuario | Día de entrega y posición en el catálogo |
| auth_sessions | hash del identificador aleatorio de sesión | Usuario y expiración; índice por expiración |

Las claves foráneas incluyen usuario: un UUID ajeno no permite asociar datos de otro propietario. Al borrar un trade se eliminan referencias de capturas en cascada. El índice `trades_user_opened` ayuda a consultar por usuario/apertura; `trades_user_import` impide duplicar claves de importación del usuario.

## Diccionario

Los contratos exactos están en `lib/journal.ts`.

- Cuenta: name, type (Demo/Real/Evaluación/Fondeada), currency, startingBalanceCents, archived.
- Setup: name, description, rules, color, archived y hasta 20 snapshots previos (version, savedAt, activos, temporalidades, sesiones, reglas, riesgo y estado). El historial es JSON opcional; no requiere migración.
- Trade: accountId, setupId, asset, direction (long/short), openedAt, closedAt, entry, stop, target, exit, size, riskPercent, riskCents, pnlCents, feesCents, partials, before, during, after, grade, errors, checklist, notes.
- Parcial: price y percent (máximo 12).
- Emoción: name e intensity 1–5, o null.
- Nota: kind (text/heading/check), text y checked; hasta 30 bloques de 2.500 caracteres.
- Checklist: text y checked; hasta 20 reglas.
- Plan: rules, riskPercent, dailyLossR, weeklyTargetR.
- Revisión: followed, repeat y change; week es un lunes YYYY-MM-DD y scope es all/unassigned/UUID de cuenta.

El dinero se almacena como centésimas enteras: USD 12,34 = 1234, también para monedas habitualmente mostradas sin decimales. Se admiten USD/EUR/GBP/CAD/AUD/CHF/JPY/MXN sin conversión. Null es desconocido, no cero. P&L admite negativos; riesgo monetario debe ser positivo. Precios y tamaño son números, no importes en centavos.

Fechas: milisegundos de época UTC entre 2000 y 2100. Presentación/entrada en America/Guayaquil (Ecuador continental, UTC−05:00).

## Versiones y persistencia

Creación de cuenta/setup/trade: version null; edición: versión leída, que se incrementa. Plan/revisión comienza en versión 0. Versiones obsoletas devuelven 409. La identidad del propietario procede del servidor.

Capturas tienen revisión independiente. Se guarda el objeto R2 y luego la referencia D1 condicional. Si la respuesta de escritura falla, se consulta D1 antes de decidir la limpieza. Si esa consulta también falla, se conservan ambas imágenes para proteger el objeto que podría estar referenciado. Al reemplazar/borrar se intenta eliminar el anterior. D1 y R2 pueden dejar objetos huérfanos que requieren reconciliación de referencias.

`drizzle/0002_auth_sessions.sql` añade la tabla de sesiones del perfil Google. La cookie contiene un identificador aleatorio firmado y D1 guarda su hash SHA-256, usuario y vencimiento. Cada solicitud con sesión comprueba que la fila siga activa. Cerrar sesión elimina esa fila. Un nuevo login limpia hasta 100 sesiones expiradas y crea la nueva. El formato nuevo requiere volver a iniciar sesión al actualizar.

La migración inicial es `drizzle/0000_wild_thundra.sql`. No edites migraciones ya aplicadas. Cambios de JSON pueden requerir transformación de datos aunque no cambien columnas. Genera migraciones nuevas y pruébalas sobre una copia antes de producción.

Los identificadores conservan el formato GUID hexadecimal aceptado por el importador anterior, incluso tras actualizar Zod. Las pruebas incluyen crear y editar un registro con ese formato heredado.

## Fase 1: enlaces de capturas

`trades.data.captureLinks` es opcional: `{ before?: string, after?: string }`. No requiere migración ni actualización masiva. Los trades antiguos sin el campo siguen válidos. El editor general conserva estos enlaces al editar/cerrar la operación. Su guardado usa la misma versión optimista y filtro de usuario que saveTrade. Se guarda solo texto; nunca se descarga ni convierte la imagen a Base64. `attachments` y su relación con R2 se conservan.

Desde 0003, user_limits conserva el límite efectivo por usuario. Los disparadores de SQLite aplican las cuotas dentro de la operación de escritura. Desde 0004, login_codes conserva un hash de dirección como clave primaria, un hash de código, caducidad, intentos y fecha de creación. No contiene el correo ni el código en claro. La identidad email:dirección fuera de esta tabla sí contiene el correo normalizado.

La migración 0005_administration crea users, access_settings, access_invitations y admin_events. Añade inicio, actividad y descripción de dispositivo a auth_sessions. Conserva las tablas y registros existentes. Las identidades anteriores se incorporan al acceder de nuevo. Su fecha de registro se corresponde con esta incorporación porque antes no se almacenaba una fecha de alta. La actividad de sesión se actualiza como máximo una vez por cinco minutos. La descripción procede del navegador y no identifica físicamente el dispositivo. Los registros administrativos se conservan al eliminar una cuenta y contienen actor, objetivo, fecha y cambio solicitado.

## V2 · migraciones 0006/0007

`restore_receipts` tiene clave primaria `(user_id,request_id)`, fingerprint SHA-256 del lote validado y resultado con IDs/estados de registros. El recibo y las inserciones comparten transacción D1; se elimina al borrar la cuenta. No contiene el respaldo completo ni identidades externas.

`user_limits.custom_trades` es nullable: null utiliza el límite general; un entero positivo conserva la cuota individual ante escrituras posteriores. `trades` conserva el máximo efectivo que usa el trigger de cuota existente. El administrador no puede fijar una cuota inferior al uso actual mediante la API. Las migraciones no reescriben JSON ni eliminan datos. Se verifica actualización de registros antiguos en `tests/check-migration-upgrade.mjs`.

Las cuentas pueden incluir `riskLimits` opcional en JSON: `perTradePercent`, `dailyLossR` y `simultaneousPercent`. Los respaldos antiguos sin este campo siguen siendo válidos. No es exposición de bróker ni conversión entre monedas.

## Migración 0008: consultas y revisiones

`journal_revisions(user_id,version)` es un contador monotónico por usuario. Triggers de INSERT/UPDATE/DELETE en trades, accounts, setups, plans, reviews y attachments lo incrementan dentro de cada escritura. Una lectura paginada o respaldo exige revisión constante. Al eliminar una cuenta se borra este contador después de sus datos.

Los cuatro índices nuevos sirven fecha de resultado por usuario/cuenta, cierres anteriores y orden diario de entradas. La fecha de resultado es `coalesce(json_extract(data,'$.closedAt'),opened_at)`; se mantiene el contrato de fecha de cierre o apertura cuando sigue abierta. Se comprobó el índice de cuenta/periodo con EXPLAIN QUERY PLAN. La migración no reescribe los JSON. El SQL de índices por expresión se revisó manualmente: Kit generó comas/identificadores mal escapados al crear esa migración; el snapshot conserva las expresiones y una generación posterior informa cero cambios.

`riskLimits` admite además `drawdownBasis`, `maxDrawdownPercent`, `dailyDrawdownPercent` y `totalLossPercent`, opcionales y sin migración de JSON. Los valores financieros faltantes siguen siendo null, sin sustitución por cero.


## Migraciones aditivas 0009–0012

`0009_section_cache` añade agregados privados por usuario/clave/revisión. `0010_quote_library` añade preferencias, entregas e historial/favoritas con snapshots. `0011_admin_operations` añade el singleton de mantenimiento y estados de revisión de alertas. `0012_operational_incidents` conserva observaciones técnicas agrupadas.

El esquema Drizzle y sus snapshots se mantienen alineados; la generación de esquema posterior no produce cambios. Las pruebas de actualización conservan los registros, versiones y relaciones anteriores, además de comprobar restricciones y claves foráneas. No se ejecutó ninguna migración remota.

Los cambios del diario invalidan agregados por los triggers existentes. La biblioteca de frases tiene control de versiones y secuencia propios; su migración idempotente cuenta frases anteriores como vistas en el ciclo actual y usa escritura SQL conjunta. El borrado de cuenta elimina sus tablas de biblioteca y caché. Los incidentes globales no contienen datos privados de operaciones.

El JSON de bitácora mantiene su formato anterior y no contiene la biblioteca de frases ni los blobs R2. Para un respaldo operacional completo y una reversión real se necesita copia recuperable D1/R2. Consulta [el procedimiento vigente](19-modulos-v2-2026-11-22.md).
