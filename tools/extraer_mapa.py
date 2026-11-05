import datetime
import json
import os
import re
import struct
import sys
import zlib

from ue4 import Asset, Pak, leer_textura

# Extrae del .pak de la instalación los datos del mapa estelar y los guarda como JSON en
# tools/datos-juego/starmap/. Solo hace falta repetirlo cuando un parche cambie el mapa; después,
# generar_mapa.py trabaja con estos archivos sin tocar el juego.
#
#   python3 tools/extraer_mapa.py "/ruta/a/MechWarrior 5 Mercenaries"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "starmap")
# Los logos de facción se publican tal cual en la web, ya reducidos.
RUTA_LOGOS = os.path.join(DIRECTORIO_SCRIPT, "..", "public", "starmap", "logos")
TAMANO_LOGO = 128
PAK_DEL_JUEGO = os.path.join("MW5Mercs", "Content", "Paks", "MW5Mercs-WindowsNoEditor.pak")
CONTENIDO = "MW5Mercs/Content/"

TABLA_SISTEMAS = CONTENIDO + "InnerSphereData/MW5_InnerSphereData"
COLORES_MAPA = CONTENIDO + "UI/FrontEnd/Starmap/Materials/Factions/Faction_Colours_MPC"
EVENTOS = CONTENIDO + "Campaign/CampaignArcs/BorderChanges/"
CENTROS_INDUSTRIALES = CONTENIDO + "DLC1/CareerMode/Clusters/"
TABLAS_DE_TEXTO = [
    CONTENIDO + "Campaign/Clusters/_common/Faction_StringTable",
    CONTENIDO + "Factions/RivalMercs/RivalMercNames_StringTable",
]
# Carpetas de las misiones de alta recompensa (HRQ): de facción en campaña y en carrera, Heroes of
# the Inner Sphere (DLC1), DLC2, el Hatchetman (DLC3) y DLC8. La historia principal y los clústeres
# finales no son HRQ.
REGEX_MISIONES = re.compile(
    r"MW5Mercs/Content/(Campaign/CampaignArcs/Regions/\d+_\d+/|DLC1/CareerMode/Sidequests/|DLC2/Sidequests/"
    r"|DLC3/HatchetmanQuestData/|DLC8/CampaignData/Quest_)"
)
# Acciones de viaje, de mercado o de zona: tienen sistema, pero no son misiones.
REGEX_ACCION_IGNORADA = re.compile(r"(TravelTo|ReturnTo|Abandoned|CustomMarket|Zone$)")
REGEX_EVENTO = re.compile(r"BorderChanges/([^/]+)/(Borders[^/]+)\.uasset$")
REGEX_CENTRO = re.compile(r"Clusters/(SafeZone_\d+)/SafeZone_\d+_ClusterAsset\.uasset$")
# Las fechas de Unreal (FDateTime) son ticks de 100 ns desde el 1 de enero del año 1.
TICKS_POR_MICROSEGUNDO = 10


def ruta_de_juego(ruta):
    # /Game/Campaign/X.X apunta a MW5Mercs/Content/Campaign/X dentro del .pak.
    return CONTENIDO + ruta.split(".")[0][len("/Game/"):]


def sin_extension(ruta):
    return ruta[: -len(".uasset")]


