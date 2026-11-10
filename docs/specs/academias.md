# Especificación: academias de pilotos en el mapa estelar

- **Issue:** [#79](https://github.com/PonchoiDev/mechlab-web/issues/79)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/academies.test.ts`) y por último el código, en commits separados.

## Contexto

Con el DLC7, los pilotos se pueden mandar a una academia a mejorar sus habilidades, ganar experiencia y aprender rasgos. Cada academia está en un sistema y ofrece sus propios programas, con su duración, su precio y el nivel de piloto que admite. En el juego solo se ven las academias cercanas y sus programas al llegar al sistema; el mapa puede enseñarlas todas, en cualquier fecha.

Los pilotos hero del issue no son personajes fijos: el juego genera pilotos con rasgos hero y los ofrece al azar como «Elite Pilot» en las salas de contratación. No tienen un sistema donde aparecer y quedan fuera de esta especificación; su catálogo de rasgos irá en la página de pilotos.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Academias | `DLC7/TOIs/PilotTraining/AcademyDataAssets/*` (93) | Nombre, descripción, sistema (`SystemID`), fecha de fundación (`FoundingDate`), si la destruyen los Clanes (`bIsDestroyedByClans`), reputación que pide (`RequiredFactionStanding`) y programas (`AvailableTrainingAssets`) |
| Programas | `DLC7/TOIs/PilotTraining/TrainingAssets/*` (29) | Nombre y descripción (claves de `TrainingProgramStringTable`) y `TrainingData`: días, matrícula, cuota trimestral, habilidad mínima y máxima del piloto y estrellas de habilidad, rasgos y experiencia |
| Cuándo abre y cierra | `AcademyToiManagerLogic` y `AcademyToiLogic` | La academia aparece desde su fecha de fundación. Si está marcada como destruida por los Clanes, desaparece cuando un Clan (`Persona.Faction.Clan`) controla su sistema |

`extraer_mapa.py` guarda las academias en `academias.json` y los programas en `programas.json`. `generar_mapa.py` los pasa a `starmap.json`.

**Decisiones sobre los datos:**

- **Fundación:** el campo es opcional. Sin él, la academia existe desde siempre. Las de antes de 3015 (los Virtual World Center, de 1991) también salen en todo el mapa.
- **Destruida por los Clanes:** el juego guarda que la academia está destruida. Se toma como permanente: desde la primera fecha en que un Clan controla su sistema, aunque luego lo pierda (Somerset vuelve a la Mancomunidad Federada entre 3050 y 3051). Pandora está marcada, pero ningún Clan la ocupa en el mapa, así que no cierra; el juego hace lo mismo.
- **Programas por nivel:** varios programas comparten nombre y cambian de nivel (`SemesterEnrollment1` a `4`). Se enseñan con su nombre y sus cifras; las estrellas indican el nivel, como en el juego.
- **Descripción:** las de los programas llevan `{AcademyName}`, que se sustituye por el nombre de la academia.
- **Reputación:** solo dos academias la piden (Albion Military Academy, 20, y New Avalon Institute of Science, 50). Se muestra como «Requires faction standing».
- **Lo que no se muestra:**
  - el prestigio (`Prestige`), que solo traen cuatro academias y cuyo valor por defecto no está en los datos;
  - las curvas que reparten la experiencia y los rasgos entre las habilidades.

## Requisitos funcionales

- **RF1.** Un panel **Academies**, junto a los demás, lista las academias abiertas en la fecha del mapa con su sistema. Se puede buscar por academia o por sistema. Los 24 Virtual World Center se agrupan en una sola entrada con sus sistemas.
- **RF2.** El mapa marca con un icono los sistemas que tienen una academia abierta en esa fecha: un birrete azul, el color del icono del juego, debajo de la estrella.
- **RF3.** Al elegir una academia se abre su ficha:
  - nombre, sistema enlazado y descripción;
  - fecha de fundación y reputación que pide, si las tiene;
  - un aviso si la destruyen los Clanes, con la fecha en esa línea del tiempo;
  - sus programas, cada uno con su descripción, duración, matrícula, cuota trimestral, habilidad del piloto que admite y estrellas de habilidad, rasgos y experiencia.
- **RF4.** La ficha de un sistema con academia la enlaza.
- **RF5.** La fecha y la academia elegida van en la URL (`?academy=<id>`), como las HRQ.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/academies.ts`, con sus tests: academias abiertas en una fecha, cierre por los Clanes, academias de un sistema, búsqueda y descripción de un programa.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las academias | se cargan | son 93, todas en sistemas del mapa y con al menos un programa del catálogo; 24 son Virtual World Center |
| CA2 | El New Avalon Institute of Science | se consulta | está en New Avalon, abre el 1 de enero de 3015, pide reputación 50 y ofrece Semester Enrollment, Full Year Enrollment, Undergraduate Program y Graduate Program, en ese orden |
| CA3 | La War College of Tamar, fundada en 3025 y destruida por los Clanes | se consultan sus fechas | no está abierta en 3024, sí lo está el 30 de diciembre de 3051 y cierra el 31 de diciembre de 3051, cuando el Clan Wolf toma Tamar |
| CA4 | La Military Academy of Somerset | se consulta el 1 de enero de 3051, con Somerset otra vez en manos de la Mancomunidad Federada | sigue cerrada: el Clan Jade Falcon la destruyó en junio de 3050 |
| CA5 | El Pandora College of Military Sciences, marcado como destruido por los Clanes | se consulta en 3060 | sigue abierto, porque ningún Clan ocupa Pandora |
| CA6 | El Gunslinger Program, fundado en 3062 | se consultan las academias abiertas en 3060 | no está |
| CA7 | Sarna y St. Ives | se piden sus academias en 3025 / en 3030 | Sarna tiene la Dutchy RTC y la Sarna Martial Academy / suma la Sarna Military Academy, fundada en 3030. St. Ives tiene la Dutchy RTC, la St. Ives Academy of Martial Sciences y el Virtual World Center |
| CA8 | El programa Full Year Enrollment de nivel 1 | se consulta | dura 365 días, cuesta 700.000 C-Bills de matrícula y 200.000 por trimestre, admite pilotos de habilidad 15 a 44 y tiene 2 estrellas de habilidad, 1 de rasgos y 4 de experiencia |
| CA9 | El mismo programa en el New Avalon Institute of Science | se pide su descripción | es «Year-long enrollment in New Avalon Institute of Science courses.» |
| CA10 | La búsqueda | se busca «nagel» / «tukayyid» | sale The Nagelring / salen las academias de Tukayyid |

## Fuera de alcance

- Los pilotos hero, que no tienen sistema (ver Contexto).
- Calcular cuánto mejora un piloto concreto con cada programa.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/academies.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - el panel Academies en 3025;
   - los iconos en el mapa;
   - la ficha del New Avalon Institute of Science y la de la War College of Tamar en 3052;
   - la ficha de Sarna con sus academias;
   - el enlace `?academy=`.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 93 academias en 82 sistemas y 29 programas. Los datos suman unos 75 KB a `starmap.json`.
- **Tests:** los diez criterios (CA1 a CA10) están en `src/utils/academies.test.ts` y pasan, con dos más de la agrupación de la lista y de `?academy=` en la URL.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: el panel en 3025 con los Virtual World Center agrupados, la búsqueda, los iconos del mapa, la ficha del New Avalon Institute of Science, la de la War College of Tamar en 3052 (destruida, en rojo, y sin icono), Sarna en 3030 con sus tres academias y `?academy=` al recargar.
- **Decisiones durante el desarrollo:**
  - La leyenda del mapa no tiene interruptores para ocultar los iconos, así que el de las academias no se puede ocultar; va debajo de la estrella, donde no tapa ningún otro.
  - Al encuadrar la academia elegida, su sistema costaba de encontrar entre las demás estrellas: se marca con un aro azul, esquinas de mira y su nombre, a cualquier zoom.
  - Las franquicias se veían como un título con una columna de enlaces, distinta del resto de filas. Ahora son una fila más («Franchise in 7 systems») que se despliega con sus sistemas como filas normales, y se despliegan solas al buscar.
  - Todas las filas de los cajones llevaban un hueco invisible delante: el punto de color de la leyenda de facciones (`.starmap-legend li::before`) ganaba a la regla que lo quitaba. Se corrige para que las listas se alineen con su buscador.
  - Elegir otra cosa (una HRQ, una variante, una compañía, una zona o una estrella) cierra la ficha de la academia, como las demás. Abrir su sistema desde la ficha la conserva, y al cerrar el sistema vuelve a verse.
