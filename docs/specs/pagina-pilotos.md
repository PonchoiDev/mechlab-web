# Especificación: página de pilotos

- **Issue:** [#79](https://github.com/PonchoiDev/mechlab-web/issues/79)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/pilots.test.ts`) y por último el código, en commits separados.

## Contexto

Con el DLC7, cada piloto tiene rasgos:

- afinidades con un chasis;
- dominio de un arma;
- origen en una facción;
- rasgos de carrera (aprende rápido, cobra menos…);
- rasgos hero.

Algunos salen en los pilotos que se contratan y otros se aprenden en las academias. El juego enseña los rasgos de cada piloto, pero no la lista completa ni qué hacen exactamente; tampoco hay un sitio donde comparar los programas de las academias.

Las academias ya están en el mapa estelar (`docs/specs/academias.md`). Esta página completa la issue #79 con el resto: los pilotos hero, los rasgos y los programas de entrenamiento.

**Pilotos hero:** son como los chasis hero: pilotos con nombre, biografía, habilidades y rasgos fijos (`MWPilotPersonaAsset` con la etiqueta `PilotPersona.Use.Hero`). Hay dos clases:

- **En las salas de contratación:** los que no llevan `PilotPersona.Use.Reserved` (ocho, todos del DLC7). La sala de contratación los ofrece al azar y el mapa estelar la marca como «Elite Pilot» (`HeroPilotToi`, `ClusterToiLogic`, `HiringHallToiLogic`).
- **Recompensas:** los reservados solo llegan al completar una misión o un objetivo que los trae en `PilotRewards`. Por ejemplo, Morgan Trensky en *Leading the Charge* (DLC7) o Valten Ryder al terminar la cadena de Adam Steiner (DLC8).

**Rasgos hero:** la etiqueta `PilotTrait.Hero` marca los rasgos raros, no los exclusivos de los pilotos hero. Todos los pilotos hero del DLC7 traen uno. Los pilotos que se contratan y los programas de las academias también pueden sacarlos, pero solo cuando la partida lo permite (`bAllowHeroTraits` en `ProgressionFunctionLib` y `AcademyFunctionLibrary`).

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Pilotos hero | `MWPilotPersonaAsset` con `PilotPersona.Use.Hero` y su `MWPersonaAsset` | Nombre, indicativo, biografía, rango, coste de contratación, sueldo, habilidades (tope y experiencia) y rasgos fijos |
| Cómo se consiguen | Escenarios y objetivos con `PilotRewards` | El título de la misión o del objetivo que da cada piloto reservado |
| Niveles de habilidad | `Campaign/Pilots/_common/PilotSkillLevelCurve` | La experiencia de cada nivel, del 1 (0) al 10 (14.110) |
| Rasgos de piloto | `DLC7/TOIs/PilotTraining/PilotTraits/**` (184) | Nombre, descripción corta y larga (claves de `PilotTraitStringTable`, con huecos como `{MechType}`), fecha desde la que existe (`AvailableDate`), etiquetas (`Attributes`) y el árbol de componentes que aplica (`UnitTrait` y, dentro, `UnitTraits`) |
| Efectos | Componentes de cada rasgo (`MechAffinityTrait`, `WeaponQuirkSetTrait`, `IncreasedArmor_TraitBP`, `PilotTrait_BP`, `FactionNobleWith_BP`…) | Las cifras de cada efecto: velocidad, blindaje, quirks de arma, sensores, coste de contratación, sueldo, heridas… |
| Programas | `programas.json` y `academias.json` de `extraer_mapa.py` | Las cifras de cada programa, sus rasgos propios (`PossibleTraits`) y las academias que lo ofrecen |

`extraer_pilotos.py` guarda en `tools/datos-juego/pilotos/` los rasgos (`rasgos.json`), los pilotos hero (`hero.json`) y la curva de niveles (`niveles.json`). `generar_pilotos.py` genera `src/data/pilots.json` con los pilotos hero, los rasgos y los programas.

**Decisiones sobre los datos:**

- **Pilotos hero:**
  - El nivel de cada habilidad es el último umbral de la curva que alcanza su experiencia, sin pasar de su tope.
  - Gunnery y Piloting no se enseñan: son las habilidades de antes de las de cada arma y ya no cuentan.
  - Shenzeng está dos veces, en la campaña sin rasgos y en la carrera con ellos. Se queda el de la carrera.
  - **DLC:** el de su etiqueta `DLC.DLCn` o el de su carpeta. La carpeta `DLC1/CareerMode` es el modo carrera gratuito, no el DLC1.
  - **Títulos de recompensa:** si el título no explica de dónde sale el piloto, el script lo reescribe. Es el caso del nivel 8 de información del Bounty Hunter y de la transmisión de Goblin, que exige reputación 3 y el 'Mech de la Microsoft Store.
- **Componentes:** solo los que cuelgan del rasgo (`UnitTrait` y los `UnitTraits` de cada componente). Algunos assets traen componentes sueltos que no se usan: Trigger Discipline repite sus quirks en uno que no está en el árbol.
- **Mapas de quirks por arma:** los rasgos de graduado y Arena Specialist guardan un mapa de etiqueta de arma a quirks (`WeaponQuirks`). Sus valores son structs sin nombre, que el lector de UE4 lee como propiedades etiquetadas.
- **Efectos:**
  - Cada propiedad tiene un texto en inglés, un formato y si es bueno que suba: el sueldo, las heridas, el calor, el cooldown o la dispersión son mejores cuanto más bajos.
  - El juego guarda algunas reducciones en positivo («Heat Reduction Percent» 0,05 es un 5 % menos de calor) y los sensores como multiplicador (1,1 es un 10 % más).
- **Dónde se aplican:** los efectos se agrupan por dónde valen, y los de coste del piloto van al final:
  - con los 'Mechs de la afinidad;
  - con un arma;
  - contra una facción;
  - en los contratos de una facción o en su espacio;
  - en combate;
  - como piloto (contratación, sueldo, experiencia, heridas).
- **Textos:**
  - El nombre y la descripción corta rellenan sus huecos con los datos del rasgo: el chasis, el arma, la facción o la cifra.
  - La descripción larga no se usa, porque su lista de efectos la sustituyen los grupos.
  - Las facciones se nombran como en el mapa («House Davion»).
- **Categorías y subgrupos:** cada rasgo va en una categoría y, dentro, en un subgrupo:
  - **'Mech affinity:** por clase de peso (Light, Medium, Heavy y Assault 'Mechs), con la afinidad con toda la clase antes que los chasis. El peso sale de la etiqueta del rasgo o, si no la trae, de la del 'Mech (`Mech.Light.Jenner`).
  - **Weapons:** Ballistic, Energy, Missile y Artillery, por la etiqueta del rasgo o por las armas a las que afecta; los que afectan a armas de varias clases van en «Several weapon types».
  - **Factions:** Nobles, Patriots, Criminals, Hatred y Clan origins.
  - **Career:** Combat (con algún efecto fuera del piloto), Learning (etiqueta `PilotTrait.Type.Metagame`: experiencia) y Money and health.
  - **Academy graduates:** los graduados de NAIS, Nagelring, Princefield, Sun Zhang y Gunslinger, sin subgrupo.
