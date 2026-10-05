# Perfiles de navegador

Cada ranura ChatGPT crea `%APPDATA%\AccountHub\browser-profiles\chatgpt-NN`. Cada cuenta de correo tiene un perfil UUID persistente y una URL propia. Chrome o Edge abre el perfil con `--user-data-dir`. Iniciá sesión personalmente la primera vez; el perfil persiste para usos posteriores.

Una cuenta de proveedor personalizado requiere una URL HTTP o HTTPS. Se rechazan esquemas de aplicación y URLs con usuario o contraseña. La aplicación no importa cookies ni automatiza contraseñas o MFA. Los perfiles Chrome y Edge viven fuera de la copia JSON y no se migran con ella.
