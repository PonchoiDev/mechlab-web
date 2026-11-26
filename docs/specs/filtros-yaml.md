# Especificación: filtros del selector de 'Mechs del MechLab de YAML

- **Estado:** implementada
- **Depende de:** [mechlab-yaml.md](mechlab-yaml.md) (RF2: el selector de 'Mechs del MechLab de MW5, con las variantes de YAML)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/mechList.test.ts`) y por último el código, en commits separados.

## Contexto

El selector de 'Mechs del MechLab de YAML solo busca por nombre y variante y filtra por clase. El del MechLab de MW5 filtra además por tecnología, rol, equipo, anclajes mínimos, año, DLC y 'Mechs hero, y su buscador entiende atajos («3e 2m jj»). YAML tiene además cosas propias que interesa buscar: sus quirks, sus 151 variantes nuevas, los superpesados, los OmniMechs y los anclajes cuerpo a cuerpo.

## Datos

`tools/generar_yaml.py` añade a cada variante de `src/data/yaml/mechs.json`:

| Campo | Origen |
|---|---|
| `introYear` y `role` | La unit card de YAML de su loadout de serie (`fichas.json`: `IntroDate` en ticks de .NET y `CombatRole`), con la prioridad de `generar_mechs.py`: la que se llama como el loadout, después la de mercado y después cualquiera. Sin unit card de YAML, los del MechLab de MW5: ninguna variante del juego base cambia de año ni de rol con YAML (la unit card de YAML del WHM-DNC, de 3040, es la de su loadout de campaña, no la del jugable) |
| `hero` | `bIsHeroMech` del MDA de YAML, o el del MechLab de MW5 |
| `yamlOnly` | Las variantes nuevas de YAML, que no están en el MechLab de MW5 |

La tecnología y el omni salen de los quirks `CLAN-MECH` y `OMNI-MECH`; los anclajes, de las ubicaciones; los DLC, de `dlc`.

## Requisitos funcionales

- **RF1.** El panel del selector tiene los filtros del MechLab de MW5 que tienen sentido con YAML, con su mismo aspecto y comportamiento:
  - **Class** (L, M, H, A), **Tech** (IS o Clan) y **Role**.
  - **Min hardpoints** de energía, balística, misiles, omni y artillería. Los omni cuentan como energía, balística o misiles, como en MW5.
  - **Available by** (año) y **DLC**, con los DLC recordados en el navegador del selector de MW5 (son los mismos DLC del juego). Un 'Mech Clan está disponible desde 3050, como en MW5.
- **RF2.** Y los propios de YAML:
  - **Variant:** **Hero**, **Omni** (OmniMechs), **Superheavy** (los superpesados) y **YAML only** (las variantes nuevas de YAML).
  - **Min hardpoints** también de **AMS** y **cuerpo a cuerpo** (Melee), que en YAML son anclajes como los demás.
  - **Quirks:** una lista con los quirks de las variantes; con varios marcados, salen las que tienen todos.
- **RF3.** Sin el filtro **Equipment** de MW5 (jump jets, ECM, AMS, sonda activa y Motive): en YAML los retrorreactores, el ECM, las sondas y el MASC van en las ranuras generales (`SetSpecialEquipmentSlotType`), así que cualquier 'Mech los monta. El AMS pasa a los anclajes mínimos.
- **RF4.** El buscador busca en el chasis, la variante, el id y los nombres de los quirks, y entiende los atajos de MW5 que valen en YAML: `3e`, `2b`, `2m`, `1o`, `1art`, `1ams`, `hero`, `dlc7` y `base`; y los de YAML: `2mel` (cuerpo a cuerpo), `clan`, `omni`, `sh` (superpesados) y `yaml` (variantes nuevas).
- **RF5.** Cada variante de la lista enseña sus anclajes por tipo (sin tamaño: en YAML el tamaño no limita qué arma cabe), su DLC, si es hero o nueva de YAML y, debajo, su tonelaje, su año y su rol, como en MW5.
- **RF6.** El panel dice cuántas variantes salen y tiene **Clear filters**; la etiqueta del selector dice cuántos filtros hay activos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los datos de YAML | se generan | el WHM-DNC tiene 2599 y Brawler, como en el MechLab de MW5, es hero y no es `yamlOnly`; el ANH-1G es `yamlOnly` y tiene año y rol; el AS7-D tiene los del MechLab de MW5 |
| CA2 | El filtro Superheavy | se aplica | salen las 3 variantes superpesadas |
| CA3 | Los filtros Clan y Omni | se aplican | solo variantes con los quirks `CLAN-MECH` y `OMNI-MECH` |
| CA4 | Al menos 2 anclajes cuerpo a cuerpo | se filtra | solo variantes con 2 o más; con 1 omni y ninguno de energía, una variante cumple «1 de energía» |
| CA5 | El buscador | se escribe `3e 2mel sh` | se filtra igual que con 3 de energía, 2 cuerpo a cuerpo y Superheavy marcados, y el texto que queda se busca en el nombre |
| CA6 | El buscador | se escribe el id o el nombre de un quirk (`sldf`, `star league`) | salen las variantes con ese quirk |
| CA7 | Los quirks Star League Relic (`SLDF`) y Command 'Mech (`CMD-MECH`) marcados | se filtra | solo las variantes con los dos |
| CA8 | Available by 3025 | se filtra | no sale ningún 'Mech Clan ni ninguno con año posterior |
| CA9 | YAML only | se filtra | salen las 151 variantes nuevas |

## Fuera de alcance

- Las builds guardadas de YAML y sus filtros, que van en su propia especificación.
- La rareza por facción y las fuentes de cada variante (el mapa estelar).

## Plan de pruebas

1. **Datos y lógica:** `src/utils/yaml/mechList.test.ts` (CA1 a CA9).
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: abrir el selector, marcar y quitar cada filtro, escribir atajos, elegir una variante.
