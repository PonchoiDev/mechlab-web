import itertools
import json
import math
import os
import re
from collections import Counter

from generar_mechs import RUTA_UNIT_CARDS, cargar_archivos_por_nombre, cargar_unit_cards

# Genera src/data/starmap.json a partir de lo que extrae extraer_mapa.py: los sistemas con su
# propietario en cada fecha de la partida, las facciones con el color del mapa del juego, los eventos
# que mueven las fronteras, los clústeres y los centros industriales.
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "starmap")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "starmap.json")
# Los logos los escribe extraer_mapa.py; aquí solo se enlaza cada facción con el suyo.
# Los mercados nombran 'Mechs y armas por su id; los nombres salen de los datos del MechLab, que se
# generan antes (generar_mechs.py y generar_items.py).
RUTA_MECHS = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "mechs.json")
RUTA_ITEMS = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "items.json")
RUTA_LOGOS = os.path.join(DIRECTORIO_SCRIPT, "..", "public", "starmap", "logos")
# La rareza de cada variante por facción va aparte: solo la carga el panel Find a 'Mech al abrirse.
RUTA_DISPONIBILIDAD = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "availability.json")

# La partida empieza en 3015 y el último cambio de frontera del juego es de 3060. La tabla trae la
# historia de cada sistema desde el siglo XXII hasta 3145, pero fuera de este rango el juego no la usa.
INICIO = "3015-01-01"
FIN = "3060-12-31"

# Facciones que dejan el sistema sin dueño: no pintan territorio.
SIN_DUENO = {"None", "NoFaction"}
# Los Clanes con color propio en Faction_Colours_MPC; el resto usa el color genérico de la invasión.
CLANES_CON_COLOR = {"ClanWolf", "ClanJadeFalcon", "ClanGhostBear", "ClanSmokeJaguar", "ClanHellsHorses"}
COLOR_CLAN_GENERICO = "ClanInvasion"
# El estencil AbandonedOrIndependent no tiene parámetro con su nombre: es el color Independent.
PARAMETRO_DE_ESTENCIL = {"AbandonedOrIndependent": "Independent"}
# En las mallas de frontera desde 3041, la Federated Commonwealth se pinta con el color de los
# Federated Suns y no con el de su estencil (azul). Comprobado con una captura del mapa en enero de 3042.
COLOR_FORZADO = {"FederatedCommonwealth": "FederatedSuns"}
# Facciones que la tabla usa pero el juego no trae como asset: el nombre se escribe aquí.
NOMBRES_SIN_ASSET = {"ArcRoyalDefenseCordon": "Arc-Royal Defense Cordon"}
SIGLAS_SIN_ASSET = {"ArcRoyalDefenseCordon": "ARDC"}
# Siglas que la tabla no trae bien: Outreach pasa a los Dragoons con las siglas de la FedCom.
SIGLAS_CORREGIDAS = {"WolfsDragoons": "WD"}

# Nombres de los eventos, a partir de la carpeta y el asset de cada cambio de frontera.
NOMBRES_EVENTOS = {
    "Borders3025": "Third Succession War",
    "Borders3029": "Tikonov and St. Ives break away",
    "Borders3030": "Fourth Succession War",
    "Borders3031": "Tikonov joins the Federated Suns",
    "Borders3034": "Free Rasalhague Republic recognized",
    "Borders3039": "War of 3039",
    "Borders3041": "Federated Commonwealth formed",
    "Borders3049": "Clan Invasion",
    "Borders3050_Wave1": "Operation Revival: first wave",
    "Borders3050_Wave2": "Operation Revival: second wave",
    "Borders3050_Wave3": "Operation Revival: third wave",
    "Borders3050_Wave4": "Year of Peace",
    "Borders3050_Wave5": "End of Operation Revival",
    "Borders3057": "End of Operation Guerrero",
    "Borders3058": "ComStar relocates",
    "Borders3059_BulldogWave1": "Operation Bulldog: first wave",
    "Borders3059_BulldogWave2": "Operation Bulldog: second wave",
    "Borders3059_BulldogFinal": "End of Operation Bulldog",
    "Borders3060_HellsHorsesArrive": "Hell's Horses arrive",
}

# Clústeres que no se dibujan: los de reparación de la campaña (los centros industriales salen de
# los clústeres SafeZone) y los de la historia, que el juego deja con un nombre provisional.
REGEX_CLUSTER_OCULTO = re.compile(r"^(RepairSystem_\d+|StoryCluster\d+)$")
REGEX_PALABRAS = re.compile(r"(?<=[a-z])(?=[A-Z])")
ORDEN_MODOS = {"campaign": 0, "career": 1, None: 2}
# Rareza de cada variante por facción en su unit card (FactionRarity), que decide qué vende el mercado.
REGEX_RAREZA = re.compile(r'\(\(Id="MWFactionAsset:([A-Za-z]+)"\), ([A-Za-z]+)\)')
REGEX_FECHA_UNIT_CARD = re.compile(r"IntroDate=(\d{3,4})\.(\d{2})\.(\d{2})")
RAREZAS = {"VeryCommon": "veryCommon", "Common": "common", "Uncommon": "uncommon", "Rare": "rare",
           "VeryRare": "veryRare", "Unique": "unique", "Unavailable": "unavailable"}


