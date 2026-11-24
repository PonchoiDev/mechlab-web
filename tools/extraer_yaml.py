import glob
import json
import os
import shutil
import sys

from kismet import base, desensamblar, etiqueta, id_de_asset, recorrer, ultimo_nombre
from ue4 import Asset, Pak

# Extrae de los mods de Yet Another Mechlab (YAML) del Workshop de Steam los datos que necesita el
# MechLab con sus reglas: 'Mechs (MDA, loadouts, anclajes y modelos), armas, munición, equipo, tipos de
# ranura y las tablas de estadísticas de las armas, más las reglas de tamaño de las armas que YAML
# aplica desde su blueprint (reglas.json). Lo guarda en tools/datos-juego/yaml/, un archivo por
# mod y categoría, para que los generadores trabajen sin tocar la instalación. Esa carpeta no se sube al
# repositorio (.gitignore): los datos son de los autores de los mods y cada uno la regenera desde su
# Workshop.
#
#   python3 tools/extraer_yaml.py "/ruta/a/steamapps/workshop/content/784080" "/ruta/a/MechWarrior 5 Mercenaries"
#
# Los mods del juego base se cocinan con el editor de modding y se montan encima del juego: un asset con
# la misma ruta que uno del juego (o de un mod con menor prioridad) lo sustituye. Por eso cada asset se
# guarda con su ruta montada (/Game/..., o /<Plugin>/... si es del propio mod), que es la que lo identifica
# al aplicar esas sustituciones.
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "yaml")

# Mods que forman el conjunto de YAML en el Workshop: id de Steam y carpeta de destino.
# YetAnotherClanMech (2815252243) no está: declara la versión 1.1.0 del juego y con la actual cierra el
# juego al empezar una carrera, así que sus 'Mechs no se pueden comprobar en el mechlab del juego.
MODS = {
    "2549720490": "yet-another-mechlab",
    "2512405187": "yet-another-weapon",
    "2512385719": "yet-another-weapon-clan",
    "2734262706": "yet-another-equipment-collection",
}

# Categoría de destino según la clase del asset. YAML monta el motor, la estructura, la armadura, el
# giroscopio y casi todo su equipo nuevo como disipadores (MWHeatSinkDataAsset), así que van en "equipo"
# junto al resto de clases de equipo del juego.
CATEGORIAS = {
    "MWMechDataAsset": "mechs",
    "MWMechLoadoutAsset": "loadouts",
    "MWMechHardpointAsset": "anclajes",
    "MWMechModelDataAsset": "modelos",
    "MWUnitCardAsset": "fichas",
    "MWAmmoDataAsset": "municion",
    "MWSlotTypeDataAsset": "ranuras",
    "MWHeatSinkDataAsset": "equipo",
    "MWJumpJetDataAsset": "equipo",
    "MWECMDataAsset": "equipo",
    "MWBAPDataAsset": "equipo",
    "MWMASCDataAsset": "equipo",
    "MWTargetingComputerDataAsset": "equipo",
    "MWMechTraitDataAsset": "equipo",
    "MWTechBaseRequirementDataAsset": "tecnologia",
    "DataTable": "tablas",
}
SUFIJO_ARMA = "WeaponDataAsset"
# Tablas que no son del mechlab: noticias, historial de versiones, iconos y filtros de la interfaz,
# generadores de escenarios y vehículos. Las de noticias, además, no siguen el formato de filas.
TABLAS_IGNORADAS = ("NewsFeed", "VersionLog", "Icons", "Filters", "/LevelGenerators/", "/Tanks/")
# YAML no guarda en datos el tamaño en ranuras de las armas del juego: al arrancar, dos funciones de
# este blueprint cambian el tamaño de los tipos de ranura del juego base (el AC/10 pasa de 4 a 7, como
# en el juego de mesa) y asignan a las armas de los DLC tipos de ranura propios. Se leen de su bytecode.
# Del juego base solo hacen falta los tipos de ranura: YAML los usa en sus anclajes y en sus 'Mechs
# (115 de 130 no están en los mods) y cambia su tamaño al arrancar. Las armas y el equipo del juego ya
# están en tools/datos-juego/items/.
PAK_DEL_JUEGO = os.path.join("MW5Mercs", "Content", "Paks", "MW5Mercs-WindowsNoEditor.pak")
CONTENIDO_DEL_JUEGO = "MW5Mercs/Content/"
CARPETA_DEL_JUEGO = "juego"
BLUEPRINT_DE_REGLAS = "Plugins/YetAnotherMechlab/Content/Functions/EquipmentUtilities"
FUNCION_TAMANOS_DE_RANURAS = "Fix Vanilla SlotTypes Sizes"
FUNCION_RANURAS_DE_ARMAS = "Fix Vanilla Weapon Sizes"
# Las listas de armas de un bloque que no termina en una regla (p. ej. las que solo cambian de DLC) no
# deben pasar a la regla siguiente.
PROPIEDADES_QUE_CIERRAN_BLOQUE = ("AssociatedDLC",)
# Los archivos de Resources que lee YAML de cada mod activo (equipo, armas, quirks y su asignación).
EXTENSIONES_RECURSOS = (".json",)


