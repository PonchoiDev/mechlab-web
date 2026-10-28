# Diagramas UML

Diagramas en Mermaid (GitHub los dibuja) del uso, el dominio y los dos flujos que salen del navegador. Los nombres de clases y funciones son los del código.

## Casos de uso

Mermaid no tiene diagrama de casos de uso; este usa su notación habitual: actores a los lados y casos de uso en óvalos dentro del límite del sistema.

```mermaid
flowchart LR
  Jugador(["👤 Jugador"])
  Desarrollador(["👤 Desarrollador"])
  Sarna(["🌐 Sarna.net"])

  subgraph MechLab
    UC1([Buscar y filtrar chasis])
    UC2([Equipar armas y equipo])
    UC3([Repartir la armadura])
    UC4([Instalar mejoras de la cantina])
    UC5([Consultar estadísticas])
    UC6([Guardar, exportar e importar builds])
    UC7([Compartir por enlace])
    UC8([Generar la imagen de la build])
    UC9([Enviar feedback])
    UC10([Regenerar los datos del juego])
  end

  Jugador --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9
  UC8 -.->|incluye la imagen del ’Mech| Sarna
  UC2 -.->|actualiza| UC5
  UC4 -.->|actualiza| UC5
  Desarrollador --- UC10
  UC9 -.->|llega por correo| Desarrollador
```

- El **jugador** no necesita cuenta: todos sus casos de uso funcionan sin registro.
- El **desarrollador** regenera los datos con cada parche del juego y recibe el feedback.
- **Sarna.net** es un actor externo: aporta la imagen de cada ’Mech.

## Clases del dominio

Los tipos de `src/types/` y los que producen las funciones de `src/utils/`.

```mermaid
classDiagram
  direction LR

  class Mech {
    id: string
    name: string
    variant: string
    tonnageMax: number
    baseTonnage: number
    baseSpeed: number
    heatSinkType
    upgradeSlots: number
    stockBuild: string
  }
  class ComponentData {
    maxSlots: number
    specialSlots
    maxArmor: number
    structure: number
    hasRearArmor: boolean
  }
  class Hardpoint {
    type: HardpointType
    size: ItemSize
    weightClass
    defaultWeapon
  }
  class Item {
    id: string
    name: string
    type: string
    weaponType: WeaponType
    size: ItemSize
    tonnage: number
    slots: number
    tier: string
  }
  class ItemTierStats {
    damage: number
    heatPerShot: number
    cooldown: number
    maxRange: number
    speed: number
  }
  class EquippedItem {
    instanceId: string
    hardpointIndex: number
    equippedSlotType: string
  }
  class Upgrade {
    id: string
    name: string
    category: UpgradeCategory
    slots: number
  }
  class UpgradeEffect {
    stat: UpgradeStat
    value: number
    weaponTypes: WeaponType[]
  }
  class SharedBuild {
    loadout: EquippedItem[] por zona
    armor: delantera y trasera por zona
    upgrades: string[]
  }
  class SavedBuild {
    id: string
    name: string
    code: string
    savedAt: string
  }
  class BuildSummary {
    totalWeight: number
    firepower: number
    coolingRate: number
    topSpeed: number
    weapons: WeaponPerformance[]
  }

  Mech "1" *-- "8" ComponentData : components
  ComponentData "1" *-- "0..*" Hardpoint : hardpoints
  Item "1" *-- "0..6" ItemTierStats : tiers
  Item <|-- EquippedItem
  Upgrade "1" *-- "1..*" UpgradeEffect : effects
  SharedBuild "1" --> "1" Mech : mech
  SharedBuild "1" o-- "0..*" EquippedItem : loadout
  SharedBuild "1" ..> "0..*" Upgrade : upgrades
  SavedBuild ..> SharedBuild : code se decodifica en
  BuildSummary ..> SharedBuild : getBuildSummary
```

- Un **’Mech** tiene ocho componentes (cabeza, torso central, torsos, brazos y piernas), y cada uno sus **anclajes** con tipo y tamaño.
- Un **objeto** del catálogo se convierte en **objeto equipado** al montarlo: sabe en qué anclaje o ranura está.
- Una **build** es un ’Mech con su equipo por componente, su armadura y sus mejoras. Se guarda o se comparte como un código (`SavedBuild.code`, el parámetro `?b=` del enlace).
- El **resumen** (`BuildSummary`) no se guarda: se calcula siempre a partir de la build con `getBuildSummary`.

## Secuencia: compartir una build por enlace

```mermaid
sequenceDiagram
  actor A as Jugador A
  participant App as App (React)
  participant Code as buildCode.ts
  participant Clip as clipboard.ts
  actor B as Jugador B
  participant Rules as equipment.ts · upgrades.ts

  A->>App: Share › Copy build link
  App->>Code: encodeBuild(mech, loadout, armor, catálogo, mejoras)
  Code-->>App: código base64url
  App->>Code: getBuildUrl(código)
  App->>Clip: copyText(url)
  Clip-->>A: «Build link copied»
  A-->>B: comparte el enlace (Reddit, Discord…)
  B->>App: abre mw-builder.com/mercs/?b=…
  App->>Code: readBuildFromLocation(mechs, catálogo)
  Code->>Code: decodeBuild: versión y ’Mech válidos
  loop cada arma, equipo y mejora
    Code->>Rules: weaponFitsHardpoint · getAvailableSlotType · sanitizeUpgrades
    Rules-->>Code: cabe o se descarta
  end
  Code-->>App: SharedBuild (sin piezas inválidas)
  App->>App: limpia ?b= de la dirección y carga la build
  App-->>B: la misma build, con sus estadísticas
```

Lo que ya no cabe (por ejemplo, tras actualizar los datos del juego) se descarta en lugar de fallar, así que los enlaces antiguos siguen abriéndose.

## Secuencia: enviar feedback

```mermaid
sequenceDiagram
  actor J as Jugador
  participant Form as FeedbackDialog
  participant W as Worker /mercs/api/feedback
  participant F as feedback.ts
  participant E as Email Routing
  actor D as Desarrollador

  J->>Form: escribe el mensaje y pulsa Send
  Form->>W: POST JSON (categoría, mensaje, contacto, enlace, campo trampa)
  W->>F: parseFeedback(cuerpo)
  alt campo trampa relleno o mensaje no válido
    F-->>W: null
    W-->>Form: 400 Invalid message
  else válido
    F-->>W: FeedbackInput saneado
    W->>F: buildFeedbackEmail(feedback, FEEDBACK_TO)
    F-->>W: correo sin saltos de línea en las cabeceras
    W->>E: send(EmailMessage)
    E-->>D: correo a la dirección secreta FEEDBACK_TO
    W-->>Form: 200 ok
    Form-->>J: «Thanks! Your message was sent»
  end
```

La dirección del desarrollador es un secreto del Worker: no aparece en la web ni en el código. Solo se adjuntan enlaces de la propia web, y ningún campo puede añadir cabeceras al correo.
