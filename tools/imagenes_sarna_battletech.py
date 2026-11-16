import json
import os
import urllib.parse

from generar_unidades_battletech import RUTA_ORIGEN, TITULOS_SARNA
from imagenes_sarna import WIKI_SARNA, consultar

# Busca en la API de Sarna la página y el dibujo principal de cada chasis de los vehículos de BATTLETECH
# y los guarda en tools/datos-juego/battletech/unidades/sarna.json, que lee
# generar_unidades_battletech.py. Solo hace falta repetirlo si cambia la tabla de títulos.
#
#   python3 tools/imagenes_sarna_battletech.py


def main():
    titulos = sorted(set(TITULOS_SARNA.values()))
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
    with open(os.path.join(RUTA_ORIGEN, "sarna.json"), "w", encoding="utf-8") as archivo:
        archivo.write("{\n" + ",\n".join(f"{json.dumps(titulo)}: {json.dumps(datos, ensure_ascii=False)}"
                                          for titulo, datos in sorted(sarna.items())) + "\n}\n")
    print(f"{len(sarna)} páginas de Sarna, {sum(1 for datos in sarna.values() if datos['image'])} con dibujo")
    for titulo in faltan:
        print(f"Aviso: Sarna no tiene la página {titulo}")


if __name__ == "__main__":
    main()
