import glob
import json
import os
import re
import struct
import sys

from generar_mechs import ARCHIVOS_NO_JUGABLES, obtener_parte_cuerpo, obtener_tipo_arma, obtener_variante

# Genera los datos del MechLab con las reglas de YAML (src/data/yaml/) a partir del volcado de los mods
# (tools/datos-juego/yaml/, de extraer_yaml.py), de los MDA exportados del juego (tools/datos-juego/mda/)
# y del catálogo del MechLab de MW5 (src/data/items.json y mechs.json), que pone las armas, la
# munición y el equipo del juego base que YAML no sustituye.
#
#   python3 tools/generar_yaml.py
#
# Las reglas de peso y de ranuras están en docs/specs/mechlab-yaml.md, contrastadas con capturas
# del mechlab del juego.
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_YAML = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "yaml")
RUTA_MDA_JUEGO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mda")
RUTA_ITEMS_JUEGO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "items")
RUTA_DATOS = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data")
RUTA_DESTINO = os.path.join(RUTA_DATOS, "yaml")

# Mods por orden de carga: con el mismo asset o la misma propiedad, gana el último.
MODS = ["yet-another-weapon-clan", "yet-another-weapon", "yet-another-mechlab", "yet-another-equipment-collection"]

ZONAS = {
    "EMechParts::Head": "head", "EMechParts::CenterTorso": "centerTorso",
    "EMechParts::LeftTorso": "leftTorso", "EMechParts::RightTorso": "rightTorso",
    "EMechParts::LeftArm": "leftArm", "EMechParts::RightArm": "rightArm",
    "EMechParts::LeftLeg": "leftLeg", "EMechParts::RightLeg": "rightLeg",
}
CAMPOS_ZONA = {"Head": "head", "CenterTorso": "centerTorso", "LeftTorso": "leftTorso", "RightTorso": "rightTorso",
               "LeftArm": "leftArm", "RightArm": "rightArm", "LeftLeg": "leftLeg", "RightLeg": "rightLeg"}
TRASERAS = {"CenterTorsoRear": "centerTorso", "LeftTorsoRear": "leftTorso", "RightTorsoRear": "rightTorso"}
RANURA_GENERAL = "General_SlotType"

# Ranuras que YAML añade al convertir un 'Mech del juego aunque su MDA no las traiga: el mechlab del
# NSR-9J enseña el sistema defensivo y el soporte vital en la cabeza y el tipo de motor en el torso
# central, y su MDA no los lista.
RANURAS_INYECTADAS = {"head": ["Defensive_SlotType", "LifeSupport"], "centerTorso": ["EngineTypeSlot"]}

# Piezas internas de serie cuando el loadout no trae otra en su ranura (las «Standard» del mechlab).
INTERNAS_DE_SERIE = {
    "Defensive_SlotType": None, "LifeSupport": None, "Sensors": None, "Targeting": None, "cockpit": None,
    "Gyro": None,
}
# Armadura y estructura del MDA del juego y la pieza de YAML que las sustituye al convertir.
ARMADURAS = {"StandardArmor": "ARMOR_STANDARD_FIXED", "FerroFibrousArmor": "FERRO", "StealthArmor": "ARMOR_STEALTH"}
ESTRUCTURAS = {"StandardStructure": "STRUCTURE_STANDARD_FIXED", "EndoSteelStructure": "ENDO"}
KITS_DE_REFRIGERACION = {"single": "SHS_KIT_FIXED", "double": "Cooling_diss100", "clanDouble": "CLAN_DHS_KIT_FIXED"}
# Con motor estándar, los loadouts de YAML dejan vacía la ranura del tipo de motor: ENGINE_FIXED resta un 5 %
# al calor de las armas y el mechlab del juego no lo aplica al GHR-5J de serie.
TIPO_DE_MOTOR = {False: None, True: "ENGINE_XL"}
# Piezas de los loadouts que no son equipo del jugador: el contrapeso con el que YAML compensa el peso
# de los 'Mechs del juego al convertirlos (−1000 t) y los rellenos, que el mechlab recoloca solo.
PIEZAS_TECNICAS = re.compile(r"COUNTERWEIGHT|UAVCOMPONENT|_filler$|^DYNAMIC_FILLER|^XLfiller$", re.IGNORECASE)
# Los ataques de las manos y los antebrazos (MechHandAssault_MeleeWeaponDataAsset...) van en sus actuadores.
ACTUADOR_DE_CUERPO_A_CUERPO = re.compile(r"^Mech(Hand|LowerArm)")
NIVEL_DE_ARMA = re.compile(r"_Lvl(\d+)$", re.IGNORECASE)
# Motores del juego en los loadouts: YAML los separa en núcleo y tipo.
MOTOR_DEL_JUEGO = re.compile(r"^(XL|STD|Std|Light|LFE|XXL)(\d+)$")

REGEX_PROPIEDAD = {
    "slotType": re.compile(r'WeaponSlotTypeAssetId=\(Id="MWSlotTypeDataAsset:([^"]+)"'),
    "weaponType": re.compile(r'WeaponType=\(TagName="([^"]+)"'),
}


def leer(ruta):
    with open(ruta, encoding="utf-8") as archivo:
        return json.load(archivo)


def cargar_categoria(categoria):
    """Los assets de una categoría de todos los mods, por ruta montada, con las sustituciones aplicadas."""
    assets = {}
    for mod in MODS:
        ruta = os.path.join(RUTA_YAML, mod, categoria + ".json")
        if os.path.exists(ruta):
            for clave, valor in leer(ruta).items():
                assets[clave] = {**valor, "mod": mod}
    return assets


def por_nombre(assets):
    return {ruta.rsplit("/", 1)[1]: valor for ruta, valor in assets.items()}


def cargar_recursos(nombre):
    """Un JSON de Resources de todos los mods, fusionado por orden de carga."""
    datos = {}
    for mod in MODS:
        for ruta in sorted(glob.glob(os.path.join(RUTA_YAML, mod, "resources", "*" + nombre))):
            datos.update(leer(ruta))
    return datos


def a_srgb(componente):
    """El juego guarda los colores en espacio lineal (LinearColor) y los enseña en sRGB."""
    componente = max(0.0, min(1.0, componente))
    return 12.92 * componente if componente <= 0.0031308 else 1.055 * componente ** (1 / 2.4) - 0.055


def color_hex(lineal):
    """«#rrggbb» de un color lineal: una lista [R, G, B, A] o un texto «(R=0.31,G=0.35,B=0.42,A=1)»."""
    if isinstance(lineal, str):
        valores = dict(re.findall(r"([RGBA])=([0-9.]+)", lineal))
        lineal = [float(valores.get(canal, 0)) for canal in "RGB"]
    if not lineal:
        return None
    return "#" + "".join(f"{round(a_srgb(canal) * 255):02x}" for canal in lineal[:3])


