# Especificación: página de HRQ y campañas de MW5

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/questGuide.test.ts`) y por último la lógica y la interfaz, en commits separados.

## Contexto

Las misiones de alta recompensa (HRQ) y las campañas de los DLC ya están en el mapa estelar ([misiones-hrq.md](misiones-hrq.md), [condiciones-hrq.md](condiciones-hrq.md), [recompensas-hrq.md](recompensas-hrq.md) y [campanas-dlc.md](campanas-dlc.md)), pero solo se ven de una en una, en una ficha sobre el mapa. No hay un sitio donde leerlas todas juntas: qué DLC trae cada una, dónde y cuándo se consigue, qué misiones tiene y qué paga. Es lo primero que se pregunta antes de comprar un DLC o de planear una partida.

## Datos del juego

No hace falta extraer nada nuevo: `starmap.json` ya trae, de `extraer_mapa.py` y `generar_mapa.py`:

| Dato | Campo |
|---|---|
| HRQ: nombre, DLC, modos, quien la encarga, sistema de la oferta, tipos de misión y misiones en orden con su sistema | `quests` |
| Condiciones de cada HRQ por modo: reputación, fechas, requisito previo y HRQ excluyentes | `quests[].requirements` |
| Recompensa de cada HRQ por modo: C-Bills, reputación, 'Mechs, pilotos, armas, equipo y texto final | `quests[].rewards` |
| Campañas de los DLC 2, 4, 5, 6, 7 y 9: inicio, fecha, misiones en orden con su pago y sus recompensas, y lo que da completarla | `campaigns` |
| Nombres de los sistemas | `systems` |

**Decisiones sobre los datos:**

- **Origen de una HRQ:** su DLC; las que no tienen, del juego base. Las cuatro HRQ solo de carrera del DLC1 (Return of the Rangers y otras) cuentan como del DLC1, como en el mapa.
- **Enlaces al mapa estelar:** usan los parámetros que el mapa ya entiende (`date`, `system`, `quest` y `campaign`). La fecha es la primera en la que se ofrece: la de la HRQ si todos sus modos tienen fecha de inicio (si un modo no la tiene, se ofrece desde el principio del mapa, 3015) y la de inicio de la campaña. Así el mapa no la enseña como «todavía no se ofrece».
- **Enlaces al MechLab:** `/mercs/?mech=<variante>`, el mismo de las fichas del mapa, que abre la variante con su build de serie. Los IDs de las variantes no cambian.
- **Pilotos hero:** enlazan a la página de pilotos, como en el mapa.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/campaigns/`, con el título **HRQ & Campaigns**, su portada en la página de inicio (en la fila de MW5, entre el MechLab y el mapa estelar) y un color propio que no repite el de las demás páginas.
- **RF2.** Dos pestañas: **High reward quests** y **DLC campaigns**, con su número.
- **RF3.** Las HRQ se agrupan por origen (juego base y cada DLC), con una explicación corta de cada grupo. Cada grupo es una lista con una fila por HRQ y las mismas columnas en todas: el nombre (con sus modos y su número de misiones), dónde se ofrece y quien la encarga, y la recompensa (los 'Mechs que da o, si no da ninguno, el dinero). Al desplegar una fila, debajo de ella y a todo el ancho:
  - los modos (campaña, carrera) y los tipos de misión;
  - el sistema de la oferta, enlazado al mapa con la HRQ elegida;
  - las condiciones por modo: reputación, fechas, requisito previo y HRQ excluyentes;
  - las misiones en orden, como una línea de pasos, con su título, su resumen y su sistema enlazado al mapa;
  - la recompensa por modo: C-Bills, reputación, 'Mechs enlazados al MechLab, pilotos hero, armas con su tier, equipo y el texto final.
- **RF4.** Cada campaña es una fila plegable de una lista como la de las HRQ, con su nombre, su DLC, dónde y desde cuándo empieza, cuántas misiones tiene, cuánto pagan en total y sus 'Mechs; desplegada, las misiones en orden con quien las encarga, su sistema enlazado al mapa, su pago y sus recompensas, y lo que da completarla.
- **RF5.** Un buscador por nombre, sistema, quien la encarga, misión o recompensa (el mismo del mapa) y un filtro por origen.
- **RF6.** La pestaña, la búsqueda, el filtro y la ficha abierta van en la URL (`?tab=campaigns&dlc=7`, `?quest=bow-and-arrow`, `?campaign=dlc7`).
- **RF7.** El MechLab, el mapa, las unidades enemigas, los pilotos y el equipo enlazan la página nueva en su cabecera.
- **RF8.** Cada DLC se nombra con su número y su nombre («DLC 8 · Chaos Reign») en los grupos, los filtros y las filas. Los nombres salen de las campañas del juego; el del DLC 1, que no tiene campaña, lo pone `generar_mapa.py`.
- **RF9.** Los DLC cuya historia se cuenta con cadenas de HRQ en vez de con una campaña (Call to Arms y Chaos Reign) salen también en la pestaña de campañas, en su propia lista: cada uno con sus cadenas en el orden en que se ofrecen, y cada cadena abre su fila en la pestaña de HRQ.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/questGuide.ts`, con sus tests: grupos por origen, búsqueda con filtro, enlaces al mapa y al MechLab, resúmenes de las recompensas y vista en la URL.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle y funciona a 390 × 844 sin desbordar la página.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las HRQ | se agrupan por origen | salen, en este orden, juego base (40), DLC 1 (11), DLC 2 (7), DLC 3 (1) y DLC 8 (5): 64 en total |
| CA2 | La búsqueda «arrow» | se filtra por el DLC 1 y por el DLC 2 | con el DLC 1 sale Bow and Arrow; con el DLC 2, ninguna. «gauss» en el juego base incluye Pirate Hunt |
| CA3 | Las campañas | se filtran por el DLC 7 y se busca «morgan» | con el DLC 7 sale solo Shadow of Kerensky; «morgan» también |
| CA4 | Bow and Arrow | se enlaza al mapa | `/mercs/starmap/?date=3023-12-20&quest=bow-and-arrow`; su misión de Ibstock, `/mercs/starmap/?date=3023-12-20&system=Ibstock&quest=bow-and-arrow` |
| CA5 | Pirate Hunt y Errant Signal | se enlazan al mapa | en 3015-01-01: Pirate Hunt no tiene fecha y Errant Signal solo la tiene en carrera |
| CA6 | Shadow of Kerensky | se enlaza al mapa | `/mercs/starmap/?date=3049-09-15&campaign=dlc7`; su misión de Rodigo lleva `system=Rodigo` |
| CA7 | Las recompensas | se resumen | Bow and Arrow da el ARC-AGC; Pirate Hunt, ningún 'Mech; Ashes & Ascension incluye el SNV-BR y el HBK-IIC-DW de completarla, sin repetir; todos los 'Mechs están en `mechs.json` y enlazan a `/mercs/?mech=<variante>` |
| CA8 | The Dragon's Gambit | se suma su pago | 67.931.715 C-Bills y 18.485 de reputación en 15 misiones |
| CA10 | Los nombres de los DLC | se escriben | el juego base es «Base game»; el DLC 1, «DLC 1 · Heroes of the Inner Sphere»; el DLC 8, «DLC 8 · Chaos Reign» |
| CA11 | Las historias contadas con HRQ | se listan | son Call to Arms (DLC 3) con Those in Need, y Chaos Reign (DLC 8) con sus cinco cadenas por fecha: Adam Steiner, Testing Ground, Ideals of War, Thumb War y New Home, Old Enemies. El filtro de la pestaña de campañas incluye los DLC 3 y 8, y la búsqueda encuentra la historia por su nombre o el de sus cadenas («steiner» da Chaos Reign). `?campaign=dlc8` abre la pestaña de campañas con Chaos Reign desplegada |
| CA9 | La URL | se abre y se construye | sin parámetros, la pestaña de HRQ, todo y nada abierto. `?tab=campaigns&dlc=7&q=kerensky` se lee y se vuelve a escribir igual. `?quest=bow-and-arrow` abre la pestaña de HRQ con Bow and Arrow desplegada y `?campaign=dlc7`, la de campañas con Shadow of Kerensky. Un id, un DLC o una pestaña que no existen se ignoran |

## Fuera de alcance

- Datos nuevos del juego: todo sale de `starmap.json`.
- Las condiciones de cada parte de las campañas y el progreso de la campaña principal que abre las regiones, que el mapa tampoco tiene.

## Plan de pruebas

1. **Lógica (CA1 a CA11):** `src/utils/questGuide.test.ts`, con `starmap.json` y `mechs.json` reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: las dos pestañas, una HRQ y una campaña desplegadas, los enlaces al mapa y al MechLab, la URL compartida y la portada.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Datos:** las 64 HRQ y las 6 campañas salen de `starmap.json`, que añade el nombre de cada DLC (`generar_mapa.py`); las 53 variantes de sus recompensas están en `mechs.json`.
- **Tests:** los once criterios (CA1 a CA11) están en `src/utils/questGuide.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900, 1100 × 800, 800 × 300 y 390 × 844: las dos pestañas, Bow and Arrow, Defense Support - Davion (dos modos y HRQ excluyente) y Adam Steiner desplegadas, Shadow of Kerensky y Ashes & Ascension desplegadas, una ficha abierta desde la URL y la portada.
- **Decisiones durante el desarrollo:**
  - Las fichas en rejilla quedaban desordenadas, con cada dato a una altura distinta: pasan a una lista con las mismas columnas en todas las filas (nombre, dónde se ofrece y recompensa). Al desplegar una fila, las misiones salen en una línea de pasos y los requisitos y las recompensas al lado; abierta desde un enlace, se lleva a la vista sin que la tape la cabecera fija.
  - Chaos Reign (DLC 8) y Call to Arms (DLC 3) no tienen campaña: su historia son cadenas de HRQ. Salen también en la pestaña de campañas, en su propia lista, para que no falten entre los DLC con historia.
  - La carátula de la portada es la DropShip Leopard del TRO 3025 (Sarna), la nave de la compañía en MW5, en un rosa (#ff4fa3) que no usa ninguna otra página.
  - Con seis páginas de MW5, los enlaces de la cabecera de `units.css` ya no parten palabras: en pantallas medianas bajan a otra línea enteros y, entre 761 y 1100 px, «MW5 Mercenaries» se queda fuera.
