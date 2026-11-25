# Especificación: MechLab con las reglas de YAML

- **Issue:** [#175](https://github.com/PonchoiDev/mechlab-web/issues/175)
- **Estado:** en beta: datos, lógica y página `/mercs/yaml/` (RF1 a RF7, y RF8 sin las builds guardadas)
- **Depende de:** el extractor de los datos de los mods ([#176](https://github.com/PonchoiDev/mechlab-web/pull/176))
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/gameReference.test.ts` y `src/utils/yaml/mechlab.test.ts`) y por último el código, en commits separados.

## Contexto

*Yet Another Mechlab* (YAML) es el mod de MW5 Mercenaries más pedido por los usuarios de MW Builder. Cambia las reglas del mechlab por las del juego de mesa: las armas ocupan ranuras, el motor se divide en núcleo y tipo, la estructura, la armadura, el giroscopio y la cabina son equipo que se puede cambiar, y el Endo y el Ferro ocupan ranuras repartidas por el 'Mech.

Las reglas son incompatibles con las del MechLab actual, así que YAML tiene su propia página. Las builds y los enlaces que ya existen no cambian.

Solo cuentan YAML y sus mods de apoyo del Workshop de Steam:

| Mod | Id | Versión de referencia |
|---|---|---|
| Yet Another Mechlab | 2549720490 | 0.99.4.3 |
| Yet Another Weapon | 2512405187 | 2.9.3 |
| Yet Another Weapon Clan | 2512385719 | 2.9.4 |
| Yet Another Equipment Collection | 2734262706 | 4.1.3 |

YetAnotherClanMech (2815252243) queda fuera: declara la versión 1.1.0 del juego y con la actual cierra el juego al empezar una carrera, así que sus 'Mechs no se pueden comprobar.

## Datos

`tools/extraer_yaml.py` lee los `.pak` y los `Resources/` de los mods y guarda el volcado en `tools/datos-juego/yaml/`. Ese volcado no se sube al repositorio, porque es trabajo de los autores de los mods; se publican solo los datos que se generan a partir de él.

| Dato | Origen | Contenido |
|---|---|---|
| Variantes | MDA (`MWMechDataAsset`) | Tonelaje, ranuras por tipo y ubicación (`SlotData`: generales, actuadores, motor, giroscopio, armadura, estructura, cabina, sensores...), anclajes elegidos (`SelectedWeaponHardPoints`), estructura y armadura máximas, potencia de motor de serie |
| Builds de serie | Loadouts (`MWMechLoadoutAsset`) | Armas en cada anclaje, equipo en cada ranura y armadura instalada |
| Anclajes | HPS (`MWMechHardpointAsset`) y modelos (MDL) | Cada anclaje con su ubicación y su tipo de ranura. YAML trae varios por posición (`Torso_Left_MH1_lrm10`, `_lrm15`, `_lrm20`); el MDA elige los suyos |
| Equipo | `MWHeatSinkDataAsset` y demás clases de equipo | Núcleos de motor (`std100` a `std400`), tipos de motor, giroscopios, cabinas, estructuras, armaduras, disipadores, kits de refrigeración del motor, actuadores y el resto |
| Propiedades del equipo | `Resources/*Equipment_Properties.json` | Multiplicadores de peso (`engineRelativeWeight`, `relativeWeight`, `structureWeightMulti`, `armorWeightMulti`, `armorPerTon`), ranuras de relleno (`fillerSlots`), conflictos, requisitos y efectos |
| Armas | Armas de YAW, YAW Clan y del juego base | Tonelaje, tipo de ranura (`WeaponSlotTypeAssetId`) y estadísticas (DataTables de YAW) |
| Tipos de ranura | `MWSlotTypeDataAsset` de los mods y **del juego base** | Tamaño (`SlotSize`). Los del juego base no están en nuestras exportaciones: el extractor los tiene que leer también del `.pak` del juego |
| Reglas de tamaño | Blueprint `EquipmentUtilities` de YAML (`reglas.json`) | Lo que YAML cambia al arrancar: el tamaño de los tipos de ranura del juego base (AC/10 de 4 a 7, AC/20 de 7 a 10, PPC y ER PPC de 2 a 3...) y el tipo de ranura de las armas de los DLC (LB 20-X Ballistic11, Light Gauss Ballistic5...) |
| Quirks | `Resources/quirks.json` y `Resources/mechs.json` | Los quirks de cada variante o chasis, con bonificaciones de armadura y estructura y modificadores |

Un asset con la misma ruta que otro del juego, o que otro de un mod con menor orden de carga, lo sustituye. `tools/generar_yaml.py` aplica esas sustituciones y las reglas de `reglas.json`, y genera `src/data/yaml/mechs.json` e `items.json`.

**Decisiones sobre los datos:**

- **Variantes disponibles:** las 639 del MechLab de MW5 (sin las de campaña, tutorial, jefes ni cinemáticas), con el MDA de YAML y, si YAML no trae otro, el loadout del juego. Las 183 variantes nuevas de YAML quedan para más adelante: entre ellas hay jefes, rellenos técnicos (`YAML_RUNONCE_DUMMY`, `PARTIAL_SALVAGE`) y versiones de lore que hay que filtrar una a una.
- **Build de serie:** el loadout se convierte como lo hace YAML al cargar (`YAMLGlobals`): primero `ReplaceAllLegacyEquipment` y después `FixVanillaLoadouts`, de `EquipmentUtilities`; las armas con nivel, `MediumLaser_Lvl2`, son el arma con su nivel. Las reglas están en [Conversión de serie](#conversión-de-serie). Los contrapesos con los que YAML compensa el peso al convertir (`YAML_VANILLA_COUNTERWEIGHT`, −1000 t) y los rellenos de los loadouts no se guardan: los rellenos los coloca la web.
- **Ids:** los mismos ids de variante que en el MechLab de MW5.
- **Ajustes de la partida:** se usan los valores por defecto de YAML. Los ajustes de `gui_config.ini` que cambian el mechlab (multiplicador de ranuras críticas, anclajes omni, armas de una ranura, niveles de permiso del mechlab) quedan fuera.

## Reglas del mechlab

Cada regla marcada con ✔ está comprobada con capturas del juego, con YAML 0.99.4.3 y solo sus mods de apoyo activos. Las cifras están en los criterios de aceptación.

- **Ranuras por ubicación:** como las deja YAML al cargar (`EquipmentUtilities` y `MechlabDynamicFillerHandling.GetOpenCritSlots`), las del juego de mesa:
  - `FixMdaGeneralSlots` sube las ranuras generales del MDA a un mínimo: 6 en la cabeza, 13 en el torso central, 12 en cada torso lateral y cada brazo, y 6 en cada pierna (los superpesados y los cuadrúpedos tienen otros mínimos y quedan fuera).
  - `Fix Special Slot Counts` pone una ranura propia de sensores, FCS, cabina, soporte vital y defensa en la cabeza y una de armadura, estructura, giroscopio, refrigeración y motor en el torso central; `Inject Actuator Slots`, una por actuador.
  - `GetOpenCritSlots` resta a las generales lo que ocupan las ranuras propias que cuentan (cuántas × su tamaño): todas salvo las generales, las de disipadores del motor, las de retrorreactores y las que YAML oculta (`hideSlot` de la tabla `YAMLSlotTypeDatas`: brazo, pierna, ECM, sonda, MASC y contrapeso). Con el tipo de motor de 4, el giroscopio de 3 y el resto de 1, quedan las del juego de mesa: 1 en la cabeza, 2 en el torso central y 8 en cada brazo y 2 en cada pierna con sus 4 actuadores.
  - Una pieza montada en una ranura propia que cuenta ocupa sus `Slots` en lugar del tamaño de las ranuras que admite, salvo en las que ignoran el de la pieza (`ignoreEquipSlots`: armadura, estructura y refrigeración). En el torso central del NSR-9J quedan 2 generales con el giroscopio estándar (3), 4 con el Compact (1) y 0 con el XL (5); los tipos de motor XL, XXL y Light ocupan los 4 de su ranura.
  - Un arma cuerpo a cuerpo ocupa el tamaño de su ranura − 1 (`GetWeaponCrits`). Antes, `Inject Actuator Slots` resta 1 al tamaño de las ranuras cuerpo a cuerpo que no son de antebrazo, porque la de mano de asalto ocupa más de 1: un arma mediana (4 → 3) ocupa 2 y las manos y antebrazos, 0.
  - Los MDA propios de YAML (NSR-9J) ya traen esas cifras; los del juego base (WHM-DNC: 4 generales en el torso izquierdo y 6 en cada brazo) se quedan con 12 y 9 en el juego.
- **Armas repartidas:** un arma de más de 7 ranuras (`GetCritSplitMinWeaponSize`) ocupa 7 en su ubicación y el resto, primero en las ranuras libres de esa misma ubicación (`GetOpenCritSlots`) y lo que quede, entero, como relleno fijo en la primera ubicación contigua con sitio (`InstallRequiredFillers`); si no cabe en ninguna, el arma no cabe. Contiguas (`GetAdjacentMechParts`): del torso central, los torsos laterales; de cada torso lateral, el central y su brazo; de cada brazo, su torso lateral; la cabeza y las piernas no tienen. El AC/20 del SD1-O ocupa 9 en el brazo izquierdo y 1 en el torso izquierdo, y el C-Arrow IV del NGA-PRIME, 10 en cada brazo y 2 en cada torso lateral. Los rellenos dinámicos van después.
- **Equipo de serie sin ranura:** una pieza del loadout del juego en una ranura oculta de un tipo que el MDA no tiene en esa ubicación no llega al mechlab, como en el MechLab de MW5: el JR7-IIC-FY trae un retrorreactor de clase V en el torso central, donde su MDA no tiene ranura de retrorreactor, y el juego le da 6 retrorreactores y 34,43 t. No está localizada la función del juego que lo descarta.
- **Equipo de ranuras ocultas:** `SetSpecialEquipmentSlotType` quita al equipo de retrorreactores, MASC, superchargers, ECM y sondas (`Equipment.JumpJets`, `.MASC`, `.SuperCharger`, `.ArenaSuperCharger`, `.ECM`, `.BAP`) sus tipos de ranura ocultos; si no le queda ninguno, va en las generales. Los superchargers ocupan 1 ranura. `FixVanillaLoadouts` pasa también a las generales el equipo de serie que el loadout trae en ranuras ocultas.
- **Armas (✔):** necesitan un anclaje libre de su tipo **y** tantas ranuras libres de su ubicación como el tamaño de su tipo de ranura, con las reglas de `reglas.json` aplicadas (AC/10 7, AC/20 10, Gauss 7, ER PPC 3, AC/2 1). Los anclajes se siguen contando por tipo.
- **Tamaño de arma y anclaje (✔):** YAML cambia el tamaño de arma (`WeaponSize`) de todos los tipos de ranura de armas, así que el tamaño ya no limita qué arma cabe en un anclaje: basta con un anclaje de su tipo y sus ranuras libres. Un AC/20 (10 ranuras) cabe en un brazo con anclaje balístico solo si tiene 10 ranuras libres; los 8 generales del brazo del NSR-9J no bastan.
- **Motor (✔):** un núcleo (`stdNNN`, con el peso del motor estándar de esa potencia: `std285` pesa 16,5 t y `std105` 3,5 t) y un tipo que multiplica ese peso por `1 + engineRelativeWeight` (XL × 0,5), **redondeado hacia arriba a la media tonelada** (XL 285: 8,25 → 8,5; XL 105: 1,75 → 2,0), y ocupa ranuras fijas (`fillerSlots`: el XL, 3 en cada torso lateral). Sin núcleo, el motor pesa 0. Velocidad máxima = potencia / tonelaje × 16,2 (NSR-9J: 285 / 95 × 16,2 = 48,6 km/h; 105 / 95 × 16,2 = 17,91 km/h).
- **Estructura (✔):** 10 % del tonelaje × `structureWeightMulti`, **redondeado hacia arriba a la media tonelada**. En 95 t: estándar 9,5; Endo (× 0,5) 4,75 → 5,0; reforzada (× 1,5) 14,25 → 14,5. Los puntos de estructura se multiplican por `structureMulti` (la reforzada, × 2).
- **Armadura (✔):** puntos instalados / `armorPerTon` (32 la estándar) × `armorWeightMulti`, **sin redondeo**. Los puntos de los quirks (`armorBonus`) no pesan ni cuentan para el máximo: la cabeza del NSR-9J enseña «24+7/30».
- **Ranuras dinámicas (✔):** el equipo con `fillerSlots.dynamic` (Endo 14, Ferro 14, Heavy Ferro 21, sus versiones Clan 7) necesita ese número de ranuras generales libres en cualquier ubicación, que el mechlab rellena con «Dynamic filler».
- **Cabina (✔):** la estándar pesa 3 t. El inventario del juego enseña la Small a −1,0 t y la Primitive a +2,0 t respecto a ella.
- **Giroscopio (✔):** potencia / 100 redondeado hacia arriba, × `relativeWeight` del giroscopio (el estándar y el Agility, × 1; el XL, × 0,5). Sin núcleo pesa 0. En 285: estándar 3, XL 1,5; en 105: estándar 2, XL 1.
- **Disipadores del motor (✔):** el núcleo trae ⌊potencia / 25⌋ disipadores, como mucho 10, del tipo de su kit de refrigeración (Engine Single Heat Sinks, Royal DHS Kit...). **Cada disipador que falta hasta 10 resta 1 t** (con el núcleo 105, 4 disipadores y −6 t). Con disipadores simples, cada uno da 0,1 de refrigeración y 1 de capacidad sobre una base de 30: núcleo 285, 1,0 y 40; núcleo 105, 0,4 y 34.
- **Kits dobles (✔):** con el Double Heat Sink Kit, cada disipador del motor da 0,2 de refrigeración y 2 de capacidad (`engineHeatsinkEfficiency`, `engineHeatsinkCapacity`): núcleo 285, 2,0 y 50. El Royal DHS Kit da lo mismo, +0,2 de refrigeración («Heat efficiency») y −8 % de calor de las armas: 2,2 y 50.
- **Disipadores fuera del motor (✔):** leídos de `MechCalculateCoolingCapacity`, con las demás reglas de peso, refrigeración, velocidad, armadura y estructura, en [estadisticas-yaml.md](estadisticas-yaml.md).
- **Quirks (✔ en parte):** los del `mechs.json` de los mods se enseñan en el tablero, y sus bonificaciones de armadura y estructura se suman («15+5/15»). Los modificadores de combate se enseñan como texto.
- **Peso total:** la suma de motor, giroscopio, cabina, estructura, armadura, armas, munición y equipo. Se puede pasar del tonelaje, como en el MechLab de MW5.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/yaml/`, con la cabecera común de MW Builder y un aviso de que usa las reglas de YAML con sus versiones de referencia.
- **RF2.** El selector de 'Mechs del MechLab de MW5, con las variantes de YAML y sus quirks.
- **RF3.** Tablero con las ocho ubicaciones como en el juego: ranuras generales y propias, anclajes por tipo, armas con sus ranuras, equipo, rellenos fijos y dinámicos, actuadores, armadura delantera y trasera con las bonificaciones de los quirks, y estructura.
- **RF4.** Selector de objetos con armas, munición y equipo de YAML, con el tamaño en ranuras y el peso de cada uno, que dice si cabe en la ubicación elegida y, si no, por qué (sin anclaje, sin ranuras, sin ranuras libres para los rellenos dinámicos, conflicto con otro equipo).
- **RF5.** Cambiar el núcleo y el tipo de motor, el giroscopio, la cabina, la estructura, la armadura y el kit de refrigeración desde sus ranuras propias.
- **RF6.** Lectura de la build con las mismas cifras que el mechlab del juego: peso, armadura, estructura, daño alfa, daño por segundo, calor, refrigeración, capacidad de calor y velocidad.
- **RF7.** Estado de la build con sus problemas: sobrepeso, ranuras, anclajes y rellenos dinámicos que no caben.
- **RF8.** Build de serie, enlace para compartir y builds guardadas propias, que no se mezclan con las del MechLab de MW5.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/yaml/`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle: no carga los datos del MechLab de MW5 ni al revés.
- **RNF4.** Las builds guardadas usan claves propias (`mw-builder:yaml:*`) y el archivo exportado dice `game: "mw5-yaml"`.
- **RNF5.** Funciona a 1440 × 900 y a 390 × 844.
- **RNF6.** Los datos de `src/data/yaml/` no se editan a mano: salen de los scripts.

## Conversión de serie

Reglas leídas del bytecode de `EquipmentUtilities` (YAML), en el orden en que se aplican:

1. **Piezas antiguas** (`ReplaceLoadoutLegacyEquipment`). Un motor antiguo en la ranura del motor se separa en el núcleo `std` con la potencia de las tres cifras que siguen al prefijo y su tipo: `lfe` Light, `xl` XL, `xxl` XXL, `MeowsClanXL` XL Clan, `ClanXXL` XXL Clan y `engine_compact_` Compact (`GetTypeFromLegacyEngine`). Una pieza que no existe y acaba en `_H`, `_M` o `_L` pasa a la misma sin el sufijo (`ENDO_M` es `ENDO`).
2. **Loadouts ya convertidos.** Si el torso central lleva un núcleo de motor (`FindEngineInLoadout`, etiqueta `Equipment.Engine.Core`), el loadout se queda como está.
3. **Tipo de 'Mech** (`MechTypeOmni`), por los quirks del MDA, el modelo y la variante en `mechs.json` (sin distinguir mayúsculas): 3 con `OMNI-MECH` y `CLAN-MECH`; 1 con `OMNI-MECH`; 2 con `CLAN-MECH` o con la tecnología `TechBase.Clan` del MDA; 0 en otro caso.
4. **Piezas del torso central** según el tipo (0 / 1 / 2 / 3; un guion deja la ranura vacía, que es la pieza estándar):

| Ranura | Condición del MDA | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| Armadura | Ferro o Ferro Clan | `FERRO` | `FERRO_FIXED` | `CFERRO` | `CFERRO_FIXED` |
| Armadura | otra | - | `ARMOR_STANDARD_FIXED` | - | `ARMOR_STANDARD_CLAN_FIXED` |
| Estructura | Endo o Endo Clan | `ENDO` | `ENDO_FIXED` | `C79ENDO` | `C79ENDO_FIXED` |
| Estructura | otra | - | `STRUCTURE_STANDARD_FIXED` | - | `STRUCTURE_CLAN_FIXED` |
| Núcleo | `EngineRating` | `std<potencia>` | `std<potencia>_FIXED` | `std<potencia>` | `std<potencia>_FIXED` |
| Refrigeración | disipadores dobles o dobles Clan | `Cooling_diss100` | `Cooling_diss100_FIXED` | `CLAN_DHS_KIT` | `CLAN_DHS_KIT_FIXED` |
| Refrigeración | otros | - | `SHS_KIT_FIXED` | - | `CLAN_SHS_KIT_FIXED` |
| Giroscopio | | - | `OMNI_GYRO_FIXED` | - | `CLAN_OMNI_GYRO_FIXED` |

5. **Tipo de motor** (`GetEngineAsset`), por las ranuras del motor en cada torso lateral (`EngineSideTorsoSlots`; 0 si el MDA no lo trae, porque el constructor de `FMechData` no lo inicializa): 0 o 1 estándar (vacío en los tipos 0 y 2, `ENGINE_FIXED` en el 1 y `ENGINE_CLAN_FIXED` en el 3); 2 Light en la Esfera Interior (`ENGINE_LIGHT`, `_FIXED` en el 1) y XL en los Clanes; 3 XL (`ENGINE_XL`, `ENGINE_XL_FIXED`, `ENGINE_XL_CLAN`, `ENGINE_XL_CLAN_FIXED`); de 4 a 6 XXL, con los mismos sufijos. Ningún 'Mech de los mods trae la configuración `autoconv` de `mechs.json`, que cambiaría el motor, el giroscopio o el número de núcleos.

## Criterios de aceptación

Las cifras de CA1 a CA14 salen de capturas del mechlab del juego con el NSR-9J (95 t) y van en `src/utils/yaml/gameReference.test.ts`.

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El NSR-9J de serie | se carga | pesa 95 de 95 t (8,5 de motor, 3 de giroscopio, 3 de cabina, 9,5 de estructura, 18,5 de armadura, 37,5 de armas con el Small Laser de la cabeza, 7 de munición y 4 disipadores dobles), va a 48,6 km/h, tiene 599 puntos de armadura (592 instalados y 7 del quirk de la cabeza) y 304 de estructura; lleva núcleo 285 con motor XL, con 3 ranuras fijas en cada torso lateral |
| CA2 | El NSR-9J de serie sin sus tres láseres (Small Laser de la cabeza y Medium Pulse Laser de cada brazo), como lo monta el «Default loadout» del juego | se calcula | pesa 90,5 t |
| CA3 | El NSR-9J | se cuentan sus ranuras | cada torso lateral tiene 12 generales, el torso central 2, cada brazo 8 (más hombro, brazo, antebrazo y mano), cada pierna 2 (más cadera, muslo, pierna y pie) y la cabeza 1 |
| CA4 | Las armas del inventario | se consulta su tamaño | AC/10 7 ranuras y 12 t, AC/2 1 y 6 t, AC/20 10 y 14 t, AC/5 BF 4 y 8 t, ametralladora 1 y 0,5 t, Gauss 7 y 15 t, Light Gauss 5 y 12 t, LB 2-X 3 y 6 t, LB 20-X 11 y 14 t, ER PPC 3 y 7 t |
| CA5 | El NSR-9J de serie | se cambian las dos Gauss por dos AC/2 | pesa 77 t |
| CA6 | El NSR-9J de serie | se quitan las dos Gauss y el Medium Pulse Laser del brazo derecho y se pone un AC/10 en el brazo derecho y un AC/2 en el izquierdo | pesa 81 t |
| CA7 | El NSR-9J de serie | se cambia la armadura por la Primitive (× 1,495) | pesa 104,16 t |
| CA8 | El NSR-9J de serie | se cambia la estructura por la reforzada | pesa 100 t y tiene 603 puntos de estructura (+299) |
| CA9 | El NSR-9J vacío, sin núcleo de motor, con armadura Heavy Ferro | se calcula | pesa 27,42 t y ocupa 21 ranuras con rellenos dinámicos |
| CA10 | El NSR-9J vacío, sin núcleo de motor, con estructura Endo y armadura estándar | se calcula | pesa 26,5 t y ocupa 14 ranuras con rellenos dinámicos |
| CA11 | El NSR-9J vacío, con armadura y estructura estándar, motor XL, giroscopio estándar y sin núcleo | se calcula | pesa 31 t, con 0 de refrigeración y 30 de capacidad |
| CA12 | El de CA11 | se pone el núcleo 285 | pesa 42,5 t, va a 48,6 km/h y tiene 1,0 de refrigeración y 40 de capacidad; con el giroscopio Agility sigue en 42,5 t y gira 5,3 °/s más; con el giroscopio XL pesa 41 t |
| CA13 | El de CA11 con el núcleo 105 | se calcula | con el giroscopio estándar pesa 29 t y con el XL 28 t; va a 17,91 km/h y tiene 0,4 de refrigeración y 34 de capacidad; cambiar el motor XL por el estándar suma 1,5 t |
| CA14 | El de CA11 con el núcleo 285 | se pone el Double Heat Sink Kit / el Royal DHS Kit / el Royal DHS Kit y un disipador doble en el torso derecho | pesa 42,5 t con 2,0 de refrigeración y 50 de capacidad / 42,5 t, 2,2 y 50 / 43,5 t y 52 de capacidad |
| CA15 | Un 'Mech con Endo y sin 14 ranuras generales libres | se intenta montar | no cabe, y el motivo dice cuántas ranuras faltan |
| CA16 | Un arma | se monta | necesita un anclaje libre de su tipo y sus ranuras libres; en el NSR-9J vacío, un AC/20 (10) en el brazo derecho ocupa sus 8 ranuras y 2 del torso derecho |
| CA17 | Los datos | se generan | las variantes tienen los mismos ids que en el MechLab de MW5; ninguna es de campaña, tutorial, jefe ni cinemática; las reglas de `reglas.json` están aplicadas a los tipos de ranura |
| CA18 | Una build | se codifica y se decodifica | sale la misma build; un código del MechLab de MW5 no se abre como build de YAML |
| CA19 | El SD1-O, omnimech de la Esfera Interior con el loadout del juego | se genera su build de serie | lleva `std360_FIXED`, `ENGINE_XL_FIXED`, `OMNI_GYRO_FIXED`, `ARMOR_STANDARD_FIXED`, `STRUCTURE_STANDARD_FIXED` y `Cooling_diss100_FIXED` |
| CA20 | El EBJ-PRIME, omnimech Clan | se genera su build de serie | lleva `std325_FIXED`, `ENGINE_XL_CLAN_FIXED`, `CLAN_OMNI_GYRO_FIXED`, `CFERRO_FIXED`, `C79ENDO_FIXED` y `CLAN_DHS_KIT_FIXED`, y pesa 65 de 65 t |
| CA21 | El INC-1, Clan sin ser omni | se genera su build de serie | lleva `std270`, `ENGINE_XL_CLAN`, `CFERRO`, `C79ENDO` y `CLAN_DHS_KIT`, sin giroscopio |
| CA22 | El GHR-5J, de la Esfera Interior con motor estándar | se genera su build de serie | solo lleva el núcleo `std280`: armadura, estructura, tipo de motor, refrigeración y giroscopio quedan vacíos |
| CA23 | El ARC-T, con `ENDO_H` en su loadout | se genera su build de serie | lleva la estructura `ENDO` |
| CA24 | Las 639 builds de serie | se calculan | al menos 610 pesan su tonelaje exacto |
| CA25 | Las builds de serie del KFX-C, el INC-A y el WHM-DNC, con capturas del juego | se calculan | pesan 30 de 30, 29,97 de 30 y 61,99 de 70 t; las 21 cifras del panel del KFX-C y el INC-A coinciden con el juego, y en el WHM-DNC todas menos armadura, estructura y velocidad |
| CA26 | El NSR-9J y el GHR-5J, con MDA de YAML | se cuentan sus ranuras | siguen como en CA3 |
| CA27 | Los WHM-DNC, KFX-C e INC-A de serie, con MDA del juego base | se cuentan sus ranuras | el WHM-DNC tiene 12 generales en cada torso lateral y 9 en cada brazo, el KFX-C 12 en cada torso lateral y 8 en cada brazo, y el INC-A 12 en cada torso lateral y 8 en cada brazo; después de los rellenos dinámicos les quedan 8, 8 y 22 libres, como en las capturas del juego, y ninguno tiene avisos de ranuras |
| CA28 | El ECM, la sonda activa, el MASC y los retrorreactores | se montan | van en las ranuras generales y ocupan sus ranuras; el ECM de serie del KFX-C está en las generales del brazo derecho |
| CA29 | El NSR-9J de serie | se cambia el giroscopio por el Compact o el XL, o el motor por el Light | el torso central tiene 4 o 0 generales en vez de 2; con el Light sigue con 2, y le quedan 2 fijas en cada torso lateral, como en las capturas |
| CA30 | El HBK-VEST y el CRD-5M de serie | se cuentan sus ranuras | la Escuadra Mediana del HBK-VEST ocupa 2 en su brazo y caben los 14 rellenos Endo sin dejar ninguna libre; al CRD-5M le quedan 10 libres, como en las capturas |
| CA31 | El SD1-O y el NGA-PRIME de serie | se cuentan sus ranuras | el AC/20 del SD1-O deja 1 ranura de relleno en el torso izquierdo y el C-Arrow IV del NGA-PRIME, 2 en cada torso lateral, como en las capturas; ninguno tiene avisos de ranuras |
| CA32 | Un arma de más de 7 ranuras | no hay sitio para su resto en ninguna ubicación contigua | no se puede montar y el aviso lo dice |
| CA33 | El JR7-IIC-FY de serie | se calcula | lleva 6 retrorreactores, pesa 34,43 de 35 t como en la captura y no tiene avisos de ranuras |

## Fuera de alcance

- YetAnotherClanMech y el resto de mods de 'Mechs que no son de YAML.
- Los ajustes de la partida de YAML que cambian el mechlab: multiplicador de ranuras, anclajes omni, armas de una ranura y niveles de permiso.
- Los 'Mechs superpesados (más de 100 t) y los cuadrúpedos.
- La reparación, el coste de reequipar y los días de trabajo.
- Los quirks de piloto (afinidades).

## Pendiente de comprobar en el juego

- Las builds de serie que no pesan su tonelaje: con la conversión de serie y las reglas de peso de `CalculateMechTonnage` ([estadisticas-yaml.md](estadisticas-yaml.md)), 610 de 639 lo dan exacto. Las otras 29 se quedan por debajo; dos están comprobadas con capturas del juego, que marca lo mismo (CA25): el INC-A pesa 29,97 de 30 t y el WHM-DNC 61,99 de 70 (YAML le pone motor XL, por sus 3 ranuras laterales, y el loadout del juego no llena las 8 t que libera).
- La armadura, la estructura y la velocidad del WHM-DNC de la captura (375,9, 299,2 y 85,7 km/h) son las de la web por 1,05, 1,1 y 1,15. Son los tres rasgos de 'Mech que trae instalados su loadout del juego (`InstalledTraits`: Refined Armor II, +5 % de armadura; Fortified Internal Structure II, +10 % de estructura; Boosted Top Speed, +15 % de velocidad), que la web todavía no lee.

- El peso de serie del NSR-9J: con estas reglas suma 95,5 t (8,5 de motor, 3 de giroscopio, 3 de cabina, 9,5 de estructura, 18,5 de armadura, 42 de armas, 7 de munición y 4 disipadores dobles) y el juego marca 95. Puede que uno de los disipadores dobles esté en una ranura del motor y no pese, como los disipadores del motor en el juego de mesa.
- Las ranuras fijas de los motores XXL, Light y Compact, y de los motores Clan.
- Dónde coloca el juego los rellenos dinámicos (`GetMechpartsInFillerPositioningOrder`): en el WHM-DNC de serie el juego pone 2 de Ferro en cada brazo y la web los junta en el brazo derecho. El número y las ranuras libres sí coinciden.
- Quitar actuadores de los brazos (antebrazo y mano) para montar armas grandes.
- Las ranuras del WHM-DNC de serie: la web avisa de que los rellenos dinámicos necesitan 14 ranuras libres y solo quedan 3, y de que no caben las 3 fijas del motor XL en los torsos; en el juego caben. Puede ser el mismo descuadre que las ranuras de los brazos con cuerpo a cuerpo.

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/gameReference.test.ts` (CA1 a CA14, con las cifras de las capturas), `src/utils/yaml/mechlab.test.ts` (CA15 a CA18) y `src/utils/yaml/stockConversion.test.ts` (CA19 a CA25, la conversión de serie) y `src/utils/yaml/slots.test.ts` (CA26 a CA33, las ranuras).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: elegir un 'Mech, montar y quitar armas y equipo, cambiar el motor, la estructura y la armadura, ver los rellenos dinámicos y los avisos de lo que no cabe, compartir y guardar una build.
