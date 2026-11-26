# Especificación: un solo computador de puntería y otro equipo que no se puede repetir

- **Estado:** en curso
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/equipRestrictions.test.ts`, `src/utils/inventory.test.ts`, `src/utils/buildActions.test.ts` y `src/utils/yaml/mechlab.test.ts`) y por último los datos y el código, en commits separados.

## Contexto

Un jugador avisa de que el MechLab deja montar varios computadores de puntería en el mismo 'Mech, y el juego solo admite uno (lo dice también su descripción: «Only 1 targeting computer can be installed»). La página de equipo ya lo cuenta, pero el MechLab no lo comprueba.

## Datos del juego

- **Restricciones de montaje:** cada objeto puede traer `EquipRestrictions`, una lista de subobjetos. Los computadores de puntería del juego (Mk1 a Mk7) traen uno de clase `KelLoadoutRestrictionFunction_UniqueEquipment` con `EquipmentTag=Equipment.TargetingComputer`. Ningún otro objeto del juego base trae restricciones.
- **Qué comprueba** (ejecutable del juego, `0x140f676e0`): busca su `EquipmentTag` en el recuento de etiquetas del loadout y falla si ya hay `MaxEquipment` o más (1 por defecto, en el constructor de la clase). El recuento (`0x140f7e7b0`) suma la etiqueta `EquipmentType` de cada arma y cada pieza de equipo montada con sus etiquetas padre: un Mk3 (`Equipment.TargetingComputer.Mk3`) cuenta para `Equipment.TargetingComputer`.
- **YAML:** trae la misma restricción en más equipo:
  - sus computadores de puntería (Mk8, Mk9 y los Targeting Computer Mk. 1 a 9 de `TCLVL1` a `TCLVL9`): `Equipment.TargetingComputer`;
  - sus sondas Clan y la Bloodhound: `Equipment.AP` y `Equipment.BAP`;
  - su ECM Clan: `Equipment.ECM`;
  - sus MASC Clan: `Equipment.TripleStrengthMyomer`, y su TSM: `Equipment.MASC`. El TSM no se puede montar con ningún MASC, y los MASC Clan de YAML no se pueden montar con el TSM; el MASC del juego no trae restricción, así que sí se puede montar después del TSM.
  - Los TCLVL2 a TCLVL9 usan el subobjeto de TCLVL1.
- **El volcado de YAML** guardaba solo el nombre de la restricción: `extraer_yaml.py` guarda ahora sus subobjetos con su etiqueta.

## Requisitos funcionales

- **RF1.** `generar_items.py` guarda la etiqueta `EquipmentType` de cada pieza de equipo (`equipmentTag`) y sus restricciones (`restrictions`: etiqueta y máximo). `generar_yaml.py` hace lo mismo con el equipo de YAML (su etiqueta ya está en `category`).
- **RF2.** Un objeto con restricciones no se puede montar si lo ya montado en el 'Mech (en cualquier ubicación, sin contar el propio objeto si se está moviendo) suma tantas piezas como su máximo con esa etiqueta o una hija.
- **RF3.** En el MechLab de MW5 se aplica al equipar desde el inventario (arrastrando, con clic derecho o eligiendo ubicación), al duplicar y al mover. El inventario no marca como destino válido una ubicación donde no se puede, y el aviso dice por qué: «Only one Targeting Computer per 'Mech».
- **RF4.** Un enlace o una build guardada con dos computadores carga solo el primero, como al montarlos a mano.
- **RF5.** En el MechLab de YAML se aplica al montar equipo, con el mismo aviso.
- **RF6.** El MechLab de BATTLETECH no cambia: no tiene computadores de puntería ni esta restricción.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El Targeting Computer Mk1 / Mk7 en `items.json` | se consulta | lleva `equipmentTag` `Equipment.TargetingComputer.Mk1` / `.Mk7` y la restricción `Equipment.TargetingComputer` con máximo 1 |
| CA2 | Un 'Mech con un Targeting Computer Mk1 en el torso izquierdo | se equipa un Mk5 en el torso derecho desde el inventario | no se monta y el aviso dice «Only one Targeting Computer per 'Mech» |
| CA3 | El mismo 'Mech | se mueve el Mk1 al torso derecho | se mueve |
| CA4 | El mismo 'Mech | se pide el menú de duplicar del Mk1 | no hay destinos |
| CA5 | Un enlace con dos computadores | se carga | solo queda el primero |
| CA6 | Un 'Mech sin computador | se equipa uno | se monta |
| CA7 | Un 'Mech de YAML con un MASC MK I (C) | se monta el Triple Strength Myomer | no se monta, con el aviso de que no se puede con el MASC MK I (C) |
| CA8 | Un 'Mech de YAML con el Targeting Computer Mk. 1 de YAML (`TCLVL1`) | se monta el Targeting Computer Mk. 3 (C) del juego | no se monta, con el aviso «Only one Targeting Computer per 'Mech» |

## Fuera de alcance

- Otras clases de restricción (`KelLoadoutRestrictionFunction_MatchAny`, `_MechPart`): ni el juego ni YAML las usan en su equipo.

## Plan de pruebas

- Tests de los criterios en los archivos de arriba.
- En el navegador: el MechLab con dos computadores (arrastrar, clic derecho, duplicar) y el de YAML con MASC y TSM.
