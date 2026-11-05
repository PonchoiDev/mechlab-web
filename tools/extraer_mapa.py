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
# 'Mechs hero que el juego puede poner a la venta: los que no están solo se consiguen de otra forma.
HEROES_EN_VENTA = CONTENIDO + "Campaign/Progression/DataTables/HeroMechsForPurchase"
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


def extraer_alianzas(pak):
    """Facción a la que responde cada una (Allegiance): Canopus a Periphery, St. Ives a Independent.

    Las facciones menores no tienen tabla de rareza de 'Mechs propia y usan la de su alianza, que puede
    ser una facción sin sistemas (Bandits, que a su vez responde a Outlaws).
    """
    alianzas = {}
    for ruta in pak.buscar(CONTENIDO + "Factions/"):
        if not ruta.endswith(".uasset"):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        nombre = os.path.basename(ruta)[: -len(".uasset")]
        propiedades = asset.propiedades(nombre if nombre in asset.exports else asset.principal())
        alianza = (propiedades.get("Allegiance") or {}).get("Id", {}).get("PrimaryAssetName")
        if "FactionType" in propiedades and alianza and alianza != "None":
            alianzas[nombre] = alianza
    return dict(sorted(alianzas.items()))


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


# Los arcos de avisos y transmisiones recuerdan plazos, y los de inicio de la campaña del DLC3 son de
# la campaña: ninguno decide cuándo se ofrece una HRQ.
REGEX_ARCO_IGNORADO = re.compile(r"(Warning|Transmission|StartConditions|QuickStart|Campaign_Start)", re.IGNORECASE)


def condiciones_de_eventos(nodo, condiciones, asset):
    """Recorre los eventos de un arco y apunta sus condiciones de reputación y de fecha, y los
    objetivos que el evento que la ofrece pide completar antes."""
    if isinstance(nodo, dict):
        disparo = nodo.get("TriggerConditions")
        if isinstance(disparo, dict):
            if re.search(r"(Offer|Show)", nodo.get("EventName") or ""):
                for objetivo in disparo.get("Objectives", []):
                    if objetivo.get("Condition", "").endswith("Completed") and isinstance(objetivo.get("Objective"), int) and objetivo["Objective"] < 0:
                        # Invertida, la condición es «sin haber completado»: HRQ de bandos opuestos.
                        clave = "excluye" if objetivo.get("bInvertCondition") else "requiere"
                        condiciones[clave].append(asset.ruta_import(objetivo["Objective"])[0])
            reputacion = disparo.get("ReputationLevel", {})
            fecha = disparo.get("Date", {})
            if reputacion.get("bCheck") and reputacion.get("Condition", "").endswith("GreaterThanEquals"):
                condiciones["reputacion"].append(reputacion["Value"])
            if fecha.get("bCheck") and fecha.get("Condition", "").endswith("GreaterThanEquals"):
                # Un evento …Expired marca el fin de la oferta; el resto, desde cuándo se ofrece.
                clave = "hasta" if "Expired" in (nodo.get("EventName") or "") else "desde"
                condiciones[clave].append(fecha_de_ticks(fecha["Value"]))
        for valor in nodo.values():
            condiciones_de_eventos(valor, condiciones, asset)
    elif isinstance(nodo, list):
        for valor in nodo:
            condiciones_de_eventos(valor, condiciones, asset)


def extraer_condiciones_misiones(pak):
    """Nivel de reputación mínimo y fechas de oferta de los arcos de campaña de cada HRQ."""
    arcos = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or not REGEX_MISIONES.match(ruta):
            continue
        nombre = os.path.basename(ruta)[: -len(".uasset")]
        if REGEX_ARCO_IGNORADO.search(ruta[len(CONTENIDO):]):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if "CampaignEventList" not in asset.nombres:
            continue
        condiciones = {"reputacion": [], "desde": [], "hasta": [], "requiere": [], "excluye": []}
        for export in asset.exports:
            if not export.startswith("Default__"):
                condiciones_de_eventos(asset.propiedades(export), condiciones, asset)
        if any(condiciones.values()):
            arcos.append({
                "carpeta": os.path.dirname(ruta)[len(CONTENIDO):],
                "arco": nombre,
                "reputacion": max(condiciones["reputacion"]) if condiciones["reputacion"] else None,
                "desde": min(condiciones["desde"]) if condiciones["desde"] else None,
                "hasta": min(condiciones["hasta"]) if condiciones["hasta"] else None,
                "requiere": sorted(set(condiciones["requiere"])),
                "excluye": sorted(set(condiciones["excluye"])),
            })
    return arcos


