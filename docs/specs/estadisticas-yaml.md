# Especificación: estadísticas del MechLab de YAML

- **Issue:** [#175](https://github.com/PonchoiDev/mechlab-web/issues/175)
- **Estado:** implementada
- **Depende de:** el MechLab de YAML ([mechlab-yaml.md](mechlab-yaml.md))
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/combat.test.ts`) y por último el código, en commits separados.

## Contexto

La lectura del MechLab de YAML enseña ahora diez cifras copiadas de la del MechLab de MW5 (peso, armadura, velocidad, motor, ranuras libres, refrigeración...). El mechlab del juego con YAML enseña otras: un panel de 21 cifras con daño, calor, alcance, movimiento, sensores, AMS y munición. Tampoco hay análisis de armas ni radar de daño por alcance, que sí tiene el MechLab de MW5.

Con YAML instalado, esas cifras las calcula el propio mod (blueprint `MechAlphaStats` de YAML y `YAWFunctionsYAML`, que aplica las reglas de Yet Another Weapon), no el juego. Las fórmulas de esta especificación salen de desensamblar ese bytecode con `tools/kismet.py`, y las cifras de referencia, de capturas del juego. Cuando el mod llama a una función nativa del juego (la altura de salto), la fórmula sale de desensamblar el ejecutable: ninguna fórmula se ajusta solo a las capturas.

## Datos

`tools/extraer_yaml.py` guarda además todos los assets de arma del juego base (ahora solo guarda los de cuerpo a cuerpo). `tools/generar_yaml.py` añade a cada arma de `src/data/yaml/items.json` sus estadísticas de combate, leídas del asset de cada nivel:

| Campo | Origen |
|---|---|
| Familia | Clase del asset: `MWTraceWeaponDataAsset` (láseres, lanzallamas, ametralladoras), `MWProjectileWeaponDataAsset` (balísticas y PPC), `MWMissileWeaponDataAsset`, `MWAMSWeaponDataAsset`, `MWMeleeWeaponDataAsset` |
| Etiqueta y tecnología | `WeaponType` y `TechBase`, para saber a qué armas se aplica cada bonificación |
| Niveles | El asset sin sufijo es el nivel 1 y `_Lvl0`, `_Lvl2`... `_Lvl5`, los demás. Cada nivel lleva sus cifras y su `QuirkSet` |
| Daño y calor por disparo | Los de `GetDisplayedDamage` y `GetDisplayedHeat` de cada clase (desensamblados del ejecutable), sobre `StatsData` con los quirks del `QuirkSet` aplicados **en el orden de la lista**, cada uno sobre el resultado del anterior (los blueprints `/Game/Quirks/*_Quirk`: `Damage_Quirk` y `Cooldown_Quirk` suman su valor; los `…Percentage_Quirk`, × (1 + valor)). Proyectiles: (`Damage` + `CachedExplosionDamageDisplay`) × disparos de la ráfaga × proyectiles; calor, `HeatGenerated` × disparos. Misiles: misiles × disparos × `Damage` (o × `CachedExplosionDamageDisplay` si no hacen daño directo, como el Arrow IV); calor, misiles × `HeatGenerated` × disparos. Rayos: `DamageOverDuration` y `HeatGeneratedOverDuration`. Cuerpo a cuerpo: `Melee.Damage` |
| Enfriamiento, duración del rayo y alcances | `Cooldown`, `Trace.Duration`, `OptimalRange` y `MaxRange`, con los quirks del nivel |
| Tiempo de la salva | Proyectiles: `NumberOfTimesToFire × DelayBetweenFiring`; misiles: `NumberOfMissiles × MissileInterval` |
| AMS | `MissileDestructionRate` de cada nivel (el nivel 3 lo trae en su asset: 4,025 frente a 3,5) y `MaxRange` |
| Cuerpo a cuerpo | `Melee.Damage`, `Melee.Duration` y `Cooldown` |

Las armas de los mods dejan de salir una vez por nivel en el inventario (`CEERPPC79`, `CEERPPC79_Lvl2`...): como las del juego, son un objeto con sus niveles. Además:

- **Munición:** la capacidad de cada caja (`Capacity`) también en la de los mods, o la de `ammoCapacity` de `Equipment_Properties.json` si YAML la cambia (la caja de AMS pasa de 2.000 a 5.000 disparos).
- **Propiedades de cada objeto:** como `FindEquipmentProperties` de YAML. YAML junta todos los `*_Properties.json` de los mods (de equipo y de armas) y, para cada objeto, combina las de cada antecesor de su etiqueta (`AmmoType` y `EquipmentType` en la munición, `EquipmentType` en el equipo, `WeaponType` en las armas), con la más concreta por encima; encima, las de su nombre; y debajo, en las armas, las de su id sin nivel (`Object_Merge` deja ganar al segundo objeto). Así, todos los MASC «Universal» pesan un 5 % del tonelaje y los superchargers suman un 10 % del motor por su etiqueta. Al arrancar, YAML sobrescribe además el nombre, las ranuras, el peso (`equipmentTons`) y la capacidad de munición (`ammoCapacity`) del equipo, también del juego base (`UpdateEquipmentNames`).
- **Equipo:** de esas propiedades, las de armas (`weapons`: `scope` y `groups`), movimiento, velocidad (`topSpeedMulti`), sensores, salto, peso (`relativeWeight`, `roundWeightType`, `roundWeightUp`, `engineRelativeWeight`, `structureWeightMulti`, `armorPerTon`, `armorWeightMulti`, `componentArmorWeightMulti`), refrigeración (`engineHeatsinkEfficiency`, `engineHeatsinkCapacity`, `bundledHeatsinks`, `internalHeatsinkBonus`, `coolingMulti`, `coolingMultiScope`, `heatCapacityBonus`) y armadura y estructura (`armorComponentFront`, `armorComponentRear`, `structureComponent` y sus multiplicadores); y del asset, su etiqueta, su `TechLevel` (lo que vale una propiedad que falta: TechLevel / 100), si es un disipador (`MWHeatSinkDataAsset`) y su refrigeración y capacidad (`HeatSink`). Las sondas, lo que su `SensorRangeModifier` pasa de 1; los computadores de puntería, el porcentaje de su rasgo.
- **Retrorreactores:** de su asset (`MWJumpJetDataAsset`, del juego y de YAEC), la velocidad inicial vertical (`InitialVelocityZ`, cm/s), el tiempo de encendido (`BurnTime`, s) y la curva de aceleración vertical (`AccelZCurve`, una `CurveFloat` lineal de cm/s² por número de retrorreactores montados: de 0 a 2.100 con 10 en las del juego).
- **Variantes:** de su MDA, el giro (`MoveStats.TurnSpeed`), el giro del torso (`TorsoTwistRate.Yaw`), el ángulo del torso (`TorsoTwistBounds.High.Yaw`, o 360 si `bIsYawUnbound`) y el de los brazos (`ArmTwistBounds.High.Yaw`).

Los ajustes de Yet Another Weapon son los de por defecto de su `gui_config.ini`: alcance máximo × 2 (`GlobalMaxRangeMultiplier`), duración de los láseres de pulsos × 0,7 (`TracePulseLaserDurationMultiplier`) y el resto de multiplicadores × 1.

## Reglas

Todas comprobadas con la captura del NSR-9J de serie con sus armas en nivel 3 y el Royal DHS Kit (criterio CA1).

- **Origen:** cada regla sale del código del mod (blueprints desensamblados con `tools/kismet.py`, que sigue los saltos por su posición en memoria) o del juego (funciones nativas desensambladas del ejecutable). Las capturas solo las comprueban. Las cuentas siguen las del juego en float32.
- **Lo instalado cuenta (✔):** cuentan todas las piezas montadas, también las `_FIXED`; una ranura interna vacía no monta nada. La conversión de serie de YAML deja vacía la ranura del tipo de motor de los 'Mechs de la Esfera Interior que no son omni y llevan motor estándar: `ENGINE_FIXED` (−5 % de calor) solo va en los omnimechs, y el GHR-5J da 15,12 de calor alfa, sin ese −5 % ([mechlab-yaml.md](mechlab-yaml.md#conversión-de-serie)).
- **Peso (✔, `CalculateMechTonnage` y `GetEquipmentWeightInternal`):** armas + 3 de cabina + giroscopio estándar (potencia / 100 hacia arriba; los superpesados tienen otras cifras, en [superpesados-yaml.md](superpesados-yaml.md)) + equipo − disipadores que faltan + estructura (tonelaje / 10 × su multiplicador, a la media tonelada **más cercana**) + armadura (puntos / armorPerTon × `componentArmorWeightMulti`). El equipo pesa: el giroscopio, RoundToHalfTon(|relativeWeight × estándar| − estándar); con `relativeWeight`, esa parte del tonelaje máximo a cuartos de tonelada (o lo que diga `roundWeightType`), como mínimo ±0,25; con `engineRelativeWeight`, esa parte del motor con su tipo, a la media tonelada hacia arriba; el resto, su peso. Si falta menos de lo que pesa un punto de armadura para el máximo, el peso es el máximo; después se redondea a centésimas. Por eso el JVN-11A de serie pesa 30 y no 29,99.
- **Disipadores del motor (✔, `DLCGetInstalledInternals`):** `bundledHeatsinks` del kit (1 por defecto; 2 los compactos) × ⌊potencia / 25⌋, como mucho 10, más `internalHeatsinkBonus`; los que faltan hasta 10 restan 1 t cada uno.
- **Refrigeración (✔, `MechCalculateCoolingCapacity` y `GetCoolingMultisForLoadout`):** disipadores del motor × 0,1 × (`engineHeatsinkEfficiency` / 0,1 del kit) × el multiplicador del torso central; + cada disipador montado (`Equipment.HeatSinks`) × el multiplicador de su ubicación; + la refrigeración propia del resto de piezas de disipador (los kits). Los multiplicadores empiezan en 1 en cada ubicación y suman los `coolingMulti`: los de `coolingMultiScope` «component», en la ubicación de la pieza; los demás (equipo y quirks), en todas. Capacidad: disipadores del motor × `engineHeatsinkCapacity` del kit + 30 + la de cada pieza de disipador + `heatCapacityBonus`.
- **Velocidad (✔, `DLCGetInstalledInternals`):** potencia / tonelaje × 16,2 × `topSpeedMulti` (suma de los del equipo y los quirks: Clan +6,7 %, Solaris +15 %, el giroscopio GYRO1 +5 %). Los motores primitivos rinden como potencia / 1,2, redondeada al múltiplo de 5 superior.
- **Armadura y estructura (✔, `GetTotalArmorWithBonuses`, `GetASBonusesFromLoadout` y `ApplyEquipmentPropertiesStructureBonuses`):** por superficie, (instalada + bonus) × su multiplicador, y todo × el `armorMulti` de los quirks y del equipo montado (`GetEquipmentArmorMulti`: la armadura Hardened, 2); la estructura, por ubicación, máxima × su multiplicador × el `structureMulti` de los quirks + bonus. Los bonus vienen del equipo y de las armas montadas (no de los ataques de los actuadores) y de los `armorBonus` y `structureBonus` de los quirks.
- **Bonificaciones (✔):** las dan los quirks de la variante y el equipo montado. Cada grupo (`groups`) se aplica a las armas cuya etiqueta o tecnología empieza por una de sus `tags`, o cuyo nombre sin nivel está en ellas, salvo las de `excludeTags`. Los quirks valen para todo el 'Mech salvo que su grupo diga `mechParts`. El equipo vale para todo el 'Mech salvo con `scope: "component"`, que solo vale para las armas de su ubicación. **Los multiplicadores se suman, no se multiplican** (`AddMulti` de YAML: `a + b − 1`, como mínimo 0,001): Improved Targeting (enfriamiento × 0,9) y SLDF (× 0,9) dan × 0,8; SLDF (calor × 0,9) y el Royal DHS Kit (× 0,92), × 0,82.
- **Enfriamiento:** el del nivel × `cooldownMulti`, como mínimo 0,01 s.
- **Daño y calor por disparo:** los del nivel × `damageMulti` y × `heatMulti`.
- **Rayos (✔):** la duración es la del nivel × `durationMulti`, y × 0,7 en los láseres de pulsos (`Weapon.Energy.Laser.Pulse`) y en los AMS láser ofensivos (`Weapon.AMS.LAMS` con «Offensive» en el nombre). Las ametralladoras de rayo (duración 0) dan su daño y su calor por segundo.
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
- **Cuerpo a cuerpo (✔):** daño × `damageMulti` y enfriamiento × `cooldownMulti`; daño por segundo = daño / (`Melee.Duration` + enfriamiento). Cuentan las armas montadas en anclajes de cuerpo a cuerpo, también las nudilleras de la mano, pero no los ataques de los actuadores (la «Mano de asalto»). Con el quirk Melee Specialization (+10 % de daño y −10 % de enfriamiento), la gran espada de asalto de nivel 1 hace 93,5 de daño y 17,48 por segundo.
- **Armadura y estructura de las armas (✔):** las armas cuerpo a cuerpo suman armadura y estructura a su ubicación, sin peso (`armorComponentFront` y `structureComponent` de `Weapon_Properties.json`, por etiqueta): la gran espada de asalto +40 y +32, los puños de asalto +10 y +8. El equipo con esas propiedades también las suma.
- **Movimiento:** cada cifra del MDA × su multiplicador (suma de los del equipo y los quirks), redondeada a un decimal.
- **Altura de salto (✔):** la estima el juego en C++ (`EstimateMaxJumpJetHeight`, desensamblada del ejecutable de MW5: su envoltorio se encuentra por la tabla de registro de funciones nativas de Unreal). Es el tiro vertical h = v₀·t + ½·a·t², en cm y truncado a entero, con v₀ = `InitialVelocityZ`, t = `BurnTime` y a = `AccelZCurve` evaluada en el número de retrorreactores montados, × (1 + bonificaciones de los rasgos del 'Mech); sin retrorreactores, 0. YAML la multiplica por `jumpJetFuelBurnTimeMulti` y `jumpJetZAccelMulti` del equipo y los quirks, la redondea, y el panel la pasa a metros con una división entera. Con los del juego (1.250 cm/s, 2,75 s y 210 cm/s² por retrorreactor): GHR-5J (70 t) con dos de clase III, 5.025,6 cm, 50 m; con cuatro, 66 m; JVN-11A (30 t) con seis de clase V, 82 m, como en las capturas. Los retrorreactores mejorados de YAEC (850 cm/s y 5 s) llegan mucho más alto: cuatro, 147 m.
- **Sensores (✔):** `GetSensorRange` del juego da 80.000 cm (la variable de consola `MW.TargetSystem.DefaultSensorRange`; ningún .ini la cambia) × (1 + los rasgos con `UI_GetIncreasedSensorRangePercent`, el de los computadores de puntería); `DLCMechSensorRange` de YAML le suma `sensorRangeBonus` y `sensorRangeBonusLance`, lo multiplica por `sensorRangeMulti` y `sensorRangeMultiLance` y suma lo que cada sonda pasa de 1. NSR-9J: 800 + 50 (Command 'Mech) + 100 (SLDF) = 950 m; con un computador Mk3, 800 × 1,14 + 150 = 1.062 m. El rasgo del computador no cuenta en el panel para las armas: sus quirks de armas solo se aplican en combate.

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
- **Redondeo (✔):** el juego calcula en float32 y cada cifra la enseña `MechStatWidget` con `Conv_FloatToText`: redondeo al par, separador de miles y de 0 a 2 decimales (2,395). Por eso los empates dependen del error de los float32: siete Medium Laser de nivel 3 dan 14,1749999 de calor alfa (14.17); la media de cuerpo a cuerpo del CP-10-P es 64,625 justo (64.62, al par); el AMS de nivel 3 intercepta 4,025000095 misiles/s (4.03). La web guarda las cifras de nivel con ese error y calcula en float32.
- **Weapon range (✔):** el mayor alcance máximo, **truncado** al metro (el juego lo redondea a centímetros y lo divide como entero: 2.395,8 → 2.395).
- **Melee dmg avg, Melee dmg/s avg:** la media de las armas de cuerpo a cuerpo; 0 sin ninguna.
- **AMS intercept/s:** la suma de misiles destruidos por segundo de los AMS (`MissileDestructionRate` × `missilesDestroyedMulti`); **AMS range**, el mayor alcance.
- **Ammo (✔):** la suma de la capacidad de las cajas, sin multiplicadores.
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
| CA1 | La build de referencia | se calcula el panel | Armor 599, Structure 304, Melee dmg avg 0, Alpha damage 62,1, Damage/s 16,47, Melee dmg/s avg 0, Weapon heat/s 4,02, Cooling heat/s 3, Turn rate 53,9, Alpha heat 13,99, Heat capacity 58, Torso twist 67,5, Jump height 0, Speed 48,6, Torso yaw 95, Weapon range 2.395, Sensor range 950, Arm yaw 30, AMS intercept/s 0, AMS range 0, Ammo 182 |
| CA2 | El panel | se pinta | tiene las 21 cifras con los títulos y el orden del juego |
| CA3 | El Gauss Rifle, el ER PPC y el Medium Pulse Laser | se consultan en nivel 3 | Gauss: 17,1 de daño, 0,9 de calor, 5,7 s y 726 m; ER PPC: 11,4, 9,9, 4,75 s y 825 m; Medium Pulse Laser: 6,6, 2,34, 3,0875 s, 0,585 s de rayo y 242 m. En nivel 1, las cifras del asset (Gauss 15, 1, 6 s y 660 m) |
| CA4 | Los quirks del NSR-9J y el Royal DHS Kit | se suman sus bonificaciones para un arma | enfriamiento × 0,8, calor × 0,82, alcance óptimo y máximo × 1,1 |
| CA5 | La build de referencia | se calcula cada arma | Gauss: 3,75 de daño por segundo y 2.395,8 m de alcance máximo; ER PPC: 3 de daño por segundo y 1.815 m; Medium Pulse Laser: rayo de 0,41 s, 2,29 de daño por segundo y 532,4 m |
| CA6 | Un arma de un mod con niveles (Cap ER PPC) | se busca en el inventario | sale una vez, con sus niveles del 1 al 5 |
| CA7 | Un arma en nivel 3 | se monta, se codifica la build y se decodifica | sigue en nivel 3, y el panel cambia con el nivel |
| CA8 | La build de referencia | se calcula el daño por alcance | a 500 m llega el daño de las seis armas salvo el Small Laser, con el Medium Pulse Laser ya bajando; a 2.400 m no llega ninguna; el radar tiene diez anillos de 250 m |
| CA9 | La tabla de análisis | se suman sus filas | dan el daño alfa, el daño por segundo y el calor del panel |
| CA10 | El GHR-5J de serie con sus armas en nivel 3 (Streak SRM 2, ER Large Laser, AMS y dos Medium Laser), motor estándar y cuatro retrorreactores de clase III | se calcula el panel | Armor 416, Structure 223, Melee dmg avg 0, Alpha damage 27,28, Damage/s 7,03, Melee dmg/s avg 0, Weapon heat/s 3,27, Cooling heat/s 2,2, Turn rate 85,9, Alpha heat 15,12, Heat capacity 52, Torso twist 108, Speed 64,8, Torso yaw 120, Weapon range 1.485, Sensor range 800, Arm yaw 30, AMS intercept/s 4,03, AMS range 220, Ammo 5.640 |
| CA11 | El CP-10-P de serie con una gran espada de asalto de nivel 1 en el brazo izquierdo en lugar de la claymore, con y sin nudilleras de asalto de nivel 2 en la mano derecha | se calcula el panel | con nudilleras: Armor 376, Structure 325, Melee dmg avg 64,62 y Melee dmg/s avg 12,82; sin ellas: 366, 317, 93,5 y 17,48. En los dos: Alpha damage 36,6, Damage/s 10,16, Weapon heat/s 3,14, Alpha heat 11,55, Cooling 1, Heat capacity 40, Turn rate 71,6, Torso twist 90, Torso yaw 80, Arm yaw 20, Weapon range 900, Sensor range 900, Ammo 880 |
| CA12 | El JVN-11A de serie con sus siete Medium Laser en nivel 3, Ferro, el Double Heat Sink Kit y seis retrorreactores de clase V | se calcula el panel | Armor 179, Structure 111, Alpha damage 38,5, Damage/s 8,19, Weapon heat/s 3,02, Cooling 2, Turn rate 126,8, Alpha heat 14,17, Heat capacity 50, Torso twist 150,7, Speed 97,2, Torso yaw 110, Weapon range 594, Sensor range 800, Arm yaw 35, Ammo 0 |
| CA13 | El GHR-5J de CA10 con un solo retrorreactor en cada pierna | se calcula el panel | Jump height 50; con los cuatro, 66; sin ninguno, 0; con cuatro retrorreactores mejorados de YAEC de clase III, 147 (la fórmula del juego con sus datos) |
| CA14 | El ADR-A de serie (quirk Clan) | se calcula el panel | Speed 103,71 (97,2 × 1,067) |
| CA15 | El JVN-11A de serie | se calcula su peso | 30 t, como en el juego (le faltan menos de 1/32 t) |
| CA16 | El Heavy Gauss en nivel 1 | se consulta su daño | 30,5 (25 + 5,5 de explosión) |
| CA17 | El NSR-9J de serie con un hombro blindado (`relativeWeight` 0,01) | se calcula su peso | pesa 1 t más (0,95 a cuartos de tonelada) |
| CA18 | El NSR-9J vaciado con un computador de puntería Mk3 | se calcula el panel | Sensor range 1,062 |
| CA19 | El NSR-9J vaciado con `COOLING_LINES` (`coolingMulti` 1,4 en su ubicación) en el torso derecho | se monta un disipador doble en ese torso | la refrigeración sube 0,28 |
| CA20 | El NSR-9J vaciado, sin núcleo, con el Royal DHS Kit | se monta un disipador doble en el torso izquierdo | Cooling 0,4 (0,2 del disipador + 0,2 del kit), Heat capacity 32 y 32 t, como en el juego |

## Fuera de alcance

- Los ajustes de Yet Another Weapon distintos de los de por defecto.
- Los quirks de piloto y las habilidades del piloto.
- La caída del daño de cada arma con la distancia más allá de la línea recta del radar (curvas `MWO_RangeData`, `DamageScaleAtMaxRange`).
- Los efectos de los computadores de puntería sobre las armas (velocidad del proyectil y alcance de los láseres), que el juego aplica como rasgos.
- Los rasgos de 'Mech de la cantina (`MWMechTraitDataAsset`: refrigeración, capacidad, velocidad, sensores y salto), que el generador no incluye porque no se montan en ranuras. Sí cuentan los rasgos del equipo (computadores de puntería).

## Pendiente de comprobar en el juego

- **Builds de serie:** con estas reglas y la conversión de serie de YAML ([mechlab-yaml.md](mechlab-yaml.md#conversión-de-serie)), 610 de 639 pesan su tonelaje (eran 343, y 434 antes de leer la conversión); las demás, en la especificación del MechLab. Las ranuras de los brazos con armas cuerpo a cuerpo (el CP-10-P) ya cuadran con las reglas de ranuras de YAML (CA34 de [mechlab-yaml.md](mechlab-yaml.md)).

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/combat.test.ts` (CA1 y CA3 a CA9).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: el panel con el NSR-9J, cambiar el nivel de un arma en el inventario y en el tablero, el análisis y el radar.
