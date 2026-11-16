import json
import os
import re
import sys

# Genera src/data/battletech/flashpoints.json, los flashpoints de BATTLETECH con sus contratos en orden,
# sus caminos y su recompensa, a partir de lo que extraer_flashpoints_battletech.py dejó en
# tools/datos-juego/battletech/flashpoints/. Los sistemas y las facciones salen del mapa de
# BATTLETECH (extraer_mapa_battletech.py) y los 'Mechs del MechLab (extraer_mechlab_battletech.py y
# src/data/battletech/mechs.json, para saber cuáles se pueden abrir en él).
#
#   python3 tools/generar_flashpoints_battletech.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
DATOS_JUEGO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech")
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "battletech")

DURACIONES = {"SHORT": "short", "MEDIUM": "medium", "LONG": "long"}
# Elecciones del jugador en las conversaciones (fp_choice_a…) y, en dos flashpoints, la recompensa que
# elige al final (fp_reward_a…). La de abandonar no lleva a ningún pago.
REGEX_ELECCION = re.compile(r"^fp_(choice|reward)_([a-z]+)$")
ELECCION_ABANDONAR = "fp_choice_cancel"
ACCIONES_CONTRATO = {"Flashpoint_AddContract", "Flashpoint_StartContract"}
# En las acciones de contrato: el id del contrato y el hito al que lleva si se gana.
POSICION_CONTRATO, POSICION_SIGUIENTE = 2, 6
REGEX_MARCADO = re.compile(r"\[\[[^,]*,([^\]]*)\]\]")
REGEX_ETIQUETA_HTML = re.compile(r"</?[a-z]+>")


def leer(*partes):
    with open(os.path.join(*partes), encoding="utf-8") as archivo:
        return json.load(archivo)


def texto_limpio(texto):
    """Los textos del juego enlazan lore con [[DM.BaseDescriptionDefs[LoreX],texto]] y marcan cursivas
    con <i>: se deja el texto."""
    if not texto:
        return None
    return REGEX_ETIQUETA_HTML.sub("", REGEX_MARCADO.sub(r"\1", texto)).strip()


def nombre_de_faccion(facciones, id_faccion):
    """El nombre largo del juego sin el artículo: «the Federated Suns» pasa a «Federated Suns», y «local
    pirate organization» (los piratas de la zona) empieza en mayúscula."""
    nombre = re.sub(r"^the ", "", (facciones.get(id_faccion) or {}).get("nombre") or id_faccion)
    return nombre[:1].upper() + nombre[1:]


def recorrer(hitos, inicio):
    """Todos los caminos del grafo de hitos hasta un final: las elecciones que llevan a él, los contratos
    en orden y el hito con el pago. Los caminos que abandonan el flashpoint se marcan aparte."""
    caminos = []

    def seguir(id_hito, elecciones, contratos, vistos):
        if id_hito in vistos or id_hito not in hitos:
            return
        vistos = vistos | {id_hito}
        resultados = hitos[id_hito]
        es_eleccion = lambda etiqueta: REGEX_ELECCION.match(etiqueta) or etiqueta == ELECCION_ABANDONAR
        ramas = [r for r in resultados if any(es_eleccion(t) for t in r["requisitos"])]
        if ramas:
            # Un hito de bifurcación sigue la opción elegida; el resultado sin condición es lo que pasa si no
            # se elige ninguna de las marcadas (en Flattened Earth, seguir en vez de abandonar), y no añade
            # letra al camino.
            for rama in resultados:
                eleccion = next((t for t in rama["requisitos"] if es_eleccion(t)), None)
                if eleccion is None and rama["requisitos"]:
                    continue
                nuevas = elecciones + ([eleccion] if eleccion else [])
                # La recompensa elegida al final (Yang Virtanen's Big Score) completa el flashpoint en la rama.
                final = next((valor for tipo, valor, _ in rama["acciones"] if tipo == "Flashpoint_CompleteFlashpoint"), None)
                if final:
                    caminos.append({"elecciones": nuevas, "contratos": contratos, "pago": final})
                for siguiente in siguientes(rama):
                    seguir(siguiente, nuevas, contratos, vistos)
            return
        nuevos, proximo, final = list(contratos), None, None
        for resultado in resultados:
            for tipo, valor, extra in resultado["acciones"]:
                if tipo in ACCIONES_CONTRATO:
                    nuevos.append(extra[POSICION_CONTRATO])
                    proximo = extra[POSICION_SIGUIENTE]
                elif tipo == "Flashpoint_SetNextMilestone":
                    proximo = valor
                elif tipo == "Flashpoint_CompleteFlashpoint":
                    final = valor
        if final is not None:
            caminos.append({"elecciones": elecciones, "contratos": nuevos, "pago": final})
        elif proximo:
            seguir(proximo, elecciones, nuevos, vistos)

    def siguientes(resultado):
        return [valor for tipo, valor, _ in resultado["acciones"] if tipo == "Flashpoint_SetNextMilestone"]

    seguir(inicio, [], [], frozenset())
    return caminos


