import type { Mech } from '../types/mech';
import type { SarnaMechAsset } from '../services/sarna';

interface MechImageProps {
  mech: Mech;
  asset: SarnaMechAsset | null;
  isLoading: boolean;
  onImageError: () => void;
}

export function MechImage({ mech, asset, isLoading, onImageError }: MechImageProps) {
  if (asset?.imageUrl) {
    return (
      <img
        className="mech-image"
        src={asset.imageUrl}
        alt={`${mech.name} ${mech.variant}`}
        onError={onImageError}
      />
    );
  }

  return (
    <p className="image-status">
      {isLoading ? 'Fetching reference from Sarna…' : 'No reference image available.'}
    </p>
  );
}

interface SarnaSourceLinkProps {
  asset: SarnaMechAsset | null;
}

export function SarnaSourceLink({ asset }: SarnaSourceLinkProps) {
  if (!asset) return null;

  return (
    <a className="source-link" href={asset.pageUrl} target="_blank" rel="noreferrer">
      IMAGE SOURCE / SARNA <span aria-hidden="true">↗</span>
    </a>
  );
}
