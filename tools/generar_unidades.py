import json
import os
import re
import sys
from collections import Counter

from generar_mapa import RAREZAS, REGEX_RAREZA
from generar_mechs import REGEX_ROL, ROLES, leer_archivo, separar_palabras

# Genera src/data/units.json con las unidades enemigas que no son 'Mechs: sus unit cards
# (tools/datos-juego/unitcard/) y lo que extraer_unidades.py sacó de sus blueprints
# (tools/datos-juego/unidades/).
#
#   python3 tools/generar_unidades.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_UNIT_CARDS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unitcard")
RUTA_UNIDADES = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unidades")
RUTA_ITEMS = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "items.json")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "units.json")

REGEX_CLASE = re.compile(r'UnitClass=([^,]+?)\.[^.,]+_C[,)]')
REGEX_TIPO = re.compile(r'UnitType=\(UnitType=\(TagName="([^"]+)"')
REGEX_NOMBRE = re.compile(r'(?<![A-Za-z])Name=NSLOCTEXT\("[^"]*", "[^"]*", "([^"]+)"\)')
REGEX_FECHA = re.compile(r"IntroDate=(\d{3,4})\.")
REGEX_TIER = re.compile(r"(?<![A-Za-z])Tier=(\d+)")
REGEX_VALOR = re.compile(r"BattleValue=(\d+)")
REGEX_NIVEL = re.compile(r"_Lvl(\d+)$")
# El tipo de unidad, por el principio de su etiqueta. Las armaduras de combate (Battle Armor y Clan
# Elemental) solo dicen UnitType.Vehicle: se reconocen porque son un grupo de trajes.
TIPOS = [("UnitType.Vehicle.Tracked", "tracked"), ("UnitType.Vehicle.Hover", "hover"),
         ("UnitType.Vehicle.Wheeled", "wheeled"), ("UnitType.VTOL", "vtol"), ("UnitType.Turret", "turret")]
ROLES_DE_UNIDAD = {**ROLES, "airsupport": "Air Support"}
# La velocidad de los blueprints está en cm/s.
CM_S_A_KM_H = 0.036
# Página de Sarna de cada chasis, por el final de su etiqueta (UnitType.Vehicle.Tracked.Tank.Scorpion).
# El juego no la trae: son los títulos de Sarna, comprobados con su API. Igor y Riverjack son del
# MW5 y su página no tiene dibujo; las torretas, el Convoy y el Arrow IV Carrier no tienen página.
TITULOS_SARNA = {
    "Behemoth": "Behemoth (Combat Vehicle)", "Bulldog": "Bulldog Medium Tank", "Condor": "Condor (Combat Vehicle)",
    "Demolisher": "Demolisher", "DemolisherII": "Demolisher II", "Drillson": "Drillson", "Harasser": "Harasser",
    "Hetzer": "Hetzer", "Igor": "Igor", "JEdgar": "J. Edgar", "Manticore": "Manticore", "Ontos": "Ontos",
    "Partisan": "Partisan", "Patton": "Patton", "Po": "Po Heavy Tank", "Riverjack": "Riverjack", "Schrek": "Schrek",
    "Scorpion": "Scorpion (Combat Vehicle)", "VonLuckner": "Von Luckner", "Warrior": "Warrior (Combat Vehicle)",
}
# Los Missile Carrier comparten etiqueta: la página depende de sus misiles. Sarna redirige el MRM
# Carrier al LRM Carrier.
CARRIERS_SARNA = {"LRM": "LRM Carrier", "MRM": "LRM Carrier", "SRM": "SRM Carrier"}
# Las armaduras de combate solo dicen UnitType.Vehicle: van por su nombre.
ARMADURAS_SARNA = {"Battle Armor": "Inner Sphere Standard (Battle Armor)", "Clan Elemental": "Elemental (Battle Armor)"}


def titulo_sarna(etiqueta, nombre):
    if nombre in ARMADURAS_SARNA:
        return ARMADURAS_SARNA[nombre]
    chasis = etiqueta.rsplit(".", 1)[1]
    if chasis == "MissileCarrier":
        return CARRIERS_SARNA.get(nombre[:3])
    return TITULOS_SARNA.get(chasis)


def tipo_de_unidad(etiqueta, unidad):
    if unidad.get("escuadra"):
        return "battleArmor"
    return next((tipo for prefijo, tipo in TIPOS if etiqueta.startswith(prefijo)), None)