def nombre_de_camino(elecciones):
    """«A» o «A, then B». La recompensa elegida al final no cambia el camino: la ficha la da aparte."""
    partes = [REGEX_ELECCION.match(e).group(2).upper() for e in elecciones if REGEX_ELECCION.match(e).group(1) == "choice"]
    return ", then ".join(partes) if partes else "Main"


def pago(hitos, id_hito, facciones):
    fondos, moral, reputacion = 0, 0, []
    for resultado in hitos.get(id_hito, []):
        for nombre, valor in resultado["pagos"]:
            numero = int(float(valor))
            if nombre == "Funds":
                fondos += numero
            elif nombre == "Morale":
                moral += numero
            elif nombre.startswith("Reputation."):
                reputacion.append({"faction": nombre_de_faccion(facciones, nombre.split(".", 1)[1]), "value": numero})
    return fondos, moral, reputacion


def contrato(contratos, id_contrato):
    datos = contratos[id_contrato]
    objetivos = [o for o in datos.get("objetivos") or [] if o]
    return {
        "id": id_contrato,
        "name": datos["contractName"],
        # Algunos contratos de Urban Warfare no tienen tipo (INVALID_UNSET).
        "type": None if datos["contractType"] == "INVALID_UNSET" else datos["contractType"],
        "objective": objetivos[0] if objetivos else None,
        "description": texto_limpio(datos.get("shortDescription")),
    }


def como_titulo(texto):
    return texto.title() if texto.isupper() else texto


def recompensa(coleccion, mechs_juego, chasis, ids_mechlab):
    if not coleccion:
        return None
    mechs = []
    for id_objeto, tipo, _, _ in coleccion["filas"]:
        if tipo != "Mech" or id_objeto not in mechs_juego:
            continue
        datos_chasis = chasis[mechs_juego[id_objeto]["ChassisID"]]
        nombre = como_titulo((datos_chasis["Description"].get("UIName") or datos_chasis["Description"]["Name"]).strip())
        id_mech = id_objeto.removeprefix("mechdef_")
        mechs.append({"id": id_mech, "name": f"{nombre} {datos_chasis['VariantName']}", "inMechLab": id_mech in ids_mechlab})
    return {"title": coleccion["titulo"], "description": coleccion["descripcion"], "mechs": mechs}


def juntar_caminos(caminos):
    """Dos caminos con los mismos contratos (nombre, tipo y objetivo), el mismo pago y la misma recompensa se juegan igual,
    aunque el juego use contratos distintos para cada uno (The Long Hunt, Yang Virtanen's Big Score): se
    juntan en uno, «A or B, then B»."""
    juntos = {}
    for camino in caminos:
        firma = json.dumps([[(c["name"], c["type"], c["objective"]) for c in camino["contracts"]],
                            camino["funds"], camino["morale"], camino["reputation"], camino["name"], camino["reward"]])
        if firma in juntos:
            juntos[firma]["label"] += f" or {camino['label']}"
        else:
            juntos[firma] = dict(camino)
    return list(juntos.values())


