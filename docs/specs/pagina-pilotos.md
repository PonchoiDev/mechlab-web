# Especificación: página de pilotos

- **Issue:** [#79](https://github.com/PonchoiDev/mechlab-web/issues/79)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/pilots.test.ts`) y por último el código, en commits separados.

## Contexto

Con el DLC7, cada piloto tiene rasgos: afinidades con un chasis, dominio de un arma, origen en una facción, rasgos de carrera (aprende rápido, cobra menos…) y rasgos hero. Algunos salen en los pilotos que se contratan, otros se aprenden en las academias y los hero solo los traen los pilotos de élite. El juego enseña los rasgos de cada piloto, pero no la lista completa ni qué hacen exactamente; tampoco hay un sitio donde comparar los programas de las academias.

Las academias ya están en el mapa estelar (`docs/specs/academias.md`). Esta página completa la issue #79 con el resto: los rasgos y los programas de entrenamiento.

**Pilotos hero:** el juego no tiene una lista de pilotos hero con su sistema. Genera pilotos con rasgos hero y los ofrece al azar en las salas de contratación como «Elite Pilot» (`DLC7/TOIs/HeroPilot/HeroPilotToi`, con la lógica de la sala de contratación). Por eso no van en el mapa: la página explica cómo aparecen y lista los rasgos que pueden traer.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Rasgos de piloto | `DLC7/TOIs/PilotTraining/PilotTraits/**` (184) | Nombre, descripción corta y larga (claves de `PilotTraitStringTable`, con huecos como `{MechType}`), fecha desde la que existe (`AvailableDate`), etiquetas (`Attributes`) y el árbol de componentes que aplica (`UnitTrait` y, dentro, `UnitTraits`) |
| Efectos | Componentes de cada rasgo (`MechAffinityTrait`, `WeaponQuirkSetTrait`, `IncreasedArmor_TraitBP`, `PilotTrait_BP`, `FactionNobleWith_BP`…) | Las cifras de cada efecto: velocidad, blindaje, quirks de arma, sensores, coste de contratación, sueldo, heridas… |
| Programas | `programas.json` y `academias.json` de `extraer_mapa.py` | Las cifras de cada programa y las academias que lo ofrecen |

`extraer_pilotos.py` guarda los rasgos en `tools/datos-juego/pilotos/rasgos.json` y `generar_pilotos.py` genera `src/data/pilots.json` con los rasgos y los programas.

**Decisiones sobre los datos:**

- **Componentes:** solo los que cuelgan del rasgo (`UnitTrait` y los `UnitTraits` de cada componente). Algunos assets traen componentes sueltos que no se usan: Trigger Discipline repite sus quirks en uno que no está en el árbol.
- **Mapas de quirks por arma:** los rasgos de graduado y Arena Specialist guardan un mapa de etiqueta de arma a quirks (`WeaponQuirks`). Sus valores son structs sin nombre, que el lector de UE4 lee ahora como propiedades etiquetadas.
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
- **Categorías:**
  - **'Mech affinity:** afinidades de chasis o de tamaño de 'Mech.
  - **Weapons:** expertos, maestros y especialistas en un arma.
  - **Factions:** nobles, patriotas, criminales, odio a una facción y orígenes en un Clan.
  - **Academy graduates:** los graduados de NAIS, Nagelring, Princefield, Sun Zhang y Gunslinger.
  - **Career:** el resto (experiencia, sueldo, heridas…).
- **Cómo se consigue:**
  - **Hero:** etiqueta `PilotTrait.Hero`; solo la traen los pilotos de élite.
  - **Hired pilots:** etiqueta `Generation`; puede salir en los pilotos que se contratan.
  - **Learnable at academies:** etiqueta `Training`; se aprende en una academia.
  - **Negative y Unique:** sus propias etiquetas.
  - **DLC:** la etiqueta `DLC.DLCn`.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/pilots/`, con su portada en la página de inicio junto a las otras tres.
- **RF2.** La pestaña **Traits** lista los rasgos con su nombre, su descripción, cómo se consiguen (Hero, Hired pilots, Learnable at academies, Negative, Unique), su DLC y desde cuándo existen, y sus efectos agrupados por dónde se aplican. Los efectos buenos se distinguen de los malos.
- **RF3.** Los rasgos se filtran por categoría y por solo hero, y se buscan por nombre, descripción o efecto («atlas», «jam»).
- **RF4.** La pestaña **Training programs** lista los programas con su duración, coste, habilidad del piloto que admiten, estrellas de habilidad, rasgos y experiencia, y las academias que los ofrecen, cada una enlazada a su ficha en el mapa estelar (`/mercs/starmap/?academy=<id>`).
- **RF5.** Un recuadro explica los pilotos de élite: aparecen al azar en las salas de contratación con rasgos hero.
- **RF6.** La pestaña, la categoría, el filtro hero y la búsqueda van en la URL.
- **RF7.** El MechLab, el mapa y las unidades enemigas enlazan la página nueva.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/pilots.ts`, con sus tests: filtros, búsqueda y vista en la URL.
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
| CA10 | La vista | se guarda en la URL y se lee | conserva la pestaña, la categoría, el filtro hero y la búsqueda, e ignora lo que no conoce |

## Fuera de alcance

- Los pilotos que ofrece cada sala de contratación, que el juego genera al azar.
- Los rasgos de los pilotos fijos de las campañas.
- El nivel de habilidad de los pilotos y cómo sube con la experiencia.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/pilots.test.ts`, con `pilots.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - la portada con cuatro carátulas;
   - los rasgos por categoría, solo hero y la búsqueda;
   - los programas y el enlace de una academia al mapa;
   - la campana de novedades.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 184 rasgos (99 de 'Mech, 35 de armas, 24 de facciones, 21 de carrera y 5 de graduados; 53 hero) y 29 programas. `pilots.json` pesa unos 215 KB (unos 14 KB comprimido en el bundle de la página).
- **Lector de UE4:** lee los structs de los mapas (los quirks por arma de los graduados y de Arena Specialist) y guarda el orden de los exports para seguir el árbol de componentes. El mapa estelar y las unidades extraídos de nuevo salen idénticos.
- **Tests:** los diez criterios (CA1 a CA10) están en `src/utils/pilots.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844:
  - la portada con cuatro carátulas en una fila;
  - los rasgos por categoría, solo hero y la búsqueda;
  - la pestaña de programas con sus academias enlazadas al mapa;
  - las cabeceras del MechLab, el mapa y las unidades con el enlace nuevo.
- **Decisiones durante el desarrollo:**
  - Con cuatro carátulas, la portada pasa a columnas de 240 px como mínimo, para que quepan en una fila en escritorio.
  - En el móvil, el tercer enlace bajaba los del mapa estelar a otra fila y la cabecera crecía por debajo de donde empiezan las fichas: los enlaces se compactan para caber en la primera.
