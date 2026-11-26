# Especificación: página de armas y equipo de YAML

- **Estado:** implementada
- **Completa:** [pagina-equipo.md](pagina-equipo.md) (la página de equipo de MW5) y [mechlab-yaml.md](mechlab-yaml.md)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/arsenal.test.ts`) y por último la lógica y la interfaz, en commits separados.

## Contexto

La página de equipo de MW5 (`/mercs/equipment/`) enseña las armas y el equipo del juego sin mods. Con YAML, el catálogo es otro: las armas del juego base cambian de reglas (ocupan ranuras: el AC/10 ocupa 7), los mods añaden 867 objetos y aparecen tipos de equipo que el juego base no tiene (núcleos y tipos de motor, giroscopios, cabinas, estructura, armadura, actuadores...).

Meter el catálogo de YAML en la página de MW5 repetiría cada arma del juego base con dos reglas distintas y no cabrían sus categorías. Por eso YAML tiene su propia página, `/mercs/yaml/equipment/`, con la composición de la de MW5.

## Datos

Todo sale de `src/data/yaml/items.json`, el mismo catálogo que usa el MechLab de YAML. No hace falta regenerar datos.

- **Fuera:** las piezas fijas (`fixed`: los núcleos y rellenos que vienen montados) y los rellenos (`Equipment.Filler`), que el MechLab coloca solo, y los ataques de los actuadores (`actuator`: la mano y el antebrazo), que vienen con el 'Mech.
- **Cifras de las armas:** las del MechLab de YAML sin bonificaciones (`src/utils/yaml/combat.ts`, [estadisticas-yaml.md](estadisticas-yaml.md)): mismo daño, calor, enfriamiento, ciclo, DPS, alcances y velocidad del proyectil que un arma montada en un 'Mech sin quirks ni equipo que la modifique.
- **Munición por tonelada:** la de la caja de 1 t de su tipo de munición, la del juego base si hay varias; si no hay caja de 1 t, la mejor relación de cargas por tonelada. Las salvas por tonelada dividen esas cargas entre la munición que gasta cada salva.
- **Origen:** el juego base (sin `mod`) o el mod que añade o cambia el objeto, con su logo (`public/mechlab/yaml/mods/`).

## Requisitos funcionales

- **RF1. Página.** `/mercs/yaml/equipment/`, con la cabecera de las demás páginas y el título **YAML Equipment**. Como el MechLab de YAML, no se anuncia todavía: `noindex`, sin entrada en la portada, en la navegación ni en las novedades. Se enlaza desde el MechLab de YAML y enlaza de vuelta a él y a la página de equipo de MW5.
- **RF2. Pestañas.** **Weapons** y **Equipment**, con su número de objetos.
- **RF3. Tabla de armas.** Una fila por arma con: nombre, origen (logo del mod) y tecnología; tipo de anclaje; **ranuras**; toneladas; daño, calor, enfriamiento, disparos por minuto, DPS y daño por tonelada; alcance óptimo y máximo, y velocidad del proyectil; munición y salvas por tonelada.
- **RF4. Nivel.** Un selector para toda la lista: Tier 0 a 4 y Lost Tech (el nivel 5). Un arma sin ese nivel enseña el suyo por defecto (el 1 o, si no lo tiene, el único) y lo dice en su fila.
- **RF5. Filtros de armas.** Búsqueda por nombre, tipo (energía, balística, misiles, artillería, cuerpo a cuerpo y AMS, con su número), tecnología (Inner Sphere o Clan) y origen (juego base o cada mod).
- **RF6. Orden.** Cada columna con cifras ordena al pulsar su cabecera y otra pulsación invierte el orden, como en la página de MW5: las cifras de mayor a menor, el nombre de la A a la Z y las armas sin el dato al final.
- **RF7. Equipo por categorías.** Fichas con toneladas, ranuras, origen y efectos, agrupadas por la etiqueta del juego (`category`), la más concreta que encaje:

  | Categoría | Etiquetas |
  |---|---|
  | Heat sinks | `Equipment.HeatSinks`, `Equipment.Cooling` (los kits de disipadores del motor) |
  | Engines | `Equipment.Engine` (tipos y núcleos) |
  | Structure and armor | `Equipment.Internal`, `Equipment.Upgrades.Armor`, `Equipment.Harjel` |
  | Internals | `Equipment.Cockpit`, `Equipment.Gyro`, `Equipment.LifeSupport`, `Equipment.Sensors`, `Equipment.Targeting`, `Equipment.Upgrades.Defensive` |
  | Jump jets | `Equipment.JumpJets` |
  | Motive | `Equipment.MASC`, `Equipment.SuperCharger`, `Equipment.ArenaSuperCharger`, `Equipment.TripleStrengthMyomer`, `Equipment.Upgrades` |
  | Electronics | `Equipment.ECM`, `Equipment.BAP` |
  | Targeting computers | `Equipment.TargetingComputer` |
  | Actuators | `Equipment.Misc.Actuator` |
  | Other | el resto |
  | Ammo | la munición, en una tabla: toneladas, ranuras, cargas, cargas por tonelada, origen y las armas que la usan |

  Los efectos son los que el catálogo guarda de cada pieza, con su nombre en inglés: refrigeración y capacidad de calor, potencia del núcleo, peso relativo del motor, la estructura o la armadura, puntos de armadura por tonelada, ranuras de relleno, velocidad, giro y torso, sensores, retrorreactores y las bonificaciones a las armas (qué cambian y a qué armas).
- **RF8. Filtros de equipo.** Categoría (con su número), búsqueda, tecnología y origen.
- **RF9. URL.** La pestaña, los filtros, el nivel, el orden y la categoría van en la URL, como en la página de MW5.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/yaml/arsenal.ts`, con sus tests; las cifras de las armas, en `combat.ts`, compartidas con el MechLab.
- **RNF2.** La página tiene su propio bundle (`yaml/equipment/index.html`) y funciona a 390 × 844 sin desbordar la página: las tablas se desplazan dentro de su caja.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo de YAML | se cargan las armas | son 380: 77 de energía, 125 balísticas, 137 de misiles, 2 de artillería, 34 cuerpo a cuerpo y 5 AMS; 141 son Clan; 172 del juego base, 123 de Yet Another Weapon, 83 de su versión Clan y 2 de Yet Another Mechlab |
| CA2 | El M Laser en Tier 1 | se ve | 1 ranura, 1 t, 5 de daño, 2,25 de calor, 4 s de enfriamiento, 12 disparos por minuto (ciclo de 5 s con la duración del rayo), 1 de DPS, 5 de daño por tonelada, 270 y 540 m; sin velocidad ni munición |
| CA3 | El LRM 10 en Tier 1 | se ve | 2 ranuras, 5 t, 12 de daño, 900 m de alcance óptimo y máximo, 250 m/s (200 del asset × 1,25 de YAW), 440 cargas y 44 salvas por tonelada |
| CA4 | Un arma sin Tier 0 | se pide en Tier 0 | enseña su nivel por defecto y la fila dice cuál |
| CA5 | Las armas | se filtran por energía / Clan / origen Yet Another Weapon / búsqueda «lrm 10» | salen 77 / 141 / 123 / el LRM 10 y sus variantes |
| CA6 | Las armas | se ordenan por DPS y otra vez por DPS | la primera tiene el DPS mayor y luego la última; las que no tienen el dato quedan al final en los dos sentidos |
| CA7 | El equipo | se agrupa | 22 heat sinks, 89 engines, 46 structure and armor, 52 internals, 15 jump jets, 31 motive, 15 electronics, 18 targeting computers, 36 actuators y 33 other; ningún relleno ni pieza fija |
| CA8 | Los efectos | se piden | Double Heat Sink: 3 ranuras, +0,2 de refrigeración y +2 de capacidad. Engine Core 300: 19 t y potencia 300. XL Engine: −50 % de peso del motor y 3 ranuras de relleno en cada torso lateral |
| CA9 | La munición LRM | se consulta | LRM Ammo: 1 t, 440 cargas; la usan los LRM 5 a 20 con sus variantes y los MML (20 armas) |
| CA10 | La vista | se guarda en la URL y se lee | conserva la pestaña, la búsqueda, el tipo, la tecnología, el origen, el nivel, el orden y la categoría; ignora lo que no conoce |

## Fuera de alcance

- Mezclar el catálogo de YAML en la página de MW5.
- Los quirks de los 'Mechs y las mejoras de la cantina: las cifras son las del arma sola.
- Descripciones de los objetos: el catálogo de YAML no las guarda.

## Plan de pruebas

1. **Lógica (CA1 a CA10):** `src/utils/yaml/arsenal.test.ts`, con el catálogo real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la tabla de armas con filtros, nivel y orden, las fichas de equipo por categoría, la munición y los enlaces con el MechLab de YAML.
