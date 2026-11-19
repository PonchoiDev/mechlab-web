import os
import sys

from extraer_mapa import CONTENIDO, PAK_DEL_JUEGO, escribir_png, reducir
from ue4 import Pak, leer_textura

# Extrae del .pak de la instalación los iconos de las pestañas del inventario del mechlab del juego, para
# las pestañas del inventario del MechLab y los anclajes de cada tarjeta. Son blancos sobre transparente: la
# web los colorea con CSS.

DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ICONOS = os.path.join(DIRECTORIO_SCRIPT, "..", "public", "mechlab", "inventory")
# 48 px, el tamaño de casi todas en el juego: no se agrandan.
TAMANO = 48

# Pestaña del inventario de la web y textura del juego. La artillería (DLC8) usa el icono de su filtro.
ICONOS = {
    "energy": "UI/FrontEnd/Mechlab/Textures/icon_Energy_UIX",
    "ballistic": "UI/FrontEnd/Mechlab/Textures/icon_Ballistic_UIX",
    "missile": "UI/FrontEnd/Mechlab/Textures/icon_Missile_UIX",
    "artillery": "UI/Textures/GenericButtons_Icons/kelpie_UIX_Filter_Icon_ArtilleryMissile",
    "ams": "UI/FrontEnd/Mechlab/Textures/icon_AMS_UIX",
    "melee": "UI/FrontEnd/Mechlab/Textures/Filter_Melee_Icon",
    "equipment": "UI/FrontEnd/Mechlab/Textures/icon_Equipment_UIX",
    # Los anclajes omni (DLC7) no tienen pestaña, pero sí icono de tipo de arma.
    "omni": "DLC7/UI/_common/Textures/Icons/kelpie_UIX_WeaponType_Omni",
}


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 tools/extraer_iconos_inventario.py <carpeta del juego>")
        sys.exit(1)
    pak = Pak(os.path.join(sys.argv[1], PAK_DEL_JUEGO))
    os.makedirs(RUTA_ICONOS, exist_ok=True)
    for nombre, textura in ICONOS.items():
        ancho, alto, pixeles = leer_textura(pak, CONTENIDO + textura)
        if ancho != alto:
            raise ValueError(f"{textura} no es cuadrada ({ancho}×{alto}): ¿ha cambiado el juego?")
        escribir_png(os.path.join(RUTA_ICONOS, nombre + ".png"), TAMANO, reducir(ancho, alto, pixeles, TAMANO))
        print(f"{nombre}: {textura} ({ancho} px)")


if __name__ == "__main__":
    main()