# Recompensa propia de cada camino, cuando la decisión del flashpoint es qué recompensa llevarse. En Yang
# Virtanen's Big Score se elige qué lanza robar y, al final, un 'Mech de su serie (fp_reward_a a d). Los datos
# no unen cada serie con su camino: lo dicen los briefings de sus contratos («We've got the hot rods», «We've
# got the monster trucks»), y se ha comprobado en el juego.
RECOMPENSAS_POR_CAMINO = {
    "yangBigScore": {
        "A": ("Light lance", "itemCollection_loot_UW_yangBigScore_hotrod"),
        "B": ("Heavy lance", "itemCollection_loot_UW_yangBigScore_monster"),
    },
}


def serie(prefijo, colecciones, mechs_juego, chasis, ids_mechlab):
    """Una recompensa a elegir: las colecciones _A a _D de la serie, una por opción, con sus 'Mechs juntos."""
    opciones = [recompensa(colecciones[id_], mechs_juego, chasis, ids_mechlab)
                for id_ in sorted(colecciones) if id_[:-2] == prefijo and id_[-2] == "_"]
    if not opciones:
        raise ValueError(f"No hay colecciones {prefijo}_A…: ¿ha cambiado el juego?")
    return {**opciones[0], "choice": True, "mechs": [mech for opcion in opciones for mech in opcion["mechs"]]}


