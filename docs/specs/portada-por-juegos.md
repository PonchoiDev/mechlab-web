# Especificación: portada agrupada por juego

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/data/portal.test.ts`) y por último el código, en commits separados.

## Contexto

La portada (`site/index.html`, HTML estático que el build copia a la raíz del sitio) muestra una carátula por herramienta: siete de *MechWarrior 5: Mercenaries* y siete de *BATTLETECH*, en una rejilla de cuatro columnas. Con siete por juego siempre sobra un hueco, cada herramienta nueva alarga la página y quien viene por un juego tiene que pasar por las carátulas del otro. La presentación de arriba ocupa media pantalla antes de llegar a ellas.

El rediseño agrupa las herramientas por juego: una carátula por juego que, al pulsarla, despliega sus herramientas en filas.

## Requisitos funcionales

- **RF1. Cabecera.** La marca es una insignia hexagonal (un guiño a los mapas de hexágonos de BattleTech) con «MW» dentro, el nombre «MW Builder» y debajo «MechWarrior · BattleTech». Al pasar el ratón la insignia da media vuelta: el hexágono queda igual y «MW» al revés sigue diciendo «MW». A la derecha, la campana de novedades, Feedback y Support, como hasta ahora; la campana se balancea al pasar el ratón, como si sonara.
- **RF2. Banner.** Una franja a todo el ancho con el titular «Fan-made tools for MechWarrior and BattleTech games» y una escena en holograma verde: un Warhammer al frente, un Black Knight y un Kodiak a los lados y una DropShip Union posada al fondo, sobre un suelo de rejilla en perspectiva. A la derecha, un panel con:
  - **Latest update:** una luz que parpadea, la fecha de la novedad más reciente (de `/changelog.json`, la misma lista que la campana) y «See what's new», que abre la campana.
  - **Game data:** la versión de cada juego con la que están hechos los datos.
- **RF3. Carátulas de juego.** Dos carátulas, una por juego, con el logo oficial del juego, el estudio, sus cifras y el número de herramientas. De fondo, el mapa estelar del juego y un 'Mech de Sarna en holograma del color del juego: el Marauder en MW5, a la izquierda y en espejo, con el texto a la derecha; el Hunchback en BATTLETECH, a la derecha, con el texto a la izquierda. En el logo de BATTLETECH, que en el juego es todo blanco, la A va en naranja, como en la portada del juego.
- **RF4. Herramientas en filas.** Al pulsar una carátula se despliegan debajo, a todo el ancho, las herramientas de ese juego, una por fila: miniatura, nombre, cifras separadas por un punto centrado y «Open». El MechLab va primero y algo más alto. Solo hay un juego abierto a la vez: pulsar el otro lo cambia y pulsar el abierto lo cierra. En móvil cada lista va justo debajo de su carátula.
- **RF5. Juego abierto.** El juego abierto va en la dirección (`#mw5`, `#battletech`), así que se puede enlazar, y se recuerda para la siguiente visita. La primera vez no se abre ninguno.
- **RF6. Cifras.** Las de cada herramienta:

  | Herramienta | MW5: Mercenaries | BATTLETECH |
  |---|---|---|
  | MechLab | variantes · Save & share builds | variantes · Save & share builds |
  | Chassis | Stats · Filters · Builds | Stats · Filters · Builds |
  | HRQ y campañas / Flashpoints | misiones HRQ · campañas DLC | flashpoints · 3 DLC |
  | Star Map | 3015 to 3060 · Borders by date | sistemas · Career mode |
  | Enemy Units | unidades · Tanks · VTOLs · Turrets | unidades · Tanks · Turrets |
  | Pilots / Argo | rasgos · pilotos hero · academias | mejoras · Refit planner |
  | Equipment | armas · equipo · Stats | armas · equipo · Stats |

- **RF7. Pie.** El de siempre: la nota de apoyo con el enlace a Ko-fi, el enlace de feedback y el aviso legal.
- **RF8. Sin etiquetas NEW** en las herramientas, y sin la franja «More games».

## Requisitos no funcionales

- **RNF1.** Las cifras salen de los datos que usan las páginas de cada herramienta; un test comprueba que la portada no se queda atrás cuando cambian.
- **RNF2.** Las imágenes de los juegos salen de sus archivos con un script de `tools/`: el logo de MW5 (`MW5_Logo_1200_UIX`, del .pak) y el de BATTLETECH (`uixTxr_landingLogo`, de `resources.assets`). Los dibujos de Sarna del banner se descargan y se pasan a líneas sobre transparente con otro script, para pintarlos del verde de la web como máscaras; los demás se sirven por el proxy de imágenes, como hasta ahora.
- **RNF3.** Sin JavaScript se ven las dos listas de herramientas desplegadas: el script las pliega al cargar.
- **RNF4.** Con «reducir movimiento» activado no hay animaciones.
- **RNF5.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | La portada | se leen sus carátulas de juego | hay dos, `mw5` y `battletech`, cada una con su lista de herramientas |
| CA2 | Cada lista | se leen sus enlaces | MW5 enlaza a `/mercs/` y sus seis páginas (chassis, campaigns, starmap, units, pilots, equipment); BATTLETECH a `/battletech/` y sus seis (chassis, flashpoints, starmap, units, argo, equipment); el MechLab va primero |
| CA3 | La portada | se busca una etiqueta NEW o la franja «More games» | no hay ninguna |
| CA4 | Las cifras de cada fila | se comparan con los datos | coinciden: 639 y 96 variantes, 64 misiones HRQ y 6 campañas, 3015 a 3060, 219 sistemas, 32 flashpoints, 115 y 37 unidades, 184 rasgos, 18 pilotos hero y 93 academias, 35 mejoras de la Argo, 190 y 210 armas, 149 y 100 equipos |
| CA5 | Las cifras de cada fila | se leen | van cada una en su elemento, para que el punto centrado las separe siempre igual |
| CA6 | La portada | se busca «—» o «--» en sus textos | no hay ninguno |

## Fuera de alcance

- La nueva marca en las cabeceras del resto de páginas y en el favicon.
- Nuevas herramientas o cambios en ellas.

## Plan de pruebas

1. **Contenido (CA1 a CA6):** `src/data/portal.test.ts` lee `site/index.html` y lo compara con los datos de `src/data/`.
2. **Interfaz:** en el navegador, en escritorio y en móvil: abrir y cerrar cada juego, el ancla y el juego recordado, «See what's new», el giro de la insignia, el balanceo de la campana y el pie.