# El color de cada tipo de anclaje en el mechlab: con los ajustes por defecto («MW5 default colors»), el de
# los tipos de ranura de sus armas.
RANURA_DEL_ANCLAJE = {
    "ballistic": "GaussRifle_SlotType", "energy": "ERPPC_SlotType", "missile": "LRM20_SlotType", "ams": "AMS_SlotType",
    "artillery": "ArtilleryMissile_SlotType", "melee": "Assault_Melee_Weapon_SlotType", "omni": "OmniSlotType_79",
}


def ajuste_de_yaml(nombre):
    """El valor por defecto de un ajuste de YAML (Resources/gui_config.ini)."""
    configuracion = leer(os.path.join(RUTA_YAML, "yet-another-mechlab", "resources", "gui_config.ini"))
    pendientes = [configuracion]
    while pendientes:
        nodo = pendientes.pop()
        if isinstance(nodo, dict):
            if nodo.get("Var") == nombre:
                return nodo.get("Default")
            pendientes.extend(nodo.values())
        elif isinstance(nodo, list):
            pendientes.extend(nodo)
    return None


def construir_colores():
    """Los colores del mechlab de YAML: el de las ranuras generales y su equipo, la opacidad del relleno de
    las piezas, el de cada tipo de ranura (armadura roja, estructura azul, giroscopio verde...) y el de cada
    tipo de anclaje."""
    ranuras = por_nombre(leer(os.path.join(RUTA_YAML, "juego", "ranuras.json")))
    ranuras.update(por_nombre(cargar_categoria("ranuras")))
    por_tipo = {}
    for nombre, valor in sorted(ranuras.items()):
        datos = valor["propiedades"]
        color = color_hex(datos.get("SlotColour"))
        if color:
            por_tipo[nombre] = {"name": texto(datos.get("SlotName")) or nombre, "color": color}
    return {
        "general": color_hex(ajuste_de_yaml("generalSlotColor")),
        "tintOpacity": ajuste_de_yaml("yamlEquipmentInnterTintOpacity"),
        "slots": por_tipo,
        "hardpoints": {tipo: por_tipo[ranura]["color"] for tipo, ranura in RANURA_DEL_ANCLAJE.items() if ranura in por_tipo},
    }


def color_propio(nombre, categoria, propiedades):
    """El color que da Equipment_Properties a una pieza, por su nombre o por su etiqueta (la más concreta)."""
    if "color" in propiedades.get(nombre, {}):
        return color_hex(propiedades[nombre]["color"])
    etiquetas = [clave for clave in propiedades if categoria and "color" in propiedades[clave]
                 and (categoria == clave or categoria.startswith(clave + "."))]
    return color_hex(propiedades[max(etiquetas, key=len)]["color"]) if etiquetas else None


def tamanos_de_ranuras(reglas):
    """Tamaño de cada tipo de ranura: el del juego, el de los mods y las reglas que aplica YAML al arrancar."""
    ranuras = por_nombre(leer(os.path.join(RUTA_YAML, "juego", "ranuras.json")))
    ranuras.update(por_nombre(cargar_categoria("ranuras")))
    tamanos = {nombre: valor["propiedades"].get("SlotSize", 1) for nombre, valor in ranuras.items()}
    for regla in reglas["tamanosDeTiposDeRanura"]:
        for tipo in regla["tiposDeRanura"]:
            tamanos[tipo] = regla["ranuras"]
    return tamanos


def tipo_de_anclaje(etiqueta):
    """El anclaje que usa un arma, por su etiqueta (Weapon.Ballistic.AutoCannon... → ballistic)."""
    partes = (etiqueta or "").split(".")
    if len(partes) < 2:
        return None
    return {"Ballistic": "ballistic", "Energy": "energy", "Missile": "missile", "ArtemisMissile": "missile",
            "AMS": "ams", "Melee": "melee", "Artillery": "artillery"}.get(partes[1])


def ranura_de_arma(nombre, etiqueta, ranura, reglas):
    """El tipo de ranura de un arma tras las reglas de YAML, que asigna uno propio a las de los DLC."""
    for regla in reglas["ranurasDeArmas"]:
        if nombre in regla["armas"]:
            return regla["tipoDeRanura"]
        for condicion in regla["etiquetas"]:
            if etiqueta and (etiqueta == condicion["etiqueta"] or (not condicion["exacta"] and etiqueta.startswith(condicion["etiqueta"] + "."))):
                return regla["tipoDeRanura"]
    return ranura


# Textos de las tablas de los mods (YAWC_TextWeapons...), por ruta de la tabla: los nombres de las armas
# de YAW Clan y de parte del equipo no están en el asset, sino en una de ellas.
TEXTOS = {}


def cargar_textos():
    for ruta, valor in cargar_categoria("textos").items():
        TEXTOS[ruta] = valor["textos"]


def texto(valor):
    """Un texto del asset: tal cual o, si es una referencia a una tabla de textos, el de la tabla."""
    if isinstance(valor, dict):
        tabla = (valor.get("tabla") or "").split(".")[0]
        return TEXTOS.get(tabla, {}).get(valor.get("clave")) or valor.get("clave")
    return valor


def municiones_del_arma(propia, etiqueta, propiedades_de_armas):
    """La munición que usa un arma: la suya y la que le añade YAW por su etiqueta (el MML usa la de LRM y
    la de SRM, con «ammoTypes» en Weapon_Properties.json)."""
    tipos = [propia] if propia else []
    for clave, valores in propiedades_de_armas.items():
        if etiqueta and (etiqueta == clave or etiqueta.startswith(clave + ".")):
            tipos.extend(tipo for tipo in valores.get("ammoTypes", []) if tipo not in tipos)
    return tipos


