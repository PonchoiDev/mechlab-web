import json
import os
import re

from battletech import leer_json

# Genera src/data/battletech/argo.json, con la Argo de BATTLETECH (Harebrained Schemes, 2018): sus
# mejoras, lo que cuesta cada una, su mantenimiento, sus requisitos y sus efectos, a partir de lo que
# extraer_argo_battletech.py copió de la instalación.
#
#   python3 tools/generar_argo_battletech.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "argo")
RUTA_SALIDA = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "battletech", "argo.json")
PREFIJO = "argoUpgrade_"
# [[DM.SimGameStatDescDefs[SimGameStatDesc_MechTechSkill], Tech Points]] es un enlace del juego a la
# ficha de la estadística: se queda su texto.
REGEX_ENLACE = re.compile(r"\[\[[^\]]*\],\s*([^\]]+)\]\]")
# El juego escribe en cursiva el nombre de la nave con etiquetas de texto enriquecido de Unity
# (<i>Argo</i>); la página enseña texto plano.
REGEX_ETIQUETA = re.compile(r"</?[a-z]+(=[^>]*)?>")
# Los nombres de las estancias no salen en ningún archivo: son los de las pantallas de la nave.
ESTANCIAS = {"ENGINEERING": "Engineering", "MECH_BAY": "Mech Bay", "SHIP": "Ship"}
# Las tres secciones de la pantalla Ship Upgrades, en su orden, con su icono y sus categorías. No
# están en los JSON: son paneles de la interfaz (uixPrbPanl_SystemsAndSupportPanel,
# uixPrfPanlcombatAndDeployment y uixPrfPanl_personnelAndMedical en resources.assets). El reparto, el
# orden y el título de cada caja («Habitat Pods», «Repair & Refit») salen de la pantalla del juego.
SECCIONES = [
    ("SYSTEMS_SUPPORT", "Systems & Support", "typeSystemSupport",
     [("POWER_SYSTEM", "Power System"), ("STRUCTURE", "Structure"), ("DRIVE_SYSTEM", "Drive System"), ("HABITAT_POD", "Habitat Pods")]),
    ("COMBAT_DEPLOYMENT", "Combat & Deployment", "typeCombat",
     [("MECH_BAY", "Mech Bays"), ("REPAIR_REFIT", "Repair & Refit"), ("TRAINING", "Training Modules")]),
    ("PERSONNEL_MEDICAL", "Personnel & Medical", "typePersonnel",
     [("MED_BAY", "Med Bays"), ("RECREATION", "Recreation")]),
]
PREFIJO_ICONO = "uixSvgIcon_shipUpgrade_"


def id_corto(id_juego):
    """mechBay2 en lugar de argoUpgrade_mechBay2: es el que va en la URL."""
    return id_juego.removeprefix(PREFIJO)


def texto_plano(texto):
    return REGEX_ETIQUETA.sub("", texto) if texto else None


def plantilla(texto):
    """Una frase del juego con su valor como {value} o {percent}; None si la frase está vacía."""
    if not texto:
        return None
    texto = REGEX_ENLACE.sub(r"\1", texto)
    return texto.replace("{RES_VALUE.ToPercentString}", "{percent}").replace("{RES_VALUE.ToString}", "{value}")


def leer_estadisticas(descripciones):
    """Las estadísticas que el juego explica en la ficha de una mejora. Las que no tienen frase
    (MechBayPods, BarracksPods, DriveTravelMultiplier) son las internas: el juego enseña su versión
    _Display, que dice lo mismo en cifras legibles (12 'Mechs en lugar de 2 filas)."""
    estadisticas = {}
    for nombre, descripcion in descripciones.items():
        frases = {
            "set": plantilla(descripcion.get("infinitiveSetResult")),
            "positive": plantilla(descripcion.get("infinitivePositiveResult")),
            "negative": plantilla(descripcion.get("infinitiveNegativeResult")),
        }
        if not any(frases.values()):
            continue
        estadisticas[nombre] = {"id": nombre, "name": descripcion["Description"]["Name"],
                                "details": descripcion["Description"]["Details"].strip(), **frases}
    return estadisticas


def reducido(multiplicadores):
    valores = set(multiplicadores.values())
    if len(valores) != 1:
        raise ValueError(f"Reduced Argo Upgrade Costs ya no rebaja igual precio y mantenimiento: {multiplicadores}")
    return valores.pop()


def niveles(mejoras):
    """Nivel de cada mejora en el árbol: 0 si no pide nada y, si no, uno más que su requisito más
    profundo. Es el orden en que se pueden comprar."""
    resultado = {}

    def nivel(id_juego):
        if id_juego not in resultado:
            requisitos = mejoras[id_juego]["RequiredModules"]["items"] or []
            resultado[id_juego] = 1 + max(map(nivel, requisitos)) if requisitos else 0
        return resultado[id_juego]

    for id_juego in mejoras:
        nivel(id_juego)
    return resultado