# Las mallas de los centros industriales usan unas 8 unidades por año luz y el eje X invertido. La
# escala exacta varía un poco de una malla a otra, así que se busca la que mejor encaja.
ESCALAS_MALLA = [valor / 20 for valor in range(120, 200)]
# Una pareja de estrellas está unida si la malla pasa cerca de casi todo el tramo entre ellas (las
# líneas son discontinuas, así que se mira a menos de un año luz de algún vértice).
COBERTURA_LINEA = 0.75
MUESTRAS_LINEA = 12


def distancia_a_tramo(punto, inicio, fin):
    (px, py), (ax, ay), (bx, by) = punto, inicio, fin
    dx, dy = bx - ax, by - ay
    longitud = dx * dx + dy * dy
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / longitud)) if longitud else 0
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def lineas_de_centro(centro, posiciones):
    """Parejas de sistemas que une la malla de un centro industrial."""
    malla = centro.get("malla")
    ids = centro["sistemas"]
    if not malla or len(ids) < 2:
        return []
    xs = [x for x, _ in malla]
    ys = [y for _, y in malla]
    centro_malla = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
    estrellas = [posiciones[id_sistema] for id_sistema in ids]
    centro_x = (min(-x for x, _ in estrellas) + max(-x for x, _ in estrellas)) / 2
    centro_y = (min(y for _, y in estrellas) + max(y for _, y in estrellas)) / 2

    mejor = None
    for escala in ESCALAS_MALLA:
        # Se alinean los centros de las dos cajas y se mide lo lejos que queda la malla de los tramos.
        puntos = [(centro_malla[0] + escala * (-x - centro_x), centro_malla[1] + escala * (y - centro_y)) for x, y in estrellas]
        tramos = list(itertools.combinations(puntos, 2))
        error = sum(min(distancia_a_tramo(vertice, a, b) for a, b in tramos) for vertice in malla) / len(malla)
        if mejor is None or error < mejor[0]:
            mejor = (error, escala, puntos)
    _, escala, puntos = mejor

    lineas = []
    for (i, a), (j, b) in itertools.combinations(enumerate(puntos), 2):
        muestras = [(a[0] + (b[0] - a[0]) * t / MUESTRAS_LINEA, a[1] + (b[1] - a[1]) * t / MUESTRAS_LINEA)
                    for t in range(2, MUESTRAS_LINEA - 1)]
        cerca = sum(1 for muestra in muestras if any(math.hypot(muestra[0] - x, muestra[1] - y) < escala for x, y in malla))
        if cerca / len(muestras) > COBERTURA_LINEA:
            lineas.append(sorted([ids[i], ids[j]]))
    return sorted(lineas)


# Misiones de alta recompensa (HRQ). La parte de una misión va al final del título (Pt. 2).
REGEX_PARTE = re.compile(r"\s*Pt\.?\s*(\d+)\s*$", re.IGNORECASE)
# Tipos de misión que el juego usa como relleno en la oferta y no dicen nada al jugador.
TIPOS_SIN_INFORMACION = {"Unknown", "Campaign"}
TIPOS_CORREGIDOS = {"Defence": "Defense"}


def cadena_de_carpeta(carpeta):
    """Cada HRQ es una carpeta; las subcarpetas de sus misiones pertenecen a la misma cadena.
    Devuelve la carpeta de la cadena y el modo de juego (campaña, carrera o ninguno para los DLC)."""
    partes = carpeta.split("/")
    if carpeta.startswith("Campaign/CampaignArcs/Regions/"):
        return "/".join(partes[:5]), "campaign"
    if carpeta.startswith("DLC1/CareerMode/Sidequests/HeroesOfTheIS/"):
        return "/".join(partes[:5]), None
    if carpeta.startswith("DLC1/CareerMode/Sidequests/"):
        return carpeta, "career"
    if carpeta.startswith("DLC3/HatchetmanQuestData"):
        return "DLC3/HatchetmanQuestData", None
    return "/".join(partes[:3]), None


def parte(titulo):
    coincidencia = REGEX_PARTE.search(titulo or "")
    return int(coincidencia.group(1)) if coincidencia else 1


def sin_parte(titulo):
    return REGEX_PARTE.sub("", titulo).strip() if titulo else None


def identificador(nombre):
    return re.sub(r"[^a-z0-9]+", "-", nombre.lower()).strip("-")


def tipos_de_mision(texto):
    tipos = [tipo.strip() for tipo in (texto or "").split(",")]
    return [TIPOS_CORREGIDOS.get(tipo, tipo) for tipo in tipos if tipo and tipo not in TIPOS_SIN_INFORMACION]


def nombre_de_cadena(grupo, carpeta):
    """El título que lleva la mayoría de las misiones, sin la parte ni distinguir mayúsculas. Si cada
    misión tiene su propio título (Adam Steiner, en el DLC8), el nombre de la carpeta."""
    titulos = [sin_parte(accion["titulo"]) for accion in grupo if not accion["oferta"] and accion.get("titulo")]
    if not titulos:
        titulos = [sin_parte(accion["titulo"]) for accion in grupo if accion.get("titulo")]
    clave, veces = Counter(titulo.lower() for titulo in titulos).most_common(1)[0] if titulos else (None, 0)
    if clave and veces * 2 > len(titulos):
        return Counter(titulo for titulo in titulos if titulo.lower() == clave).most_common(1)[0][0]
    carpeta_final = re.sub(r"^(Quest\d*_|Career_)", "", carpeta.rsplit("/", 1)[-1])
    return separar_palabras(carpeta_final)


