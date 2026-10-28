# Desarrollo con IA

MechLab se ha desarrollado combinando tres asistentes de IA, cada uno en la etapa del proyecto en la que mejor encajaba: **Gemini** para el planteamiento, **GitHub Copilot** para la primera versión funcional y **Claude Code** para la limpieza, la refactorización y todo lo que vino después. Este documento explica qué aportó cada uno, qué limitaciones aparecieron y qué prácticas hicieron que el resultado fuera fiable.

## Etapas y herramientas

| Etapa | Herramienta | Para qué se usó |
|---|---|---|
| **Planteamiento** | Gemini | Definir el objetivo, el alcance y el diseño inicial del proyecto. Primeras versiones de código. |
| **Primera versión funcional** | GitHub Copilot | Autocompletado y chat en el editor, y sobre todo el modo agente para construir la primera versión que funcionaba de principio a fin. |
| **Calidad y evolución** | Claude Code | Limpieza masiva y refactorización, tests, integración continua, despliegue y todas las funcionalidades posteriores, con las verificaciones contra el juego. |

### Gemini: el planteamiento

Gemini sirvió para pensar el proyecto antes de escribirlo: qué problema resolver, para quién, qué debía hacer la primera versión y cómo organizarla. También se escribieron con él las primeras versiones de código.

Ahí apareció su límite: a medida que la conversación acumulaba contexto (el código, los datos del juego, los cambios anteriores), el modelo empezaba a fallar y a entrar en bucles, repitiendo propuestas o deshaciendo lo que ya funcionaba. Su modo agente tampoco permitía trabajar sobre el proyecto con la autonomía necesaria.

### GitHub Copilot: la primera versión funcional

Copilot se usó dentro del editor de tres formas: el autocompletado al escribir código, el chat para dudas concretas y, sobre todo, el **modo agente**, con el que se construyó la primera versión funcional del configurador: elegir un 'Mech, equiparlo y ver sus estadísticas. Esa versión es el commit «estado funcional del mechlab antes de la refactorización».

### Claude Code: calidad y evolución

Con una versión que ya funcionaba, el siguiente paso era convertirla en un proyecto mantenible. Claude Code, integrado en VS Code, empezó por una limpieza masiva: eliminar lógica duplicada, separar la lógica pura de la interfaz, dividir el componente principal y añadir los primeros tests y el CI. A partir de ahí se encargó de todo lo demás, trabajando como un programador más del proyecto:

- El despliegue en un dominio propio con Cloudflare y la API mínima del Worker.
- Las funcionalidades pedidas por los usuarios (filtros, builds de fábrica, año de aparición, mejoras de la cantina) y las propias (compartir por enlace e imagen, builds guardadas, novedades, feedback).
- Los scripts que extraen los datos del juego y su adaptación a cada parche.
- La documentación del proyecto.

## Reparto de papeles con Claude Code

| Desarrollador | Claude Code |
|---|---|
| Decide qué se construye y en qué orden, apoyándose en feedback de los usuarios tras el primer despliegue | Propone opciones de cómo hacerlo y lo implementa |
| Exporta los datos del juego con el editor de mods | Escribe y mantiene los scripts que los convierten en JSON |
| Comprueba las cifras en el juego y aporta capturas | Convierte cada captura en un test y ajusta el cálculo hasta que coincide |
| Revisa y fusiona los pull requests | Trabaja en ramas, ejecuta lint, tests y build, prueba en el navegador y abre el pull request |
| Decide qué es un error y qué es un comportamiento intencionado | Deja esas decisiones escritas en `CLAUDE.md` para no repetir el error |

## Prácticas

### El juego es la fuente de verdad

La IA no puede abrir el juego, y los archivos exportados no siempre cuentan toda la historia. Por eso ninguna cifra se da por buena hasta compararla con el mechlab del juego. Cuando no coincide, el desarrollador aporta una captura, la IA la convierte en un test y el cálculo se corrige hasta que pasa. Así se descubrieron reglas que los archivos no dicen: los porcentajes de las mejoras se suman, el juego trunca en lugar de redondear, o los disipadores dobles de la Esfera Interior suman refrigeración al motor.

### Cambios pequeños y verificados

Cada funcionalidad o corrección va en su rama y su pull request. Antes de abrirlo, la IA ejecuta lint, tests y build, y prueba los cambios de interfaz en un Firefox sin interfaz, con capturas de pantalla. En GitHub, cada pull request pasa por el CI (lint, tests con cobertura y build) y por el análisis de seguridad de CodeQL, y Cloudflare publica una vista previa para revisarlo en el navegador antes de fusionarlo.

### Una IA escribe, otras revisan

El código que escribe Claude Code lo revisan dos asistentes distintos antes de que el desarrollador lo fusione: **CodeRabbit**, configurado en `.coderabbit.yaml` con las reglas del proyecto (lógica pura con tests, compatibilidad de los enlaces, seguridad del Worker, IDs estables de los datos), y la **revisión de pull requests de GitHub Copilot**. Cada revisor parte de un modelo diferente, así que señalan problemas que al autor le pasan desapercibidos, y sus comentarios se atienden o se responden antes de fusionar.

### El contexto vive en el repositorio, no en la conversación

