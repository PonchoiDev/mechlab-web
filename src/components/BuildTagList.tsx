import type { BuildTag } from '../utils/savedBuildsList';

// Tecnología y equipo especial de una build guardada («XL DHS JJ 3 ECM»).
export function BuildTagList({ tags }: { tags: BuildTag[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="builds-item-tags" aria-label={tags.map(tag => tag.title).join(', ')}>
      {tags.map(tag => (
        <span key={tag.label} className={`builds-tag is-${tag.kind}`} title={tag.title}>{tag.label}</span>
      ))}
    </span>
  );
}
