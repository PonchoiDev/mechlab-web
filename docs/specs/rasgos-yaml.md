# Especificación: rasgos de 'Mech en el MechLab de YAML

- **Issue:** [#175](https://github.com/PonchoiDev/mechlab-web/issues/175)
- **Estado:** implementada
- **Depende de:** el MechLab de YAML ([mechlab-yaml.md](mechlab-yaml.md)) y sus estadísticas ([estadisticas-yaml.md](estadisticas-yaml.md))
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/traits.test.ts` y `src/utils/upgrades.test.ts`) y por último el código, en commits separados.

## Contexto

Los rasgos de 'Mech (`MWMechTraitDataAsset`, las mejoras de la cantina) se instalan en cada 'Mech y ocupan sus huecos de rasgo. El MechLab de MW5 de la web ya permite ponerlos y quitarlos, pero ninguno de los dos MechLabs lee los que trae instalados el loadout del juego (`InstalledTraits`). El WHM-DNC, por ejemplo, sale de fábrica con Refined Armor II, Fortified Internal Structure II y Boosted Top Speed, y por eso el juego le da 375,9 de armadura, 299,2 de estructura y 85,7 km/h, frente a los 358, 272 y 74,52 de la web.

Las fórmulas salen del código: el bytecode de YAML (`MechAlphaStats.CalculateMechStats`, `MechlabArmorHandling`, `MechlabFunctionLibrary_79`, `EquipmentUtilities` y `YAMLGlobals`, desensamblados con `tools/kismet.py`) y las funciones nativas del juego que llama (desensambladas del ejecutable con `tools/ejecutable.py`).

## Reglas

- **Huecos de rasgo.** Los del MDA de YAML (`TotalTraitSlots`), que en 15 variantes no son los del juego base: `FixMdaGeneralSlots` los limita a `yamlMaxUpgradeTraitSlots`, que por defecto es 20 y no limita a ningún 'Mech.
- **Instalación.** Como en el MechLab de MW5: cada rasgo una vez (el I y el II se combinan) y entre todos no pasan de los huecos.
- **Rasgos de serie.** Los `InstalledTraits` del loadout que son rasgos de la cantina. Los de rol de YAML (`MechroleTrait_*`) y los de equipo (computadores de puntería) no son de la cantina y no se cuentan. La conversión de serie de YAML no los toca.
- **Cómo cuentan.** Las funciones nativas suman lo que da cada rasgo instalado para su estadística (`UI_GetIncreasedArmorPercent`, `UI_GetIncreasedStructurePercent`…) y multiplican por máx(0, 1 + suma). Con eso:

| Cifra del panel | Regla | Código |
|---|---|---|
| Armadura | la instalada de cada superficie × (1 + armadura); los bonus de YAML de cada superficie, también × (1 + armadura) | `GetInstalledArmorForPart` (nativa), `GetTotalArmorWithBonuses` y `GetArmorTraitMultiplier` |
| Estructura | la máxima de cada ubicación × (1 + estructura); los bonus de YAML de cada ubicación, también × (1 + estructura) | `GetMaxStructureForPart` (nativa), `ApplyEquipmentPropertiesStructureBonuses` y `GetStructureTraitMultiplier` |
| Velocidad | `TopSpeedPercent` = `topSpeedMulti` del equipo y los quirks × (1 + velocidad) − 1: el rasgo multiplica, no suma | `DLCGetInstalledInternals` |
| Refrigeración y capacidad de calor | × (1 + refrigeración) y × (1 + capacidad) | `DLCMechCoolingQuirks` en `CalculateMechStats` |
| Giro y giro del torso | × (1 + giro) y × (1 + giro del torso) | `GetTurnSpeed` y `GetTorsoTwistSpeed` (nativas) |
| Alcance de sensores | 800 m × (1 + computadores de puntería + sensores) | `GetSensorRange` (nativa); el panel llama a `DLCMechSensorRange` sin su suma de rasgos |
| Altura de salto | la aceleración vertical × (1 + aceleración vertical de los retrorreactores); el rasgo de tiempo de combustión no cambia la estimación | `EstimateMaxJumpJetHeight` (nativa) |
| Daño, calor, enfriamiento y alcance de las armas | no cambian: el panel usa los datos del arma y las bonificaciones del loadout (`GetWeaponBonusesFromLoadout`), sin rasgos | `GetAlphaStrikeStats` y `GetModifiedWeaponDisplayStats` |
| Peso | no cambia: los rasgos no pesan | `CalculateMechTonnage` |

## Datos

- `tools/generar_traits.py` guarda también la aceleración vertical de los retrorreactores (`Jump Jet Accel Z Percent`) de Jump Jet Thrust.
- `tools/generar_yaml.py` guarda los huecos de rasgo de cada variante (`upgradeSlots`) y los rasgos de serie en su build de serie (`stock.traits`).
- `tools/generar_mechs.py` mete los rasgos de serie en la build de serie del MechLab de MW5.

## Interfaz

El MechLab de YAML tiene el botón de mejoras de la barra de herramientas y el panel de mejoras del MechLab de MW5, con los huecos de su MDA. El panel avisa de que los rasgos de armas solo actúan en misión. Los rasgos de serie entran al abrir la variante; después, cargar la build de serie no cambia los rasgos, como en el MechLab de MW5 (en el juego se instalan aparte del loadout). El código de la build lleva los rasgos, y una build sin rasgos tiene el mismo código que antes.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El WHM-DNC de YAML | se carga su build de serie | lleva Refined Armor II, Fortified Internal Structure II y Boosted Top Speed, de 7 huecos |
| CA2 | El WHM-DNC de serie | se calcula | da 375,9 de armadura, 299,2 de estructura y 85,7 km/h, como en la captura del juego, y el resto de cifras de la captura sin cambios |
| CA3 | El WHM-DNC de serie sin sus rasgos | se calcula | da 358 de armadura, 272 de estructura y 74,52 km/h, y pesa lo mismo (61,99 t) |
| CA4 | Un 'Mech de YAML | se instalan rasgos | cada uno una vez, el I y el II juntos, y no pasan de sus huecos; el ON1-P tiene 8 (6 en el juego base) |
| CA5 | El GHR-5J de serie | se instalan Faster Cooling, Heat Containment II, Anchor Turn I, Torso Twist Speed, Expanded Sensor Range I y Jump Jet Thrust (sus 7 huecos) y dos retrorreactores de clase III | la refrigeración × 1,05, la capacidad × 1,1, el giro × 1,075, el giro del torso × 1,2, los sensores 880 m y la aceleración vertical del salto × 1,15 |
| CA6 | El GHR-5J de serie | se instalan rasgos de armas | el daño, el calor, el enfriamiento y el alcance de las armas no cambian |
| CA7 | Una build de YAML con rasgos | se codifica y se decodifica | conserva sus rasgos; sin rasgos, el código es el de antes |
| CA8 | El WHM-DNC del MechLab de MW5 | se carga su build de serie | lleva sus tres rasgos |

## Fuera de alcance

- Los rasgos de piloto (afinidades) y los de rol de YAML.
- El coste y los días de instalar rasgos en la cantina.
- Los efectos que el panel no enseña (aceleración, regeneración de combustible, fijación de blancos).

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/traits.test.ts` (CA1 a CA7) y `src/utils/upgrades.test.ts` (CA8).
2. **Navegador:** abrir el WHM-DNC en /mercs/yaml/, comprobar las cifras de serie, quitar y poner rasgos y cargar un enlace con rasgos; abrir el WHM-DNC en /mercs/ y cargar su build de serie.
