import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { RepographData } from "./data";
import "./styles.css";

function resolveData(): RepographData | null {
  if (typeof window !== "undefined" && window.__REPOGRAPH_DATA__) {
    return window.__REPOGRAPH_DATA__;
  }
  return null;
}

const container = document.getElementById("root");
if (!container) throw new Error("repograph: #root element not found");

const root = createRoot(container);

async function boot() {
  let data = resolveData();
  // In dev mode (vite dev, no injected data) fetch the bundled fixture so
  // there's something real to iterate against.
  if (!data && import.meta.env.DEV) {
    try {
      const res = await fetch("/dev-data.json");
      if (res.ok) data = (await res.json()) as RepographData;
    } catch {
      /* fixture not available — fall through to the empty state */
    }
  }
  root.render(
    <StrictMode>
      <App data={data} />
    </StrictMode>,
  );
}

void boot();
