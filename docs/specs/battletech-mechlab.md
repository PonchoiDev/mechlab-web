# Especificación: MechLab de BATTLETECH

- **Issue:** [#102](https://github.com/PonchoiDev/mechlab-web/issues/102)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/mechlab.test.ts`) y por último el código, en commits separados.

## Contexto

MW Builder tiene un MechLab para *MechWarrior 5: Mercenaries* en `/mercs/`. *BATTLETECH* (Harebrained Schemes, 2018, versión 1.9.1) tiene su propio mechlab por turnos, con reglas distintas: las armas ocupan ranuras y anclajes por tipo, el blindaje va en pasos de 5 puntos, no hay motor ni giroscopio que cambiar y el calor se mide por turno. Este MechLab vive en `/battletech/`, junto al mapa estelar (#103), y reúne todos los chasis y objetos del juego base y de los DLC, con filtros para elegir 'Mech y equipo.

Solo cuenta el juego sin mods, con sus DLC (Heavy Metal, Flashpoint y Urban Warfare). La carpeta `Mods/` no se lee. Los modpacks (BEX, RogueTech, BTA) quedan para más adelante (#104).

## Datos del juego

El juego base trae JSON sueltos en `BattleTech_Data/StreamingAssets/data/`. Los DLC guardan los suyos como TextAsset dentro de bundles de Unity 2018.4 (`data/assetbundles/heavymetal`, `flashpoint` y `urbanwarfare`). En esos bundles solo la tabla de bloques está comprimida con LZ4: `tools/unityfs.py` los lee en Python puro, sin dependencias.

| Dato | Archivo | Contenido |
|---|---|---|
| Chasis | `chassis/chassisdef_*.json` | Tonelaje (`Tonnage`), peso vacío (`InitialTonnage`), clase, retrorreactores máximos (`MaxJumpjets`), ubicaciones con sus anclajes, ranuras (`InventorySlots`), blindaje máximo delantero y trasero y estructura, equipo fijo (`FixedEquipment`), estabilidad, cuerpo a cuerpo y DFA, rol (`StockRole`), descripción (`YangsThoughts`), icono y movimiento (`MovementCapDefID`) |
| Variantes | `mech/mechdef_*.json` | El chasis, el inventario de serie (`MountedLocation`, `ComponentDefID`), el blindaje de serie (`AssignedArmor`, `AssignedRearArmor`), el coste y las etiquetas (`MechTags`) |
| Armas | `weapon/*.json` | Categoría (anclaje), daño, disparos por ataque (`ShotsWhenFired`), calor, inestabilidad, daño de calor, precisión, alcances (`MinRange`, `RangeSplit`, `MaxRange`), munición (`ammoCategoryID` o `AmmoCategory`), munición propia (`StartingAmmoCapacity`), peso, ranuras, coste, rareza y fabricante |
| Munición | `ammunitionBox/*.json`, `ammunition/*.json` | Capacidad de cada caja y su categoría |
| Disipadores | `heatsinks/*.json` | Disipación (`DissipationCapacity`) y los efectos de los bancos de calor (`MaxHeat`, `OverheatLevel`) y de los intercambiadores (`HeatGenerated` de las armas) |
| Retrorreactores | `jumpjets/*.json` | Capacidad y tonelaje mínimo y máximo del 'Mech |
| Mejoras | `upgrades/**/*.json` | Actuadores, cabina, giroscopios, sistemas de puntería y generales, con sus efectos (`statusEffects`) y ubicaciones permitidas |
| Movimiento | `movement/movedef_*.json` | `MaxWalkDistance` y `MaxSprintDistance`, en metros |
| Constantes | `constants/CombatGameConstants.json` (bloque `Heat`), `constants/MechStatisticsConstants.json` | 10 disipadores internos de 3, calor máximo 100, sobrecalentamiento al 0,6; 0,0125 t por punto de blindaje (80 por tonelada), pasos de 5 puntos, 625 C-Bills por punto |
| Iconos | `sprites/MechPortraits/uixTxrIcon_*.dds` | El icono de cada chasis (`Description.Icon`), en DXT5 de 128 px |

`tools/extraer_mechlab_battletech.py` lee la instalación y guarda en `tools/datos-juego/battletech/mechlab/` los chasis, las variantes, los componentes, la munición, el movimiento, las constantes y las etiquetas, cada cosa con su fuente (`base`, `heavymetal`, `flashpoint` o `urbanwarfare`), y en `battletech/public/mechlab/icons/` los iconos en PNG de 128 px. `tools/generar_mechlab_battletech.py` genera `src/data/battletech/mechs.json`, `items.json` y `constants.json`.

**Decisiones sobre los datos:**

- **Variantes disponibles:** las que llevan `unit_release` en `MechTags` y no llevan `BLACKLISTED`. Así quedan fuera las de las historias de los Flashpoint (`_fp_`), los muñecos de prácticas (`TARGETDUMMY`, `TESTDUMMY`) y las variantes de jefes. Son 96: 70 del juego base, 15 de Heavy Metal, 6 de Flashpoint y 5 de Urban Warfare, cada una con su propio chasis.
- **Id de la variante:** el del mechdef sin `mechdef_` (`hunchback_HBK-4G`). Los enlaces aceptan también el nombre de la variante (`HBK-4G`).
- **Componentes:** quedan fuera los ataques cuerpo a cuerpo y DFA (`Weapon_MeleeAttack`, `Weapon_DFAAttack`), el láser imaginario de la IA, las armas `_SPECIAL-Victoria`, el arma interna de los morteros (`Weapon_Mortar_*`; el jugador monta el `Gear_Mortar_*`), las plantillas y el módulo de los muñecos.
- **`BLACKLISTED` en un componente no lo descarta:** solo lo saca de las tiendas aleatorias. Lo llevan el Gauss, los láseres ER y de pulsos y el disipador doble, que se pueden montar.
- **Equipo de serie (`BUILT-IN`):** los módulos de mando, los capacitadores optimizados, el hacha del Hatchetman y el resto del equipo fijo de algunos chasis. Se enseña en su ubicación, cuenta para el peso y las ranuras y no se puede quitar ni montar en otro 'Mech.
- **Versiones mejoradas:** el número de «+» del nombre es el `_N-` del id. `Weapon_Laser_MediumLaser_2-Magna` es «M Laser + +», de Magna.
- **Ubicaciones permitidas:** `AllowedLocations` es una lista separada por comas con espacios irregulares («Torso, Legs», «LeftTorso,RightTorso»). `Torso` son los tres torsos, `Arms` y `Legs` los dos brazos y las dos piernas, y `All` todo. `DisallowedLocations` es un relleno de la plantilla y no se usa.
- **Categoría de munición:** la de las armas y municiones del juego base está en `ammoCategoryID`; las de Heavy Metal usan a veces `AmmoCategory` o `Category`. Vale la primera que no sea `NotSet`.
- **Movimiento:** andar y correr salen del movedef del chasis (`MaxWalkDistance`, `MaxSprintDistance`), no de `TopSpeed`. Si un chasis apunta a un movedef que no existe, el script avisa y la variante queda sin movimiento. En la versión 1.9.1 todos los chasis disponibles tienen el suyo, también el Bullshark BSK-M3.
- **`Heatsinks` del chasis:** 11 chasis lo traen a 30 (WHM-7A, AS7-D-HT, BSK-MAZ, PXH-1b y otros de jefes o campaña). Ninguno es una variante disponible, y su efecto está **por confirmar con una captura del juego**: se guarda en los datos pero no se suma a la disipación.
- **Etiquetas de rol:** el juego no da nombre visible a las de `MechTags` (`unit_role_brawler`, `unit_lance_support`…). El script les pone el que enseña la web: Brawler, Sniper, Scout, Flanker, Electronic warfare, Tank, Assassin, Support, Vanguard, Short/Medium/Long range, Fast, Slow, Heavy armor, Light armor, Runs hot e Indirect fire.

## Reglas del mechlab

- **Peso:** `InitialTonnage` del chasis + el equipo fijo + el inventario + (blindaje delantero + trasero) × 0,0125. El motor, el giroscopio y la cabina van dentro de `InitialTonnage`: no son componentes. La fórmula da exactamente el tonelaje del chasis en las 96 builds de serie. Pasarse es un error de la build, como en el juego, que no deja salir así.
- **Anclajes:** solo las armas los usan. Cada arma necesita un anclaje libre de su tipo en su ubicación: Energy, Ballistic, Missile o Support (`AntiPersonnel`: láseres pequeños, ametralladoras y lanzallamas). Se cuentan por ubicación y tipo.
- **Ranuras:** todo componente ocupa `InventorySize` ranuras de su ubicación, el equipo fijo incluido.
- **Ubicación:** cada componente solo va donde dice `AllowedLocations` (las mejoras de cabina en la cabeza, los giroscopios en el torso central, los retrorreactores en torsos y piernas).
- **Retrorreactores:** como mucho `MaxJumpjets` (los fijos, como el Vectored Thrust Kit, cuentan), y cada uno solo en 'Mechs de su tramo de tonelaje: Standard de 10 a 55 t, Heavy de 60 a 85 t y Assault de 90 a 100 t.
- **Blindaje:** el delantero hasta `MaxArmor` y el trasero hasta `MaxRearArmor`, por separado (16 ubicaciones de serie pasan de `MaxArmor` sumando los dos). La cabeza, los brazos y las piernas no tienen trasero. Los botones mueven 5 puntos (`ARMOR_PER_STEP`); el campo admite cualquier valor dentro del máximo, porque alguna build de serie (HGN-733P) no va en pasos de 5.
- **Reparto del blindaje:** «Distribute armor» reparte el tonelaje libre como el botón del juego, con los porcentajes de `ArmorAllocationRatio*` de `MechStatisticsConstants.json`, en pasos de 5 y sin pasar de los máximos.
- **Calor:** disipación = 10 × 3 (internos) + la de cada disipador montado o fijo. El calor de la salva es la suma de `HeatGenerated` de las armas, multiplicada por el de cada intercambiador térmico. Calor máximo 100 y sobrecalentamiento en 60, más lo que suman los bancos de calor.
- **Daño:** cada arma hace `Damage` × `ShotsWhenFired` por ataque (un LRM 20 son 20 misiles de 4); la inestabilidad y el daño de calor, igual. `ProjectilesPerShot` es solo visual. Los efectos del equipo que multiplican el daño de una categoría (los capacitadores optimizados, +20 % a las de energía; el BSC, +20 % a las balísticas) se aplican.
- **Alcance:** el daño por distancia suma las armas cuyo `MaxRange` llega a esa distancia, y aparte el de las que están por debajo de su `MinRange` (disparan con penalización).
- **Munición:** cada arma con categoría de munición necesita una caja de su categoría, salvo que traiga la suya (`StartingAmmoCapacity`: lanzallamas e Inferno). Los ataques que da la munición son (capacidad de las cajas + munición propia) / disparos por ataque de las armas que la comparten.
- **Movimiento:** andar y correr del movedef, multiplicados por los efectos `WalkSpeed` y `RunSpeed` del equipo (el TSM prototipo, × 1,5).
- **Coste:** coste del chasis + coste de los componentes montados + puntos de blindaje × 625. Da el coste de serie exacto en el HBK-4G, el AS7-D y el JR7-D; en otras variantes el `Cost` del mechdef está redondeado a mano y no coincide.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/`, con la cabecera de MW Builder: marca que lleva a `/`, título «MechLab», enlaces a `/battletech/starmap/` («Star map») y `/battletech/argo/` («Argo»), campana de novedades, Feedback y Support.
- **RF2.** Selector de 'Mech con búsqueda por nombre o variante y filtros por clase de peso, fuente (Base, Heavy Metal, Flashpoint, Urban Warfare), mínimo de anclajes de cada tipo, mínimo de retrorreactores que admite el chasis y etiquetas de rol. Cada fila enseña el icono, el tonelaje, los anclajes y la fuente.
- **RF3.** Tablero con las 8 ubicaciones: ranuras usadas, anclajes por tipo (usados y totales), el equipo montado y el fijo, y el blindaje delantero y trasero con botones de 5 puntos y su máximo.
- **RF4.** Selector de objetos con pestañas por categoría (Energy, Ballistic, Missile, Support, Ammo, Heat sinks, Jump jets, Upgrades), filtros por versión (stock, +, + +, + + +), fuente y rareza, búsqueda y orden (nombre, peso, daño, calor, daño por tonelada, coste). Cada objeto dice si cabe en la ubicación elegida y, si no, por qué.
- **RF5.** Lectura de la build: peso y tonelaje libre, blindaje, calor de la salva frente a disipación, daño de la salva, inestabilidad, andar y correr, retrorreactores, coste y estabilidad.
- **RF6.** Análisis del equipo: tabla de armas, daño por distancia, munición por tipo con los ataques que da, y bonificaciones del equipo.
- **RF7.** Estado de la build con sus problemas, de los errores (sobrepeso, ranuras, anclajes, retrorreactores) a los avisos (munición, anclajes libres, tonelaje sin usar, calor).
- **RF8.** Volver a la build de serie, vaciar armas, munición o equipo, quitar el blindaje y repartirlo.
- **RF9.** Enlace para compartir (`?b=`), apertura de una variante de serie (`?mech=`), builds guardadas en el navegador (guardar, abrir, duplicar, renombrar, borrar, exportar e importar) y comparación con otra variante de serie o una build guardada.
- **RF10.** El icono de cada chasis en el selector y en el tablero.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/`, con sus tests: reglas de montaje, peso y blindaje, calor, daño, munición, movimiento, coste, problemas, código de la build, builds guardadas, comparación y filtros.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle en `dist/battletech/`: no carga los datos de MW5.
- **RNF4.** Las builds guardadas y la campana usan claves propias (`mw-builder:battletech:*`) y el archivo exportado dice `game: "battletech"`: no se mezclan con las de MW5.
- **RNF5.** Funciona a 1440 × 900 y a 390 × 844.
- **RNF6.** Los datos no se editan a mano: salen de los dos scripts.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los datos | se cargan | hay 96 variantes (70 Base, 15 Heavy Metal, 6 Flashpoint y 5 Urban Warfare) de 96 chasis, ninguna `_fp_`, `TARGETDUMMY` ni `TESTDUMMY`; todas tienen icono, andar y correr |
| CA2 | Los objetos | se cargan | hay 210 armas (167 Base y 43 Heavy Metal), 16 cajas de munición, 8 disipadores, 4 retrorreactores y 72 mejoras; ninguno es un ataque cuerpo a cuerpo, el láser de la IA, `_SPECIAL-` ni una plantilla; el Gauss y el disipador doble están |
| CA3 | `Weapon_Laser_MediumLaser_2-Magna` | se consulta | se llama «M Laser + +», con 2 «+», nombre base «M Laser» y fabricante Magna |
| CA4 | Las 96 builds de serie | se pesan | todas pesan exactamente el tonelaje de su chasis; el HBK-4G pesa 50 t con 800 puntos de blindaje (10 t) |
| CA5 | El HBK-4G de serie | se monta un arma | un Medium Laser no cabe en el brazo izquierdo (su anclaje Energy está ocupado) ni en el torso derecho (no tiene anclajes Energy); un cuarto AC/2 no cabe en el torso derecho; un Small Laser (Support) no cabe en un anclaje Energy libre |
| CA6 | El HBK-4G vacío | se montan componentes | un disipador doble ocupa 3 ranuras; en una pierna (4 ranuras) caben uno doble y uno simple, pero no dos dobles |
| CA7 | Cualquier 'Mech | se monta equipo | un giroscopio solo va en el torso central, una mejora de cabina solo en la cabeza y un retrorreactor no va ni en los brazos ni en la cabeza |
| CA8 | El JR7-D (35 t, 5 retrorreactores de serie y 7 como máximo) / el HBK-4G (50 t) / el RFL-3N (60 t) | se monta un retrorreactor | el JR7-D admite dos más pero no un octavo; el HBK-4G admite el Standard pero no el Heavy; el RFL-3N admite el Heavy y no el Standard |
| CA9 | El MAD-3R | se carga | lleva el Lance Command Module fijo en el torso izquierdo, que cuenta para el peso y las ranuras, no está en el inventario de serie y no se puede quitar |
| CA10 | El blindaje | se cambia | no pasa del máximo delantero ni del trasero, no baja de 0, la cabeza no tiene trasero y los botones mueven 5 puntos; 80 puntos pesan 1 t |
| CA11 | El HBK-4G de serie | se calcula el calor | disipa 39 (30 + 3 disipadores) y su salva genera 54; con un Thermal Exchanger I genera 54 × 0,9 |
| CA12 | El HBK-4G de serie | se calcula la salva | hace 170 de daño y 40 de inestabilidad; a 90 m llegan los 170, a 270 m 150 y a 360 m nada |
| CA13 | El AS7-D de serie | se calcula la salva | el LRM 20 hace 80 de daño y a 90 m está por debajo de su alcance mínimo (180 m) |
| CA14 | El HBK-4G de serie | se mira la munición | el AC/20 tiene 2 cajas de 5: 10 ataques; sin las cajas, aparece el aviso de que no tiene munición; un lanzallamas sin cajas no da aviso |
| CA15 | El HBK-4G | se mira el movimiento y el coste | anda 120 m y corre 200 m; la build de serie cuesta 5 090 000 C-Bills, como su mechdef |
| CA16 | Una build | se revisa | pasarse de tonelaje es un error con lo que sobra; una ubicación con más ranuras o armas que su capacidad es un error; una caja de munición sin arma es un aviso |
| CA17 | Una build | se codifica y se decodifica | sale la misma build; un código roto da null; lo que ya no cabe se descarta; `?mech=HBK-4G` abre la build de serie |
| CA18 | Las builds guardadas | se exportan / se importa un archivo de MW5 | el archivo lleva `game: "battletech"` / el de MW5 se rechaza |
| CA19 | Dos builds | se comparan | la tabla dice qué lado gana en cada cifra, y en el calor gana el más bajo |
| CA20 | El selector de 'Mechs | se filtra | por clase Assault salen 21; por fuente Heavy Metal, 15; con al menos 3 anclajes Ballistic, solo los que los tienen; con al menos 5 retrorreactores, los 38 que admiten 5 o más (todos los chasis admiten de 2 a 8); buscar «hbk» encuentra los Hunchback |
| CA21 | El selector de objetos | se filtra | la pestaña Energy solo enseña armas Energy; la versión + + solo las de 2 «+»; la fuente Heavy Metal solo las suyas; el equipo `BUILT-IN` no sale; ordenar por daño pone primero el de más daño |

## Fuera de alcance

- Los mods y modpacks (#104).
- La distancia de salto en metros: depende de reglas del código del juego que no están en los datos. Se enseña el número de retrorreactores.
- El efecto en combate de las mejoras que no cambian las cifras de la lectura (precisión, iniciativa, defensa): se enseñan como bonificaciones con su texto del juego.
- El daño de las bobinas (COIL), que crece con el movimiento del turno: se enseña el daño base.
- El efecto de `Heatsinks` en los chasis que lo traen, por confirmar con una captura del juego.
- La imagen para compartir del MechLab de MW5.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA21):** `src/utils/battletech/mechlab.test.ts`, con los JSON reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - elegir un 'Mech con los filtros;
   - montar y quitar armas, munición y equipo, con los avisos de lo que no cabe;
   - cambiar y repartir el blindaje;
   - volver a la build de serie, copiar el enlace y abrirlo;
   - guardar una build, abrirla desde My builds y compararla;
   - la campana de novedades y el formulario de Feedback.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban), los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 96 variantes de 96 chasis (70 del juego base, 15 de Heavy Metal, 6 de Flashpoint y 5 de Urban Warfare) y 310 objetos: 210 armas (167 del juego base y 43 de Heavy Metal), 16 cajas de munición, 8 disipadores, 4 retrorreactores y 72 mejoras. 52 iconos de chasis. `mechs.json` pesa 220 KB y `items.json` 176 KB; el bundle de la página, 54 KB comprimido.
- **Comprobación de las reglas:** las 96 builds de serie pesan exactamente el tonelaje de su chasis, y todas cumplen las reglas de ranuras, anclajes, ubicaciones y retrorreactores con el equipo fijo contado.
- **Tests:** los 21 criterios están en `src/utils/battletech/mechlab.test.ts` y pasan, con uno más de la ubicación y la pestaña que se abren.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: el selector con los filtros, montar un AC/10 en el HBK-4G (con los avisos de sobrepeso y munición), el selector de equipo con sus filtros y «Fits here», el tablero con el equipo fijo del MAD-3R, repartir el blindaje, un enlace `?b=` y otro `?mech=PXH-1K`, guardar una build, My builds y la comparación.
- **Decisiones durante el desarrollo:**
  - Todos los chasis admiten de 2 a 8 retrorreactores, así que el filtro pide un mínimo en lugar de «admite alguno».
  - En las armas, `Category` es su tipo (Energy, Ballistic…): la categoría de munición solo se lee de `Category` en las municiones.
  - El selector de equipo abre la ubicación con más anclajes y, al cambiar de ubicación, la pestaña de un anclaje con sitio. «Fits here» deja solo lo que cabe, y lo que no cabe propone otra ubicación donde sí.
  - El equipo `BUILT-IN` no sale en el selector: solo viene fijo en su chasis.
  - Lo común de las builds guardadas pasa a `src/utils/savedBuildsCore.ts`, para que la página no cargue el catálogo de MW5.
- **Pendiente de comprobar en el juego:**
  - El efecto de `Heatsinks` en los 11 chasis que lo traen a 30 (ninguno es una variante disponible).
  - El coste: la fórmula (chasis, componentes y 625 C-Bills por punto de blindaje) da el `Cost` del mechdef en el HBK-4G, el AS7-D y el JR7-D, pero en otras variantes difiere en unos miles; hace falta una captura del valor de un 'Mech en el juego.
  - El umbral de sobrecalentamiento: la web parte de 60 (el 60 % de 100) y suma el `OverheatLevel` de los bancos de calor, sin escalarlo con su `MaxHeat`.