def condiciones_por_cadena(arcos):
    """Condiciones de los arcos de cada cadena: la reputación más alta que piden, la fecha más
    temprana desde la que se ofrece y la de caducidad, si la tiene."""
    por_cadena = {}
    for arco in arcos:
        por_cadena.setdefault(cadena_de_carpeta(arco["carpeta"]), []).append(arco)
    condiciones = {}
    for clave, grupo in por_cadena.items():
        valores = lambda campo: [arco[campo] for arco in grupo if arco[campo] is not None]
        # Objetivos de otras cadenas que hay que completar antes, o que no hay que haber completado: se
        # guarda la cadena a la que pertenecen.
        def cadenas_de(campo):
            return {cadena_de_carpeta(paquete[len("/Game/"):].rsplit("/", 1)[0])
                    for arco in grupo for paquete in arco.get(campo, [])} - {clave}

        previas = cadenas_de("requiere")
        # Si pide completar una parte de la otra y no haber completado otra parte, es un requisito
        # previo, no una HRQ excluyente (An Intriguing Offer, Order of the Five Pillars).
        excluyentes = cadenas_de("excluye") - previas
        condiciones[clave] = {
            "reputation": max(valores("reputacion"), default=None),
            "from": min(valores("desde"), default=None),
            "until": min(valores("hasta"), default=None),
            "previas": sorted(previas),
            "excluyentes": sorted(excluyentes),
        }
    return condiciones


def requisito_de_cadena(modo, condicion, nombres):
    condicion = condicion or {"reputation": None, "from": None, "until": None, "previas": [], "excluyentes": []}
    previas = [nombres[previa] for previa in condicion["previas"] if previa in nombres]
    return {
        "mode": modo,
        "reputation": condicion["reputation"],
        "from": condicion["from"],
        "until": condicion["until"],
        "after": previas[0] if previas else None,
        "excludes": sorted({nombres[otra] for otra in condicion["excluyentes"] if otra in nombres}),
    }


def recompensas_por_cadena(recompensas_juego, mechs, items):
    """Suma lo que pagan los objetivos de cada cadena. Si dos objetivos que pagan comparten título,
    son desenlaces alternativos (Armed Robbery en carrera) y cuenta uno."""
    por_cadena = {}
    for recompensa in recompensas_juego:
        por_cadena.setdefault(cadena_de_carpeta(recompensa["carpeta"]), []).append(recompensa)
    resultado = {}
    for (carpeta, modo), grupo in por_cadena.items():
        vistos = set()
        unicas = []
        for recompensa in grupo:
            if recompensa["titulo"].lower() in vistos:
                continue
            vistos.add(recompensa["titulo"].lower())
            unicas.append(recompensa)
        # En el orden de la cadena, para que el texto final sea el de la última parte.
        unicas.sort(key=lambda recompensa: parte(recompensa["titulo"]))
        textos = [recompensa["texto"] for recompensa in unicas if recompensa["texto"]]
        resultado[(carpeta, modo)] = {
            "mode": modo,
            "cbills": sum(recompensa["cbills"] for recompensa in unicas),
            "reputation": sum(recompensa["reputacion"] for recompensa in unicas),
            "mechs": [mech for recompensa in unicas for mech in (mech_de_juego(id_juego, mechs) for id_juego in recompensa["mechs"]) if mech],
            "weapons": sumar_objetos(objeto_de_juego(id_juego, cantidad, items, True)
                                     for recompensa in unicas for id_juego, cantidad in recompensa["armas"] if cantidad > 0),
            "equipment": sumar_objetos(objeto_de_juego(id_juego, cantidad, items, False)
                                       for recompensa in unicas for id_juego, cantidad in recompensa["equipo"] if cantidad > 0),
            "debrief": textos[-1] if textos else None,
        }
    return resultado


