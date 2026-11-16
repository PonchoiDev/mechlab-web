# Especificación: página de armas y equipo de BATTLETECH

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/equipment.test.ts`) y por último la lógica y la interfaz, en commits separados.

## Contexto

El MechLab de BATTLETECH tiene un selector de objetos para la ubicación elegida, pero no hay un sitio donde ver todo el catálogo a la vez, comparar las versiones de fabricante de un arma (+, + + y + + +) y ordenarlo por cualquier cifra.

`src/data/battletech/items.json` (de `generar_mechlab_battletech.py`) ya trae todo lo necesario: 210 armas con su daño, disparos, inestabilidad, calor, daño por calor, precisión, crítico, alcances y munición; 16 municiones, 8 disipadores, 4 retrorreactores y 72 mejoras, cada uno con su fabricante, su versión, sus bonificaciones (el texto del juego), su fuente, su rareza, su tonelaje, sus ranuras y su precio. No hace falta tocar los datos.

**Reglas de BATTLETECH que cambian la página respecto a la de MW5:**

- Las armas ocupan ranuras además de un anclaje (energía, balística, misiles o apoyo).
- No hay tiers: las versiones + son objetos distintos, cada una de un fabricante y con su bonificación. Se filtran por versión en lugar de elegir un tier.
- No hay cooldown ni DPS: cada arma dispara una vez por turno. El daño es el de un ataque (daño por disparo por disparos) y el daño por tonelada usa el tonelaje del arma sola.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/equipment/`, en el build de BATTLETECH, con su portada en la página de inicio, en la fila de BATTLETECH junto al MechLab, el mapa y la Argo.
- **RF2.** Dos pestañas: **Weapons** y **Equipment**.
- **RF3.** La pestaña de armas es una tabla con una fila por arma (y por versión) con estas columnas:
  - el nombre con su versión, el fabricante y sus bonificaciones;
  - anclaje, toneladas y ranuras;
  - daño de un ataque (con los disparos si son varios), inestabilidad, calor y daño por calor;
  - precisión (positiva es mejor, como la escribe el juego) y multiplicador de crítico;
  - alcance mínimo, los tres tramos de alcance (`RangeSplit`) y el máximo;
  - munición por tonelada y ataques que da, en las que usan munición;
  - daño por tonelada, rareza, fuente y precio.
- **RF4.** Las armas se buscan por nombre o fabricante y se filtran por anclaje, versión (de serie, +, + + o + + +), fuente y rareza.
- **RF5.** Cada columna con cifras ordena la tabla al pulsar su cabecera; otra pulsación invierte el orden. Las cifras empiezan de mayor a menor, salvo el alcance mínimo, que empieza por el más corto; el nombre va de la A a la Z y, en el mismo nombre, por versión. Las armas sin el dato van al final.
- **RF6.** La pestaña de equipo tiene fichas por categoría, con el fabricante, la versión, las toneladas, las ranuras, el precio, la fuente, la rareza, dónde se monta y las bonificaciones:
  - **Heat sinks:** disipación por turno, calor máximo, umbral de sobrecalentamiento y calor de las armas;
  - **Jump jets:** tonelaje de los 'Mechs que los montan;
  - **Upgrades:** por grupo (actuadores, cabina, giroscopio, puntería, electrónica, artillería y general);
  - **Ammo:** una tabla con las toneladas, ranuras, cargas, precio, fuente y las armas que la usan.

  El equipo fijo de algunos chasis (`builtIn`) sale con la marca Built-in, porque no se puede montar. Se filtra por categoría, búsqueda, versión, fuente y rareza.
- **RF7.** La pestaña, los filtros y el orden van en la URL.
- **RF8.** El MechLab, el mapa y la Argo de BATTLETECH enlazan la página nueva.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/equipment.ts`, con sus tests: filas de armas, munición por tonelada, filtros, orden, categorías, efectos del equipo, munición y vista en la URL. Recibe el catálogo como parámetro.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle, no carga los 'Mechs, y funciona a 390 × 844 sin desbordar la página (la tabla se desplaza dentro de su caja).

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo | se cargan las armas | son 210: 52 de energía, 71 balísticas, 63 de misiles y 24 de apoyo; 40 de serie, 71 +, 85 + + y 14 + + +; 167 del juego base y 43 de Heavy Metal |
| CA2 | El AC/10 de serie | se consulta | Western, balístico, 12 t, 3 ranuras, 60 de daño, 20 de inestabilidad, 12 de calor, alcance máximo 450 m, tramos 300, 300 y 450, 8 cargas y 8 ataques por tonelada, 5 de daño por tonelada, 140.000 C-Bills; hay 11 AC/10 entre todas las versiones |
| CA3 | El LRM20 de serie | se consulta | Jackson, 80 de daño en 20 disparos de 4, 40 de inestabilidad, 18 de calor, alcance mínimo 180 y máximo 630, fuego indirecto, 120 cargas y 6 ataques por tonelada |
| CA4 | El M Laser + de Magna | se consulta | 30 de daño, la bonificación «+ 5 Dmg.» y 70.000 C-Bills; el M Laser de serie tiene +1 de precisión y el M Laser + + de Intek, +4 (su bonificación de +3 más la del láser) |
| CA5 | Las armas | se filtran por energía / versión + + + / Heavy Metal / rareza especial / búsqueda «kali yama» | salen 52 / 14 / 43 / 67 / todas de Kali Yama |
| CA6 | Las armas | se ordenan por daño / daño por tonelada / inestabilidad / nombre | la primera es UAC/20 + + de Kali Yama (240) / ER S Laser + + de BlazeFire (80) / LB 20-X + + de Shengli Arms (84) / AC/10 de serie, seguida de sus versiones +. Al pulsar otra vez daño, la última es la UAC/20 + +. Las armas sin munición van al final en los dos sentidos por munición por tonelada |
| CA7 | El equipo | se agrupa por categorías | 8 heat sinks, 4 jump jets, 72 upgrades y 16 municiones; las mejoras, por grupo: actuadores 21, cabina 12, giroscopio 10, puntería 12, electrónica 3, artillería 2 y general 12 |
| CA8 | Los efectos | se piden | Heat Sink: −3 de calor por turno. Heat Bank: +10 de calor máximo y +5 de umbral. Exchanger: −10 % de calor de las armas. Jump Jet (S): 'Mechs de 10 a 55 t. Vectored Thrust Kit: Built-in. Arm Mod: solo en los brazos |
| CA9 | La munición del LRM | se consulta | 1 t, 1 ranura, 120 cargas, 20.000 C-Bills, la usan las 36 versiones de LRM5, LRM10, LRM15 y LRM20 |
| CA10 | La vista | se guarda en la URL y se lee | conserva la pestaña (Weapons si no hay ninguna), la búsqueda, el anclaje, la versión, la fuente, la rareza, el orden y su sentido y la categoría del equipo; ignora lo que no conoce |

## Fuera de alcance

- Las bonificaciones de las mejoras aplicadas a una build: eso lo hace el MechLab.
- Dónde se compra cada objeto: las tiendas son aleatorias según la rareza y el sistema.
- Los iconos de los objetos.

## Plan de pruebas

1. **Lógica (CA1 a CA10):** `src/utils/battletech/equipment.test.ts`, con `items.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la tabla de armas con filtros y orden, las fichas de equipo y la portada con la carátula nueva.