- **Cómo se consigue un rasgo:**
  - **Hero:** etiqueta `PilotTrait.Hero`; es un rasgo raro.
  - **Hired pilots:** etiqueta `Generation`; puede salir en los pilotos que se contratan.
  - **Learnable at academies:** etiqueta `Training`; se aprende en una academia.
  - **Negative y Unique:** sus propias etiquetas.
  - **DLC:** la etiqueta `DLC.DLCn`.
- **Familias de programas:** los programas se agrupan por su id para compararlos por nivel:
  - Simpod training;
  - Vocational training;
  - Semester enrollment;
  - Full year enrollment;
  - Undergraduate program;
  - Graduate program;
  - Academy graduate programs: los de una sola academia, que dan siempre su rasgo de graduado (peso 99999 en `PossibleTraits`).

  Cada programa lleva:
  - **Etiqueta dentro de su familia:** el nivel, el curso (Remedial, Beginner…) o la academia.
  - **Rasgos que favorece:** los de su propia lista con peso 1 o más.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/pilots/`, con su portada en la página de inicio junto a las otras tres.
- **RF2.** La pestaña **Hero pilots**, la primera, lista los pilotos hero en dos secciones: los de las salas de contratación y los que son recompensa. Cada piloto tiene:
  - su nombre, su DLC y su rango;
  - cómo se consigue;
  - el coste de contratación (solo en los de la sala) y el sueldo;
  - el nivel y el tope de cada habilidad;
  - sus rasgos fijos, con sus efectos desplegables;
  - su biografía.
- **RF3.** La pestaña **Traits** lista los rasgos por secciones (categoría y subgrupo, con cuántos hay en cada una), como los programas: una tabla por subgrupo y una fila por rasgo, con estas columnas:
  - **Trait:** el nombre y solo las marcas que lo distinguen (Hero, Negative, Unique, su DLC y desde cuándo existe). La descripción del juego va en el tooltip del nombre, porque casi siempre repite los efectos.
  - **Effects:** los efectos en la batalla, en los contratos o en el espacio de una facción. Dónde se aplican solo se escribe cuando no es obvio: no en «In combat» ni en «While piloting…» de las afinidades, sí con un arma, contra una facción o en sus contratos.
  - **As a pilot:** contratación, sueldo, experiencia, heridas…
  - **Found on:** dos marcas, Hired (sale en los pilotos que se contratan) y Academies (se aprende en una academia), encendidas o apagadas, para ver las excepciones de un vistazo.

  Los efectos buenos se distinguen de los malos. En el móvil, cada fila pasa a ser un bloque, como en los programas.
- **RF4.** Los rasgos se filtran por categoría y por solo hero, y se buscan por nombre, descripción o efecto («atlas», «jam»).
- **RF5.** La pestaña **Training programs** agrupa los programas por familias. Cada familia tiene una descripción y una tabla con una fila por programa:
  - su etiqueta;
  - duración, cuota de matrícula y cuota trimestral;
  - habilidad del piloto que admite;
  - estrellas de habilidades, rasgos y experiencia;
  - las academias que lo ofrecen, cada una enlazada a su ficha en el mapa estelar (`/mercs/starmap/?academy=<id>`).

  Los programas con rasgos propios dicen cuál dan siempre y cuáles favorecen, con un enlace a cada rasgo.
- **RF6.** La pestaña, la categoría, el filtro hero y la búsqueda van en la URL.
- **RF7.** El MechLab, el mapa y las unidades enemigas enlazan la página nueva.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/pilots.ts`, con sus tests: filtros, búsqueda, secciones de rasgos, reparto de los efectos en columnas, familias de programas, duración y vista en la URL.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los rasgos | se cargan | son 184, ninguno con huecos sin rellenar en el nombre o la descripción y todos con algún efecto: 99 de 'Mech, 35 de armas, 24 de facciones, 21 de carrera y 5 de graduados; 53 son hero |
| CA2 | Atlas 'Mech Affinity | se consulta | se aplica «While piloting Atlas 'Mechs» con +10 % de velocidad máxima, de giro de torso, de giro y de alcance de sensores; sale en pilotos contratables y se aprende en academias; no es hero |
| CA3 | AC/10 Expert | se consulta | se aplica «With AC/10», con la nota «(Also applies to LB 10-X AC and UAC/10)»: +5 % de alcance, +5 % de velocidad del proyectil y −5 % de dispersión, los tres buenos |
| CA4 | Hypochondriac | se consulta | es negativo: +15 % de probabilidad de herida (malo) y −10 % de coste de contratación y de sueldo (buenos) |
| CA5 | House Davion Noble | se consulta | +5 % de C-Bills en contratos para House Davion, −5 % de precios de mercado en su espacio y +15 % de contratación y sueldo (malos) |
| CA6 | Trigger Discipline | se consulta | sus efectos con Ultra Autocannon salen una sola vez: −25 % de probabilidad de encasquillarse, −20 % de cooldown mínimo y +25 disparos antes de encasquillarse |
| CA7 | Daishi 'Mech Affinity | se consulta | es hero, del DLC 7 y existe desde el 1 de enero de 3054 |
| CA8 | La lista | se filtra por Weapons / solo hero / se busca «atlas» / se busca «jam» | salen 35 / 53 / Atlas 'Mech Affinity / Trigger Discipline |
| CA9 | Los programas | se cargan | son 29; Full Year Enrollment de nivel 1 lo ofrecen 28 academias, entre ellas la Aitutaki Academy, y Remedial Simpod Training los 24 Virtual World Center |
| CA10 | La vista | se guarda en la URL y se lee | conserva la pestaña (Hero pilots si no hay ninguna), la categoría, el filtro hero y la búsqueda, e ignora lo que no conoce |
| CA11 | Los rasgos | se agrupan en secciones | 'Mech affinity: Light 19, Medium 25, Heavy 26 y Assault 29, y Assault empieza por Assault 'Mech Affinity. Weapons: Ballistic 11, Energy 7, Missile 10, Artillery 2 y Several weapon types 5. Factions: 5, 5, 5, 5 y 4. Career: Combat 6, Learning 3 y Money and health 12. Graduates: un solo grupo de 5 |
| CA12 | Los pilotos hero | se cargan | son 18. Los 8 de la sala de contratación son Ash Delmore, Barrett Nolan, Jacob Cave, Lance Gabel, Lyana Moore, Nick Lynch, Rachel Laird y Sasha Lockwood. Todos sus rasgos existen en la lista de rasgos y Shenzeng sale una sola vez, con los rasgos de House Liao |
| CA13 | Ash Delmore | se consulta | DLC 7, Regular, 600.000 C-Bills de contratación y 24.000 de sueldo; habilidades 10, 9, 7, 9, 7 y 8 con tope 10; rasgos Medium 'Mech Affinity, Laser Specialist y Eagle Eyes |
| CA14 | Los pilotos reservados | se consultan | Morgan Trensky es la recompensa de *Leading the Charge*, Sam Hagel la de *Smoke and Mirrors* y Valten Ryder la de *A New March* (DLC 8), con Bushwacker 'Mech Affinity, AC/10 Master y Survivor |
| CA15 | Los programas | se agrupan por familias | Simpod training 5, Vocational training 2, Semester enrollment 4, Full year enrollment 4, Undergraduate program 5, Graduate program 4 y Academy graduate programs 5. El de NAIS se llama New Avalon Institute of Science, da siempre NAIS Graduate y favorece Standard Autocannon Specialist; Graduate Program de nivel 4 favorece SRM Specialist y MRM Expert |
| CA16 | La duración de un programa | se escribe | 60 días son «60 days», 365 son «1 year» y 1.460 son «4 years» |
| CA17 | Los efectos de un rasgo | se reparten en columnas | Atlas 'Mech Affinity: sus cuatro efectos sin decir dónde y ninguno como piloto. AC/10 Expert: «With AC/10» con su nota. House Davion Noble: «On contracts for House Davion» e «In House Davion space» en la columna de efectos y sus dos costes como piloto. Hypochondriac: ningún efecto fuera del piloto y sus tres efectos como piloto |

