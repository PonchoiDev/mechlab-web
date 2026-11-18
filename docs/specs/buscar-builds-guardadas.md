# Especificación: buscar, ordenar y filtrar las builds guardadas

- **Estado:** en desarrollo
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
- **RF4.** El recuento dice cuántas se ven de cuántas hay («7 of 42 saved») cuando el buscador o el filtro esconden alguna, y si no queda ninguna, la lista lo dice y ofrece quitar los filtros.
- **RF5.** El orden elegido se recuerda en el navegador, por separado en cada juego; el buscador y el filtro empiezan vacíos cada vez que se abre la ventana.
- **RF6.** Todo lo demás de la ventana sigue igual: cargar, duplicar (la copia se ve aunque el filtro la escondería, para que se pueda renombrar), renombrar, copiar el enlace, borrar, importar y exportar todas.
- **RF7.** Igual en el MechLab de MW5 y en el de BATTLETECH.

## Requisitos no funcionales

- **RNF1.** La lógica es pura, común a los dos juegos y está en `src/utils/savedBuildsList.ts`, con sus tests: recibe cada build ya resumida (nombre, fecha, chasis, variante, clase, tonelaje y potencia de fuego) y no carga los datos de ningún juego.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

Con estas builds (la última, de un 'Mech que ya no existe):

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
| CA8 | El orden guardado | se lee | un orden que existe se usa; uno que no existe o nada guardado, Newest |

## Fuera de alcance

- Carpetas o etiquetas propias para agrupar builds.
- Guardar el buscador o el filtro entre sesiones.

## Plan de pruebas

1. **Lógica (CA1 a CA8):** `src/utils/savedBuildsList.test.ts`, con builds de prueba.
2. **Interfaz:** en el navegador, en los dos MechLabs, a 1440 × 900 y a 390 × 844, con varias builds guardadas: buscar, ordenar, filtrar, el recuento, la lista vacía, duplicar con un filtro puesto y que el orden se recuerde al volver a abrir.
