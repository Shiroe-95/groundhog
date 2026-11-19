# Cómo contribuir

Gracias por querer ayudar. [English](CONTRIBUTING.md)

## Reglas básicas

- **Cero dependencias.** groundhog corre dentro del editor de la gente, así que usa solo la biblioteca estándar de Node.js. No se aceptará un pull request que añada un paquete.
- **Sin red.** Los hooks y el reporte nunca se conectan a internet.
- **Nunca imprimir datos del usuario.** Ni rutas, ni contenido de archivos, ni nombres de proyecto pueden llegar a las notas del hook o al reporte. Si tocas `scripts/lib/signature.js`, añade un test que demuestre que nada se filtra.
- **Un hook nunca rompe una sesión.** Todo hook sale con código 0, incluso con una entrada mala.

## Puesta en marcha

```bash
git clone https://github.com/Shiroe-95/groundhog
cd groundhog
node --test                       # todos los tests deben pasar
claude plugin validate . --strict # si tienes Claude Code instalado
claude --plugin-dir .             # prueba tu copia en vivo
```

Node.js 20.1 o superior.

## Buenas primeras contribuciones

- **Una firma que agrupa mal.** Dos errores que deberían coincidir y no lo hacen, o al revés. Abre un issue con los dos textos de error, sin rutas personales.
- **Mejores notas.** Si una nota no ayudó al agente a desatascarse, muestra qué decía y qué hizo el agente después.
- **Detección de reversiones con `Write`.** Hoy solo se revisa `Edit`.

## Pull requests

1. Para cualquier cosa más grande que un arreglo pequeño, abre antes un issue.
2. Un cambio por pull request, con su test.
3. Actualiza `CHANGELOG.md` en `Unreleased`.
4. Si cambia el comportamiento, actualiza `README.md` y `README.es.md`.

Al contribuir aceptas que tu trabajo se publica bajo la licencia MIT y que sigues el [Código de conducta](CODE_OF_CONDUCT.md).
