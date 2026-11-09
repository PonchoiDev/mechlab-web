import json
import os
import urllib.parse
import urllib.request

from generar_unidades import ARMADURAS_SARNA, CARRIERS_SARNA, RUTA_UNIDADES, TITULOS_SARNA

# Busca en la API de Sarna la página y el dibujo principal de cada chasis de las unidades enemigas y
# los guarda en tools/datos-juego/unidades/sarna.json, que lee generar_unidades.py. Solo hace falta
# repetirlo si cambia la tabla de títulos o Sarna cambia sus imágenes.
#
#   python3 tools/imagenes_sarna.py
API_SARNA = "https://www.sarna.net/wiki/api.php"
WIKI_SARNA = "https://www.sarna.net/wiki/"
ANCHO_IMAGEN = 600


def consultar(titulos):
    parametros = urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "pageimages", "piprop": "thumbnail",
        "pithumbsize": ANCHO_IMAGEN, "redirects": 1, "titles": "|".join(titulos),
    })
    peticion = urllib.request.Request(f"{API_SARNA}?{parametros}", headers={"User-Agent": "MW-Builder-data-script/1.0"})
    with urllib.request.urlopen(peticion, timeout=30) as respuesta:
        return json.load(respuesta)["query"]


def main():
    titulos = sorted(set(TITULOS_SARNA.values()) | set(CARRIERS_SARNA.values()) | set(ARMADURAS_SARNA.values()))
    consulta = consultar(titulos)
    # Con redirects, la API devuelve la página de destino: se guarda con el título que se pidió.
    destino = {redireccion["from"]: redireccion["to"] for redireccion in consulta.get("redirects", [])}
    paginas = {pagina["title"]: pagina for pagina in consulta["pages"].values()}
    sarna, faltan = {}, []
    for titulo in titulos:
        pagina = paginas.get(destino.get(titulo, titulo))
        if not pagina or "missing" in pagina:
            faltan.append(titulo)
            continue
        sarna[titulo] = {
            "page": WIKI_SARNA + urllib.parse.quote(pagina["title"].replace(" ", "_")),
            "image": (pagina.get("thumbnail") or {}).get("source"),
        }
    with open(os.path.join(RUTA_UNIDADES, "sarna.json"), "w", encoding="utf-8") as archivo:
        archivo.write("{\n" + ",\n".join(f"{json.dumps(titulo)}: {json.dumps(datos, ensure_ascii=False)}"
                                          for titulo, datos in sorted(sarna.items())) + "\n}\n")
    print(f"{len(sarna)} páginas de Sarna, {sum(1 for datos in sarna.values() if datos['image'])} con dibujo")
    for titulo in faltan:
        print(f"Aviso: Sarna no tiene la página {titulo}")


if __name__ == "__main__":
    main()
