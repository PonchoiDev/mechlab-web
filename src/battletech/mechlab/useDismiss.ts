import { useEffect } from 'react';

// Cierra un panel con Escape o con un clic fuera de él, como el ComponentEditor del MechLab de MW5.
// keepOpen es un selector de lo que no lo cierra: el propio panel y los controles que lo abren o que
// se usan con él abierto. Los clics en elementos que ya no están en la página (un botón que desaparece
// al pulsarlo) tampoco lo cierran.
export const useDismiss = (onClose: () => void, keepOpen: string) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Un control que ya usa Escape (el buscador de 'Mechs cierra su lista) lo marca con preventDefault.
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.isConnected || target.closest(keepOpen)) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [onClose, keepOpen]);
};
