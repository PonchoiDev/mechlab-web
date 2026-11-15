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

REGEX_INSERT = re.compile(r"VALUES \((.*)\);\s*$")


def limpiar_json(texto):
    """Quita lo que el juego admite y json no: comentarios (// y /* */), comas finales y la coma que a
    veces falta al final de una línea (CombatGameConstants.json la olvida tras una lista y
    mechdef_javelin_JVN-10A, de Urban Warfare, entre dos etiquetas). Solo fuera de las cadenas: dentro,
    las comas, las barras y los corchetes son parte del texto que después se publica."""
    salida = []
    ultimo = ""          # último carácter con significado (ni espacio ni comentario)
    coma = -1            # posición en salida de la última coma escrita
    salto = False        # si ha habido un salto de línea desde ese carácter
    i, n = 0, len(texto)
    while i < n:
        caracter = texto[i]
        if caracter == '"':
            fin = i + 1
            while fin < n and texto[fin] != '"':
                fin += 2 if texto[fin] == "\\" else 1
            if salto and ultimo in '"]}':
                salida.append(",")
            salida.append(texto[i:fin + 1])
            ultimo, salto, i = '"', False, fin + 1
        elif texto.startswith("//", i):
            while i < n and texto[i] != "\n":
                i += 1
        elif texto.startswith("/*", i):
            fin = texto.find("*/", i + 2)
            i = n if fin < 0 else fin + 2
        elif caracter.isspace():
            salida.append(caracter)
            salto = salto or caracter == "\n"
            i += 1
        else:
            if caracter in "]}" and ultimo == ",":
                salida[coma] = ""
            if caracter == ",":
                coma = len(salida)
            salida.append(caracter)
            ultimo, salto, i = caracter, False, i + 1
    return "".join(salida)


def leer_json(ruta):
    """Un JSON del juego, que admite comas finales, comentarios y alguna coma que falta."""
    with open(ruta, encoding="utf-8-sig") as archivo:
        return json.loads(limpiar_json(archivo.read()))


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
