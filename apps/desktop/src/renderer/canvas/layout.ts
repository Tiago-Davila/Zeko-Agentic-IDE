export interface Position { x: number; y: number }

export const COLUMN_WIDTH = 320;
// A node with a badge row is around 120px tall; the row height leaves air between layers.
export const ROW_HEIGHT = 156;
export const ORIGIN_X = 48;
export const ORIGIN_Y = 40;

interface LayoutEdge { from: string; to: string }

/*
 * Column of each node: the length of the longest path that reaches it, so every edge
 * points to a column further right. A cycle cannot be saved, but a node already on the
 * current path is treated as a root instead of recursing forever.
 */
export function layoutColumns(nodeIds: readonly string[], edges: readonly LayoutEdge[]): Map<string, number> {
  const predecessors = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) predecessors.get(edge.to)?.push(edge.from);
  const columns = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const known = columns.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id) || !predecessors.has(id)) return -1;
    visiting.add(id);
    const column = Math.max(-1, ...(predecessors.get(id) ?? []).map(columnOf)) + 1;
    visiting.delete(id);
    columns.set(id, column);
    return column;
  };
  for (const id of nodeIds) columnOf(id);
  return columns;
}

/*
 * Deterministic layered layout: input order defines vertical order inside a column, so two
 * calls with the same data produce exactly the same positions.
 */
export function layoutPositions(nodes: ReadonlyArray<{ id: string; column: number }>): Record<string, Position> {
  const filled = new Map<number, number>();
  const positions: Record<string, Position> = {};
  for (const node of nodes) {
    const row = filled.get(node.column) ?? 0;
    filled.set(node.column, row + 1);
    positions[node.id] = { x: ORIGIN_X + node.column * COLUMN_WIDTH, y: ORIGIN_Y + row * ROW_HEIGHT };
  }
  return positions;
}
