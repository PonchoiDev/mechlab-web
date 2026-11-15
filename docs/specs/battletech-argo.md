# Especificación: la Argo de BATTLETECH

- **Issue:** [#106](https://github.com/PonchoiDev/mechlab-web/issues/106)
- **Estado:** en desarrollo (pantalla de Ship Upgrades del juego)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/argo.test.ts`) y por último el código, en commits separados.

## Contexto

En *BATTLETECH* (Harebrained Schemes, 2018, versión 1.9.1) la compañía vive en la *Argo*, una vieja nave de la Liga Estelar destrozada que se repara y amplía poco a poco: más 'Mechs listos para combatir, más MechWarriors en los barracones, mejor enfermería, más moral, entrenamiento pasivo y viajes más cortos. Cada mejora cuesta C-Bills al comprarla y sube el mantenimiento mensual de la nave, y casi todas piden otras antes.

El juego las compra en la pantalla **Ship Upgrades** de Engineering («Review and select upgrades for your ship»): tres secciones alrededor de un plano de la nave, cada una con sus categorías en cajas con título y, en cada caja, un icono cuadrado por mejora. Las instaladas van con el contorno naranja y las que se pueden comprar en gris; las que aún no se pueden comprar no aparecen. Al pulsar una se abre su ficha: la ilustración con la etiqueta «Installed», el icono, la categoría, el nombre, «Avg. costs» (el mantenimiento mensual: ¢350 en Structural Repair, su `AdditionalCost`), los efectos y la descripción, con el botón Close.

Esta página copia esa pantalla y enseña todas las mejoras, también las que aún no se pueden comprar, con su árbol de requisitos, y deja planificar las compras para saber cuánto cuesta un camino y cuánto se paga al mes.

Es una sección propia de BATTLETECH, junto al MechLab y el mapa estelar: `/battletech/argo/`.

## Datos del juego

Todo está en JSON sueltos dentro de `BattleTech_Data/StreamingAssets/` de la instalación. Los DLC (Flashpoint, Urban Warfare, Heavy Metal) no traen mejoras de la nave: sus paquetes no tienen ninguna ficha de `shipUpgrades` ni acciones que las den.

| Dato | Archivo | Contenido |
|---|---|---|
| Mejoras | `data/shipUpgrades/*.json` (35) | Nombre, descripción, categoría (`shipUpgradeCategoryID`), estancia (`Location`), precio (`PurchaseCost`), mantenimiento mensual (`AdditionalCost`), requisitos (`RequiredModules`), estadísticas que cambian (`Stats`), ilustración, tripulante que la presenta (`AssignedCastDefId`) y lo que dice (`AssignedCastDescription`) |
| Estadísticas | `data/simGameStatDesc/SimGameStatDesc_*.json` | Nombre de cada estadística y la frase con la que el juego explica el cambio («+{valor} Tech Points», «The Barracks support up to {valor} MechWarriors») |
| Categorías | `data/enums/ShipUpgradeCategory.json` | Las 9 categorías con su nombre visible |
| Tripulación | `data/cast/castDef_*Default.json` | Nombre, rango y retrato de Farah, Yang, Darius y Sumire |
| Constantes | `data/simGameConstants/SimGameConstants.json` | Mantenimiento base de la Argo (`ArgoBaseMaintenanceCost`), duración del mes, mejoras con las que se empieza (`StartingArgoUpgrades`) en la campaña y en la carrera, multiplicadores de la carrera y valores iniciales de Tech Points, Medical Points y moral |
| Imágenes | `sprites/Illustrations/uixTxrSpot_*.dds`, `sprites/Portraits/guiTxrPort_*_default_utr.png` | La ilustración de cada mejora (DXT1 o DXT5, 750 × 300) y los retratos de la tripulación |
| Iconos | `BattleTech_Data/resources.assets`: mallas `uixSvgIcon_shipUpgrade_*` | El icono de cada mejora (`Description.Icon`) y de cada sección (`typeSystemSupport`, `typeCombat`, `typePersonnel`). El juego los importa de SVG como mallas de triángulos blancos |
| Plano | `resources.assets`: textura `uixTxrIndc_argoNavDiagram` (DXT5, 288 × 288) | El plano de la Argo que el juego enseña en el panel de la nave |
| Precio reducido | `data/constants/CareerDifficultySettings.json`, opción `diff_argoUpgradeCost` | «Reduced Argo Upgrade Costs», de la carrera: multiplica precio y mantenimiento por 0,5 |

`tools/extraer_argo_battletech.py` copia esos archivos a `tools/datos-juego/battletech/argo/`, guarda las ilustraciones, los retratos y el plano en PNG en `battletech/public/argo/` y los iconos en SVG en `battletech/public/argo/icons/`. `tools/generar_argo_battletech.py` genera `src/data/battletech/argo.json`.

**Decisiones sobre los datos:**

- **Ids:** el del juego sin el prefijo `argoUpgrade_` (`mechBay2`). Es el que va en la URL.
- **Mejoras iniciales:** la nave trae cinco, gratis y sin mantenimiento: Drive Jury Rigging, Mech Bay 1, Med Bay 1, Alpha Pod y Structural Jury-Rigging. La campaña y la carrera traen las mismas; si un parche las separa, el script falla.
- **Mantenimiento:** `AdditionalCost` es lo que cada mejora suma al mes, sobre el mantenimiento base de la nave (¢80.000). El mes dura 30 días.
- **Campaña y carrera:** las cifras son las mismas en los dos modos, salvo con la opción de carrera «Reduced Argo Upgrade Costs», que se elige al empezar y deja precio y mantenimiento a la mitad (`ArgoUpgradeCostMultiplier` y `ArgoMaintenanceMultiplier` a 0,5; valen 1 por defecto). La página da las cifras completas y lo avisa. La otra diferencia es cuándo se abren: en la carrera desde el primer día y en la campaña cuando la historia entrega la nave (la notificación «Argo Upgrades» de Farah). Ninguna mejora tiene requisitos de etiquetas (`Requirements`): si aparecen, el script falla.
- **Efectos:** la frase del juego para cada estadística, con su valor. Cuando la mejora fija el valor (`set`), la frase de «se fija»; si lo suma o lo resta, la de «sube» o «baja». Las estadísticas sin frase son internas (`MechBayPods`, `BarracksPods`, `DriveTravelMultiplier`) y no se enseñan: su versión `_Display` dice lo mismo en cifras legibles (12 'Mechs en lugar de 2 filas).
- **Nivel en el árbol:** 0 si la mejora no pide nada y, si no, uno más que su requisito más profundo. Van de 0 (las iniciales, Repaired Power Conduits y Lounge) a 5 (Hospital Bay).
- **Secciones de la pantalla:** no están en los JSON: son tres paneles de la interfaz (`uixPrbPanl_SystemsAndSupportPanel`, `uixPrfPanlcombatAndDeployment`, `uixPrfPanl_personnelAndMedical`). Qué categoría va en cada una, en qué orden y con qué título sale de la pantalla del juego, y el script lo escribe con un comentario que lo dice:
  - **Systems & Support:** Power System, Structure, Drive System y Habitat Pods;
  - **Combat & Deployment:** Mech Bays, Repair & Refit y Training Modules;
  - **Personnel & Medical:** Med Bays y Recreation.

  El título de la caja es el de la pantalla («Habitat Pods», «Repair & Refit»); el de la ficha, el de `ShipUpgradeCategory.json` («Habitat Pod»).
- **Orden:** por sección y categoría, como en la pantalla, y dentro de cada categoría por id, que es el orden en que el juego carga las mejoras (`VersionManifest.csv`): Repair & Refit va Automation, Improved Automation, Machine Shop, Refit Harness y Repair Scaffolding, como en el juego. El juego pone delante las instaladas; aquí el orden no cambia al planificar.
- **Iconos:** cada malla es un SVG importado: posiciones (tres `float`) y color (cuatro bytes) por vértice e índices de 16 bits. Todos los triángulos son blancos, así que el script los junta en un solo trazado SVG, sin costuras, y la página lo colorea con una máscara según el estado de la mejora.
- **Imágenes:** las ilustraciones, a la mitad (375 × 150) y giradas, porque Unity guarda las texturas de abajo arriba. Las de 750 px de ancho no son múltiplo de 4: los bloques DXT cubren 752 y se recorta el sobrante. La de la Argo en órbita (`uixTxrSpot_ArgoTravel`) no la usa ninguna mejora y sirve de portada.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/argo/`, con la cabecera de BATTLETECH: enlaces al MechLab, al mapa estelar y a la Argo.
- **RF2.** Un resumen de la nave: cuántas mejoras hay, las que trae de serie, el mantenimiento base, lo que cuesta comprarlas todas y el mantenimiento con todas.
- **RF3.** Cada mejora muestra su nombre, ilustración, categoría, precio, mantenimiento mensual, efectos con la frase del juego, requisitos y lo que abre, descripción y lo que dice el tripulante que la presenta, con su retrato.
- **RF4.** La vista principal es la pantalla Ship Upgrades del juego:
  - las tres secciones con su icono y sus categorías en cajas, en el orden del juego, alrededor del plano de la nave; en el móvil, una debajo de otra;
  - un icono por mejora: naranja si está en el plan o viene con la nave (como las instaladas del juego), gris si se puede comprar y apagado si antes hacen falta otras;
  - al pasar por una (o al enfocarla) se resaltan en turquesa todos sus requisitos y todo lo que abre, y el resto se apaga;
  - al pulsarla se abre su ficha, como la del juego: ilustración con su estado, icono, categoría, nombre, precio, mantenimiento mensual, efectos, requisitos y lo que abre (que llevan a su ficha), descripción, lo que dice el tripulante y el botón para añadirla al plan o quitarla. Se cierra con Close, con Escape o pulsando fuera. En el móvil sale desde abajo.
- **RF4 bis.** Un árbol enseña las mejoras por categoría y nivel, con el mismo resaltado, y una lista las enseña todas en fichas.
- **RF5.** Un planificador:
  - se marcan las mejoras compradas o previstas; las iniciales están siempre;
  - marcar una añade sus requisitos; desmarcarla quita lo que depende de ella;
  - enseña el total gastado, el mantenimiento mensual (base más mejoras) y el efecto conjunto (por ejemplo, 18 'Mechs listos, +20 Tech Points, +10 Morale);
  - cada mejora sin comprar dice lo que costaría llegar a ella desde el plan actual, con sus requisitos.
- **RF6.** El plan y la vista van en la URL (`?own=mechBay3,trainingModule1&view=list`), con solo las mejoras que no son requisito de otra del plan. La vista por defecto es la pantalla del juego; `view=tree` y `view=list`, el árbol y la lista.
- **RF7.** La página avisa de que la opción de carrera «Reduced Argo Upgrade Costs» deja precio y mantenimiento a la mitad.

## Requisitos no funcionales

- **RNF1.** La lógica (árbol, requisitos, totales, efectos, URL) es pura y está en `src/utils/battletech/argo.ts`, con sus tests.
- **RNF2.** Interfaz en inglés y sin guiones largos. El aspecto de las páginas de unidades enemigas y pilotos.
- **RNF3.** Funciona en móvil: las secciones se apilan, la ficha sale desde abajo, el árbol se desplaza dentro de su caja y el resumen del plan queda a mano.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las mejoras | se cargan | son 35 en 9 categorías, con ids distintos y requisitos que existen; 5 son iniciales: drive0, mechBay1, medBay1, pod1 y structure0, a precio 0 |
| CA2 | Mech Bay 2 | se consulta | cuesta ¢900.000 y ¢25.000 al mes, pide Mech Bay 1 y Repaired Power Conduits, abre Mech Bay 3 e Improved Automation, y dice «The MechBay supports up to 12 BattleMechs ready for battle» y «+3 Tech Points» |
| CA3 | Hospital Bay | se consulta | es de nivel 5, dice «Chance of death from Lethal damage is 5% less likely», y tiene 12 requisitos en total, entre ellos Med Bay 1, Gamma Pod y High-Capacity Power Conduits |
| CA4 | El plan inicial | se pide el camino a Hospital Bay | son 10 mejoras por comprar, ¢10.620.000 y ¢57.000 al mes |
| CA5 | Los totales | se calculan | el plan inicial cuesta 0 y ¢80.000 al mes; con todo, ¢20.155.000 y ¢197.650 de mejoras, ¢277.650 al mes |
| CA6 | El plan | se marca Mech Bay 3, se desmarca Repaired Power Conduits o se desmarca Mech Bay 1 | Mech Bay 3 trae Mech Bay 2, Repaired e Improved Power Conduits y Structural Repair; quitar Repaired Power Conduits quita lo que depende de ella (Mech Bay 2 y 3, Improved Power Conduits…); Mech Bay 1 es inicial y no se quita |
| CA7 | El efecto conjunto | se calcula | con el plan inicial, 6 'Mechs, 8 MechWarriors, +2 Tech Points y +1 Medical Points; con todo, 18 'Mechs, 24 MechWarriors, viajes un 30 % más cortos, +20 Tech Points, +6 Medical Points, +10 Morale, 50 de experiencia al día hasta 30.000 y un 5 % menos de muertes por heridas letales y por incapacitación |
| CA8 | La URL | se abre con `?own=mechBay2&view=list`, con un id que no existe o sin nada | el plan tiene las iniciales, Mech Bay 2 y Repaired Power Conduits, en la vista de lista, y vuelve a dar `?own=mechBay2&view=list`; el id que no existe se ignora; sin nada, el plan inicial en la pantalla del juego y una URL vacía; `?view=tree` abre el árbol |
| CA9 | El árbol | se construye | tiene 9 filas, una por categoría, y 6 niveles; Hospital Bay en el nivel 5 de Med Bay |
| CA10 | Campaña y carrera | se cargan las constantes | los multiplicadores de la carrera son 1, con «Reduced Argo Upgrade Costs» 0,5, y las mejoras iniciales las mismas |
| CA11 | Las secciones | se agrupan las mejoras | son Systems & Support (Power System, Structure, Drive System, Habitat Pods), Combat & Deployment (Mech Bays, Repair & Refit, Training Modules) y Personnel & Medical (Med Bays, Recreation), en ese orden, con las 35 mejoras y cada categoría una sola vez |
| CA12 | Las cajas | se ordenan | Repair & Refit: Automation, Improved Automation, Machine Shop, Refit Harness, Repair Scaffolding; Med Bays: Med Bay 1, 2 y 3 y Hospital Bay; Habitat Pods: Alpha, Beta y Gamma Pod |
| CA13 | Los iconos | se cargan | cada mejora y cada sección tiene el suyo; Structural Repair, `structure1`, y Hospital Bay, `medbay4` |
| CA14 | El estado de cada icono | se calcula con el plan inicial y Repaired Power Conduits | Mech Bay 1 viene con la nave, Repaired Power Conduits está en el plan, Mech Bay 2 se puede comprar y Mech Bay 3 aún no |

## Fuera de alcance

- La Leopard de la campaña antes de la Argo y los eventos que dependen de las mejoras.
- El mantenimiento del resto de la compañía (sueldos, 'Mechs) y los niveles de gasto.
- Los modpacks (#104).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA14):** `src/utils/battletech/argo.test.ts`, con `argo.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - la pantalla Ship Upgrades, comparada con la del juego: secciones, cajas, iconos y estados;
   - la ficha de una mejora, que se cierra con Close, Escape y pulsando fuera; en el móvil, desde abajo;
   - el resumen y el árbol, con el resaltado de requisitos;
   - marcar y desmarcar en el árbol y en las fichas;
   - los totales del plan;
   - un enlace con `?own=`.