def ruta_montada(ruta):
    """Content/X del .pak se monta en /Game/X (MW5Mercs/Content/X en el del juego); Plugins/<Mod>/Content/X, en /<Mod>/X."""
    sin_extension = ruta[: -len(".uasset")]
    for prefijo in ("Content/", CONTENIDO_DEL_JUEGO):
        if sin_extension.startswith(prefijo):
            return "/Game/" + sin_extension[len(prefijo):]
    partes = sin_extension.split("/")
    if partes[0] == "Plugins" and len(partes) > 3 and partes[2] == "Content":
        return "/" + partes[1] + "/" + "/".join(partes[3:])
    return "/" + sin_extension


def clase_principal(asset, nombre):
    """El export que da nombre al asset y el nombre de su clase (las tablas son exports sin blueprint)."""
    export = nombre if nombre in asset.clases else asset.principal()
    clase = asset.clases[export][0]
    return export, (asset.imports[-clase - 1][0] if clase < 0 else None)


def categoria(clase):
    if clase is None:
        return None
    if clase.endswith(SUFIJO_ARMA):
        return "armas"
    return CATEGORIAS.get(clase)


def extraer_pak(ruta_pak, solo=None):
    """Los assets de las categorías que interesan; con solo, únicamente los de esas categorías."""
    pak = Pak(ruta_pak)
    resultado = {}
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or ruta[: -len(".uasset")] + ".uexp" not in pak.archivos:
            continue
        nombre = ruta[: -len(".uasset")].rsplit("/", 1)[1]
        # La cabecera basta para saber la clase: el .uexp solo se lee si el asset interesa.
        export, clase = clase_principal(Asset(pak.leer_archivo(ruta), b""), nombre)
        destino = categoria(clase)
        if destino is None or (solo and destino not in solo) or (clase == "DataTable" and any(texto in ruta for texto in TABLAS_IGNORADAS)):
            continue
        asset = Asset.desde_pak(pak, ruta[: -len(".uasset")])
        if clase == "DataTable":
            valor = {"filas": asset.filas(export)}
        else:
            valor = {"clase": clase, "propiedades": limpiar(destino, asset.propiedades(export, rutas=True))}
        resultado.setdefault(destino, {})[ruta_montada(ruta)] = valor
    return resultado


def limpiar(destino, propiedades):
    """Quita lo que solo afecta a la parte visual o a la interfaz; es la mayor parte del tamaño."""
    if destino == "mechs" and "MechData" in propiedades and "MutableMechData" in propiedades:
        # Las dos copias coinciden salvo las referencias a las tablas de estadísticas y, en unos pocos
        # 'Mechs, el equipo interno: de MechData basta con lo que cambia.
        mutable = propiedades["MutableMechData"]
        propiedades["MechData"] = {clave: valor for clave, valor in propiedades["MechData"].items() if mutable.get(clave) != valor}
        for datos in (propiedades["MechData"], mutable):
            # Tiempos de arranque de los actuadores al encender el 'Mech.
            datos.get("MechDataStats", {}).pop("PowerStats", None)
    elif destino == "anclajes":
        # Cada anclaje trae el blueprint del arma que se ve montada para cada tipo de arma; basta con los
        # tipos.
        for anclaje in propiedades.get("MechHardpoints", {}).get("WeaponSlots", []):
            if "HardpointVisuals" in anclaje:
                anclaje["HardpointVisuals"] = [etiqueta for etiqueta, _ in anclaje["HardpointVisuals"]]
    elif destino == "loadouts":
        for campo in ("WeaponGroupInfo", "SkinCustomization"):
            propiedades.get("MechLoadout", {}).pop(campo, None)
    return propiedades


