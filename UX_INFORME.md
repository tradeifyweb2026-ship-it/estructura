# Auditoría práctica de usabilidad de Tradeify

Fecha: 17 de noviembre de 2026, Ecuador. Fuente base: GitHub `tradeifyweb2026-ship-it/Tradeify.web`, revisión `81422a5648ae65de35866f08fac093ffec9f53dd`, árbol `ff2a263bd3e1d4f7122d5d48d18cec82a0916942`. Rama nueva local: `ux-audit`.

## Resumen ejecutivo

Se reprodujeron pérdidas de borrador al cerrar, salida de la página al pulsar Atrás, datos vacíos engañosos cuando falla la primera carga y desplazamiento horizontal accidental. Se corrigieron esos casos, el recorrido por teclado, la localización del error de formulario y el retorno al inicio al paginar. Los campos y botones móviles conservan la identidad visual y ganan espacio para usarse. La importación muestra su progreso. Se recorrieron seis secciones en ocho anchos CSS, con datos vacíos, una operación y posteriormente 201 operaciones ficticias. Chrome, conexión simulada, zoom y orientación se probaron localmente. Safari/iPhone, Firefox, tacto y teclado virtual reales siguen sin verificar. El borrador no se guarda automáticamente y la advertencia de recarga depende del navegador.

## Contexto

- Proyecto: bitácora de trading privada para registrar operaciones, cuentas, setups, notas, emociones y revisiones.
- Usuarios y dispositivos: propietario que opera la bitácora en móvil y escritorio.
- Stack: React, TypeScript, Vinext/Vite, CSS existente, elemento nativo `dialog` para todos los modales. D1 y R2 en el servidor.
- Entornos: vista local con datos de prueba y producción Cloudflare para publicar la versión aprobada por las comprobaciones.
- Tareas principales: configurar cuenta/setup/plan, registrar y cerrar una operación, consultar detalle/calendario, importar CSV, exportar/compartir y completar una revisión semanal.
- Alcance: correcciones pequeñas de usabilidad. La revisión de seguridad anterior permanece documentada en `SEGURIDAD_INFORME.md`.

## Inventario de pantallas y controles

| Ruta o sección | Elementos y tareas |
| --- | --- |
| `/` sin sesión | Acceso y enlace al ejemplo ficticio |
| `#resumen` | Filtros globales de cuenta/periodo, estadísticas, curva, calendario con selección de día, últimas operaciones, alta de operación y exportación |
| `#bitacora` | Búsqueda y filtros del listado, detalle, alta de operación, importar CSV y compartir |
| `#estadisticas` | Estadísticas por setup/activo/horario, filtros y exportación |
| `#psicologia` | Emociones y ejecución, filtros y exportación |
| `#revision` | Selector semanal, reflexión y guardado |
| `#configuracion` | Cuentas, setups, plan, checklist, respaldo y preferencias de frase |
| Navegación | Barra lateral de escritorio, navegación inferior móvil, acceso a configuración, tema, modo ejemplo y cierre de sesión |
| Modal de operación | Pestañas Entrada/Cierre/Diario, campos, checklist, parciales, notas, guardar y cancelar |
| Modal de detalle | Datos, notas, capturas, edición, cierre, compartir y confirmación de borrado |
| Modal de cuenta/setup | Creación, edición y archivo |
| Modal de importación | Cuenta, archivo, plantilla, vista previa, lotes, reanudación y estado |
| Modal de exportación | Privacidad, PNG/texto/PDF/Excel/CSV/JSON y cierre |
| Mensajes | Carga, error/reintento, vacío, toast, ejemplo y aviso de frase diaria |
| Componentes genéricos | `components/ui` conserva elementos de la plantilla. Se revisan los controles que utiliza efectivamente la bitácora. |

## Hallazgos

Gravedad de usabilidad: alta, media y baja. «Verificado» en este informe se limita a Chrome y a las condiciones indicadas; no equivale a una prueba en teléfonos reales.

