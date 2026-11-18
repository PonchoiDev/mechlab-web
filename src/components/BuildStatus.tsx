import type { Zone } from '../types/mech';
import type { BuildIssue } from '../utils/issues';

interface BuildStatusProps {
  issues: BuildIssue[];
  onSelectZone: (zone: Zone, hardpointIndex: number | null) => void;
  // Lo que dice la barra sin problemas: cada MechLab tiene sus propias comprobaciones.
  readyMessage?: string;
}

const MERCS_READY_MESSAGE = 'Nothing to note: every hardpoint is used, weapons have ammo and armor is maxed.';

export function BuildStatus({ issues, onSelectZone, readyMessage = MERCS_READY_MESSAGE }: BuildStatusProps) {
  return (
    <section className={issues.length > 0 ? 'build-status' : 'build-status is-ready'} aria-label="Build status">
      <span className="build-status-label">
        {/* Avisos, no tareas: una build puede dejar anclajes libres o armadura sin llenar a propósito. */}
        {issues.length > 0 ? `NOTICES · ${issues.length}` : 'BUILD READY'}
      </span>
      {issues.length === 0 ? (
        <span className="build-status-ready">{readyMessage}</span>
      ) : (
        <ul className="build-status-issues">
          {issues.map(issue => (
            <li key={issue.id}>
              {issue.zone ? (
                <button
                  type="button"
                  className={`build-issue is-${issue.severity}`}
                  onClick={() => onSelectZone(issue.zone as Zone, issue.hardpointIndex ?? null)}
                >
                  {issue.message}
                </button>
              ) : (
                <span className={`build-issue is-${issue.severity}`}>{issue.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