def extraer_mercados(pak):
    """Mercados con inventario fijo de las campañas de los DLC. El CustomMarket genérico de Campaign
    es la plantilla del juego y no tiene sistema."""
    mercados = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or "CustomMarket" not in ruta or not re.match(CONTENIDO + r"DLC\d", ruta):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        for export in asset.exports:
            if not export.startswith("Default__"):
                continue
            propiedades = asset.propiedades(export)
            if "StarSystemId" not in propiedades:
                continue
            inventario = propiedades.get("Inventory", {})

            def objetos(lista, campo):
                return [[objeto["ItemData"][campo]["Id"]["PrimaryAssetName"], objeto["Count"]] for objeto in inventario.get(lista, [])]

            mercados.append({
                "carpeta": os.path.dirname(ruta)[len(CONTENIDO):],
                "asset": os.path.basename(ruta)[: -len(".uasset")],
                "sistema": propiedades["StarSystemId"],
                "negro": bool(propiedades.get("bShouldShowAsBlackMarket")),
                "mechs": [mech["Id"]["PrimaryAssetName"] for mech in inventario.get("MechLoadouts", [])],
                "armas": objetos("Weapons", "WeaponId"),
                "equipo": objetos("Equipment", "EquipmentId"),
                "pilotos": {clave: propiedades.get(clave) for clave in ("NumberOfPilots", "MinimumSkill", "MaximumSkill")},
            })
    return mercados


def extraer_mechs_unicos(pak):
    """'Mechs que el juego coloca en un sistema concreto (HeroMechToPlace). La fecha desde la que
    aparecen está en la condición del arco de mercado de la misma carpeta."""
    unicos = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or not re.match(CONTENIDO + r"DLC\d/CampaignData/", ruta):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if "HeroMechToPlace" not in asset.nombres:
            continue
        for export in asset.exports:
            if not export.startswith("Default__"):
                continue
            propiedades = asset.propiedades(export)
            if not isinstance(propiedades.get("HeroMechToPlace"), int):
                continue
            carpeta = os.path.dirname(ruta)
            fecha = None
            for arco in pak.buscar(carpeta + "/"):
                if arco.endswith("MarketArc.uasset"):
                    texto = json.dumps(Asset.desde_pak(pak, sin_extension(arco)).propiedades(os.path.basename(arco)[: -len(".uasset")]))
                    coincidencia = re.search(r'"Date": \{"bCheck": true, "Value": (\d+)', texto)
                    fecha = fecha_de_ticks(int(coincidencia.group(1))) if coincidencia else None
            unicos.append({
                "carpeta": carpeta[len(CONTENIDO):],
                "sistema": propiedades.get("Star System Id"),
                "mech": asset.ruta_import(propiedades["HeroMechToPlace"])[1],
                "fecha": fecha,
            })
    return unicos


def recompensa_de_objetivo(info):
    recompensa = info.get("ObjectiveReward") or {}
    objetos = recompensa.get("ItemRewards") or {}

    def lista(campo, clave):
        return [[objeto["ItemData"][clave]["Id"]["PrimaryAssetName"], objeto["Count"]] for objeto in objetos.get(campo, [])]

    return {
        "cbills": recompensa.get("CBills") or 0,
        "reputacion": recompensa.get("ReputationIncrease") or 0,
        "mechs": [mech["Id"]["PrimaryAssetName"] for mech in objetos.get("MechLoadouts", [])],
        "armas": lista("Weapons", "WeaponId"),
        "equipo": lista("Equipment", "EquipmentId"),
        "texto": info.get("RewardBriefing") or None,
    }