# Estadísticas de combate (docs/specs/estadisticas-yaml.md). Con YAML, las cifras del mechlab las
# calcula el mod (MechAlphaStats y YAWFunctionsYAML) a partir de los datos de cada asset de arma, con los
# quirks de su nivel ya aplicados; la web aplica después las bonificaciones de los quirks y del equipo.
FAMILIAS_DE_ARMA = {
    "MWTraceWeaponDataAsset": "trace", "MWProjectileWeaponDataAsset": "projectile",
    "MWMissileWeaponDataAsset": "missile", "MWAMSWeaponDataAsset": "ams", "MWMeleeWeaponDataAsset": "melee",
}
# Rayos cuyo alcance máximo es el óptimo (YAWTrace): el resto llega al doble.
RAYOS_SIN_ALCANCE_MAXIMO = (
    "Weapon.Energy.Flamer", "Weapon.Energy.TAG", "Weapon.Energy.TSEMP", "Weapon.Energy.Laser.Pulse.Large.Variable",
    "Weapon.Energy.Laser.Pulse.Medium.Variable", "Weapon.Energy.Laser.Pulse.Small.Variable",
)
# Gauss que YAWBallistic trata aparte: su alcance óptimo ya es el triple y llega hasta ahí.
GAUSS_MEJORADOS = (
    "Weapon.Ballistic.GaussRifle.Gauss.Improved", "Weapon.Ballistic.GaussRifle.HeavyGauss.Improved",
    "Weapon.Ballistic.GaussRifle.HeavyGauss.Railgun", "Weapon.Ballistic.GaussRifle.Railgun",
    *(f"Weapon.Ballistic.GaussRifle.Gauss.Hyper.Clan.{calibre}.Improved" for calibre in range(5, 85, 5)),
)
# Bonificaciones del equipo que cambian las cifras del panel del juego.
BONIFICACIONES_DE_EQUIPO = (
    "turnSpeedMulti", "torsoTwistRateMulti", "torsoTwistRateYawMulti", "torsoTwistAngleMulti", "torsoTwistAngleYawMulti",
    "armTwistAngleMulti", "armTwistAngleYawMulti", "sensorRangeBonus", "sensorRangeMulti", "sensorRangeBonusLance",
    "sensorRangeMultiLance",
    "armorComponentFront", "armorComponentRear", "structureComponent", "jumpJetFuelBurnTimeMulti", "jumpJetZAccelMulti",
)
QUIRK_DE_NIVEL = re.compile(r"\.(\w+)_Quirk_C$")


def de_la_etiqueta(etiqueta, padres):
    """Las etiquetas del juego son jerárquicas: Weapon.Energy.Flamer.X es de Weapon.Energy.Flamer."""
    return any(etiqueta == padre or etiqueta.startswith(padre + ".") for padre in padres)


def regla_de_alcance(familia, nombre, etiqueta):
    """Cómo sale el alcance máximo del óptimo (YAWTrace y YAWBallistic), o "max" si es el del asset."""
    if familia == "trace":
        return "optimal" if de_la_etiqueta(etiqueta, RAYOS_SIN_ALCANCE_MAXIMO) else "double"
    if familia == "projectile":
        # YAWBallistic mira el nombre del asset, sin distinguir mayúsculas.
        if "ppc" in nombre.lower():
            return "double"
        if "mrm" in nombre.lower():
            return "optimal"
        if de_la_etiqueta(etiqueta, ("Weapon.Ballistic.GaussRifle",)):
            return "gaussImproved" if de_la_etiqueta(etiqueta, GAUSS_MEJORADOS) else "gauss"
        return "double"
    return "max"


def f32(valor):
    """El juego calcula en float32: cada operación se redondea a 32 bits."""
    return struct.unpack("<f", struct.pack("<f", valor))[0]


# Los quirks de nivel (/Game/Quirks/*_Quirk, blueprints del juego) que cambian cifras del panel: cada uno modifica un
# campo de la copia de StatsData, sumando su valor o multiplicando por (1 + valor). El juego los aplica en el
# orden de la lista del QuirkSet, cada uno sobre el resultado del anterior (MWWeaponDataAsset, 0x141181680 en el
# ejecutable), y solo a las familias para las que el blueprint del quirk tiene función (QuirkTraceWeapon...).
QUIRKS_DE_NIVEL = {
    "Damage": ("damage", "suma", ("trace", "projectile", "missile", "melee")),
    "DamagePercentage": ("damage", "producto", ("trace", "projectile", "missile", "melee")),
    "HeatGeneratedPercentage": ("heat", "producto", ("trace", "projectile", "missile")),
    "Cooldown": ("cooldown", "suma", ("trace", "projectile", "missile", "melee")),
    "CooldownPercentage": ("cooldown", "producto", ("trace", "projectile", "missile", "melee")),
    "RangePercentage": ("ranges", "producto", ("trace", "projectile", "missile")),
    "RangeAndSpeedPercentage": ("ranges", "producto", ("trace", "projectile", "missile")),
    "DurationPercentage": ("duration", "producto", ("trace",)),
}


