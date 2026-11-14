import csv
import io
import json
import os
import re

# Lectura de la instalación de BATTLETECH (Harebrained Schemes, 2018). Sus datos son JSON sueltos
# dentro de StreamingAssets; la carpeta Mods/ de una instalación con mods no se lee: solo cuenta el
# juego base.
ASSETS = os.path.join("BattleTech_Data", "StreamingAssets")
DATOS = os.path.join(ASSETS, "data")
# Nombre visible y descripción de cada etiqueta, en la base de datos que el juego carga al arrancar.
ETIQUETAS = os.path.join(ASSETS, "MDD", "data", "tagdata.sql")

REGEX_COMENTARIO = re.compile(r"(?m)^\s*//.*$")
REGEX_COMA_FINAL = re.compile(r",(\s*[}\]])")
# Al juego le da igual que falte una coma al final de una línea: CombatGameConstants.json la olvida tras
# una lista y mechdef_javelin_JVN-10A (Urban Warfare) entre dos etiquetas.
REGEX_COMA_QUE_FALTA = re.compile(r"([\]}\"])(\s*\n\s*\")")
REGEX_INSERT = re.compile(r"VALUES \((.*)\);\s*$")


def leer_json(ruta):
    """Un JSON del juego, que admite comas finales, comentarios y alguna coma que falta."""
    with open(ruta, encoding="utf-8-sig") as archivo:
        texto = archivo.read()
    texto = REGEX_COMENTARIO.sub("", texto)
    texto = REGEX_COMA_FINAL.sub(r"\1", texto)
    texto = REGEX_COMA_QUE_FALTA.sub(r"\1,\2", texto)
    return json.loads(texto)


def leer_carpeta(juego, carpeta):
    """Todos los JSON de una carpeta de data/, por nombre de archivo."""
    ruta = os.path.join(juego, DATOS, carpeta)
    return {nombre[: -len(".json")]: leer_json(os.path.join(ruta, nombre))
            for nombre in sorted(os.listdir(ruta)) if nombre.endswith(".json")}


def leer_etiquetas(juego):
    """Etiquetas del juego: id, si el jugador la ve, nombre visible y descripción."""
    etiquetas = {}
    with open(os.path.join(juego, ETIQUETAS), encoding="utf-8-sig") as archivo:
        for linea in archivo:
            coincidencia = REGEX_INSERT.search(linea)
            if not coincidencia or not linea.startswith('INSERT OR REPLACE INTO "Tag"'):
                continue
            nombre, _, visible, visible_nombre, descripcion, _ = next(csv.reader(io.StringIO(coincidencia.group(1))))
            # La primera fila es la cabecera de la hoja de cálculo de la que sale el archivo.
            if nombre == "Tag":
                continue
            etiquetas[nombre] = {"visible": visible == "1", "nombre": visible_nombre, "descripcion": descripcion}
    return etiquetas
