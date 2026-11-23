// La insignia de MW Builder, la misma de la portada (site/index.html): un hexágono, guiño a los mapas de
// hexágonos de BattleTech, con «MW» dentro. Al pasar el ratón por la marca da media vuelta (headers.css): el
// hexágono queda igual y, al revés, la M es una W y la W una M, así que sigue diciendo MW.
export function BrandMark() {
  return (
    <svg className="brand-hex" viewBox="0 0 44 44" aria-hidden="true">
      <path d="M22 2 39.3 12v20L22 42 4.7 32V12Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M22 8.5 33.7 15.25v13.5L22 35.5 10.3 28.75v-13.5Z" fill="currentColor" opacity=".14" />
      <text x="22" y="27" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="700" fontSize="13" fill="currentColor">MW</text>
    </svg>
  );
}
