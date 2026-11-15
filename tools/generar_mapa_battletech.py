import json
import os
import re
import sys
from collections import Counter

# Genera src/data/battletech/starmap.json para el mapa estelar de BATTLETECH a partir de lo que extrae
# extraer_mapa_battletech.py (tools/datos-juego/battletech/starmap/).
#
# El archivo sigue la forma de StarmapData, el tipo del mapa de MW5 Mercenaries, para reutilizar su
# lienzo (territorios, zoom, buscador y marcas): una sola fecha, un dueño por sistema y sin HRQ,
# mercados, zonas ni el resto. Lo propio de BATTLETECH va en "details", por sistema.
#
#   python3 tools/generar_mapa_battletech.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "starmap")
RUTA_LOGOS = os.path.join(DIRECTORIO_SCRIPT, "..", "battletech", "public", "starmap", "logos")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "battletech", "starmap.json")

# El mapa de BATTLETECH no cambia con la fecha: la usa solo el lienzo compartido con MW5.
FECHA = "3025-01-01"
MODO = "CAREER"
# Locals y NoFaction no traen color de mapa (factionMapColor): el juego los pinta sin color de
# facción, así que van en un gris neutro. El mismo valor está en src/utils/battletech/starmap.ts.
COLOR_NEUTRO = "#9aa3b2"
REGEX_RGBA = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")
# Etiquetas que el jugador ve pero que no describen el planeta: el nombre, la facción (ya está el
# dueño) y el progreso de la campaña.
REGEX_ETIQUETA_INTERNA = re.compile(r"^planet_(name|faction|progress)_")
# El mercado negro y la sede de una facción ya salen como tiendas en la ficha.
REGEX_ETIQUETA_DE_TIENDA = re.compile(r"^planet_other_(blackmarket|factionhq_)")
# Orden de los grupos en la ficha, por el prefijo de la etiqueta.
ORDEN_ETIQUETAS = ["planet_climate_", "planet_size_", "planet_pop_", "planet_civ_", "planet_industry_",
                   "planet_other_", "planet_feature_"]
# El juego no tiene nombre visible para los biomas de los mapas: se escriben a partir de su id.
BIOMAS = {
    "badlandsParched": "Badlands", "desertParched": "Desert", "highlandsFall": "Highlands (fall)",
    "highlandsSpring": "Highlands (spring)", "jungleTropical": "Jungle", "lowlandsFall": "Lowlands (fall)",
    "lowlandsSpring": "Lowlands (spring)", "lunarVacuum": "Lunar", "martianVacuum": "Martian",
    "polarFrozen": "Polar", "tundraFrozen": "Tundra", "urbanHighTech": "Urban",
}


def leer(nombre):
    with open(os.path.join(RUTA_ORIGEN, nombre), encoding="utf-8") as archivo:
        return json.load(archivo)


def color_hex(texto):
    coincidencia = REGEX_RGBA.match(texto or "")
    if not coincidencia:
        return COLOR_NEUTRO
    return "#" + "".join(f"{int(valor):02x}" for valor in coincidencia.groups())


def nombre_de_faccion(faccion, id_faccion):
    # El juego los escribe para usarlos dentro de frases: con artículo («the Capellan Confederation») y
    # alguno en minúscula («local pirate organization»).
    nombre = re.sub(r"^the\s+", "", faccion.get("nombre") or id_faccion)
    return nombre[:1].upper() + nombre[1:]


def orden_de_etiqueta(id_etiqueta):
    return next((indice for indice, prefijo in enumerate(ORDEN_ETIQUETAS) if id_etiqueta.startswith(prefijo)), len(ORDEN_ETIQUETAS))


