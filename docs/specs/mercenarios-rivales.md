# Especificación: mercenarios rivales en el mapa estelar

- **Issue:** [#83](https://github.com/PonchoiDev/mechlab-web/issues/83)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/mercs.test.ts`) y por último el código, en commits separados.

## Contexto

Con el DLC4, las compañías de mercenarios rivales (Gray Death Legion, Kell Hounds, Wolf's Dragoons…) ocupan zonas del mapa estelar y aparecen en los contratos de los sistemas cercanos, como enemigas o como aliadas. Cada zona cambia de dueño con el tiempo. En el juego solo se ve la situación del momento; el mapa puede enseñar dónde está cada compañía en cualquier fecha.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Zonas de influencia | `DLC4/CampaignData/RivalMercs/StarMapRadialInfluences/*` (76) | Sistemas cercanos (`NearbyStarSystems`), radio (`Radius`), historial de dueño con fechas (`OwnerTimeline`, con `HideInCampaign` en cada tramo) y la rotación al acabar el historial (`PostTimelineOwnershipInterval`: días con dueño y días vacía) |
| Compañías | `DLC4/CampaignData/RivalMercs/Companies/*` | Nivel de los pilotos (`SkillLevel`) y sus datos (`*Data`: descripción y asset de facción) |
| Nombre y logo | `Factions/RivalMercs/*` | Nombre (clave de `RivalMercNames_StringTable`) y logo (`LogoLarge`) |

`extraer_mapa.py` guarda las compañías y las zonas en `rivales.json` y los logos en `public/starmap/logos/`, como los de las facciones. `generar_mapa.py` los pasa a `starmap.json`.

**Decisiones sobre los datos:**

- **Compañías:** se unen por su asset de facción. Los Wolf's Dragoons tienen tres compañías por épocas (con Kurita de 3023 a 3028, con Davion en 3029) con la misma facción: son una sola. Quedan 18.
- **Dónde se dibuja la zona:** el `Radius` del juego (de 0,85 a 2,8) no está en años luz ni guarda una proporción fija con la distancia a sus sistemas. La zona se dibuja como un círculo centrado en sus sistemas cercanos que los cubre, con 4 años luz de margen.
- **Dueño en una fecha:** el del último tramo del historial que empieza en esa fecha o antes. El primer tramo no tiene fecha y vale desde siempre.
- **Solo en carrera:** los tramos con `HideInCampaign` no ocurren en campaña (668 de 1.493). Se muestran marcados como de carrera.
- **Después del historial:** casi todos los historiales acaban en 3050. En las zonas con rotación, el último tramo dura sus días con dueño (o vacía, si no tiene) y después el juego reparte la zona al azar entre las compañías: el mapa la marca como rotación aleatoria.
- **Lo que no se muestra:** el nivel de 'Mech de cada compañía (`MechLevel`, de 2 a 15), porque no está claro qué significa en el juego, y la frecuencia de aparición, que es la misma en todas.

## Requisitos funcionales

- **RF1.** Un panel **Rival mercs**, junto a los demás, lista las compañías con su logo y cuántas zonas ocupan en la fecha del mapa. El mapa dibuja siempre las zonas ocupadas en esa fecha: un círculo discontinuo con el logo de su compañía en el centro.
- **RF2.** Al elegir una compañía se abre su ficha: logo, nombre, nivel de los pilotos, descripción y las zonas que ocupa en esa fecha, con sus sistemas enlazados y si el tramo es solo de carrera. El mapa encuadra sus zonas y solo dibuja las suyas.
- **RF3.** Con las zonas dibujadas, al pasar el ratón por una se ve la compañía que la ocupa (o que rota al azar) y si el tramo es solo de carrera, y al pulsarla se abre su ficha. El logo tiene prioridad sobre la estrella que queda debajo, porque el centro de la zona suele caer sobre uno de sus sistemas.
- **RF4.** Si en esa fecha la zona rota al azar, se dibuja con un signo de interrogación en vez de logo y la etiqueta lo explica.

## Requisitos no funcionales

- **RNF1.** La lógica (dueño de una zona en una fecha, zonas de una compañía, zona bajo un punto) es pura y está en `src/utils/mercs.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las compañías | se cargan | son 18, todas con logo; la Gray Death Legion se llama «The Gray Death Legion» y sus pilotos son Regular; los Wolf's Dragoons son una sola compañía |
| CA2 | La zona `BorderDAVIONBaseKurita12to13` | se consulta su dueño | sus sistemas son Kentares, Raman y Johnsondale; el 1 de enero de 3017 es de los Blackhearts, el 1 de enero de 3019 no tiene dueño y el 1 de enero de 3021 es de The Bad Dream |
| CA3 | La zona `BorderKURITABaseSteiner13to14` el 1 de junio de 3019 | se consulta su dueño | es de Brion's Legion, en un tramo solo de carrera |
| CA4 | La zona `BorderDAVIONBaseKurita12to13`, cuyo último tramo es de los Waco Rangers desde el 1 de enero de 3050 y rota cada 400 días | se consulta su dueño | el 1 de junio de 3050 es de los Waco Rangers y el 1 de enero de 3052 rota al azar |
| CA5 | El centro de una zona y un punto lejos de todas | se busca la zona bajo el punto | el primero es esa zona y el segundo ninguna |
| CA6 | Los Blackhearts el 1 de enero de 3017 | se piden sus zonas | incluyen `BorderDAVIONBaseKurita12to13` |
| CA7 | Todas las zonas | se cargan | son 76, todos sus sistemas están en el mapa y todos sus dueños son compañías conocidas |

## Fuera de alcance

- Los encuentros con mercenarios en los contratos y sus recompensas.
- El Bounty Hunter y su información, que ya salen como recompensas.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA7):** `src/utils/mercs.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: abrir Rival mercs en 3025 (zonas con logos), pasar el ratón y pulsar una zona, elegir la Gray Death Legion, y ver una zona con rotación aleatoria en 3055.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 18 compañías con su logo y 76 zonas con 1.493 tramos de historial (668 solo de carrera); 72 zonas rotan al azar al acabar el historial. Los datos suman unos 100 KB a `starmap.json` (15 KB comprimidos).
- **Tests:** los siete criterios (CA1 a CA7) están en `src/utils/mercs.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: el panel en 3025 con las zonas y sus logos, la etiqueta y el clic en la zona de la Eridani Light Horse (con un tramo solo de carrera), la ficha de la Gray Death Legion y las zonas con rotación al azar en 3055.
- **Decisiones durante el desarrollo:**
  - El centro de la zona suele caer sobre uno de sus sistemas y el logo tapaba la estrella: al pulsar el logo manda la zona.
  - Con seis cajones, abrir uno ensanchaba la fila y la partía en dos: el contenido de un cajón abierto flota ahora encima de su botón (en el móvil sigue dentro del cajón), y los dos últimos se alinean por la derecha para no tapar el panel de fecha.
  - Al elegir una compañía, el panel se cierra para no tapar lo que el mapa encuadra.
  - Al principio las zonas solo se dibujaban con el panel abierto; se dibujan siempre, porque así se ve de un vistazo dónde está cada compañía.
