# Especificación: comparar dos chasis

- **Issue:** [#58](https://github.com/PonchoiDev/mechlab-web/issues/58)
- **Estado:** implementada; ampliada tras la primera revisión (ver «Revisión del diseño»)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/compare.test.ts`) y por último el código, en commits separados.

## Contexto

Para decidir qué 'Mech comprar, o si compensa cambiar de chasis, hoy hay que cargar las variantes una a una y apuntar las cifras. La web ya calcula todo lo necesario para cada build (`getBuildSummary`), así que comparar es ponerlo lado a lado y marcar qué gana en cada fila.

## Qué se compara

- **Izquierda:** la build del tablero, tal como está, con sus mejoras de la cantina. Si no se ha tocado, es la build de serie del chasis.
- **Derecha:** otra variante con su build de serie, la que trae de fábrica en el juego, o una de las builds guardadas en *My builds*, con sus mejoras.

Con la build sin tocar, la comparación es de chasis contra chasis. Con una build propia, responde a «¿me compensa mi build o la de serie de otro chasis?».

## Requisitos funcionales

- **RF1.** La barra de herramientas tiene un botón **Compare**, en el grupo BUILD, que abre y cierra un panel de comparación bajo ella, como el de las mejoras.
- **RF2.** El panel tiene dos columnas. La de la derecha se elige con el mismo selector de chasis de la cabecera, con sus filtros y atajos, colocado encima de la tabla. Al abrirlo propone otra variante del mismo chasis si existe, o el primer 'Mech de la lista si no.
- **RF3.** Cada columna muestra el nombre y las siglas, la ficha del motor (`300 XL DHS ENDO`) y los anclajes por tipo y tamaño (`4E·M 1B·L`).
- **RF4.** Una tabla compara, agrupadas como la pestaña 'Mech: anclajes por tipo, defensa (armadura y estructura), potencia de fuego (daño por salva, cuerpo a cuerpo, DPS, alcance máximo), calor (refrigeración, capacidad, pico de calor, calor disparando), movilidad (velocidad, giro, giro del torso, jump jets) y ranuras de mejora.
- **RF5.** En cada fila se marca el valor mejor y la diferencia. Lo mejor es lo más alto, salvo el pico de calor y el calor disparando, donde gana lo más bajo. Si los dos valores son iguales o falta alguno, no gana ninguno.
- **RF6.** Un botón **Load this 'Mech** carga en el tablero la build de la derecha y cierra el panel.
- **RF7.** Cada lado muestra su 'Mech como una tarjeta: imagen de Sarna, nombre, ficha, anclajes y su loadout por componente (armas con su tier, equipo y munición, con las repeticiones agrupadas: `AC/20 Ammo ×2`).
- **RF8.** La derecha se elige entre dos orígenes: **Stock 'Mech** (el selector de chasis) y **My builds** (las builds guardadas). Sin builds guardadas, se explica cómo guardar una.
- **RF9.** Las cifras se comparan en espejo: el valor de la izquierda y el de la derecha a cada lado de la etiqueta, con una barra proporcional al mayor de los dos y el ganador resaltado.

## Requisitos no funcionales

- **RNF1.** La comparación es lógica pura en `src/utils/compare.ts`, con sus tests; el panel solo pinta.
- **RNF2.** Las cifras son las mismas que la barra de estadísticas y la pestaña 'Mech: salen de `getBuildSummary`, sin cálculos nuevos.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF4.** En el móvil caben las tres columnas sin desplazarse: los dos valores se leen en la misma fila.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El AS7-D y el KGC-000 con su build de serie | se comparan | el AS7-D gana en armadura (608 frente a 573), daño por salva (78,4 frente a 68) y refrigeración (1,9 frente a 1,5) |
| CA2 | Los mismos | se comparan los anclajes | el KGC-000 gana en balísticos (2 frente a 1) y el AS7-D en energía (4 frente a 1) |
| CA3 | Los mismos | se compara la velocidad, el pico de calor y el alcance máximo | empatan (48,6 km/h, 24 y 900 m) y no gana ninguno |
| CA4 | Una fila de pico de calor con 20 y 30 | se decide el ganador | gana 20, porque menos calor es mejor |
| CA5 | Un 'Mech comparado consigo mismo | se compara | ninguna fila tiene ganador |
| CA6 | El AS7-D | se propone con quién compararlo | se propone otra variante de Atlas |
| CA7 | Un 'Mech que es la única variante de su chasis | se propone con quién compararlo | se propone el primer 'Mech de la lista que no sea él |
| CA8 | La build de serie del AS7-D | se agrupa su loadout por componente | el torso derecho lleva el Autocannon/20 y `AC/20 Ammo ×2`, y no aparecen componentes vacíos |
| CA9 | Una build guardada del AS7-D con Refined Armor II | se elige como origen de la derecha | se reconstruye con sus mejoras y su armadura supera la de la build de serie |
| CA10 | Una build guardada cuyo código ya no es válido | se elige como origen | no hay build que comparar y no se rompe nada |
| CA11 | Armadura 608 frente a 573 | se calculan las barras | la de 608 ocupa todo el ancho y la de 573, el 94 % |

## Fuera de alcance

- Comparar más de dos 'Mechs a la vez.
- Compartir la comparación por enlace.

## Plan de pruebas

1. **Lógica (CA1 a CA7):** `compareBuilds` y `getDefaultComparison` en `src/utils/compare.test.ts`, con las builds de serie reales.
2. **Interfaz:** comprobación en el navegador del panel, el selector, el marcado de ganadores y el botón de cargar.

## Revisión del diseño

La primera versión era una tabla de tres columnas a todo el ancho: las cifras quedaban lejos unas de otras y no se veía qué llevaba cada 'Mech. Se rehízo con una tarjeta por 'Mech con su loadout, la comparación en espejo con barras y la opción de comparar con builds guardadas (RF7 a RF9, CA8 a CA11).

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y la implementación, en commits separados. La revisión del diseño siguió el mismo orden: especificación y tests ampliados, después el código.
- **Tests:** los once criterios (CA1 a CA11) están en `src/utils/compare.test.ts` y pasan, junto a uno más sobre la diferencia que se muestra.
- **Interfaz:** comprobada en el navegador a 1920 × 1080 y a 390 × 844.
  - Con el KGC-000 en el tablero, la tarjeta de la derecha propone el KGC-0000 con su build de serie; frente al AS7-D, el Atlas gana en energía, armadura, daño y refrigeración, y el King Crab en balísticos y en calor disparando.
  - Una build guardada del AS7-D con Refined Armor II sale con sus mejoras (638,4 de armadura) y **Load this build** la abre en el tablero, vinculada para poder actualizarla.
- **Decisiones durante el desarrollo:**
  - El selector va fuera de la tabla, porque un contenedor con desplazamiento recortaría su desplegable.
  - Con dos selectores en la página, cada uno genera sus propios `id` (`useId`).
  - La diferencia se escribe hacia el centro: delante del valor en la columna izquierda y detrás en la derecha.
  - En el móvil, las tarjetas van una debajo de otra y las cifras siguen en espejo, sin desplazamiento horizontal.
