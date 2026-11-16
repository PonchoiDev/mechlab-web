import json
import os
import sys

from battletech import DATOS, leer_carpeta, leer_json_texto
from unityfs import textos_del_bundle

# Extrae de la instalación de BATTLETECH los vehículos y las torretas que salen en los contratos: su
# definición (blindaje y armas), su chasis (tonelaje, clase, estructura y tipo de movimiento) y el
# movimiento. El juego base trae JSON sueltos; Heavy Metal y Urban Warfare añaden vehículos en sus
# bundles de Unity. Lo deja en tools/datos-juego/battletech/unidades/ con la fuente de cada cosa, y
# generar_unidades_battletech.py trabaja con esos archivos sin tocar el juego.
#
#   python3 tools/extraer_unidades_battletech.py "/ruta/a/BATTLETECH"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "unidades")
# Flashpoint no trae vehículos; se lee igual por si una versión del juego los añade.
DLC = {"heavymetal": "heavymetal", "flashpoint": "flashpoint", "urbanwarfare": "urbanwarfare"}
PREFIJOS = {"vehicledef_": "vehiculos", "vehiclechassisdef_": "chasis", "turretdef_": "torretas",
            "turretchassisdef_": "chasis_torretas", "movedef_": "movimiento"}
CARPETAS = {"vehicle": "vehiculos", "vehicleChassis": "chasis", "turrets": "torretas",
            "turretChassis": "chasis_torretas", "movement": "movimiento"}
# Lo que se descarta: posiciones de la línea de visión, prefabs y lo que solo usa el motor.
CAMPOS_FUERA = {"LOSSourcePositions", "LOSTargetPositions", "PrefabIdentifier", "PrefabBase",
                "PathingCapDefID", "HardpointDataDefID", "Radius", "SpotterDistanceMultiplier",
                "VisibilityMultiplier", "SensorRangeMultiplier", "Signature"}
CAMPOS_FUERA_INVENTARIO = {"SimGameUID", "GUID", "DamageLevel", "prefabName", "hasPrefabName"}


def limpiar(objeto):
    limpio = {clave: valor for clave, valor in objeto.items() if clave not in CAMPOS_FUERA}
    if "inventory" in limpio:
        limpio["inventory"] = [{c: v for c, v in pieza.items() if c not in CAMPOS_FUERA_INVENTARIO}
                               for pieza in limpio["inventory"] or []]
    return limpio


def es_plantilla(nombre):
    return "template" in nombre.lower()


def main():
    if len(sys.argv) != 2:
        print('Uso: python3 tools/extraer_unidades_battletech.py "<carpeta del juego>"')
        sys.exit(1)
    juego = sys.argv[1]
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    datos = {destino: {} for destino in PREFIJOS.values()}

    for carpeta, destino in CARPETAS.items():
        for id_, objeto in leer_carpeta(juego, carpeta).items():
            if not es_plantilla(id_):
                datos[destino][id_] = {"fuente": "base", **limpiar(objeto)}
    for bundle, fuente in DLC.items():
        for nombre, contenido in sorted(textos_del_bundle(os.path.join(juego, DATOS, "assetbundles", bundle)).items()):
            destino = next((d for prefijo, d in PREFIJOS.items() if nombre.startswith(prefijo)), None)
            if destino is None or es_plantilla(nombre):
                continue
            # Si un id está en el juego base y en un DLC, manda el base.
            datos[destino].setdefault(nombre, {"fuente": fuente, **limpiar(leer_json_texto(contenido))})

    # Del movimiento solo cuentan las distancias de andar y correr, y solo las de vehículos y torretas.
    usados = {c.get("MovementCapDefID") for clave in ("chasis", "chasis_torretas") for c in datos[clave].values()}
    datos["movimiento"] = {id_: {"MaxWalkDistance": m.get("MaxWalkDistance"), "MaxSprintDistance": m.get("MaxSprintDistance")}
                           for id_, m in datos["movimiento"].items() if id_ in usados}

    for destino, contenido in datos.items():
        with open(os.path.join(RUTA_DESTINO, f"{destino}.json"), "w", encoding="utf-8") as archivo:
            json.dump(contenido, archivo, ensure_ascii=False, indent=1, sort_keys=True)
            archivo.write("\n")
    print(" · ".join(f"{destino}: {len(contenido)}" for destino, contenido in datos.items()))


if __name__ == "__main__":
    main()
