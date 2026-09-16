export interface LayoutNode {
  readonly id: string;
  readonly type: string;
  // Capa horizontal: 0 es la columna mas a la izquierda.
  readonly column: number;
  readonly data: Record<string, unknown>;
}

export interface Position {
  readonly x: number;
  readonly y: number;
}

export const COLUMN_WIDTH = 320;
// Un nodo con fila de badges ronda los 120px; el alto de fila deja aire entre capas.
export const ROW_HEIGHT = 156;
export const ORIGIN_X = 48;
export const ORIGIN_Y = 40;

/*
 * Layout por capas determinista: reemplaza al `index * 130 + 30` que tenia el canvas
 * anterior. El orden de entrada define el orden vertical, asi que dos renders con los
 * mismos datos producen exactamente las mismas posiciones.
 */
export function layoutPositions(nodes: readonly LayoutNode[]): Readonly<Record<string, Position>> {
  const filled = new Map<number, number>();
  const positions: Record<string, Position> = {};

  for (const node of nodes) {
    const row = filled.get(node.column) ?? 0;
    filled.set(node.column, row + 1);
    positions[node.id] = {
      x: ORIGIN_X + node.column * COLUMN_WIDTH,
      y: ORIGIN_Y + row * ROW_HEIGHT,
    };
  }

  return positions;
}
