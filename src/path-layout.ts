export interface PathRow {
  indexes: number[];
  reversed: boolean;
}

export interface PathLayout {
  nodeWidth: number;
  rows: PathRow[];
}

export function planPathLayout(nodeCount: number, boardWidth: number): PathLayout {
  const nodeWidth = boardWidth < 500 ? 100 : nodeCount >= 6 ? 100 : nodeCount >= 4 ? 112 : 150;
  const edgeWidth = 56;
  const capacity = Math.max(2, Math.min(6, Math.floor((boardWidth + edgeWidth) / (nodeWidth + edgeWidth))));
  const rows: PathRow[] = [];
  for (let start = 0; start < nodeCount; start += capacity) {
    rows.push({
      indexes: Array.from({ length: Math.min(capacity, nodeCount - start) }, (_, offset) => start + offset),
      reversed: rows.length % 2 === 1,
    });
  }
  return { nodeWidth, rows };
}