def fecha_de_ticks(ticks):
    return (datetime.datetime(1, 1, 1) + datetime.timedelta(microseconds=ticks // TICKS_POR_MICROSEGUNDO)).date().isoformat()


def extraer_sistemas(pak):
    filas = Asset.desde_pak(pak, TABLA_SISTEMAS).filas("MW5_InnerSphereData")
    return [fila for _, fila in sorted(filas.items(), key=lambda par: int(par[0]))]


def facciones_usadas(sistemas):
    # El clúster de cada sistema también apunta a un MWFactionAsset, pero su nombre está en la tabla
    # de textos (Faction_StringTable) y no hace falta su asset.
    usadas = set()
    for sistema in sistemas:
        for cambio in sistema["FactionOwnershipChanges"]:
            usadas.add(cambio["FactionAssetId"]["Id"]["PrimaryAssetName"])
    return usadas - {"None"}


def clusteres_usados(sistemas):
    return {sistema["Cluster"]["Id"]["PrimaryAssetName"] for sistema in sistemas} - {"None"}


def extraer_por_nombre(pak, carpeta, usados, campos):
    # Facciones y clústeres son MWFactionAsset repartidos por varias carpetas: se buscan por nombre.
    # Hay otros assets que se llaman igual (el material Periphery del mapa), así que se queda el que
    # tiene las propiedades de una facción.
    candidatos = {}
    for ruta in pak.archivos:
        nombre = os.path.basename(ruta)[: -len(".uasset")]
        if carpeta in ruta and ruta.endswith(".uasset") and nombre in usados:
            candidatos.setdefault(nombre, []).append(sin_extension(ruta))
    assets = {}
    for nombre, rutas in sorted(candidatos.items()):
        for ruta in sorted(rutas):
            asset = Asset.desde_pak(pak, ruta)
            propiedades = asset.propiedades(nombre if nombre in asset.exports else asset.principal())
            if "FactionType" in propiedades:
                assets[nombre] = {clave: propiedades.get(clave) for clave in campos}
                break
    return assets, sorted(usados - set(assets))


def extraer_colores(pak):
    parametros = Asset.desde_pak(pak, COLORES_MAPA).propiedades("Faction_Colours_MPC")["VectorParameters"]
    return {parametro["ParameterName"]: parametro["DefaultValue"] for parametro in parametros}


def extraer_eventos(pak):
    eventos = []
    for ruta in pak.buscar(EVENTOS):
        coincidencia = REGEX_EVENTO.search(ruta)
        if not coincidencia or "Thumbnail" in ruta:
            continue
        carpeta, asset = coincidencia.groups()
        propiedades = Asset.desde_pak(pak, sin_extension(ruta)).propiedades(asset)
        # El cambio de 3015 es el estado inicial de la partida y no tiene fecha.
        if propiedades.get("StartDateOfBorderChange") is None:
            continue
        eventos.append({"carpeta": carpeta, "asset": asset, "fecha": fecha_de_ticks(propiedades["StartDateOfBorderChange"])})
    return sorted(eventos, key=lambda evento: evento["fecha"])


def vertices_de_malla(pak, ruta):
    """Posiciones (x, y) de una StaticMesh plana. Se busca la cabecera del buffer de posiciones
    (stride 12 y número de vértices, repetidos), que no siempre está alineada a 4 bytes."""
    datos = pak.leer_archivo(ruta + ".uexp")
    for inicio in range(len(datos) - 16):
        stride, total, tamano, total_bis = struct.unpack_from("<4i", datos, inicio)
        if stride == tamano == 12 and total == total_bis and 4 <= total < 100000:
            return [[round(valor, 1) for valor in struct.unpack_from("<2f", datos, inicio + 16 + 12 * i)] for i in range(total)]
    return None


def extraer_centros_industriales(pak):
    centros = {}
    for ruta in pak.buscar(CENTROS_INDUSTRIALES):
        coincidencia = REGEX_CENTRO.search(ruta)
        if not coincidencia:
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        nombre = coincidencia.group(1)
        configuracion = asset.propiedades("ClusterToiDataFragment_C")["Config"]
        capital = next(valor for clave, valor in configuracion.items() if clave.startswith("ClusterCapitalStarSystemId"))
        cluster = asset.propiedades(nombre + "_ClusterAsset")
        centro = {"capital": capital, "sistemas": cluster["SystemIds"]}
        # Las líneas que unen las estrellas del centro son una malla (ClusterConstellation) en
        # coordenadas propias; generar_mapa.py la encaja sobre los sistemas para saber qué estrellas une.
        if cluster.get("ClusterConstellation"):
            centro["malla"] = vertices_de_malla(pak, ruta_de_juego(cluster["ClusterConstellation"]))
        centros[nombre] = centro
    return dict(sorted(centros.items(), key=lambda par: int(par[0].split("_")[1])))


def valores_de_config(propiedades):
    """Los campos de un blueprint llevan un sufijo (StarSystemId_11_9016…) y pueden ir anidados."""
    valores = {}

    def recorrer(nodo):
        if isinstance(nodo, dict):
            for clave, valor in nodo.items():
                valores.setdefault(clave.split("_")[0], valor)
                recorrer(valor)

    recorrer(propiedades.get("Config", {}))
    return valores


def extraer_misiones(pak):
    """Acciones que ofrecen o colocan cada misión, con su sistema y los textos de su objetivo."""
    objetivos = {}

    def objetivo(paquete):
        if paquete not in objetivos:
            # Algunos objetivos no se incluyen en el juego (el de Pirate Raiders): la misión se queda sin textos.
            if ruta_de_juego(paquete) + ".uasset" not in pak.archivos:
                objetivos[paquete] = {}
                return objetivos[paquete]
            asset = Asset.desde_pak(pak, ruta_de_juego(paquete))
            info = asset.propiedades(asset.principal()).get("DisplayInfo", {})
            empleador = None
            if isinstance(info.get("Employer"), int) and info["Employer"] < 0:
                paquete_empleador, _ = asset.ruta_import(info["Employer"])
                if ruta_de_juego(paquete_empleador) + ".uasset" in pak.archivos:
                    faccion = Asset.desde_pak(pak, ruta_de_juego(paquete_empleador))
                    # El empleador es una «persona» con su nombre visible (EmployerName).
                    empleador = faccion.propiedades(faccion.principal()).get("EmployerName")
            objetivos[paquete] = {
                "titulo": info.get("ScreenTitleText"),
                "resumen": info.get("ScreenSubText"),
                "empleador": empleador,
            }
        return objetivos[paquete]

    acciones = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or not REGEX_MISIONES.match(ruta):
            continue
        nombre = os.path.basename(ruta)[: -len(".uasset")]
        if REGEX_ACCION_IGNORADA.search(nombre):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if not any(texto.startswith("StarSystemId") for texto in asset.nombres):
            continue
        for export in asset.exports:
            if not export.startswith("Default__"):
                continue
            valores = valores_de_config(asset.propiedades(export))
            if "StarSystemId" not in valores:
                continue
            textos = {}
            if isinstance(valores.get("Objective"), int) and valores["Objective"] < 0:
                textos = objetivo(asset.ruta_import(valores["Objective"])[0])
            dlc = valores.get("AssociatedDLC")
            acciones.append({
                "carpeta": os.path.dirname(ruta)[len(CONTENIDO):],
                "accion": nombre,
                # Las ofertas se llaman Show… o, en carrera, Career_Show….
                "oferta": bool(re.search(r"(^|_)Show", nombre)),
                "sistema": valores["StarSystemId"],
                "tipos": valores.get("MissionTypes"),
                "visible": valores.get("bOfferVisibleEverywhere"),
                "dlc": dlc["Id"]["PrimaryAssetName"] if isinstance(dlc, dict) else None,
                **textos,
            })
    return acciones


def extraer_textos(pak):
    textos = {}
    for ruta in TABLAS_DE_TEXTO:
        nombre = os.path.basename(ruta)
        textos[nombre] = Asset.desde_pak(pak, ruta).textos(nombre)
    return textos


def reducir(ancho, alto, pixeles, lado):
    """Reduce una imagen RGBA cuadrada promediando bloques; el color se pondera con el alfa para
    que los bordes transparentes no oscurezcan el logo."""
    paso = ancho // lado
    salida = bytearray(lado * lado * 4)
    for y in range(lado):
        for x in range(lado):
            r = g = b = a = 0
            for dy in range(paso):
                fila = ((y * paso + dy) * ancho + x * paso) * 4
                for dx in range(paso):
                    i = fila + dx * 4
                    alfa = pixeles[i + 3]
                    r += pixeles[i] * alfa
                    g += pixeles[i + 1] * alfa
                    b += pixeles[i + 2] * alfa
                    a += alfa
            destino = (y * lado + x) * 4
            if a:
                salida[destino:destino + 3] = bytes((r // a, g // a, b // a))
            salida[destino + 3] = a // (paso * paso)
    return salida


def escribir_png(ruta, lado, pixeles):
    filas = b"".join(b"\0" + bytes(pixeles[y * lado * 4:(y + 1) * lado * 4]) for y in range(lado))

    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))

    with open(ruta, "wb") as archivo:
        archivo.write(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 6, 0, 0, 0))
                      + bloque(b"IDAT", zlib.compress(filas, 9)) + bloque(b"IEND", b""))


