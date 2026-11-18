# Especificación: buscar, ordenar y filtrar las builds guardadas

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/savedBuildsList.test.ts`) y por último el código, en commits separados.

## Contexto

La ventana **My builds** de los dos MechLabs (MW5 y BATTLETECH) enseña las builds guardadas en el orden en que se guardaron, sin buscador ni filtros. Con muchas builds, encontrar una es tedioso: hay que recorrer la lista entera. La ventana ya reconstruye cada build para enseñar su 'Mech y sus cifras, así que tiene lo necesario para buscar, ordenar y filtrar.

## Requisitos funcionales

- **RF1.** Encima de la lista, un buscador que mira el nombre de la build, el chasis y la variante. Cada palabra tiene que estar en alguno de ellos, sin distinguir mayúsculas ni tildes: «atlas brawl» encuentra la build «Brawler» de un Atlas.
- **RF2.** Un selector de orden:
  - **Newest** (por defecto) y **Oldest**, por la fecha de guardado;
  - **Name**, de la A a la Z;
  - **Chassis**, de la A a la Z y, dentro de cada chasis, por variante;
  - **Tonnage** y **Firepower**, de mayor a menor.

  A igualdad, por nombre. Las builds que ya no se pueden abrir van al final en los órdenes por chasis, tonelaje y potencia de fuego.
- **RF3.** Un filtro por clase de peso (Light, Medium, Heavy y Assault), con las builds de cada clase al lado. Se pueden marcar varias; sin ninguna marcada, todas. Las builds que ya no se pueden abrir solo salen sin filtro de clase.
- **RF3b.** Un filtro de anclajes mínimos como el del selector de 'Mechs, con un contador por tipo: en MW5, Energy, Ballistic, Missile y Omni, y los omni cuentan como comodín de energía, balística y misiles (un 'Mech con 1E y 2 omni cumple «al menos 3E»; cada omni cuenta una vez); en BATTLETECH, Energy, Ballistic, Missile y Support. Mira los anclajes del 'Mech de la build, no las armas que lleva. Las builds que ya no se pueden abrir no salen con un mínimo puesto.
- **RF4.** El recuento dice cuántas se ven de cuántas hay («7 of 42 saved») cuando el buscador o el filtro esconden alguna, y si no queda ninguna, la lista lo dice y ofrece quitar los filtros.
- **RF5.** El orden elegido se recuerda en el navegador, por separado en cada juego; el buscador y el filtro empiezan vacíos cada vez que se abre la ventana.
- **RF6.** Todo lo demás de la ventana sigue igual: cargar, duplicar (la copia se ve aunque el filtro la escondería, para que se pueda renombrar), renombrar, copiar el enlace, borrar, importar y exportar todas.
- **RF7.** Igual en el MechLab de MW5 y en el de BATTLETECH.

## Requisitos no funcionales

- **RNF1.** La lógica es pura, común a los dos juegos y está en `src/utils/savedBuildsList.ts`, con sus tests: recibe cada build ya resumida (nombre, fecha, chasis, variante, clase, tonelaje y potencia de fuego) y no carga los datos de ningún juego.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

Con estas builds (la última, de un 'Mech que ya no existe). Los anclajes de sus 'Mechs están en CA9:

| Nombre | Guardada | Chasis | Variante | Clase | Tonelaje | Potencia |
|---|---|---|---|---|---|---|
| Brawler | 3 nov | Atlas | AS7-D | assault | 100 | 80 |
| LRM boat | 5 nov | Catapult | CPLT-C1 | heavy | 65 | 60 |
| Sniper | 1 nov | Atlas | AS7-K | assault | 99.5 | 70 |
| Scout | 4 nov | Locust | LCT-1V | light | 20 | 15 |
| Old one | 2 nov | (no se puede abrir) | | | | |

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las builds | se ordenan por Newest / Oldest | LRM boat, Scout, Brawler, Old one, Sniper / Sniper, Old one, Brawler, Scout, LRM boat |
| CA2 | Las builds | se ordenan por Name | Brawler, LRM boat, Old one, Scout, Sniper |
| CA3 | Las builds | se ordenan por Chassis | Brawler (AS7-D), Sniper (AS7-K), LRM boat, Scout y al final Old one |
| CA4 | Las builds | se ordenan por Tonnage / Firepower | Brawler, Sniper, LRM boat, Scout, Old one / Brawler, Sniper, LRM boat, Scout, Old one |
| CA5 | Las builds | se busca «atlas» / «ATLÁS brawl» / «cplt» / «nada» | Brawler y Sniper / Brawler / LRM boat / ninguna |
| CA6 | Las builds | se filtra por assault / por light y heavy | Brawler y Sniper / LRM boat y Scout; con el filtro, Old one no sale |
| CA7 | Las builds | se cuentan por clase | 1 light, 0 medium, 1 heavy y 2 assault |
| CA9 | Las builds, con los anclajes de sus 'Mechs: Brawler y Sniper 4E 1B 1M, LRM boat 4E 2M y Scout 1E 2B | se pide al menos 2B / al menos 3E y 1B / al menos 1M | Scout / Brawler y Sniper / Brawler, LRM boat y Sniper; Old one no sale con ningún mínimo |
| CA10 | Un 'Mech con 1E y 2 omni | se comparan sus anclajes con los mínimos | cumple 3E, 2M y 1 omni; no cumple 3E y 1B (los dos omni ya completan la energía) ni 3 omni |
| CA8 | El orden guardado | se lee | un orden que existe se usa; uno que no existe o nada guardado, Newest |

## Fuera de alcance

- Carpetas o etiquetas propias para agrupar builds.
- Guardar el buscador o el filtro entre sesiones.

## Plan de pruebas

1. **Lógica (CA1 a CA10):** `src/utils/savedBuildsList.test.ts`, con builds de prueba.
2. **Interfaz:** en el navegador, en los dos MechLabs, a 1440 × 900 y a 390 × 844, con varias builds guardadas: buscar, ordenar, filtrar, el recuento, la lista vacía, duplicar con un filtro puesto y que el orden se recuerde al volver a abrir.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Tests:** los diez criterios están en `src/utils/savedBuildsList.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador con ocho builds en MW5 (una que ya no se puede abrir) y cuatro en BATTLETECH, a 1440 × 900 y a 390 × 844: el orden por fecha, la búsqueda «atlas» ordenada por tonelaje («2 of 8 saved»), un filtro sin resultados con Clear filters, el filtro Assault en BATTLETECH («1 of 4 saved») y el orden guardado en el navegador.
- **Decisión durante el desarrollo:** el botón de cada clase de peso se desactiva si no hay ninguna build de esa clase, para no dar a elegir un filtro vacío.
- **Anclajes mínimos (RF3b):** se añadieron después, con los contadores del selector de 'Mechs. La regla de los omni pasó a `utils/hardpointMinimums.ts`, que usan el selector y la lista. Comprobado en el navegador: en MW5, con 1 balístico quedan 5 de 8 builds; en BATTLETECH, los cuatro 'Mechs de prueba tienen al menos un anclaje de apoyo.