El problema que apareció con Gemini (el modelo se pierde cuando la conversación acumula demasiado contexto) se evitó guardando el contexto importante en el propio repositorio: `CLAUDE.md` con las convenciones y las reglas del juego, `docs/` con el análisis y la arquitectura, y los tests como especificación de cada regla comprobada. Cualquier sesión nueva empieza leyendo esos archivos en lugar de depender de una conversación larga.

### Primero la especificación

Las funcionalidades nuevas siguen Spec Driven Development: antes del código se escribe una especificación en `docs/specs/` con los requisitos, los criterios de aceptación y el plan de pruebas. La IA convierte cada criterio en un test, que falla, y después implementa hasta que todos pasan. Los filtros por DLC y por hero ([especificación](specs/filtros-dlc-hero.md)) se hicieron así, en tres commits separados: especificación, tests e implementación. Con una IA esto es especialmente útil: la especificación fija qué hay que construir antes de que el agente empiece, y los tests comprueban que lo ha hecho.

### Las correcciones se convierten en reglas

Cuando el desarrollador corrige algo (una regla del juego, un comportamiento que no era un error, una forma de trabajar), la corrección queda escrita en `CLAUDE.md`. Por ejemplo: la IA subió dos veces commits a una rama cuyo pull request ya estaba fusionado, y desde entonces comprueba el estado del pull request antes de subir nada.

### La IA explica antes de tocar los datos

Con datos del juego, un cambio que parece pequeño puede afectar a cientos de variantes. Antes de regenerar, la IA compara los datos nuevos con los anteriores y presenta un resumen de qué cambia y por qué; las diferencias inesperadas se investigan antes de subir nada.

## Ejemplos de este proyecto

- **El tamaño de los anclajes.** El desarrollador vio en el juego que el Nightstar NSR-WP tenía cuatro anclajes de misiles grandes y la web mostraba dos medianos. La IA comprobó que el archivo del 'Mech no trae el tamaño y siguió la cadena del modelo del juego (MDA → MDL → HPS) hasta encontrarlo. Al aplicarlo cambiaron 197 variantes, y una captura del Kit Fox KFX-S confirmó la regla.
- **Un error del propio juego.** La build de fábrica del KFX-S monta un láser grande en un anclaje mediano. El desarrollador confirmó que el juego tampoco deja montarlo a mano, así que la web lo deja fuera de la build de fábrica en vez de agrandar el anclaje.
- **Las mejoras de la cantina.** Las reglas (cada mejora una vez, la I y la II combinables, porcentajes sumados) salieron de capturas del juego con el Grand Dragon y el Battlemaster, y cada una quedó como un test.
- **Un parche del juego.** Las notas del parche listaban 29 variantes con cambios de refrigeración. Al volver a exportar todos los datos, la IA comparó cada variante con su versión anterior y encontró 21 más que las notas no mencionaban, además de un cambio de formato en los archivos que confundía unas variantes con otras. Los enlaces y las builds guardadas de los usuarios siguieron funcionando.
- **Seguridad antes de publicar el código.** Antes de hacer público el repositorio, la IA revisó todo el historial en busca de claves, tokens y correos.

## Uso responsable de la IA

- **Validación humana.** Nada llega a producción sin que el desarrollador lo revise y lo fusione, y todo lo que depende del juego se comprueba en el juego. La IA propone; la decisión es siempre del desarrollador.
- **Ningún secreto en las conversaciones.** Las claves y la dirección de correo de destino viven como secretos de Cloudflare, nunca en el código ni en lo que se comparte con la IA. Antes de hacer público el repositorio se revisó todo el historial.
- **Privacidad de los usuarios.** La web no pide cuenta ni datos personales y no usa IA en tiempo de ejecución: lo que hace el jugador no sale de su navegador, salvo el feedback que decide enviar.
- **Respeto a los datos del juego.** Los datos se extraen con el editor de mods oficial y se usan para una herramienta de fans gratuita, sin publicidad y sin relación con Piranha Games. La web lo dice en su pie, y las imágenes se atribuyen a Sarna.net.
- **Transparencia.** Este documento y `CLAUDE.md` explican qué herramientas se usaron y cómo, y los commits hechos con Claude Code lo indican en su firma.

## Lo aprendido al combinar herramientas

- **Cada herramienta tiene su momento.** Un chat generalista es útil para pensar el problema; un agente en el editor acelera la primera versión; un agente con acceso al repositorio, a la terminal y al navegador es lo que permite mantener la calidad cuando el proyecto crece.
- **El contexto es el recurso limitado.** Las herramientas fallaban cuando dependían de una conversación cada vez más larga. Escribir el contexto en archivos del repositorio lo resolvió.
- **La IA necesita una forma de comprobar su trabajo.** Los tests, el CI y, sobre todo, las capturas del juego son lo que convierte una propuesta plausible en una cifra correcta.

## Límites

- La IA no juega: todo lo que depende de cómo se comporta el juego se ha comprobado a mano en él.
- Algunas cifras siguen sin verificar, y están marcadas como tales (por ejemplo, el efecto de algunas mejoras, como las de cooldown o capacidad de calor). Quedan pendientes de una captura del juego.
- Las decisiones de producto (qué construir, qué es un error, qué se publica) las ha tomado siempre el desarrollador.
