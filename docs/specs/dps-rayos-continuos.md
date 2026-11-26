# Especificación: daño y calor por segundo de ametralladoras y lanzallamas

- **Estado:** en curso
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/calculators.test.ts`, `src/utils/arsenal.test.ts` y `src/utils/units.test.ts`) y por último los datos y el código, en commits separados.

## Contexto

Un jugador avisa de que el MechLab de MW5 da un DPS y un calor por segundo disparatados a las ametralladoras y los lanzallamas: el Clan Heavy Machine Gun sale con 40 de DPS. La web trata su daño como el de una salva y lo multiplica por la cadencia (600 disparos por minuto), cuando el dato del juego ya es por segundo. El mismo cálculo lo usan la página de equipo y la de unidades enemigas, que ya tenía anotado el problema como pendiente ([unidades-enemigas.md](unidades-enemigas.md)). El MechLab de YAML ya lo hace bien ([estadisticas-yaml.md](estadisticas-yaml.md)).

## Datos del juego

- **Armas de rayo:** las ametralladoras y los lanzallamas son armas de rayo (`MWTraceWeaponDataAsset`), como los láseres. Su bloque `Trace` trae `DamageOverDuration`, `HeatGeneratedOverDuration` y `RateOfFire` (10), pero no `Duration`. Son seis: Machine Gun, Flamer y las Clan Machine Gun, Light Machine Gun, Heavy Machine Gun y Flamer.
- **Cómo hace daño el rayo** (ejecutable del juego, el tick del rayo en `0x141187ea8` y el impacto en `0x14116f040`):
  - El impacto hace `tiempo × DamageOverDuration` de daño (y lo mismo con `HeatDamageOverDuration`).
  - Cada tick, el tiempo es el del frame, recortado a lo que le queda al rayo de `Duration`. Sin `Duration`, el límite es `FLT_MAX`: el rayo dura mientras se dispara.
  - Con `RateOfFire`, el tiempo se acumula y se aplica en impactos de intervalo fijo, pero el total sigue siendo `tiempo × DamageOverDuration`.
  - Así que, sin `Duration`, `DamageOverDuration` es daño por segundo, y `HeatGeneratedOverDuration`, calor por segundo.
- **Potencia de fuego del juego:** el resumen del mechlab del juego suma el daño de cada arma tal cual (1,5 de la ametralladora), así que la cifra de daño no cambia.

## Requisitos funcionales

- **RF1.** `generar_items.py` marca como `continuous` las armas de rayo sin `Duration`.
- **RF2.** En las armas continuas, el DPS es su daño y el calor por segundo es su calor, sin multiplicar por la cadencia. El resto de armas no cambia.
- **RF3.** Lo usan todas las cifras que salen de ese cálculo: el DPS de cada arma y el total del MechLab, el calor por segundo y los tiempos de calor del resumen, el comparador, la página de equipo y la de unidades enemigas.
- **RF4.** El daño, el calor de la salva, la cadencia y la duración de la munición no cambian.
- **RF5.** El MechLab de BATTLETECH no cambia: es por turnos y no tiene DPS. El de YAML ya lo calcula así.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | La Machine Gun / el Flamer en tier 1 | se calculan sus cifras | 1,5 de daño y 1,5 de DPS / 2 de daño, 2 de DPS y 0,4 de calor por segundo; la cadencia sigue en 600 |
| CA2 | El Clan Heavy Machine Gun | se ve en la página de equipo en tier 1 | 4 de DPS, no 40 |
| CA3 | Las armas en tier 1 | se ordenan por DPS | la primera ya no es una ametralladora |
| CA4 | Un 'Mech con un Flamer y un Medium Laser | se calcula el resumen | el calor por segundo es 0,4 + 2,25 × 15 / 60 |
| CA5 | El Medium Laser | se calculan sus cifras | no cambia: 1,25 de DPS |
| CA6 | Una unidad enemiga con una Machine Gun | se calcula su DPS | la ametralladora suma 1,5 |

## Fuera de alcance

- El ciclo de los láseres (cooldown más duración del rayo, como en YAML): el MechLab de MW5 sigue usando solo el cooldown.
- La munición que gastan las ametralladoras por segundo.

## Plan de pruebas

- Tests de los criterios en `src/utils/calculators.test.ts`, `src/utils/arsenal.test.ts` y `src/utils/units.test.ts`.
- En el navegador: el MechLab con un 'Mech con ametralladoras, la página de equipo ordenada por DPS y la de unidades.