def cadenas_de_misiones(acciones, sistemas_validos, arcos=(), recompensas=None):
    """Agrupa las acciones en cadenas. La misma cadena de facción existe en campaña y en carrera:
    se une en una que indica los dos modos, con los sistemas de carrera."""
    grupos = {}
    for accion in acciones:
        if accion["sistema"] not in sistemas_validos:
            continue
        carpeta, modo = cadena_de_carpeta(accion["carpeta"])
        grupos.setdefault((carpeta, modo), []).append(accion)

    condiciones = condiciones_por_cadena(arcos)
    nombres = {clave: nombre_de_cadena(grupo, clave[0]) for clave, grupo in grupos.items()}
    cadenas = {}
    for (carpeta, modo), grupo in grupos.items():
        nombre = nombre_de_cadena(grupo, carpeta)
        ofertas = sorted((accion for accion in grupo if accion["oferta"]), key=lambda accion: (parte(accion.get("titulo")), accion["accion"]))
        misiones = sorted((accion for accion in grupo if not accion["oferta"]), key=lambda accion: (parte(accion.get("titulo")), accion["accion"]))
        if not misiones:
            continue
        oferta = ofertas[0] if ofertas else None
        empleadores = [accion["empleador"] for accion in grupo if accion.get("empleador")]
        dlc = next((accion["dlc"] for accion in ofertas if accion.get("dlc")), None)
        cadena = {
            "id": identificador(nombre),
            "name": nombre,
            "dlc": int(dlc.split("_")[1]) if dlc else None,
            "modes": [modo] if modo else [],
            # Algún empleador viene como identificador (FederatedCommonwealth (FS)): se separan las palabras.
            "employer": REGEX_PALABRAS.sub(" ", Counter(empleadores).most_common(1)[0][0]) if empleadores else None,
            "offer": (oferta or misiones[0])["sistema"],
            "visibleEverywhere": bool(oferta and oferta.get("visible")),
            "missionTypes": tipos_de_mision(oferta and oferta.get("tipos")),
            # Una entrada por modo: la misma cadena de facción puede pedir más reputación en carrera.
            "requirements": [requisito_de_cadena(modo, condiciones.get((carpeta, modo)), nombres)],
            "rewards": [recompensas[(carpeta, modo)]] if recompensas and (carpeta, modo) in recompensas else [],
            "missions": [
                {
                    "title": accion.get("titulo") or (nombre if parte(accion.get("titulo")) == 1 else f"{nombre} Pt. {parte(accion.get('titulo'))}"),
                    "summary": accion.get("resumen") or None,
                    "system": accion["sistema"],
                }
                for accion in misiones
            ],
        }
        previa = cadenas.get(nombre)
        if previa:
            previa_recompensas = list(previa["rewards"])
            modos = sorted(set(previa["modes"]) | set(cadena["modes"]))
            requisitos = [requisito for requisito in previa["requirements"] + cadena["requirements"]
                          if requisito["mode"] not in {otro["mode"] for otro in previa["requirements"]} or requisito in previa["requirements"]]
            # Ante dos versiones, la de carrera; si las dos son iguales, da lo mismo.
            if "career" in cadena["modes"] and "career" not in previa["modes"]:
                previa.update(cadena)
            previa["modes"] = modos
            previa["requirements"] = sorted(requisitos, key=lambda requisito: requisito["mode"] or "")
            por_modo = {recompensa["mode"]: recompensa for recompensa in previa_recompensas + cadena["rewards"]}
            previa["rewards"] = sorted(por_modo.values(), key=lambda recompensa: recompensa["mode"] or "")
        else:
            cadenas[nombre] = cadena
    return sorted(cadenas.values(), key=lambda cadena: cadena["name"])


REGEX_TIER = re.compile(r"_Lvl(\d)$")
REGEX_DLC = re.compile(r"^DLC(\d)")


def nombre_de_tier(tier):
    # Como en el MechLab: Tier 1 a Tier 4 y Lost Tech para el 5.
    return "Lost Tech tier" if tier == "5" else f"Tier {tier}"


def etapa_de_mercado(mercado):
    """Momento de la campaña en que se abre el mercado, sacado del nombre del asset o de su carpeta."""
    if mercado["negro"]:
        return "Black market"
    if "Prologue" in mercado["asset"]:
        return "Prologue"
    acto = re.search(r"Act(\d)", mercado["asset"])
    if acto:
        return f"Act {acto.group(1)}"
    mision = re.search(r"D4M(\d+)", mercado["carpeta"])
    if mision:
        return f"Mission {int(mision.group(1))}"
    mision = re.search(r"Quest_([A-Za-z]+)", mercado["carpeta"])
    if mision:
        return separar_palabras(mision.group(1))
    return "Campaign"


# Variante de un loadout de mercado o de recompensa: los de recompensa llevan prefijos y sufijos en
# cualquier orden (11_2_Reward_FS9-A, COR-PVT_CareerSalvage, RFL-DNA_Loadout_CareerSalvage).
# Los loadouts de recompensa llevan la variante con prefijos y sufijos en cualquier orden:
# 11_2_Reward_FS9-A, RFL-DNA_Loadout_CareerSalvage, AS7-D_DLC4_Reward, D7M3_HBR-A_Reward_Loadout.
REGEX_PREFIJO_VARIANTE = re.compile(r"^(.*_Reward_|D\d+M\d+_)")
REGEX_SUFIJO_VARIANTE = re.compile(r"_(Loadout|MDA|CareerSalvage|CampaignSalvage|DLC\d+_?Reward|Reward$)")


def mech_de_juego(id_juego, mechs):
    variante = id_juego
    while (sin_sufijo := REGEX_SUFIJO_VARIANTE.sub("", variante)) != variante:
        variante = sin_sufijo
    variante = REGEX_PREFIJO_VARIANTE.sub("", variante)
    # Algunos loadouts no respetan las mayúsculas de la variante (KTO-19b_Loadout).
    variante = next((id_mech for id_mech in mechs if id_mech.lower() == variante.lower()), variante)
    return {"id": variante, "name": mechs[variante]["name"]} if variante in mechs else None


