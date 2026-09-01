import type { RepographData } from "./data";
import type { FileStatus } from "./graphModel";

export type FilterMode = "all" | "cycles" | "dead";

export interface SidebarProps {
  data: RepographData;
  query: string;
  onQuery: (q: string) => void;
  filterMode: FilterMode;
  onFilterMode: (m: FilterMode) => void;
  selected: string | null;
  onSelect: (path: string) => void;
  statuses: Map<string, FileStatus>;
}

export function Sidebar({ data, query, onQuery, filterMode, onFilterMode, selected, onSelect, statuses }: SidebarProps) {
  const q = query.trim().toLowerCase();
  const files = data.nodes
    .filter((n) => (q ? n.path.toLowerCase().includes(q) : true))
    .filter((n) => {
      const status = statuses.get(n.path);
      if (filterMode === "cycles") return status?.isInCycle;
      if (filterMode === "dead") return status?.isDead;
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return (
    <aside className="sidebar">
      <div className="sidebar-stats">
        <div className="stat">
          <span className="stat-value">{data.fileCount}</span>
          <span className="stat-label">files</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.edgeCount}</span>
          <span className="stat-label">edges</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.cycles.length}</span>
          <span className="stat-label">cycles</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.deadExports.length}</span>
          <span className="stat-label">dead exports</span>
        </div>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Filter files…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        aria-label="Filter files by path"
      />

      <div className="filter-tabs" role="tablist" aria-label="File filter">
        {(["all", "cycles", "dead"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={filterMode === mode}
            className={`filter-tab ${filterMode === mode ? "active" : ""}`}
            onClick={() => onFilterMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <ul className="file-list" aria-label="Files">
        {files.length === 0 && <li className="file-list-empty">No files match.</li>}
        {files.map((n) => {
          const status = statuses.get(n.path);
          return (
            <li key={n.path}>
              <button
                type="button"
                className={`file-item ${selected === n.path ? "selected" : ""}`}
                onClick={() => onSelect(n.path)}
                title={n.path}
              >
                <span className="file-path">{n.path}</span>
                <span className="file-badges">
                  {status?.isInCycle && (
                    <span className="badge badge-cycle" title="In an import cycle">
                      cycle
                    </span>
                  )}
                  {status?.isDead && (
                    <span className="badge badge-dead" title="No exports are imported anywhere">
                      dead
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
