# Especificación: estadísticas del MechLab de YAML

- **Issue:** [#175](https://github.com/PonchoiDev/mechlab-web/issues/175)
- **Estado:** en desarrollo
- **Depende de:** el MechLab de YAML ([mechlab-yaml.md](mechlab-yaml.md))
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/combat.test.ts`) y por último el código, en commits separados.

## Contexto

La lectura del MechLab de YAML enseña ahora diez cifras copiadas de la del MechLab de MW5 (peso, armadura, velocidad, motor, ranuras libres, refrigeración...). El mechlab del juego con YAML enseña otras: un panel de 21 cifras con daño, calor, alcance, movimiento, sensores, AMS y munición. Tampoco hay análisis de armas ni radar de daño por alcance, que sí tiene el MechLab de MW5.

Con YAML instalado, esas cifras las calcula el propio mod (blueprint `MechAlphaStats` de YAML y `YAWFunctionsYAML`, que aplica las reglas de Yet Another Weapon), no el juego. Las fórmulas de esta especificación salen de desensamblar ese bytecode con `tools/kismet.py`, y las cifras de referencia, de una captura del juego.

## Datos

`tools/extraer_yaml.py` guarda además todos los assets de arma del juego base (ahora solo guarda los de cuerpo a cuerpo). `tools/generar_yaml.py` añade a cada arma de `src/data/yaml/items.json` sus estadísticas de combate, leídas del asset de cada nivel:

| Campo | Origen |
|---|---|
| Familia | Clase del asset: `MWTraceWeaponDataAsset` (láseres, lanzallamas, ametralladoras), `MWProjectileWeaponDataAsset` (balísticas y PPC), `MWMissileWeaponDataAsset`, `MWAMSWeaponDataAsset`, `MWMeleeWeaponDataAsset` |
| Etiqueta y tecnología | `WeaponType` y `TechBase`, para saber a qué armas se aplica cada bonificación |
| Niveles | El asset sin sufijo es el nivel 1 y `_Lvl0`, `_Lvl2`... `_Lvl5`, los demás. Cada nivel lleva sus cifras y su `QuirkSet` |
| Daño y calor por disparo | `Damage` y `HeatGenerated` del proyectil, o `DamageOverDuration` y `HeatGeneratedOverDuration` del rayo, con los quirks del nivel. El daño se multiplica por los misiles o los perdigones y por los disparos de la ráfaga, y el calor por los misiles y los disparos, como en el MechLab de MW5 |
| Enfriamiento, duración del rayo y alcances | `Cooldown`, `Trace.Duration`, `OptimalRange` y `MaxRange`, con los quirks del nivel |
| Tiempo de la salva | Proyectiles: `NumberOfTimesToFire × DelayBetweenFiring`; misiles: `NumberOfMissiles × MissileInterval` |
| AMS | `MissileDestructionRate` y `MaxRange` |
| Cuerpo a cuerpo | `Melee.Damage`, `Melee.Duration` y `Cooldown` |

Las armas de los mods dejan de salir una vez por nivel en el inventario (`CEERPPC79`, `CEERPPC79_Lvl2`...): como las del juego, son un objeto con sus niveles. Además:

- **Munición:** la capacidad de cada caja (`Capacity`) también en la de los mods.
- **Equipo:** sus bonificaciones de `Equipment_Properties.json` que cambian las cifras: las de armas (`weapons`: `scope` y `groups`), las de movimiento (`turnSpeedMulti`, `torsoTwistRateMulti`, `torsoTwistAngleMulti`, `armTwistAngleMulti` y sus versiones de guiñada) y las de sensores (`sensorRangeBonus`, `sensorRangeMulti`), más el `SensorRangeModifier` de las sondas y el porcentaje de sensores de los computadores de puntería.
- **Variantes:** de su MDA, el giro (`MoveStats.TurnSpeed`), el giro del torso (`TorsoTwistRate.Yaw`), el ángulo del torso (`TorsoTwistBounds.High.Yaw`, o 360 si `bIsYawUnbound`) y el de los brazos (`ArmTwistBounds.High.Yaw`).

Los ajustes de Yet Another Weapon son los de por defecto de su `gui_config.ini`: alcance máximo × 2 (`GlobalMaxRangeMultiplier`), duración de los láseres de pulsos × 0,7 (`TracePulseLaserDurationMultiplier`) y el resto de multiplicadores × 1.

## Reglas

Todas comprobadas con la captura del NSR-9J de serie con sus armas en nivel 3 y el Royal DHS Kit (criterio CA1).

- **Bonificaciones (✔):** las dan los quirks de la variante y el equipo montado. Cada grupo (`groups`) se aplica a las armas cuya etiqueta o tecnología empieza por una de sus `tags`, o cuyo nombre sin nivel está en ellas, salvo las de `excludeTags`. Los quirks valen para todo el 'Mech salvo que su grupo diga `mechParts`. El equipo vale para todo el 'Mech salvo con `scope: "component"`, que solo vale para las armas de su ubicación. **Los multiplicadores se suman, no se multiplican** (`AddMulti` de YAML: `a + b − 1`, como mínimo 0,001): Improved Targeting (enfriamiento × 0,9) y SLDF (× 0,9) dan × 0,8; SLDF (calor × 0,9) y el Royal DHS Kit (× 0,92), × 0,82.
- **Enfriamiento:** el del nivel × `cooldownMulti`, como mínimo 0,01 s.
- **Daño y calor por disparo:** los del nivel × `damageMulti` y × `heatMulti`.
- **Rayos (✔):** la duración es la del nivel × `durationMulti`, y × 0,7 en los láseres de pulsos (`Weapon.Energy.Laser.Pulse`). Las ametralladoras de rayo (duración 0) dan su daño y su calor por segundo.
- **Ciclo de disparo:** enfriamiento + duración del rayo, + el tiempo de la salva en proyectiles y misiles. Daño por segundo = daño / ciclo; calor por segundo = calor / ciclo.
- **Alcance óptimo:** el del nivel × `optimalRangeMulti`.
- **Alcance máximo (✔):**
  - Rayos: óptimo × 2; el lanzallamas, el TAG y los láseres de pulsos variables, el óptimo.
  - PPC (nombre con «PPC»): óptimo × 2.
  - MRM (nombre con «mrm»): el óptimo.
  - Gauss (`Weapon.Ballistic.GaussRifle`): óptimo × 2 × 1,5; las Hyper e Improved Clan llevan además ese alcance como óptimo.
  - Resto de balísticas: óptimo × 2.
  - Misiles: el máximo del nivel × `maxRangeMulti`.
  - AMS: el máximo × `maxRangeMulti`.
- **Cuerpo a cuerpo:** daño × `damageMulti` y enfriamiento × `cooldownMulti`; daño por segundo = daño / (`Melee.Duration` + enfriamiento). Cuentan las armas montadas en anclajes de cuerpo a cuerpo, no los actuadores (manos y antebrazos).
- **Movimiento:** cada cifra del MDA × su multiplicador (suma de los del equipo y los quirks), redondeada a un decimal.
- **Sensores (✔):** (800 m + `sensorRangeBonus`) × `sensorRangeMulti` × (1 + (`SensorRangeModifier` − 1) de cada sonda + porcentaje de los computadores de puntería). NSR-9J: 800 + 50 (Command 'Mech) + 100 (SLDF) = 950 m.

## El panel del juego

Las 21 cifras de `MechLabStatsPanelWidget`, con sus títulos y en su orden (7 filas de 3):

| Fila | 1 | 2 | 3 |
|---|---|---|---|
| 1 | Armor | Structure | Melee dmg avg |
| 2 | Alpha damage | Damage/s | Melee dmg/s avg |
| 3 | Weapon heat/s | Cooling heat/s | Turn rate °/s |
| 4 | Alpha heat | Heat capacity | Torso twist °/s |
| 5 | Jump height (m) | Speed (km/h) | Torso yaw ° |
| 6 | Weapon range (m) | Sensor range (m) | Arm yaw ° |
| 7 | AMS intercept/s | AMS range (m) | Ammo |

- **Alpha damage, Alpha heat:** la suma del daño y el calor por disparo de las armas a distancia.
- **Damage/s, Weapon heat/s:** la suma de las de cada arma.
- **Weapon range (✔):** el mayor alcance máximo, **truncado** al metro (el juego lo redondea a centímetros y lo divide como entero: 2.395,8 → 2.395).
- **Melee dmg avg, Melee dmg/s avg:** la media de las armas de cuerpo a cuerpo; 0 sin ninguna.
- **AMS intercept/s:** la suma de misiles destruidos por segundo de los AMS (`MissileDestructionRate` × `missilesDestroyedMulti`); **AMS range**, el mayor alcance.
- **Ammo:** la suma de la capacidad de las cajas, sin multiplicadores.
- **Armor, Structure, Cooling, Heat capacity, Speed:** las de las reglas del MechLab.
- Cada cifra lleva la barra del juego, llena en proporción al tope que usa el juego (Armor 626, Alpha damage 150, Damage/s 45...).

La página sustituye la lectura actual por este panel. El peso, las ranuras libres y los rellenos dinámicos, que en YAML deciden qué cabe, van en su cabecera, donde el juego enseña el peso.

## Niveles de arma

- El inventario enseña cada arma una vez, con el selector de nivel del MechLab de MW5. Al montarla, la build guarda su nivel (`tier`).
- El nivel se puede cambiar en el arma montada, como en el MechLab de MW5.
- El código de la build guarda el nivel de cada arma.

## Análisis de armas y radar

Debajo del tablero, como en el MechLab de MW5:

- **Weapon performance:** una fila por arma montada con su ubicación, daño, calor, enfriamiento, daño por segundo, calor por segundo, alcance óptimo y máximo, y una fila de totales que da las mismas cifras que el panel.
- **Damage by range:** el radar del MechLab de MW5 (`RangeRadar`). Cada arma hace todo su daño hasta su alcance óptimo y baja en línea recta hasta 0 en su alcance máximo (`GlobalDamageScaleAtMaxRange` de YAW es 0).
- **Installed ammunition:** cajas y disparos de cada tipo de munición.

## Criterios de aceptación

Van en `src/utils/yaml/combat.test.ts`. La build de referencia es la del NSR-9J de serie con sus seis armas en nivel 3 y el Royal DHS Kit, la de la captura del juego.

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | La build de referencia | se calcula el panel | Armor 599, Structure 304, Melee dmg avg 0, Alpha damage 62,1, Damage/s 16,47, Melee dmg/s avg 0, Weapon heat/s 4,02, Turn rate 53,9, Alpha heat 13,99, Heat capacity 58, Torso twist 67,5, Jump height 0, Speed 48,6, Torso yaw 95, Weapon range 2.395, Sensor range 950, Arm yaw 30, AMS intercept/s 0, AMS range 0, Ammo 182 |
| CA2 | El panel | se pinta | tiene las 21 cifras con los títulos y el orden del juego |
| CA3 | El Gauss Rifle, el ER PPC y el Medium Pulse Laser | se consultan en nivel 3 | Gauss: 17,1 de daño, 0,9 de calor, 5,7 s y 726 m; ER PPC: 11,4, 9,9, 4,75 s y 825 m; Medium Pulse Laser: 6,6, 2,34, 3,0875 s, 0,585 s de rayo y 242 m. En nivel 1, las cifras del asset (Gauss 15, 1, 6 s y 660 m) |
| CA4 | Los quirks del NSR-9J y el Royal DHS Kit | se suman sus bonificaciones para un arma | enfriamiento × 0,8, calor × 0,82, alcance óptimo y máximo × 1,1 |
| CA5 | La build de referencia | se calcula cada arma | Gauss: 3,75 de daño por segundo y 2.395,8 m de alcance máximo; ER PPC: 3 de daño por segundo y 1.815 m; Medium Pulse Laser: rayo de 0,41 s, 2,29 de daño por segundo y 532,4 m |
| CA6 | Un arma de un mod con niveles (Cap ER PPC) | se busca en el inventario | sale una vez, con sus niveles del 1 al 5 |
| CA7 | Un arma en nivel 3 | se monta, se codifica la build y se decodifica | sigue en nivel 3, y el panel cambia con el nivel |
| CA8 | La build de referencia | se calcula el daño por alcance | a 500 m llega el daño de las seis armas salvo el Small Laser, con el Medium Pulse Laser ya bajando; a 2.400 m no llega ninguna |
| CA9 | La tabla de análisis | se suman sus filas | dan el daño alfa, el daño por segundo y el calor del panel |

## Fuera de alcance

- Los ajustes de Yet Another Weapon distintos de los de por defecto.
- Los quirks de piloto y las habilidades del piloto.
- La caída del daño de cada arma con la distancia más allá de la línea recta del radar (curvas `MWO_RangeData`, `DamageScaleAtMaxRange`).
- Los efectos de los computadores de puntería sobre las armas (velocidad del proyectil y alcance de los láseres), que el juego aplica como rasgos.

## Pendiente de comprobar en el juego

- **Jump height:** la calcula el juego (`EstimateMaxJumpJetHeight`) con el empuje de los retrorreactores y el peso del 'Mech. Sin retrorreactores es 0; con ellos, la web no enseña cifra hasta tener una captura con la que calibrarla.
- La refrigeración de la build de serie: la web da 2,8 y el juego 3 (ver la especificación del MechLab).
- Las cifras con armas de misiles, AMS y cuerpo a cuerpo montadas.

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/combat.test.ts` (CA1 y CA3 a CA9).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: el panel con el NSR-9J, cambiar el nivel de un arma en el inventario y en el tablero, el análisis y el radar.
