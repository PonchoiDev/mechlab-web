# Especificación: inventario del MechLab de BATTLETECH

- **Issue:** [#147](https://github.com/PonchoiDev/mechlab-web/issues/147)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/inventory.test.ts`) y por último el código, en commits separados.

## Contexto

El MechLab de MW5 sustituyó su panel de componente por un inventario ([inventario.md](inventario.md)). Los dos MechLabs se mantienen coherentes, así que el de BATTLETECH hace lo mismo con las reglas de su juego ([battletech-mechlab.md](battletech-mechlab.md)):

- Todo ocupa ranuras, también las armas, y solo las armas necesitan además un anclaje libre de su tipo (balístico, energía, misiles o apoyo). Los anclajes no tienen tamaño.
- Hay equipo fijo del chasis, que no se puede mover ni quitar, y objetos de serie (`builtIn`) que no se pueden montar.
- Los anclajes no están numerados en el juego: las armas de cada tipo ocupan los suyos por orden de montaje (`getHardpointViews`).

## Requisitos funcionales

Los mismos que el inventario de MW5, con estas diferencias:

- **RF1.** Un botón **Inventory** en la fila de opciones de vista abre y cierra el inventario, un panel lateral fijo de 520 px en el lado elegido con el botón ⇄. Desaparece el panel de ubicación (`BtComponentEditor`): la armadura se ajusta en las tarjetas, y el resto de acciones están en el menú del clic derecho del tablero.
- **RF2.** Lista todos los objetos que se pueden montar (no los de serie de algunos chasis), con pestañas All, Energy, Ballistic, Missile, Support, Equipment (disipadores, retrorreactores y mejoras) y Ammo, cada una con su número. Las cuatro de armas llevan el icono de anclaje del juego que ya usan las tarjetas, en el color de su tipo.
- **RF3.** Buscador (por nombre y fabricante) y la casilla **Fits this 'Mech**, marcada por defecto. No hay filtros de versión, fuente ni rareza, igual que en MW5 se quitó el de tecnología: la tabla y el buscador bastan. Cabe:
  - un arma, si alguna ubicación tiene un anclaje de su tipo y ranuras para ella, contando con que el arma del anclaje se puede reemplazar;
  - el resto, si cabe en alguna ubicación (ranuras, ubicaciones permitidas, tonelaje de los retrorreactores y su máximo);
  - la munición, además, si alguna arma montada la usa.
- **RF4.** La tabla tiene las columnas de BATTLETECH: nombre, ranuras, toneladas, daño, inestabilidad, calor y alcance máximo, cada una con su color como en MW5. El daño de un arma de varios disparos es el de la ráfaga, con los disparos al lado (`50 ×2`). Las columnas ordenan la lista, con lo que no tiene el dato al final. El equipo y la munición dicen en el hueco de las cifras de arma lo propio de cada uno: la munición, sus disparos; los disipadores, cuánto disipan; los retrorreactores, sus tonelajes.
- **RF5.** Pulsar una ubicación o un anclaje abre el inventario apuntando a él, con lo instalado (también el equipo fijo, marcado BUILT-IN) y un botón para quitar lo montado. La casilla pasa a **Fits Left arm** y la pestaña vuelve a All. Qué cabe:
  - en una ubicación, lo que se puede montar en ella ahora;
  - en un anclaje, las armas de su tipo que caben; si está ocupado, las que caben quitando la que tiene, como reemplazo.
- **RF6.** Pulsar una fila equipa en el destino; en un anclaje libre, pasa al siguiente libre de la ubicación. Sin destino, pulsar una fila la elige para colocarla pulsando el tablero.
- **RF7.** Arrastrar desde el inventario a una ubicación o a un anclaje; arrastrar las armas y el equipo montados (no el fijo) a otra ubicación o anclaje para moverlos, o fuera de las tarjetas para desequiparlos; el clic central los desequipa.
- **RF8.** El clic derecho en una fila equipa en el destino, o si no lo hay, en la primera ubicación donde cabe en el orden del tablero (cabeza, torso central, torsos laterales, brazos y piernas), y avisa de dónde.
- **RF9.** Reemplazar y desequipar avisan con Undo, como en MW5.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/inventory.ts`, con sus tests. Usa las reglas de `fitting.ts` y `actions.ts`, sin copiarlas.
- **RNF2.** Los estilos son los del inventario de MW5; solo cambian las columnas.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

Con la build de serie del Hunchback HBK-4G: un S Laser en el anclaje de apoyo de la cabeza (1 ranura), un M Laser en el anclaje de energía de cada brazo, un AC/20 (4 ranuras) en el primero de los tres anclajes balísticos del torso derecho, dos cajas de munición de AC/20 en el torso izquierdo y disipadores en las piernas.

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo | se cuenta por pestaña | All tiene todos los objetos que se pueden montar, ninguno de serie; las pestañas de armas suman las armas, y Equipment y Ammo el resto |
| CA2 | El HBK-4G y Fits this 'Mech | se filtra | están el M Laser (reemplazando uno de los brazos), el AC/20 (en el torso derecho), la munición de AC/20 y el disipador; no están el LRM5 (sin anclajes de misiles) ni la munición de LRM |
| CA3 | El brazo izquierdo como destino | se filtra | está el disipador; no está el M Laser (su anclaje está ocupado) |
| CA4 | El anclaje de energía del brazo izquierdo como destino | se filtra | está el L Laser, como reemplazo; no están el S Laser (es de apoyo) ni el disipador |
| CA5 | Un M Laser | se calculan los destinos | los anclajes de los brazos son destino, pero no las ubicaciones (sin anclajes de energía libres); el torso derecho no es destino |
| CA6 | Un L Laser soltado en el anclaje del brazo izquierdo | se coloca | reemplaza el M Laser y avisa `Replaced M Laser with L Laser in Left arm`, marcado como reemplazo |
| CA7 | Un disipador soltado en la cabeza | se coloca | no cambia nada y avisa `Not enough free slots in the head` |
| CA8 | El M Laser del brazo izquierdo arrastrado al anclaje del brazo derecho | se suelta | reemplaza el del brazo derecho y el izquierdo queda vacío |
| CA9 | El M Laser del brazo izquierdo | se desequipa | el brazo queda vacío y avisa `Removed M Laser from Left arm` |
| CA10 | El clic derecho en una caja de munición de AC/20 y en un M Laser | se equipa donde cabe | la caja va al torso central y avisa `Added AC/20 Ammo to Center torso`; el M Laser no cabe y avisa `No room for M Laser in this 'Mech` |
| CA11 | El torso derecho tras montar un arma en su segundo anclaje | se busca el siguiente destino | es el tercero |
| CA12 | El orden por daño | se ordena hacia abajo | el primero es el arma de más daño por ráfaga; el equipo va al final |
