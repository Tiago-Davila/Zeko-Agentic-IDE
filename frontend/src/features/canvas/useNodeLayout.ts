import { useCallback, useEffect, useRef, useState } from 'react';
import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';

import { layoutPositions, type LayoutNode } from './layout';

interface NodeLayout {
  readonly nodes: readonly Node[];
  readonly onNodesChange: (changes: NodeChange[]) => void;
  readonly resetLayout: () => void;
}

/*
 * Aplica el layout por capas como posicion inicial y deja que el arrastre la sobrescriba.
 * Las posiciones movidas por el usuario viven solo en memoria: no hay endpoint para
 * persistirlas, asi que se conservan mientras dure la sesion y se pierden al recargar.
 *
 * `source` tiene que venir memoizado por el consumidor.
 */
export function useNodeLayout(source: readonly LayoutNode[]): NodeLayout {
  const [nodes, setNodes] = useState<readonly Node[]>([]);
  // Posiciones que el usuario movio, para no pisarlas cuando llegan datos nuevos.
  const movedRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const positions = layoutPositions(source);
    setNodes((current) => {
      const previous = new Map(current.map((node) => [node.id, node]));
      return source.map((item) => {
        const existing = previous.get(item.id);
        const moved = movedRef.current.get(item.id);
        return {
          id: item.id,
          type: item.type,
          position: moved ?? existing?.position ?? positions[item.id] ?? { x: 0, y: 0 },
          data: item.data,
          selected: existing?.selected ?? false,
        };
      });
    });

    // Un nodo que desaparece no debe conservar su posicion si vuelve mas tarde con otro sentido.
    const live = new Set(source.map((item) => item.id));
    for (const id of movedRef.current.keys()) {
      if (!live.has(id)) movedRef.current.delete(id);
    }
  }, [source]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position !== undefined) {
        movedRef.current.set(change.id, change.position);
      }
    }
    setNodes((current) => applyNodeChanges(changes, current as Node[]));
  }, []);

  const resetLayout = useCallback(() => {
    movedRef.current.clear();
    setNodes((current) => {
      const positions = layoutPositions(
        current.map((node, index) => ({
          id: node.id,
          type: node.type ?? 'default',
          column: typeof node.data.column === 'number' ? node.data.column : index,
          data: node.data,
        })),
      );
      return current.map((node) => ({ ...node, position: positions[node.id] ?? node.position }));
    });
  }, []);

  return { nodes, onNodesChange, resetLayout };
}
