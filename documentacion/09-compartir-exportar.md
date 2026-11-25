# Compartir y exportar

Todo sale de un solo modelo (`lib/report.ts`) y de una sola identidad visual (`lib/brand.ts`: logo, colores de la app, cabecera oscura con franja violeta, tarjetas de indicadores, verde/rojo para ganancia/pérdida). Por eso el PDF, el Excel, el CSV ordenado, la imagen y el texto muestran las mismas cifras.

## Dónde está el botón
- **Resumen, Estadísticas, Psicología**: botón «Compartir» junto a los filtros (usa cuenta y periodo elegidos).
- **Bitácora**: «Compartir / exportar» (usa los filtros de la tabla).
- **Detalle de una operación**: «Compartir» (imagen, texto o PDF de esa operación).
- **Configuración › Respaldo y exportación**: todo el historial.

## Formatos
| Formato | Archivo | Diseño |
| --- | --- | --- |
| PDF | `lib/report-html.ts` | A4, se imprime desde un iframe oculto: elige «Guardar como PDF». Cabecera con logo, indicadores, curva, setups, activos, días y tabla con pie de página numerado |
| Excel | `lib/report-xlsx.ts` + `lib/xlsx.ts` | Hojas «Resumen» (logo, 6 indicadores, barras) y «Operaciones» (filtros, panel fijo, total que sigue al filtro). Sin dependencias |
| CSV ordenado | `lib/report-csv.ts` | Mismas secciones en columnas rectangulares. Es de lectura, no se importa |
| Imagen PNG | `lib/share.ts` | Tarjeta 1080×1350 con Geist incrustada; usa compartir nativo o descarga |
| Texto | `lib/share.ts` | Resumen para pegar; si no se puede compartir, se copia |
| CSV para importar | `exportTrades()` en `lib/csv.ts` | Sin cambios: es el que `Importar CSV` vuelve a leer |
| JSON completo | `backupJson()` | Cuentas, setups, plan, operaciones y revisiones. No hay importación JSON todavía |

## Privacidad por defecto
Casillas del cuadro (se recuerdan en el navegador): **Importes en dinero** y **Notas y emociones**, ambas apagadas. Sin ellas solo se muestra R. El saldo de la cuenta nunca se incluye. El CSV para importar y el JSON son respaldos completos y no usan las casillas.

## Seguridad
Las celdas de texto del usuario que empiezan por `=`, `+`, `-` o `@` llevan apóstrofo en CSV; en Excel todo texto se guarda como texto (nunca fórmula); el HTML del PDF escapa todo texto.

## Límites
- El PDF depende del diálogo de impresión del navegador; en celular conviene usar imagen o Excel.
- `navigator.share` existe sobre todo en móvil y Safari; en escritorio el texto se copia y la imagen se descarga.
- El Excel no trae gráfico nativo; la columna «R acumulado» permite crear uno.
- No hay enlaces públicos: la app exige sesión en todas las rutas.

Pruebas: `node tests/check-export.mjs` (funciones puras, sin servidor).

## Capturas externas

Excel, CSV de reporte, CSV de datos, HTML de impresión/PDF y respaldo JSON conservan ambos enlaces de captura. Los reportes incluyen los enlaces aunque dinero y notas estén ocultos: revisa las capturas antes de compartir, porque pueden mostrar balances o anotaciones. PDF imprime la URL como texto, sin descargar imágenes externas. El PNG de la tarjeta mantiene su diseño y no incorpora capturas externas.
