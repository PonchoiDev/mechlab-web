import json
import os
import sys

from extraer_mapa import CONTENIDO, PAK_DEL_JUEGO, fecha_de_ticks, sin_extension, tiene_uexp
from ue4 import Asset, Pak

# Extrae del .pak de la instalación los rasgos de piloto del DLC7 (afinidades de chasis, expertos en
# armas, facciones, rasgos hero…) con sus textos y las cifras de cada componente, y los guarda en
# tools/datos-juego/pilotos/rasgos.json. Después, generar_pilotos.py trabaja con este archivo sin
# tocar el juego.
#
#   python3 tools/extraer_pilotos.py "/ruta/a/MechWarrior 5 Mercenaries"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "pilotos")
RASGOS = CONTENIDO + "DLC7/TOIs/PilotTraining/PilotTraits/"
# Propiedades de los componentes que no son cifras ni textos de un efecto.
IGNORADAS = {"UnitTraits", "MechType"}


class Textos:
    """Lee las StringTables a medida que aparecen claves suyas."""

    def __init__(self, pak):
        self.pak = pak
        self.tablas = {}

    def __call__(self, valor):
        if not isinstance(valor, dict) or "tabla" not in valor:
            return valor
        ruta = valor["tabla"].split(".")[0]
        if ruta not in self.tablas:
            self.tablas[ruta] = Asset.desde_pak(self.pak, CONTENIDO + ruta[len("/Game/"):]).textos(ruta.rsplit("/", 1)[1])
        return self.tablas[ruta].get(valor["clave"])


def faccion(entrada):
    """Id de la facción de una entrada de FactionsNobleWith, HatedFactions…"""
    for clave, valor in entrada.items():
        if clave.startswith("FactionId") and isinstance(valor, dict):
            return valor["Id"]["PrimaryAssetName"]
    return None


def limpiar(asset, textos, propiedades):
    """Las propiedades de un componente, con los quirks y las facciones por su nombre."""
    resultado = {}
    for clave, valor in propiedades.items():
        if clave in IGNORADAS:
            continue
        if clave == "WeaponQuirks":
            # Mapa de etiqueta de arma a sus quirks: [[Weapon.Missile, [[RangePercentage_Quirk, 0.05], …]], …].
            resultado[clave] = [[etiqueta.get("TagName"), [[asset.ruta_import(quirk["Quirk"])[1].removesuffix("_C"), quirk["Value"]]
                                                          for quirk in (quirks or {}).get("QuirkList", [])]]
                                for etiqueta, quirks in valor]
        elif clave == "QuirkSet":
            resultado["Quirks"] = [[asset.ruta_import(quirk["Quirk"])[1].removesuffix("_C"), quirk["Value"]]
                                   for quirk in (valor or {}).get("QuirkList", [])]
        elif clave.endswith("QuirkInfo") and isinstance(valor, dict):
            resultado[clave] = [asset.ruta_import(valor["Quirk"])[1].removesuffix("_C"), valor["Value"]]
        elif isinstance(valor, list) and valor and isinstance(valor[0], dict):
            resultado[clave] = [faccion(entrada) for entrada in valor]
        elif isinstance(valor, (int, float, str, list)) or (isinstance(valor, dict) and "tabla" in valor):
            resultado[clave] = textos(valor)
    return resultado


def leer_rasgo(pak, textos, ruta):
    asset = Asset.desde_pak(pak, ruta)
    # El objeto principal es el que tiene nombre de rasgo; su nombre no siempre coincide con el del
    # archivo (Affinity_BlackHawk en Affinity_Blackhawk).
    leidos = {}
    for export in asset.exports:
        try:
            leidos[export] = asset.propiedades(export)
        except (IndexError, KeyError, ValueError):
            continue
    principal = next((export for export, propiedades in leidos.items() if "PilotTraitName" in propiedades), None)
    if principal is None:
        raise ValueError(f"{ruta} no tiene un rasgo de piloto")
    datos = leidos[principal]
    # Los componentes que usa el rasgo cuelgan de su UnitTrait y, dentro, de los UnitTraits de cada uno.
    # El asset puede traer otros que no se usan (Trigger Discipline repite sus quirks en uno suelto).
    componentes, pendientes, vistos = [], [datos.get("UnitTrait")], set()
    while pendientes:
        referencia = pendientes.pop(0)
        if not isinstance(referencia, int) or referencia <= 0 or referencia in vistos:
            continue
        vistos.add(referencia)
        export = asset.orden[referencia - 1]
        propiedades = leidos.get(export, {})
        pendientes.extend(propiedades.get("UnitTraits") or [])
        clase = asset.ruta_import(asset.clases[export][0])[1] if asset.clases[export][0] < 0 else export
        componentes.append({"clase": clase.removesuffix("_C"), **limpiar(asset, textos, propiedades)})
    return {
        "id": principal,
        "carpeta": ruta[len(RASGOS):].rsplit("/", 1)[0] if "/" in ruta[len(RASGOS):] else "",
        "nombre": textos(datos.get("PilotTraitName")),
        "corta": textos(datos.get("PilotTraitShortDescription")),
        "larga": textos(datos.get("PilotTraitLongDescription")),
        "fecha": fecha_de_ticks(datos["AvailableDate"]) if datos.get("AvailableDate") else None,
        "atributos": datos.get("Attributes", []),
        "componentes": [componente for componente in componentes if len(componente) > 1],
    }


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 tools/extraer_pilotos.py <carpeta del juego>")
        sys.exit(1)
    pak = Pak(os.path.join(sys.argv[1], PAK_DEL_JUEGO))
    textos = Textos(pak)
    rasgos = []
    for ruta in sorted(pak.buscar(RASGOS)):
        if ruta.endswith(".uasset") and "/_common/" not in ruta and tiene_uexp(pak, ruta):
            rasgos.append(leer_rasgo(pak, textos, sin_extension(ruta)))
    sin_nombre = [rasgo["id"] for rasgo in rasgos if not rasgo["nombre"]]
    if sin_nombre:
        raise ValueError(f"Rasgos sin nombre: {', '.join(sin_nombre)}: ¿ha cambiado el juego?")
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    with open(os.path.join(RUTA_DESTINO, "rasgos.json"), "w", encoding="utf-8") as archivo:
        archivo.write("[\n" + ",\n".join(json.dumps(rasgo, ensure_ascii=False) for rasgo in rasgos) + "\n]\n")
    print(f"{len(rasgos)} rasgos de piloto en {RUTA_DESTINO}")


if __name__ == "__main__":
    main()
