import type { ReactNode } from 'react';
import type { Item } from '../types/item';
import { isClanTech } from '../utils/items';

// Lo que necesita el selector de un arma: su nombre, su tecnología y sus niveles. Lo usan los MechLabs de MW5
// y de YAML.
export type TierSelectable = Pick<Item, 'name' | 'techBase' | 'tier'> & { tiers?: Record<string, unknown> | null };

interface TierSelectorProps {
  item: TierSelectable;
  onChange: (tier: string) => void;
}

const PIP_TIERS = ['1', '2', '3', '4'];

export function TierSelector({ item, onChange }: TierSelectorProps) {
  if (isClanTech(item)) {
    return <span className="tier-selector-clan" title="Clan weapons have a single tier">Clan tier</span>;
  }

  const tiers = item.tiers ?? {};
  const selectedTier = item.tier ?? '1';
  const clanTier = Object.keys(tiers).find(tier => tier.toLowerCase() === 'clan');
  const isClan = selectedTier.toLowerCase() === 'clan';
  const isLegendary = selectedTier === '5';
  const tierClass = isClan ? 'tier-selector is-clan' : isLegendary ? 'tier-selector is-legendary' : 'tier-selector';

  const renderButton = (tier: string, label: string, className: string, content?: ReactNode) => (
    <button
      key={tier}
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={selectedTier === tier}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(tier);
      }}
    >
      {content}
    </button>
  );

  const pipClass = (tier: string) => [
    'tier-pip',
    isClan || isLegendary || Number(selectedTier) >= Number(tier) ? 'is-filled' : '',
    selectedTier === tier ? 'is-selected' : ''
  ].filter(Boolean).join(' ');

  return (
    <div role="group" aria-label={`${item.name} tier`} className={tierClass}>
      <span className="tier-selector-label">T</span>
      {'0' in tiers && renderButton('0', 'Tier 0', 'tier-label tier-label-zero', '0')}
      {PIP_TIERS.filter(tier => tier in tiers).map(tier => renderButton(tier, `Tier ${tier}`, pipClass(tier)))}
      {'5' in tiers && renderButton('5', 'Lost Tech tier', 'tier-label tier-label-legendary', '5')}
      {clanTier && renderButton(clanTier, 'Clan tier', 'tier-label tier-label-clan', 'C')}
    </div>
  );
}
