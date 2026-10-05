# Seguridad y privacidad

Account Hub guarda metadatos localmente en SQLite. Un token Codex permanece en `auth.json`, dentro del perfil de la ranura. Codex lo renueva durante el uso. Chrome y Edge mantienen cookies de sesión en sus perfiles persistentes. El almacenamiento local **no se cifra con una clave propia de Account Hub**. La protección depende de los permisos y de la cuenta de Windows; cualquier persona que acceda a tu cuenta puede acceder a estos archivos.

La copia JSON omite `auth.json`, campos internos de perfil y rutas personalizadas de credenciales. Incluye nombres, correos, notas, proyectos, grupos y preferencias portables. Las sesiones de navegador no se exportan y deben volver a iniciarse en otra computadora.

El renderer de escritorio tiene aislamiento de contexto, sandbox, CSP y navegación restringida. El servidor web local de producción y el bridge de desarrollo escuchan solo en loopback; comprueban el origen y la dirección, usan un token aleatorio por ejecución, no habilitan CORS y limitan tamaño y duración. La respuesta web de producción agrega CSP y cabeceras de protección. No expongas el bridge o el servidor en una red.

Codex recibe un entorno por ranura sin `OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL` heredados ni `ELECTRON_RUN_AS_NODE`; Account Hub establece un `CODEX_HOME` independiente. Los logs no incluyen argumentos, entrada de terminal ni archivos de credenciales.

Git, PowerShell y la terminal ejecutan con los permisos de Windows del usuario. Los comandos escritos por la persona en PowerShell no son un sandbox.
