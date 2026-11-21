# Especificación: elegir una build guardada en el comparador

- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/savedBuildsList.test.ts`, `src/utils/savedBuildRows.test.ts` y `src/utils/battletech/savedBuildRows.test.ts`) y por último el código, en commits separados.

## Contexto

El comparador de los dos MechLabs (MW5 y BATTLETECH) compara la build del tablero con la de serie de otro 'Mech o con una build guardada. Para la de serie hay un selector con buscador y filtros, pero las builds guardadas se eligen en un desplegable que solo enseña el nombre de cada una. Con muchas builds guardadas, encontrar la que se busca es insoportable.

La ventana **My builds** ya tiene buscador, orden y filtros ([buscar-builds-guardadas.md](buscar-builds-guardadas.md)). El comparador puede usar los mismos, y la ventana puede llevar directamente al comparador.

## Requisitos funcionales

- **RF1.** En la pestaña **My builds** del comparador, la build se elige con un selector como el de chasis: un campo con el nombre de la build elegida que, al pulsarlo, abre un panel con los controles de la ventana My builds (buscador, orden y filtros de clase, tecnología, rol, equipo y mínimos de anclajes o armas) y la lista de builds que los cumplen.
- **RF2.** Cada build de la lista enseña lo mismo que en la ventana My builds: su nombre, su 'Mech con el tonelaje y la potencia de fuego, sus armas por tipo y sus etiquetas. Las builds que ya no se pueden abrir salen, pero no se pueden elegir.
- **RF3.** El panel dice cuántas builds se ven de cuántas hay y cuántos filtros hay puestos, y ofrece quitarlos. Si ninguna build cumple los filtros, lo dice.
- **RF4.** Los filtros se mantienen al cerrar y volver a abrir el selector mientras el comparador sigue abierto. El orden se recuerda con la misma clave que el de la ventana My builds de cada juego: el que se elige en un sitio es el que sale al abrir el otro.
- **RF5.** El selector se maneja con el teclado como el de chasis: las flechas recorren la lista, Enter elige y Escape cierra.
- **RF6.** Cada build de la ventana My builds tiene un botón **Compare** que cierra la ventana y abre el comparador con esa build elegida en la pestaña My builds. Si el comparador ya estaba abierto, cambia a esa build. Las builds que ya no se pueden abrir no se pueden comparar.
- **RF7.** Igual en el MechLab de MW5 y en el de BATTLETECH.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/`, con sus tests:
  - el resumen de cada build guardada sale de la ventana My builds a `src/utils/savedBuildRows.ts` (MW5) y `src/utils/battletech/savedBuildRows.ts`, para que la usen la ventana y el comparador;
  - los filtros puestos se cuentan en `src/utils/savedBuildsList.ts`, y la regla de que el mínimo de omni no cuenta con Weapons pasa de la ventana a `filterBuildRows`.
- **RNF2.** Los controles de los filtros son los mismos componentes en la ventana y en el comparador, y el selector es común a los dos juegos.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos. Funciona a 390 × 844 sin desbordar la página.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los filtros de la lista de builds | se cuentan | sin nada puesto, 0; con «atlas» en el buscador, Assault y Heavy, Clan, dos roles, Jump jets y ECM, y mínimos de 2E y 1M, 8: el buscador no cuenta, cada clase y cada botón de equipo cuentan uno, los roles juntos uno y cada mínimo mayor que cero uno |
| CA2 | Un 'Mech con 1E, 2 omni y 2M que lleva tres armas de energía y dos de misiles | se pide al menos 1 omni con Weapons | cumple: ningún arma es omni, así que con Weapons ese mínimo no cuenta |
| CA3 | La build de serie del HBK-4G de MW5 guardada como «Hunch» | se resume | chasis Hunchback, variante HBK-4G, clase medium, 3E y 1B en armas, sin jump jets, ECM, AMS ni hero, y su línea dice «Hunchback HBK-4G · T / 50 t · N volley», con su tonelaje con un decimal y su potencia de fuego |
| CA4 | Una build guardada de MW5 con un código que ya no se puede leer | se resume | no tiene 'Mech ni cifras, y su línea dice «This build can no longer be opened» |
| CA5 | La build de serie del HBK-4G de BATTLETECH guardada como «Hunch» | se resume | chasis Hunchback, variante HBK-4G, clase medium, 2E 1B 1S en armas, y su línea dice «Hunchback HBK-4G · T / 50 t · N alpha», con su tonelaje y el daño de un ataque con todas las armas |
| CA6 | Una build guardada de BATTLETECH con un código que ya no se puede leer | se resume | no tiene 'Mech ni cifras, y su línea dice «This build can no longer be opened» |

## Fuera de alcance

- Comparar más de dos builds a la vez.
- Guardar los filtros del comparador entre sesiones, como tampoco se guardan los de la ventana.

## Plan de pruebas

1. **Lógica (CA1 a CA6):** `src/utils/savedBuildsList.test.ts`, `src/utils/savedBuildRows.test.ts` y `src/utils/battletech/savedBuildRows.test.ts`.
2. **Interfaz:** en el navegador, en los dos MechLabs, a 1440 × 900 y a 390 × 844, con varias builds guardadas:
   - buscar y filtrar en el selector del comparador y elegir una build;
   - que los filtros sigan al volver a abrirlo;
   - el teclado;
   - una build que ya no se puede abrir;
   - el botón Compare de la ventana My builds, con el comparador cerrado y abierto.