## Fuera de alcance

- Los pilotos que la sala de contratación genera al azar.
- Los retratos de los pilotos hero: son texturas del juego que el lector de UE4 no decodifica.
- Cuántas veces sale cada piloto hero y qué pasa si muere (`PilotDeadPool`).
- El nivel de habilidad de los pilotos que se contratan y cómo sube con la experiencia.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA17):** `src/utils/pilots.test.ts`, con `pilots.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - la portada con cuatro carátulas;
   - los pilotos hero con sus habilidades, sus rasgos desplegados y su biografía;
   - las tablas de rasgos por secciones, por categoría, solo hero y la búsqueda;
   - las tablas de los programas, el enlace de una academia al mapa y el de un rasgo a su ficha;
   - la campana de novedades.

## Resultado

- **Orden seguido:** en tres vueltas, cada una con la especificación, los tests de sus criterios (que fallaban) y después los datos, la lógica y la interfaz, en commits separados. La primera trajo los rasgos y los programas; la segunda, los pilotos hero, las secciones de rasgos y las tablas de programas; la tercera, las tablas de rasgos.
- **Datos:**
  - 18 pilotos hero: 8 de las salas de contratación y 10 recompensas.
  - 184 rasgos (99 de 'Mech, 35 de armas, 24 de facciones, 21 de carrera y 5 de graduados; 53 hero) en 18 subgrupos.
  - 29 programas en 7 familias.
  - `pilots.json` pesa unos 250 KB (unos 23 KB comprimido con el bundle de la página).
- **Lector de UE4:**
  - lee los structs de los mapas (los quirks por arma de los graduados y de Arena Specialist);
  - guarda el orden de los exports para seguir el árbol de componentes;
  - lee las claves de las curvas (`RichCurveKey`).

  El mapa estelar y las unidades extraídos de nuevo salen idénticos, salvo los rasgos propios que ahora guarda `programas.json`.
- **Tests:** los diecisiete criterios (CA1 a CA17) están en `src/utils/pilots.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900, a 390 × 844 y a 360 px:
  - los pilotos hero con sus habilidades, un rasgo desplegado y la biografía;
  - las tablas de rasgos por secciones y las de programas, que en el móvil pasan a bloques;
  - el enlace de un programa a su rasgo de graduado;
  - las cabeceras con el enlace nuevo.