| ID | Componente / condición | Lo que le pasa al usuario y cómo reproducirlo | Causa / ubicación | Gravedad | Corrección y resultado |
| --- | --- | --- | --- | --- | --- |
| UX-01 | Operación; cuenta/setup | Abrir, escribir y pulsar Escape: desaparece el formulario y, al abrirlo otra vez, el valor está vacío. | Modal cerraba directamente sin comprobar cambios; components/journal/ui.tsx. | Alta | Confirmación común al cerrar borradores modificados mediante X, Cancelar, Escape o fondo. Escape y Atrás probados: cancelar el descarte conserva 25000; aceptar cierra. Aplicado también a cuenta/setup. Corregido y verificado en el editor; el cierre exterior y el aviso de cuenta/setup comparten código, sin una repetición visual de todos los caminos. |
| UX-02 | Todos los modales | Abrir un modal y pulsar Atrás: antes se abandonaba la página del flujo. | No había entrada de historial para la capa abierta. | Alta | lib/dialog-history.ts coordina una entrada temporal y el modal superior. Verificado con modal vacío, borrador pendiente, editor que pasa a detalle y detalle con exportación encima. Atrás cierra exportación y conserva detalle; el foco vuelve a Compartir. |
| UX-03 | Primera carga sin API | Abrir sin conexión: el aviso de error convivía con «Aún no has creado ninguna cuenta», formularios y acciones de guardado. Puede parecer que se perdió el historial. | blankJournal se renderizaba después de cualquier fallo inicial; components/journal/app.tsx. | Alta | Diferenciar carga satisfactoria de fallo. Se ocultan los paneles no cargados y se desactiva Nueva operación hasta recuperar datos. Verificado: cero mensajes falsos de cuenta vacía; Reintentar recupera la cuenta y los registros ficticios. |
| UX-04 | Móvil 320–730 px | La X medía 35×35; los campos usaban 12 px y los controles resultaban estrechos. En la primera corrección a 320 px, la cabecera desbordó 14 px y los selectores en dos columnas cortaban opciones cortas. | Reglas móviles de app/globals.css y cabecera en app.tsx. | Media | X 44×44 en todos los tamaños; botones principales móviles de al menos 44 px de alto, controles de icono de 44×44 y campos de 16 px. Editor en una columna hasta 405 px; logo compacto y filtros apilados en ese rango. Verificado: ocho anchos sin desbordamiento de página al terminar; 16 px solo en el rango móvil. No se afirma haber probado el zoom automático de iOS. |
| UX-05 | Tablas 768/1024; detalle | Con datos, la página completa se desplaza horizontalmente. En detalle aparece una barra horizontal aunque sus valores caben. | Las etiquetas absolutas sr-only quedaban fuera de su contenedor y las reglas generales de input agrandaban el input oculto de capturas; app/globals.css. | Media | Contenedor de tabla relativo y con min-width:0; excluir sr-only de los estilos de inputs visibles. Verificado: detalle pasa de scrollWidth 771/clientWidth 709 a 709/709. Resumen a 768 pasa de 938/753 a 753/753; Bitácora de 1003/753 a 768/768. A 1024 se elimina también el desbordamiento. La tabla conserva su scroll interno. |
| UX-06 | Validación y fallo de guardado | Enviar con error: el foco queda en Guardar aunque el aviso esté arriba; obliga a buscar qué falló. | Aviso role=alert sin destino de foco; trade-editor.tsx. | Media | Llevar el foco al aviso después de cada error. La pestaña correspondiente ya se seleccionaba y se conserva ese comportamiento. Verificado con datos incompletos y API desconectada: mensaje comprensible, foco en el aviso y valores conservados. |
| UX-07 | Teclado en modales | Al cruzar el último control con Tab, document.activeElement llegaba a BODY; al retroceder desde la X llegaba al propio dialog. | Dependencia exclusiva del ciclo nativo del navegador; ui.tsx. | Media | Cerrar el recorrido entre primer y último control habilitado y visible. Verificado en página principal: Shift+Tab desde X llega a Guardar operación y Tab desde Guardar vuelve a X, ambos dentro del modal. |
| UX-08 | Paginación móvil con 201 registros | Pulsar Página siguiente al final: la nueva página se muestra desde abajo. La primera tarjeta quedó a −1665,75 px del borde superior. | El cambio de página solo actualizaba el índice; trade-list.tsx. | Media | Al paginar, desplazar al inicio de filtros y enfocar el grupo sin abrir un teclado de entrada. Verificado: Página 2 de 11, filtros en el borde superior y foco «Filtros de operaciones». |
| UX-09 | Importación CSV | Mientras se prepara el archivo, todos los controles quedan desactivados sin explicar la espera. Durante varios lotes no se veía la cantidad procesada. | Estado busy sin mensaje de preparación/progreso; settings.tsx. | Media | Mensaje role=status al preparar CSV y progreso por filas al importar. Verificado visualmente durante importación: «60 de 200 filas procesadas…». Final: «200 importadas · 0 omitidas por duplicado» y una fila inválida señalada. El mensaje de preparación está implementado, sin una captura posterior durante esa fase breve. |
| UX-10 | Región de frase a 320 px | El contenedor de aviso podía comenzar 3 px fuera del borde izquierdo con barra vertical. | 100vw incluía el ancho de la barra; app/globals.css. | Baja | Usar el ancho porcentual disponible. Verificado como geometría de la región y en el recorrido sin desbordamiento; no se repitió la aparición de una frase ni el sonido. |

