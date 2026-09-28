/**
 * Greedy label placement for the concept map. Labels go to the right of a
 * node, or to the left when the right is taken; a label that fits neither
 * side is hidden (its name is still one hover away). Important nodes place
 * first and always keep their label.
 */

export type LabelInput = {
  id: string;
  x: number;
  y: number;
  r: number;
  text: string;
  /** Lower places first. */
  priority: number;
  /** Always show, even if it overlaps. */
  force: boolean;
};

export type LabelSide = "left" | "right";

const CHAR_W = 6.4;
const HALF_H = 7.5;
const GAP = 6;
const EDGE = 2;

type Box = { x1: number; y1: number; x2: number; y2: number };

function boxFor(n: LabelInput, side: LabelSide): Box {
  const w = n.text.length * CHAR_W;
  return side === "right"
    ? { x1: n.x + n.r + GAP - 2, x2: n.x + n.r + GAP + w, y1: n.y - HALF_H, y2: n.y + HALF_H }
    : { x1: n.x - n.r - GAP - w, x2: n.x - n.r - GAP + 2, y1: n.y - HALF_H, y2: n.y + HALF_H };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function hitsCircle(b: Box, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

export function placeLabels(nodes: LabelInput[], w: number, h: number): Map<string, LabelSide> {
  const out = new Map<string, LabelSide>();
  const placed: Box[] = [];
  const order = [...nodes].filter((n) => n.text).sort((a, b) => a.priority - b.priority);

  for (const n of order) {
    const rightFits = n.x + n.r + GAP + n.text.length * CHAR_W <= w - EDGE;
    const sides: LabelSide[] = rightFits ? ["right", "left"] : ["left", "right"];
    let chosen: LabelSide | null = null;
    for (const side of sides) {
      const b = boxFor(n, side);
      if (b.x1 < EDGE || b.x2 > w - EDGE || b.y1 < 0 || b.y2 > h) continue;
      if (placed.some((p) => overlaps(p, b))) continue;
      if (nodes.some((o) => o.id !== n.id && hitsCircle(b, o.x, o.y, o.r + 3))) continue;
      chosen = side;
      break;
    }
    if (!chosen && n.force) chosen = sides[0];
    if (chosen) {
      out.set(n.id, chosen);
      placed.push(boxFor(n, chosen));
    }
  }
  return out;
}
