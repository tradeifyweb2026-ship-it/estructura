# Scripts privados: contrato criptográfico y continuación

Estado: biblioteca privada implementada con API, almacenamiento cifrado, editor local y respaldo. Verificación local integral y recorrido Chromium aprobados; no publicación.

## Decisión expresa sobre las líneas

El propietario priorizó el cifrado exclusivo en el navegador: 1.000 líneas en el editor para usuarios normales, sin límite artificial de líneas del propietario, y límites reales de bytes/cuotas en el servidor. Un cliente modificado puede saltarse el límite de líneas. No se certificará un contador de líneas enviado por el cliente. El servidor obtiene el rol desde la sesión y verifica bytes de los sobres, consumo acumulado, versiones y límites de solicitudes existentes.

Valores técnicos aplicados por la API y los triggers D1: 128 KiB de código normal, 512 KiB del propietario; metadatos 4 KiB; presupuesto por biblioteca de 5 MiB/25 MiB. Los triggers verifican el presupuesto en la transacción y actualizan consumo/revisión; el rol se obtiene de la identidad autenticada, nunca del cuerpo. La contabilidad incluye JSON cifrado y 512 bytes por registro; es presupuesto interno, no facturación D1.

## Formato y garantías comprobables

- Clave aleatoria de datos de 256 bits, no extraíble tras importarla en Web Crypto. AES-GCM, IV aleatorio de 96 bits y etiqueta de 128 bits.
- Nombre y descripción cifrados separados del código. AAD identifica dominio, bóveda, documento, versión y campo: intercambiarlos invalida la autenticación.
- Clave personal de 12–256 caracteres; PBKDF2 SHA-256, 600.000 iteraciones y salt aleatorio de 128 bits. El servidor recibe únicamente el sobre, nunca la clave personal ni el código sin cifrar.
- Código de recuperación independiente de 256 bits. Recuperar cambia la envoltura de la misma clave de datos y permite abrir el contenido existente. No revoca copias antiguas: un respaldo anterior sigue admitiendo su clave anterior.
- Base64url canónico y formatos/versiones/tamaños acotados; rechazo de campos inesperados del sobre y de algoritmos/iteraciones manipulados.
- Borradores incompletos o con demasiadas líneas se pueden cifrar bajo un dominio distinto, sin convertirlos en guardados válidos. La biblioteca conserva borradores únicamente cifrados en localStorage, separados por identidad/bóveda/documento. Fallos de espacio o conexión se muestran sin afirmar que se guardó. Los borradores sobreviven al cierre de sesión y se eliminan tras borrar la cuenta.
- Las copias temporales de bytes sensibles se sobrescriben cuando es posible. JavaScript no permite prometer borrado físico de cadenas ni de todas las copias internas del motor.
- No compila, evalúa ni ejecuta Pine. No usa CDN, servicios externos, librerías criptográficas añadidas ni claves de infraestructura.

El límite de líneas en `encryptScript` es una política del cliente. El descifrado acepta texto seguro por bytes aunque otro cliente haya superado ese límite, para evitar perder datos; el editor debe advertir y exigir ajustarlo antes de guardar.

## Frontera de confianza

Protege el contenido almacenado frente a lectura sin la clave de datos o sus credenciales de apertura. Requiere confiar en el navegador, el dispositivo y el JavaScript servido: no protege frente a XSS, un dispositivo comprometido ni un operador capaz de sustituir la aplicación. Perder clave personal y código de recuperación impide recuperar la biblioteca después de bloquearla. No existe recuperación administrativa del texto.

## Pruebas

`tests/check-script-crypto.mjs` usa Web Crypto nativo de Node, sin sustitutos criptográficos. Nueve grupos: roundtrip/no extracción, contraseña incorrecta, AAD, alteraciones/formato, IV, recuperación, líneas/bytes/UTF-8, borradores y validación. Se integra en `test:advanced`. Estas pruebas de primitivas se complementan con siete grupos D1, API compilada, matriz de acceso, recuperación operacional y recorrido separado de Chromium. Solo el recorrido de navegador acredita la interfaz y se registra por SHA; no se sustituye por una prueba DOM.

## Biblioteca implementada