def cifras_de_nivel(familia, propiedades):
    """Las cifras de un nivel de un arma como las enseña el juego (GetDisplayedDamage y GetDisplayedHeat de cada
    clase, desensambladas del ejecutable), sobre StatsData con los quirks del QuirkSet aplicados en orden."""
    datos = propiedades.get("StatsData") or {}
    if familia == "ams":
        alcances = propiedades.get("Ranges") or {}
        return {"damage": 0, "heat": 0, "cooldown": f32(propiedades.get("Cooldown") or 0),
                "optimalRange": f32((alcances.get("OptimalRange") or 0) / 100),
                "maxRange": f32((alcances.get("MaxRange") or alcances.get("OptimalRange") or 0) / 100),
                "amsRate": f32(propiedades.get("MissileDestructionRate") or 0)}
    misiles = datos.get("MissileStats") or {}
    proyectil = misiles.get("Projectile") or datos.get("Projectile") or {}
    rayo = datos.get("Trace") or {}
    golpe = datos.get("Melee") or {}
    alcances = (datos.get("Ranges") if familia in ("trace", "melee") else datos.get("Range")) or {}
    campos = {
        "cooldown": f32(datos.get("Cooldown") or 0),
        "optimalRange": f32(alcances.get("OptimalRange") or 0),
        "maxRange": f32(alcances.get("MaxRange") or 0),
    }
    if familia == "trace":
        campos.update(damage=f32(rayo.get("DamageOverDuration", 0)), heat=f32(rayo.get("HeatGeneratedOverDuration", 0)),
                      duration=f32(rayo.get("Duration", 0)))
    elif familia == "melee":
        campos.update(damage=f32(golpe.get("Damage", 0)), heat=0)
    else:
        campos.update(damage=f32(proyectil.get("Damage", 0)), heat=f32(proyectil.get("HeatGenerated", 0)))

    for quirk in (propiedades.get("QuirkSet") or {}).get("QuirkList", []):
        coincidencia = QUIRK_DE_NIVEL.search(quirk.get("Quirk") or "")
        regla = QUIRKS_DE_NIVEL.get(coincidencia.group(1)) if coincidencia else None
        if not regla or familia not in regla[2]:
            continue
        campo, operacion, _ = regla
        valor = f32(quirk.get("Value", 0.0))
        for nombre in (("optimalRange", "maxRange") if campo == "ranges" else (campo,)):
            campos[nombre] = f32(campos[nombre] + valor) if operacion == "suma" else f32(f32(valor + 1) * campos[nombre])

    cifras = {"cooldown": campos["cooldown"], "optimalRange": f32(campos["optimalRange"] / 100),
              "maxRange": f32((campos["maxRange"] or campos["optimalRange"]) / 100)}
    if familia == "trace":
        cifras.update(damage=campos["damage"], heat=campos["heat"], duration=campos["duration"])
    elif familia == "melee":
        # La duración del golpe es la del asset sin quirks (GetBaseWeaponData en GetAlphaStrikeStats).
        cifras.update(damage=campos["damage"], heat=0, duration=f32(golpe.get("Duration", 0)))
    elif familia == "projectile":
        # (Damage + CachedExplosionDamageDisplay) × disparos de la ráfaga × proyectiles; el calor, × disparos.
        disparos = proyectil.get("NumberOfTimesToFire") or 0
        explosion = f32(proyectil.get("CachedExplosionDamageDisplay", 0))
        por_disparo = f32(f32(disparos * explosion) + f32(campos["damage"] * disparos)) if disparos > 0 else f32(explosion + campos["damage"])
        cifras.update(damage=f32(por_disparo * (proyectil.get("NumberOfProjectiles") or 0)),
                      heat=f32(campos["heat"] * disparos) if disparos > 0 else campos["heat"])
    else:
        # Misiles × disparos (si hay más de uno) × Damage, o × CachedExplosionDamageDisplay si no hacen daño
        # directo (Arrow IV); el calor, misiles × HeatGenerated × disparos.
        numero = misiles.get("NumberOfMissiles") or 0
        disparos = proyectil.get("NumberOfTimesToFire") or 0
        total = numero * disparos if disparos > 1 else numero
        dano = f32(total * campos["damage"])
        calor = f32(numero * campos["heat"])
        cifras.update(damage=dano if dano > 0 else f32(total * f32(proyectil.get("CachedExplosionDamageDisplay", 0))),
                      heat=f32(calor * disparos) if disparos > 1 else calor)
    # Con nueve decimales, los float32 del juego quedan tal cual: deciden los empates del panel (siete Medium
    # Laser de nivel 3 dan 14,1749999 de calor alfa, 14.17; el AMS de nivel 3 intercepta 4,025000095, 4.03).
    return {campo: round(valor, 9) for campo, valor in cifras.items()}


def combate_del_arma(nombre, niveles):
    """Las estadísticas de combate de un arma a partir de los assets de sus niveles ({nivel: asset})."""
    base = niveles.get("1") or niveles[min(niveles)]
    familia = FAMILIAS_DE_ARMA.get(base["clase"])
    if not familia:
        return None
    propiedades = base["propiedades"]
    etiqueta = propiedades.get("WeaponType") or ""
    datos = propiedades.get("StatsData") or {}
    combate = {
        "family": familia, "weaponType": etiqueta, "techBase": propiedades.get("TechBase") or "",
        "rangeRule": regla_de_alcance(familia, nombre, etiqueta),
        "tiers": {nivel: cifras_de_nivel(familia, asset["propiedades"]) for nivel, asset in sorted(niveles.items())},
    }
    # Lo que dura la salva y se suma al ciclo de disparo (GetAlphaStrikeStats).
    misiles = datos.get("MissileStats") or {}
    proyectil = datos.get("Projectile") or {}
    salva = (misiles.get("NumberOfMissiles") or 0) * (misiles.get("MissileInterval") or 0) if familia == "missile" \
        else (proyectil.get("NumberOfTimesToFire") or 0) * (proyectil.get("DelayBetweenFiring") or 0)
    if salva:
        combate["volleyTime"] = round(salva, 4)
    return combate


def niveles_de_armas():
    """Los assets de arma del juego y de los mods (que los sustituyen por ruta), por nombre sin nivel y nivel."""
    assets = leer(os.path.join(RUTA_YAML, "juego", "armas.json"))
    assets.update(cargar_categoria("armas"))
    armas = {}
    for ruta, valor in assets.items():
        nombre = ruta.rsplit("/", 1)[1]
        nivel = NIVEL_DE_ARMA.search(nombre)
        armas.setdefault(NIVEL_DE_ARMA.sub("", nombre), {})[nivel.group(1) if nivel else "1"] = valor
    return armas


# RichCurveKey: modo de interpolación, de tangente y de peso de tangente, tiempo y valor. Las curvas de
# aceleración de los retrorreactores son lineales.
INTERPOLACION_LINEAL = 0


def datos_de_retrorreactores():
    """Velocidad inicial (cm/s), tiempo de encendido (s) y curva de aceleración vertical (cm/s² por número de
    retrorreactores) de cada retrorreactor del juego y de los mods: con ellas estima el juego la altura de salto."""
    curvas = leer(os.path.join(RUTA_YAML, "juego", "curvas.json"))
    curvas.update(cargar_categoria("curvas"))
    equipo = leer(os.path.join(RUTA_YAML, "juego", "equipo.json"))
    equipo.update(cargar_categoria("equipo"))
    retrorreactores = {}
    for ruta, valor in equipo.items():
        if valor["clase"] != "MWJumpJetDataAsset":
            continue
        datos = valor["propiedades"]
        curva = curvas.get((datos.get("AccelZCurve") or "").split(".")[0], {}).get("propiedades", {})
        claves = (curva.get("FloatCurve") or {}).get("Keys", [])
        if any(clave[0] != INTERPOLACION_LINEAL for clave in claves):
            raise ValueError(f"Curva de aceleración no lineal en {ruta}")
        retrorreactores[ruta.rsplit("/", 1)[1]] = {
            "initialVelocityZ": datos.get("InitialVelocityZ", 0), "burnTime": round(datos.get("BurnTime", 0), 6),
            "accelZ": [[clave[3], clave[4]] for clave in claves],
        }
    return retrorreactores