### Comportamientos existentes conservados

- El modal ya tenía altura máxima con dvh, cabecera y pie pegajosos y bloqueo del fondo. No se atribuye su creación a esta auditoría. Se añade overscroll-behavior:contain y se verifica que siguen funcionando después de los cambios.
- El calendario muestra primero las operaciones del día; la edición se abre desde el detalle. No se sustituye por un editor al seleccionar el día.
- Las cifras y los resultados se presentan con texto además de color. Las notas con tildes, ñ, comillas y emoji se importan como datos.
- Se mantienen los temas, la fuente, la paleta, las funciones, las migraciones y los contratos de servidor. No se añadieron dependencias.

## Recorridos de tareas

Los siguientes conteos son activaciones de navegación o acción dentro de la web, no pulsaciones al escribir ni controles del selector de archivos del sistema. Son las variantes recorridas, no mediciones de todas las rutas posibles.

| Tarea y punto de partida | Recorrido / activaciones | Resultado y fricción |
| --- | --- | --- |
| Crear cuenta desde Configuración | Nueva cuenta → Guardar: 2, con nombre y saldo ficticios | Cuenta visible, confirmación y foco devuelto al botón de apertura. Escritorio. |
| Crear setup desde Configuración | Nuevo setup → Guardar: 2, con nombre largo y descripción | Texto conservado y confirmación. Escritorio. |
| Guardar plan desde Configuración | Guardar plan: 1 después de rellenar riesgo/checklist | Plan guardado; se usa en la siguiente operación. Escritorio. |
| Registrar operación desde cabecera | Nueva operación → Guardar operación: 2 después de rellenar | Error local probado; fallo de red conserva datos; reintento lento desactiva el envío y termina en detalle con la operación abierta. |
| Cerrar desde detalle | Cerrar operación → Añadir parcial → Diario → Guardar: 4, más campos | Salida, parcial 50%, resultado y nota visibles en detalle. No crea otra operación. |
| Compartir una operación desde detalle | Compartir → PNG / Texto: 2 para cada salida | PNG aparece terminado en descargas de Chromium, 532 KB. Texto leído del portapapeles con +3 R y sin saldo. El capturador de descargas no devolvió una ruta para el PNG del iframe; no se inspeccionó su archivo pixel a pixel. |
| Importar desde Bitácora | Importar CSV → Archivo CSV → Importar 200 → Cerrar: 4 | Prueba móvil CSS a 390 px. Vista previa 200 válidas/1 inválida. Guardado en lotes y listado final de 201 registros. |
| Buscar y paginar desde Bitácora | Página siguiente: 1; escribir búsqueda y Limpiar filtros: 1 acción de limpieza | Página 2/11 y estado vacío «No hay operaciones con estos filtros». Foco y scroll corregidos al paginar. |
| Revisión desde navegación | Revisión → Guardar revisión: 2 tras escribir | Confirmación de guardado; reflexión ficticia. Escritorio. No se hizo un recorrido equivalente completo en teléfono. |
| Exportar periodo desde Resumen | Compartir → formato: 2 para cada formato | Se activaron Excel, CSV ordenado y JSON; descargas notificadas por Chromium. Prueba de serialización automática separada. PDF prepara el iframe, pero no se observó un diálogo de impresión: resultado final no verificable en este navegador. |