def se_muestra(archivo):
    """Las unit cards que el juego usa en los contratos.

    Las _Recruit_ son copias de las normales con una IA menos agresiva para las primeras misiones, y
    las torretas de las naves de descenso (sin _UnitCard) no se encuentran en un contrato.
    """
    return archivo.endswith("_UnitCard") and "_Recruit_" not in archivo


def estadisticas_de_arma(arma):
    """Las estadísticas de un arma que no está en items.json, como las calcula generar_items.py.

    Daño y calor por proyectil o, en los láseres, por disparo; la salva multiplica el daño por los
    proyectiles o misiles y el calor por los misiles. Los quirks del arma suben o bajan cada valor.
    """
    proyectil = arma.get("Projectile") or (arma.get("MissileStats") or {}).get("Projectile") or {}
    rayo = arma.get("Trace") or {}
    rangos = arma.get("Range") or arma.get("Ranges") or {}
    # El Arrow IV hace casi todo su daño con la explosión, que es la cifra que enseña el juego.
    dano = proyectil.get("CachedExplosionDamageDisplay") or proyectil.get("Damage") or rayo.get("DamageOverDuration", 0.0)
    calor = proyectil.get("HeatGenerated") or rayo.get("HeatGeneratedOverDuration", 0.0)
    quirks = arma.get("Quirks", {})
    cooldown = round(arma.get("Cooldown", 0.0) * (1 + quirks.get("CooldownPercentage_Quirk", 0.0)), 3)
    alcance = 1 + quirks.get("RangePercentage_Quirk", 0.0)
    estadisticas = {
        "damage": round(dano * (1 + quirks.get("DamagePercentage_Quirk", 0.0)), 2),
        "heatPerShot": round(calor * (1 + quirks.get("HeatGeneratedPercentage_Quirk", 0.0)), 3),
        "cooldown": cooldown,
        "range": round(rangos.get("OptimalRange", 0.0) / 100 * alcance, 1),
        "maxRange": round(rangos.get("MaxRange", rangos.get("OptimalRange", 0.0)) / 100 * alcance, 1),
        "rpm": round(60 / cooldown, 1) if cooldown > 0 else 0.0,
    }
    velocidad = proyectil.get("Speed", 0.0) / 100 * (1 + quirks.get("SpeedPercentage_Quirk", 0.0))
    if velocidad > 0:
        estadisticas["speed"] = round(velocidad, 1)
    misiles = (arma.get("MissileStats") or {}).get("NumberOfMissiles", 0)
    disparos = arma.get("NumberOfTimesToFire") or 1
    return estadisticas, (misiles or proyectil.get("NumberOfProjectiles") or 1) * disparos, (misiles or 1) * disparos


def arma_de_unidad(id_arma, arma, items):
    """El arma en el formato de items.json, para calcular su daño y DPS como en el MechLab.

    Las que se pueden montar en un 'Mech salen de items.json, en su nivel (_Lvl0 es el tier 0); las
    de vehículos, torretas y Elementals, de sus propias estadísticas.
    """
    nivel = REGEX_NIVEL.search(id_arma)
    base = REGEX_NIVEL.sub("", id_arma)
    if base in items:
        item = {clave: valor for clave, valor in items[base].items() if clave != "id"}
        tier = nivel.group(1) if nivel else "1"
        item["tiers"] = {tier: items[base]["tiers"][tier]}
        return {**item, "id": id_arma, "tier": tier}
    estadisticas, proyectiles, calor = estadisticas_de_arma(arma)
    # El tipo y la tecnología, del arma de 'Mech con el mismo nombre (el AC/5 del Scorpion es un AC/5).
    pariente = next((item for item in items.values() if item["type"] == "weapon" and item["name"] == arma["Name"]), {})
    item = {"id": id_arma, "name": arma["Name"], "type": "weapon", "weaponType": pariente.get("weaponType"),
            "size": pariente.get("size", "small"), "tonnage": 0, "tiers": {"1": estadisticas},
            "volleyProjectiles": proyectiles, "volleyHeatShots": calor, "tier": "1"}
    if pariente.get("techBase"):
        item["techBase"] = pariente["techBase"]
    return item


