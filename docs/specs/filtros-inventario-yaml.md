# Especificación: filtros del inventario de YAML como en el mod

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/inventory.test.ts`) y por último el código, en commits separados.
- **Depende de:** [mechlab-yaml.md](mechlab-yaml.md) (el inventario del MechLab de YAML).

## Contexto

El inventario del MechLab de YAML copia las pestañas del juego base: All, Energy, Ballistic, Missile, AMS, Melee, Equipment y Ammo. El mod Yet Another Mechlab cambia el inventario del mechlab del juego por diecinueve filtros en tres filas, con sus iconos y colores, y deja montar desde el inventario las piezas internas (núcleos y tipos de motor, giroscopios, armadura, estructura, cabina...). En la web todo el equipo cae en una sola pestaña de casi cien piezas, y las piezas internas solo se cambian pulsando su ranura del tablero.

Los filtros están en la tabla `YamlInventoryFilters` del .pak del mod (`Plugins/YetAnotherMechlab/Content/Mechlab/UI/`), con su categoría (`weapon` o `equipment`), su subcategoría, su texto de ayuda, sus etiquetas, su color y su icono (texturas del juego base). Cómo decide el mod qué pieza entra en cada filtro sale del bytecode de `MechlabInventoryPanelWidget` (`Update Inventory Filter`, `GetWeaponInventory`, `GetEquipmentInventoryNewItems`) y de `EquipmentUtilities.EquipmentMatchesUiFilter`.

## Requisitos funcionales

- **RF1. Los filtros del mod.** El inventario enseña los filtros de la tabla del mod, en su orden y en tres filas, como el juego:
  - **Armas:** ALL W, Ballistic, Energy, Missile, AMS, Melee y Artillery.
  - **Equipo:** ALL E, Ammunition, Cooling, Mobility, Electronic warfare, Sensors and targeting, y Armor and structure.
  - **Varios:** Misc, Engine cores, Engine types, Consumables and misc, y Defensive upgrades.

  Cada filtro lleva el icono y el color del juego, su texto de ayuda («Filter ballistic weapons») y el número de piezas que deja. ALL W y ALL E llevan su texto en lugar de icono.
- **RF2. Qué entra en cada filtro**, como `EquipmentMatchesUiFilter`:
  - **Armas:** las que tienen una etiqueta de tipo (`WeaponType`) igual a una de las del filtro o hija de ella (Weapon.Ballistic deja Weapon.Ballistic.Artillery).
  - **Equipo y munición:** si la pieza tiene categoría en las propiedades del mod (`category` de `Equipment_Properties.json`), entra cuando esa categoría empieza por «equipment.» y la subcategoría del filtro, sin distinguir mayúsculas; así Misc deja también los núcleos y los tipos de motor. Si no, entra cuando su etiqueta (`EquipmentType`) es una de las del filtro o hija de ella. En el filtro de munición la etiqueta tiene que ser exactamente una de las suyas (Equipment.Ammo o Ammo), y los consumibles (Ammo.Consumable) no entran.
  - Las piezas «fixed» y los rellenos no salen nunca.
- **RF3. Sin filtro.** Al abrir el inventario no hay ningún filtro marcado y salen todas las piezas. Pulsar el filtro marcado lo quita. Al elegir una ubicación en el tablero, el filtro se quita, como ahora con la pestaña All.
- **RF4. Piezas internas en el inventario.** Los núcleos y tipos de motor, giroscopios, armaduras, estructuras, cabinas, kits de disipadores del motor, sensores, FCS, soporte vital y sistemas defensivos salen en el inventario. Se montan como el resto (arrastrándolas, eligiéndolas y pulsando una ubicación, o con el clic derecho) en la ubicación que tiene su ranura, sustituyendo la pieza que haya, con las mismas comprobaciones que al elegirlas desde la ranura. Pulsar la ranura interna en el tablero sigue enseñando lo que admite.
- **RF5. Colores.** Los colores de la tabla son lineales; la web los pasa a sRGB, como los pinta el juego.

## Requisitos no funcionales

- **RNF1.** Los filtros, sus iconos y las etiquetas de cada pieza salen del .pak del mod y del juego con los scripts de `tools/` (`extraer_yaml.py` y `generar_yaml.py`), no se escriben a mano.
- **RNF2.** La lógica del filtro va en `src/utils/yaml/inventory.ts`, con sus tests.
- **RNF3.** Sin novedad en la campana.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los filtros generados | se leen | son diecinueve, en tres filas de 7, 7 y 5, con los ids del mod (ballistic, energy, missile, ams, melee, artillery, ammo, cooling, mobility, electronics, sensorstargeting, internal, misc, misc.enginecore, misc.enginetype, misc.consumable, misc.defense y los dos ALL), cada uno con icono (salvo los ALL), color y texto de ayuda |
| CA2 | Un arma de artillería balística (etiqueta Weapon.Ballistic.Artillery) | se filtra | sale en Ballistic, en Artillery y en ALL W, y no en ALL E |
| CA3 | Una caja de munición y un disipador | se filtra por Ammunition | sale la caja y no el disipador; la caja sale también en ALL E |
| CA4 | Un núcleo de motor | se filtra | sale en Engine cores, en Misc y en ALL E, y no en Engine types |
| CA5 | El PPC Capacitor (etiqueta Equipment.Misc, categoría `equipment.electronics` en las propiedades del mod) | se filtra | sale en Electronic warfare y no en Misc ni en Consumables and misc: manda la categoría del mod |
| CA6 | El inventario | se lee | lleva los núcleos de motor y no las piezas «fixed» ni los rellenos |
| CA7 | Un núcleo de motor del inventario | se monta en el torso central | queda como núcleo del 'Mech; en un brazo no cabe |
| CA8 | Los colores | se pasan a sRGB | el de Ballistic (0.31, 0.22, 0.48 lineal) da #9781b8 |

## Fuera de alcance

- Las piezas que el juego oculta y no deja montar en 'Mechs de otra clase de peso (`CheckEquipmentWeightClassConflicts`: MASC y supercargadores por clase, piezas solo para superpesados). Es una regla de montaje que la web aún no aplica; va aparte.
- La opción «loreAbidingCitizen» del mod, apagada por defecto.

## Plan de pruebas

1. **Lógica (CA1 a CA8):** `src/utils/yaml/inventory.test.ts`.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: las tres filas, los colores y los iconos, cada filtro con su recuento, quitar el filtro, montar un núcleo de motor arrastrándolo y con el clic derecho.
