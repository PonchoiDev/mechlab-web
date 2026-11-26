# Especificación: builds guardadas del MechLab de YAML

- **Estado:** implementada
- **Completa:** el RF8 y el RNF4 de [mechlab-yaml.md](mechlab-yaml.md) (builds guardadas propias, que no se mezclan con las del MechLab de MW5)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/savedBuilds.test.ts`) y por último el código, en commits separados.

## Contexto

Los MechLabs de MW5 y de BATTLETECH guardan builds en el navegador, con nombre, y las listan en la ventana **My builds** con buscador, orden y filtros ([buscar-builds-guardadas.md](buscar-builds-guardadas.md)). El de YAML solo tiene el enlace para compartir. Las builds de YAML no son builds de MW5: tienen otras piezas, otras reglas y otro código de enlace, así que van aparte.

## Requisitos funcionales

- **RF1.** La barra de herramientas tiene **Save build** y **My builds**, con la misma ventana de guardar que MW5 y BATTLETECH: guardar como nueva o actualizar la build guardada abierta, si sigue en su chasis.
- **RF2.** **My builds** tiene las acciones de BATTLETECH salvo **Compare**, que el MechLab de YAML aún no tiene (**Publish**, en [publicar-builds-yaml.md](publicar-builds-yaml.md)): cargar (avisando si la build actual no está guardada), duplicar, renombrar, copiar el enlace, borrar, importar y exportar.
- **RF3.** Las builds se guardan en su propia clave del navegador, `mw-builder:yaml:saved-builds`, con el formato común (nombre, código de enlace y fecha). El archivo exportado lleva `game: "mw5-yaml"`: el MechLab de YAML no importa archivos de MW5 ni de BATTLETECH, y los de MW5 y BATTLETECH no importan los de YAML. Una build cuyo código ya no se puede abrir se cuenta como no válida al importar.
- **RF4.** La lista tiene el buscador, el orden (también recordado, en `mw-builder:yaml:builds-sort`) y los filtros comunes de [buscar-builds-guardadas.md](buscar-builds-guardadas.md), con los datos de YAML:
  - **Clase** por el tonelaje del chasis (los superpesados son de asalto), **tecnología** (Clan por el quirk `CLAN-MECH`) y **rol** (el de la unit card, [filtros-yaml.md](filtros-yaml.md)).
  - **Anclajes mínimos** de energía, balística, misiles, omni, artillería, AMS y cuerpo a cuerpo, del 'Mech o de las armas montadas, como en MW5.
  - **Equipo montado:** Jump jets, ECM, AMS, Active probe, Motive (MASC o supercharger), TSM y Targeting computer, por la etiqueta del juego de cada pieza (`Equipment.JumpJets`, `.ECM`, `.BAP`, `.MASC`, `.SuperCharger`, `.ArenaSuperCharger`, `.TripleStrengthMyomer`, `.TargetingComputer`).
  - **De la variante:** Hero, Omni, Superheavy y YAML only, como en el selector de 'Mechs; y **Cantina upgrades**, las builds con alguna mejora de la cantina.
  - **Piezas:** un desplegable por pieza interna, **Engine** (el tipo de motor), **Structure**, **Armor** y **Heat sinks** (el kit de refrigeración), con las que llevan las builds guardadas; con varias marcadas en una, vale cualquiera, y las de distintas piezas se suman. La lista común lo admite para cualquier MechLab (`partGroups` de `BuildListConfig`); de momento solo lo usa YAML. En el selector de 'Mechs no hace falta: las piezas de serie se cambian en el MechLab, y las fijas de los OmniMechs ya se buscan con Omni.
- **RF5.** Cada build de la lista enseña su chasis y variante, su peso sobre el tonelaje y su daño alfa (el del panel), las armas montadas por tipo y unas etiquetas: el tipo de motor, la estructura, la armadura y el kit de refrigeración si no son los estándar, los retrorreactores con su número, y ECM, AP, MASC, SC, TSM y TC si los lleva.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Builds de YAML guardadas | se exportan | el archivo lleva `format: "mw-builder-builds"` y `game: "mw5-yaml"`, y se vuelve a importar entero |
| CA2 | Un archivo de builds de MW5 (`game: "mercs"` o sin `game`) o de BATTLETECH | se importa en YAML | no se acepta; y el de YAML no se acepta en MW5 ni en BATTLETECH |
| CA3 | Un archivo de YAML con una build de código roto | se importa | esa build cuenta como no válida y las demás entran |
| CA4 | El NSR-9J de serie guardado | se resume para la lista | Nightstar NSR-9J, asalto, 95 t, Inner Sphere, rol Juggernaut, daño alfa 55, sus anclajes por tipo (con los cuerpo a cuerpo) y sus armas montadas: 4 de energía y 2 balísticas |
| CA5 | Una build con retrorreactores, ECM, MASC y una mejora de la cantina | se resume | tiene los rasgos `jumpJets`, `ecm`, `motive` y `upgrades`, y las etiquetas JJ con su número, ECM y MASC |
| CA6 | Builds de un 'Mech Clan omni, de un superpesado y de una variante nueva de YAML | se resumen | `techBase` Clan y el rasgo `omni`; el rasgo `superheavy`; el rasgo `yamlOnly` |
| CA7 | Un código que ya no se puede abrir | se resume | sin datos del 'Mech, y la lista dice que ya no se puede abrir |
| CA8 | Builds resumidas | se filtran con los filtros comunes | los rasgos, los mínimos (con los cuerpo a cuerpo) y la tecnología filtran como en MW5 |
| CA9 | El NSR-9J de serie y el MAD-BARA2 de serie guardados | se filtra por Engine «XL Engine» | queda el NSR-9J; con «XL Engine» y «XL Engine (C)», los dos; con Structure «Structure standard», solo el NSR-9J |

## Fuera de alcance

- Comparar builds de YAML y publicarlas (el punto de publicar va en su propia especificación).
- Pasar builds entre el MechLab de MW5 y el de YAML.

## Plan de pruebas

1. **Lógica:** `src/utils/yaml/savedBuilds.test.ts` (CA1 a CA9).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: guardar, actualizar, abrir My builds, filtrar, renombrar, duplicar, cargar, exportar e importar; comprobar que My builds del MechLab de MW5 no ve las de YAML.
