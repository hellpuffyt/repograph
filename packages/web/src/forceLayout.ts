/**
 * A small, dependency-free force-directed layout: nodes repel each other
 * (Coulomb-like), connected nodes attract along a spring toward a rest
 * length, and everything is pulled gently toward the center so the graph
 * doesn't drift off-canvas. This is intentionally simple (O(n^2) repulsion)
 * rather than a Barnes-Hut quadtree — repograph targets the kind of
 * single-repo module graphs (tens to low thousands of files) where that
 * tradeoff is the right one for code simplicity.
 */

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned nodes (user is dragging) don't move under simulation forces. */
  pinned: boolean;
}

export interface SimEdge {
  source: string;
  target: string;
}

export interface ForceLayoutOptions {
  width: number;
  height: number;
  repulsion?: number;
  springLength?: number;
  springStrength?: number;
  centerStrength?: number;
  damping?: number;
}

const DEFAULTS: Required<Omit<ForceLayoutOptions, "width" | "height">> = {
  repulsion: 2600,
  springLength: 90,
  springStrength: 0.06,
  centerStrength: 0.012,
  damping: 0.82,
};

export class ForceSimulation {
  readonly nodes: Map<string, SimNode> = new Map();
  private edges: SimEdge[] = [];
  private opts: Required<Omit<ForceLayoutOptions, "width" | "height">> & { width: number; height: number };

  constructor(ids: string[], edges: SimEdge[], options: ForceLayoutOptions) {
    this.opts = { ...DEFAULTS, ...options };
    this.edges = edges;

    const cx = this.opts.width / 2;
    const cy = this.opts.height / 2;
    const radius = Math.min(this.opts.width, this.opts.height) * 0.35;
    ids.forEach((id, i) => {
      const angle = (i / Math.max(ids.length, 1)) * Math.PI * 2;
      this.nodes.set(id, {
        id,
        x: cx + Math.cos(angle) * radius * (0.4 + 0.6 * Math.random()),
        y: cy + Math.sin(angle) * radius * (0.4 + 0.6 * Math.random()),
        vx: 0,
        vy: 0,
        pinned: false,
      });
    });
  }

  resize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
  }

  setPinned(id: string, pinned: boolean): void {
    const node = this.nodes.get(id);
    if (node) node.pinned = pinned;
  }

  setPosition(id: string, x: number, y: number): void {
    const node = this.nodes.get(id);
    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
    }
  }

  /** Advance the simulation by one step. Returns the total kinetic energy (for convergence checks). */
  tick(): number {
    const { repulsion, springLength, springStrength, centerStrength, damping, width, height } = this.opts;
    const nodeList = [...this.nodes.values()];

    // Repulsion between every pair (O(n^2) — fine at repograph's target scale).
    for (let i = 0; i < nodeList.length; i++) {
      const a = nodeList[i]!;
      for (let j = i + 1; j < nodeList.length; j++) {
        const b = nodeList[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          distSq = 0.01;
        }
        const force = repulsion / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.pinned) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.pinned) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // Springs along edges toward springLength.
    for (const edge of this.edges) {
      const a = this.nodes.get(edge.source);
      const b = this.nodes.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const displacement = dist - springLength;
      const force = displacement * springStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Gentle centering.
    const cx = width / 2;
    const cy = height / 2;
    let energy = 0;
    for (const node of nodeList) {
      if (!node.pinned) {
        node.vx += (cx - node.x) * centerStrength;
        node.vy += (cy - node.y) * centerStrength;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }
      energy += node.vx * node.vx + node.vy * node.vy;
    }
    return energy;
  }
}