## Cobertura

### Pantallas y tamaños

Se recorrieron las seis secciones con una cuenta, un setup largo y una operación. El visor local usa un iframe con tamaño CSS explícito. Para 1366/1920 px se reduce visualmente el visor para caber en el escritorio: el ancho interno medido sí es el indicado. No cambia el agente de usuario ni emula hardware táctil. Se guardan las medidas iniciales y la repetición de los casos corregidos en [pantallas.json](documentacion/ux-evidencias/pantallas.json) y [tabletas-despues.json](documentacion/ux-evidencias/tabletas-despues.json).

| Ancho CSS | Resumen | Bitácora | Estadísticas | Psicología | Revisión | Configuración |
| --- | --- | --- | --- | --- | --- | --- |
| 320 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |
| 360 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |
| 390 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |
| 412 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |
| 768 | Revisado y corregido | Revisado y corregido | Revisado | Revisado | Revisado | Revisado |
| 1024 | Revisado y corregido | Revisado y corregido | Revisado | Revisado | Revisado | Revisado |
| 1366 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |
| 1920 | Revisado | Revisado | Revisado | Revisado | Revisado | Revisado |

«Revisado» aquí significa navegación, carga de la sección y medición del ancho; no cada acción interna en cada celda. La prueba con 201 registros se realizó después, principalmente a 390 px y en escritorio. No se repitieron las 48 combinaciones con 201 registros.

El editor se midió en los ocho anchos a 800 px de alto. X 44×44; sin exceso de ancho. En 320–412 px, su borde vertical queda entre 11 y 789 px. En 768–1920 px queda aproximadamente entre 42,47 y 757,53 px. Además se probó 800×390 horizontal y 320×400 para reducir la altura disponible: cabecera/pie permanecen visibles y el campo enfocado se sitúa entre ambos. Esto no sustituye un teclado virtual real.

Zoom real de Chromium mediante teclado: 100% y 200%; a 200% el área CSS medida fue 681×468, sin scroll horizontal de la página. Se comprobaron temas oscuro y claro. Las capturas muestran el resultado local con datos ficticios.