def extraer_recompensas_misiones(pak):
    """Objetivos que pagan (bHasRewards) en las carpetas de las HRQ. Se recorren todos y no solo los
    de las acciones con sistema, porque el pago final suele estar en un objetivo que activa el arco
    (A New March, de Adam Steiner). Otros objetivos traen una recompensa copiada que el juego no
    entrega, y los de título entre corchetes ([*] Campaign Complete) son marcadores internos."""
    recompensas = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or not REGEX_MISIONES.match(ruta):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if "ObjectiveReward" not in asset.nombres:
            continue
        info = asset.propiedades(asset.principal()).get("DisplayInfo", {})
        titulo = info.get("ScreenTitleText") or ""
        if not info.get("bHasRewards") or titulo.startswith("["):
            continue
        recompensas.append({"carpeta": os.path.dirname(ruta)[len(CONTENIDO):], "objetivo": os.path.basename(ruta)[: -len(".uasset")],
                            "titulo": titulo, **recompensa_de_objetivo(info)})
    return recompensas


def tiene_uexp(pak, ruta):
    # Asset.desde_pak lee también el .uexp: un .uasset sin él pararía los recorridos de todo el juego.
    return sin_extension(ruta) + ".uexp" in pak.archivos


def sistemas_de_objetivos(pak):
    """Sistema de cada objetivo según las acciones que lo colocan o lo ofrecen (Place…, Show…).

    La configuración de la acción va en su export Default__, con el objetivo y el sistema. La acción no
    siempre está en la carpeta del objetivo: en las campañas de los DLC 5 a 7 va en la subcarpeta
    ArcActions de la misión, así que se recorre todo el juego. Si las acciones de un objetivo no
    coinciden en el sistema, no se da ninguno.
    """
    sistemas = {}
    for ruta in pak.archivos:
        if not ruta.endswith(".uasset") or "/Objects/" in ruta or not tiene_uexp(pak, ruta):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        # Solo las acciones de arco (su clase hereda de una *_ArcAction) con sistema: el resto de assets
        # (interfaz, niveles, escenarios) no lo trae.
        if not any(nombre.endswith("ArcAction_C") for nombre in asset.nombres) or not any(nombre.startswith("StarSystemId") for nombre in asset.nombres):
            continue
        for export in asset.exports:
            valores = valores_de_config(asset.propiedades(export))
            objetivo, sistema = valores.get("Objective"), valores.get("StarSystemId")
            if isinstance(objetivo, int) and objetivo < 0 and sistema:
                sistemas.setdefault(asset.ruta_import(objetivo)[0], set()).add(sistema)
    return {paquete: next(iter(valores)) for paquete, valores in sistemas.items() if len(valores) == 1}


def sistema_de_arcos(pak, carpeta):
    """Sistema de la condición StarSystemTrigger de los arcos de una carpeta, si es uno solo.

    Algunas recompensas no las coloca ninguna acción: el arco las entrega al llegar a un sistema. El de
    Razer (Razer_WolverineArc) se dispara al llegar a Valentina.
    """
    sistemas = set()
    for ruta in pak.archivos:
        if not ruta.endswith(".uasset") or os.path.dirname(ruta) != carpeta:
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if "CampaignEventList" not in asset.nombres:
            continue
        for evento in asset.propiedades(asset.principal()).get("CampaignEventList", {}).get("CampaignEvents", []):
            condicion = evento["TriggerConditions"].get("StarSystemTrigger") or {}
            if condicion.get("bCheck") and not condicion.get("bInvertCondition"):
                sistemas.add(condicion["StarSystemId"])
    return next(iter(sistemas)) if len(sistemas) == 1 else None


