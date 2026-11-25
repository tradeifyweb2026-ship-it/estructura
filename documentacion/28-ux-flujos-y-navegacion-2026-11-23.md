# Flujos, navegación y confirmaciones · 23 de noviembre de 2026

Continuación de `9616c4f0e3a149d774c54452e23ef589f455e36a`, fase 08 del PDF. Se conservan matemáticas, consultas, contratos de API, formatos y modelos existentes. No hay migraciones adicionales ni producción.

Se agrupan las mismas doce secciones en Diario / Análisis / Gestión / Herramientas. El computador muestra esos grupos; móvil conserva cuatro destinos directos y Más con grupos accesibles. No se crean secciones principales nuevas. Calculadoras y Mis scripts siguen juntos en Herramientas.

Para periodos se separan Compartir resumen, Exportar reporte y Respaldar datos. Compartir ofrece PNG/texto; exportar PDF por impresión, Excel y CSV de perfil con privacidad; respaldar CSV privado de los registros filtrados o JSON completo leído desde servidor, sin las casillas de ocultación. Se explica dónde obtener catálogo y scripts cifrados separados. Para operación se mantienen Compartir tarjeta y Exportar operación. No se reconstruyen los diez perfiles.

Se sustituyen las cuatro confirmaciones nativas restantes del módulo por diálogos con foco y teclado: CSV privado, JSON completo, quitar movimiento y restaurar versión de estrategia. Cancelar conserva los datos. Quitar movimiento solo cambia el formulario hasta guardar. Restaurar estrategia sigue usando el contrato existente y conserva snapshots anteriores. Revocaciones y eliminaciones ya tenían confirmaciones accesibles, incluida la nueva de enlaces públicos.

La lista de enlaces públicos muestra el snapshot autorizado para distinguir enlaces del mismo trade con distinta privacidad; solo un hash del token permanece en servidor. Se memoriza la vista previa para evitar regenerar SVG/fuente por el reloj de caducidad. Se añade una guía puntual; total actual 90 artículos.

Editor de operaciones: se conservan los campos esenciales, pestañas/detalles avanzados, validación preventiva de stop/parciales, borradores y selector + ya implementados. Administración conserva portada con pendientes/estados/vencen en siete días y sesiones, acceso a Recursos y mantenimiento, incidencias/alertas paginadas, auditoría y propietario protegido. No se duplica ese trabajo ni se inventa consumo externo.

PDF móvil, tarea secundaria: se conserva el flujo de impresión y Guardar como PDF cuando el navegador lo ofrece. Generar otra representación independiente exigiría nueva biblioteca/layout y duplicaría los reportes; no se incorpora un conversor remoto ni se promete un destino disponible en todos los móviles. El PDF real y su privacidad se comprueban en Chromium.

Pruebas nuevas: menú agrupado a 320/390/1440 en ambos temas, cuatro análisis axe, JSON nativo con más de veinte registros y conteo completo, cancelar descarga, quitar movimiento sin guardar y con guardar, cancelar/restaurar estrategia conservando el JSON del trade. Se mantiene el recorrido completo de siete anchos/dos temas. Resultado nativo pendiente de registrar por SHA al crear este documento.

En el recorrido anterior 45186255104 el caso QR pasó: snapshot anónimo, tres descargas PNG decodificadas antes/después de comprimir, ocultación sin revocar y revocación efectiva. La ejecución completa falló porque el caso Terminal buscó una casilla con el mismo nombre en las dos privacidades; se delimita al fieldset de la imagen sin relajar la expectativa. Los resultados fallidos se conservan junto a los aprobados. La suite local completa de `9616c4f` aprobó 18 comandos; la auditoría registra aparte los cuatro moderados dev conocidos, sin nuevos avisos de producción.

No publicado. Tras aprobar esta fase falta el cierre documental y verificar los bloqueos externos de la matriz vigente; ninguna prueba con fixtures acredita Google, D1/R2 o el dominio real.

Seguimiento visual: 45188056493 aprobó ambos casos nuevos de UX y QR, pero la suite antigua continuó a 390 px buscando botones exclusivos de la tabla; se restaura 1440 px al terminar el caso móvil. Su restauración antigua también se adapta al nuevo diálogo explícito. La captura real mostró la frase diaria superpuesta al extremo superior de Más: se eleva únicamente el menú abierto sobre esa tarjeta, sin cerrar ni borrar la frase. Se comprueba el elemento visible bajo el punto del enlace Revisión y la navegación real a Revisión/Cuentas. Se añade creación pública rica desde el navegador (%/dinero/enlace de captura), comparación de privacidad, fallback anónimo y revocación independiente. No se modifican expectativas financieras.

## Cierre verificado · 23 de noviembre de 2026

Los pendientes de verificación de los apartados anteriores quedaron resueltos en `84daa8d9edf3b0b1bbce8f8a48fdc4d0c05a3b35`: Chromium 45189916983, 219/219 casos, 68 análisis axe sin infracciones automáticas; suite local final 18 comandos aprobados y auditoría dev con cuatro moderados conocidos. Se preservan los intentos fallidos y sus correcciones sin modificar expectativas financieras. [Entrega final y continuación externa](29-entrega-terminal-qr-ux-2026-11-23.md), [PNG/hashes y resultados](verificacion-terminal-2026-11-23/chromium-final/manifest.json). No publicado ni probado contra servicios productivos.
