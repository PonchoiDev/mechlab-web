# Especificación: buscar los 'Mechs Clan por su nombre Clan

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/mechs.test.ts`, `src/utils/yaml/mechList.test.ts` y `src/utils/yaml/savedBuilds.test.ts`) y por último el código, en commits separados.

## Contexto

MW5 llama a los OmniMechs Clan por su nombre de la Esfera Interior (Mad Cat, Thor, Puma...), y los datos guardan el nombre Clan (Timber Wolf, Summoner, Adder...) como nombre de Sarna (`sarnaName`). Son 23 chasis. Un jugador avisa de que el buscador de chasis no funciona bien con los nombres Clan:

- **MechLab de MW5:** el buscador comprueba si el texto entero está dentro del chasis, del nombre de Sarna, de la variante o del id, cada uno por separado. «Timber Wolf» encuentra los Mad Cat, pero «timber wolf prime» o «mad cat tbr-a» no encuentran nada.
- **MechLab de YAML:** el buscador no mira el nombre Clan: «Timber Wolf» no encuentra nada. El selector y Mis builds enseñan solo «Mad Cat», cuando MW5 enseña «Mad Cat (Timber Wolf)».
- **BATTLETECH:** no tiene 'Mechs Clan. No cambia.

## Requisitos funcionales

- **RF1.** En el MechLab de MW5 (selector de 'Mechs y lista de chasis), cada palabra de la búsqueda tiene que estar en el chasis, el nombre Clan, la variante o el id, sin distinguir mayúsculas, como ya hacen YAML y Mis builds.
- **RF2.** El buscador del selector de YAML busca también en el nombre Clan.
- **RF3.** El selector de YAML y sus builds guardadas nombran el chasis como MW5: «Mad Cat (Timber Wolf)», y «Atlas» si no hay nombre Clan. Las builds guardadas de YAML se encuentran también por el nombre Clan.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El TBR-PRIME de MW5 | se busca `timber wolf prime`, `mad cat tbr-prime` o `TIMBER` | coincide; con `timber atlas`, no |
| CA2 | El selector de YAML | se busca `timber wolf` | salen todas las variantes del Mad Cat y solo ellas |
| CA3 | El selector de YAML | se busca `adder prime` | sale el ADR-PRIME |
| CA4 | El TBR-PRIME y el AS7-D de YAML | se pide su nombre | «Mad Cat (Timber Wolf)» y «Atlas» |
| CA5 | Una build guardada de YAML del TBR-PRIME | se lista en Mis builds | su chasis es «Mad Cat (Timber Wolf)» y se encuentra buscando `timber wolf` |
