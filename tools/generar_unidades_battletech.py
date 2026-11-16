import json
import os
import sys
from collections import Counter

# Genera src/data/battletech/units.json, los vehículos y las torretas de BATTLETECH que salen en los
# contratos, a partir de lo que extraer_unidades_battletech.py dejó en
# tools/datos-juego/battletech/unidades/. Las armas se citan por id: sus estadísticas están en
# src/data/battletech/items.json (generar_mechlab_battletech.py), que tiene que ir antes.
#
#   python3 tools/generar_unidades_battletech.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "unidades")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "battletech")

# BLACKLISTED saca del juego los muñecos de prácticas, el camión de munición, los drones de la Liga Estelar
# y las versiones blindadas del cuartel móvil y del Swift Wind: no salen en ningún contrato al azar.
ETIQUETA_VETADA = "BLACKLISTED"
CLASES = {"unit_light": "light", "unit_medium": "medium", "unit_heavy": "heavy", "unit_assault": "assault"}
MOVIMIENTOS = {"Tracked": "tracked", "Wheeled": "wheeled"}
UBICACIONES = {"Front": "front", "Left": "left", "Right": "right", "Rear": "rear", "Turret": "turret"}
# Los transportes, el cuartel móvil y el Swift Wind son objetivos de escolta o de caza: unit_noncombatant.
ETIQUETA_NO_COMBATIENTE = "unit_noncombatant"

# Página de Sarna de cada chasis, por el principio del id del vehículo (sin «vehicledef_»). El juego no
# las trae. Las variantes de los DLC comparten la de su chasis (el Scorpion Mk II, la del Scorpion) y
# el Inferno Carrier es un SRM Carrier con munición incendiaria. Sin página: el Alsvin y el Arvakr,
# transportes que Sarna no recoge, y las torretas.
TITULOS_SARNA = {
    "MANTICORE": "Manticore", "SCORPION": "Scorpion (Combat Vehicle)", "BULLDOG": "Bulldog Medium Tank",
    "DEMOLISHER": "Demolisher", "SCHREK": "Schrek", "CARRIER_LRM": "LRM Carrier", "CARRIER_SRM": "SRM Carrier",
    "CARRIER_Inferno": "SRM Carrier", "GALLEON": "Galleon", "STRIKER": "Striker (Combat Vehicle)",
    "SWIFTWIND": "Swift Wind", "PACKRAT": "Packrat", "ROTUNDA": "Rotunda", "GALLANT": "Gallant (Combat Vehicle)",
    "MOBILEHQ": "Mobile HQ", "APC_Wheeled": "Wheeled APC", "APC_Vargr": "Vargr", "APC_Sleipnir": "Sleipnir (Combat Vehicle)",
}


def leer(nombre, defecto=None):
    ruta = os.path.join(RUTA_ORIGEN, nombre)
    if defecto is not None and not os.path.exists(ruta):
        return defecto
    with open(ruta, encoding="utf-8") as archivo:
        return json.load(archivo)


def titulo_sarna(id_):
    clave = id_.removeprefix("vehicledef_")
    # Gana el principio más largo: CARRIER_Inferno antes que CARRIER_.
    for prefijo in sorted(TITULOS_SARNA, key=len, reverse=True):
        if clave == prefijo or clave.startswith(prefijo + "_"):
            return TITULOS_SARNA[prefijo]
    return None


def contar(inventario, tipos):
    cuenta = Counter(pieza["ComponentDefID"] for pieza in inventario if pieza["ComponentDefType"] in tipos)
    return [{"id": id_, "count": n} for id_, n in sorted(cuenta.items())]


def clase(etiquetas):
    clases = [CLASES[e] for e in etiquetas if e in CLASES]
    if len(clases) != 1:
        raise ValueError(f"Se esperaba una sola clase de peso en {etiquetas}")
    return clases[0]


