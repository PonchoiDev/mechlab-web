# Especificación: mapa estelar por fechas

- **Issue:** [#61](https://github.com/PonchoiDev/mechlab-web/issues/61)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/starmap.test.ts`) y por último el código, en commits separados.

## Contexto

En *MechWarrior 5: Mercenaries* el mapa estelar cambia con la fecha de la partida: las fronteras se mueven con las guerras de sucesión, la formación de la Federated Commonwealth o la invasión de los Clanes. Fuera del juego no hay una forma cómoda de ver cómo está la Esfera Interior en una fecha concreta, ni dónde caen los centros industriales donde se reparan y se compran 'Mechs.

El mapa va en una página propia, enlazada desde la portada de mw-builder.com, con un aspecto lo más parecido posible al del juego.

## Datos del juego

Todo sale del archivo `MW5Mercs-WindowsNoEditor.pak` de la instalación. Está sin cifrar ni comprimir, así que un script de Python sin dependencias lee su índice y extrae solo los assets necesarios (unos 7 MB de los 106 GB).

| Dato | Asset | Contenido |
|---|---|---|
| Sistemas | `InnerSphereData/MW5_InnerSphereData` (DataTable) | 2174 sistemas con nombre, coordenadas en años luz, clúster y `FactionOwnershipChanges`: la fecha de cada cambio de propietario |
| Facciones | `Factions/*` (`MWFactionAsset`) | Nombre y estencil del mapa (`StarMapStencilId`) |
| Colores del mapa | `UI/FrontEnd/Starmap/Materials/Factions/Faction_Colours_MPC` | El color de cada estencil y de los Clanes, y los de los clústeres (`Warzone`) y los centros industriales (`Safezone`) |
| Eventos | `Campaign/CampaignArcs/BorderChanges/*/Borders*` (`MWStarMapBorderAsset`) | 19 cambios de frontera, de 3025 a 3060, con su fecha (`StartDateOfBorderChange`) |
| Centros industriales | `DLC1/CareerMode/Clusters/SafeZone_*/SafeZone_*_ClusterAsset` y su malla `ClusterConstellation` | 35 clústeres de reparación, con su sistema capital, la lista de sistemas y la malla de las líneas que los unen |
| Nombres de clúster | `Campaign/Clusters/_common/Faction_StringTable` | Nombres de los clústeres con nombre propio |

Los assets extraídos se guardan como JSON en `tools/datos-juego/starmap/`, así que la extracción solo se repite cuando un parche cambie el mapa. Después, el generador produce `src/data/starmap.json`, como con los mechs.

**Decisiones sobre los datos:**

- **Propietario de un sistema en una fecha:** el último cambio de `FactionOwnershipChanges` con fecha igual o anterior. Las facciones `None` y `NoFaction` dejan el sistema sin dueño.
- **Rango de fechas:** del 1 de enero de 3015, cuando empieza la partida, al 31 de diciembre de 3060, el año del último cambio de frontera del juego. Los cambios de la tabla fuera de ese rango no se usan.
- **Color de cada facción:** el de su estencil en `Faction_Colours_MPC`. Los Clanes Wolf, Jade Falcon, Ghost Bear, Smoke Jaguar y Hell's Horses tienen color propio, y el resto de Clanes usa el de `ClanInvasion`. La Federated Commonwealth se pinta con el color de los Federated Suns, como en el juego (comprobado con una captura del mapa en enero de 3042).
- **Sin arte del juego:** los logos de facción son arte de Piranha Games, así que la ficha muestra un emblema propio con el color y las siglas de la facción.
- **Centros industriales:** la tienda de cada centro rota, así que solo se indica su ubicación.

## Requisitos funcionales

- **RF1.** El mapa está en `/mercs/starmap/`, con una carátula propia en la portada de mw-builder.com, junto a la del MechLab.
- **RF2.** Muestra todos los sistemas como estrellas, en sus coordenadas, con el norte arriba: Lyran arriba a la izquierda, Kurita arriba a la derecha, Davion abajo a la derecha, Liao abajo y Marik a la izquierda.
- **RF3.** Cada facción ocupa un territorio de su color alrededor de sus sistemas, con el borde brillante y el interior más oscuro, como en el juego. Los sistemas sin dueño no tienen territorio.
- **RF4.** Un control de fecha, abajo a la derecha, muestra la fecha como en el juego (`21 JAN 3042`) y permite moverla con un control deslizante, ir al evento anterior o al siguiente y elegir un evento de la lista. Con el control deslizante el mapa se actualiza al momento. Al saltar a un evento, los territorios se funden de la situación anterior a la nueva, cada sistema que cambia de dueño destella con el color de su nueva facción y el panel dice cuántos sistemas han cambiado de manos. Con «reducir movimiento» activado en el sistema, el cambio es inmediato.
- **RF5.** Al pasar por encima o tocar un sistema, una ficha arriba a la izquierda muestra su nombre, el emblema y el nombre de su facción en esa fecha y, si lo tiene, su clúster o que es un centro industrial. La ficha muestra siempre el historial de propietarios dentro del rango y la distancia a Terra. Al hacer clic, se queda fija, con un botón para cerrarla.
- **RF6.** Los clústeres se dibujan como polígonos translúcidos naranjas alrededor de sus sistemas. Los centros industriales, como en el juego, son líneas discontinuas en azul claro que unen sus estrellas, con un icono en su capital.
- **RF7.** El mapa se mueve arrastrando y se acerca con la rueda, con dos dedos o con botones. Al acercarse aparecen los nombres de los sistemas.
- **RF8.** Un buscador encuentra un sistema por su nombre, sin distinguir mayúsculas ni acentos, y centra el mapa en él.
- **RF9.** La fecha y el sistema elegido se guardan en la URL (`?date=3042-01-21&system=Tukayyid`) para compartir una vista concreta.

## Requisitos no funcionales

- **RNF1.** La lógica (propietario por fecha, eventos, centros industriales, búsqueda, territorios, polígonos de clúster, fechas y URL) es pura y está en `src/utils/starmap.ts`, con sus tests. Los componentes solo pintan.
- **RNF2.** Los scripts de `tools/` son Python sin dependencias, como los demás.
- **RNF3.** El mapa no se descarga con el MechLab: es otra página con su propio bundle.
- **RNF4.** Mover la fecha no recalcula a qué sistema pertenece cada punto del mapa, porque eso no cambia; solo vuelve a colorear los territorios. El arrastre y el zoom van fluidos en un móvil de gama media.
- **RNF5.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Tukayyid | se consulta su propietario el 31-12-3049, el 10-05-3052 y el 01-06-3052 | es Free Rasalhague Republic, Clan Ghost Bear y Free Rasalhague Republic |
| CA2 | El 1 de enero de 3015 | se consultan las capitales | Tharkad es de Steiner, New Avalon de Davion, Luthien de Kurita, Sian de Liao y Atreus de Marik |
| CA3 | El 1 de enero de 3041 | se consultan Tharkad y New Avalon | las dos son de la Federated Commonwealth, que se pinta del mismo color que los Federated Suns |
| CA4 | Los eventos del juego | se ordenan | son 19, el primero el 01-01-3025, la invasión de los Clanes el 01-01-3049 y el último el 01-01-3060 |
| CA5 | El 15 de junio de 3050 | se pide el evento siguiente y el anterior | son la tercera oleada de la invasión (01-08-3050) y la segunda (01-06-3050) |
| CA6 | Los centros industriales | se cargan | son 35; Diboll es la capital de uno y Blue Diamond pertenece a un centro industrial |
| CA7 | Una fecha anterior a 3015 o posterior a 3060 | se elige | se ajusta al 01-01-3015 o al 31-12-3060 |
| CA8 | Un sistema sin dueño | se consulta su propietario | no tiene, y no genera territorio |
| CA9 | La búsqueda «tuk» y «TUKAYYID» | se busca | el primer resultado es Tukayyid; los nombres que empiezan por el texto van antes que los que solo lo contienen |
| CA10 | La rejilla de territorios | se consulta un punto junto a Tharkad y otro lejos de cualquier sistema | el primero pertenece al dueño de Tharkad y el segundo a nadie |
| CA11 | Un clúster | se calcula su polígono | todos sus sistemas quedan dentro |
| CA12 | La fecha 3042-01-21 | se muestra | se lee `21 JAN 3042` |
| CA13 | La URL `?date=3042-01-21&system=Tukayyid` | se abre | el mapa empieza en esa fecha con Tukayyid elegido; con una fecha no válida empieza el 01-01-3015 |

## Fuera de alcance

- La rotación de la tienda de los centros industriales.
- Las misiones, los contratos y la reputación de la partida.
- Las rutas de viaje y su coste.
- Los logos y las texturas del juego.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA13):** `src/utils/starmap.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1920 × 1080 y a 390 × 844. Se compara con capturas del mapa del juego en 3015 y en 3042, y se comprueban el arrastre, el zoom, la ficha, el buscador y el control de fecha.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 2172 sistemas (sin la fila de marcador y el sistema oculto), 38 facciones con dueño entre 3015 y 3060, 19 eventos, 71 clústeres con nombre y 35 centros industriales con 205 sistemas. `starmap.json` pesa 300 KB (44 KB comprimido) y solo lo descarga la página del mapa.
- **Tests:** los trece criterios (CA1 a CA13) están en `src/utils/starmap.test.ts` y pasan, junto a dos más: el paso de días a fechas del control deslizante y el recuento de la leyenda.
- **Interfaz:** comprobada en el navegador a 1920 × 1080 y a 390 × 844, en desarrollo y con el build de producción.
  - En 3015 se ven las cinco casas con sus colores del juego y la periferia en gris. En enero de 3042 la Federated Commonwealth ocupa Lyran y Davion en amarillo, con Rasalhague en turquesa, como en la captura del juego.
  - Al buscar «tukay», el mapa se centra en Tukayyid, la ficha muestra sus cinco propietarios y la URL pasa a `?date=3052-05-10&system=Tukayyid`.
- **Decisiones durante el desarrollo:**
  - Los clústeres no son assets de facción con su nombre: el nombre visible sale de una referencia a `Faction_StringTable`. Un material del mapa se llama igual que la facción `Periphery`, así que el extractor se queda con el asset que tiene `FactionType`.
  - Los clústeres de reparación de la campaña (`RepairSystem_*`) no se dibujan: los centros industriales salen de los clústeres `SafeZone_*`, que traen su capital.
  - Los territorios se dibujaban primero como una textura difuminada, pero al ampliar el borde se volvía una banda borrosa. Ahora son contornos vectoriales (marching squares sobre la rejilla, suavizados): el borde es una línea nítida con un halo de grosor fijo en pantalla, así que el cambio de facción se ve igual de marcado con cualquier zoom.
  - Las líneas de cada centro industrial son una malla del juego en coordenadas propias, con unas 8 unidades por año luz y el eje X invertido. `generar_mapa.py` la encaja sobre los sistemas del centro, con un error medio de entre 0,1 y 0,5 años luz, y da por unidas dos estrellas cuando la malla recorre el tramo entre ellas. Salen 181 líneas en los 34 centros con más de un sistema.
  - El salto entre eventos se anima, pero el control deslizante no: al arrastrarlo, una animación continua estorbaría. El destello tiene un tamaño mínimo en píxeles para que se vea también con el mapa entero.
  - Al pasar el ratón por una zona sin estrella aparece una etiqueta con la facción, porque la ficha sigue mostrando el sistema elegido y parecía que describía la zona.
  - En el móvil, el zoom y la leyenda van encima del panel de fecha para no tapar la ficha.
  - La portada pasa a «SELECT TOOL», con una carátula para el mapa hecha con una captura del propio mapa.