# Lo que el panel y el peso leen de las propiedades de YAML (*_Properties.json), además de las de armas,
# movimiento y sensores.
PROPIEDADES_DE_OBJETO = BONIFICACIONES_DE_EQUIPO + (
    "armorComponentFrontMulti", "armorComponentRearMulti", "structureComponentMulti", "componentArmorWeightMulti",
    "relativeWeight", "roundWeightType", "roundWeightUp", "engineRelativeWeight", "structureWeightMulti", "structureMulti",
    "armorWeightMulti", "armorPerTon", "armorMulti", "engineHeatsinkEfficiency", "engineHeatsinkCapacity", "heatEfficiency",
    "fixed", "coolingMulti", "coolingMultiScope", "heatCapacityBonus", "bundledHeatsinks", "internalHeatsinkBonus",
    "topSpeedMulti", "engineHealthType",
)
CAMPOS_DE_TEXTO = ("roundWeightType", "coolingMultiScope", "engineHealthType")
REGEX_EXPORTACION = {
    "clase": re.compile(r"^Begin Object Class=/Script/\w+\.(\w+)"),
    "equipmentType": re.compile(r'EquipmentType=\(TagName="([^"]+)"'),
    "ammoType": re.compile(r'AmmoType=\(TagName="([^"]+)"'),
    "techLevel": re.compile(r"\bTechLevel=(-?\d+)"),
}


def propiedades_combinadas(globales, nombre, etiquetas, sin_nivel=None):
    """Las propiedades de un objeto como FindEquipmentProperties de YAML: las de cada antecesor de sus etiquetas
    (AmmoType y EquipmentType en la munición, EquipmentType en el equipo, WeaponType en las armas), con la más
    concreta por encima; encima, las de su nombre; y debajo, en las armas, las de su id sin nivel. Object_Merge
    deja ganar al segundo objeto (desensamblado del ejecutable)."""
    combinadas = {}
    for etiqueta in etiquetas:
        partes = etiqueta.split(".") if etiqueta else []
        for fin in range(len(partes), 0, -1):
            combinadas = {**globales.get(".".join(partes[:fin]), {}), **combinadas}
    combinadas = {**combinadas, **globales.get(nombre, {})}
    if sin_nivel and sin_nivel != nombre:
        combinadas = {**globales.get(sin_nivel, {}), **combinadas}
    return combinadas


def como_numero(valor):
    """Algunas propiedades vienen como texto («0.05», «true»); YAML las convierte al leerlas."""
    if isinstance(valor, str):
        if valor.lower() in ("true", "false"):
            return valor.lower() == "true"
        try:
            return float(valor)
        except ValueError:
            return valor
    return valor


def aplicar_propiedades(objeto, combinadas, equipo):
    """Pasa al objeto lo que leen el panel y el peso. Al arrancar, YAML (UpdateEquipmentNames) sobrescribe además
    el nombre, las ranuras, el peso (equipmentTons) y la capacidad de munición (ammoCapacity) del equipo."""
    for campo in PROPIEDADES_DE_OBJETO:
        if campo in combinadas:
            objeto[campo] = combinadas[campo] if campo in CAMPOS_DE_TEXTO else como_numero(combinadas[campo])
    armas = combinadas.get("weapons") or {}
    if armas.get("groups"):
        objeto["weapons"] = {"scope": armas.get("scope", "mech"), "groups": armas["groups"]}
    if "fillerSlots" in combinadas:
        # Las ranuras fijas van por ubicación con los nombres del juego (LeftTorso); se pasan a los de la web.
        objeto["fillerSlots"] = {CAMPOS_ZONA.get(clave, clave): valor for clave, valor in combinadas["fillerSlots"].items()}
    if equipo:
        if combinadas.get("name"):
            objeto["name"] = combinadas["name"]
        if "slots" in combinadas:
            objeto["slots"] = int(como_numero(combinadas["slots"]))
        if "equipmentTons" in combinadas:
            objeto["tons"] = como_numero(combinadas["equipmentTons"])
        if "ammoCapacity" in combinadas and objeto.get("kind") == "ammo":
            objeto["capacity"] = como_numero(combinadas["ammoCapacity"])


def leer_exportacion(ruta):
    """Las exportaciones del juego (.copy) vienen en UTF-8 o, algunas, en UTF-16 con BOM."""
    with open(ruta, "rb") as archivo:
        crudo = archivo.read()
    return crudo.decode("utf-16") if crudo.startswith((b"\xff\xfe", b"\xfe\xff")) else crudo.decode("utf-8")


def datos_de_equipo(objeto, etiqueta, nivel_tecnico, clase):
    """La etiqueta (EquipmentType), el TechLevel y si es un disipador (MWHeatSinkDataAsset) del equipo: el peso, la
    refrigeración y la velocidad de YAML los usan cuando no hay propiedad (TechLevel / 100) y para reconocer cada
    pieza (kit de refrigeración, armadura, estructura, núcleo y tipo de motor, giroscopio)."""
    if etiqueta:
        objeto["category"] = etiqueta
    if nivel_tecnico is not None:
        objeto["techLevel"] = int(nivel_tecnico)
    if clase == "MWHeatSinkDataAsset":
        objeto["heatSinkAsset"] = True


