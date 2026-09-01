import { useEffect, useMemo, useState } from "react";
import { GraphCanvas } from "./GraphCanvas";
import { Sidebar, type FilterMode } from "./Sidebar";
import { DetailsPanel } from "./DetailsPanel";
import { blastRadiusFor, computeFileStatuses } from "./graphModel";
import type { RepographData } from "./data";

type Theme = "light" | "dark";

const LIGHT = {
  node: "#5b6472",
  nodeDead: "#c94040",
  nodeCycle: "#d9822b",
  nodeSelected: "#2f6fed",
  nodeHighlighted: "#2f6fed",
  edge: "#8a94a3",
  edgeHighlighted: "#2f6fed",
  text: "#12151b",
  background: "#f7f8fa",
};

const DARK = {
  node: "#9aa4b2",
  nodeDead: "#ef6f6f",
  nodeCycle: "#f0a94e",
  nodeSelected: "#63a1ff",
  nodeHighlighted: "#63a1ff",
  edge: "#4a5568",
  edgeHighlighted: "#63a1ff",
  text: "#f2f4f8",
  background: "#12151b",
};

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("repograph-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      /* ignore storage errors (private browsing, etc.) */
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("repograph-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}

function EmptyState() {
  return (
    <div className="state-screen">
      <h1>repograph</h1>
      <p>No analysis data was found.</p>
      <p className="muted">
        Run <code>repograph html &lt;dir&gt; --out map.html</code> or{" "}
        <code>repograph serve &lt;dir&gt;</code> to generate a graph for a real project.
      </p>
    </div>
  );
}

export function App({ data }: { data: RepographData | null }) {
  const [theme, setTheme] = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const statuses = useMemo(() => (data ? computeFileStatuses(data) : new Map()), [data]);

  const highlighted = useMemo(() => {
    if (!data || !selected) return new Set<string>();
    const radius = blastRadiusFor(data, selected);
    return new Set([selected, ...radius.affected]);
  }, [data, selected]);

  const filtered = useMemo(() => {
    if (!data) return null;
    if (filterMode === "all") return null;
    const set = new Set<string>();
    for (const node of data.nodes) {
      const status = statuses.get(node.path);
      if (filterMode === "cycles" && status?.isInCycle) set.add(node.path);
      if (filterMode === "dead" && status?.isDead) set.add(node.path);
    }
    return set;
  }, [data, filterMode, statuses]);

  if (!data) {
    return (
      <div className="app">
        <EmptyState />
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="app">
        <div className="state-screen">
          <h1>{data.projectName}</h1>
          <p>No source files were found under this project.</p>
        </div>
      </div>
    );
  }

  const colors = theme === "dark" ? DARK : LIGHT;

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          repograph <span className="project-name">{data.projectName}</span>
        </h1>
        <div className="header-meta">
          <span className="muted">{new Date(data.generatedAt).toLocaleString()}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? "light mode" : "dark mode"}
          </button>
        </div>
      </header>
      <div className="app-body">
        <Sidebar
          data={data}
          query={query}
          onQuery={setQuery}
          filterMode={filterMode}
          onFilterMode={setFilterMode}
          selected={selected}
          onSelect={setSelected}
          statuses={statuses}
        />
        <main className="graph-area">
          <GraphCanvas
            data={data}
            selected={selected}
            highlighted={highlighted}
            filtered={filtered}
            onSelect={setSelected}
            colors={colors}
            statusOf={(p) => statuses.get(p) ?? { isDead: false, isInCycle: false }}
          />
          <p className="graph-hint muted">
            Drag to move a node, scroll to zoom, drag empty space to pan. Click a node to see its blast radius.
          </p>
        </main>
        <DetailsPanel data={data} path={selected} status={selected ? statuses.get(selected) : undefined} onSelect={setSelected} />
      </div>
    </div>
  );
}
