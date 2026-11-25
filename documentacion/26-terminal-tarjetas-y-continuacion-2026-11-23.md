# Tarjetas Terminal y resultado R/% · 23 de noviembre de 2026

Continuación de `18ec6e042e80b10026fd15ea68900474250b2a33`, exclusivamente en `mejoras-v2-2026-11-18`. Se preservan catálogo y biblioteca cifrada ya aprobados, las diez calculadoras y todos los formatos de reportes anteriores. No se publica ni se ejecutan migraciones sobre recursos reales.

## Implementación

El diálogo de una operación separa Compartir tarjeta y Exportar operación. Terminal se aplica únicamente a tarjetas compartibles: 1:1, 4:5 y 9:16; compacto/detallado; claro/oscuro; estados positivos, negativos, break-even, abiertos, parciales y datos insuficientes. La curva fija está identificada como decorativa, sin representar historial.

Resultado seleccionable Solo R / Solo % / R y %. Predeterminado Solo R e importes ocultos. El porcentaje reutiliza la función matemática existente y divide P&L neto explícito entre capital inicial registrado de la cuenta. No resta otra vez costes ni agrega parciales. Cuenta ambigua, capital/divisa no válidos, neto ausente o operación abierta producen No disponible. No se afirma equity, rendimiento ajustado por flujos ni exposición de bróker.

La proyección de tarjeta no contiene IDs ni el historial. Privacidad independiente de los reportes: dinero, precios, estrategia, cuenta, notas/emociones y enlaces de capturas requieren activación. Estrategia histórica prevalece sobre un nombre actual. La variante compacta omite estrategia/notas. Vista previa y PNG usan exactamente el mismo SVG y fuente local; el texto usa la misma proyección y opciones. Se corrige el escalado de SVG→PNG para respetar dimensiones intrínsecas, conservando las tarjetas de periodo anteriores.

Los enlaces TradingView autorizados se muestran como direcciones en el PNG, sin convertir páginas en imágenes. Debajo se comprueban mediante el mismo CapturePreview del editor/detalle: una página ofrece fallback compacto y botón; una imagen directa requiere carga real. No se envían capturas privadas a servicios ni se añaden proxies.

## Verificación y límites

TypeScript y pruebas locales de denominador, datos insuficientes, privacidad, escape, estados y 108 variantes SVG aprobados antes del commit. Se generan seis PNG con Sharp para comprobar dimensiones; esto no equivale a una verificación visual nativa.

Se añade recorrido Chromium: privacidad independiente, neto/capital, fallback compartido, siete anchos (320/360/390/768/1024/1440/1920), dos temas, tres formatos, cuatro análisis axe y tres descargas PNG reales. Su resultado se registrará por SHA y ejecución; todavía no se declara aprobado al crear este documento.

## Continuación exacta

Completar verificación Chromium y conservar resultados/PNG. Después implementar snapshot público mínimo de una sola operación, token aleatorio almacenado como hash, caducidad de 30 días, revocación/borrado y QR real integrado en esta tarjeta. Mostrar u ocultar QR no debe crear ni revocar enlaces. Las opciones de la imagen no autorizan automáticamente campos públicos. Después quedan UX puntual y cierre global de las nueve fases nuevas.

El QR y la página pública aún no están implementados en este commit. No hay cambios de main, despliegue, secretos o datos de producción. Siguen pendientes los accesos/configuración reales de Cloudflare/Google, respaldo y reversión autorizados, requisitos legales y derechos ya documentados.

## Cierre verificado · 23 de noviembre de 2026

Los pendientes de verificación de los apartados anteriores quedaron resueltos en `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`: Chromium 45189916983, 219/219 casos, 68 análisis axe sin infracciones automáticas; suite local final 18 comandos aprobados y auditoría dev con cuatro moderados conocidos. Se preservan los intentos fallidos y sus correcciones sin modificar expectativas financieras. [Entrega final y continuación externa](29-entrega-terminal-qr-ux-2026-11-23.md), [PNG/hashes y resultados](verificacion-terminal-2026-11-23/chromium-final/manifest.json). No publicado ni probado contra servicios productivos.
