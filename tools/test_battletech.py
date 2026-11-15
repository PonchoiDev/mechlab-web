import json
import unittest

from battletech import limpiar_json

# Los JSON del juego llevan comentarios, comas finales y alguna coma de menos; el lector los arregla sin
# tocar el texto de las cadenas, que el generador publica tal cual.
#
#   python3 -m unittest discover tools


class LimpiarJson(unittest.TestCase):
    def test_conserva_comas_y_corchetes_dentro_de_las_cadenas(self):
        self.assertEqual(json.loads(limpiar_json('{"Details":"Texto, ]"}')), {"Details": "Texto, ]"})
        self.assertEqual(json.loads(limpiar_json('{"e":"say \\"hi\\", ]"}')), {"e": 'say "hi", ]'})

    def test_quita_comentarios_y_comas_finales_fuera_de_las_cadenas(self):
        texto = '{"a":[1,2,], // nota, ]\n"b":"x // no", /* c, } */}'
        self.assertEqual(json.loads(limpiar_json(texto)), {"a": [1, 2], "b": "x // no"})

    def test_anade_la_coma_que_falta_al_final_de_una_linea(self):
        texto = '{"t":["a"\n"b"],\n"c":[1]\n"d":2}'
        self.assertEqual(json.loads(limpiar_json(texto)), {"t": ["a", "b"], "c": [1], "d": 2})


if __name__ == "__main__":
    unittest.main()
