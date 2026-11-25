# Nuevas fases autorizadas · 22 de noviembre de 2026

Inicio real: `69521bea76ce97e5881f81a6b721619cabfcca4d`, rama `mejoras-v2-2026-11-18`, árbol limpio. El HEAD `483d536` del documento adjunto es una referencia histórica, no un punto al que retroceder. Se conservan los informes 19–22 y sus verificaciones.

## Decisiones expresas del propietario

Respuestas recibidas en esta sesión; reemplazan los puntos abiertos correspondientes del PDF:

| Tema | Decisión aprobada |
|---|---|
| Catálogo | Vacío por usuario; cada uno crea sus activos. No se siembran mercados ni se asocia historial silenciosamente. |
| Tarjetas | Terminal Premium solo en las compartibles; curva decorativa identificada. Las tarjetas internas quedan fuera del rediseño. |
| Porcentaje | P&L neto / capital inicial registrado de la cuenta × 100, solo con datos completos/válidos y divisa consistente. No es porcentaje sobre equity vivo. |
| Scripts | Cifrado en el navegador, clave personal y código de recuperación; perder ambos impide recuperar el código. |
| Líneas de scripts | Se prioriza el cifrado en navegador: 1.000 líneas en el editor normal y bytes/cuotas reales en servidor. Un cliente modificado puede saltarse el límite de líneas. Decisión expresa posterior del propietario. |
| Versiones de scripts | Solo última versión; exportación privada separada e inclusión del contenido cifrado en el respaldo operacional. |
| QR | Snapshot congelado, 30 días; eliminar al revocar/borrar trade o cuenta. Campos mínimos activo/dirección/fecha/estado/R; otros por autorización expresa. Ocultar QR no revoca la URL. |

No se autorizaron despliegues, cambios de secretos, migraciones reales, infraestructura productiva ni cambios en main. Las decisiones anteriores no exigen pedir otra vez autorización de implementación.

## Adjuntos y referencias revisadas

- PDF completo de siete páginas y texto completo de 1.102 líneas. La autorización final del texto sustituye la prohibición histórica de programar; conserva privacidad, decisiones y exclusiones. El PDF es la especificación principal.
- Code Studio: 63 entradas ZIP, 278.319 bytes expandidos. MIT; revisión de README, editor, almacenamiento y seguridad. Monaco se descarga por CDN, usa loader/worker data y no ofrece aislamiento multiusuario ni cifrado del código. Se aprovechará el comportamiento útil, sin importar su aplicación, GitHub/PAT, previews ejecutables, service worker o dist.
- Terminal: cinco entradas, 203.021 bytes expandidos. README y Neon.dc.html revisados; referencia 540×540, geometría/colores/tipografía y curva. Runtime support/vendor no se incorpora. La referencia visual está también en la primera página del PDF, renderizada y revisada.
- La captura original separada de TradingView no forma parte de estos cuatro adjuntos. El defecto de contenedor vacío se confirma directamente en el código actual y se reproduce con imágenes/páginas de prueba; no bloquea su corrección.

Comparación de editor antes de instalar dependencias:

| Alternativa | Evidencia y decisión técnica provisional |
|---|---|
| Monaco / monaco-react | MIT; el README oficial declara que Monaco no soporta móviles. El wrapper React no cambia esa limitación. Requiere empaquetado y workers compatibles con la CSP; no importar el loader CDN del ZIP. |
| CodeMirror 6 / react-codemirror | Motor modular y wrapper MIT, extensiones para historial/búsqueda/líneas y opción cspNonce. Candidato preferido para prototipo móvil y bundle local; debe probarse antes de certificar compatibilidad. |
| pinescript-ai | MIT; CodeMirror/Pine como referencia. Generación IA/BYOK/RAG y validación/ejecución no pertenecen al alcance; no se incorporan esas funciones ni sus claves. |
| pinecoders/pinescript-syntax | MIT declarado, orientado a extensión VS Code/TextMate. Revisar gramática y avisos concretos antes de reutilizar; no equivale a extensión compatible directamente con navegador. |
| folknor/pine-tools | Núcleo MIT, con material vendor/MPL separado. LSP/MCP/linter y librerías Pine de terceros no son necesarios para guardar texto privado. No se copia el corpus. |
| snippetslibrary.com | MIT declarado, referencia de organización de snippets; no se trasplanta su backend/autenticación ni catálogo público. |

