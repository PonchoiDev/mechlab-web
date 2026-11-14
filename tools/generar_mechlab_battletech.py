import json
import os
import re
from collections import Counter

# Genera los datos del MechLab de BATTLETECH a partir de lo que extraer_mechlab_battletech.py dejó en
# tools/datos-juego/battletech/mechlab/:
#   - src/data/battletech/mechs.json: las variantes que el jugador puede tener, con su chasis y su build
#     de serie;
#   - src/data/battletech/items.json: armas, munición, disipadores, retrorreactores y mejoras;
#   - src/data/battletech/constants.json: las constantes de calor, blindaje y coste del juego.
#
#   python3 tools/generar_mechlab_battletech.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "mechlab")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "battletech")
RUTA_ICONOS = os.path.join(DIRECTORIO_SCRIPT, "..", "battletech", "public", "mechlab", "icons")

UBICACIONES = {"Head": "head", "CenterTorso": "centerTorso", "LeftTorso": "leftTorso", "RightTorso": "rightTorso",
               "LeftArm": "leftArm", "RightArm": "rightArm", "LeftLeg": "leftLeg", "RightLeg": "rightLeg"}
# AllowedLocations es una lista separada por comas con espacios irregulares («Torso, Legs»,
# «LeftTorso,RightTorso»); estos son sus grupos.
GRUPOS_DE_UBICACIONES = {
    "All": list(UBICACIONES.values()),
    "Arms": ["leftArm", "rightArm"],
    "Legs": ["leftLeg", "rightLeg"],
    "Torso": ["leftTorso", "centerTorso", "rightTorso"],
    **{nombre: [zona] for nombre, zona in UBICACIONES.items()},
}
ANCLAJES = {"Energy": "energy", "Ballistic": "ballistic", "Missile": "missile", "AntiPersonnel": "support"}
TIPOS = {"Weapon": "weapon", "AmmunitionBox": "ammo", "HeatSink": "heatSink", "JumpJet": "jumpJet", "Upgrade": "upgrade"}
# Componentes que no se montan: los ataques cuerpo a cuerpo y de salto (los usa el combate), el láser
# imaginario de la IA, las armas de la misión de Victoria, el arma interna de los morteros (el jugador
# monta el Gear_Mortar_*) y el módulo de los muñecos de prácticas.
EXCLUIDOS = {"Weapon_MeleeAttack", "Weapon_DFAAttack", "Weapon_Laser_AI_Imaginary", "TargetDummyMod"}
REGEX_EXCLUIDOS = re.compile(r"(_SPECIAL-|^Weapon_Mortar_|Template$)")
# Grupos de mejoras, por el principio del id.
GRUPOS_DE_MEJORAS = [("Gear_Actuator_", "actuator"), ("Gear_Cockpit_", "cockpit"), ("Gear_Gyro_", "gyro"),
                     ("Gear_TargetingTrackingSystem_", "targeting"), ("Gear_Sensor_", "electronic"),
                     ("Gear_Mortar_", "artillery"), ("Gear_", "general")]
# Etiquetas de los MechTags que describen el papel de la variante. El juego no les da nombre visible
# (tagdata.sql las deja sin texto): estos son los que enseña la web.
ETIQUETAS = {
    "unit_role_brawler": "Brawler", "unit_role_sniper": "Sniper", "unit_role_scout": "Scout",
    "unit_role_flanker": "Flanker", "unit_role_ewe": "Electronic warfare",
    "unit_lance_tank": "Tank", "unit_lance_assassin": "Assassin", "unit_lance_support": "Support",
    "unit_lance_vanguard": "Vanguard",
    "unit_range_short": "Short range", "unit_range_medium": "Medium range", "unit_range_long": "Long range",
    "unit_speed_high": "Fast", "unit_speed_low": "Slow", "unit_armor_high": "Heavy armor",
    "unit_armor_low": "Light armor", "unit_hot": "Runs hot", "unit_indirectFire": "Indirect fire",
}
CLASES = {"LIGHT": "light", "MEDIUM": "medium", "HEAVY": "heavy", "ASSAULT": "assault"}
# El jugador puede tener las variantes con unit_release; BLACKLISTED las saca de tiendas y botines. Las
# de las historias de los Flashpoint (_fp_) y los muñecos de prácticas no llevan unit_release.
ETIQUETA_DISPONIBLE = "unit_release"
ETIQUETA_VETADA = "BLACKLISTED"


def leer(nombre):
    with open(os.path.join(RUTA_ORIGEN, nombre), encoding="utf-8") as archivo:
        return json.load(archivo)


