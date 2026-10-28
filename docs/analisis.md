# Análisis

## El problema

*MechWarrior 5: Mercenaries* tiene su propio mechlab, pero solo se puede usar dentro de una partida y con los 'Mechs que el jugador ya tiene en el hangar. Eso deja fuera tres cosas que los jugadores hacen a menudo:

- **Planificar** la build de un chasis que todavía no tienen, para decidir si les compensa comprarlo.
- **Compartir** una build con otros jugadores, algo que hoy se hace con capturas de pantalla.
- **Consultar** los datos de cada variante (anclajes, tamaño de cada anclaje, año de aparición, mejoras), que están repartidos entre wikis, foros y el propio juego.

## Usuarios

Jugadores de *MechWarrior 5: Mercenaries*, sobre todo los que se mueven en la comunidad del juego (r/Mechwarrior5), que es donde se publicó la web. Usan el navegador, a veces desde el móvil mientras juegan, y no quieren registrarse para probar una herramienta.

## Alcance

- **Dentro:** *MechWarrior 5: Mercenaries* con todos sus DLC: las 639 variantes jugables, sus armas, equipo, munición y mejoras de la cantina.
- **Fuera:** *MechWarrior 5: Clans*. Sus reglas son distintas (por ejemplo, en Clans las armas ocupan ranuras y en Mercenaries solo un anclaje). El dominio está preparado para añadirlo más adelante en su propia ruta.
- **Fuera:** variantes no jugables (campaña, tutorial, jefes y cinemáticas).

## Requisitos funcionales

| Requisito | Estado |
|---|---|
| Elegir cualquier variante jugable y buscarla por nombre, variante o ID | Hecho |
| Equipar armas y equipo con las reglas del juego: tipo y tamaño de cada anclaje, ranuras generales y especiales, tiers de armas | Hecho |
| Repartir la armadura delantera y trasera, vaciarla o maximizarla con el tonelaje libre | Hecho |
| Ver al momento tonelaje, armadura, daño, calor, refrigeración, velocidad y alcance | Hecho |
| Avisar de lo que falta en la build: anclajes libres, armas sin munición, armadura incompleta, sobrepeso | Hecho |
| Cargar la build de fábrica de cada variante | Hecho (pedido en Reddit) |
| Filtrar chasis por clase, tecnología, anclajes, jump jets, ECM y AMS | Hecho (pedido en Reddit) |
| Año de aparición de cada variante y filtro por año de campaña | Hecho (pedido en Reddit) |
| Mejoras de la cantina con su efecto en las estadísticas | Hecho (pedido en Reddit) |
| Estadísticas detalladas por arma y del chasis | Hecho |
| Guardar builds en el navegador, exportarlas e importarlas | Hecho |
| Compartir una build con un enlace y como imagen | Hecho |
| Recibir errores e ideas de los usuarios | Hecho (formulario de feedback) |
| Filtro por DLC | Pendiente: los datos ya están en las fichas de unidad |
| Aceleración y mejoras de saltos con números | Pendiente: faltan datos o calibración |
| Rasgos de piloto | Pendiente: los archivos ya están exportados |
| Compatibilidad con el mod YAML | Descartado por ahora |

## Requisitos no funcionales

- **Sin registro ni servidor de datos:** la web se usa sin cuenta. Las builds se guardan en el navegador o viajan en el enlace.
- **Fidelidad al juego:** las cifras tienen que coincidir con las del mechlab del juego. Cada vez que una no cuadra, se comprueba con una captura y se convierte en un test.
- **Datos reproducibles:** los datos salen de los archivos del juego con scripts, para poder actualizarlos con cada parche sin teclear nada a mano.
- **Compatibilidad hacia atrás:** un enlace o una build guardada tiene que seguir abriéndose después de cambiar el formato o los datos.
- **Rápida y barata de mantener:** web estática con una API mínima, sin coste de servidor.
- **Privacidad:** no se piden datos personales; el correo del desarrollador no aparece en la web ni en el código.
- **Usable en móvil.**

## Decisiones de comportamiento

Algunas cosas que podrían parecer errores son intencionadas:

- Se puede equipar por encima del tonelaje máximo, para planificar primero y ajustar después. La web avisa del sobrepeso.
- Algunos chasis (CDA-2A, CDA-2B, CGR-1A1) empiezan con sobrepeso con la armadura por defecto: es así en el juego.
- Si una build de fábrica trae un arma más grande que su anclaje (el Clan Large Pulse Laser del KFX-S), se deja fuera, porque el juego tampoco permite montarla a mano.

## Cómo evolucionaron los requisitos

La primera versión cubría el configurador básico. Tras publicarla en r/Mechwarrior5, los comentarios de los jugadores se convirtieron en el backlog, en este orden: filtros y resumen de anclajes en el selector, builds de fábrica, año de aparición y mejoras de la cantina. Cada uno se cerró con su pull request y se anunció en la campana de novedades de la web (`src/data/changelog.ts`).