| Bloque | Estado | Evidencia y límites |
| --- | --- | --- |
| A Modales | Parcial, con correcciones verificadas | Editor, cuenta, setup, importar, detalle, compartir, historial, capas, foco y medidas. No se repitieron todas las combinaciones de cierre de cada modal. |
| D Formularios | Parcial, con correcciones verificadas | Registro, validación, fallo/reintento, cuenta/setup, plan, revisión e importación; teclado virtual no verificable. |
| B Scroll | Revisado en la matriz indicada | Cero desbordamientos de página al terminar los casos medidos; tabla interna, detalle, poca altura y paginación. No medición CLS. |
| C Botones | Parcial | X y acciones móviles ampliadas, guardado desactivado, navegación visible. Días de calendario y algunos controles de texto siguen menores de 44 px; no se declara conformidad universal. |
| E Navegación | Parcial | Seis rutas, marca activa, Configuración móvil, Atrás en modales. No exhaustividad de 404/URLs inexistentes. |
| F Estados | Parcial | Vacío, error, reintento, carga lenta, éxito, progreso y 201 registros. No se validó visualmente toda variante de conflicto de versión. |
| H Interferencias | Parcial | Capas de dialog sobre navegación, región de aviso y tema. No se forzó el aviso de frase durante un guardado. |
| G Lectura | Parcial | Campos móviles, nombres largos, temas y zoom 200%. Contraste numérico y todas las capturas de gráfico no revisados. |
| K Datos extremos | Parcial | Cero, uno y 201 registros; nombre largo; tildes/ñ/emoji/comillas en CSV; opcionales vacíos. Cifras máximas y miles de registros no revisados. |
| L Dispositivos | Parcial / no verificable | Tamaños CSS y horizontal comprobados; iPhone real, barras móviles, safe areas y alcance del pulgar no verificables. |
| J Accesibilidad | Parcial | Etiquetas, alertas, foco, ciclo Tab y zoom. Sin lector de pantalla ni auditoría completa WCAG. prefers-reduced-motion se conserva por código, sin emulación posterior. |
| I Rendimiento percibido | Parcial | Retraso artificial de 2 s por API, estados de guardado e importación, 201 registros. Sin Lighthouse, métricas de carga ni hardware modesto. |

No hay un bloque A–L declarado exhaustivo. Subcomprobaciones no cubiertas están descritas arriba. Safari/iOS, Firefox y entrada táctil real: no verificables en este entorno. No se instaló otro navegador ni se cambió la política que bloqueaba DevTools.

## Evidencia visual

- [Modal de 320 px antes](documentacion/ux-evidencias/modal-320-antes.jpg): controles originales pequeños.
- [Modal de 320 px después, desplazado dentro del formulario](documentacion/ux-evidencias/modal-320-despues.jpg): campo legible, X y pie visibles.
- [Tema claro con zoom 200%](documentacion/ux-evidencias/zoom-200-claro.jpg).

El visor, su simulación de red, la identidad local y los registros de prueba no forman parte del sitio publicado. El archivo de apoyo se retiró de public antes de las compilaciones finales.

## Cambios y reversión

| Archivo | Cambio |
| --- | --- |
| components/journal/ui.tsx | Cierre protegido, restauración de foco, ciclo de Tab, cierre coherente y aviso beforeunload como ayuda dependiente del navegador. |
| lib/dialog-history.ts | Coordinación de historial y cierre de la capa superior; reusa la entrada cuando guardar sustituye editor por detalle. |
| components/journal/trade-editor.tsx | Protección de borrador y foco en el mensaje de error; Cancelar usa el mismo cierre. |
| components/journal/settings.tsx | Protección de cuenta/setup, cierre común y mensaje de progreso CSV. |
| components/journal/app.tsx | Estado de primera carga satisfactoria y controles móviles identificados. |
| components/journal/trade-list.tsx | Scroll y foco al inicio al cambiar de página. |
| app/globals.css | Tamaños móviles, editor estrecho, geometría de inputs ocultos/tablas y región de frase. |
| UX_INFORME.md y documentacion | Evidencia, cobertura, manual y límites actualizados. |

Para revertir, crear un commit inverso del commit de usabilidad publicado y dejar que Workers Builds vuelva a compilar. No requiere revertir migraciones ni modificar registros: esta entrega no cambia tablas, sesiones ni API. No reescribir el historial compartido.

## Pendientes

Prioridad alta: comprobar estos formularios en un teléfono real antes de dar por cerrada la revisión móvil. La compatibilidad del historial con Safari y con el gesto Atrás necesita esa prueba.

Confirmado, pendiente: al recargar durante la edición no se recupera automáticamente el borrador. Se añade el aviso estándar beforeunload cuando hay cambios; en el navegador de trabajo la recarga no mostró una advertencia observable. No se presenta como conservación garantizada. Plan y revisión semanal tampoco tienen recuperación automática del texto sin guardar. No se implementó persistencia nueva de datos privados del formulario en el navegador.