def main():
    sistemas_juego = leer("sistemas.json")
    facciones_juego = leer("facciones.json")
    etiquetas = leer("etiquetas.json")
    avisos = []

    # Una ficha por sistema: la de carrera. Las demás son de la campaña según su progreso.
    de_carrera = sorted((s for s in sistemas_juego if MODO in s["modos"]), key=lambda s: s["nombre"])
    repetidos = [nombre for nombre, veces in Counter(s["nombre"] for s in de_carrera).items() if veces > 1]
    if repetidos:
        raise ValueError(f"Sistemas con dos fichas de carrera: {', '.join(repetidos)}: ¿ha cambiado el juego?")

    usadas = {s["dueno"] for s in de_carrera} | {f for s in de_carrera for f in s["empleadores"] + s["objetivos"]}
    usadas |= {s["tienda_faccion"] for s in de_carrera if s["tienda_faccion"] not in (None, "INVALID_UNSET")}
    facciones = {}
    for id_faccion in sorted(usadas):
        faccion = facciones_juego.get(id_faccion)
        if faccion is None:
            avisos.append(f"facción {id_faccion} sin ficha")
            faccion = {}
        entrada = {
            "name": nombre_de_faccion(faccion, id_faccion),
            "short": faccion.get("corto") or id_faccion,
            "color": color_hex(faccion.get("color")),
        }
        icono = faccion.get("icono")
        if icono and os.path.exists(os.path.join(RUTA_LOGOS, f"{icono}.png")):
            entrada["logo"] = f"{icono}.png"
        facciones[id_faccion] = entrada

    sistemas, detalles = [], {}
    for indice, ficha in enumerate(de_carrera, start=1):
        sistemas.append({"id": indice, "name": ficha["nombre"], "x": round(ficha["x"], 2), "y": round(ficha["y"], 2),
                         "owners": [[FECHA, ficha["dueno"]]]})
        visibles = [id_etiqueta for id_etiqueta in ficha["etiquetas"]
                    if etiquetas.get(id_etiqueta, {}).get("visible") and not REGEX_ETIQUETA_INTERNA.match(id_etiqueta)
                    and not REGEX_ETIQUETA_DE_TIENDA.match(id_etiqueta)]
        # Las marcas de los Flashpoint (planet_bellerophon_fp_whitelies) no tienen nombre: no se enseñan.
        avisos += [f"{ficha['nombre']}: etiqueta {e} sin nombre" for e in ficha["etiquetas"]
                   if e not in etiquetas and not REGEX_ETIQUETA_INTERNA.match(e) and "_fp_" not in e]
        tienda = ficha["tienda_faccion"]
        detalles[indice] = {
            "description": ficha["descripcion"].strip(),
            "difficulty": ficha["dificultad"].get(MODO, 0),
            "tags": [{"id": e, "name": etiquetas[e]["nombre"], "description": etiquetas[e]["descripcion"]}
                     for e in sorted(visibles, key=orden_de_etiqueta)],
            # Tiene mercado negro si su ficha trae inventario para él (BlackMarketShopItems).
            "blackMarket": bool(ficha["mercado_negro"]),
            "factionStore": tienda if tienda not in (None, "INVALID_UNSET") else None,
            "employers": ficha["empleadores"],
            "targets": ficha["objetivos"],
            "biomes": [BIOMAS.get(bioma, bioma) for bioma in ficha["biomas"]],
        }
        avisos += [f"{ficha['nombre']}: bioma {b} sin nombre" for b in ficha["biomas"] if b not in BIOMAS]

    datos = {
        "range": {"start": FECHA, "end": FECHA},
        "colors": {"cluster": "#ffffff", "hub": "#ffffff"},
        "factions": facciones,
        "events": [],
        "clusters": {},
        "hubs": {},
        "systems": sistemas,
        "quests": [],
        "markets": [],
        "uniqueMechs": [],
        "rewards": [],
        "campaigns": [],
        "arenas": {"systems": [], "ranks": []},
        "mercs": {"companies": {}, "zones": []},
        "academies": [],
        "trainingPrograms": {},
        "details": detalles,
    }
    ruta = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, separators=(",", ":"))
        archivo.write("\n")
    print(f"{len(sistemas)} sistemas y {len(facciones)} facciones en {ruta}")
    for aviso in sorted(set(avisos)):
        print(f"Aviso: {aviso}")


if __name__ == "__main__":
    main()
