# Historial de versiones de estrategias (V2)

## Qué se guarda

Cada setup mantiene hasta 20 versiones anteriores. Cuando se modifica de verdad su nombre, descripción, reglas, color, activos, temporalidades, sesiones, reglas de riesgo, ejemplos o estado de archivo, Tradeify guarda una instantánea de la versión que estaba vigente antes del cambio.

Cada instantánea conserva:
- Número de versión de la estrategia.
- Fecha y hora de la modificación posterior que generó el snapshot.
- Nombre, descripción y color.
- Activos, temporalidades y sesiones.
- Condiciones y reglas de entrada/salida.
- Gestión de riesgo y ejemplos.
- Estado archivado.

El historial aparece en el editor del setup de la versión más reciente a la más antigua, con la acción de restaurar una versión. Se conservan las últimas 20 instantáneas.

## Relación con operaciones

Al registrar una operación, Tradeify guarda un `setupSnapshot` con la versión y las reglas asociadas en ese momento. Cambiar el setup más adelante no modifica retroactivamente el snapshot de las operaciones anteriores.

El historial del setup y el snapshot de cada trade cumplen propósitos distintos:
- El historial permite consultar cómo evolucionó la estrategia.
- El snapshot de la operación conserva qué reglas estaban asociadas al trade cuando se registró.

## Integridad

El historial se mantiene en el servidor. La API no acepta que el cliente sustituya o borre versiones previas al editar el setup. Una creación comienza con historial vacío; una modificación sin cambios no añade un snapshot. El máximo es 20 versiones.

La estructura es un campo JSON opcional y no requiere migración D1. Los setups anteriores sin historial siguen siendo válidos.

## Limitación y reversión

Desde el checkpoint del 20 de noviembre, «Restaurar versión» solicita al servidor una versión perteneciente al mismo usuario. Comprueba la versión actual para detectar ediciones concurrentes, crea una versión actual a partir del contenido histórico y conserva la versión previa en el historial. No modifica los snapshots de las operaciones. Una versión eliminada por el límite de 20 no se puede restaurar desde este catálogo.

La versión anterior de Tradeify no reconoce el campo de historial y podría descartarlo al editar un setup. Si se vuelve a V1 después de usar V2, exporta primero un respaldo JSON privado y evita editar setups con historial hasta volver a V2. Consulta [Versiones y reversión segura](14-versiones-y-reversion.md).
