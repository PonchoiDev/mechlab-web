# Especificación: la Argo de BATTLETECH

- **Issue:** pendiente
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/argo.test.ts`) y por último el código, en commits separados.

## Contexto

En *BATTLETECH* (Harebrained Schemes, 2018, versión 1.9.1) la compañía vive en la *Argo*, una vieja nave de la Liga Estelar destrozada que se repara y amplía poco a poco: más 'Mechs listos para combatir, más MechWarriors en los barracones, mejor enfermería, más moral, entrenamiento pasivo y viajes más cortos. Cada mejora cuesta C-Bills al comprarla y sube el mantenimiento mensual de la nave, y casi todas piden otras antes.

El juego enseña las mejoras de una en una y solo las que ya se pueden comprar. Esta página las enseña todas, con su árbol de requisitos, y deja planificar las compras para saber cuánto cuesta un camino y cuánto se paga al mes.

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

`tools/extraer_argo_battletech.py` copia esos archivos a `tools/datos-juego/battletech/argo/` y guarda las ilustraciones y los retratos en PNG en `battletech/public/argo/`. `tools/generar_argo_battletech.py` genera `src/data/battletech/argo.json`.

**Decisiones sobre los datos:**

- **Ids:** el del juego sin el prefijo `argoUpgrade_` (`mechBay2`). Es el que va en la URL.
- **Mejoras iniciales:** la nave trae cinco, gratis y sin mantenimiento: Drive Jury Rigging, Mech Bay 1, Med Bay 1, Alpha Pod y Structural Jury-Rigging. La campaña y la carrera traen las mismas; si un parche las separa, el script falla.
- **Mantenimiento:** `AdditionalCost` es lo que cada mejora suma al mes, sobre el mantenimiento base de la nave (¢80.000). El mes dura 30 días.
- **Campaña y carrera:** la carrera tiene multiplicadores propios del precio y del mantenimiento de las mejoras, y los dos valen 1: las cifras son las mismas en los dos modos. La diferencia es cuándo se abren: en la carrera desde el primer día y en la campaña cuando la historia entrega la nave (la notificación «Argo Upgrades» de Farah). Ninguna mejora tiene requisitos de etiquetas (`Requirements`): si aparecen, el script falla.
- **Efectos:** la frase del juego para cada estadística, con su valor. Cuando la mejora fija el valor (`set`), la frase de «se fija»; si lo suma o lo resta, la de «sube» o «baja». Las estadísticas sin frase son internas (`MechBayPods`, `BarracksPods`, `DriveTravelMultiplier`) y no se enseñan: su versión `_Display` dice lo mismo en cifras legibles (12 'Mechs en lugar de 2 filas).
- **Nivel en el árbol:** 0 si la mejora no pide nada y, si no, uno más que su requisito más profundo. Van de 0 (las iniciales, Repaired Power Conduits y Lounge) a 5 (Hospital Bay).
- **Orden:** por categoría (en el orden del juego), nivel, precio y nombre.
- **Imágenes:** las ilustraciones, a la mitad (375 × 150) y giradas, porque Unity guarda las texturas de abajo arriba. Las de 750 px de ancho no son múltiplo de 4: los bloques DXT cubren 752 y se recorta el sobrante. La de la Argo en órbita (`uixTxrSpot_ArgoTravel`) no la usa ninguna mejora y sirve de portada.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/argo/`, con la cabecera de BATTLETECH: enlaces al MechLab, al mapa estelar y a la Argo.
- **RF2.** Un resumen de la nave: cuántas mejoras hay, las que trae de serie, el mantenimiento base, lo que cuesta comprarlas todas y el mantenimiento con todas.
- **RF3.** Cada mejora muestra su nombre, ilustración, categoría, precio, mantenimiento mensual, efectos con la frase del juego, requisitos y lo que abre, descripción y lo que dice el tripulante que la presenta, con su retrato.
- **RF4.** Un árbol enseña las mejoras por categoría y nivel. Al pasar por una (o al enfocarla) se resaltan todos sus requisitos y todo lo que abre.
- **RF5.** Un planificador:
  - se marcan las mejoras compradas o previstas; las iniciales están siempre;
  - marcar una añade sus requisitos; desmarcarla quita lo que depende de ella;
  - enseña el total gastado, el mantenimiento mensual (base más mejoras) y el efecto conjunto (por ejemplo, 18 'Mechs listos, +20 Tech Points, +10 Morale);
  - cada mejora sin comprar dice lo que costaría llegar a ella desde el plan actual, con sus requisitos.
- **RF6.** El plan y la vista van en la URL (`?own=mechBay3,trainingModule1&view=list`), con solo las mejoras que no son requisito de otra del plan.

## Requisitos no funcionales

- **RNF1.** La lógica (árbol, requisitos, totales, efectos, URL) es pura y está en `src/utils/battletech/argo.ts`, con sus tests.
- **RNF2.** Interfaz en inglés y sin guiones largos. El aspecto de las páginas de unidades enemigas y pilotos.
- **RNF3.** Funciona en móvil: el árbol se desplaza dentro de su caja y el resumen del plan queda a mano.

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
| CA8 | La URL | se abre con `?own=mechBay2&view=list`, con un id que no existe o sin nada | el plan tiene las iniciales, Mech Bay 2 y Repaired Power Conduits, en la vista de lista, y vuelve a dar `?own=mechBay2&view=list`; el id que no existe se ignora; sin nada, el plan inicial en el árbol y una URL vacía |
| CA9 | El árbol | se construye | tiene 9 filas, una por categoría, y 6 niveles; Hospital Bay en el nivel 5 de Med Bay |
| CA10 | Campaña y carrera | se cargan las constantes | los multiplicadores de la carrera son 1 y las mejoras iniciales las mismas |

## Fuera de alcance

- La Leopard de la campaña antes de la Argo y los eventos que dependen de las mejoras.
- El mantenimiento del resto de la compañía (sueldos, 'Mechs) y los niveles de gasto.
- Los modpacks (#104).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/battletech/argo.test.ts`, con `argo.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - el resumen y el árbol, con el resaltado de requisitos;
   - marcar y desmarcar en el árbol y en las fichas;
   - los totales del plan;
   - un enlace con `?own=`.