def objeto_de_juego(id_juego, cantidad, items, con_tier):
    tier = REGEX_TIER.search(id_juego)
    base = REGEX_TIER.sub("", id_juego)
    nombre = items[base]["name"] if base in items else separar_palabras(base)
    if con_tier:
        return {"name": nombre, "tier": nombre_de_tier(tier.group(1)) if tier else None, "count": cantidad}
    return {"name": nombre, "count": cantidad}


def sumar_objetos(objetos):
    """Une las repeticiones del mismo objeto (y tier) sumando su cantidad."""
    sumados = {}
    for objeto in objetos:
        clave = (objeto["name"], objeto.get("tier"))
        if clave in sumados:
            sumados[clave]["count"] += objeto["count"]
        else:
            sumados[clave] = dict(objeto)
    return list(sumados.values())


# Promociones: llegan con un mensaje, sin misión ni sistema. El registro de eventos de la de Razer dice
# «Claimed Razer WVR-7H», y el arco de la de Microsoft comprueba HasMSMechEntitlement.
SOCIOS_DE_PROMOCION = {"Razer_Exclusive": "Razer", "MS_Exclusive": "Microsoft"}
REGEX_NIVEL_DE_INFORMACION = re.compile(r"^BountyHunterLevelUp(\d+)$")


def tipo_de_recompensa(recompensa):
    """Cómo se consigue la recompensa, para que la ficha lo diga aunque no esté en el mapa."""
    carpeta, objetivo = recompensa["carpeta"], recompensa["objetivo"]
    socio = SOCIOS_DE_PROMOCION.get(carpeta.rsplit("/", 1)[-1])
    if socio:
        # La de Microsoft está en las misiones del modo carrera (DLC1/CareerMode).
        return {"kind": "promotion", "partner": socio, **({"careerOnly": True} if "/CareerMode/" in carpeta else {})}
    nivel = REGEX_NIVEL_DE_INFORMACION.match(objetivo)
    if nivel:
        # Niveles de información sobre el Bounty Hunter, el mercenario rival del DLC4.
        return {"kind": "intel", "level": int(nivel.group(1))}
    if objetivo.startswith("ArenaFameLevelUp"):
        # Rangos de fama de las arenas de Solaris (DLC6): el título es el nombre del rango.
        return {"kind": "arenaRank"}
    if "CampaignComplete" in objetivo:
        return {"kind": "campaignComplete"}
    return {"kind": "mission"}


def recompensas_fuera_de_hrq(recompensas_juego, misiones_juego, mechs, sistemas_validos):
    """'Mechs que da una misión o un objetivo que no es una HRQ del mapa: las campañas de los DLC, la
    información del Bounty Hunter o desbloqueos como el Wolverine de Razer. Las de las HRQ ya van en
    su recompensa."""
    cadenas = {cadena_de_carpeta(accion["carpeta"])[0] for accion in misiones_juego if accion["sistema"] in sistemas_validos}
    resultado = []
    for recompensa in recompensas_juego:
        variantes = [mech for mech in (mech_de_juego(id_juego, mechs) for id_juego in recompensa["mechs"]) if mech]
        if cadena_de_carpeta(recompensa["carpeta"])[0] in cadenas or not variantes:
            continue
        dlc = REGEX_DLC.match(recompensa["carpeta"])
        entrada = {"id": recompensa["objetivo"], "title": recompensa["titulo"], "summary": recompensa["resumen"],
                   "dlc": int(dlc.group(1)) if dlc else None, "mechs": variantes}
        if recompensa["sistema"] in sistemas_validos:
            entrada["system"] = recompensa["sistema"]
        entrada.update(tipo_de_recompensa(recompensa))
        resultado.append(entrada)
    return resultado


def mercados_especiales(mercados_juego, mechs, items, sistemas_validos):
    def mech(id_juego):
        return mech_de_juego(id_juego, mechs)

    def objeto(id_juego, cantidad, con_tier):
        return objeto_de_juego(id_juego, cantidad, items, con_tier)

    mercados = []
    for mercado in mercados_juego:
        if mercado["sistema"] not in sistemas_validos:
            continue
        pilotos = mercado["pilotos"]
        mercados.append({
            "id": identificador(re.sub(r"_?(CustomMarket\d*|ArcAction)", "", mercado["asset"])),
            "system": mercado["sistema"],
            "dlc": int(REGEX_DLC.match(mercado["carpeta"]).group(1)),
            "stage": etapa_de_mercado(mercado),
            "blackMarket": mercado["negro"],
            "mechs": [encontrado for encontrado in (mech(id_juego) for id_juego in mercado["mechs"]) if encontrado],
            # Algunas entradas vienen con cantidad 0 (SRM_Half_AmmoEquipment): no se venden.
            "weapons": [objeto(id_juego, cantidad, True) for id_juego, cantidad in mercado["armas"] if cantidad > 0],
            "equipment": [objeto(id_juego, cantidad, False) for id_juego, cantidad in mercado["equipo"] if cantidad > 0],
            "pilots": {"count": pilotos["NumberOfPilots"], "minSkill": pilotos["MinimumSkill"], "maxSkill": pilotos["MaximumSkill"]}
            if pilotos.get("NumberOfPilots") else None,
        })
    # En el orden de la campaña: prólogo, actos o misiones por número y después el resto. Si la etapa
    # empata (los mercados negros del DLC7), sorted es estable y respeta el orden de extracción, que
    # sigue la numeración de los assets (CustomMarket1 a CustomMarket5).
    def orden(mercado):
        numero = re.search(r"\d+", mercado["stage"])
        return (mercado["dlc"], 0 if mercado["stage"] == "Prologue" else int(numero.group()) if numero else 100)

    return sorted(mercados, key=orden)


