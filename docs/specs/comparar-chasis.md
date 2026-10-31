# Especificación: comparar dos chasis

- **Issue:** [#58](https://github.com/PonchoiDev/mechlab-web/issues/58)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/compare.test.ts`) y por último el código, en commits separados.

## Contexto

Para decidir qué 'Mech comprar, o si compensa cambiar de chasis, hoy hay que cargar las variantes una a una y apuntar las cifras. La web ya calcula todo lo necesario para cada build (`getBuildSummary`), así que comparar es ponerlo lado a lado y marcar qué gana en cada fila.

## Qué se compara

- **Izquierda:** la build del tablero, tal como está, con sus mejoras de la cantina. Si no se ha tocado, es la build de serie del chasis.
- **Derecha:** otra variante con su build de serie, la que trae de fábrica en el juego.

Con la build sin tocar, la comparación es de chasis contra chasis. Con una build propia, responde a «¿me compensa mi build o la de serie de otro chasis?».

## Requisitos funcionales

- **RF1.** La barra de herramientas tiene un botón **Compare** que abre y cierra un panel de comparación bajo ella, como el de las mejoras.
- **RF2.** El panel tiene dos columnas. La de la derecha se elige con el mismo selector de chasis de la cabecera, con sus filtros y atajos. Al abrirlo propone otra variante del mismo chasis si existe, o el primer 'Mech de la lista si no.
- **RF3.** Cada columna muestra el nombre y las siglas, la ficha del motor (`300 XL DHS ENDO`) y los anclajes por tipo y tamaño (`4E·M 1B·L`).
- **RF4.** Una tabla compara, agrupadas como la pestaña 'Mech: anclajes por tipo, defensa (armadura y estructura), potencia de fuego (daño por salva, cuerpo a cuerpo, DPS, alcance máximo), calor (refrigeración, capacidad, pico de calor, calor disparando), movilidad (velocidad, giro, giro del torso, jump jets) y ranuras de mejora.
- **RF5.** En cada fila se marca el valor mejor y la diferencia. Lo mejor es lo más alto, salvo el pico de calor y el calor disparando, donde gana lo más bajo. Si los dos valores son iguales o falta alguno, no gana ninguno.
- **RF6.** Un botón **Load this 'Mech** carga en el tablero la variante de la derecha con su build de serie y cierra el panel.

## Requisitos no funcionales

- **RNF1.** La comparación es lógica pura en `src/utils/compare.ts`, con sus tests; el panel solo pinta.
- **RNF2.** Las cifras son las mismas que la barra de estadísticas y la pestaña 'Mech: salen de `getBuildSummary`, sin cálculos nuevos.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF4.** En el móvil, la tabla se desplaza en horizontal y mantiene los dos valores en la misma fila.

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

## Fuera de alcance

- Comparar más de dos 'Mechs a la vez.
- Elegir una build guardada para la columna derecha: de momento, siempre su build de serie.
- Compartir la comparación por enlace.

## Plan de pruebas

1. **Lógica (CA1 a CA7):** `compareBuilds` y `getDefaultComparison` en `src/utils/compare.test.ts`, con las builds de serie reales.
2. **Interfaz:** comprobación en el navegador del panel, el selector, el marcado de ganadores y el botón de cargar.