- Herramientas → Mis scripts comparte la ruta existente con diez calculadoras, conservadas. CodeMirror 6 se empaqueta localmente y carga bajo demanda al abrir el editor. Números de línea, resaltado léxico básico original, sangría, búsqueda, deshacer/rehacer, copia y salida con Tab. No compila, valida ni ejecuta Pine. No usa CDN ni workers externos.
- Nombre y descripción también cifrados. Tras desbloquear se leen metadatos paginados con revisión fija; se buscan en memoria. El código se descarga únicamente al abrir un documento o exportar explícitamente.
- API privada sin lectura administrativa de contenido ajeno. Registros por identidad, id y versión; CAS rechaza conflictos. Guardar como copia nueva permite conservar una edición local sin sobrescribir la remota.
- Solo última versión. Exportación privada de todas las páginas, JSON cifrado con sobre y versiones, hasta 40 MB; falla antes de descargar un archivo parcial. Restauración confirmada y reanudable, idempotente para registros idénticos, sin mezclar bóvedas ni sobrescribir conflictos.
- Recuperación local reenvuelve la clave de datos, con CAS del sobre. Restablecimiento definitivo de la biblioteca exige la frase BORRAR BIBLIOTECA; no toca operaciones ni cuentas de trading. Borrado de cuenta elimina sus tablas por FK en cascada y preserva otras bibliotecas.
- Migración 0015 aditiva, esquema/snapshot coherentes. El respaldo operacional incluye las dos nuevas tablas cifradas; el ensayo recupera y descifra un script con su clave de prueba. Ninguna clave personal se almacena en D1 ni se agrega al manifiesto operacional.
- Límites de bytes UTF-8 preservan texto; Unicode inválido se rechaza antes de cifrar en lugar de sustituir caracteres silenciosamente. El descifrado acepta un registro de más de 1.000 líneas dentro del límite de bytes, para no perder datos escritos por otro cliente; el editor exige ajustarlo antes de guardar como usuario normal.

## Verificación y continuidad

El ejecutor se interrumpió y se recuperó. Antes de reconciliar los cinco commits remotos se archivaron todos los cambios locales; se reconstruyeron y verificaron sus objetos Git y árboles sin descartar prototipos. Se conserva un único núcleo criptográfico, integrado con el contrato persistente.

La prueba de cuentas que falló por net::ERR_ABORTED recargaba antes del popstate de history.back del modal. Se espera la finalización real de ese historial; no se reintenta el guardado ni se alteran expectativas financieras.

Verificaciones finales se registran en el informe de entrega y carpeta de evidencia nueva. No ejecutar migraciones reales ni publicar. Después de completar el recorrido de scripts, continuar fase 04 Terminal compartible y fase 05 porcentaje (neto/capital inicial registrado), luego capturas públicas y snapshot/QR de 30 días conforme al informe 23.

Referencias primarias: [AES-GCM e IV/AAD](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams), [PBKDF2 SHA-256](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [CodeMirror y navegación con Tab](https://codemirror.net/examples/tab/), [manual CodeMirror](https://codemirror.net/docs/ref/), [estructura Pine](https://www.tradingview.com/pine-script-docs/language/script-structure/). No se copia un corpus Pine de terceros ni se afirma validación FIPS o auditoría criptográfica externa. Las nuevas dependencias y sus licencias MIT se fijan en package-lock; resultados de auditoría se registran aparte.

## Cierre comprobado de la fase 03

- Código funcional culminado en `ac044966838861dbd9288f16a0a02056c63ad48f`; correcciones intermedias conservadas en el historial.
- [Chromium 45107587077](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/actions/runs/45107587077): 215 comprobaciones, 56 análisis automáticos sin infracciones, cero excepciones y errores inesperados de consola. Siete anchos y dos temas; pruebas reales de pegar/copiar 1.001 líneas, sangría, guardar, bloquear, recuperar, exportar/restaurar, conflicto, copia nueva, desconexión/borrador y propietario.
- API Sites compilada aprobada en la misma ejecución. La suite local completa en `bfef507` aprueba 17 comandos y registra aparte cuatro moderados de desarrollo; cero avisos de producción. Tras los ajustes de interfaz se repitieron TypeScript, lint, unidad de editor y la regresión completa en Chromium/API/seguridad.
- [Evidencia y PNG conservados](verificacion-scripts-2026-11-22/chromium/manifest.json); copias manualmente revisadas a 320 px. El ZIP de Actions se verificó por SHA-256 antes de extraer.
- La sincronización del documento ahora pertenece a CodeMirror: React no reescribe ecos antiguos sobre el texto nuevo; recuperar borrador es una sustitución explícita. El modal recibe el estado de cambios del editor, ya que el pegado interceptado por CodeMirror no siempre emite eventos nativos de formulario. No se cambiaron expectativas financieras para aprobar pruebas.
- Alcance: aplicación compilada aislada, datos ficticios y Google simulado. No certifica producción, Safari/dispositivos físicos ni conformidad universal WCAG.