def mechs_unicos(unicos_juego, mechs):
    resultado = []
    for unico in unicos_juego:
        variante = re.sub(r"_MDA$", "", unico["mech"])
        resultado.append({
            "mech": variante,
            "name": mechs[variante]["name"],
            "dlc": int(REGEX_DLC.match(unico["carpeta"]).group(1)),
            "system": unico["sistema"],
            "from": unico["fecha"],
        })
    return resultado


def modo_de_zona(ruta):
    # Las zonas de las campañas de los DLC (DLC2/CampaignData…) se juegan igual en los dos modos.
    if ruta.startswith("Campaign/"):
        return "campaign"
    if ruta.startswith("DLC1/CareerMode/"):
        return "career"
    return None


def zonas_con_sistemas(zonas, sistemas):
    # El mapa toma las zonas del asset de facción de cada sistema y el nivel está en el ClusterAsset;
    # sus nombres no siempre coinciden (FreeWorldInterior tiene los sistemas de Free Worlds Commerce
    # Hub), así que se unen por sus sistemas. Las invasiones de los Clanes solo comparten una parte.
    return [zona for zona in zonas if zona["sistemas"] and set(zona["sistemas"]) == set(sistemas)]


def niveles_de_zona(zonas):
    """Reputación recomendada y dificultad por modo, sin repetir los iguales del mismo modo."""
    niveles = []
    for zona in zonas:
        nivel = {"mode": modo_de_zona(zona["ruta"]), "reputation": zona.get("reputacion") or None, "difficulty": zona.get("dificultad")}
        if (nivel["reputation"] or nivel["difficulty"] is not None) and nivel not in niveles:
            niveles.append(nivel)
    return sorted(niveles, key=lambda nivel: (ORDEN_MODOS[nivel["mode"]], nivel["difficulty"] or 0))


def tabla_de_faccion(faccion, alianzas, con_tabla):
    """Facción cuya tabla de rareza usa el mercado: la suya o, si no tiene, la de su alianza.

    Las facciones menores no tienen tabla propia: Canopus usa la de Periphery, y Elysian Fields la de
    Oberon, que responde a Bandits y esta a Outlaws, la primera con tabla.
    """
    vistas = set()
    while faccion and faccion not in vistas:
        if faccion in con_tabla:
            return faccion
        vistas.add(faccion)
        faccion = alianzas.get(faccion)
    return None


def disponibilidad_de_mechs(mechs, unit_cards, facciones, alianzas, heroes_en_venta):
    rarezas = {}
    for mech in mechs.values():
        ficha = unit_cards.get(f"{mech['id'].lower()}_loadout")
        if ficha:
            rarezas[mech["id"]] = (ficha, {faccion: RAREZAS[nivel] for faccion, nivel in REGEX_RAREZA.findall(ficha)})
    con_tabla = {faccion for _, rareza in rarezas.values() for faccion in rareza}
    tablas = {faccion: tabla for faccion in facciones if (tabla := tabla_de_faccion(faccion, alianzas, con_tabla))}
    usadas = set(tablas.values())
    variantes = []
    for id_mech, (ficha, rareza) in sorted(rarezas.items(), key=lambda par: (mechs[par[0]]["name"], par[0])):
        anio, mes, dia = REGEX_FECHA_UNIT_CARD.search(ficha).groups()
        variante = {"id": id_mech, "name": mechs[id_mech]["name"], "from": f"{int(anio):04d}-{mes}-{dia}",
                    "rarity": {faccion: nivel for faccion, nivel in sorted(rareza.items()) if faccion in usadas}}
        if mechs[id_mech].get("hero"):
            variante["hero"] = True
        # Los hero de HeroMechsForPurchase pueden salir a la venta; el resto solo se consigue de otra forma.
        if id_mech.lower() in heroes_en_venta:
            variante["heroMarket"] = True
        variantes.append(variante)
    return {"factions": dict(sorted(tablas.items())), "mechs": variantes}


def leer(nombre):
    with open(os.path.join(RUTA_ORIGEN, nombre), encoding="utf-8") as archivo:
        return json.load(archivo)


def resolver_texto(texto, tablas):
    if isinstance(texto, dict):
        tabla = texto["tabla"].rsplit(".", 1)[-1]
        return tablas.get(tabla, {}).get(texto["clave"])
    return texto


def separar_palabras(nombre):
    # Algunos assets guardan un identificador (OutworldsBorder) en lugar del nombre visible.
    return REGEX_PALABRAS.sub(" ", nombre) if " " not in nombre else nombre