def unidad_comun(id_, definicion, etiquetas, catalogo, avisos):
    inventario = definicion.get("inventory") or []
    for pieza in inventario:
        if pieza["ComponentDefID"] not in catalogo:
            avisos.append(f"{id_}: {pieza['ComponentDefID']} no está en items.json")
    return {
        "id": id_,
        "name": definicion["Description"]["Name"],
        "source": definicion["fuente"],
        "weightClass": clase(etiquetas),
        "noncombatant": ETIQUETA_NO_COMBATIENTE in etiquetas,
        "weapons": contar(inventario, {"Weapon"}),
        "ammo": contar(inventario, {"AmmunitionBox"}),
        "equipment": contar(inventario, {"Upgrade", "HeatSink", "JumpJet"}),
    }


def main():
    vehiculos, chasis = leer("vehiculos.json"), leer("chasis.json")
    torretas, chasis_torretas = leer("torretas.json"), leer("chasis_torretas.json")
    movimiento = leer("movimiento.json")
    sarna = leer("sarna.json", {})
    with open(os.path.join(RUTA_DESTINO, "items.json"), encoding="utf-8") as archivo:
        catalogo = {item["id"] for item in json.load(archivo)}
    unidades, avisos = [], []

    for id_, vehiculo in sorted(vehiculos.items()):
        etiquetas = (vehiculo.get("VehicleTags") or {}).get("items") or []
        if ETIQUETA_VETADA in etiquetas:
            continue
        c = chasis[vehiculo["ChassisID"]]
        # El blindaje es el que lleva la definición; la estructura, la del chasis, como en los 'Mechs.
        estructura = {u["Location"]: u["InternalStructure"] for u in c["Locations"]}
        mov = movimiento.get(c["MovementCapDefID"]) or {}
        unidad = {
            **unidad_comun(id_, vehiculo, etiquetas, catalogo, avisos),
            "kind": MOVIMIENTOS[c["movementType"]],
            "tonnage": c["Tonnage"],
            "locations": [{"location": UBICACIONES[u["Location"]], "armor": u["AssignedArmor"],
                           "structure": estructura[u["Location"]]} for u in vehiculo["Locations"]],
            "walk": mov.get("MaxWalkDistance"),
            "sprint": mov.get("MaxSprintDistance"),
        }
        titulo = titulo_sarna(id_)
        if titulo:
            if titulo in sarna:
                unidad["sarna"] = sarna[titulo]
            else:
                avisos.append(f"{id_}: falta {titulo} en sarna.json (python3 tools/imagenes_sarna_battletech.py)")
        unidades.append(unidad)

    for id_, torreta in sorted(torretas.items()):
        etiquetas = (torreta.get("TurretTags") or {}).get("items") or []
        if ETIQUETA_VETADA in etiquetas:
            continue
        c = chasis_torretas[torreta["ChassisID"]]
        unidades.append({
            **unidad_comun(id_, torreta, etiquetas, catalogo, avisos),
            "kind": "turret",
            # El tonelaje del chasis de las torretas (75 o 100) no sale en el juego ni cuenta para nada.
            "tonnage": None,
            "locations": [{"location": "body", "armor": torreta["AssignedArmor"], "structure": c["MaxInternalStructure"]}],
            "walk": None,
            "sprint": None,
        })

    with open(os.path.join(RUTA_DESTINO, "units.json"), "w", encoding="utf-8") as archivo:
        json.dump({"units": unidades}, archivo, ensure_ascii=False, indent=1)
        archivo.write("\n")
    tipos = Counter(u["kind"] for u in unidades)
    print(f"{len(unidades)} unidades: " + ", ".join(f"{n} {tipo}" for tipo, n in sorted(tipos.items())))
    for aviso in avisos:
        print(f"Aviso: {aviso}")
    if any("items.json" in aviso for aviso in avisos):
        sys.exit(1)


if __name__ == "__main__":
    main()
