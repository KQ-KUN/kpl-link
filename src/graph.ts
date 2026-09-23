import type { LinkGraphData, PathValidation } from "./types.ts";

export function edgeKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

export function neighbors(graph: LinkGraphData, playerId: string): readonly string[] {
  return graph.adjacency[playerId] ?? [];
}

export function isTeammate(graph: LinkGraphData, left: string, right: string): boolean {
  return neighbors(graph, left).includes(right);
}

export function validatePath(path: readonly string[], graph: LinkGraphData): PathValidation {
  const brokenSegments = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    if (from !== undefined && to !== undefined && !isTeammate(graph, from, to)) {
      brokenSegments.push({ index, from, to });
    }
  }
  return { valid: path.length > 0 && brokenSegments.length === 0, brokenSegments };
}

export function shortestDistance(graph: LinkGraphData, startId: string, targetId: string): number | null {
  if (!(startId in graph.adjacency) || !(targetId in graph.adjacency)) return null;
  if (startId === targetId) return 0;
  const visited = new Set([startId]);
  const queue: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (!current) continue;
    for (const neighbor of neighbors(graph, current.id)) {
      if (neighbor === targetId) return current.distance + 1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, distance: current.distance + 1 });
      }
    }
  }
  return null;
}

export function shortestPath(graph: LinkGraphData, startId: string, targetId: string): string[] | null {
  if (!(startId in graph.adjacency) || !(targetId in graph.adjacency)) return null;
  if (startId === targetId) return [startId];
  const previous = new Map<string, string | null>([[startId, null]]);
  const queue = [startId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    for (const neighbor of neighbors(graph, current)) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, current);
      if (neighbor === targetId) {
        const path = [targetId];
        let step: string | null = current;
        while (step !== null) {
          path.push(step);
          step = previous.get(step) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}

export function distanceLayers(graph: LinkGraphData, startId: string): Map<number, string[]> {
  const layers = new Map<number, string[]>();
  if (!(startId in graph.adjacency)) return layers;
  const distances = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    const distance = distances.get(current) ?? 0;
    for (const neighbor of neighbors(graph, current)) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distance + 1);
      const layer = layers.get(distance + 1) ?? [];
      layer.push(neighbor);
      layers.set(distance + 1, layer);
      queue.push(neighbor);
    }
  }
  return layers;
}