def color_hex(lineal):
    # Los colores de Unreal son lineales: se pasan a sRGB para la web.
    def canal(valor):
        srgb = 12.92 * valor if valor <= 0.0031308 else 1.055 * valor ** (1 / 2.4) - 0.055
        return max(0, min(255, round(255 * srgb)))
    return "#" + "".join(f"{canal(valor):02x}" for valor in lineal[:3])


def parametro_de_color(id_faccion, faccion):
    if id_faccion in COLOR_FORZADO:
        return COLOR_FORZADO[id_faccion]
    if id_faccion.startswith("Clan"):
        return id_faccion if id_faccion in CLANES_CON_COLOR else COLOR_CLAN_GENERICO
    estencil = (faccion or {}).get("StarMapStencilId") or "EStarMapStencilId::AbandonedOrIndependent"
    estencil = estencil.split("::")[1]
    return PARAMETRO_DE_ESTENCIL.get(estencil, estencil)


def propietarios_en_rango(cambios):
    """Dueño al empezar la partida y cada cambio hasta el final, sin repetir el mismo dueño seguido."""
    resultado = []
    actual = None
    for cambio in cambios:
        faccion = cambio["FactionAssetId"]["Id"]["PrimaryAssetName"]
        faccion = None if faccion in SIN_DUENO else faccion
        if cambio["Date"] <= INICIO:
            actual = faccion
        elif cambio["Date"] <= FIN:
            if not resultado:
                resultado.append([INICIO, actual])
            if resultado[-1][1] != faccion:
                resultado.append([cambio["Date"], faccion])
    return resultado or [[INICIO, actual]]


