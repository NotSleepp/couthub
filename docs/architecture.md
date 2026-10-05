# Arquitectura

Account Hub es un administrador local de identidades y tareas de desarrollo. Electron crea una única ventana aislada, que habla con el proceso principal mediante un contrato RPC fijo de `electron/application.js`. SQLite es la fuente persistente y los servicios principales utilizan APIs del sistema sin pasar por el renderer.

## Componentes

- Interfaz: React, TypeScript, React Router, Vite y xterm.js.
- Escritorio: Electron main, preload sandboxed, proceso SQLite.
- Datos: SQLite WAL bajo `%APPDATA%\AccountHub\data\accounthub.db`.
- Identidades Codex: un `CODEX_HOME` persistente por ranura; credenciales personales quedan en su archivo local bajo ese perfil.
- Navegación: Chrome o Edge con un `--user-data-dir` diferente por perfil.
- Terminal: node-pty y Windows ConPTY bajo el proceso principal.
- Git: invocaciones nativas con argumentos separados por array y rutas validadas.
- Navegador local: el servidor Node sirve la compilación web, comparte la misma base local y adjunta el bridge autenticado.

Cada perfil de navegador mantiene su propia sesión. Iniciar sesión por primera vez sigue siendo un paso interactivo del usuario.

## Decisiones

La interfaz de escritorio, el modo web de desarrollo y el servidor web local de producción reutilizan servicios y contrato RPC. El servidor web escucha solo en `127.0.0.1`; sirve la misma máquina Windows que abre Codex, Chrome/Edge y las terminales. No es un servidor de red o multiusuario y no hay API en la nube ni telemetría. Se inicia con `npm run web:build` y `npm run web:start` después de instalar las dependencias.
