# Security policy / Política de seguridad

## Supported versions / Versiones soportadas

Only the latest release gets fixes. / Solo la última versión recibe correcciones.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private reporting instead: go to the **Security** tab of this repository and click **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a first reply within 7 days. Once a fix is out, you will be credited in the changelog unless you prefer otherwise.

## Reportar una vulnerabilidad

Por favor **no** abras un issue público. Usa el reporte privado de GitHub: entra en la pestaña **Security** de este repositorio y pulsa **Report a vulnerability**.

Cuenta qué encontraste, cómo reproducirlo y qué podría hacer un atacante con ello. Deberías recibir una primera respuesta en 7 días. Cuando salga la corrección, aparecerás en el changelog salvo que prefieras lo contrario.

## Scope / Alcance

groundhog runs as a local hook with your user's permissions. It makes no network calls and has no dependencies. Things that are in scope:

- a crafted hook payload or transcript that makes groundhog write outside its state folder, run code, or crash Claude Code
- file contents, paths or project names leaking into hook messages or the report

groundhog corre como hook local con los permisos de tu usuario. No hace llamadas de red y no tiene dependencias. Entra en alcance:

- un payload de hook o un transcript manipulado que haga que groundhog escriba fuera de su carpeta de estado, ejecute código o tumbe Claude Code
- contenido de archivos, rutas o nombres de proyecto que se filtren en las notas del hook o en el reporte
