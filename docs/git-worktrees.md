# Git worktrees

Registrá primero un proyecto en la página Proyectos. Account Hub detecta repositorios, remotos y tipos de proyecto. En Git Worktrees seleccioná el repositorio y las ranuras; las ramas se crean bajo `%LOCALAPPDATA%\AccountHub\worktrees`. La ubicación incluye una huella del repositorio para separar proyectos con nombres iguales.

Podés abrir Codex, una terminal, VS Code o Explorer directamente en cada worktree. La aplicación muestra rama, último commit y archivos modificados. El repositorio principal nunca se borra desde la aplicación. No se eliminan worktrees con cambios preparados, editados, sin seguimiento o ignorados. Al quitar un worktree, la rama local se conserva.