def tamanos_de_tipos_de_ranura(sentencias):
    """Reglas "si el tipo de ranura se llama A o B, su tamaño pasa a N", en el orden en que se aplican."""
    reglas = []
    nombres = []
    for sentencia in sentencias:
        for nodo in recorrer(sentencia):
            if nodo[0] == "call" and nodo[1] == "EqualEqual_StrStr":
                nombres.extend(argumento[1] for argumento in nodo[2] if argumento[0] == "str")
        if sentencia[0] == "let" and ultimo_nombre(sentencia[1]) == "SlotSize":
            if sentencia[2][0] != "int" or not nombres:
                raise ValueError(f"Regla de tamaño de ranura que no se entiende: {sentencia}")
            reglas.append({"tiposDeRanura": nombres, "ranuras": sentencia[2][1]})
            nombres = []
    return reglas


def ranuras_de_armas(sentencias):
    """Reglas "las armas X (o con la etiqueta T) usan el tipo de ranura R", en orden."""
    tipos_de_ranura = {}
    armas = []
    etiquetas = []
    reglas = []
    for sentencia in sentencias:
        for nodo in recorrer(sentencia):
            if nodo[0] == "call" and nodo[1] == "HasTag":
                nombres = [etiqueta(argumento) for argumento in nodo[2]]
                exacta = [argumento[1] for argumento in nodo[2] if argumento[0] == "bool"]
                etiquetas.extend({"etiqueta": nombre, "exacta": exacta == [True]} for nombre in nombres if nombre)
        if sentencia[0] != "let":
            continue
        destino, valor = sentencia[1], sentencia[2]
        asignado = ultimo_nombre(destino)
        identificador = id_de_asset(valor)
        if identificador and asignado == "Id":
            if identificador[0] == "MWSlotTypeDataAsset":
                tipos_de_ranura[base(destino)] = identificador[1]
            elif identificador[0].endswith("WeaponDataAsset"):
                armas.append(identificador[1])
        elif valor[0] == "array":
            armas.extend(i[1] for i in map(id_de_asset, valor[1]) if i and i[0].endswith("WeaponDataAsset"))
        elif asignado == "WeaponSlotTypeAssetId" and valor[0] == "variable" and valor[2] in tipos_de_ranura:
            if not armas and not etiquetas:
                raise ValueError(f"Regla de ranuras de armas sin armas: {sentencia}")
            # Las listas se repiten dentro y fuera de los bucles del blueprint.
            reglas.append({
                "armas": list(dict.fromkeys(armas)),
                "etiquetas": [dict(t) for t in dict.fromkeys(tuple(e.items()) for e in etiquetas)],
                "tipoDeRanura": tipos_de_ranura[valor[2]],
            })
            armas, etiquetas = [], []
        elif asignado in PROPIEDADES_QUE_CIERRAN_BLOQUE:
            armas, etiquetas = [], []
    return reglas


def extraer_reglas(ruta_pak):
    pak = Pak(ruta_pak)
    if BLUEPRINT_DE_REGLAS + ".uasset" not in pak.archivos:
        return None
    asset = Asset.desde_pak(pak, BLUEPRINT_DE_REGLAS)
    return {
        "tamanosDeTiposDeRanura": tamanos_de_tipos_de_ranura(desensamblar(asset, FUNCION_TAMANOS_DE_RANURAS)),
        "ranurasDeArmas": ranuras_de_armas(desensamblar(asset, FUNCION_RANURAS_DE_ARMAS)),
    }


