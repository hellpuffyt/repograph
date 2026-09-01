import { useEffect, useRef } from "react";
import { ForceSimulation } from "./forceLayout";
import type { RepographData } from "./data";

export interface GraphCanvasProps {
  data: RepographData;
  selected: string | null;
  highlighted: Set<string>;
  filtered: Set<string> | null;
  onSelect: (path: string | null) => void;
  colors: {
    node: string;
    nodeDead: string;
    nodeCycle: string;
    nodeSelected: string;
    nodeHighlighted: string;
    edge: string;
    edgeHighlighted: string;
    text: string;
    background: string;
  };
  statusOf: (path: string) => { isDead: boolean; isInCycle: boolean };
}

const NODE_RADIUS_MIN = 4;
const NODE_RADIUS_MAX = 14;

export function GraphCanvas({ data, selected, highlighted, filtered, onSelect, colors, statusOf }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<ForceSimulation | null>(null);
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null);

  // (Re)build the simulation whenever the underlying dataset changes.
  useEffect(() => {
    const container = containerRef.current;
    const width = container?.clientWidth ?? 800;
    const height = container?.clientHeight ?? 600;
    const ids = data.nodes.map((n) => n.path);
    const edges = data.edges.map((e) => ({ source: e.from, target: e.to }));
    simRef.current = new ForceSimulation(ids, edges, { width, height });
    viewRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
  }, [data]);

  const maxFanIn = Math.max(1, ...data.nodes.map((n) => n.dependedOnBy.length));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let raf = 0;
    let stableTicks = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      simRef.current?.resize(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function draw() {
      const ctx = canvas!.getContext("2d");
      const sim = simRef.current;
      if (!ctx || !sim) return;
      const dpr = window.devicePixelRatio || 1;
      const { scale, offsetX, offsetY } = viewRef.current;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx.scale(dpr * scale, dpr * scale);
      ctx.translate(offsetX, offsetY);

      const isFiltered = (path: string) => filtered === null || filtered.has(path);

      // Edges
      for (const edge of data.edges) {
        const a = sim.nodes.get(edge.from);
        const b = sim.nodes.get(edge.to);
        if (!a || !b) continue;
        if (!isFiltered(edge.from) || !isFiltered(edge.to)) continue;
        const isHot = highlighted.has(edge.from) && highlighted.has(edge.to);
        ctx.strokeStyle = isHot ? colors.edgeHighlighted : colors.edge;
        ctx.lineWidth = isHot ? 1.6 : 0.7;
        ctx.globalAlpha = isHot ? 0.9 : 0.35;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes
      for (const node of data.nodes) {
        const simNode = sim.nodes.get(node.path);
        if (!simNode) continue;
        const dimmed = !isFiltered(node.path);
        const status = statusOf(node.path);
        const r = NODE_RADIUS_MIN + (NODE_RADIUS_MAX - NODE_RADIUS_MIN) * (node.dependedOnBy.length / maxFanIn);

        let fill = colors.node;
        if (status.isDead) fill = colors.nodeDead;
        if (status.isInCycle) fill = colors.nodeCycle;
        if (highlighted.has(node.path)) fill = colors.nodeHighlighted;
        if (node.path === selected) fill = colors.nodeSelected;

        ctx.globalAlpha = dimmed ? 0.15 : 1;
        ctx.beginPath();
        ctx.arc(simNode.x, simNode.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (node.path === selected) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = colors.text;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function loop() {
      const sim = simRef.current;
      if (sim) {
        const energy = sim.tick();
        if (energy < 0.02) {
          stableTicks += 1;
        } else {
          stableTicks = 0;
        }
      }
      draw();
      if (stableTicks < 60) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = requestAnimationFrame(() => {
          // Keep a slow idle redraw loop so drag/hover updates still render
          // once the simulation itself has settled.
          draw();
          raf = requestAnimationFrame(loop);
        });
      }
    }
    raf = requestAnimationFrame(loop);

    function toWorld(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      const { scale, offsetX, offsetY } = viewRef.current;
      return {
        x: (clientX - rect.left) / scale - offsetX,
        y: (clientY - rect.top) / scale - offsetY,
      };
    }

    function hitTest(x: number, y: number): string | null {
      const sim = simRef.current;
      if (!sim) return null;
      let best: string | null = null;
      let bestDist = 16;
      for (const [id, node] of sim.nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = id;
        }
      }
      return best;
    }

    function onPointerDown(ev: PointerEvent) {
      const world = toWorld(ev.clientX, ev.clientY);
      const hit = hitTest(world.x, world.y);
      if (hit) {
        simRef.current?.setPinned(hit, true);
        dragRef.current = { id: hit, moved: false };
      } else {
        panRef.current = {
          startX: ev.clientX,
          startY: ev.clientY,
          startOffX: viewRef.current.offsetX,
          startOffY: viewRef.current.offsetY,
        };
      }
      canvas!.setPointerCapture(ev.pointerId);
    }

    function onPointerMove(ev: PointerEvent) {
      if (dragRef.current) {
        const world = toWorld(ev.clientX, ev.clientY);
        simRef.current?.setPosition(dragRef.current.id, world.x, world.y);
        dragRef.current.moved = true;
        stableTicks = 0;
      } else if (panRef.current) {
        const { scale } = viewRef.current;
        const dx = (ev.clientX - panRef.current.startX) / scale;
        const dy = (ev.clientY - panRef.current.startY) / scale;
        viewRef.current.offsetX = panRef.current.startOffX + dx;
        viewRef.current.offsetY = panRef.current.startOffY + dy;
      }
    }

    function onPointerUp() {
      if (dragRef.current) {
        simRef.current?.setPinned(dragRef.current.id, false);
        if (!dragRef.current.moved) onSelect(dragRef.current.id);
        dragRef.current = null;
        stableTicks = 0;
      }
      panRef.current = null;
    }

    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.001);
      viewRef.current.scale = Math.min(4, Math.max(0.2, viewRef.current.scale * factor));
      stableTicks = 0;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [data, selected, highlighted, filtered, colors, statusOf, onSelect, maxFanIn]);

  return (
    <div ref={containerRef} className="graph-canvas-wrap">
      <canvas ref={canvasRef} className="graph-canvas" />
    </div>
  );
}