def leer_json(nombre, por_defecto=None):
    ruta = os.path.join(RUTA_UNIDADES, nombre)
    if por_defecto is not None and not os.path.exists(ruta):
        return por_defecto
    with open(ruta, encoding="utf-8") as archivo:
        return json.load(archivo)


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)
    blueprints, armas_juego, nombres_faccion = leer_json("unidades.json"), leer_json("armas.json"), leer_json("facciones.json")
    # Página y dibujo de Sarna de cada título, de imagenes_sarna.py.
    sarna = leer_json("sarna.json", {})
    with open(os.path.normpath(RUTA_ITEMS), encoding="utf-8") as archivo:
        items = json.load(archivo)

    unidades, avisos = [], []
    for archivo in sorted(os.listdir(RUTA_UNIT_CARDS)):
        contenido = leer_archivo(os.path.join(RUTA_UNIT_CARDS, archivo))
        etiqueta, clase = REGEX_TIPO.search(contenido), REGEX_CLASE.search(contenido)
        if not etiqueta or not clase or etiqueta.group(1).startswith("UnitType.Mech"):
            continue
        id_unidad = os.path.splitext(archivo)[0]
        if not se_muestra(id_unidad):
            continue
        blueprint = blueprints.get(clase.group(1))
        if blueprint is None:
            avisos.append(f"{id_unidad}: sin blueprint extraído ({clase.group(1)})")
            continue
        # La unit card de la Battle Armor no tiene nombre: vale el que enseña el juego al fijar el blanco.
        nombre = REGEX_NOMBRE.search(contenido)
        nombre = nombre.group(1) if nombre else blueprint.get("objetivo")
        if not nombre:
            avisos.append(f"{id_unidad}: sin nombre")
            continue
        tipo = tipo_de_unidad(etiqueta.group(1), blueprint)
        if tipo is None:
            avisos.append(f"{id_unidad}: tipo de unidad desconocido ({etiqueta.group(1)})")
            continue
        rol = REGEX_ROL.search(contenido)
        unidad = {
            "id": id_unidad.removesuffix("_UnitCard"),
            "name": nombre,
            "kind": tipo,
            "role": ROLES_DE_UNIDAD.get(rol.group(1).lower(), separar_palabras(rol.group(1))) if rol else None,
            "tier": int(REGEX_TIER.search(contenido).group(1)),
            "battleValue": int(REGEX_VALOR.search(contenido).group(1)),
            "introYear": int(REGEX_FECHA.search(contenido).group(1)),
            "hitPoints": blueprint["vida"],
            "speed": round(blueprint["velocidad"] * CM_S_A_KM_H, 1) if blueprint["velocidad"] else None,
            "weapons": [{"id": arma, "count": cantidad} for arma, cantidad in Counter(blueprint["armas"]).items()],
            "rarity": {faccion: RAREZAS[nivel] for faccion, nivel in sorted(REGEX_RAREZA.findall(contenido))},
        }
        if blueprint.get("escuadra"):
            unidad["squad"] = blueprint["escuadra"]
        titulo = titulo_sarna(etiqueta.group(1), nombre)
        if titulo in sarna:
            unidad["sarna"] = sarna[titulo]
        elif titulo:
            avisos.append(f"{id_unidad}: falta {titulo} en sarna.json (python3 tools/imagenes_sarna.py)")
        if not unidad["weapons"]:
            avisos.append(f"{id_unidad}: sin armas")
        unidades.append(unidad)

    usadas = sorted({arma["id"] for unidad in unidades for arma in unidad["weapons"]})
    armas = {arma: arma_de_unidad(arma, armas_juego[arma], items) for arma in usadas}
    facciones = sorted({faccion for unidad in unidades for faccion in unidad["rarity"]})
    datos = {
        "factions": {faccion: nombres_faccion.get(faccion) or separar_palabras(faccion) for faccion in facciones},
        "weapons": armas,
        "units": sorted(unidades, key=lambda unidad: (unidad["name"], unidad["id"])),
    }
    with open(ruta_destino, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, indent=1, ensure_ascii=False)
        archivo.write("\n")

    print(f"{len(unidades)} unidades, {len(armas)} armas y {len(facciones)} facciones en {ruta_destino}")
    print(", ".join(f"{tipo}: {cantidad}" for tipo, cantidad in sorted(Counter(unidad["kind"] for unidad in unidades).items())))
    for aviso in avisos:
        print(f"Aviso: {aviso}")


if __name__ == "__main__":
    main()
