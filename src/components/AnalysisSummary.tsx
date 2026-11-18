import type { ReactNode } from 'react';

// Las cifras principales de la build, en la columna lateral del análisis de los dos MechLabs: arriba de la
// página dejaban lejos el selector de 'Mech de los avisos y los menús de la build.
export function AnalysisSummary({ children }: { children: ReactNode }) {
  return (
    <div className="analysis-summary">
      <header className="analysis-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h2>Build summary</h2>
        </div>
      </header>
      {children}
    </div>
  );
}
