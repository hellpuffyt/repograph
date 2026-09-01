import type { RepographData } from "./data";
import { blastRadiusFor, type FileStatus } from "./graphModel";

export interface DetailsPanelProps {
  data: RepographData;
  path: string | null;
  status: FileStatus | undefined;
  onSelect: (path: string) => void;
}

export function DetailsPanel({ data, path, status, onSelect }: DetailsPanelProps) {
  if (!path) {
    return (
      <aside className="details-panel details-empty">
        <p>Select a file to see its exports, dependencies, and blast radius.</p>
      </aside>
    );
  }

  const node = data.nodes.find((n) => n.path === path);
  if (!node) {
    return (
      <aside className="details-panel details-empty">
        <p>File not found in the current graph.</p>
      </aside>
    );
  }

  const radius = blastRadiusFor(data, path);
  const deadNames = status?.deadExportNames ?? new Set<string>();

  return (
    <aside className="details-panel">
      <h2 className="details-path">{node.path}</h2>
      <div className="details-badges">
        {status?.isInCycle && <span className="badge badge-cycle">in cycle</span>}
        {status?.isDead && <span className="badge badge-dead">fully dead</span>}
        <span className="badge badge-neutral">{node.lineCount} lines</span>
      </div>

      <section className="details-section">
        <h3>
          API surface <span className="count">({node.exports.length})</span>
        </h3>
        {node.exports.length === 0 ? (
          <p className="muted">No exports.</p>
        ) : (
          <ul className="export-list">
            {node.exports.map((exp) => (
              <li key={`${exp.name}-${exp.line}`} className={deadNames.has(exp.name) ? "dead" : ""}>
                <code>
                  {exp.kind} {exp.name}
                </code>
                <span className="line">L{exp.line}</span>
                {deadNames.has(exp.name) && <span className="badge badge-dead badge-sm">unused</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="details-section">
        <h3>
          Depends on <span className="count">({node.dependsOn.length})</span>
        </h3>
        {node.dependsOn.length === 0 ? (
          <p className="muted">No internal dependencies.</p>
        ) : (
          <ul className="ref-list">
            {node.dependsOn.map((p) => (
              <li key={p}>
                <button type="button" className="link-button" onClick={() => onSelect(p)}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
        )}
        {node.externalImports.length > 0 && (
          <p className="muted external-list">external: {node.externalImports.join(", ")}</p>
        )}
      </section>

      <section className="details-section">
        <h3>
          Blast radius <span className="count">({radius.affected.length} files)</span>
        </h3>
        {radius.levels.length === 0 ? (
          <p className="muted">Nothing depends on this file.</p>
        ) : (
          <>
            {radius.consumedExports.length > 0 && (
              <p className="muted">consumed exports: {radius.consumedExports.join(", ")}</p>
            )}
            {radius.levels.map((level, i) => (
              <div key={i} className="blast-hop">
                <h4>hop {i + 1}</h4>
                <ul className="ref-list">
                  {level.map((p) => (
                    <li key={p}>
                      <button type="button" className="link-button" onClick={() => onSelect(p)}>
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>
    </aside>
  );
}