def ubicaciones_permitidas(texto):
    zonas = []
    for parte in (texto or "All").split(","):
        for zona in GRUPOS_DE_UBICACIONES.get(parte.strip(), []):
            if zona not in zonas:
                zonas.append(zona)
    return [zona for zona in UBICACIONES.values() if zona in zonas]


def numero(valor):
    """Los valores de los efectos vienen como texto («0.85», «20»)."""
    try:
        valor = float(valor)
    except (TypeError, ValueError):
        return None
    return int(valor) if valor.is_integer() else valor


def categoria_de_municion(objeto):
    """Las armas y municiones del juego base usan ammoCategoryID, y las de Heavy Metal unas veces
    AmmoCategory y otras Category; NotSet significa que no usa munición."""
    for campo in ("ammoCategoryID", "AmmoCategory", "Category"):
        valor = objeto.get(campo)
        if valor and valor != "NotSet":
            return valor
    return None


def efectos(componente):
    lista = []
    for efecto in componente.get("statusEffects") or []:
        valor = numero(efecto.get("modValue"))
        entrada = {"stat": efecto["statName"], "operation": efecto["operation"],
                   "value": valor if valor is not None else efecto.get("modValue")}
        if efecto.get("targetCollection") not in (None, "NotSet"):
            entrada["target"] = efecto["targetCollection"]
        if efecto.get("targetWeaponCategory") not in (None, "NotSet"):
            entrada["category"] = ANCLAJES.get(efecto["targetWeaponCategory"], efecto["targetWeaponCategory"])
        lista.append(entrada)
    return lista


def generar_item(id_, componente, municiones):
    descripcion = componente["Description"]
    nombre = (descripcion.get("UIName") or descripcion.get("Name") or id_).strip()
    etiquetas = (componente.get("ComponentTags") or {}).get("items") or []
    tipo = TIPOS[componente["tipo"]]
    item = {
        "id": id_,
        "name": re.sub(r"\s+", " ", nombre),
        # Las versiones mejoradas llevan «+» en el nombre, tantas como el _N- del id: M Laser + + es
        # Weapon_Laser_MediumLaser_2-Magna.
        "baseName": re.sub(r"\s+", " ", nombre.replace("+", "")).strip(),
        "plus": nombre.count("+"),
        "kind": tipo,
        "source": componente["fuente"],
        "manufacturer": (descripcion.get("Manufacturer") or "").strip(),
        "tonnage": componente.get("Tonnage", 0),
        "slots": componente.get("InventorySize", 1),
        # DisallowedLocations es un relleno de la plantilla («All» en casi todo): no se usa.
        "locations": ubicaciones_permitidas(componente.get("AllowedLocations")),
        "cost": descripcion.get("Cost", 0),
        "rarity": descripcion.get("Rarity", 0),
        "purchasable": bool(descripcion.get("Purchasable")),
        "bonuses": [texto.strip() for texto in (componente.get("BonusValueA"), componente.get("BonusValueB"))
                    if isinstance(texto, str) and texto.strip()],
    }
    # BLACKLISTED en ComponentTags solo los saca de las tiendas aleatorias (lo llevan el Gauss, los
    # láseres ER y de pulsos o el disipador doble): no se filtra por él.
    if "component_type_lostech" in etiquetas:
        item["lostech"] = True
    # BUILT-IN: equipo fijo de algunos chasis (módulos de mando, capacitadores…), que no se puede
    # montar ni quitar en el mechlab.
    if "BUILT-IN" in etiquetas:
        item["builtIn"] = True

    if tipo == "weapon":
        item["hardpoint"] = ANCLAJES[componente["Category"]]
        arma = {
            "type": componente.get("Type"),
            "subType": componente.get("WeaponSubType"),
            "damage": componente.get("Damage", 0),
            "shots": componente.get("ShotsWhenFired", 1),
            "heat": componente.get("HeatGenerated", 0),
            "heatDamage": componente.get("HeatDamage", 0),
            "instability": componente.get("Instability", 0),
            "accuracy": componente.get("AccuracyModifier", 0),
            "critChance": componente.get("CriticalChanceMultiplier", 1),
            "minRange": componente.get("MinRange", 0),
            "rangeSplit": componente.get("RangeSplit") or [0, 0, 0],
            "maxRange": componente.get("MaxRange", 0),
            "ammoCategory": categoria_de_municion(componente),
            # Los lanzallamas y los Inferno traen su propia munición (StartingAmmoCapacity).
            "internalAmmo": componente.get("StartingAmmoCapacity", 0),
            "indirectFire": bool(componente.get("IndirectFireCapable")),
            "refire": componente.get("RefireModifier", 0),
        }
        if componente.get("StructureDamage"):
            arma["structureDamage"] = componente["StructureDamage"]
        if componente.get("EvasivePipsIgnored"):
            arma["evasionIgnored"] = componente["EvasivePipsIgnored"]
        item["weapon"] = arma
    elif tipo == "ammo":
        municion = municiones.get(componente.get("AmmoID"), {})
        item["ammo"] = {"category": categoria_de_municion(municion), "capacity": componente.get("Capacity", 0)}
    elif tipo == "heatSink":
        lista = efectos(componente)
        multiplicador = 1
        for efecto in lista:
            if efecto["stat"] == "HeatGenerated" and efecto["operation"] == "Float_Multiply":
                multiplicador *= efecto["value"]
        item["heatSink"] = {
            "dissipation": componente.get("DissipationCapacity", 0),
            # Los bancos de calor suben el calor máximo y el umbral de sobrecalentamiento.
            "maxHeat": sum(e["value"] for e in lista if e["stat"] == "MaxHeat"),
            "overheat": sum(e["value"] for e in lista if e["stat"] == "OverheatLevel"),
            # Los intercambiadores térmicos multiplican el calor que generan las armas.
            "weaponHeatMultiplier": multiplicador,
        }
    elif tipo == "jumpJet":
        item["jumpJet"] = {"capacity": componente.get("JumpCapacity", 1), "minTonnage": componente.get("MinTonnage", 0),
                           "maxTonnage": componente.get("MaxTonnage", 100)}
    else:
        item["group"] = next(grupo for prefijo, grupo in GRUPOS_DE_MEJORAS if id_.startswith(prefijo))
    lista = efectos(componente)
    if lista and tipo != "heatSink":
        item["effects"] = lista
    return item


