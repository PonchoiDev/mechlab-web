// La API del portapapeles solo existe en contextos seguros (HTTPS o localhost). Fuera de ellos,
// por ejemplo al abrir el servidor de desarrollo con la IP del equipo, el texto se copia con el
// método antiguo; las imágenes no tienen alternativa.
export const canCopyImages = (): boolean =>
  window.isSecureContext && typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined';

const copyTextFallback = (text: string): boolean => {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
};

export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Si el navegador lo rechaza, se intenta con el método antiguo.
    }
  }
  return copyTextFallback(text);
};

export const copyImage = async (blob: Blob): Promise<boolean> => {
  if (!canCopyImages()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
};
