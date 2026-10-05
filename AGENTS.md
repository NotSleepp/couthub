# Account Hub: guía para agentes de desarrollo

## Producto y arquitectura

Aplicación local para Windows que administra perfiles de Codex, ChatGPT, correo, proyectos y Git worktrees. La aplicación de escritorio usa Electron con React, Vite, TypeScript y SQLite. `electron/application.js` construye los servicios una sola vez. Tanto el preload aislado de Electron como el adaptador local usan el mismo contrato `grupo:método` mediante RPC validado. La base de datos, los perfiles de navegador, las credenciales y los registros quedan bajo `%APPDATA%\AccountHub`. El modo web es una interfaz de desarrollo conectada al bridge loopback autenticado; no es un backend multiusuario o para Internet.

## Estructura importante

- `electron/application.js`: construcción de servicios y contrato RPC.
- `electron/main.js`, `preload.js`: ciclo de vida, ventana y frontera de seguridad de Electron.
- `electron/database.js`: esquema SQLite, migración, CRUD, copias de seguridad.
- `electron/services/`: integración con Codex, terminal ConPTY, Chromium, sistema, logs y Git.
- `src/pages/`: vistas React.
- `src/services/web-adapter.ts`: transporte del RPC local para modo web.
- `tests/`: pruebas unitarias y de integración con recursos temporales.
- `scripts/verify-desktop.cjs`, `verify-web.cjs`: recorridos reales de interfaz en entornos aislados.
- `docs/`: diseño, privacidad y flujos locales.

## Comandos

- `npm ci`: instalación reproducible.
- `npm run dev`: interfaz y aplicación Electron de desarrollo.
- `npm run dev:web`: interfaz web conectada solo al bridge local.
- `npm run typecheck`: chequeo TypeScript estricto.
- `npm test`: integración SQLite, seguridad RPC, terminal simulada y repositorios Git desechables.
- `npm run test:desktop`: recorrido de interfaz de Electron y ConPTY real; escribe fixtures bajo `.audit/`.
- `npm run test:web`: UI, persistencia y bridge en Chrome con una base temporal.
- `npm run test:packaged`: verifica el ejecutable empaquetado.
- `npm run verify`: tipos, tests, build Vite y recorridos UI de escritorio/web.
- `npm run build`: instalador Windows x64.

## Seguridad y diseño

1. El renderer nunca importa Node ni recibe acceso directo a SQLite, procesos, filesystem o shell. Agrega métodos nuevos en la tabla del preload, en el adaptador web, en los tipos de `src/types/electron.d.ts` y en `createApplication().handlers`. La prueba de contrato comprueba la paridad.
2. Valida entradas también en el proceso principal. Usa `spawn`/`execFile` con arrays de argumentos, nunca concatenes instrucciones de Git o argumentos del shell. Codifica scripts fijos de PowerShell con `-EncodedCommand`; usa `Set-Location -LiteralPath` y literales de PowerShell.
3. Permite solo carpetas que existen y resuelve la ruta antes de abrir. Valida URLs externas con `webUrl`. Para remover un worktree, confirma que pertenezca al proyecto seleccionado, protege la rama principal y rechaza archivos tracked, untracked e ignored.
4. Codex usa un `CODEX_HOME` permanente distinto por ranura. No copies credenciales entre cuentas automáticamente, no exportes `auth.json`, no uses keyring compartido, no accedas a cookies del navegador y no implementes login automático ni evasión de cuotas.
5. Los datos de prueba siempre viven fuera del perfil activo bajo directorios temporales. No apuntes las pruebas de escritura a `%APPDATA%\AccountHub` ni a cuentas reales.
6. Mantén la API HTTP ligada a loopback, verifica el origen y el token de sesión, limita tamaños y rechaza CORS abierto. No publiques este bridge en una red.
7. Reporta los fallos de apertura al usuario. No devuelvas datos de muestra como si fueran datos reales.
8. Las preferencias del inicio con Windows y el atajo global afectan el equipo actual; los datos importados nunca deben sobrescribirlas silenciosamente.

## Esquema SQLite y copias

Agrega cambios de esquema como migraciones nuevas y monotónicas en `Database.migrate`; no edites ni reinicies la migración histórica. Usa transacciones para importar lotes. Conserva UUIDs de perfiles ajenos a la instalación solo tras validar su formato y sus límites. Las copias contienen metadatos y configuración portable; nunca tokens, contraseñas ni rutas personalizadas de credenciales. Comprueba el tamaño y la versión antes de restaurar.

## Terminal y sistemas externos

La terminal integrada es una sesión ConPTY del proceso principal. Su salida tiene un límite de memoria y un cursor monotónico; las pestañas comparten su sesión persistente. Los comandos de usuario son entrada a PowerShell autorizada por el usuario. No registrés la entrada, las credenciales ni la salida de la terminal en los logs. Prueba stdin/stdout, redimensionamiento, cierre, reinicio y aislamiento del perfil.

## Pull requests y verificación

Tras editar, ejecuta `npm run verify`. Si cambias el empaquetado, autenticación, ConPTY o importación, regenera y prueba `npm run build` y `npm run test:packaged`. Describe fallos observados, cómo reproducirlos y evidencia. No afirmes haber probado login de cuentas reales, browser sign-in, code signing o instalación en Windows si no ocurrió.
