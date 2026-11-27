# Especificación: piezas por clase de peso en el MechLab de YAML

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/weightClass.test.ts`) y por último el código, en commits separados.
- **Depende de:** [filtros-inventario-yaml.md](filtros-inventario-yaml.md) (el inventario del MechLab de YAML).

## Contexto

En el mechlab del juego con YAML, cada MASC y cada supercargador es de una clase de peso, y hay piezas solo para 'Mechs de un tonelaje: los núcleos de motor de 440 y 500, los retrorreactores mejorados de clase I o las piezas «SH» de los superpesados. El juego no las enseña en el inventario de un 'Mech que no puede llevarlas y no deja montarlas. La web las deja montar en cualquiera: se puede poner un MASC MK V en un Locust.

La regla está en el bytecode del mod:

- `MechlabEquipmentInstallation.CheckEquipmentWeightClassConflicts`, que llama `EquipmentUtilities.EquipmentMatchesUiFilter` (con `inMechlab`) para el inventario y la instalación del equipo.
- `MechlabFunctionLibrary_79.CheckEquipmentWeight`: el tonelaje mínimo y máximo de la pieza, en las propiedades del mod (`minTonnage`, `maxTonnage`), por el nombre exacto de la pieza (`EquipmentProperties.GetEquipmentProperty` no recorre sus etiquetas).
- `MechlabFunctionLibrary_79.DLCGetMechEquipmentClass`: la clase de peso del 'Mech por su tonelaje máximo.

## Requisitos funcionales

- **RF1. Clase del 'Mech** (`DLCGetMechEquipmentClass`), por su tonelaje: hasta 25 t, clase 1; de 30 a 45 t, clase 2; de 50 a 65 t, clase 3; de 70 a 85 t, clase 4; de 90 a 100 t, clase 5; más de 100 t, clase 6. Fuera de esos tramos no tiene clase.
- **RF2. MASC y supercargadores.** Una pieza cuya etiqueta (`EquipmentType`) contiene «SuperCharger» o «MASC», sin distinguir mayúsculas, solo va en un 'Mech cuya clase aparece en la etiqueta (Equipment.MASC.Class3 y Equipment.MASC.Class3.Clan, clase 3; los supercargadores de arena también). Las universales (Equipment.MASC.Universal, Equipment.SuperCharger.Universal y sus hijas) van en todos. En un 'Mech sin clase, o de clase 6, no va ninguna que no sea universal.
- **RF3. Tonelaje mínimo y máximo.** Con `minTonnage`, la pieza no va en un 'Mech de menos toneladas; con `maxTonnage`, no va en uno de más.
- **RF4. En el MechLab.** Esas piezas no salen en el inventario del 'Mech, no se montan (desde el inventario, desde la ranura interna o con el clic derecho) y explican por qué. Una build que ya las lleve (guardada o compartida antes) avisa de cada una.

## Requisitos no funcionales

- **RNF1.** El tonelaje mínimo y máximo sale de las propiedades del mod con `tools/generar_yaml.py`, por el nombre de la pieza.
- **RNF2.** La regla va en `src/utils/yaml/`, con sus tests.
- **RNF3.** Sin novedad en la campana.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los tonelajes 20, 25, 30, 45, 50, 65, 70, 85, 90, 100, 115 y 125 | se pide su clase | 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6 y 6 |
| CA2 | El MASC MK III y el MASC MK III (C) | se montan en un 'Mech de 55 t y en uno de 35 t | van en el de 55 t y no en el de 35 t, con el motivo |
| CA3 | El Arena Supercharger MK II | se monta en un 'Mech de 35 t y en uno de 55 t | va en el de 35 t y no en el de 55 t |
| CA4 | Un superpesado | se le monta un MASC o un supercargador | no va ninguno |
| CA5 | Las piezas «SH» y el Jump Jets-I Class I | se comprueban en 'Mechs de 100, 115 y 125 t | las «SH» solo van en los de 115 y 125 t; el retrorreactor, en el de 100 t y no en los superpesados |
| CA6 | El núcleo de motor 440 | se elige en la ranura de un 'Mech de 75 t y de uno de 80 t | en el de 75 t sale con su motivo y no se monta; en el de 80 t no tiene ese motivo |
| CA7 | El inventario de un 'Mech de 35 t | se lee, sin «Fits» | no lleva el MASC MK III y sí el MASC MK II |
| CA8 | Una build de 35 t que ya lleva un MASC MK III | se comprueba | avisa de que esa pieza no va en un 'Mech de su clase |

## Fuera de alcance

- La opción «loreAbidingCitizen» del mod, apagada por defecto.

## Plan de pruebas

1. **Lógica (CA1 a CA8):** `src/utils/yaml/weightClass.test.ts`.
2. **Interfaz:** en el navegador: en un FS9-S1 (35 t), el filtro Mobility sin el MASC MK III; en el Marauder II MAD-BARA2, ningún MASC; la ranura del núcleo de un 'Mech de 75 t con el 440 marcado.
