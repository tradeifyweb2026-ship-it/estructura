# Cálculos y CSV

## Reportes por sección

Desde Compartir se abre el perfil correspondiente a la vista. La selección contiene todas las operaciones de sus filtros, aunque Bitácora solo muestre una página. El selector de perfil cambia el contenido del documento y conserva esa selección. Para otra semana/mes, primero cambia el periodo en Revisiones.

Revisa las casillas de importes, capital, cuentas, estrategias, precios, capturas y notas/emociones; la vista previa muestra lo mismo que los reportes. Capital requiere habilitar también importes y solo muestra el capital inicial registrado en Cuentas. El JSON completo y CSV privado están separados: contienen datos sin ocultar y solicitan confirmación. Guárdalos para uso privado.

Los perfiles XLSX usan números en unidades principales, fechas serializadas y porcentajes como fracción con formato %. El CSV muestra porcentajes en puntos con cabecera (%) y fechas ISO; la moneda aparece en la cabecera de cada tabla monetaria. No se agrega dinero de divisas distintas. Las posiciones Sin cuenta no reciben una divisa agregada supuesta. Los parciales del cierre no se suman nuevamente al resultado neto.

Si hay operaciones sin cuenta válida, los perfiles no muestran un indicador/curva monetarios globales y excluyen esos importes de tablas monetarias. Se conservan sus resultados en R y se indica la falta de divisa confirmada. Los respaldos privados conservan los datos originales.

PDF usa impresión A4 del navegador. Imagen ofrece 1:1, 4:5 y 9:16; resume indicadores y extractos del perfil. CSV/XLSX/texto conservan las tablas completas. Riesgo distingue cálculo registrado y estimación; cuando la selección está filtrada no certifica límites que requieren todo el historial.

## R y resultados

Operaciones abiertas no producen R realizado. Cerradas con neto y riesgo monetario: R = pnlCents/riskCents. Ejemplo 30 USD netos sobre 10 USD de riesgo = 3 R.

En ausencia de esos datos se usa salida media ponderada por porcentajes de posición original; el resto usa salida final. Compra: (salidaMedia−entrada)/(entrada−stopInicial). Venta: se invierte dirección. Sin datos suficientes el resultado es desconocido, no cero. Este cálculo por precios no incluye comisiones ni valor monetario por punto.

El R objetivo usa distancia al objetivo sobre distancia al stop; no es resultado obtenido. El tamaño no calcula P&L automáticamente. Las comisiones son informativas porque pnlCents ya es neto.

## Métricas

- Ganancia/pérdida/BE prioriza neto y después R. Se distinguen abiertas y desconocidas.
- Tasa de acierto: ganadoras sobre resultados conocidos; BE entra en denominador.
- Curva: acumulado ordenado por cierre desde cero; no balance con depósitos/retiros.
- Drawdown: caída máxima desde un máximo previo de la curva filtrada. Cambiar período cambia base.
- Profit factor: beneficios/pérdidas absolutas. Usa dinero solo si todos los cierres del filtro tienen P&L y comparten una moneda; si no, usa R solo cuando toda la muestra tiene R calculable. Si ninguna serie está completa, el factor global queda sin calcular. Beneficios sin pérdidas producen infinito.
- Disciplina: notas >=4 sobre operaciones calificadas, excluyendo las no calificadas.
- Tras pérdida: último cierre anterior a la entrada dentro de la misma cuenta.

No se suman divisas distintas. El P&L, la expectativa monetaria, el factor global en dinero y la curva monetaria solo se muestran cuando todos los cierres del filtro tienen P&L y comparten una moneda. Si falta algún P&L, el subtotal no se presenta como total. Las métricas en R muestran la cobertura calculable (R disponibles / cierres); el factor y drawdown globales solo usan una serie completa en dinero o R. Revisa siempre el tamaño de muestra. Referencia: lib/stats.ts, lib/summary-math.mjs y lib/journal.ts.

## CSV

La UI admite hasta 5 MB y 2.500 filas; detecta UTF-8/UTF-16 y separadores coma/punto y coma/tabulador, con campos entre comillas. Presenta errores antes de importar operaciones cerradas válidas a una cuenta elegida. Usa la plantilla de la aplicación; los alias en lib/csv.ts incluyen tratamiento de columnas Time/Price repetidas en posiciones MT5, sin garantizar cualquier formato de bróker.

ISO con offset conserva su zona; fechas sin zona son Ecuador. Convierte horas del bróker si usa otra zona. Moneda debe coincidir con cuenta. Si hay neto se conserva; cuando procede de bruto se calcula bruto−comisiones absolutas+swap. Evita descontar dos veces una comisión ya incluida en neto.

UI envía lotes de 20, API admite 40. Huellas SHA-256 identifican duplicados según origen/cuenta. Cambios de contenido normalizado o cuenta pueden producir nuevas claves. Varios lotes no son una transacción global; puede haber importación parcial. Reintentar el mismo archivo/cuenta aprovecha deduplicación.

La exportación incluye detalles serializados y protección contra interpretación accidental de texto como fórmulas. Editores de hojas pueden cambiar fechas o identificadores: conserva original. El CSV no incluye capturas ni respaldo integral de configuración/revisiones. La recuperación total necesita D1 y R2.

## Enlaces de capturas

El CSV de datos añade `captura_entrada` y `captura_salida` al final de las columnas y conserva `captureLinks` en bitacora_v1. El importador admite archivos antiguos sin esas columnas y valida los nuevos enlaces con el mismo esquema que la API. Las columnas explícitas tienen prioridad sobre los metadatos cuando contienen un valor. La huella para evitar duplicados no cambia.
