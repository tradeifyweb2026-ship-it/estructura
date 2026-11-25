# Documentación de Tradeify

[Continuación vigente: diez perfiles de reportes, pruebas y estado de las 25 fases](18-reportes-v2-2026-11-21.md).

Actualizado para V2: 20 de noviembre de 2026. Se conserva evidencia histórica del 17–18 de noviembre. Esta documentación describe el código entregado, su despliegue Cloudflare desde GitHub y el perfil alternativo de Sites. El informe de seguridad registra la evidencia y las verificaciones pendientes.

| Documento | Contenido |
| --- | --- |
| [Manual de usuario](01-manual.md) | Pantallas, registro, parciales, cuentas, revisión |
| [Arquitectura y estructura](02-arquitectura.md) | Componentes, servicios y mapa del código |
| [Modelo de datos](03-datos.md) | Tablas, campos, unidades, relaciones y versiones |
| [API y seguridad](04-api-seguridad.md) | Contratos, acceso, archivos y errores |
| [Cálculos e intercambio CSV](05-calculos-csv.md) | Fórmulas, importación, exportación y límites |
| [Desarrollo y publicación](06-desarrollo-publicacion.md) | Instalación, configuración, migraciones y despliegue |
| [Operación y mantenimiento](07-operacion.md) | Respaldos, restauración y diagnóstico |
| [Pruebas y alcance](08-pruebas-alcance.md) | Verificación, límites y pendientes |
| [Compartir y exportar](09-compartir-exportar.md) | Diseño único de PDF, Excel, CSV, imagen y texto; privacidad por defecto y límites |
| [Cloudflare desde GitHub](10-cloudflare-github.md) | Configuración de Worker, D1, R2 y acceso privado con Google |
| [Informe de seguridad](../SEGURIDAD_INFORME.md) | Hallazgos, correcciones, pruebas, cobertura y acciones manuales |
| [Informe de usabilidad](../UX_INFORME.md) | Recorridos reales en Chrome, correcciones móviles, evidencia y pruebas pendientes |

Para cambiar reglas de negocio empieza por `lib/journal.ts`, revisa `db/repository.ts` y los consumidores de `components/journal`. El código y el archivo de bloqueo son la referencia exacta de contratos y dependencias.

[Preparación del lanzamiento público](11-lanzamiento-publico.md)

[Administración y permisos](12-administracion.md)

[Versiones y reversión segura](14-versiones-y-reversion.md)

[Historial de estrategias en V2](15-historial-estrategias.md)

[Correcciones, verificaciones y estado de las 25 fases](16-cierre-v2-2026-11-20.md)

[Continuación: consultas SQL, paginación real, drawdown y siguientes pasos](17-continuacion-v2-2026-11-20.md) — estado vigente posterior al informe 16.

[Reportes profesionales V2 y validación en Chromium](18-reportes-v2-2026-11-21.md).

[Cinco módulos V2, interfaz integral y estado vigente de las 25 fases](19-modulos-v2-2026-11-22.md).