def construir_objetos(catalogo_juego, reglas, tamanos):
    objetos = {}
    propiedades_de_armas = cargar_recursos("Weapon_Properties.json")
    propiedades = cargar_recursos("Equipment_Properties.json")
    # LoadEquipmentProperties de YAML junta todos los *_Properties.json (equipo y armas) por clave.
    globales = cargar_recursos("_Properties.json")
    # Por objeto: sus etiquetas, su id sin nivel y si es equipo (para la pasada final de propiedades).
    origen = {}
    armas_por_nivel = niveles_de_armas()
    retrorreactores = datos_de_retrorreactores()
    minusculas = {nombre.lower(): nombre for nombre in armas_por_nivel}
    # Armas y equipo del juego base: sus cifras están en el catálogo de MW5; el tipo de ranura de las
    # armas, en sus exportaciones.
    for id_objeto, objeto in catalogo_juego.items():
        nuevo = {"name": objeto["name"], "kind": objeto["type"], "tons": objeto.get("tonnage") or 0}
        ruta = os.path.join(RUTA_ITEMS_JUEGO, id_objeto + ".copy")
        exportado = leer_exportacion(ruta) if os.path.exists(ruta) else ""
        exportacion = {campo: (regex.search(exportado) or [None, None])[1] for campo, regex in REGEX_EXPORTACION.items()}
        if objeto["type"] == "weapon":
            ranura = (REGEX_PROPIEDAD["slotType"].search(exportado) or [None, None])[1]
            etiqueta = (REGEX_PROPIEDAD["weaponType"].search(exportado) or [None, None])[1]
            ranura = ranura_de_arma(id_objeto, etiqueta, ranura, reglas)
            nuevo.update({"hardpoint": objeto.get("weaponType"), "slotType": ranura, "slots": tamanos.get(ranura, 1),
                          "ammoTypes": municiones_del_arma(objeto.get("ammoType"), etiqueta, propiedades_de_armas)})
            niveles = armas_por_nivel.get(id_objeto) or armas_por_nivel.get(minusculas.get(id_objeto.lower(), ""))
            combate = niveles and combate_del_arma(id_objeto, niveles)
            if combate:
                nuevo["combat"] = combate
            origen[id_objeto] = ([etiqueta], NIVEL_DE_ARMA.sub("", id_objeto), False)
        else:
            nuevo.update({"slots": objeto.get("slots") or 1, "slotTypes": objeto.get("specialSlotTypes") or [RANURA_GENERAL]})
            for campo in ("cooling", "heatCapacity", "capacity", "ammoType"):
                if objeto.get(campo) is not None:
                    nuevo[campo] = objeto[campo]
            datos_de_equipo(nuevo, exportacion["equipmentType"], exportacion["techLevel"], exportacion["clase"])
            origen[id_objeto] = ([exportacion["ammoType"], exportacion["equipmentType"]], None, True)
            if id_objeto in retrorreactores:
                nuevo["jumpJet"] = retrorreactores[id_objeto]
            # Sondas: DLCMechSensorRange de YAML suma lo que su SensorRangeModifier pasa de 1 al final.
            sonda = (objeto.get("probe") or {}).get("sensorRange", 1) - 1
            if sonda:
                nuevo["sensorRangePercent"] = round(sonda, 6)
            # Computadores de puntería: su rasgo (TargetingComputerTrait_BP) da su porcentaje por
            # UI_GetIncreasedSensorRangePercent, que GetSensorRange del juego suma a la base de 800 m.
            computador = (objeto.get("targetingComputer") or {}).get("sensorRange", 0)
            if computador:
                nuevo["sensorTraitPercent"] = round(computador, 6)
        objetos[id_objeto] = nuevo

    # Armas de cuerpo a cuerpo del juego (manos, antebrazos, hachas...): el catálogo de MW5 no las trae. Las
    # de los actuadores (la «Mano de asalto») van en la mano o el antebrazo y no ocupan ranuras generales.
    for nombre, valor in por_nombre(leer(os.path.join(RUTA_YAML, "juego", "armas.json"))).items():
        if NIVEL_DE_ARMA.search(nombre) or valor["clase"] != "MWMeleeWeaponDataAsset":
            continue
        datos = valor["propiedades"]
        ranura = (datos.get("WeaponSlotTypeAssetId") or {}).get("Id", {}).get("PrimaryAssetName")
        estadisticas = datos.get("StatsData") or {}
        actuador = bool(ACTUADOR_DE_CUERPO_A_CUERPO.search(nombre))
        objetos[nombre] = {
            "name": texto(datos.get("ShortName")) or texto(datos.get("Name")) or nombre, "kind": "weapon", "hardpoint": "melee",
            "tons": datos.get("Tonnage") or 0, "slotType": ranura, "slots": 0 if actuador else tamanos.get(ranura, 1),
            "meleeDamage": (estadisticas.get("Melee") or {}).get("Damage", 0), "cooldown": estadisticas.get("Cooldown"),
            **({"actuator": True} if actuador else {}),
        }
        combate = combate_del_arma(nombre, armas_por_nivel.get(nombre) or {"1": valor})
        if combate:
            objetos[nombre]["combat"] = combate
        origen[nombre] = ([datos.get("WeaponType")], nombre, False)

    # Armas de Yet Another Weapon y su versión Clan.
    for nombre, valor in por_nombre(cargar_categoria("armas")).items():
        # Como en el juego base, cada arma es un objeto con sus niveles (CEERPPC79_Lvl3 es CEERPPC79 en nivel 3).
        base = NIVEL_DE_ARMA.sub("", nombre)
        if base != nombre and "1" in armas_por_nivel.get(base, {}):
            continue
        datos = valor["propiedades"]
        etiqueta = datos.get("WeaponType")
        ranura = ranura_de_arma(nombre, etiqueta, datos.get("WeaponSlotTypeAssetId", {}).get("Id", {}).get("PrimaryAssetName"), reglas)
        objetos[nombre] = {
            "mod": valor["mod"],
            "name": texto(datos.get("ShortName")) or texto(datos.get("Name")) or nombre, "kind": "weapon",
            "tons": datos.get("Tonnage") or 0, "hardpoint": tipo_de_anclaje(etiqueta),
            "slotType": ranura, "slots": tamanos.get(ranura, 1),
            "ammoTypes": municiones_del_arma((datos.get("StatsData") or {}).get("AmmoType"), etiqueta, propiedades_de_armas),
        }
        combate = combate_del_arma(nombre, armas_por_nivel.get(nombre) or {"1": valor})
        if combate:
            objetos[nombre]["combat"] = combate
        origen[nombre] = ([etiqueta], base, False)

    for nombre, valor in por_nombre(cargar_categoria("municion")).items():
        datos = valor["propiedades"]
        objetos[nombre] = {"mod": valor["mod"], "name": texto(datos.get("Name")) or nombre, "kind": "ammo", "tons": datos.get("Tons") or 0,
                           "ammoType": datos.get("AmmoType"), "capacity": datos.get("Capacity") or 0,
                           "slots": datos.get("Slots") or 1, "slotTypes": [RANURA_GENERAL]}
        origen[nombre] = ([datos.get("AmmoType"), datos.get("EquipmentType")], None, True)

    # Equipo de YAML con sus propiedades (Resources/*Equipment_Properties.json).
    for nombre, valor in por_nombre(cargar_categoria("equipo")).items():
        # Los rasgos de 'Mech (rol de la IA, computadores de puntería de la cantina) no se montan en ranuras.
        if valor["clase"] == "MWMechTraitDataAsset":
            continue
        datos = valor["propiedades"]
        objeto = {
            "mod": valor["mod"],
            "name": texto(datos.get("Name")) or nombre, "kind": "equipment",
            "tons": datos.get("Tons") or 0, "slots": datos.get("Slots") or 1,
            "slotTypes": [s["Id"]["PrimaryAssetName"] for s in datos.get("SupportedSlotTypesAssetId", [])] or [RANURA_GENERAL],
        }
        datos_de_equipo(objeto, datos.get("EquipmentType"), datos.get("TechLevel"), valor["clase"])
        origen[nombre] = ([datos.get("EquipmentType")], None, True)
        if nombre in retrorreactores:
            objeto["jumpJet"] = retrorreactores[nombre]
        if (datos.get("SensorRangeModifier") or 0) > 0:
            objeto["sensorRangePercent"] = round(datos["SensorRangeModifier"] - 1, 4)
        # YAML monta casi todo su equipo como disipadores: el que refrigera por sí mismo (el Royal DHS Kit,
        # «Heat efficiency 0.2») lo dice en el asset, no en las propiedades.
        disipador = datos.get("HeatSink") or {}
        if disipador.get("HealthyEfficiency"):
            objeto["cooling"] = round(disipador["HealthyEfficiency"], 6)
        if disipador.get("HealthyCapacity"):
            objeto["heatCapacity"] = round(disipador["HealthyCapacity"], 6)
        color = color_propio(nombre, datos.get("EquipmentType"), propiedades)
        if color:
            objeto["color"] = color
        if (datos.get("EquipmentType") or "").startswith("Equipment.Engine.Core"):
            # DLCGetInstalledInternals: la potencia es el TechLevel del núcleo en valor absoluto.
            objeto["rating"] = abs(datos.get("TechLevel") or 0)
        objetos[nombre] = objeto

    for nombre, (etiquetas, sin_nivel, equipo) in origen.items():
        aplicar_propiedades(objetos[nombre], propiedades_combinadas(globales, nombre, [e for e in etiquetas if e], sin_nivel), equipo)
    return objetos


