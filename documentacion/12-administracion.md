# Administración de Tradeify
Esta entrega prepara el panel, permisos, duración de acceso y gestión de sesiones. Requiere la migración 0005_administration y TRADEIFY_OWNER_EMAIL verificado. La publicación requiere las pruebas y la autorización del propietario.

El acceso público es ilimitado por defecto. El propietario elige posteriormente la aprobación y duración. La cuenta administradora mantiene acceso aunque se cierre el registro y está protegida frente al bloqueo desde el panel.

Las bitácoras se conservan al bloquear o suspender. La eliminación integral sigue siendo una decisión del propio usuario. El código de correo permanece inactivo y sus rutas devuelven 410. La retirada de los secretos de Resend requiere el panel externo.

Se entrega paginación del servidor de 200 operaciones con cursor, y de 50 usuarios en administración. El navegador reúne el historial para estadísticas y exportaciones. La agregación de estadísticas y las notas bajo demanda en el servidor siguen pendientes como mejoras de consumo.

Las verificaciones con Google y D1 simulados están descritas en 08-pruebas-alcance.md. Deben comprobarse Google real, móviles y widgets antes de dar por finalizada la verificación de proveedores. No se dispone de un dominio propio ni se activan servicios de correo.

Los formatos aceptados de capturas siguen limitados por el esquema. No se añade descarga de imágenes en el servidor. Las rutas españolas de los widgets no están verificadas y se conserva el módulo inglés.

## Verificación local
TypeScript y las compilaciones Sites y Cloudflare pasan. Los seis scripts de tests pasan, incluida la integración administrativa y la paginación del historial. Lint termina con cero errores y dos advertencias preexistentes sobre img y navegación al cerrar sesión. Las pruebas utilizan D1/R2 desechables y Google simulado. Se verifica también que un permiso vencido impide usar una cookie todavía vigente.

Para activar la entrega se debe revisar el correo del administrador, aplicar la migración 0005 y publicar el código. El resultado de publicación se confirma mediante el check de Cloudflare asociado al commit de GitHub.


## Cambios de V2 · 18 de noviembre de 2026

En la rama de desarrollo, las sesiones de un usuario se consultan en páginas de 50 con total visible, sin el límite silencioso anterior de 100. La actividad admite fecha Desde/Hasta en hora de Ecuador, además de usuario/administrador y acción. Se añadieron casos Miniflare para 55 sesiones y filtro temporal. Estas pruebas están escritas pero no ejecutadas en el commit V2 actual; no considerar la mejora certificada hasta ejecutar `tests/check-cloudflare.mjs` tras `npm run build:cloudflare`.

## Fechas de invitación en V2
El panel muestra fecha de primera autorización y último envío consultando el historial administrativo. Si una invitación se revoca y se crea de nuevo, comienza un ciclo nuevo. Las invitaciones históricas sin evento asociado se marcan como fecha no registrada; no se asigna una fecha estimada.

Las invitaciones muestran la primera autorización y el último envío usando el historial administrativo. El ciclo se reinicia después de una revocación y nueva autorización. Si no existe evento histórico, la fecha se indica como no registrada. No se añadió una migración D1.

## Cuotas individuales V2

La ficha de usuario muestra operaciones utilizadas y permite establecer el máximo individual (1–100000) o volver al máximo general dejando el campo vacío. El servidor impide cambios sobre el propietario y valores inferiores al uso actual. Las modificaciones quedan en actividad como «Cuota actualizada». No se eliminan operaciones ni se consumen cupos al editar registros existentes. La migración 0007 conserva el límite efectivo anterior y añade un override nullable; `TRADEIFY_MAX_TRADES` sigue controlando el máximo general cuando no hay override.

Las fechas de creación y último envío de invitaciones usan el ciclo posterior a la última revocación según `rowid`, incluso si revocación y nueva invitación comparten milisegundo. Las fechas antiguas sin eventos siguen desconocidas.


## Recursos, alertas y mantenimiento V2

La pestaña Recursos y mantenimiento separa conteos internos de las métricas reales de Cloudflare, que aparecen no disponibles sin integración autorizada. Las fechas filtran altas y eventos donde existe fecha registrada; no se inventa crecimiento histórico de operaciones.

Las alertas permiten buscar, recorrer páginas y registrar revisión/resolución. Una condición detectada permanece visible aunque se marque resuelta. Las incidencias recientes son observaciones agrupadas, no prueba de una caída persistente ni conteos exactos de todos los errores.

Para activar mantenimiento, indicar mensaje y finalización prevista opcional, revisar y confirmar. El servidor impide escrituras normales y conserva lecturas, datos y sesiones. El propietario puede entrar a Administración y desactivarlo; la fecha prevista no lo desactiva automáticamente. Una versión desactualizada devuelve 409 y requiere actualizar antes de confirmar de nuevo.

Recuperación: entrar como propietario, abrir Recursos y mantenimiento, actualizar, desactivar y comprobar una escritura controlada autorizada. Si el servicio o el acceso del propietario fallan, un operador autorizado debe verificar la configuración y restaurar el Worker/respaldo conforme al procedimiento documentado; no existe un bypass público.

Cada cambio nuevo registra actor, fecha, resultado y contexto mínimo en la auditoría existente. Las cuotas individuales siguen aplicándose desde D1 y no permiten fijar un máximo inferior a registros existentes. El propietario no puede bloquearse ni eliminar su cuenta mediante los flujos ordinarios.
