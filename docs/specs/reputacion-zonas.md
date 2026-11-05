# Especificación: reputación recomendada y dificultad de las zonas

- **Issue:** [#72](https://github.com/PonchoiDev/mechlab-web/issues/72)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/starmap.test.ts`) y por último el código, en commits separados.

## Contexto

El mapa ya dibuja las zonas de conflicto (clústeres) y los centros industriales ([mapa-estelar.md](mapa-estelar.md)), pero no dice qué nivel piden. El juego indica para cada zona la reputación recomendada y su dificultad, y es lo que decide si compensa viajar hasta allí con la compañía que se tiene.

## Datos del juego

Cada zona es un `ClusterAsset` con sus sistemas (`SystemIds`) y un `ClusterToiDataFragment` cuya configuración trae:

| Campo | Ejemplo | Contenido |
|---|---|---|
| `RecommendedReputation` | `8`, `13-15` | Reputación recomendada, como texto: un nivel o un intervalo |
| `DisplayDifficultyLevel` | `45` | Dificultad que muestra el juego |
| `MinDifficultyLevel`, `MaxDifficultyLevel` | `42`, `45` | Dificultad de los contratos que genera |
| `ClusterName` | `Cluster_TaurianCorridor_Name` | Nombre, en la tabla de textos |

Los assets están en tres sitios, uno por modo:

| Carpeta | Modo |
|---|---|
| `Campaign/Clusters/` | Campaña |
| `DLC1/CareerMode/Clusters/` | Carrera |
| `DLC<n>/CampaignData/` | Zonas de las campañas de los DLC, que se juegan en los dos modos |

`extraer_mapa.py` guarda la configuración y los sistemas de cada `ClusterAsset` en `tools/datos-juego/starmap/zonas.json`, y `generar_mapa.py` añade a cada clúster y a cada centro industrial de `starmap.json` sus niveles.

**Decisiones sobre los datos:**

- **Unión por sistemas:** el mapa toma las zonas del campo `Cluster` de cada sistema, que apunta a un asset de facción, no al `ClusterAsset`. Los nombres de los dos no siempre coinciden (en el juego, el asset `FreeWorldInterior` tiene los sistemas de Free Worlds Commerce Hub y al revés), así que un `ClusterAsset` corresponde a una zona del mapa si tiene exactamente sus mismos sistemas. Los de las invasiones de los clanes (DLC7, DLC8 y DLC9), que solo comparten parte, no cuentan.
- **Modos:** cada modo conserva su reputación y su dificultad, porque cambian mucho (Shipping Route pide reputación 6 en campaña y 11-12 en carrera). Si dos assets del mismo modo dan lo mismo, cuenta uno; si dan distinto (Rasalhague Outer Reaches tiene dos en carrera, 1-3 y 7-10), se muestran los dos.
- **Datos que faltan:** las zonas de un solo sistema de los DLC (Sarna, Vega…) casi nunca traen reputación ni dificultad, y los centros industriales casi nunca traen reputación. Se muestra lo que haya, y nada si no hay nada.
- **Dificultad:** la que muestra el juego (`DisplayDifficultyLevel`), no el intervalo de los contratos.
- **Nombre de Taurian Corridor:** en el juego, el asset de facción de Taurian Corridor y el de Outworlds Border llevan escrito el texto `OutworldsBorder` en vez de una clave de la tabla de textos, y el mapa mostraba las dos zonas con el mismo nombre. En las zonas de varios sistemas con el nombre sin localizar, se usa el `ClusterName` de su `ClusterAsset` de campaña: Taurian Corridor y Outworlds Alliance Border. Las de un solo sistema se llaman como su sistema y no cambian.

## Requisitos funcionales

- **RF1.** Cada zona y cada centro industrial lleva sus niveles: por modo (o uno solo si los modos coinciden o es de un DLC), la reputación recomendada y la dificultad.
- **RF2.** La ficha del sistema muestra, debajo de su zona y de su centro industrial, una línea por modo: `Recommended reputation 8 · Difficulty 45`, con `Campaign:` o `Career:` delante si los modos difieren.
- **RF3.** El mapa muestra Taurian Corridor con su nombre.

## Requisitos no funcionales

- **RNF1.** La lectura de los niveles de una zona es pura y está en `src/utils/starmap.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Liao/Davion Border | se consultan sus niveles | en campaña, reputación 8 y dificultad 45; en carrera, reputación 3-6 y dificultad 20 |
| CA2 | Rasalhague Outer Reaches | se consultan sus niveles | en campaña, reputación 13-15 y dificultad 100; en carrera hay dos, 1-3 con dificultad 9 y 7-10 con dificultad 60 |
| CA3 | Border Protectorate Region, una zona solo de carrera | se consultan sus niveles | solo hay uno, de carrera, con reputación 15 y dificultad 100 |
| CA4 | Barcelona (DLC8) y Sarna (DLC2) | se consultan sus niveles | Barcelona tiene uno, sin modo, con reputación 8 y sin dificultad; Sarna no tiene ninguno |
| CA5 | El centro industrial de Diboll (`SafeZone_1`) | se consultan sus niveles | en campaña, dificultad 7 sin reputación; en carrera, reputación 1-2 y dificultad 7 |
| CA6 | Todas las zonas de más de un sistema | se consultan sus niveles | todas tienen alguno con reputación |
| CA7 | Todos los centros industriales | se consultan sus niveles | todos tienen alguno con dificultad |
| CA8 | Un nivel con reputación y dificultad, y otro solo con dificultad | se describe | `Recommended reputation 8 · Difficulty 45` y `Difficulty 7` |
| CA9 | Taurian Corridor y Outworlds Border | se consultan sus nombres | son `Taurian Corridor` y `Outworlds Alliance Border` |

## Fuera de alcance

- La dificultad de cada contrato, que el juego calcula al generarlo.
- Las zonas de las invasiones de los clanes, que cambian con la campaña de cada DLC.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA9):** `src/utils/starmap.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, la ficha de un sistema de Liao/Davion Border (dos modos), de Diboll (centro industrial) y de Sarna (sin niveles).
