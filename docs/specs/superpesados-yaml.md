# Especificación: 'Mechs superpesados en el MechLab de YAML

- **Issue:** parte de [#175](https://github.com/PonchoiDev/mechlab-web/issues/175)
- **Estado:** en desarrollo
- **Depende de:** el MechLab de YAML ([mechlab-yaml.md](mechlab-yaml.md)) y sus estadísticas ([estadisticas-yaml.md](estadisticas-yaml.md))
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/superheavy.test.ts`) y por último el código, en commits separados.

## Contexto

YAML trae cuatro 'Mechs de más de 100 t: el ANH-1GT (Annihilator, 200 t), el COR-ROAM (Corsair, 115 t) y los MAD-BARA2 y MAD-TF (Marauder II, 125 t). El ANH-1GT queda fuera: es el 'Mech de pruebas del autor de YAML («Testing for superheavy and double engines»), con un solo núcleo y 133 de 200 t, y no aparece en la lista de 'Mechs de la acción instantánea. Hasta ahora no estaban en el MechLab porque YAML les aplica reglas propias: más ranuras, actuadores más grandes, dos núcleos de motor y otro cálculo del peso.

## Reglas

Leídas del bytecode de YAML 0.99.4.3 (`EquipmentUtilities`, `MechlabArmorHandling` y `MechSetup`, con `tools/kismet.py`). Cada regla marcada con ✔ está comprobada con las capturas del mechlab del juego del MAD-BARA2 y el MAD-TF.

- **Qué es un superpesado (`SuperheavyCheck`):** un 'Mech de 105 t o más que no tiene el quirk «ILLEGAL». Lo son los cuatro.
- **Ranuras generales (✔, `FixMdaGeneralSlots`):** el mínimo al que YAML sube las del MDA es 7 en la cabeza, 20 en el torso central, 24 en cada torso lateral y cada brazo y 12 en cada pierna (en el resto de 'Mechs, 6, 13, 12, 12 y 6). Después se restan las ranuras propias que cuentan, como en el resto de 'Mechs.
- **Actuadores (✔, `GetActuatorSlotTypeForInternalEquipment`):** los superpesados tienen sus propias ranuras de actuador (`Superheavy_Shoulder_SlotType`, `Superheavy_Hip_SlotType`...), de 2 ranuras cada una. Un brazo con hombro, brazo y antebrazo se queda con 24 − 6 = 18 generales, y una pierna con sus cuatro actuadores, con 12 − 8 = 4. El equipo de actuadores de los 'Mechs normales no cabe en ellas, ni el de los superpesados (`SH_IMPROVED_ACTUATORS`, `SH_HIP_ARMORED`...) en las normales.
- **Dos núcleos de motor (✔):** los loadouts de serie de los superpesados traen dos núcleos iguales en el torso central. El ajuste de YAML `enableDualCores`, que por defecto está apagado, daría a los superpesados dos ranuras de motor (`Fix Special Slot Counts`); sin él tienen una, pero el juego monta los dos núcleos del loadout. El primero va en la ranura de motor y el segundo como equipo del torso central: se puede quitar, pero no volver a poner, porque la única ranura de motor ya está ocupada (vuelve con la build de serie). `FindEngineInLoadout` y `DLCGetInstalledInternals` cuentan todos los núcleos montados en el torso central:
  - La velocidad es potencia / tonelaje × 16,2 × núcleos (MAD-BARA2: 300 / 125 × 16,2 × 2 = 77,76 km/h).
  - Los disipadores del motor y sus ranuras se multiplican por los núcleos; los que faltan hasta 10, que restan 1 t cada uno, se cuentan con uno solo.
  - El tipo de motor pesa su parte de un núcleo × núcleos (`GetEquipmentWeightInternal`); cada núcleo pesa lo suyo.
- **Peso (✔, `CalculateMechTonnage`):**
  - La cabina estándar pesa 4 t en lugar de 3.
  - El giroscopio estándar pesa la potencia de un núcleo / 50 hacia arriba en lugar de / 100 (`GetStandardGyroWeightFromEngine`): 6 t con el núcleo 300.
  - La estructura pesa el doble: tonelaje / 10 × 2 × el multiplicador de su pieza.
- **Armadura con multiplicador del equipo (✔, `GetEquipmentArmorMulti` en `GetASBonusesFromLoadout`):** el `armorMulti` de cada pieza montada multiplica la armadura de todo el 'Mech, sumándose a los de los quirks como los demás multiplicadores (`AddMulti`). La armadura Hardened tiene 2: el MAD-TF enseña 1.736 puntos con 744 instalados y 124 de quirks. Esta regla no es solo de los superpesados: vale para cualquier 'Mech con armadura Hardened, que hasta ahora contaba sus puntos una vez.

## Requisitos funcionales

- **RF1.** Los tres superpesados jugables están en el selector de 'Mechs del MechLab de YAML, con su build de serie y sus quirks.
- **RF2.** El tablero enseña sus ranuras y actuadores con las reglas de arriba, y el segundo núcleo como equipo del torso central. Cada actuador ocupa las ranuras de su tipo (`size` de `slots.json`: 2 en los superpesados y 1 en el resto), y el juego lo dibuja con ese alto. La web lo enseña como el resto de piezas de varias ranuras: en una línea con «2 slots» al lado y, con las ranuras desplegadas, con el alto de dos celdas.
- **RF3.** La lectura de la build da las mismas cifras que el mechlab del juego.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los datos de YAML | se generan | están el COR-ROAM (115 t), el MAD-BARA2 y el MAD-TF (125 t), marcados como superpesados; ningún otro 'Mech lo está y el ANH-1GT no está |
| CA2 | El MAD-BARA2 de serie | se cuentan sus ranuras | la cabeza tiene 2 generales, el torso central 9, cada torso lateral 24, cada brazo 18 y cada pierna 4; sus actuadores son los de los superpesados; antes de los rellenos dinámicos le quedan 0 libres en la cabeza, 1 en el torso central, 16 en el izquierdo, 5 en el derecho, 12 en cada brazo y 3 en cada pierna, como en la captura |
| CA3 | El MAD-BARA2 de serie | se calcula el panel | 125 de 125 t; Armor 720, Structure 495, Alpha damage 179,5, Damage/s 43,23, Weapon heat/s 10,5, Cooling 5,6, Turn rate 50,4, Alpha heat 43,23, Heat capacity 86, Torso twist 63, Speed 77,76, Torso yaw 70, Weapon range 2.475, Sensor range 1.328,12, Arm yaw 26, AMS intercept/s 12,25, AMS range 300, Ammo 5.336, como en la captura |
| CA4 | El MAD-TF de serie, con armadura Hardened | se calcula el panel | 125 de 125 t; Armor 1.736, Structure 384, Alpha damage 186,6, Damage/s 56,95, Weapon heat/s 10,36, Cooling 4,2, Turn rate 46,9, Alpha heat 37,26, Heat capacity 72, Torso twist 58,6, Speed 68,04, Torso yaw 70, Weapon range 1.125, Sensor range 2.109,38, Arm yaw 26, AMS intercept/s 12,25, AMS range 300, Ammo 1.820, como en la captura |
| CA5 | El MAD-BARA2 de serie | se quita el segundo núcleo | le quedan 2 ranuras de disipadores del motor y se desmontan 2 de sus 4 disipadores dobles de esas ranuras; va a 38,88 km/h, con 3,2 de refrigeración y 62 de capacidad, y pesa 113,5 t, como en la captura |
| CA6 | Un brazo del MAD-BARA2 | se monta equipo de actuadores | caben los Superheavy Improved Actuators y no los Improved Actuators; en el NSR-9J, al revés |
| CA7 | El NSR-9J de serie | se cambia la armadura por la Hardened | tiene 1.198 puntos de armadura (599 × 2) |
| CA8 | Los actuadores del COR-ROAM y del NSR-9J | se cuentan sus ranuras | cada actuador del brazo y de la pierna del COR-ROAM ocupa 2; los del NSR-9J, 1 |

## Fuera de alcance

- El ajuste `enableDualCores` y el resto de ajustes de los superpesados de `gui_config.ini` (`enableSHMobilityEquipment`): se usan sus valores por defecto.
- Los cuadrúpedos.

## Pendiente de comprobar en el juego

- El COR-ROAM pesa 115 de 115 t con estas reglas, sin captura.

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/superheavy.test.ts` (CA1 a CA8).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: elegir el MAD-BARA2, ver sus ranuras y actuadores, quitar el segundo núcleo y volver a la build de serie, montar equipo de actuadores y ver los actuadores con el alto de dos ranuras, plegados y desplegados.
