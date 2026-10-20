import type { Zone } from '../types/mech';
import type { BuildIssue } from '../utils/issues';

interface BuildStatusProps {
  issues: BuildIssue[];
  onSelectZone: (zone: Zone, hardpointIndex: number | null) => void;
}

export function BuildStatus({ issues, onSelectZone }: BuildStatusProps) {
  return (
    <section className={issues.length > 0 ? 'build-status' : 'build-status is-ready'} aria-label="Build status">
      <span className="build-status-label">
        {issues.length > 0 ? `PENDING · ${issues.length}` : 'BUILD READY'}
      </span>
      {issues.length === 0 ? (
        <span className="build-status-ready">No pending issues: every hardpoint is used, weapons have ammo and armor is maxed.</span>
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
