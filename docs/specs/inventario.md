# Especificación: inventario del MechLab

- **Issue:** [#144](https://github.com/PonchoiDev/mechlab-web/issues/144)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/inventory.test.ts` y `src/utils/viewPreferences.test.ts`) y por último el código, en commits separados.

## Contexto

En el MechLab se equipa desde el panel de cada componente: se elige el componente (o uno de sus anclajes) y el panel enseña solo lo que cabe en él. Es cómodo para rellenar un componente, pero no para lo que hace el inventario del mechlab del juego: ver todo el arsenal a la vez, comparar armas de distintos tipos y colocar una en cualquier parte del 'Mech arrastrándola.

El inventario complementa al panel de componente, que no cambia.

## Decisiones

- **Una fila por objeto.** El juego tiene una fila por tier de cada arma (seis filas para el AC/10). Aquí hay una sola, y el tier se elige en la fila seleccionada con el mismo selector del panel de componente. El arma se coloca con ese tier, y una vez montada se sube o se baja como ahora.
- **Panel lateral fijo.** El inventario ocupa una columna y estrecha el tablero, sin taparlo, para poder soltar en cualquier componente. Va en el lado contrario al panel de componente, así que los dos pueden estar abiertos a la vez; el botón de cambiar de lado los intercambia. En el móvil es una hoja inferior baja, que deja el tablero a la vista.
- **Dos formas de colocar.** Arrastrar con el ratón, o pulsar el objeto y después el destino. La segunda es la que funciona en pantallas táctiles, donde el arrastre de HTML no existe, y con el teclado.
- **Soltar sobre un anclaje ocupado reemplaza** el arma sin preguntar, y el aviso permite deshacerlo.
- **Soltar sobre el componente** usa el primer anclaje libre que encaje (el más pequeño, como al equipar desde el panel) o una ranura libre. No reemplaza: para eso se suelta sobre el anclaje.

## Requisitos funcionales

- **RF1.** Un botón **Inventory** en la fila de opciones de vista abre y cierra el inventario. El MechLab recuerda si estaba abierto.
- **RF2.** El inventario lista todas las armas, el equipo y la munición del juego, con pestañas por categoría: All, Energy, Ballistic, Missile, Artillery, AMS, Melee, Equipment y Ammo, cada una con su número de objetos.
- **RF3.** Filtros: buscador (por nombre corto o completo, como el panel de componente), tecnología (Inner Sphere, Clan, LosTech…), tamaño (Small, Medium, Large) y una casilla **Fits this 'Mech**, marcada por defecto, que deja solo lo que se puede colocar en el 'Mech actual:
  - un arma, si algún anclaje del 'Mech la admite, esté libre u ocupado;
  - el equipo, si algún componente tiene sitio;
  - la munición, si algún componente tiene sitio y algún arma montada la usa, como en el panel de componente.
- **RF4.** Orden por nombre, tamaño, toneladas, daño o alcance; pulsar el mismo orden otra vez lo invierte. Lo que no tiene ese dato (el daño del equipo) va al final.
- **RF5.** Cada fila muestra el nombre, el tamaño y las toneladas; las armas, además, su daño, calor y alcance, y el equipo y la munición sus ranuras.
- **RF6.** Al arrastrar un objeto, el tablero resalta los anclajes que lo admiten (los ocupados, como reemplazo) y los componentes donde se puede soltar, y atenúa el resto. Soltarlo lo coloca.
- **RF7.** Pulsar una fila la selecciona: el tablero se resalta como al arrastrar, y pulsar un anclaje o un componente coloca el objeto. La selección sigue después de colocar, para poner varios seguidos, y se quita pulsando la fila otra vez, con Escape o cerrando el inventario. Mientras hay un objeto seleccionado, pulsar un componente coloca en vez de abrir su panel.
- **RF8.** La fila seleccionada de un arma con tiers muestra el selector de tier y sus cifras con ese tier; el arma se coloca con él.
- **RF9.** Soltar un arma sobre un anclaje la monta en él; si estaba ocupado, reemplaza la que había. Un reemplazo avisa con `Replaced <arma> with <arma> in <componente>` y un botón **Undo** que devuelve la build a como estaba.
- **RF10.** Soltar sobre un destino que no admite el objeto no cambia la build y avisa del motivo.

## Requisitos no funcionales

- **RNF1.** La lógica (categorías, filtros, orden, destinos válidos y colocación) es pura y está en `src/utils/inventory.ts`, con sus tests. Reutiliza las reglas de `equipment.ts` y `buildActions.ts`, sin duplicarlas.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** El panel de componente sigue funcionando igual, y no se cierra al pulsar dentro del inventario.

## Criterios de aceptación

Con el Archer ARC-2R: brazos con un anclaje de energía M y uno cuerpo a cuerpo M, torsos laterales con un anclaje de misiles L, torso central con dos de energía M y una ranura de disipador del motor, y ningún anclaje balístico ni ranura de jump jets.

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo | se cuenta por categoría | All tiene todos los objetos; Energy, Ballistic, Missile, Artillery, AMS y Melee suman las armas, y Equipment y Ammo el resto |
| CA2 | El ARC-2R vacío y Fits this 'Mech | se filtra | están el Medium Laser, el LRM 20, el Double Heat Sink y el Knuckles de clase pesada; no están el AC/10, los jump jets ni el Knuckles de clase ligera; la munición de LRM no está |
| CA3 | El ARC-2R con un LRM 20 montado | se filtra la munición | está la de LRM; sin la casilla están todas |
| CA4 | Búsqueda «ac10», tecnología Clan y tamaño Large | se filtra sin la casilla | «ac10» encuentra el AC/10; todo lo de Clan es Clan y todo lo Large es grande |
| CA5 | El orden por daño | se ordena hacia abajo y hacia arriba | el primero de las armas es el de más daño, o el de menos al invertir; el equipo va al final en los dos casos |
| CA6 | Un Medium Laser y el ARC-2R con el brazo izquierdo ocupado por otro | se calculan los destinos | los anclajes de energía de los brazos y del torso central son destinos (el ocupado, como reemplazo); el brazo izquierdo no admite soltar en el componente y el derecho sí; los torsos laterales y las piernas no son destino |
| CA7 | Un Double Heat Sink (3 ranuras) | se calculan los destinos | son destino los torsos laterales y los brazos, y el torso central por su ranura de disipador del motor; la cabeza (1 ranura) y las piernas (2) no; ningún anclaje lo es |
| CA8 | Un Medium Laser de tier 3 soltado en el brazo derecho | se coloca | queda montado en el anclaje de energía con tier 3 |
| CA9 | Un Large Laser soltado en el anclaje ocupado del brazo izquierdo | se coloca | no cabe (es grande y el anclaje mediano): la build no cambia y el aviso lo dice |
| CA10 | Un Small Laser soltado en el anclaje del brazo izquierdo con un Medium Laser | se coloca | lo reemplaza y avisa `Replaced M Laser with S Laser in Left arm`, marcado como reemplazo |
| CA11 | Un AC/10 soltado en el brazo derecho, o un Double Heat Sink en la cabeza | se coloca | la build no cambia y el aviso dice el motivo |
| CA12 | Un Double Heat Sink soltado en el torso izquierdo | se coloca | queda en una ranura general y avisa `Added Double Heat Sink to Left torso` |
| CA13 | Las preferencias guardadas sin el inventario | se leen | el inventario está cerrado; guardado abierto, se lee abierto |