def generar_items(componentes, municiones):
    items = {}
    for id_, componente in componentes.items():
        if id_ in EXCLUIDOS or REGEX_EXCLUIDOS.search(id_) or not (componente.get("Description") or {}).get("UIName"):
            continue
        if componente.get("tipo") not in TIPOS:
            continue
        items[id_] = generar_item(id_, componente, municiones)
    orden = list(TIPOS.values())
    return sorted(items.values(), key=lambda item: (orden.index(item["kind"]), item.get("hardpoint", ""),
                                                    item["baseName"], item["plus"], item["id"]))


def generar_mech(id_, mech, chasis, movimiento, ids_items, iconos):
    ubicaciones = {}
    for ubicacion in chasis["Locations"]:
        trasera = ubicacion.get("MaxRearArmor", -1)
        ubicaciones[UBICACIONES[ubicacion["Location"]]] = {
            "hardpoints": [ANCLAJES[anclaje["WeaponMount"]] for anclaje in ubicacion.get("Hardpoints") or []],
            "slots": ubicacion["InventorySlots"],
            "maxArmor": ubicacion["MaxArmor"],
            # -1: la ubicación no tiene blindaje trasero.
            "maxRearArmor": trasera if trasera >= 0 else None,
            "structure": ubicacion["InternalStructure"],
        }
    blindaje = {}
    for ubicacion in mech["Locations"]:
        trasera = ubicacion.get("AssignedRearArmor", -1)
        blindaje[UBICACIONES[ubicacion["Location"]]] = [ubicacion.get("AssignedArmor", 0), max(trasera, 0)]
    piezas = []
    for pieza in mech["inventory"]:
        if pieza["ComponentDefID"] not in ids_items:
            print(f"Aviso: {id_} lleva {pieza['ComponentDefID']}, que no está en el catálogo")
            continue
        piezas.append([UBICACIONES[pieza["MountedLocation"]], pieza["ComponentDefID"]])
    fijo = [[UBICACIONES[pieza["MountedLocation"]], pieza["ComponentDefID"]] for pieza in chasis.get("FixedEquipment") or []]
    for _, pieza in fijo:
        if pieza not in ids_items:
            print(f"Aviso: el equipo fijo {pieza} de {chasis['Description']['Id']} no está en el catálogo")

    andar = movimiento.get(chasis.get("MovementCapDefID"))
    if not andar:
        print(f"Aviso: {chasis['Description']['Id']} apunta a {chasis.get('MovementCapDefID')}, que no existe: sin movimiento")
    icono = (chasis["Description"].get("Icon") or "").removeprefix("uixTxrIcon_")
    etiquetas = mech["MechTags"]["items"]
    return {
        "id": id_.removeprefix("mechdef_"),
        "chassisId": chasis["Description"]["Id"],
        "name": chasis["Description"].get("UIName") or chasis["Description"]["Name"],
        "variant": chasis["VariantName"],
        "source": mech["fuente"],
        "tonnage": chasis["Tonnage"],
        "initialTonnage": chasis["InitialTonnage"],
        "weightClass": CLASES[chasis["weightClass"]],
        "role": chasis.get("StockRole") or "",
        "description": (chasis.get("YangsThoughts") or chasis["Description"].get("Details") or "").strip(),
        "icon": icono if icono in iconos else None,
        "maxJumpJets": chasis.get("MaxJumpjets", 0),
        # Heatsinks del chasis: solo lo traen 11 chasis especiales (30). Su efecto está por confirmar
        # con una captura del juego, así que se guarda sin sumarlo a la disipación.
        "chassisHeatsinks": chasis.get("Heatsinks", 0),
        "stability": chasis.get("Stability", 0),
        "melee": {"damage": chasis.get("MeleeDamage", 0), "instability": chasis.get("MeleeInstability", 0)},
        "dfa": {"damage": chasis.get("DFADamage", 0), "selfDamage": chasis.get("DFASelfDamage", 0),
                "instability": chasis.get("DFAInstability", 0)},
        "walk": andar["MaxWalkDistance"] if andar else None,
        "sprint": andar["MaxSprintDistance"] if andar else None,
        "chassisCost": chasis["Description"].get("Cost", 0),
        "stockCost": mech["Description"].get("Cost", 0),
        "tags": [texto for etiqueta, texto in ETIQUETAS.items() if etiqueta in etiquetas],
        "locations": {zona: ubicaciones[zona] for zona in UBICACIONES.values()},
        "fixed": fijo,
        "stock": {"armor": {zona: blindaje.get(zona, [0, 0]) for zona in UBICACIONES.values()}, "items": piezas},
    }


