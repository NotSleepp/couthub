# Perfiles de Codex

Cada ranura tiene un directorio bajo `%APPDATA%\AccountHub\codex-profiles\codex-NN` y un `CODEX_HOME` independiente. Así varias sesiones no intercambian el perfil predeterminado. En modo de archivo, Codex usa `auth.json` dentro de `CODEX_HOME`; Account Hub establece esta preferencia en los comandos de inicio de sesión y uso.

En «Login CLI», usá «Login con código» o el flujo interactivo de navegador. El inicio con código puede requerir habilitar primero esa opción en las preferencias de seguridad de ChatGPT. El estado de sesión solo se confirma si `auth.json` contiene credenciales completas. Si las políticas del administrador fuerzan el almacén compartido de Windows, Account Hub no copia credenciales a escondidas.

«Vincular cuenta actual» copia explícitamente `~/.codex/auth.json` a una ranura vacía bajo una acción iniciada por el usuario. Protegé la carpeta de datos local como una contraseña. Las credenciales no se guardan en SQLite, logs ni copias exportadas.

Los estados y los recordatorios de recuperación son manuales; no consultan cuotas ni modifican automáticamente los estados. Cada sesión Codex se abre en una terminal interactiva aislada.

El instalador incluye seis accesos PowerShell en `resources\launchers`, accesibles desde «Accesos PowerShell». En desarrollo se encuentran en la carpeta del proyecto. Aceptan una ruta de proyecto con espacios mediante el selector explícito `-ProjectPath`.
