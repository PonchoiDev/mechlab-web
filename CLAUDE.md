# MechLab MW5

Configurador web de 'Mechs para *MechWarrior 5: Mercenaries* (no *MW5: Clans*), publicado en https://mw-builder.com/mercs/. React 19 + TypeScript 7 + Vite 8, desplegado en Cloudflare Workers. La arquitectura está en `docs/arquitectura.md` y los requisitos en `docs/analisis.md`.

## Comandos

```sh
npm run dev      # http://localhost:5173/mercs/
npm test         # Vitest
npm run coverage # Vitest con informe de cobertura
npm run lint     # oxlint
npm run build    # tsc + build de producción

python3 tools/generar_items.py    # src/data/items.json
python3 tools/generar_mechs.py    # src/data/mechs.json (lee items.json: va después)
python3 tools/generar_traits.py   # src/data/traits.json
```

Antes de dar algo por terminado: `npm run lint`, `npm test` y `npm run build` sin errores.

## Convenciones

- **Idiomas:** la interfaz de la web está en inglés. Los comentarios, los scripts, los mensajes de commit y los pull requests están en español.
- **Sin guiones largos** (— ni --) en textos de la interfaz, avisos, commits ni documentación.
- **Comentarios:** explican el porqué, sobre todo las reglas del juego que no son obvias, como los que ya hay. No narran el código.
- **Lógica pura en `src/utils/`**, con sus tests. Los componentes solo pintan y llaman a la lógica.
- **Datos:** `src/data/*.json` no se editan a mano; se regeneran con los scripts de `tools/`. Si el juego no trae un dato, la corrección va en el script, con un comentario que diga de dónde sale.
- **Novedades:** cada cambio visible para el usuario lleva una entrada al principio de `src/data/changelog.ts`.

## Reglas del juego

- En Mercenaries las armas solo necesitan un anclaje compatible (tipo y tamaño); no ocupan ranuras. Las ranuras son del equipo y la munición.
- Fuente de verdad: el mechlab del juego. Si una cifra no cuadra, se pide una captura del juego y se convierte en un test (`src/utils/gameReference.test.ts`, `src/utils/upgrades.test.ts`) antes de cambiar el cálculo.
- Comportamientos intencionados, que no son errores: se puede pasar del tonelaje máximo; CDA-2A, CDA-2B y CGR-1A1 empiezan con sobrepeso; las variantes de campaña, tutorial, jefes y cinemáticas no aparecen; el Clan ER Large Laser es de tamaño mediano.
- Los IDs de las variantes no cambian aunque cambie el formato de los archivos del juego: los usan los enlaces y las builds guardadas.

## Flujo de trabajo

- El backlog está en GitHub Issues. Cada pull request que resuelve una issue la enlaza con `Closes #n`.
- Las funcionalidades nuevas siguen Spec Driven Development: especificación en `docs/specs/`, después los tests de sus criterios de aceptación y después el código, en commits separados.
- Una rama y un pull request por cambio, desde `main` actualizado. Nunca commits directos a `main`.
- Antes de subir más commits a una rama, comprobar que su pull request sigue abierto (`gh pr view <n> --json state`); si ya se fusionó, crear otra rama desde `main`.
- Los commits y pull requests describen el cambio por sí mismos, sin referencias a conversaciones.
- Los cambios de interfaz se comprueban en el navegador, no solo con los tests.
- CodeRabbit (`.coderabbit.yaml`) y Copilot revisan cada pull request. Sus comentarios se atienden o se responden explicando por qué no aplican antes de fusionar.