def main():
    origen = os.path.join(DATOS_JUEGO, "flashpoints")
    flashpoints_juego, hitos, contratos = leer(origen, "flashpoints.json"), leer(origen, "hitos.json"), leer(origen, "contratos.json")
    colecciones = leer(origen, "colecciones.json")
    sistemas = leer(DATOS_JUEGO, "starmap", "sistemas.json")
    facciones = leer(DATOS_JUEGO, "starmap", "facciones.json")
    mechs_juego, chasis = leer(DATOS_JUEGO, "mechlab", "mechs.json"), leer(DATOS_JUEGO, "mechlab", "chasis.json")
    ids_mechlab = {mech["id"] for mech in leer(RUTA_DESTINO, "mechs.json")}
    avisos, resultado = [], []

    for id_juego, fp in sorted(flashpoints_juego.items(), key=lambda par: (("flashpoint", "heavymetal", "urbanwarfare").index(par[1]["fuente"]), par[1]["Description"]["Name"])):
        etiqueta = (fp["LocationRequirements"]["RequirementTags"]["items"] or [None])[0]
        sistema = next((s["nombre"] for s in sistemas if etiqueta in (s.get("etiquetas") or [])), None)
        if sistema is None:
            avisos.append(f"{id_juego}: ningún sistema lleva {etiqueta}")
        conjunto = hitos[fp["MilestoneSetID"]]
        caminos = recorrer(conjunto["hitos"], conjunto["inicio"])
        abandonar = any(ELECCION_ABANDONAR in camino["elecciones"] for camino in caminos)
        caminos = [camino for camino in caminos if ELECCION_ABANDONAR not in camino["elecciones"]]
        # El camino B de Hourglass (Heavy Metal) lleva a HM5_hourglass_b1_3wayBattle, un contrato que no
        # está en ningún archivo del juego, y el B de Bourbon & BattleMechs a uno sin rellenar, con
        # «(required)» en cada campo: no se pueden jugar y no se cuentan.
        for camino in [c for c in caminos if any(id_c not in contratos for id_c in c["contratos"])]:
            faltan = ", ".join(id_c for id_c in camino["contratos"] if id_c not in contratos)
            print(f"Aviso: {id_juego}, camino {nombre_de_camino(camino['elecciones'])}: no se cuenta, sus contratos no están en el juego ({faltan})")
            caminos.remove(camino)
        # Los caminos que solo se distinguen por la recompensa elegida son el mismo; en orden de letra.
        unicos = {}
        for camino in caminos:
            unicos.setdefault((nombre_de_camino(camino["elecciones"]), tuple(camino["contratos"]), camino["pago"]), camino)
        caminos = sorted(unicos.values(), key=lambda c: nombre_de_camino(c["elecciones"]))
        # El tronco: los contratos que todos los caminos hacen al principio.
        tronco = 0
        while caminos and all(len(c["contratos"]) > tronco and c["contratos"][tronco] == caminos[0]["contratos"][tronco] for c in caminos):
            tronco += 1
        requisitos = {"ally": None, "reputation": []}
        for requisito in fp.get("Requirements") or []:
            for etiqueta_req in requisito["RequirementTags"]["items"]:
                if etiqueta_req.startswith("ALLIED_FACTION_"):
                    requisitos["ally"] = nombre_de_faccion(facciones, etiqueta_req.removeprefix("ALLIED_FACTION_"))
            for comparacion in requisito.get("RequirementComparisons") or []:
                if comparacion["obj"].startswith("Reputation.") and comparacion["op"] == "GreaterThan":
                    requisitos["reputation"].append({"faction": nombre_de_faccion(facciones, comparacion["obj"].split(".", 1)[1]),
                                                     "min": int(float(comparacion["val"]))})
        empleador = (fp.get("PotentialEmployers") or [None])[0]
        propias = RECOMPENSAS_POR_CAMINO.get(fp["InternalName"], {})
        resultado.append({
            "id": fp["InternalName"],
            "name": fp["Description"]["Name"],
            "summary": texto_limpio(fp["Description"].get("Details")),
            "description": texto_limpio(fp.get("FlashpointShortDescription")),
            "source": fp["fuente"],
            "difficulty": fp["Difficulty"],
            "length": DURACIONES[fp["FlashpointLength"]],
            "employer": nombre_de_faccion(facciones, empleador) if empleador else None,
            # Sin enemigo conocido (Unknown en Yang Virtanen's Big Score), no se dice.
            "target": nombre_de_faccion(facciones, fp["TargetFaction"]) if fp.get("TargetFaction") not in (None, "Unknown", "INVALID_UNSET") else None,
            "system": sistema,
            "requirements": requisitos,
            "repeatable": bool(fp.get("Repeatable")),
            "cancelable": abandonar,
            "contracts": [contrato(contratos, id_c) for id_c in caminos[0]["contratos"][:tronco]] if caminos else [],
            "paths": juntar_caminos([
                {
                    "label": nombre_de_camino(camino["elecciones"]),
                    "name": propias.get(nombre_de_camino(camino["elecciones"]), (None,))[0],
                    "contracts": [contrato(contratos, id_c) for id_c in camino["contratos"][tronco:]],
                    **dict(zip(("funds", "morale", "reputation"), pago(conjunto["hitos"], camino["pago"], facciones))),
                    "reward": (serie(propias[nombre_de_camino(camino["elecciones"])][1], colecciones, mechs_juego, chasis, ids_mechlab)
                               if nombre_de_camino(camino["elecciones"]) in propias else None),
                }
                for camino in caminos
            ]),
            # Si cada camino da la suya, el flashpoint no tiene una común.
            "reward": None if propias else {**recompensa(colecciones.get(fp.get("RewardCollectionID")), mechs_juego, chasis, ids_mechlab), "choice": False}
            if colecciones.get(fp.get("RewardCollectionID")) else None,
        })

    with open(os.path.join(RUTA_DESTINO, "flashpoints.json"), "w", encoding="utf-8") as archivo:
        json.dump({"flashpoints": resultado}, archivo, ensure_ascii=False, indent=1)
        archivo.write("\n")
    print(f"{len(resultado)} flashpoints, {sum(len(f['paths']) for f in resultado)} caminos")
    for aviso in avisos:
        print(f"Aviso: {aviso}")
    if avisos:
        sys.exit(1)


if __name__ == "__main__":
    main()
