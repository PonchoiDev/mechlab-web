# Especificación: más cifras en el análisis de armas

- **Issue:** [#122](https://github.com/PonchoiDev/mechlab-web/issues/122)
- **Estado:** implementada; ampliada con el radar de daño por alcance (RF6)
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
- **RF6.** La pestaña Weapons enseña el daño por alcance como el MechLab de BATTLETECH: un radar de medio círculo, con el 'Mech abajo en el centro y un anillo por distancia, más intenso cuanto más daño llega. En MW5:
  - cada arma a distancia hace todo su daño hasta su alcance óptimo (`range`) y, entre el óptimo y el máximo (`maxRange`), un daño que baja en línea recta hasta cero, que es la caída de daño del juego; más allá, nada. El cuerpo a cuerpo no cuenta;
  - los anillos van cada 50, 100, 150, 200, 250, 300, 500, 750 o 1000 m, el primer paso con el que el alcance máximo del loadout cabe en 10 anillos o menos, y llegan hasta él;
  - con las mejoras de la cantina, el daño y los alcances son los mejorados.
- **RF7.** El radar se lee sin adivinar (común a MW5 y BATTLETECH):
  - cada número dice qué es: el daño lleva «dmg» y las distancias «m», con «DISTANCE» en la base;
  - los anillos seguidos con el mismo daño se juntan en un tramo con una sola etiqueta, que dice el daño y de qué distancia a qué distancia llega («57.2 dmg · 300 to 500 m»);
  - al pasar el ratón o tocar un anillo, se resalta y se lee su distancia y su daño debajo del radar.
- **RF8.** Al señalar un anillo del radar, la tabla de armas resalta las que hacen daño a esa distancia y apaga las que no llegan; las que llegan con la caída de daño (entre su alcance óptimo y el máximo) llevan además una marca, y la línea bajo el radar dice qué armas son. En BATTLETECH, igual, con la marca en las que están por debajo de su alcance mínimo.

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
| CA8 | El HGN-732 de serie (alcance máximo 900 m) | se calcula su daño por alcance | 9 anillos, de 100 en 100 m hasta 900; a 100 m, 63.4 (todo su daño por salva); a 300 m, 46.78 (LRM 20 y Gauss Rifle enteros y los dos Medium Laser con la caída, 5 × 105 / 135 cada uno); a 900 m solo el LRM 20, 24 |
| CA9 | Loadouts con alcances máximos de 405, 1500 y 5625 m | se eligen los anillos | cada 50 m (9 anillos), cada 150 m (10) y cada 750 m (8) |
| CA10 | Un perfil de daño de 63.4, 63.4, 46.8, 39.4, 39, 39, 24, 24 y 24 cada 100 m | se agrupan sus anillos | 5 tramos: 63.4 de 100 a 200 m, 46.8 a 300 m, 39.4 a 400 m, 39 de 500 a 600 m y 24 de 700 a 900 m, cada uno con el radio interior de su primer anillo y el exterior del último |
| CA11 | El HGN-732 de serie | se señala el anillo de 400 m | el LRM 20 y el Gauss Rifle hacen todo su daño; los dos Medium Laser, con la caída (270 m de óptimo y 405 de máximo); el SRM 6 (270 m) no llega |
| CA7 | Una mejora de daño de la cantina | se calcula el daño por tonelada y el daño potencial | los dos usan el daño con la mejora |

## Fuera de alcance

- El daño por tonelada contando la munición: se pidió así al principio, pero con el tonelaje del arma sola se comparan también las de energía.
- El tonelaje junto al nombre en las fichas del tablero, que ya van justas de espacio: va en su texto de ayuda.

## Plan de pruebas

1. **Lógica (CA1 a CA11):** `src/utils/weaponAnalysis.test.ts`, con los datos reales.
2. **Interfaz:** en el navegador, la pestaña Weapons (tonelaje, Damage / ton y Stores) y la sección HEAT de la pestaña 'Mech, con y sin mejoras de la cantina.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Tests:** los siete criterios están en `src/utils/weaponAnalysis.test.ts` y pasan.
- **Comprobado** en el navegador con el HGN-732 de serie: llega al máximo en 16.8 s y se enfría en 35 s; daño por tonelada de 5 (Medium Laser), 2.4 (LRM 20) y 1 (Gauss Rifle), 2.11 en total; daño potencial de 1170 en el Gauss y 1056 en el LRM.
- **Radar de daño por alcance (RF6):** el de BATTLETECH pasa a ser común (`src/components/RangeRadar.tsx` y `src/utils/rangeRadar.ts`), con el color de cada página. Comprobado con el HGN-732: 63.4 hasta 200 m, 46.8 a 300 m y 24 desde 700 m, solo el LRM 20. El radar de BATTLETECH no cambia.
- **Radar más legible (RF7):** comprobado en el navegador con el HGN-732 (de 9 cifras a 5 tramos) y el CPLT-C1 de BATTLETECH, con el detalle al pasar el ratón.
