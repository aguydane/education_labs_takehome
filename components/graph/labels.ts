/**
 * Greedy label placement for the concept map. A label goes to the right of
 * its node, else the left, below, or above; a label that fits nowhere is
 * hidden (the name is one hover away). Important nodes place first and always
 * keep a label, in whichever spot collides least.
 */

export type LabelInput = {
  id: string;
  x: number;
  y: number;
  r: number;
  text: string;
  /** Lower places first. */
  priority: number;
  /** Always show, even if every spot collides. */
  force: boolean;
};

export type LabelSide = "right" | "left" | "below" | "above";

export type LabelSpot = { side: LabelSide; x: number; y: number; anchor: "start" | "end" | "middle" };

const CHAR_W = 6.4;
const LINE_H = 15;
const GAP = 6;
const EDGE = 2;

type Box = { x1: number; y1: number; x2: number; y2: number };

function spotFor(n: LabelInput, side: LabelSide): { box: Box; spot: LabelSpot } {
  const w = n.text.length * CHAR_W;
  const half = LINE_H / 2;
  switch (side) {
    case "right":
      return {
        box: { x1: n.x + n.r + GAP - 2, x2: n.x + n.r + GAP + w, y1: n.y - half, y2: n.y + half },
        spot: { side, x: n.x + n.r + GAP, y: n.y + 4, anchor: "start" },
      };
    case "left":
      return {
        box: { x1: n.x - n.r - GAP - w, x2: n.x - n.r - GAP + 2, y1: n.y - half, y2: n.y + half },
        spot: { side, x: n.x - n.r - GAP, y: n.y + 4, anchor: "end" },
      };
    case "below":
      return {
        box: { x1: n.x - w / 2, x2: n.x + w / 2, y1: n.y + n.r + 2, y2: n.y + n.r + 2 + LINE_H },
        spot: { side, x: n.x, y: n.y + n.r + 13, anchor: "middle" },
      };
    case "above":
      return {
        box: { x1: n.x - w / 2, x2: n.x + w / 2, y1: n.y - n.r - 2 - LINE_H, y2: n.y - n.r - 2 },
        spot: { side, x: n.x, y: n.y - n.r - 6, anchor: "middle" },
      };
  }
}

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function hitsCircle(b: Box, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

export function placeLabels(nodes: LabelInput[], w: number, h: number): Map<string, LabelSpot> {
  const out = new Map<string, LabelSpot>();
  const placed: Box[] = [];
  const order = nodes.filter((n) => n.text).sort((a, b) => a.priority - b.priority);

  const collisions = (n: LabelInput, b: Box): number => {
    let count = 0;
    if (b.x1 < EDGE || b.x2 > w - EDGE || b.y1 < 0 || b.y2 > h) count += 100;
    for (const p of placed) if (overlaps(p, b)) count += 1;
    for (const o of nodes) if (o.id !== n.id && hitsCircle(b, o.x, o.y, o.r + 3)) count += 1;
    return count;
  };

  for (const n of order) {
    const rightFits = n.x + n.r + GAP + n.text.length * CHAR_W <= w - EDGE;
    const sides: LabelSide[] = rightFits ? ["right", "left", "below", "above"] : ["left", "right", "below", "above"];
    let best: { box: Box; spot: LabelSpot; cost: number } | null = null;
    for (const side of sides) {
      const { box, spot } = spotFor(n, side);
      const cost = collisions(n, box);
      if (!best || cost < best.cost) best = { box, spot, cost };
      if (cost === 0) break;
    }
    if (best && (best.cost === 0 || n.force)) {
      out.set(n.id, best.spot);
      placed.push(best.box);
    }
  }
  return out;
}
