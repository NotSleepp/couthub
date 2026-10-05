# Contribuir a Account Hub

Gracias por considerar una contribución. Los cambios que mejor ayudan son los que resuelven un problema reproducible y mantienen aislados los perfiles y los datos personales.

## Antes de empezar

- Para errores, abrí un reporte con los pasos, el resultado esperado y el resultado observado. Quitá nombres de cuenta, rutas privadas, tokens y cualquier dato personal de capturas o logs.
- Para una función nueva, describí el caso de uso y el comportamiento esperado antes de hacer un cambio grande.
- Para un cambio de alcance amplio, esperá comentarios sobre la propuesta para reducir trabajo que no encaje con el proyecto.

## Preparar el entorno

Se requiere Windows x64, Node.js 22.12.0 o posterior, npm, Git y PowerShell. Desde una copia de trabajo:

```powershell
npm ci
npm run dev
```

Para ejecutar las comprobaciones antes de enviar el cambio:

```powershell
npm run typecheck
npm test
npm run verify
```

Los recorridos de interfaz requieren Chrome; `npm run test:packaged` requiere primero `npm run build`. Las verificaciones escriben fixtures temporales en `.audit/`, ignorado por Git. No ejecutes pruebas contra `%APPDATA%\AccountHub` ni contra cuentas reales.

## Enviar un cambio

1. Abrí una issue para informar el error o conversar sobre una propuesta importante.
2. Trabajá en una rama con un nombre corto que describa el cambio.
3. Conservá el alcance acotado y agregá o actualizá pruebas cuando cambie el comportamiento.
4. Ejecutá las comprobaciones pertinentes y anotá en el pull request cuáles pasaron y cuáles no pudiste ejecutar.
5. Enviá un pull request con el problema, el cambio visible para la persona usuaria y cualquier limitación relevante.

No incluyas carpetas de perfiles, archivos `auth.json`, bases de datos de uso real, cookies, capturas de cuentas personales, archivos de `.audit/`, instaladores ni contenido de `release/` o `dist/`.

## Reglas para cambios sensibles

- Mantené el renderer aislado: los accesos a SQLite, procesos, terminal y sistema pasan por el contrato RPC existente, con validación en el proceso principal.
- No copies credenciales de Codex automáticamente, no accedas a cookies del navegador y no automatices inicios de sesión.
- Mantené el bridge web limitado a loopback, autenticado y con validación de origen.
- Para cambios de Git, terminal, rutas o perfiles, leé [AGENTS.md](AGENTS.md) y la documentación de [seguridad](docs/security.md).
- No registres comandos, entradas de terminal, tokens ni datos de cuentas.

## Estilo y comunicación

La interfaz y la documentación principal están en español. Podés enviar reportes y cambios en español o inglés. Explicá con claridad los pasos para reproducir un error y evitá subir datos sensibles. Todas las personas que participan deben seguir el [Código de conducta](CODE_OF_CONDUCT.md).