def ids_del_juego():
    """El id de cada variante del MechLab de MW5 por el nombre de archivo de su MDA (AS7-D_MDA → AS7-D)."""
    ids = {}
    for archivo in sorted(os.listdir(RUTA_MDA_JUEGO)):
        if archivo.endswith(".copy") and archivo not in ARCHIVOS_NO_JUGABLES:
            with open(os.path.join(RUTA_MDA_JUEGO, archivo), encoding="utf-8", errors="replace") as entrada:
                variante = obtener_variante(entrada.read())
            if variante:
                # Algunos assets cambian de mayúsculas entre el juego y YAML (ARC-2RB_MDA y ARC-2Rb_MDA).
                ids[archivo[: -len(".copy")].lower()] = variante
    return ids


def zona_vacia():
    return {"general": 0, "actuators": [], "special": {}, "hardpoints": [], "maxArmor": 0, "structure": 0, "rear": False}


def construir_zonas(datos):
    zonas = {zona: zona_vacia() for zona in ZONAS.values()}
    estadisticas = datos["MechDataStats"]
    salud = datos.get("HealthDataStats") or estadisticas.get("HealthDataStats", {})
    for campo, zona in CAMPOS_ZONA.items():
        zonas[zona]["maxArmor"] = salud.get("MaxArmor", {}).get(campo, 0)
        zonas[zona]["structure"] = salud.get("MaxStructure", {}).get(campo, 0)
    for zona in TRASERAS.values():
        zonas[zona]["rear"] = True
    for bloque in datos.get("EquipmentAllocation", {}).get("SlotData", []):
        tipo = bloque["SlotTypeDataAssetId"]["Id"]["PrimaryAssetName"]
        for parte, cantidad in bloque["SlotCounts"]:
            zona = ZONAS.get(parte)
            if not zona:
                continue
            if tipo == RANURA_GENERAL:
                zonas[zona]["general"] += cantidad
            else:
                zonas[zona]["special"][tipo] = zonas[zona]["special"].get(tipo, 0) + cantidad
    for zona, tipos in RANURAS_INYECTADAS.items():
        for tipo in tipos:
            zonas[zona]["special"].setdefault(tipo, 1)
    for interno in datos.get("EquipmentAllocation", {}).get("InternalEquipment", []):
        nombre = interno.split("::", 1)[1]
        if "_" in nombre:
            parte, actuador = nombre.split("_", 1)
            zona = CAMPOS_ZONA.get(parte)
            if zona:
                zonas[zona]["actuators"].append(actuador)
    for anclaje in datos.get("SelectedWeaponHardPoints", []):
        zona, tipo = obtener_parte_cuerpo(anclaje), obtener_tipo_arma(anclaje)
        if zona and tipo:
            zonas[zona]["hardpoints"].append({"id": anclaje, "type": tipo})
    return zonas


def canonico(pieza, objetos, minusculas):
    """El id del catálogo: los loadouts no respetan las mayúsculas (Smalllaser es SmallLaser)."""
    return pieza if pieza in objetos else minusculas.get(pieza.lower())


def construir_build_de_serie(datos, loadout, objetos, avisos, id_mech):
    minusculas = {id_objeto.lower(): id_objeto for id_objeto in objetos}
    importado = datos["MechDataStats"].get("MechImportData", {}).get("BaseMechInformation", {})
    potencia = importado.get("EngineRating")
    asignacion = datos.get("EquipmentAllocation", {})
    armadura_mda = asignacion.get("ArmorDataAssetId", {}).get("Id", {}).get("PrimaryAssetName")
    estructura_mda = asignacion.get("StructureDataAssetId", {}).get("Id", {}).get("PrimaryAssetName")
    disipadores = (asignacion.get("AllowedHeatSinkType") or "").rsplit(".", 1)[-1]
    internas = {
        "Engine": f"std{potencia}" if potencia else None,
        "EngineTypeSlot": TIPO_DE_MOTOR[bool(importado.get("bXLEngine"))],
        "Armorslot": ARMADURAS.get(armadura_mda, "ARMOR_STANDARD_FIXED"),
        "Structureslot": ESTRUCTURAS.get(estructura_mda, "STRUCTURE_STANDARD_FIXED"),
        "enginecooling": KITS_DE_REFRIGERACION.get({"Single": "single", "Double": "double", "ClanDouble": "clanDouble"}.get(disipadores, "single")),
        **INTERNAS_DE_SERIE,
    }
    piezas = []
    for parte in loadout.get("Equipment", {}).get("MechPartEquipment", []):
        zona = ZONAS.get(parte["MechPart"])
        for hueco in parte["SlottedEquipment"]:
            tipo = hueco["SlotTypeAssetId"]["Id"]["PrimaryAssetName"]
            pieza = hueco["EquipmentData"]["EquipmentId"]["Id"]["PrimaryAssetName"]
            if not pieza or pieza == "None" or PIEZAS_TECNICAS.search(pieza):
                continue
            motor = MOTOR_DEL_JUEGO.match(pieza)
            if motor and tipo == "Engine":
                internas["Engine"] = f"std{motor.group(2)}"
                if motor.group(1) == "XL":
                    internas["EngineTypeSlot"] = "ENGINE_XL"
                continue
            if tipo in internas:
                internas[tipo] = canonico(pieza, objetos, minusculas) or pieza
                continue
            pieza = canonico(pieza, objetos, minusculas)
            if not pieza:
                avisos.append(f"{id_mech}: pieza desconocida {hueco['EquipmentData']['EquipmentId']['Id']['PrimaryAssetName']} en {tipo}")
                continue
            piezas.append({"zone": zona, "slotType": tipo, "item": pieza})
    armas = []
    for arma in loadout.get("InstalledWeapons", []):
        pieza = arma["WeaponData"]["WeaponId"]["Id"]["PrimaryAssetName"]
        if not pieza or pieza == "None":
            continue
        # Las armas con nivel (MediumLaser_Lvl2) son la misma arma: el catálogo guarda los niveles dentro.
        nivel = NIVEL_DE_ARMA.search(pieza)
        original, pieza = pieza, canonico(NIVEL_DE_ARMA.sub("", pieza), objetos, minusculas)
        if not pieza:
            avisos.append(f"{id_mech}: arma desconocida {original}")
            continue
        montada = {"zone": obtener_parte_cuerpo(arma["HardpointSlotID"]), "hardpoint": arma["HardpointSlotID"], "item": pieza}
        if nivel:
            montada["tier"] = int(nivel.group(1))
        armas.append(montada)
    armadura = {zona: {"front": 0, "rear": 0} for zona in ZONAS.values()}
    for campo, valor in loadout.get("InstalledArmor", {}).items():
        if campo in CAMPOS_ZONA:
            armadura[CAMPOS_ZONA[campo]]["front"] = valor
    for campo, valor in loadout.get("InstalledRearArmor", {}).items():
        if campo in TRASERAS:
            armadura[TRASERAS[campo]]["rear"] = valor
    return {"internal": {tipo: pieza for tipo, pieza in internas.items() if pieza}, "items": piezas, "weapons": armas, "armor": armadura}