def extraer_recompensas_campana(pak):
    """Objetivos que dan 'Mechs fuera de las HRQ: misiones de las campañas de los DLC, el final de una
    campaña, la información del Bounty Hunter (DLC4) o desbloqueos de promociones (el Wolverine de
    Razer). Con el sistema de la misión si una acción la coloca.
    """
    recompensas = []
    sistemas = sistemas_de_objetivos(pak)
    for ruta in sorted(pak.archivos):
        if not ruta.endswith(".uasset") or "/Objects/" in ruta or not tiene_uexp(pak, ruta):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        if "ObjectiveReward" not in asset.nombres or "MechLoadouts" not in asset.nombres:
            continue
        info = asset.propiedades(asset.principal()).get("DisplayInfo", {})
        titulo = info.get("ScreenTitleText") or ""
        recompensa = recompensa_de_objetivo(info)
        if not info.get("bHasRewards") or titulo.startswith("[") or not recompensa["mechs"]:
            continue
        objetivo = os.path.basename(ruta)[: -len(".uasset")]
        sistema = sistemas.get("/Game/" + sin_extension(ruta)[len(CONTENIDO):]) or sistema_de_arcos(pak, os.path.dirname(ruta))
        recompensas.append({"carpeta": os.path.dirname(ruta)[len(CONTENIDO):], "objetivo": objetivo, "titulo": titulo,
                            "resumen": info.get("ScreenSubText") or None, "sistema": sistema, "mechs": recompensa["mechs"]})
    return recompensas


def extraer_heroes_en_venta(pak):
    asset = Asset.desde_pak(pak, HEROES_EN_VENTA)
    # Cada fila apunta a la unit card del 'Mech (WVR-Q_UnitCard, WHM-DNC_UnitCard_Playable).
    return sorted(re.sub(r"_UnitCard.*$", "", asset.ruta_import(next(iter(fila.values())))[1], flags=re.IGNORECASE)
                  for fila in asset.filas(asset.principal()).values())


def extraer_zonas(pak):
    """Sistemas, nombre, reputación recomendada y dificultad de cada zona (ClusterAsset) del juego.

    Hay uno por modo: los de campaña en Campaign/Clusters, los de carrera en DLC1/CareerMode y los de
    las campañas de los DLC en sus carpetas. generar_mapa.py los une a las zonas del mapa por sus sistemas.
    """
    zonas = []
    for ruta in sorted(pak.archivos):
        if not ruta.endswith("ClusterAsset.uasset"):
            continue
        asset = Asset.desde_pak(pak, sin_extension(ruta))
        zona = {"ruta": ruta[len(CONTENIDO):], "sistemas": []}
        for export in asset.exports:
            if export.startswith("Default__"):
                continue
            propiedades = asset.propiedades(export)
            if "SystemIds" in propiedades:
                zona["sistemas"] = propiedades["SystemIds"]
            if "Config" in propiedades:
                valores = valores_de_config(propiedades)
                zona.update({"nombre": valores.get("ClusterName"), "reputacion": valores.get("RecommendedReputation"),
                             "dificultad": valores.get("DisplayDifficultyLevel")})
        zonas.append(zona)
    return zonas


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
    guardar("condiciones_misiones.json", extraer_condiciones_misiones(pak))
    guardar("recompensas_misiones.json", extraer_recompensas_misiones(pak))
    guardar("mercados.json", extraer_mercados(pak))
    guardar("mechs_unicos.json", extraer_mechs_unicos(pak))
    guardar("zonas.json", extraer_zonas(pak))
    guardar("alianzas.json", extraer_alianzas(pak))
    guardar("recompensas_campana.json", extraer_recompensas_campana(pak))
    guardar("heroes_en_venta.json", extraer_heroes_en_venta(pak))
    extraer_logos(pak, facciones)
    if sin_asset:
        print(f"Aviso: facciones sin asset en el juego: {', '.join(sin_asset)}")
    if clusteres_sin_asset:
        print(f"Aviso: clústeres sin asset en el juego: {', '.join(clusteres_sin_asset)}")


if __name__ == "__main__":
    main()