def generar_mechs(mechs, chasis, movimiento, ids_items):
    iconos = {nombre[: -len(".png")] for nombre in os.listdir(RUTA_ICONOS) if nombre.endswith(".png")}
    lista = []
    for id_, mech in mechs.items():
        etiquetas = (mech.get("MechTags") or {}).get("items") or []
        if ETIQUETA_DISPONIBLE not in etiquetas or ETIQUETA_VETADA in etiquetas:
            continue
        datos_chasis = chasis.get(mech["ChassisID"])
        if not datos_chasis:
            print(f"Aviso: {id_} usa el chasis {mech['ChassisID']}, que no existe")
            continue
        lista.append(generar_mech(id_, mech, datos_chasis, movimiento, ids_items, iconos))
    orden = list(CLASES.values())
    return sorted(lista, key=lambda m: (orden.index(m["weightClass"]), m["tonnage"], m["name"], m["variant"]))


def generar_constantes(constantes):
    calor = constantes["Heat"]
    estadisticas = constantes["MechStatistics"]
    return {
        "internalHeatSinks": calor["InternalHeatSinkCount"],
        "internalHeatSinkDissipation": calor["DefaultHeatSinkDissipationCapacity"],
        "maxHeat": calor["MaxHeat"],
        "overheatLevel": calor["OverheatLevel"],
        "jumpHeatMin": calor["JumpHeatMin"],
        "jumpHeatUnitSize": calor["JumpHeatUnitSize"],
        "jumpHeatPerUnit": calor["JumpHeatPerUnit"],
        "tonnagePerArmorPoint": estadisticas["TONNAGE_PER_ARMOR_POINT"],
        "armorStep": estadisticas["ARMOR_PER_STEP"],
        "cbillsPerArmorPoint": estadisticas["CBILLS_PER_ARMOR_POINT"],
        # Reparto del blindaje del botón del mechlab, por ubicación: ArmorAllocationRatioCenterTorso y
        # ArmorAllocationRatioCenterTorsoRear pasan a centerTorso [delantero, trasero].
        "armorRatios": {zona: [estadisticas.get(f"ArmorAllocationRatio{nombre}", 0),
                               estadisticas.get(f"ArmorAllocationRatio{nombre}Rear", 0)]
                        for nombre, zona in UBICACIONES.items()},
    }


def guardar(nombre, datos):
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, separators=(",", ":"))
        archivo.write("\n")


def main():
    items = generar_items(leer("componentes.json"), leer("municiones.json"))
    ids_items = {item["id"] for item in items}
    mechs = generar_mechs(leer("mechs.json"), leer("chasis.json"), leer("movimiento.json"), ids_items)
    guardar("items.json", items)
    guardar("mechs.json", mechs)
    guardar("constants.json", generar_constantes(leer("constantes.json")))
    print(f"mechs: {len(mechs)} {dict(Counter(m['source'] for m in mechs))}")
    print(f"chasis: {len({m['chassisId'] for m in mechs})} · items: {len(items)} {dict(Counter(i['kind'] for i in items))}")
    armas = [i for i in items if i["kind"] == "weapon"]
    print(f"armas: {dict(Counter(i['source'] for i in armas))}")


if __name__ == "__main__":
    main()
