import glob
import json
import os
import re
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
TIPO_DE_MOTOR = {False: "ENGINE_FIXED", True: "ENGINE_XL"}
# Piezas de los loadouts que no son equipo del jugador: el contrapeso con el que YAML compensa el peso
# de los 'Mechs del juego al convertirlos (−1000 t) y los rellenos, que el mechlab recoloca solo.
PIEZAS_TECNICAS = re.compile(r"COUNTERWEIGHT|UAVCOMPONENT|_filler$|^DYNAMIC_FILLER|^XLfiller$", re.IGNORECASE)
# Los ataques cuerpo a cuerpo de las manos y los antebrazos van en sus actuadores, no son armas del
# inventario.
CUERPO_A_CUERPO = re.compile(r"_MeleeWeaponDataAsset$")
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
            assets.update(leer(ruta))
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


def construir_objetos(catalogo_juego, reglas, tamanos):
    objetos = {}
    # Armas y equipo del juego base: sus cifras están en el catálogo de MW5; el tipo de ranura de las
    # armas, en sus exportaciones.
    for id_objeto, objeto in catalogo_juego.items():
        nuevo = {"name": objeto["name"], "kind": objeto["type"], "tons": objeto.get("tonnage") or 0}
        if objeto["type"] == "weapon":
            ruta = os.path.join(RUTA_ITEMS_JUEGO, id_objeto + ".copy")
            exportado = ""
            if os.path.exists(ruta):
                with open(ruta, encoding="utf-8") as archivo:
                    exportado = archivo.read()
            ranura = (REGEX_PROPIEDAD["slotType"].search(exportado) or [None, None])[1]
            etiqueta = (REGEX_PROPIEDAD["weaponType"].search(exportado) or [None, None])[1]
            ranura = ranura_de_arma(id_objeto, etiqueta, ranura, reglas)
            nuevo.update({"hardpoint": objeto.get("weaponType"), "slotType": ranura, "slots": tamanos.get(ranura, 1)})
        else:
            nuevo.update({"slots": objeto.get("slots") or 1, "slotTypes": objeto.get("specialSlotTypes") or [RANURA_GENERAL]})
            for campo in ("cooling", "heatCapacity", "capacity", "ammoType"):
                if objeto.get(campo) is not None:
                    nuevo[campo] = objeto[campo]
        objetos[id_objeto] = nuevo

    # Armas de Yet Another Weapon y su versión Clan.
    for nombre, valor in por_nombre(cargar_categoria("armas")).items():
        datos = valor["propiedades"]
        etiqueta = datos.get("WeaponType")
        ranura = ranura_de_arma(nombre, etiqueta, datos.get("WeaponSlotTypeAssetId", {}).get("Id", {}).get("PrimaryAssetName"), reglas)
        objetos[nombre] = {
            "name": texto(datos.get("ShortName")) or texto(datos.get("Name")) or nombre, "kind": "weapon",
            "tons": datos.get("Tonnage") or 0, "hardpoint": tipo_de_anclaje(etiqueta),
            "slotType": ranura, "slots": tamanos.get(ranura, 1),
        }

    for nombre, valor in por_nombre(cargar_categoria("municion")).items():
        datos = valor["propiedades"]
        objetos[nombre] = {"name": texto(datos.get("Name")) or nombre, "kind": "ammo", "tons": datos.get("Tons") or 0,
                           "slots": datos.get("Slots") or 1, "slotTypes": [RANURA_GENERAL]}

    # Equipo de YAML con sus propiedades (Resources/*Equipment_Properties.json).
    propiedades = cargar_recursos("Equipment_Properties.json")
    for nombre, valor in por_nombre(cargar_categoria("equipo")).items():
        # Los rasgos de 'Mech (rol de la IA, computadores de puntería de la cantina) no se montan en ranuras.
        if valor["clase"] == "MWMechTraitDataAsset":
            continue
        datos = valor["propiedades"]
        extra = propiedades.get(nombre, {})
        objeto = {
            "name": extra.get("name") or texto(datos.get("Name")) or nombre, "kind": "equipment",
            "category": datos.get("EquipmentType"),
            "tons": extra.get("equipmentTons", datos.get("Tons") or 0),
            "slots": extra.get("slots", datos.get("Slots") or 1),
            "slotTypes": [s["Id"]["PrimaryAssetName"] for s in datos.get("SupportedSlotTypesAssetId", [])] or [RANURA_GENERAL],
        }
        # YAML monta casi todo su equipo como disipadores: el que refrigera por sí mismo (el Royal DHS Kit,
        # «Heat efficiency 0.2») lo dice en el asset, no en las propiedades.
        disipador = datos.get("HeatSink") or {}
        if disipador.get("HealthyEfficiency"):
            objeto["cooling"] = round(disipador["HealthyEfficiency"], 4)
        if disipador.get("HealthyCapacity"):
            objeto["heatCapacity"] = round(disipador["HealthyCapacity"], 4)
        if (datos.get("EquipmentType") or "").startswith("Equipment.Engine.Core"):
            objeto["rating"] = datos.get("TechLevel")
        if "fillerSlots" in extra:
            # Las ranuras fijas van por ubicación con los nombres del juego (LeftTorso); se pasan a los de la web.
            objeto["fillerSlots"] = {CAMPOS_ZONA.get(clave, clave): valor for clave, valor in extra["fillerSlots"].items()}
        for campo in ("engineRelativeWeight", "relativeWeight", "structureWeightMulti", "structureMulti",
                      "armorWeightMulti", "armorPerTon", "armorMulti", "engineHeatsinkEfficiency", "engineHeatsinkCapacity",
                      "heatEfficiency", "fixed"):
            if campo in extra:
                objeto[campo] = extra[campo]
        objetos[nombre] = objeto
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
        if not pieza or pieza == "None" or CUERPO_A_CUERPO.search(pieza):
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
        })

    usados = {q for mech in mechs for q in mech["quirks"]}
    datos_quirks = {nombre: {"name": quirks[nombre].get("name", nombre), "description": quirks[nombre].get("description", ""),
                             "properties": quirks[nombre].get("properties", {})} for nombre in sorted(usados) if nombre in quirks}
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    for nombre, datos in (("mechs.json", mechs), ("items.json", objetos), ("quirks.json", datos_quirks)):
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