def extraer_logos(pak, facciones):
    """Logo grande de cada facción, en PNG de 128 px. Varias facciones comparten logo (la periferia
    y los piratas), así que cada textura se escribe una vez con su propio nombre."""
    os.makedirs(RUTA_LOGOS, exist_ok=True)
    escritos = set()
    for faccion in facciones.values():
        textura = faccion.get("LogoLarge")
        if not textura or textura in escritos:
            continue
        ancho, alto, pixeles = leer_textura(pak, ruta_de_juego(textura))
        nombre = textura.rsplit(".", 1)[-1] + ".png"
        escribir_png(os.path.join(RUTA_LOGOS, nombre), TAMANO_LOGO, reducir(ancho, alto, pixeles, TAMANO_LOGO))
        escritos.add(textura)
    print(f"logos: {len(escritos)} imágenes")


def guardar(nombre, datos):
    # Una entrada por línea: los cambios de un parche se leen bien en el diff.
    ruta = os.path.join(RUTA_DESTINO, nombre)
    with open(ruta, "w", encoding="utf-8") as archivo:
        if isinstance(datos, list):
            archivo.write("[\n" + ",\n".join(json.dumps(fila, ensure_ascii=False) for fila in datos) + "\n]\n")
        else:
            lineas = [f"{json.dumps(clave, ensure_ascii=False)}: {json.dumps(valor, ensure_ascii=False)}" for clave, valor in datos.items()]
            archivo.write("{\n" + ",\n".join(lineas) + "\n}\n")
    print(f"{nombre}: {len(datos)} entradas")


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 tools/extraer_mapa.py <carpeta del juego>")
        sys.exit(1)
    pak = Pak(os.path.join(sys.argv[1], PAK_DEL_JUEGO))
    os.makedirs(RUTA_DESTINO, exist_ok=True)

    sistemas = extraer_sistemas(pak)
    facciones, sin_asset = extraer_por_nombre(pak, "/Factions/", facciones_usadas(sistemas), ("Name", "StarMapStencilId", "Primary", "LogoLarge"))
    clusteres, clusteres_sin_asset = extraer_por_nombre(pak, "/Clusters/", clusteres_usados(sistemas), ("Name", "Description"))
    guardar("sistemas.json", sistemas)
    guardar("facciones.json", facciones)
    guardar("clusteres.json", clusteres)
    guardar("colores.json", extraer_colores(pak))
    guardar("eventos.json", extraer_eventos(pak))
    guardar("centros_industriales.json", extraer_centros_industriales(pak))
    guardar("textos.json", extraer_textos(pak))
    guardar("misiones.json", extraer_misiones(pak))
    extraer_logos(pak, facciones)
    if sin_asset:
        print(f"Aviso: facciones sin asset en el juego: {', '.join(sin_asset)}")
    if clusteres_sin_asset:
        print(f"Aviso: clústeres sin asset en el juego: {', '.join(clusteres_sin_asset)}")


if __name__ == "__main__":
    main()
