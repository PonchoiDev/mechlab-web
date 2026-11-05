# Especificación: condiciones de las misiones de alta recompensa

- **Issue:** [#68](https://github.com/PonchoiDev/mechlab-web/issues/68)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/quests.test.ts`) y por último el código, en commits separados.

## Contexto

El mapa ya muestra dónde se ofrece cada HRQ ([misiones-hrq.md](misiones-hrq.md)), pero no cuándo. El juego solo las ofrece a partir de un nivel de reputación y, las de los DLC, a partir de una fecha; algunas del DLC8 dejan de ofrecerse en otra. Sin eso, el mapa puede marcar una HRQ que todavía no se puede aceptar en la fecha elegida.

## Datos del juego

Cada HRQ tiene un arco de campaña (`MWCampaignArc`) en su carpeta, con eventos (`CampaignEventList`) cuyas condiciones (`TriggerConditions`) deciden cuándo se ofrece:

| Condición | Ejemplo | Significado |
|---|---|---|
| `ReputationLevel` mayor o igual | `ShowQuest`: 8 | Nivel de reputación mínimo |
| `Date` mayor o igual en el evento que la ofrece | `ShowQuest`: 3023-12-20 | Fecha desde la que se ofrece |
| `Date` mayor o igual en un evento `…OfferExpired` | `Pt.0_OfferExpired`: 3055-12-15 | Fecha en la que deja de ofrecerse |
| `Objectives` completado en el evento que la ofrece, de otra HRQ | `OfferQuest`: `M3_Prompt2` completado | HRQ que hay que completar antes |
| Lo mismo con `bInvertCondition` | `OfferQuest`: `6_1_Prompt` no completado | HRQ excluyente: si se completa una, la otra ya no se ofrece |

`extraer_mapa.py` guarda las condiciones de cada arco en `tools/datos-juego/starmap/condiciones_misiones.json` y `generar_mapa.py` las añade a cada cadena de `starmap.json`.

**Decisiones sobre los datos:**

- **Arcos que cuentan:** los de la carpeta de la cadena. Los arcos de avisos y transmisiones (`…Warnings`, `…Transmission`) recuerdan plazos, y los de inicio de la campaña del DLC3 (`_StartConditions`, `…QuickStart`) son de la campaña, no de la HRQ; ninguno decide cuándo se ofrece, así que no se usan.
- **Reputación:** el valor más alto de las condiciones de reputación de sus arcos.
- **Requisito previo:** si el evento que la ofrece pide completar un objetivo de otra cadena, el nombre de esa cadena (Corporate Interests se ofrece tras Destabilization).
- **Excluyentes:** si pide que un objetivo de otra cadena no esté completado, son HRQ de bandos opuestos y solo se puede hacer una (Defense Support - Davion e Invasion Support - Kurita).
- **Desde:** la fecha más temprana de las condiciones de fecha de los eventos que no son de caducidad. **Hasta:** la de los eventos `…Expired`.
- **Campaña y carrera:** si una cadena existe en los dos modos, cada modo conserva sus condiciones, que pueden ser distintas (The False Flag pide 10 en campaña y 12 en carrera).

## Requisitos funcionales

- **RF1.** Cada HRQ lleva sus condiciones: por cada modo (o una sola en las de los DLC), el nivel de reputación mínimo, la fecha desde la que se ofrece y, si la tiene, la fecha hasta la que se ofrece.
- **RF2.** La ficha de la HRQ muestra esas condiciones: `Reputation 8+`, `From 20 DEC 3023`, `Until 15 DEC 3055`, `After Destabilization`, `Not with Invasion Support - Kurita` y, si los modos difieren, cada uno con el suyo.
- **RF3.** Con la fecha del mapa, la ficha y la lista dicen si la HRQ todavía no se ofrece (`Not offered until 20 DEC 3023`) o si ya no se ofrece (`No longer offered`), y el icono de oferta del mapa se atenúa.

## Requisitos no funcionales

- **RNF1.** La comprobación de disponibilidad es pura y está en `src/utils/quests.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Bow and Arrow | se consultan sus condiciones | pide reputación 8 y se ofrece desde el 20 de diciembre de 3023 |
| CA2 | The False Flag | se consultan sus condiciones | pide reputación 10 en campaña y 12 en carrera, sin fecha |
| CA3 | Adam Steiner | se consulta su disponibilidad | se ofrece del 20 de junio al 15 de diciembre de 3055: no el 1 de enero de 3055, sí el 1 de julio y no el 1 de enero de 3056 |
| CA4 | Tributes for the Imperator | se consulta su disponibilidad en 3019 y en 3021 | en 3019 no se ofrece y en 3021 sí, con reputación 5 |
| CA5 | Pirate Hunt | se consulta su disponibilidad en 3015 | se ofrece, porque no tiene fecha |
| CA6 | Todas las HRQ | se consultan sus condiciones | todas tienen alguna condición salvo The Powder Keg, que el juego ofrece siempre, y Pirate Raiders, cuyo primer objetivo no está en el juego; y todas piden reputación salvo esas dos, Adam Steiner y Guerrero (DLC8), que solo tienen fechas, y Corporate Interests |
| CA7 | Corporate Interests | se consultan sus condiciones | en campaña y en carrera se ofrece después de Destabilization |
| CA8 | Defense Support - Davion | se consultan sus condiciones | es excluyente con Invasion Support - Kurita, y viceversa, sin requisito previo |

## Fuera de alcance

- El progreso de la campaña que abre cada región (las HRQ de facción en campaña también dependen de él).
- La relación con cada facción (*faction standing*).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA6):** `src/utils/quests.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador: condiciones en la ficha de Bow and Arrow, de The False Flag y de Adam Steiner; aviso de disponibilidad en la lista y el icono atenuado antes de la fecha.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados. La especificación y los tests se ampliaron dos veces con lo que mostraron los datos (requisitos previos y HRQ excluyentes).
- **Datos:** 140 arcos con condiciones. 59 de las 64 HRQ piden reputación; 20 tienen fecha de inicio (19 de los DLC y Errant Signal en carrera) y 2 del DLC8, de caducidad; 5 se ofrecen tras completar otra y 6 son excluyentes por parejas.
- **Tests:** los ocho criterios (CA1 a CA8) están en `src/utils/quests.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador con Bow and Arrow en 3020 (aún no se ofrece), The False Flag (reputación distinta en campaña y en carrera), Adam Steiner en 3056 (ya no se ofrece), Defense Support - Davion (excluyente) y Corporate Interests (después de Destabilization).
- **Decisiones durante el desarrollo:**
  - Adam Steiner y Guerrero, del DLC8, no piden reputación: solo un intervalo de fechas.
  - The Powder Keg se ofrece siempre y Pirate Raiders depende de un objetivo que no está en el juego, así que se quedan sin condiciones.
  - Una condición de objetivo invertida (`bInvertCondition`) significa «sin haber completado»: marca las HRQ excluyentes. Si una HRQ pide completar una parte de otra y no haber completado otra parte, cuenta como requisito previo.