def movimiento(datos):
    """Giro, giro del torso y ángulos del torso y los brazos del MDA, que el panel del juego multiplica por
    las bonificaciones (CalculateMechStats). Un torso sin límite (bIsYawUnbound) gira 360°."""
    estadisticas = datos["MechDataStats"]
    torso = estadisticas.get("TorsoStats") or {}
    limites = torso.get("TorsoTwistBounds") or {}
    return {
        "turnSpeed": round((estadisticas.get("MoveStats") or {}).get("TurnSpeed", 0), 4),
        "torsoTwistRate": round((torso.get("TorsoTwistRate") or {}).get("Yaw", 0), 4),
        "torsoYaw": 360 if limites.get("bIsYawUnbound") else round((limites.get("High") or {}).get("Yaw", 0), 4),
        "armYaw": round(((torso.get("ArmTwistBounds") or {}).get("High") or {}).get("Yaw", 0), 4),
    }


def quirks_de(variante, modelo, asignaciones):
    nombres = []
    for clave in (modelo, variante):
        for quirk in asignaciones.get(clave, {}).get("quirks", []):
            if quirk not in nombres:
                nombres.append(quirk)
    return nombres


def main():
    cargar_textos()
    reglas = leer(os.path.join(RUTA_YAML, "yet-another-mechlab", "reglas.json"))
    tamanos = tamanos_de_ranuras(reglas)
    objetos = construir_objetos(leer(os.path.join(RUTA_DATOS, "items.json")), reglas, tamanos)
    mechs_juego = {mech["id"]: mech for mech in leer(os.path.join(RUTA_DATOS, "mechs.json"))}
    ids = ids_del_juego()
    # Los loadouts del juego, y encima los de los mods, que los sustituyen.
    loadouts = por_nombre(leer(os.path.join(RUTA_YAML, "juego", "loadouts.json")))
    loadouts.update(por_nombre(cargar_categoria("loadouts")))
    loadouts = {nombre.lower(): valor for nombre, valor in loadouts.items()}
    asignaciones = cargar_recursos("mechs.json")
    quirks = cargar_recursos("quirks.json")

    mechs = []
    avisos = []
    vistos = set()
    for ruta, valor in sorted(cargar_categoria("mechs").items()):
        nombre_mda = ruta.rsplit("/", 1)[1]
        id_mech = ids.get(nombre_mda.lower())
        # Solo las variantes del MechLab de MW5, por la ruta del juego que YAML sustituye.
        if not id_mech or id_mech not in mechs_juego or id_mech in vistos or not ruta.startswith("/Game/"):
            continue
        datos = valor["propiedades"]["MutableMechData"]
        nombre_loadout = (datos.get("DefaultMech", {}).get("Id", {}).get("PrimaryAssetName")) or nombre_mda.replace("_MDA", "_Loadout")
        loadout = loadouts.get(nombre_loadout.lower(), {}).get("propiedades", {}).get("MechLoadout")
        if not loadout:
            avisos.append(f"{id_mech}: sin loadout {nombre_loadout}")
            continue
        vistos.add(id_mech)
        modelo = (datos.get("MechModel") or "").rsplit(".", 1)[-1]
        mech_juego = mechs_juego[id_mech]
        mechs.append({
            "id": id_mech, "chassis": mech_juego["name"], "variant": mech_juego["variant"],
            "tonnage": datos["MechDataStats"]["BaseStats"]["Tons"],
            **({"dlc": mech_juego["dlc"]} if mech_juego.get("dlc") else {}),
            "quirks": quirks_de(id_mech, modelo, asignaciones),
            "zones": construir_zonas(datos),
            "stock": construir_build_de_serie(datos, loadout, objetos, avisos, id_mech),
            "movement": movimiento(datos),
        })

    usados = {q for mech in mechs for q in mech["quirks"]}
    datos_quirks = {nombre: {"name": quirks[nombre].get("name", nombre), "description": quirks[nombre].get("description", ""),
                             "properties": quirks[nombre].get("properties", {})} for nombre in sorted(usados) if nombre in quirks}
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    colores = construir_colores()
    for nombre, datos in (("mechs.json", mechs), ("items.json", objetos), ("quirks.json", datos_quirks), ("colors.json", colores)):
        with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
            json.dump(datos, archivo, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            archivo.write("\n")
    sin_variante = sorted(set(mechs_juego) - vistos)
    print(f"{len(mechs)} variantes, {len(objetos)} objetos y {len(datos_quirks)} quirks en {RUTA_DESTINO}")
    if sin_variante:
        print(f"Aviso: {len(sin_variante)} variantes del MechLab de MW5 sin MDA de YAML: {', '.join(sin_variante[:20])}")
    sin_loadout = [a for a in avisos if "sin loadout" in a]
    print(f"Aviso: {len(sin_loadout)} variantes sin loadout en los mods")
    avisos = [a for a in avisos if "sin loadout" not in a]
    for aviso in sin_loadout:
        print("Aviso:", aviso)
    for aviso in avisos[:30]:
        print("Aviso:", aviso)
    if len(avisos) > 30:
        print(f"Aviso: {len(avisos) - 30} avisos más")
    return 0


if __name__ == "__main__":
    sys.exit(main())
