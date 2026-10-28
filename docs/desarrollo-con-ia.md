# Desarrollo con IA

MechLab se ha desarrollado con **Claude Code** (el asistente de programación de Anthropic) integrado en VS Code, trabajando como un programador más del proyecto. Este documento explica cómo se repartió el trabajo y qué prácticas hicieron que el resultado fuera fiable.

## Reparto de papeles

| Persona (desarrollador) | IA (Claude Code) |
|---|---|
| Decide qué se construye y en qué orden, a partir del feedback de los usuarios | Propone cómo hacerlo y lo implementa |
| Exporta los datos del juego con el editor de mods | Escribe y mantiene los scripts que los convierten en JSON |
| Comprueba las cifras en el juego y aporta capturas | Convierte cada captura en un test y ajusta el cálculo hasta que coincide |
| Revisa y fusiona los pull requests | Trabaja en ramas, ejecuta lint, tests y build, prueba en el navegador y abre el pull request |
| Decide qué es un error y qué es un comportamiento intencionado | Deja esas decisiones escritas en `CLAUDE.md` para no repetir el error |

## Prácticas

### El juego es la fuente de verdad

La IA no puede abrir el juego, y los archivos exportados no siempre cuentan toda la historia. Por eso ninguna cifra se da por buena hasta compararla con el mechlab del juego. Cuando no coincide, el desarrollador aporta una captura, la IA la convierte en un test y el cálculo se corrige hasta que pasa. Así se descubrieron reglas que los archivos no dicen: los porcentajes de las mejoras se suman, el juego trunca en lugar de redondear, o los disipadores dobles de la Esfera Interior suman refrigeración al motor.

### Cambios pequeños y verificados

Cada funcionalidad o corrección va en su rama y su pull request. Antes de abrirlo, la IA ejecuta lint, tests y build, y prueba los cambios de interfaz en un Firefox sin interfaz, con capturas de pantalla. El CI de GitHub Actions repite las comprobaciones, y Cloudflare publica una vista previa de cada pull request para revisarlo en el navegador antes de fusionarlo.

### Las correcciones se convierten en reglas

Cuando el desarrollador corrige algo (una regla del juego, un comportamiento que no era un error, una forma de trabajar), la corrección queda escrita en `CLAUDE.md`, que la IA lee al empezar cada sesión. Por ejemplo: la IA subió dos veces commits a una rama cuyo pull request ya estaba fusionado, y desde entonces comprueba el estado del pull request antes de subir nada.

### La IA explica antes de tocar los datos

Con datos del juego, un cambio que parece pequeño puede afectar a cientos de variantes. Antes de regenerar, la IA compara los datos nuevos con los anteriores y presenta un resumen de qué cambia y por qué; las diferencias inesperadas se investigan antes de subir nada.

## Ejemplos de este proyecto

- **El tamaño de los anclajes.** El desarrollador vio en el juego que el Nightstar NSR-WP tenía cuatro anclajes de misiles grandes y la web mostraba dos medianos. La IA comprobó que el archivo del 'Mech no trae el tamaño y siguió la cadena del modelo del juego (MDA → MDL → HPS) hasta encontrarlo. Al aplicarlo cambiaron 197 variantes, y una captura del Kit Fox KFX-S confirmó la regla.
- **Un error del propio juego.** La build de fábrica del KFX-S monta un láser grande en un anclaje mediano. El desarrollador confirmó que el juego tampoco deja montarlo a mano, así que la web lo deja fuera de la build de fábrica en vez de agrandar el anclaje.
- **Las mejoras de la cantina.** Las reglas (cada mejora una vez, la I y la II combinables, porcentajes sumados) salieron de capturas del juego con el Grand Dragon y el Battlemaster, y cada una quedó como un test.
- **Un parche del juego.** Las notas del parche listaban 29 variantes con cambios de refrigeración. Al volver a exportar todos los datos, la IA comparó cada variante con su versión anterior y encontró 21 más que las notas no mencionaban, además de un cambio de formato en los archivos que confundía unas variantes con otras. Los enlaces y las builds guardadas de los usuarios siguieron funcionando.
- **Seguridad antes de publicar el código.** Antes de hacer público el repositorio, la IA revisó todo el historial en busca de claves, tokens y correos.

## Límites

- La IA no juega: todo lo que depende de cómo se comporta el juego se ha comprobado a mano en él.
- Algunas cifras siguen sin verificar, y están marcadas como tales (por ejemplo, el efecto de algunas mejoras, como las de cooldown o capacidad de calor). Quedan pendientes de una captura del juego.
- Las decisiones de producto (qué construir, qué es un error, qué se publica) las ha tomado siempre el desarrollador.
