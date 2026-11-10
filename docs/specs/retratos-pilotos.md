# Especificación: retratos de los pilotos hero

- **Issue:** [#95](https://github.com/PonchoiDev/mechlab-web/issues/95)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/pilots.test.ts`) y por último el código, en commits separados.

## Contexto

La pestaña Hero pilots de la página de pilotos (`docs/specs/pagina-pilotos.md`) enseña de cada piloto sus habilidades, sus rasgos y su biografía, pero no su cara. En el juego, cada piloto hero tiene un retrato en la sala de contratación y en los cuarteles.

## Datos del juego

Cada piloto llega a su retrato en tres pasos:

1. El `MWPilotPersonaAsset` del piloto apunta a su `MWPersonaAsset` (`PersonaAssetId`).
2. El `MWPersonaAsset` apunta a un `MWPortraitAsset` (`PortraitAssetId`). Su nombre puede coincidir con el de otros assets (el persona `Ash` y el retrato `Ash`), así que vale el que tiene la propiedad `Portrait`.
3. El `MWPortraitAsset` apunta a la textura (`Portrait`), una `Texture2D`.

Las texturas son de 256 × 256 en DXT5, salvo la de Goblin, de 341 × 341 sin comprimir. `leer_textura` de `tools/ue4.py` ya lee los dos formatos, como con los logos de facción.

**Retratos compartidos:**

- Los pilotos del DLC7 y Valten Ryder tienen retrato propio, y Freeman el suyo de la campaña.
- Raptor y Shenzeng usan iconos de empleados del juego.
- Goblin y los tres del DLC5 usan retratos genéricos que también llevan los pilotos contratables normales. Se enseñan igual, porque es la cara que tienen en el juego.

**Decisiones:**

- **Archivo:** cada textura se guarda una vez, con su nombre, en `public/pilots/portraits/`, como los logos de facción en `public/starmap/logos/`.
- **Tamaño:** PNG de 160 × 160, el doble de lo que ocupa en la ficha (80 px), para que se vea nítido en pantallas de alta densidad. Se reduce promediando píxeles con el color ponderado por el alfa, como los logos. Sin Pillow: el script no necesita dependencias.
- **Reducción:** `reducir` acepta tamaños que no son múltiplo del de salida (los 341 px de Goblin), repartiendo los píxeles de origen entre los de destino. Con múltiplos exactos da lo mismo que antes, así que los logos no cambian.

## Requisitos funcionales

- **RF1.** Cada ficha de piloto hero enseña su retrato a la izquierda del nombre, con un marco dorado como el resto de lo hero.
- **RF2.** En el móvil el retrato es más pequeño y no empuja el resto de la cabecera.
- **RF3.** La imagen tiene texto alternativo («Portrait of Ash Delmore») y se carga solo al acercarse a la vista (`loading="lazy"`).

## Requisitos no funcionales

- **RNF1.** `extraer_pilotos.py` saca los retratos del `.pak` y `generar_pilotos.py` añade a cada piloto el nombre de su archivo; la web no toca las texturas.
- **RNF2.** Los retratos se cargan solo al acercarse a la vista. Son PNG sin pérdida, unos 45 KB cada uno: los filtros de fila de PNG apenas los reducen (un 1 %) y sin Pillow no hay WebP ni JPEG.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los pilotos hero | se cargan | los 18 tienen retrato, y cada archivo existe en `public/pilots/portraits/` y es un PNG de 160 × 160 |
| CA2 | Los retratos | se consultan | Ash Delmore tiene el suyo (`Ash.png`); Goblin usa el genérico `Male_Rank4_1.png` y Shenzeng el icono `liao_field1.png` |
| CA3 | La URL de un retrato | se construye | `getPortraitUrl('Ash.png')` es `pilots/portraits/Ash.png` bajo la base de la web: `/mercs/pilots/portraits/Ash.png` en producción |

## Plan de pruebas

1. **Datos y lógica (CA1 a CA3):** `src/utils/pilots.test.ts`, con `pilots.json` real y los PNG de `public/`.
2. **Logos:** `extraer_mapa.py` vuelve a escribir los logos de facción idénticos con la nueva `reducir`.
3. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844, las fichas con su retrato, también los genéricos.