def main():
    mejoras = {}
    carpeta = os.path.join(RUTA_ORIGEN, "shipUpgrades")
    for nombre in sorted(os.listdir(carpeta)):
        mejora = leer_json(os.path.join(carpeta, nombre))
        mejoras[mejora["Description"]["Id"]] = mejora
    estadisticas = leer_estadisticas(leer_json(os.path.join(RUTA_ORIGEN, "estadisticas.json")))
    tripulacion = leer_json(os.path.join(RUTA_ORIGEN, "tripulacion.json"))
    constantes = leer_json(os.path.join(RUTA_ORIGEN, "constantes.json"))
    categorias = leer_json(os.path.join(RUTA_ORIGEN, "categorias.json"))["enumerationValueList"]
    nombre_categoria = {categoria["Name"]: categoria["FriendlyName"] for categoria in categorias}
    orden_pantalla = [(id_categoria, titulo) for _, _, _, cajas in SECCIONES for id_categoria, titulo in cajas]
    if sorted(id_categoria for id_categoria, _ in orden_pantalla) != sorted(nombre_categoria):
        raise ValueError("Las categorías del juego no son las de la pantalla Ship Upgrades: ¿ha cambiado el juego?")
    posicion_pantalla = {id_categoria: posicion for posicion, (id_categoria, _) in enumerate(orden_pantalla)}

    iniciales_campana = constantes["Story"]["StartingArgoUpgrades"]
    iniciales_carrera = constantes["CareerMode"]["StartingArgoUpgrades"]
    # La página no distingue modos en lo que trae la nave: si un parche lo cambia, hay que verlo.
    if sorted(iniciales_campana) != sorted(iniciales_carrera):
        raise ValueError("La campaña y la carrera empiezan con mejoras distintas: ¿ha cambiado el juego?")
    for id_juego, mejora in mejoras.items():
        for requisito in mejora["RequiredModules"]["items"] or []:
            if requisito not in mejoras:
                raise ValueError(f"{id_juego} pide {requisito}, que no existe")
        if mejora["Requirements"]:
            raise ValueError(f"{id_juego} tiene requisitos de etiquetas, que la página no muestra: ¿ha cambiado el juego?")

    nivel = niveles(mejoras)
    salida = []
    # Como en la pantalla: por caja y, dentro, por id, que es el orden en que el juego carga las
    # mejoras (VersionManifest.csv).
    for id_juego, mejora in sorted(mejoras.items(), key=lambda par: (posicion_pantalla[par[1]["shipUpgradeCategoryID"]], par[0])):
        efectos = [{"stat": estadistica["name"], "value": estadistica["value"], "set": bool(estadistica.get("set"))}
                   for estadistica in mejora.get("Stats") or [] if estadistica["name"] in estadisticas]
        reparto = tripulacion.get(mejora.get("AssignedCastDefId"))
        salida.append({
            "id": id_corto(id_juego),
            "name": mejora["Description"]["Name"],
            "details": texto_plano(mejora["Description"]["Details"]),
            "category": mejora["shipUpgradeCategoryID"],
            "location": mejora["Location"],
            "tier": nivel[id_juego],
            "cost": mejora["PurchaseCost"],
            # AdditionalCost es lo que la mejora suma cada mes al mantenimiento de la nave.
            "upkeep": mejora["AdditionalCost"],
            "requires": [id_corto(requisito) for requisito in mejora["RequiredModules"]["items"] or []],
            "starting": id_juego in iniciales_carrera,
            "image": mejora["Illustration"].removeprefix("uixTxrSpot_"),
            "icon": mejora["Description"]["Icon"].removeprefix(PREFIJO_ICONO),
            "crew": reparto["firstName"].split()[-1] if reparto else None,
            "pitch": texto_plano(mejora.get("AssignedCastDescription")),
            "effects": efectos,
        })

    # Las estadísticas, en el orden en que aparecen en las mejoras: es el del resumen del plan.
    usadas = list(dict.fromkeys(efecto["stat"] for mejora in salida for efecto in mejora["effects"]))
    datos = {
        "baseUpkeep": constantes["Finances"]["ArgoBaseMaintenanceCost"],
        "monthLength": constantes["Finances"]["MonthLength"],
        "careerCostMultiplier": constantes["CareerMode"]["ArgoUpgradeCostMultiplier"],
        "careerUpkeepMultiplier": constantes["CareerMode"]["ArgoMaintenanceMultiplier"],
        # «Reduced Argo Upgrade Costs», de la carrera, cambia los dos multiplicadores al mismo valor.
        "reducedCostMultiplier": reducido(constantes["ReducedArgoUpgradeCosts"]),
        "startingTechPoints": constantes["Story"]["StartingMechTechSkill"],
        "startingMedPoints": constantes["Story"]["StartingMedTechSkill"],
        "startingMorale": constantes["Story"]["StartingMorale"],
        "maxMorale": constantes["Story"]["MaxMorale"],
        "locations": [{"id": id_estancia, "name": nombre} for id_estancia, nombre in ESTANCIAS.items()],
        "sections": [{"id": id_seccion, "name": nombre, "icon": icono, "categories": [id_categoria for id_categoria, _ in cajas]}
                     for id_seccion, nombre, icono, cajas in SECCIONES],
        "categories": [{"id": id_categoria, "name": nombre_categoria[id_categoria], "label": titulo} for id_categoria, titulo in orden_pantalla],
        "crew": [{"id": reparto["firstName"].split()[-1], "name": f"{reparto['firstName']} {reparto['lastName']}", "rank": reparto["rank"]}
                 for reparto in tripulacion.values()],
        "stats": [estadisticas[nombre] for nombre in usadas],
        "upgrades": salida,
    }
    sin_estancia = {mejora["location"] for mejora in salida} - set(ESTANCIAS)
    if sin_estancia:
        raise ValueError(f"Estancias sin nombre: {', '.join(sorted(sin_estancia))}")
    os.makedirs(os.path.dirname(RUTA_SALIDA), exist_ok=True)
    with open(RUTA_SALIDA, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, indent=2)
        archivo.write("\n")
    print(f"{len(salida)} mejoras de la Argo en {RUTA_SALIDA}")


if __name__ == "__main__":
    main()