Fuentes primarias consultadas: [Monaco](https://github.com/microsoft/monaco-editor), [monaco-react](https://github.com/suren-atoyan/monaco-react), [react-codemirror](https://github.com/uiwjs/react-codemirror), [CodeMirror](https://codemirror.net/docs/ref/), [pinescript-ai](https://github.com/arturoabreuhd/pinescript-ai), [gramática Pine](https://github.com/pinecoders/pinescript-syntax), [pine-tools](https://github.com/folknor/pine-tools), [snippets](https://github.com/cojocaru-david/snippetslibrary.com). No se incorporó código de esos repositorios en la corrección de capturas.

## Matriz de alcance vigente

| Fase del PDF | Existe / falta | Estado |
|---|---|---|
| 01 Inspección | Adjuntos, HEAD, arquitectura y decisiones revisados; módulos previos conservados | Completada para iniciar implementación |
| 02 Activos | Catálogo privado vacío, CRUD/alias/favoritos/recientes, asociación confirmada y agrupación estable; respaldo privado y registro Sites | Implementado y verificado; integrado en Chromium 215 casos, API, seguridad, migración y recuperación |
| 03 Scripts | Biblioteca cifrada, recuperación, editor local, borradores, última versión, cuotas D1 y respaldo privado/operacional | Completada en su alcance aprobado: código `ac044966`, evidencia `6936c042`; informe 24 |
| 04 Tarjetas | Terminal solo compartible: formatos/temas/estados, curva identificada y privacidad independiente | Completa; Chromium final 219/219 y PNG reales; informe 29 |
| 05 Porcentaje | Solo R / Solo % / R y %, neto explícito sobre capital inicial registrado y No disponible cuando corresponde | Completa y verificada; sin equity ni doble conteo |
| 06 Capturas | Componente común en editor/detalle, tarjeta y página pública; decode/fallback/enlace | Completa; snapshot rico y fallback público comprobados en navegador |
| 07 Página/QR | Snapshot mínimo/opt-in, token hash, 30 días, CAS, cuota, revocación/cascadas y QR integrado decodificable | Completa y verificada en recursos desechables; sin publicación |
| 08 UX | Flujos separados, cuatro confirmaciones accesibles, grupos/móvil y 90 artículos; módulos existentes conservados | Completa dentro del alcance aprobado; impresión PDF móvil conservada tras evaluación |
| 09 Verificación | Fuente final 84daa8d; suite local 18 aprobados + audit dev conocido; Chromium 219 y 68 axe | Completa localmente; condiciones externas de publicación pendientes |

La corrección independiente de capturas avanzó mientras se esperaban decisiones, conforme al PDF. No se declara terminada una fase por compilar. El componente común está listo para reutilizarse en la página pública cuando se implemente; no se afirma que esa página exista.

## Checkpoint previo de scripts (histórico)

La fase 03 se cierra con 215 comprobaciones en Chromium real, 56 análisis automáticos sin infracciones y API Sites compilada aprobada. La suite local completa aprobó 17 comandos y registra aparte cuatro moderados de desarrollo; producción sin avisos. [Informe de entrega y estado de las 25 fases](25-entrega-progresiva-activos-scripts-2026-11-22.md).

El ejecutor se interrumpió dos veces. En la primera recuperación se archivaron 38 archivos locales y se reconciliaron los cinco commits remotos sin descartar prototipos. La segunda indisponibilidad ocurrió durante las tarjetas: no se declara conservado ni perdido ese árbol sin revisarlo. La rama remota funcional y sus PNG de evidencia están guardados. No se publicó, no se ejecutaron migraciones reales y main/respaldo no cambiaron.

## Cierre de las nueve fases nuevas · 23 de noviembre de 2026

El ejecutor se recuperó y los prototipos se conservaron. Terminal/R/%/capturas públicas/QR/UX quedan completos en `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`, verificados por Chromium 45189916983 (219/219, 68 axe sin infracciones automáticas) y suite local completa (18 comandos aprobados, cuatro moderados dev conocidos aparte). [Informe vigente y estados de las 25 fases](29-entrega-terminal-qr-ux-2026-11-23.md). Las interrupciones y pendientes del checkpoint previo son históricos; la continuación actual son únicamente las condiciones externas documentadas. No publicado; no se autorizan migraciones o despliegue reales con este cierre.
