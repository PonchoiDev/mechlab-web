import csv
import io
import json
import os
import sys

from battletech import DATOS, leer_json_texto
from unityfs import textos_del_bundle

# Extrae de la instalación de BATTLETECH los flashpoints de los DLC (Flashpoint, Heavy Metal y Urban
# Warfare): su definición, su grafo de hitos, sus contratos y la colección de su recompensa final. Todo
# está en los bundles de Unity de los DLC; algunas colecciones de recompensa son del juego base
# (data/itemCollections/). Lo deja en tools/datos-juego/battletech/flashpoints/ y
# generar_flashpoints_battletech.py trabaja con esos archivos sin tocar el juego.
#
#   python3 tools/extraer_flashpoints_battletech.py "/ruta/a/BATTLETECH"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "flashpoints")
DLC = ("flashpoint", "heavymetal", "urbanwarfare")
# Del contrato solo cuenta lo que se lee: el resto es la configuración del combate.
CAMPOS_CONTRATO = ("contractName", "contractType", "shortDescription", "longDescription", "salvagePotential")


def leer_coleccion(texto):
    """Una colección de objetos: la primera fila es su id, su nombre, su título y su descripción; las
    demás, lo que trae (id, tipo, cantidad y peso)."""
    filas = [fila for fila in csv.reader(io.StringIO(texto)) if fila]
    _, nombre, titulo, descripcion = (filas[0] + ["", "", "", ""])[:4]
    return {"nombre": nombre, "titulo": titulo, "descripcion": descripcion,
            "filas": [[fila[0], fila[1], int(fila[2]), int(fila[3])] for fila in filas[1:] if len(fila) >= 4]}


def etiquetas(conjunto):
    return ((conjunto or {}).get("items")) or []


def hitos_limpios(conjunto):
    """Del grafo de hitos solo cuenta lo que lleva de uno a otro: los requisitos de cada resultado (la
    elección del jugador), las etiquetas que añade, sus acciones (siguiente hito, contrato, conversación,
    final) y lo que paga. El resto es configuración de la interfaz."""
    hitos = {}
    for hito in conjunto.get("Milestones") or []:
        resultados = []
        for resultado in hito.get("Results") or []:
            requisitos = resultado.get("Requirements") or {}
            resultados.append({
                "requisitos": etiquetas(requisitos.get("RequirementTags")),
                "comparaciones": [[c.get("obj"), c.get("op"), c.get("val")] for c in requisitos.get("RequirementComparisons") or []],
                "etiquetas": etiquetas(resultado.get("AddedTags")),
                "acciones": [[accion["Type"], accion.get("value"), accion.get("additionalValues")] for accion in resultado.get("Actions") or []],
                "pagos": [[estadistica.get("name"), estadistica.get("value")] for estadistica in resultado.get("Stats") or []],
            })
        hitos[hito["Description"]["Id"]] = resultados
    return {"inicio": conjunto.get("StartingMilestoneID"), "hitos": hitos}


def contrato(objeto):
    limpio = {campo: objeto.get(campo) for campo in CAMPOS_CONTRATO}
    limpio["objetivos"] = [objetivo.get("title") for objetivo in objeto.get("contractObjectiveList") or []]
    return limpio


def main():
    if len(sys.argv) != 2:
        print('Uso: python3 tools/extraer_flashpoints_battletech.py "<carpeta del juego>"')
        sys.exit(1)
    juego = sys.argv[1]
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    flashpoints, hitos, contratos, colecciones = {}, {}, {}, {}

    for fuente in DLC:
        for nombre, contenido in sorted(textos_del_bundle(os.path.join(juego, DATOS, "assetbundles", fuente)).items()):
            texto = contenido.decode("utf-8-sig") if isinstance(contenido, bytes) else contenido
            if nombre.startswith("fp_"):
                flashpoints[nombre] = {"fuente": fuente, **leer_json_texto(texto)}
            elif nombre.startswith("ms_"):
                hitos[nombre] = hitos_limpios(leer_json_texto(texto))
            elif nombre.startswith("itemCollection_"):
                colecciones[nombre] = leer_coleccion(texto)
            elif texto.lstrip().startswith("{") and '"contractName"' in texto:
                # Los contratos del DLC Flashpoint empiezan por c_; los de Heavy Metal y Urban Warfare
                # no (HM1_ofUnknownOrigin_1_captureBase): se reconocen por su contenido.
                contratos[nombre] = contrato(leer_json_texto(texto))

    # Las recompensas que no trae el DLC son colecciones del juego base.
    for flashpoint in flashpoints.values():
        id_coleccion = flashpoint.get("RewardCollectionID")
        ruta = os.path.join(juego, DATOS, "itemCollections", f"{id_coleccion}.csv")
        if id_coleccion and id_coleccion not in colecciones and os.path.exists(ruta):
            with open(ruta, encoding="utf-8-sig") as archivo:
                colecciones[id_coleccion] = leer_coleccion(archivo.read())
    usadas = {flashpoint.get("RewardCollectionID") for flashpoint in flashpoints.values()}
    # Además de la recompensa que declara cada flashpoint, las colecciones que llevan su nombre: Yang
    # Virtanen's Big Score da una serie por camino (itemCollection_loot_UW_yangBigScore_hotrod_A a _D y
    # monster_A a _D), y el flashpoint solo declara la primera.
    nombres = [flashpoint.get("InternalName") for flashpoint in flashpoints.values() if flashpoint.get("InternalName")]
    colecciones = {id_: coleccion for id_, coleccion in colecciones.items()
                   if id_ in usadas or any(f"_{nombre}_" in id_ for nombre in nombres)}

    for nombre, datos in (("flashpoints", flashpoints), ("hitos", hitos), ("contratos", contratos), ("colecciones", colecciones)):
        with open(os.path.join(RUTA_DESTINO, f"{nombre}.json"), "w", encoding="utf-8") as archivo:
            json.dump(datos, archivo, ensure_ascii=False, indent=1, sort_keys=True)
            archivo.write("\n")
    print(f"flashpoints: {len(flashpoints)} · hitos: {len(hitos)} · contratos: {len(contratos)} · colecciones: {len(colecciones)}")
    faltan = sorted(usadas - set(colecciones))
    if faltan:
        print(f"Aviso: colecciones de recompensa que no están en el juego: {', '.join(faltan)}")


if __name__ == "__main__":
    main()
