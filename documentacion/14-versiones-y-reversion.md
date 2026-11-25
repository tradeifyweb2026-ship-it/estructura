# Versiones y reversión segura de Tradeify

## Ramas conservadas

| Versión | Rama | Commit de referencia | Estado |
|---|---|---|---|
| Versión anterior | `main` | `913425d042c681d1682bd7df11facda70d26c4d2` | Conservada, sin cambios de V2 |
| Respaldo de versión anterior | `version-anterior-2026-11-18` | `913425d042c681d1682bd7df11facda70d26c4d2` | Copia de seguridad |
| Mejoras nuevas | `mejoras-v2-2026-11-18` | HEAD de la rama | Desarrollo aislado |

La rama V2 está separada. [Consulta aquí su HEAD actual en GitHub](https://github.com/tradeifyweb2026-ship-it/Tradeify.web/tree/mejoras-v2-2026-11-18). No se integró en `main`, no se cambió la rama de producción y no se desplegó a Cloudflare. La versión anterior permanece accesible sin revertir commits.

## Abrir la versión V2

1. En GitHub, abre el repositorio Tradeify.
2. Abre el selector de ramas que normalmente muestra `main`.
3. Selecciona `mejoras-v2-2026-11-18`.
4. Para revisar el código, permanece en esa rama. Para regresar, cambia el selector a `version-anterior-2026-11-18` o `main`.

En un equipo local:

```bash
git fetch origin
git switch mejoras-v2-2026-11-18
```

## Regresar a la versión anterior

Si todavía no integraste V2, basta con volver a la rama anterior:

```bash
git fetch origin
git switch version-anterior-2026-11-18
```

También puedes elegir `main`, que conserva el mismo commit base. No hace falta borrar la rama V2 ni ejecutar un reset destructivo.

**Importante para Cloudflare:** cambiar de rama en GitHub no revierte por sí solo un despliegue que ya se haya publicado. Si en el futuro se despliega V2, la reversión de producción debe seleccionar explícitamente el commit o rama anterior en la configuración de builds/despliegue de Cloudflare y verificar el resultado. No se ha realizado ese paso porque faltan verificaciones obligatorias de lanzamiento, aunque el encargo del 20 de noviembre autoriza publicar cuando todas se cumplan.

## Datos al bajar de versión

Los checkpoints 2–14 no añadieron migraciones SQL. El checkpoint del 20 de noviembre añade `0006_restore_receipts.sql` (recibos idempotentes) y `0007_individual_quotas.sql` (columna nullable para cuotas individuales). Son aditivas y preservan los datos; se probaron localmente sobre registros previos. Sin embargo, algunos campos nuevos se guardan dentro de los datos JSON de cuentas, estrategias y operaciones, incluido el historial de hasta 20 versiones por setup. La versión anterior puede mostrar los campos básicos, pero al editar y guardar un registro con su esquema antiguo podría descartar metadatos exclusivos de V2.

Antes de usar la versión anterior después de haber registrado información nueva en V2:

1. Desde V2, genera un respaldo JSON privado completo.
2. Guarda el archivo fuera del repositorio y no lo compartas públicamente.
3. Cambia a la rama anterior.
4. No edites en la versión anterior registros que contengan metadatos exclusivos de V2 si deseas conservarlos.
5. Para recuperar esos campos, vuelve a V2 y utiliza el respaldo compatible. La versión anterior no garantiza la restauración de los campos nuevos.

El respaldo JSON no incluye las imágenes físicas almacenadas en R2. Las capturas guardadas como enlaces permanecen en los registros, pero los objetos antiguos requieren su propio respaldo.

## Política de cambios

- Mantener `main` y `version-anterior-2026-11-18` intactas hasta que V2 supere compilación, pruebas y revisión.
- Trabajar en `mejoras-v2-2026-11-18`.
- La autorización del 20 de noviembre permite publicar V2 solo tras satisfacer los controles del encargo. No fusionar `main` ni publicar mientras existan bloqueos obligatorios.
- Conservar commits de V2 para facilitar comparación y recuperación.

### Reversión después de las migraciones nuevas

Conserva las tablas/columnas aditivas al volver al Worker anterior: no ejecutes migraciones inversas ni borres recibos o cuotas. El Worker anterior desconoce la cuota individual y puede volver a aplicar su máximo general al guardar; por eso no se certifica como reversión funcional de esa capacidad. Debe ensayarse en pruebas y restablecerse el Worker V2 si se necesita mantener los límites individuales. Un respaldo JSON conserva registros de trading, pero no sustituye un export recuperable de D1 ni un respaldo R2. El ID real de una versión del Worker para rollback sigue pendiente de acceso al entorno definitivo.

## Continuación con migración 0008

La revisión por usuario y sus índices/triggers son aditivos y se conservan al volver al Worker del checkpoint 15. No ejecutar migraciones inversas ni borrar datos para volver de versión. Ese Worker anterior no usa el contrato nuevo de cursor; los clientes deben recargar. Su eliminación de cuentas tampoco limpia explícitamente `journal_revisions`, por lo que la retención de ese contador debe revisarse al ensayar la reversión. La recuperación/rollback reales siguen pendientes de acceso y respaldo definitivo; la compatibilidad del esquema local no los certifica.


## V2 con biblioteca y mantenimiento

Las migraciones 0009–0012 son aditivas y deben estar verificadas/aplicadas antes del Worker que las consulta. Antes de publicar se exige respaldo D1 recuperable, copia R2 y un ensayo de recuperación; los fixtures de CI no acreditan estos recursos reales.

Antes de volver a un Worker anterior, desactivar mantenimiento desde el propietario y comprobar su estado. Conservar todas las tablas y datos nuevos; no ejecutar DROP ni una migración inversa destructiva. La biblioteca de frases puede quedar sin interfaz al volver a una versión anterior, pero permanece en D1 para recuperar la versión nueva. El JSON de bitácora no sustituye el respaldo de esa biblioteca ni de R2.

No hay despliegue ni reversión de producción ejecutados en esta entrega.
