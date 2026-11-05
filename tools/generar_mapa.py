import json
import os
import re
from collections import Counter

# Genera src/data/starmap.json a partir de lo que extrae extraer_mapa.py: los sistemas con su
# propietario en cada fecha de la partida, las facciones con el color del mapa del juego, los eventos
# que mueven las fronteras, los clústeres y los centros industriales.
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "starmap")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "starmap.json")

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

    centro_de_sistema = {}
    for id_centro, centro in centros.items():
        for id_sistema in centro["sistemas"]:
            centro_de_sistema.setdefault(id_sistema, id_centro)

    sistemas = []
    siglas = {}
    for fila in sistemas_juego:
        # La fila 0 es un marcador (INVALID) y los sistemas ocultos no aparecen en el mapa del juego.
        if fila["Name"] == "0" or fila["SystemStatus"] == "ESystemStatus::Hidden":
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

    clusteres = {}
    sin_nombre = []
    for id_cluster in sorted({sistema["cluster"] for sistema in sistemas if "cluster" in sistema}):
        nombre = resolver_texto(clusteres_juego[id_cluster]["Name"], tablas)
        if not nombre:
            sin_nombre.append(id_cluster)
        clusteres[id_cluster] = {"name": separar_palabras(nombre or id_cluster)}

    eventos = [
        {"id": evento["asset"], "date": evento["fecha"], "name": NOMBRES_EVENTOS[evento["asset"]]}
        for evento in eventos_juego
        if INICIO < evento["fecha"] <= FIN
    ]

    datos = {
        "range": {"start": INICIO, "end": FIN},
        "colors": {"cluster": color_hex(colores["Warzone"]), "hub": color_hex(colores["Safezone"])},
        "factions": facciones,
        "events": eventos,
        "clusters": clusteres,
        "hubs": {id_centro: {"capital": centro["capital"]} for id_centro, centro in centros.items()},
        "systems": sistemas,
    }
    with open(RUTA_DESTINO, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, separators=(",", ":"))
        archivo.write("\n")

    print(f"{len(sistemas)} sistemas, {len(facciones)} facciones, {len(eventos)} eventos, "
          f"{len(clusteres)} clústeres y {len(centros)} centros industriales")
    if sin_nombre:
        print(f"Aviso: clústeres sin nombre visible: {', '.join(sin_nombre)}")
    capitales_sin_sistema = [id_centro for id_centro, centro in centros.items()
                             if not any(sistema["id"] == centro["capital"] for sistema in sistemas)]
    if capitales_sin_sistema:
        print(f"Aviso: centros industriales con la capital fuera del mapa: {', '.join(capitales_sin_sistema)}")


if __name__ == "__main__":
    main()
