# Snapshot público y QR integrado · 23 de noviembre de 2026

Continuación de Terminal, sin publicación ni recursos reales. Decisión autorizada: 30 días, snapshot congelado, campos mínimos y extras explícitos, eliminación al revocar/borrar operación o cuenta. Mostrar/ocultar QR no cambia la autorización del enlace.

## Contrato e implementación

- API privada `/api/compartir`: identidad propia, CSRF, validación estricta, listado de enlaces propios y revocación idempotente. Ni el propietario administrativo puede consultar/modificar los de otra persona. Confirmación expresa obligatoria. No acepta snapshots calculados por el cliente: calcula con la operación/cuenta/estrategia leídas en servidor; una vista previa esperada opcional se compara y jamás sustituye el resultado.
- Lectura consistente de la fuente, comprobación de versiones de operación/cuenta y guarda transaccional contra ediciones/borrados concurrentes. El snapshot queda congelado también mediante trigger contra UPDATE. No cambia las matemáticas de la operación.
- Tabla aditiva 0016: token de 32 bytes aleatorios, únicamente SHA-256 en D1, índice único; claves foráneas compuestas por propietario con cascada. URL sin identificador real. Expiración exacta 30 días, filtrada en cada lectura; limpieza indexada de máximo 100 por lote/cron. Límite atómico de 100 enlaces activos por usuario, independiente del cliente.
- Snapshot mínimo: activo, dirección, fecha, estado y R, más versión de formato y tono de presentación. Porcentaje/dinero/precios/estrategia/notas/enlaces TradingView requieren autorización separada. Nunca contiene cuenta, correo, identificadores internos, historial vecino, scripts o URLs de imágenes privadas almacenadas.
- Página anónima `/p/<token>` con el mismo diseño y CapturePreview. Cuenta autenticada o cabeceras falsificadas no cambian el contenido público. No contiene navegación privada. Respuestas sin caché, noindex/nofollow/noarchive/nosnippet y no-referrer, CSP con nonce; errores genéricos sin cuenta, soporte o inicio de sesión. Limitador IP nativo existente también protege las páginas públicas. Mantenimiento bloquea lectura y creación, conservando revocación.
- Vista previa de privacidad antes de crear. Opciones públicas independientes de las de PNG/reportes; aviso explícito de diferencias. La URL se entrega solo al crear y no se conserva al cerrar el diálogo: guardar enlace/QR, revocar desde la lista propia o crear otro. No se guarda un token recuperable en D1 ni localStorage.
- QR local con `qrcode@1.5.4`, ECC Q, margen de cuatro módulos y cuadrícula entera. Se integra en la franja superior de la misma tarjeta, redistribuyendo curva/etiqueta; desactivado recupera el espacio completo, sin hueco reservado. No existe QR ficticio ni envío a servicios externos. El PNG usa el mismo SVG que la vista previa.
- `jsqr@1.4.0`, solo desarrollo, decodifica independientemente imágenes completas. Pruebas locales: tres formatos × dos temas × PNG/JPEG 720 px/calidad 65. No equivale a comprobar cámaras físicas o la compresión efectiva de cada red social.

## Respaldo y recuperación

El respaldo privado de bitácora no incluye enlaces públicos. La copia operacional contiene la tabla, pero se deben eliminar todos los enlaces públicos antes de reabrir una recuperación para no resucitar enlaces revocados después de la fecha del respaldo. El ensayo operacional verifica copia íntegra primero y este cierre obligatorio después, junto a la revocación de sesiones. No se ejecutó una restauración real.

Revocar/borrar invalida el acceso futuro, no retira PNG, texto o capturas que otra persona ya guardó. La vigencia de una tarjeta descargada no puede controlarse; lo que vence es su enlace. La activación de un campo sensible es responsabilidad explícita de quien comparte.

## Licencias y fuentes

`qrcode` usa MIT; `jsQR` Apache-2.0; tipos `@types/qrcode@1.5.6` MIT. Licencias completas de las versiones instaladas conservadas en `vendor/`. QR sin CDN ni servicios de pago. Documentación primaria consultada: https://github.com/soldair/node-qrcode y https://github.com/cozmo/jsQR. No se incorporó código del prototipo adjunto como runtime ni frases atribuidas a autores.

## Estado de pruebas

Antes del commit: TypeScript, seis grupos D1 de snapshots (incluida carrera determinista entre lectura y transacción), cuatro grupos del Worker compilado, migración 0016 y doce imágenes QR decodificadas aprobados. Se amplían matriz de acceso, borrado y recuperación operacional: 30 tablas y 87 objetos de esquema, incluido un snapshot que se verifica y revoca antes de reabrir. Auditoría: cero avisos de producción y cuatro moderados de desarrollo conocidos; no se degrada Drizzle Kit. El recorrido Chromium añadido verifica confirmación, snapshot anónimo, siete anchos/dos temas, cuatro análisis axe, descargas nativas de tres formatos y decodificación PNG/JPEG, ocultación sin revocación y revocación efectiva.

No se marca Chromium aprobado hasta registrar SHA y ejecución. El primer recorrido Terminal 45183268956 falló por localizador exacto de select y carrera de cookies; captura y registro se conservan. Corrección de pruebas `6fb88ae` en ejecución al escribir este informe. La nueva funcionalidad QR requiere además su propia ejecución tras el commit.

Pendientes: confirmar evidencia nativa final, pruebas completas con/sin R2 y builds, actualizar matrices de fases. Continúan los bloqueos externos de Cloudflare/Google/respaldo/reversión/requisitos legales/derechos y la prohibición de publicar sin autorización adicional.

## Cierre verificado · 23 de noviembre de 2026

Los pendientes de verificación de los apartados anteriores quedaron resueltos en `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`: Chromium 45189916983, 219/219 casos, 68 análisis axe sin infracciones automáticas; suite local final 18 comandos aprobados y auditoría dev con cuatro moderados conocidos. Se preservan los intentos fallidos y sus correcciones sin modificar expectativas financieras. [Entrega final y continuación externa](29-entrega-terminal-qr-ux-2026-11-23.md), [PNG/hashes y resultados](verificacion-terminal-2026-11-23/chromium-final/manifest.json). No publicado ni probado contra servicios productivos.
