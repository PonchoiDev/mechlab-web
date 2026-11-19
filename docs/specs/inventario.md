# Especificación: inventario del MechLab

- **Issue:** [#144](https://github.com/PonchoiDev/mechlab-web/issues/144)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/inventory.test.ts` y `src/utils/viewPreferences.test.ts`) y por último el código, en commits separados.

## Contexto

En el MechLab se equipa desde el panel de cada componente: se elige el componente (o uno de sus anclajes) y el panel enseña solo lo que cabe en él. Es cómodo para rellenar un componente, pero no para lo que hace el inventario del mechlab del juego: ver todo el arsenal a la vez, comparar armas de distintos tipos y colocar una en cualquier parte del 'Mech arrastrándola.

El inventario sustituye al panel de componente: hacía lo mismo para un solo componente, y tener los dos era redundante. Al elegir un componente o un anclaje, el inventario apunta a él y equipa ahí.

## Decisiones

- **Una fila por objeto.** El juego tiene una fila por tier de cada arma (seis filas para el AC/10). Aquí hay una sola, y el tier se elige en la fila seleccionada con el mismo selector del panel de componente. El arma se coloca con ese tier, y una vez montada se sube o se baja como ahora.
- **Panel lateral fijo y único.** El inventario ocupa una columna y estrecha el tablero, sin taparlo, para poder soltar en cualquier componente. Va en el lado elegido con el botón de cambiar de lado. En el móvil es una hoja inferior baja, que deja el tablero a la vista.
- **Sin panel de componente.** Lo que hacía lo hacen ahora el inventario (equipar, los tiers y quitar lo instalado), las tarjetas (la armadura) y el menú del clic derecho del tablero (los tiers y el resto de acciones).
- **Dos formas de colocar.** Arrastrar con el ratón, o pulsar el objeto y después el destino. La segunda es la que funciona en pantallas táctiles, donde el arrastre de HTML no existe, y con el teclado.
- **Soltar sobre un anclaje ocupado reemplaza** el arma sin preguntar, y el aviso permite deshacerlo.
- **Soltar sobre el componente** usa el primer anclaje libre que encaje (el más pequeño, como al equipar desde el panel) o una ranura libre. No reemplaza: para eso se suelta sobre el anclaje.

## Requisitos funcionales

- **RF1.** Un botón **Inventory** en la fila de opciones de vista abre y cierra el inventario. El MechLab recuerda si estaba abierto.
- **RF2.** El inventario lista todas las armas, el equipo y la munición del juego, con pestañas por categoría: All, Energy, Ballistic, Missile, Artillery, AMS, Melee, Equipment y Ammo, cada una con su número de objetos. Las pestañas de armas y equipo llevan el icono de la pestaña del inventario del juego (`tools/extraer_iconos_inventario.py` los saca del .pak) en el color de su tipo; All y Ammo, que no tienen icono en el juego, van con texto. Están justo encima de la lista, debajo del buscador y los filtros.
- **RF3.** Filtros: buscador (por nombre corto o completo, como el panel de componente; el prefijo «C-» ya distingue las armas Clan, así que no hay filtro de tecnología), tamaño (Small, Medium, Large) y una casilla **Fits this 'Mech**, marcada por defecto, que deja solo lo que se puede colocar en el 'Mech actual:
  - un arma, si algún anclaje del 'Mech la admite, esté libre u ocupado;
  - el equipo, si algún componente tiene sitio;
  - la munición, si algún componente tiene sitio y algún arma montada la usa, como en el panel de componente.
- **RF4.** Orden por nombre, tamaño, toneladas, daño, calor, RPM o alcance; pulsar el mismo orden otra vez lo invierte. Lo que no tiene ese dato (el daño del equipo) va al final.
- **RF5.** La lista es una tabla, como la del inventario del juego: una fila por objeto con nombre, tamaño (S, M, L), toneladas, daño, calor, RPM y alcance en columnas alineadas, y una cabecera cuyas columnas ordenan la lista. El equipo y la munición dicen sus ranuras junto al nombre y no tienen cifras de arma. El panel mide 520 px de ancho para que quepan.
- **RF6.** Al arrastrar un objeto, el tablero resalta los anclajes que lo admiten (los ocupados, como reemplazo) y los componentes donde se puede soltar, y atenúa el resto. Soltarlo lo coloca.
- **RF7.** Sin un componente elegido, pulsar una fila la selecciona: el tablero se resalta como al arrastrar, y pulsar un anclaje o un componente coloca el objeto. La selección sigue después de colocar, para poner varios seguidos, y se quita pulsando la fila otra vez, con Escape o cerrando el inventario. Mientras hay un objeto seleccionado, pulsar un componente coloca en vez de abrir su panel.
- **RF8.** La fila seleccionada de un arma con tiers muestra el selector de tier y sus cifras con ese tier; el arma se coloca con él.
- **RF9.** Soltar un arma sobre un anclaje la monta en él; si estaba ocupado, reemplaza la que había. Un reemplazo avisa con `Replaced <arma> with <arma> in <componente>` y un botón **Undo** que devuelve la build a como estaba.
- **RF10.** Soltar sobre un destino que no admite el objeto no cambia la build y avisa del motivo.
- **RF11.** Las armas montadas en sus anclajes y el equipo y la munición de las tarjetas también se pueden arrastrar, con el inventario abierto o cerrado. Al arrastrar uno, el tablero resalta dónde puede ir contando con que su sitio queda libre:
  - soltarlo en otro anclaje o componente que lo admite lo mueve allí, con su tier;
  - soltarlo sobre un anclaje ocupado reemplaza el arma de ese anclaje, como desde el inventario;
  - soltarlo fuera de las tarjetas del tablero (en el inventario, en el fondo…) lo desequipa;
  - soltarlo en una tarjeta que no lo admite no cambia nada y avisa del motivo.
- **RF12.** El clic central (la rueda del ratón) sobre un arma montada o sobre un objeto de una tarjeta lo desequipa. En una pieza agrupada (`Heat Sink ×3`) quita una.
- **RF13.** Desequipar arrastrando o con el clic central avisa con `Removed <objeto> from <componente>` y el botón **Undo**, como el reemplazo.
- **RF14.** El clic derecho en una fila del inventario equipa el objeto en el lugar adecuado, sin elegir destino, y avisa de dónde lo ha puesto:
  - un arma, en el anclaje libre más pequeño que la admite de todo el 'Mech (como al equipar en un componente), recorriendo los componentes en el orden del tablero: cabeza, torso central, torsos laterales, brazos y piernas;
  - el equipo y la munición, primero en una ranura especial que los admite (los disipadores, en las del motor; los jump jets, en las suyas) y si no en la primera ranura general libre, en el mismo orden.
- **RF16.** Pulsar un componente o un anclaje del tablero, un aviso de la barra de avisos o «Choose weapon…» del menú del clic derecho abre el inventario apuntando a ese destino:
  - la cabecera dice el destino (`Left arm` o `Left arm · Energy · Medium`) con un botón para quitarlo;
  - la casilla pasa a **Fits Left arm** y se marca, y la pestaña vuelve a All: la que se usó para el destino anterior (la munición de otro componente) puede dejar la lista vacía;
  - pulsar una fila, o hacer clic derecho en ella, la equipa en el destino. En un anclaje ocupado, reemplaza su arma, con Undo;
  - tras equipar un arma en un anclaje, el destino pasa al siguiente anclaje libre del componente, para rellenarlos seguidos.
- **RF17.** Con un destino, el inventario muestra lo instalado en su componente, con el selector de tier de cada arma y un botón para quitar cada objeto.
- **RF18.** El destino se quita con su botón, con Escape o pulsando en una zona vacía de la página. Sin destino, la casilla vuelve a ser Fits this 'Mech.
- **RF19.** Qué cabe en el destino:
  - en un componente, un arma si tiene un anclaje libre que la admite; el equipo, si hay sitio; la munición, si hay sitio y alguna arma montada la usa;
  - en un anclaje, solo las armas que lo admiten, esté libre u ocupado (como reemplazo). El equipo y la munición no van en anclajes: se equipan apuntando al componente.
- **RF20.** Cada tarjeta del tablero muestra, bajo su título, sus anclajes por tipo con el icono del juego y cuántos están ocupados («1/2» y el icono de energía), como el MechLab de BATTLETECH, para ver de un vistazo qué cabe en cada componente. Solo salen los tipos que tiene el componente, en el orden de las pestañas del inventario (energía, balístico, misiles, artillería, AMS, cuerpo a cuerpo y omni); un componente sin anclajes no muestra nada.
- **RF15.** El inventario también ordena por calor y por disparos por minuto (RPM), y cada arma muestra sus RPM junto al daño, el calor y el alcance, como las columnas del inventario del juego.

## Requisitos no funcionales

- **RNF1.** La lógica (categorías, filtros, orden, destinos válidos y colocación) es pura y está en `src/utils/inventory.ts`, con sus tests. Reutiliza las reglas de `equipment.ts` y `buildActions.ts`, sin duplicarlas.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** El panel de componente desaparece sin perder nada de lo que hacía (ver Decisiones).

## Criterios de aceptación

Con el Archer ARC-2R: brazos con un anclaje de energía M y uno cuerpo a cuerpo M, torsos laterales con un anclaje de misiles L, torso central con dos de energía M y una ranura de disipador del motor, y ningún anclaje balístico ni ranura de jump jets.

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo | se cuenta por categoría | All tiene todos los objetos; Energy, Ballistic, Missile, Artillery, AMS y Melee suman las armas, y Equipment y Ammo el resto |
| CA2 | El ARC-2R vacío y Fits this 'Mech | se filtra | están el Medium Laser, el LRM 20, el Double Heat Sink y el Knuckles de clase pesada; no están el AC/10, los jump jets ni el Knuckles de clase ligera; la munición de LRM no está |
| CA3 | El ARC-2R con un LRM 20 montado | se filtra la munición | está la de LRM; sin la casilla están todas |
| CA4 | Búsqueda «ac10» y tamaño Large | se filtra sin la casilla | «ac10» encuentra el AC/10 y todo lo Large es grande |
| CA5 | El orden por daño | se ordena hacia abajo y hacia arriba | el primero de las armas es el de más daño, o el de menos al invertir; el equipo va al final en los dos casos |
| CA6 | Un Medium Laser y el ARC-2R con el brazo izquierdo ocupado por otro | se calculan los destinos | los anclajes de energía de los brazos y del torso central son destinos (el ocupado, como reemplazo); el brazo izquierdo no admite soltar en el componente y el derecho sí; los torsos laterales y las piernas no son destino |
| CA7 | Un Double Heat Sink (3 ranuras) | se calculan los destinos | son destino los torsos laterales y los brazos, y el torso central por su ranura de disipador del motor; la cabeza (1 ranura) y las piernas (2) no; ningún anclaje lo es |
| CA8 | Un Medium Laser de tier 3 soltado en el brazo derecho | se coloca | queda montado en el anclaje de energía con tier 3 |
| CA9 | Un Large Laser soltado en el anclaje ocupado del brazo izquierdo | se coloca | no cabe (es grande y el anclaje mediano): la build no cambia y el aviso lo dice |
| CA10 | Un Small Laser soltado en el anclaje del brazo izquierdo con un Medium Laser | se coloca | lo reemplaza y avisa `Replaced M Laser with S Laser in Left arm`, marcado como reemplazo |
| CA11 | Un AC/10 soltado en el brazo derecho, o un Double Heat Sink en la cabeza | se coloca | la build no cambia y el aviso dice el motivo |
| CA12 | Un Double Heat Sink soltado en el torso izquierdo | se coloca | queda en una ranura general y avisa `Added Double Heat Sink to Left torso` |
| CA13 | Las preferencias guardadas sin el inventario | se leen | el inventario está cerrado; guardado abierto, se lee abierto |
| CA14 | El orden por calor y por RPM | se ordena hacia abajo | el primero es el arma de más calor, o de más RPM; el equipo va al final |
| CA15 | Un Medium Laser montado en el brazo izquierdo | se desequipa | el brazo queda vacío y avisa `Removed M Laser from Left arm` |
| CA16 | Un Medium Laser de tier 3 montado en el brazo izquierdo | se calculan sus destinos y se arrastra al brazo derecho | su propio anclaje es destino; queda en el brazo derecho con tier 3 y el izquierdo vacío |
| CA17 | Un Medium Laser del brazo izquierdo arrastrado al anclaje ocupado del brazo derecho | se suelta | reemplaza el arma del brazo derecho, marcado como reemplazo, y el izquierdo queda vacío |
| CA18 | Un Medium Laser arrastrado a una pierna | se suelta | la build no cambia y el aviso dice el motivo |
| CA19 | El ARC-2R vacío y el clic derecho | se equipa en el lugar adecuado | el Medium Laser va al torso central; el LRM 20 al torso izquierdo; el Double Heat Sink a la ranura de disipador del motor del torso central, y el segundo a una ranura general del torso izquierdo |
| CA21 | El ARC-2R con un Medium Laser en el brazo izquierdo y el brazo izquierdo como destino | se filtra con la casilla | están el Knuckles de clase pesada (anclaje cuerpo a cuerpo libre) y el Double Heat Sink; no están el Small Laser (el de energía está ocupado) ni el LRM 20 |
| CA22 | El mismo 'Mech con el anclaje de energía del brazo izquierdo como destino | se filtra con la casilla | está el Small Laser (como reemplazo); no están el LRM 20, el Knuckles ni el Double Heat Sink |
| CA23 | Un arma recién equipada en un anclaje | se busca el siguiente destino | en el torso central vacío, tras el anclaje 0 va el 1; con los dos ocupados, ninguno; en el brazo, tras el de energía va el cuerpo a cuerpo libre |
| CA24 | El ARC-2R con un Medium Laser en el brazo izquierdo | se resumen los anclajes de cada componente | el brazo izquierdo tiene energía 1/1 y cuerpo a cuerpo 0/1; el torso central, energía 0/2; las piernas, nada |
| CA20 | Un AC/10 en el ARC-2R y el clic derecho | se equipa en el lugar adecuado | la build no cambia y avisa `No room for AC/10 in this 'Mech` |
