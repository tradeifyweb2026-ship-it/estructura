# Preparación del lanzamiento público

1. Revisa las páginas de privacidad y condiciones y completa el contacto del responsable. Confirma el permiso de uso público del catálogo de frases.
2. Configura Google Auth Platform con audiencia externa, marca, origen y URI de retorno del Worker. Comprueba la cuenta existente y una cuenta nueva en un entorno de pruebas.
3. Conserva las variables de Google y la firma de sesión. TRADEIFY_OWNER_EMAIL es opcional. Configura TRADEIFY_MAX_TRADES para cambiar el máximo de operaciones y TRADEIFY_MARKET_SYMBOL para el activo inicial.
4. Para ofrecer acceso por correo, verifica un remitente en Resend y configura TRADEIFY_EMAIL_FROM y el secreto TRADEIFY_EMAIL_API_KEY. Comprueba la entrega real y los límites de tu proveedor. Google y correo tienen bitácoras independientes.
5. Conserva los bindings DB, BUCKET y los dos limitadores. Haz una copia de D1 y ensaya su restauración. Aplica las migraciones pendientes en orden, primero en pruebas. 0003 añade cuotas y 0004 los códigos de acceso. No edites las migraciones anteriores.
6. Verifica desde un teléfono el ingreso, el cierre de todas las sesiones, el borrado de una cuenta desechable, las capturas de entrada y salida, la vista previa y las exportaciones. Los archivos de R2 se conservan al sustituirlos por enlaces. Su retiro posterior requiere el inventario descrito en la guía de Cloudflare.
7. En Mercados, comprueba carga, atribución, tema y dimensiones del gráfico y del calendario. La ruta española y los formatos de captura disponibles en cada aplicación de TradingView están **no verificados**. El contrato admite dominios exactos, documentados en el esquema. Un enlace de página se abre directamente.

La paginación del historial y la unificación de identidades quedan pendientes. Las pruebas locales usan datos desechables y proveedores simulados. La configuración real de las consolas y los envíos a buzones reales están **no verificados**.
