# Operación y mantenimiento

| Recurso | Ubicación |
| --- | --- |
| Código/documentación | GitHub main |
| Web/API | Worker Cloudflare; perfil Sites alternativo |
| Cuentas, trades, plan, revisiones | D1 |
| Capturas | R2, referenciadas desde D1 |
| Identidad/acceso | Google y sesiones D1 en Cloudflare; identidad de plataforma en Sites |
| Límites de frecuencia | Bindings AUTH_RATE_LIMITER y API_RATE_LIMITER del Worker Cloudflare |
| Tema | Navegador |

No hay servidor MT5 ni sincronización programada. GitHub no respalda datos de usuarios.

## Copias y restauración

CSV sirve para operaciones. Para copia integral, un administrador autorizado debe exportar D1 y copiar R2 manteniendo claves, preferiblemente sin escrituras concurrentes. Conserva versión del código/migraciones junto a la copia. Los respaldos son privados y deben quedar fuera del repositorio.

No hay copia integral automática. Para restaurar crea entorno aislado, restaura esquema/datos compatibles y objetos, configura bindings/identidad, verifica referencias/capturas/métricas y después cambia producción. Conserva copia previa. Revertir código no revierte datos.

Ante limpieza R2 fallida compara claves con `attachments` antes de retirar objetos. Si la confirmación D1 falla, el servidor conserva ambas imágenes hasta poder conocer el resultado. Actualiza dependencias con pruebas y conserva el lockfile. Los eventos de seguridad registran estados y área de la solicitud; el contenido de los registros automáticos del proveedor se revisa en su panel. Las alertas externas y el SLA siguen pendientes.

## Sesiones y actualizaciones

La migración `0002_auth_sessions.sql` añade sesiones verificables y revocables. Al publicar esta versión, los usuarios de Google vuelven a iniciar sesión. Cerrar sesión elimina su fila D1 y caduca las cookies. La rotación de `TRADEIFY_SESSION_SECRET` invalida las firmas anteriores. Genera esa clave en privado y guárdala como Secret de Runtime.

La conexión GitHub → Workers Builds aplica migraciones pendientes y conserva variables con `--keep-vars`. Comprobar el commit y el log de deploy permite distinguir una fuente publicada en GitHub de una versión activa en el Worker.

## Diagnóstico

| Síntoma | Revisión |
| --- | --- |
| Pide sesión | Proveedor activo, sesión Google/D1 o acceso de la plataforma Sites |
| Diario vacío | Identidad, filtros y modo ejemplo |
| 401 | Puerta de acceso; no fijar userId en producción |
| 409 | Recargar y reintentar con versión actual |
| 429 | Esperar el Retry-After; revisar frecuencia por IP y solicitudes repetidas |
| 422 | Stop/objetivo, cierre, parciales, moneda y campos |
| Captura rechazada | Formato real y máximo 4 MiB |
| Captura 404 | Propiedad, referencia D1 y objeto R2 |
| Captura 503 | Binding BUCKET |
| Tabla inexistente | DB correcta y migración del entorno |
| Horas desplazadas | Zona bróker; convertir a Ecuador o usar offset ISO |
| Falta P&L combinado | Monedas diferentes o datos ausentes |
| Falta R | Cierre y riesgo o precios suficientes |
| Importación interrumpida | Revisar filas guardadas y reintentar mismo archivo/cuenta |
| GitHub cambió pero web no | Revisar Workers Builds, rama main y resultado de deploy; para Sites usar su flujo propio |
| Completa la configuración de acceso | Verificar los cinco valores de Runtime y el binding DB |
| Google no pudo confirmar el acceso | Verificar ID/secreto del mismo cliente OAuth y URI exacta del callback |
| Esta cuenta de Google no tiene acceso | Correo verificado coincidente con TRADEIFY_OWNER_EMAIL y cuenta elegida al entrar |
| Sesión caduca después de actualizar | Nuevo formato de sesión, expiración D1, cambio de propietario o rotación de clave |

El [informe de seguridad](../SEGURIDAD_INFORME.md) documenta cuatro avisos moderados de desarrollo, el lint preexistente y las configuraciones externas pendientes de revisión.

## Restauración V2 segura

1. Completa la carga del historial; si aparece error, reintenta antes de abrir Restaurar.
2. Selecciona el JSON privado (formato 1; máximo 20 MB). Revisa el detalle descargable con registros nuevos, idénticos y rechazados.
3. Resuelve conflictos y referencias antes de comenzar. La herramienta no reemplaza datos privados existentes.
4. Confirma el inicio. Cada lote es atómico, pero el conjunto de todo el archivo no es una única transacción. Si falla, los lotes confirmados permanecen y puedes continuar desde el lote fallido. Una respuesta perdida se recupera al reintentar con el mismo requestId.
5. Si recargas/cierra la pestaña, selecciona de nuevo el archivo tras cargar el historial: la vista previa reconstruye lo ya existente y omite registros idénticos. El nuevo informe describe ese nuevo intento; no conserva el contador de la pestaña anterior.
6. Descarga el resultado y cierra para reconciliar la bitácora. Ante 429 espera el minuto indicado y continúa; no se desactiva el limitador para restauraciones grandes.

No incluye blobs de R2 ni las claves privadas de deduplicación de CSV. Reimportar el CSV original con otros IDs puede crear registros distintos; conserva el JSON como respaldo de identidad. El historial completo y la validación de hasta 20 MB siguen usando memoria del navegador; no se ha certificado rendimiento con archivos máximos ni lectura en un worker de navegador.