- **Decisiones durante el desarrollo:**
  - Con cuatro carátulas, la portada pasa a columnas de 240 px como mínimo, para que quepan en una fila en escritorio.
  - En el móvil, los enlaces del mapa estelar se compactan para caber en la primera fila. A 360 px, las páginas de unidades y pilotos esconden «MW5 Mercenaries» del enlace al MechLab.
  - La primera versión decía que no había pilotos hero fijos y que los rasgos hero eran exclusivos de los pilotos de élite. Los dos errores se corrigieron al encontrar los `MWPilotPersonaAsset` con `PilotPersona.Use.Hero` y comprobar que los rasgos hero también llevan las etiquetas de contratación y academia.
  - La pestaña de pilotos hero va la primera porque es la página de los pilotos. En el móvil, «Training programs» se acorta a «Programs» para que las tres pestañas quepan en una fila.
  - Los rasgos pasaron de fichas a tablas, como los programas: con 184 fichas la lista era larga y costaba comparar. Las marcas Hired y Academies, que llevan casi todos, se cambiaron por una columna con las dos encendidas o apagadas, y la descripción del juego, que casi siempre repite los efectos, pasó al tooltip del nombre.
  - Los efectos de los rasgos de un piloto hero se despliegan en su ficha. Los rasgos de un programa enlazan a la pestaña de rasgos con la búsqueda hecha.
