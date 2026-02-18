"""
Pruebas interactivas para registrar hábitos.
Usa la función real registrar_habitos() de habitos.py pero permite ingresar
mensajes manualmente para testing sin necesidad de Discord.
"""

import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# Importar la función real
from habitos import registrar_habitos


class MockMessage:
    """Mock de un mensaje de Discord para testing."""
    def __init__(self, content):
        self.content = content
        self.author = None


def test_interactivo():
    """
    Script interactivo para probar registrar_habitos.
    Ingresa mensajes y ve los resultados en lugar de que se manden a Discord.
    """
    usuario = "test_user"
    
    logger.info("=" * 70)
    logger.info("PRUEBAS INTERACTIVAS DE REGISTRO DE HÁBITOS")
    logger.info("=" * 70)
    logger.info("\nIngresa mensajes de hábitos para testing.")
    logger.info("Formato esperado: 'hábito: valor unidad'")
    logger.info("Ej: 'agua: 3500ml', 'celular: 1.5h', 'ejercicio: 50min'")
    logger.info("Escribe 'salir' para terminar.\n")
    
    while True:
        try:
            entrada = input(f"\n[{usuario}] > ").strip()
            
            if entrada.lower() in ['salir', 'exit', 'quit']:
                logger.info("\n✅ Saliendo...")
                break
            
            if not entrada:
                continue
            
            # Crear mensaje mock
            msg = MockMessage(entrada)
            
            # Llamar a la función real
            logger.info("\n--- PROCESANDO ---")
            respuestas = registrar_habitos(msg, usuario)
            
            logger.info("--- RESULTADOS ---")
            for resp in respuestas:
                logger.info(resp)
            
        except KeyboardInterrupt:
            logger.info("\n\n✅ Interrumpido por usuario")
            break
        except Exception as e:
            logger.error(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    test_interactivo()