def main():
    sistemas_juego = leer("sistemas.json")
    facciones_juego = leer("facciones.json")
    clusteres_juego = leer("clusteres.json")
    colores = leer("colores.json")
    eventos_juego = leer("eventos.json")
    centros = leer("centros_industriales.json")
    tablas = leer("textos.json")
    misiones_juego = leer("misiones.json")
    mercados_juego = leer("mercados.json")
    unicos_juego = leer("mechs_unicos.json")
    with open(RUTA_MECHS, encoding="utf-8") as archivo:
        mechs = {mech["id"]: mech for mech in json.load(archivo)}
    with open(RUTA_ITEMS, encoding="utf-8") as archivo:
        items = json.load(archivo)

    centro_de_sistema = {}
    for id_centro, centro in centros.items():
        for id_sistema in centro["sistemas"]:
            centro_de_sistema.setdefault(id_sistema, id_centro)

    sistemas = []
    siglas = {}
    for fila in sistemas_juego:
        # La fila 0 es un marcador (INVALID). El único sistema oculto, Cambridge, sí aparece en el mapa
        # durante el DLC8, donde se juegan varias de sus misiones.
        if fila["Name"] == "0":
            continue
        id_sistema = int(fila["Name"])
        sistema = {
            "id": id_sistema,
            "name": fila["StarSystemName"],
            "x": round(fila["PosX"], 2),
            "y": round(fila["PosY"], 2),
            "owners": propietarios_en_rango(fila["FactionOwnershipChanges"]),
        }
        cluster = fila["Cluster"]["Id"]["PrimaryAssetName"]
        if cluster in clusteres_juego and not REGEX_CLUSTER_OCULTO.match(cluster):
            sistema["cluster"] = cluster
        if id_sistema in centro_de_sistema:
            sistema["hub"] = centro_de_sistema[id_sistema]
        sistemas.append(sistema)
        for cambio in fila["FactionOwnershipChanges"]:
            faccion = cambio["FactionAssetId"]["Id"]["PrimaryAssetName"]
            siglas.setdefault(faccion, Counter())[cambio["LegacyFactionAbbreviation"].split(",")[0]] += 1

    usadas = sorted({dueno for sistema in sistemas for _, dueno in sistema["owners"] if dueno})
    facciones = {}
    for id_faccion in usadas:
        faccion = facciones_juego.get(id_faccion)
        nombre = resolver_texto(faccion["Name"], tablas) if faccion else NOMBRES_SIN_ASSET[id_faccion]
        facciones[id_faccion] = {
            "name": nombre,
            "short": SIGLAS_SIN_ASSET.get(id_faccion) or SIGLAS_CORREGIDAS.get(id_faccion) or siglas[id_faccion].most_common(1)[0][0],
            "color": color_hex(colores[parametro_de_color(id_faccion, faccion)]),
        }
        logo = (faccion or {}).get("LogoLarge")
        if logo and os.path.exists(os.path.join(RUTA_LOGOS, logo.rsplit(".", 1)[-1] + ".png")):
            facciones[id_faccion]["logo"] = logo.rsplit(".", 1)[-1] + ".png"

    zonas = leer("zonas.json")
    clusteres = {}
    sin_nombre = []
    for id_cluster in sorted({sistema["cluster"] for sistema in sistemas if "cluster" in sistema}):
        sistemas_cluster = [sistema["id"] for sistema in sistemas if sistema.get("cluster") == id_cluster]
        suyas = zonas_con_sistemas(zonas, sistemas_cluster)
        nombre = resolver_texto(clusteres_juego[id_cluster]["Name"], tablas)
        # Los assets de facción de Taurian Corridor y de Outworlds Border traen escrito el texto
        # OutworldsBorder en vez de una clave de la tabla de textos; su zona de campaña sí la trae.
        # Las zonas de un solo sistema se llaman como él y se dejan como están.
        de_campana = [zona for zona in suyas if modo_de_zona(zona["ruta"]) == "campaign" and isinstance(zona.get("nombre"), dict)]
        if not isinstance(clusteres_juego[id_cluster]["Name"], dict) and len(sistemas_cluster) > 1 and de_campana:
            nombre = resolver_texto(de_campana[0]["nombre"], tablas) or nombre
        if not nombre:
            sin_nombre.append(id_cluster)
        clusteres[id_cluster] = {"name": separar_palabras(nombre or id_cluster), "levels": niveles_de_zona(suyas)}

    eventos = [
        {"id": evento["asset"], "date": evento["fecha"], "name": NOMBRES_EVENTOS[evento["asset"]]}
        for evento in eventos_juego
        if INICIO < evento["fecha"] <= FIN
    ]

    posiciones = {int(fila["Name"]): (fila["PosX"], fila["PosY"]) for fila in sistemas_juego}
    datos = {
        "range": {"start": INICIO, "end": FIN},
        "colors": {"cluster": color_hex(colores["Warzone"]), "hub": color_hex(colores["Safezone"])},
        "factions": facciones,
        "events": eventos,
        "clusters": clusteres,
        "hubs": {
            id_centro: {"capital": centro["capital"], "links": lineas_de_centro(centro, posiciones),
                        "levels": niveles_de_zona(zonas_con_sistemas(zonas, centro["sistemas"]))}
            for id_centro, centro in centros.items()
        },
        "systems": sistemas,
        "quests": cadenas_de_misiones(misiones_juego, {sistema["id"] for sistema in sistemas}, leer("condiciones_misiones.json"),
                                      recompensas_por_cadena(leer("recompensas_misiones.json"), mechs, items)),
        "markets": mercados_especiales(mercados_juego, mechs, items, {sistema["id"] for sistema in sistemas}),
        "uniqueMechs": mechs_unicos(unicos_juego, mechs),
        "rewards": recompensas_fuera_de_hrq(leer("recompensas_campana.json"), misiones_juego, mechs, {sistema["id"] for sistema in sistemas}),
    }
    with open(RUTA_DESTINO, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, separators=(",", ":"))
        archivo.write("\n")
    unit_cards = cargar_unit_cards(cargar_archivos_por_nombre(RUTA_UNIT_CARDS))
    disponibilidad = disponibilidad_de_mechs(mechs, unit_cards, facciones, leer("alianzas.json"), {heroe.lower() for heroe in leer("heroes_en_venta.json")})
    with open(RUTA_DISPONIBILIDAD, "w", encoding="utf-8") as archivo:
        json.dump(disponibilidad, archivo, ensure_ascii=False, separators=(",", ":"))
        archivo.write("\n")

    print(f"{len(sistemas)} sistemas, {len(facciones)} facciones, {len(eventos)} eventos, "
          f"{len(clusteres)} clústeres, {len(centros)} centros industriales, {len(datos['quests'])} misiones de alta recompensa, "
          f"{len(datos['markets'])} mercados especiales y {len(datos['uniqueMechs'])} 'Mechs únicos")
    print(f"{len(disponibilidad['mechs'])} variantes con su rareza por facción")
    sin_tabla = sorted(set(facciones) - set(disponibilidad["factions"]))
    if sin_tabla:
        print(f"Aviso: facciones del mapa sin tabla de rareza: {', '.join(sin_tabla)}")
    sin_variante = [mech for recompensa in leer("recompensas_misiones.json") for mech in recompensa["mechs"] if not mech_de_juego(mech, mechs)]
    if sin_variante:
        print(f"Aviso: 'Mechs de recompensa sin variante en mechs.json: {', '.join(sin_variante)}")
    sin_mech = [mech for mercado in mercados_juego for mech in mercado["mechs"] if re.sub(r"_Loadout$", "", mech) not in mechs]
    if sin_mech:
        print(f"Aviso: 'Mechs de mercado que no están en mechs.json: {', '.join(sin_mech)}")
    objetos_sin_nombre = sorted({REGEX_TIER.sub("", objeto) for mercado in mercados_juego for objeto, _ in mercado["armas"] + mercado["equipo"]
                                 if REGEX_TIER.sub("", objeto) not in items})
    if objetos_sin_nombre:
        print(f"Aviso: objetos de mercado que no están en items.json: {', '.join(objetos_sin_nombre)}")
    if sin_nombre:
        print(f"Aviso: clústeres sin nombre visible: {', '.join(sin_nombre)}")
    sin_lineas = [id_centro for id_centro, centro in datos["hubs"].items()
                  if not centro["links"] and len(centros[id_centro]["sistemas"]) > 1]
    if sin_lineas:
        print(f"Aviso: centros industriales sin líneas: {', '.join(sin_lineas)}")
    capitales_sin_sistema = [id_centro for id_centro, centro in centros.items()
                             if not any(sistema["id"] == centro["capital"] for sistema in sistemas)]
    if capitales_sin_sistema:
        print(f"Aviso: centros industriales con la capital fuera del mapa: {', '.join(capitales_sin_sistema)}")


if __name__ == "__main__":
    main()
