<div align="center">

[English](README.md) · **Español**

# groundhog

**Tu agente de código sigue despertando en el mismo error. groundhog se da cuenta.**

Un plugin para Claude Code que detecta cuándo el agente choca con el mismo muro usando comandos *distintos*, o deshace sus propias ediciones una y otra vez, y le pide parar y pensar antes del siguiente intento.

[![CI](https://github.com/Shiroe-95/groundhog/actions/workflows/ci.yml/badge.svg)](https://github.com/Shiroe-95/groundhog/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)
![Node >= 20.1](https://img.shields.io/badge/node-%3E%3D20.1-339933)
![Dependencias: 0](https://img.shields.io/badge/dependencias-0-brightgreen)

</div>

---

## El problema

Seguro que lo has visto. El agente corre un comando y recibe un error. Ajusta el comando y recibe el mismo error. Prueba otro flag, luego otro archivo, luego otra herramienta. Seis intentos después nada ha cambiado, y el contexto está lleno de fallos casi idénticos.

La mayoría de los detectores de bucles buscan llamadas **idénticas**: misma herramienta, mismos argumentos, una y otra vez. Eso atrapa el bucle más tonto, pero no el más común. El agente rara vez se repite tal cual. Cambia la entrada en cada intento y el error sigue igual.

Antes de escribir una línea de código lo medí en mi propio historial de Claude Code:

| Qué | Cantidad |
| --- | --- |
| Sesiones revisadas | 616 |
| Sesiones con al menos un muro | 113 (18%) |
| Muros (misma herramienta, mismo error, 3+ veces en una sesión) | 141 |
| Llamadas fallidas dentro de esos muros | 639 |
| Muros donde **cada reintento cambió la entrada** | 83 (59%) |
| Muros hechos de reintentos idénticos | 58 (41%) |
| Ediciones que deshicieron una edición anterior (A a B, de vuelta a A) | 23 |

Seis de cada diez muros pasarían de largo por un detector de llamadas idénticas. Ese hueco es el que cubre groundhog.

Puedes sacar la misma tabla de tus sesiones con `/groundhog-report`.

## Cómo funciona

groundhog son dos hooks pequeños y dos skills. Sin red, sin dependencias, sin procesos en segundo plano.

```
falla una herramienta ──> hook PostToolUseFailure
                            │
                            ├─ normaliza el error en una firma
                            │    rutas   -> <path>
                            │    hashes  -> <hex>
                            │    números -> <n>
                            │
                            ├─ cuenta (herramienta + firma) en esta sesión
                            │
                            ├─ 2.º choque: "hipótesis nueva antes de reintentar"
                            └─ 3.er choque: "para. lee el error, delega o pregunta"

Edit con éxito ──> hook PostToolUse
                    └─ ¿esta edición revierte una anterior? lo dice
```

**La firma es la idea central.** `Cannot find module '/home/a/src/db.js'` y `Cannot find module 'C:\work\src\db.js'` son el mismo muro. Los números de línea, rutas temporales, hashes de commit y puertos cambian en cada intento. La causa no. groundhog quita el ruido y se queda con la forma del error.

Cuando el contador pasa un umbral, el hook añade una nota corta junto al resultado de la herramienta. El agente la ve en su siguiente turno. groundhog nunca bloquea una llamada ni reescribe la salida. Solo aporta evidencia.

### Lo que ve el agente

En el segundo choque:

```
groundhog: this is the 2nd time this session that Bash failed with the same error signature:
  "Error: Cannot find module '<path>'"
Recent attempts:
  1. node scripts/migrate.js
  2. node ./scripts/migrate.js --env dev
The input changed but the error did not, so the cause is probably not what the last
attempt changed. Before the next retry, write one sentence with a new hypothesis that
explains every failure above, and the cheapest check that would prove it wrong.
Then run that check.
```

En el tercero se le pide parar y elegir una de tres salidas: leer el error completo y el código al que apunta, pasar el problema a un subagente nuevo con solo los hechos, o preguntarte a ti.

Las notas al agente van en inglés a propósito: es el idioma en que el modelo sigue instrucciones con más fiabilidad. El agente te responde en tu idioma igual.

Cuando una edición revierte una edición anterior del mismo archivo:

```
groundhog: this edit undoes an earlier edit to config.ts in this session
(back-and-forth #1). You are oscillating between two versions. Before touching
this file again, decide which version is correct and cite the evidence.
```

## Instalación

Dentro de Claude Code:

```
/plugin marketplace add Shiroe-95/groundhog
/plugin install groundhog@groundhog
```

O desde una terminal:

```bash
claude plugin marketplace add Shiroe-95/groundhog
claude plugin install groundhog@groundhog
```

Necesitas Node.js 20.1 o superior en el `PATH`. Casi todo el que usa Claude Code ya lo tiene.

## Uso

Una vez instalado no hay nada que ejecutar. Los hooks trabajan solos.

| Comando | Qué hace |
| --- | --- |
| `/groundhog-report` | Revisa tu historial local de sesiones y muestra tus muros principales, cuántos tuvieron entradas cambiantes y cuántas ediciones se revirtieron. |
| skill `groundhog:unstick` | El protocolo que sigue el agente cuando aparece una nota. El agente la carga solo; también puedes llamarla por su nombre. |

También puedes correr el reporte fuera de Claude Code:

```bash
node scripts/report.js --lang es  # español
node scripts/report.js            # inglés
node scripts/report.js --json     # números en crudo
node scripts/report.js --dir /ruta/a/transcripts
```

## Configuración

Todo se configura con variables de entorno. Ponlas en tu shell o en el bloque `env` de la configuración de Claude Code.

| Variable | Por defecto | Significado |
| --- | --- | --- |
| `GROUNDHOG_WARN_AT` | `2` | Número de choque que dispara la primera nota (de 2 a 20). |
| `GROUNDHOG_STOP_AT` | `3` | Número de choque que dispara la nota de "para" (nunca menor que `WARN_AT`). |
| `GROUNDHOG_DISABLE` | sin definir | Ponla en `1` para apagar groundhog sin desinstalarlo. |

## Privacidad y seguridad

groundhog está pensado para poder instalarse en una máquina de trabajo sin miedo.

- **Sin llamadas de red.** No se envía nada a ningún sitio. Compruébalo con `grep -r "http" scripts/`.
- **Sin dependencias.** Solo la biblioteca estándar de Node.js. No hay cadena de suministro que comprometer.
- **Estado mínimo.** Los contadores por sesión viven en la carpeta de datos que Claude Code da al plugin (o en la carpeta temporal del sistema), legibles solo por ti. Para mostrarle al agente lo que ya intentó, cada muro guarda también sus últimos 5 comandos, cortados a 100 caracteres, con URLs, correos, tokens y secretos `clave=valor` enmascarados. Los archivos de más de 7 días se borran solos.
- **No guarda código.** Para detectar reversiones guarda solo hashes SHA-256 truncados del texto editado, nunca el texto.
- **Salida limpia.** Las firmas cambian rutas, URLs, correos, tokens, hashes y números por marcadores. El reporte va más allá: nunca imprime comandos y enmascara nombres entre comillas, identificadores en CamelCase y nombres de servidores MCP. El enmascarado se basa en patrones, así que échale un vistazo antes de publicar un reporte.
- **Ante la duda, silencio.** Una entrada malformada, un archivo de estado corrupto o un payload enorme hacen que el hook salga sin decir nada. Nunca rompe tu sesión.
- **Reporte de solo lectura.** `/groundhog-report` solo lee transcripts. No escribe nada.

¿Encontraste un problema de seguridad? Mira [SECURITY.md](SECURITY.md).

## Por qué no simplemente...

**...usar un detector de llamadas idénticas?** Herramientas como LoopGuard, loop-circuit-breaker y agent-loop-detector hacen bien su trabajo. Pero toman la huella de la *llamada*, y en mis datos la mayoría de los muros cambian la llamada cada vez. groundhog toma la huella del *error*. Los dos enfoques conviven sin problema.

**...bloquear la herramienta tras N fallos?** Bloquear estorba cuando el reintento es a propósito, como esperar a que arranque un servidor. Una nota deja la decisión al agente y te mantiene a ti al mando.

**...usar un hook Stop?** Los hooks Stop desde plugins tienen aristas ([anthropics/claude-code#10412](https://github.com/anthropics/claude-code/issues/10412)). Comentar el fallo justo donde ocurre es más simple y funciona hoy.

Discusiones relacionadas: [#4317](https://github.com/anthropics/claude-code/issues/4317) (detección de bucles), [#12768](https://github.com/anthropics/claude-code/issues/12768) (detección de thrashing), [#47033](https://github.com/anthropics/claude-code/issues/47033) (contador de fallos por sesión), [#42796](https://github.com/anthropics/claude-code/issues/42796) (tasa de bucles).

## Limitaciones

- La firma es una heurística. Dos bugs distintos pueden compartir línea de error ("Segmentation fault") y un mismo bug puede imprimir dos líneas distintas. Los umbrales son bajos a propósito para que una falsa alarma cueste una frase.
- Solo se revisan las llamadas `Edit` en busca de reversiones. Una reversión hecha con `Write` o con un comando de shell no se ve.
- Los contadores son por sesión. Un muro que cruza varias sesiones se ve en el reporte, no en vivo.
- El reporte lee el formato de transcripts que usa Claude Code hoy. Si ese formato cambia, el reporte puede contar de menos hasta que se actualice. Los hooks no dependen de él.

## Preguntas frecuentes

**¿Gasta tokens?** Unos cientos, y solo cuando hay un muro. En mi historial los muros fueron una parte pequeña del total de tokens. Lo que ahorra groundhog son turnos, tiempo y paciencia.

**¿Me va a molestar en el trabajo normal?** Solo si la misma herramienta falla con el mismo error normalizado al menos dos veces en una sesión. Una sesión limpia nunca sabe de él.

**¿Funciona con subagentes?** Sí. Los hooks también saltan con las llamadas de los subagentes y se cuentan en la sesión que las reporta.

**¿Windows?** Sí. La CI corre en Linux, macOS y Windows.

## Desarrollo

```bash
git clone https://github.com/Shiroe-95/groundhog
cd groundhog
node --test
claude plugin validate . --strict
```

Para probar tu copia local en Claude Code: `claude --plugin-dir .`

Los detalles están en [CONTRIBUTING.es.md](CONTRIBUTING.es.md).

## Autor

Creado por el ingeniero **Wilson Vargas Martinez**. [LinkedIn](https://www.linkedin.com/in/wilsonvm09) · [GitHub](https://github.com/Shiroe-95)

## Licencia

[MIT](LICENSE). Úsalo, haz un fork, publícalo.