def escribir(ruta, datos):
    # Una entrada por línea: los archivos son grandes y así los cambios entre versiones del mod se leen
    # en el diff.
    lineas = [f"{json.dumps(clave)}: {json.dumps(datos[clave], ensure_ascii=False, separators=(',', ':'))}" for clave in sorted(datos)]
    with open(ruta, "w", encoding="utf-8") as archivo:
        archivo.write("{\n" + ",\n".join(lineas) + "\n}\n")


def extraer_mod(carpeta_mod, destino):
    with open(os.path.join(carpeta_mod, "mod.json"), encoding="utf-8-sig") as archivo:
        info = json.load(archivo)
    if os.path.isdir(destino):
        shutil.rmtree(destino)
    os.makedirs(destino)

    categorias = {}
    for ruta_pak in sorted(glob.glob(os.path.join(carpeta_mod, "Paks", "*.pak"))):
        for nombre, assets in extraer_pak(ruta_pak).items():
            categorias.setdefault(nombre, {}).update(assets)
    for nombre, assets in categorias.items():
        escribir(os.path.join(destino, nombre + ".json"), assets)

    reglas = None
    for ruta_pak in sorted(glob.glob(os.path.join(carpeta_mod, "Paks", "*.pak"))):
        reglas = extraer_reglas(ruta_pak) or reglas
    if reglas:
        with open(os.path.join(destino, "reglas.json"), "w", encoding="utf-8") as archivo:
            json.dump(reglas, archivo, ensure_ascii=False, indent=2)
            archivo.write("\n")

    recursos = os.path.join(carpeta_mod, "Resources")
    copiados = []
    if os.path.isdir(recursos):
        os.makedirs(os.path.join(destino, "resources"))
        for archivo in sorted(os.listdir(recursos)):
            if archivo.lower().endswith(EXTENSIONES_RECURSOS):
                shutil.copyfile(os.path.join(recursos, archivo), os.path.join(destino, "resources", archivo))
                copiados.append(archivo)

    # La versión y el orden de carga del mod: el orden decide qué mod gana cuando dos traen el mismo asset.
    resumen = {
        "nombre": info.get("displayName"),
        "version": info.get("version"),
        "buildNumber": info.get("buildNumber"),
        "ordenDeCarga": info.get("defaultLoadOrder"),
        "versionDelJuego": info.get("gameVersion"),
        "categorias": {nombre: len(assets) for nombre, assets in sorted(categorias.items())},
        "recursos": copiados,
        "reglas": sorted(reglas) if reglas else [],
    }
    with open(os.path.join(destino, "mod.json"), "w", encoding="utf-8") as archivo:
        json.dump(resumen, archivo, ensure_ascii=False, indent=2)
        archivo.write("\n")
    return resumen


def extraer_juego(carpeta_juego, destino):
    ranuras = extraer_pak(os.path.join(carpeta_juego, PAK_DEL_JUEGO), solo={"ranuras"}).get("ranuras", {})
    os.makedirs(destino, exist_ok=True)
    escribir(os.path.join(destino, "ranuras.json"), ranuras)
    return len(ranuras)


def main():
    if len(sys.argv) != 3:
        print("Uso: python3 tools/extraer_yaml.py \"<steamapps/workshop/content/784080>\" \"<carpeta de MW5 Mercenaries>\"")
        sys.exit(1)
    carpeta, carpeta_juego = sys.argv[1], sys.argv[2]
    faltan = [id_mod for id_mod in MODS if not os.path.isdir(os.path.join(carpeta, id_mod))]
    if faltan:
        print("Faltan mods en el Workshop (suscríbete a ellos): " + ", ".join(faltan))
        sys.exit(1)
    for id_mod, nombre in MODS.items():
        resumen = extraer_mod(os.path.join(carpeta, id_mod), os.path.join(RUTA_DESTINO, nombre))
        categorias = ", ".join(f"{n} {c}" for n, c in resumen["categorias"].items())
        print(f"{resumen['nombre']} {resumen['version']}: {categorias}")
    total = extraer_juego(carpeta_juego, os.path.join(RUTA_DESTINO, CARPETA_DEL_JUEGO))
    print(f"Juego base: {total} tipos de ranura")


if __name__ == "__main__":
    main()