Pendientes de comprobación: impresión PDF final, imágenes exportadas abiertas y revisadas, archivo de captura con R2 real, lectura de avisos de frase/sonido y comparación visual completa con datos extremos. El envío real por WhatsApp o una red social no se realizó.

Mejoras opcionales: ayudas en campos obligatorios, ubicación del error en cada campo, ampliar blancos de calendario/checkbox, indicador de tabla desplazable, guardado/recuperación explícita del borrador y paginación del servidor. No se alteraron reglas de cálculo para resolver asuntos visuales.

### Pruebas en tu dispositivo

1. Android Chrome e iPhone Safari: abrir operación, enfocar el último campo con teclado virtual, desplazarse al final y comprobar X/Guardar sin tapar el campo.
2. Girar pantalla, expandir/ocultar la barra del navegador y revisar la barra inferior con safe area.
3. Escribir, pulsar Atrás/Escape/X/Cancelar y rechazar el descarte: el texto debe seguir. Volver a abrir y confirmar el descarte: debe cerrar.
4. Abrir detalle → Compartir y pulsar Atrás: debe quedar el detalle. Repetir con el gesto nativo de Safari.
5. Exportar PNG y abrirlo; PDF → Guardar como PDF y revisar sus páginas; probar Compartir en la hoja del sistema sin publicar datos reales durante QA.
6. Probar frase y sonido con el volumen bajo; confirmar que el aviso no tapa otra acción. Lectura por TalkBack/VoiceOver queda pendiente.

## Comprobaciones técnicas de cierre

La revisión funcional se ejecutó sobre los dos perfiles sin publicar registros ficticios. El UUID y bucket de la compilación local son ficticios. Los resultados de cierre también se guardan en [verificacion.txt](documentacion/ux-evidencias/verificacion.txt).

| Comando | Estado de cierre |
| --- | --- |
| TypeScript | Pasa tsc --noEmit |
| ESLint de ui, settings, trade-editor, trade-list y dialog-history | Pasa, cero errores/advertencias |
| ESLint global | Mantiene 5 errores preexistentes y 3 advertencias. Los 2 errores de app.tsx son los mismos react-hooks/set-state-in-effect de la base. No se declara lint global aprobado |
| npm run build + node tests/check-api.mjs | Pasa; CRUD, aislamiento, capturas, importación/deduplicación, plan, revisión y frases con datos desechables |
| npm run build:cloudflare + node tests/check-cloudflare.mjs | Pasa con R2 de prueba; Google simulado, sesiones, propietario, origen y límites |
| node tests/check-export.mjs | Pasa |
| node tests/check-capture-failures.mjs | Pasa |
| Empaquetado Wrangler sin publicar | Pasa --dry-run, aproximadamente 456,76 KiB gzip; no mide rendimiento real |
| Higiene de entrega | Pasa git diff --check; el visor local no está en public ni en dist |

La compilación Cloudflare inicial rechazó correctamente el UUID reservado de Sites usado por error en un intento de prueba. Se repitió con el UUID ficticio admitido 11111111-1111-4111-8111-111111111111; compilación, integración y empaquetado finales pasan. No se usó ni cambió el UUID de producción.

La publicación a main está autorizada por el usuario si pasan las pruebas. Cloudflare Workers Builds compila y despliega ese commit. El resultado de la publicación se verifica después mediante el check de integración y la página pública de acceso; las pruebas autenticadas de esta auditoría usan exclusivamente datos locales.

Chrome de escritorio y vista local disponibles. Matriz pendiente: 320, 360, 390, 412, 768, 1024, 1366 y 1920 px; vertical/horizontal; zoom; entrada por teclado y táctil; fallos de red y flujos completos. Safari/iOS, Firefox y teclado virtual real no se consideran comprobados.
