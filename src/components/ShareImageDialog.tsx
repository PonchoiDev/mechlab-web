import { useEffect, useState } from 'react';
import { canCopyImages, copyImage } from '../services/clipboard';

// Lo usan los dos MechLabs: cada uno dibuja su imagen (src/services/buildImage.ts para MW5 y
// src/services/battletech/buildImage.ts para BATTLETECH) y el diálogo la enseña, la descarga o la copia.
interface ShareImageDialogProps {
  render: () => Promise<Blob>;
  // Nombre del archivo que se descarga y texto alternativo de la vista previa.
  fileName: string;
  alt: string;
  // Mientras Sarna no responde no se dibuja, para no generar primero una imagen sin el mech.
  isImageLoading?: boolean;
  buildUrl: string;
  onCopyLink: () => void;
  onMessage: (message: string) => void;
  onClose: () => void;
}

type ImageState =
  | { status: 'rendering' }
  | { status: 'ready'; blob: Blob; url: string }
  | { status: 'failed' };

export function ShareImageDialog({ render, fileName, alt, isImageLoading = false, buildUrl, onCopyLink, onMessage, onClose }: ShareImageDialogProps) {
  const [image, setImage] = useState<ImageState>({ status: 'rendering' });

  useEffect(() => {
    if (isImageLoading) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    render()
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ status: 'ready', blob, url: objectUrl });
      })
      .catch(() => !cancelled && setImage({ status: 'failed' }));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [render, isImageLoading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyBuildImage = async () => {
    if (image.status !== 'ready') return;
    onMessage(await copyImage(image.blob) ? 'Build image copied' : 'Your browser cannot copy images. Use Download instead');
  };

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <header className="share-dialog-header">
          <h2 id="share-dialog-title">Build image</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <div className="share-dialog-preview">
          {image.status === 'ready' && <img src={image.url} alt={alt} />}
          {image.status === 'rendering' && <p>Rendering image…</p>}
          {image.status === 'failed' && <p>The image could not be generated.</p>}
        </div>

        <p className="share-dialog-hint">
          Post the image and paste the build link next to it so others can open the build.
          {!canCopyImages() && ' Copying images needs a secure (HTTPS) connection here, so download the PNG instead.'}
        </p>
        <div className="share-dialog-link">
          <input type="text" readOnly value={buildUrl} aria-label="Build link" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="utility-button" onClick={onCopyLink}>Copy link</button>
        </div>

        <footer className="share-dialog-actions">
          {image.status === 'ready' ? (
            <a className="utility-button" href={image.url} download={fileName}>Download PNG</a>
          ) : (
            <button type="button" className="utility-button" disabled>Download PNG</button>
          )}
          <button
            type="button"
            className="utility-button utility-button-primary"
            disabled={image.status !== 'ready' || !canCopyImages()}
            title={canCopyImages() ? undefined : 'Copying images needs a secure (HTTPS) connection'}
            onClick={copyBuildImage}
          >
            Copy image
          </button>
        </footer>
      </section>
    </div>
  );
}
