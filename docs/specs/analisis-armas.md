# Especificación: más cifras en el análisis de armas

- **Issue:** [#122](https://github.com/PonchoiDev/mechlab-web/issues/122)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/weaponAnalysis.test.ts`) y por último el código, en commits separados.

## Contexto

Llegaron cuatro sugerencias por el formulario de feedback para el análisis del MechLab de MW5 (pestañas Weapons y 'Mech):

1. cuánto se tarda en llegar al calor máximo disparando y en enfriarse;
2. el tonelaje de cada arma junto a su nombre;
3. el daño total que puede hacer la munición instalada;
4. el daño por tonelada de cada arma.

La web ya calcula todo lo necesario en `getBuildSummary`: la capacidad de calor, el calor por segundo disparando, la refrigeración, el daño por salva de cada arma con las mejoras de la cantina y las salvas de cada munición.

## Requisitos funcionales

- **RF1.** La sección HEAT de la pestaña 'Mech añade dos filas:
  - **Time to max heat:** los segundos que tarda en llenarse la capacidad de calor disparando sin parar. Mientras se dispara también se refrigera, así que cuenta el calor neto: capacidad / (calor disparando - refrigeración). Si la refrigeración iguala o supera al calor disparando, no llega nunca y se dice («Never»).
  - **Time to cool down:** los segundos que tarda en enfriarse desde el máximo sin disparar: capacidad / refrigeración.

  Sin capacidad de calor o sin refrigeración conocidas, las filas quedan vacías (`-`), como las demás.
- **RF2.** La tabla de armas pone el tonelaje de cada arma junto a su nombre: «Autocannon/5 (8t)». El texto de ayuda de cada arma en el tablero lo dice también.
- **RF3.** La tabla Stores enseña, en cada munición, el daño potencial: las salvas que da por el daño de una salva de las armas que la usan (con las mejoras de la cantina). Una munición que no usa ninguna arma no tiene daño potencial.
- **RF4.** La tabla de armas añade la columna **Damage / ton**: el daño por salva del arma (con las mejoras de la cantina) dividido por su propio tonelaje, sin la munición. Así se comparan también las armas de energía, que no llevan munición. La fila del total da el de todas las armas a distancia juntas: su daño por salva entre su tonelaje.
- **RF5.** Las cifras nuevas siguen el formato de las demás: con las mejoras de la cantina instaladas, el valor sin mejoras se ve al lado, como ya pasa con el resto de la tabla.

## Requisitos no funcionales

- **RNF1.** La lógica (tiempos de calor, daño potencial, daño por tonelada y el nombre con el tonelaje) es pura, está en `src/utils/` y tiene tests. Los componentes solo pintan.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El DRG-1G-S de serie (capacidad 62, 5.18 de calor por segundo disparando y 3.2 de refrigeración) | se calculan sus tiempos de calor | llega al máximo en 31.4 s (62 / 1.98) y se enfría desde el máximo en 19.4 s (62 / 3.2) |
| CA2 | Una build cuya refrigeración iguala o supera al calor disparando | se calcula el tiempo hasta el calor máximo | no llega nunca: el tiempo es `null` y la página dice «Never» |
| CA3 | El Autocannon/5 (8 t) | se escribe su nombre en la tabla | «Autocannon/5 (8t)» |
| CA4 | El HGN-732 de serie | se calcula el daño potencial de su munición | la del Gauss (78 disparos, 15 de daño) da 1170; la del LRM, 44 salvas por el daño de una salva de su LRM 20 |
| CA5 | Una munición que no usa ninguna arma | se calcula su daño potencial | no tiene (`null`) |
| CA6 | El Medium Laser (5 de daño, 1 t), el Autocannon/20 (20, 14 t) y el LRM 20 (24, 10 t) | se calcula su daño por tonelada | 5, 1.43 y 2.4 |
| CA7 | Una mejora de daño de la cantina | se calcula el daño por tonelada y el daño potencial | los dos usan el daño con la mejora |

## Fuera de alcance

- El daño por tonelada contando la munición: se pidió así al principio, pero con el tonelaje del arma sola se comparan también las de energía.
- El tonelaje junto al nombre en las fichas del tablero, que ya van justas de espacio: va en su texto de ayuda.

## Plan de pruebas

1. **Lógica (CA1 a CA7):** `src/utils/weaponAnalysis.test.ts`, con los datos reales.
2. **Interfaz:** en el navegador, la pestaña Weapons (tonelaje, Damage / ton y Stores) y la sección HEAT de la pestaña 'Mech, con y sin mejoras de la cantina.
