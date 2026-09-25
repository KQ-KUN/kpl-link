import { distanceLayers, shortestDistance, validatePath } from "./graph.ts";
import type { Difficulty, LinkGraphData, LinkPlayer, Question } from "./types.ts";

export const DIFFICULTIES: readonly Difficulty[] = ["beginner", "standard", "hard", "archive"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "入门",
  standard: "标准",
  hard: "困难",
  archive: "考古",
};

function acceptsDistance(difficulty: Difficulty, distance: number): boolean {
  if (difficulty === "beginner") return distance >= 1 && distance <= 3;
  if (difficulty === "standard") return distance === 2;
  if (difficulty === "hard") return distance >= 4 && distance <= 6;
  return distance >= 4;
}

function isQualityCandidate(player: LinkPlayer, difficulty: Difficulty): boolean {
  if (!player.avatar) return false;
  if (difficulty === "archive") return true;
  if (difficulty === "hard") return player.totalGames >= 5;
  return player.tier === "popular" || player.tier === "normal";
}

export function availableDifficulties(graph: LinkGraphData): Difficulty[] {
  const present = new Set(
    Object.entries(graph.stats.distanceDistribution)
      .filter(([, count]) => count > 0)
      .map(([distance]) => Number(distance)),
  );
  return DIFFICULTIES.filter((difficulty) => [...present].some((distance) => acceptsDistance(difficulty, distance)));
}

export function selectQuestion(
  graph: LinkGraphData,
  players: readonly LinkPlayer[],
  difficulty: Difficulty,
  random: () => number = Math.random,
): Question {
  const byId = new Map(players.map((player) => [player.id, player]));
  const qualityIds = players.filter((player) => isQualityCandidate(player, difficulty)).map((player) => player.id);
  const latestYear = new Map<string, number>();
  for (const [edge, proofs] of Object.entries(graph.evidence)) {
    const ids = edge.split("|");
    for (const proof of proofs) {
      const year = Number(proof.seasonId.match(/20\d{2}/)?.[0] ?? 0);
      for (const id of ids) latestYear.set(id, Math.max(latestYear.get(id) ?? 0, year));
    }
  }
  const preferredIds = qualityIds.filter((id) => {
    const year = latestYear.get(id) ?? 0;
    if (difficulty === "beginner") return year >= 2025;
    if (difficulty === "archive") return year > 0 && year <= 2021;
    return false;
  });
  const pools = preferredIds.length >= 2 ? [preferredIds, qualityIds] : [qualityIds];
  for (const ids of pools) {
    const startIds = ids.length >= 2 ? ids : players.map((player) => player.id);
    if (!startIds.length) throw new Error("没有可出题的选手");
    const allowed = new Set(startIds);
    const firstIndex = Math.min(startIds.length - 1, Math.floor(random() * startIds.length));
    for (let offset = 0; offset < startIds.length; offset += 1) {
      const startId = startIds[(firstIndex + offset) % startIds.length];
      if (!startId) continue;
      const layers = distanceLayers(graph, startId);
      const candidates: Array<{ id: string; distance: number }> = [];
      for (const [distance, targets] of layers) {
        if (!acceptsDistance(difficulty, distance)) continue;
        for (const targetId of targets) {
          if (byId.has(targetId) && allowed.has(targetId)) candidates.push({ id: targetId, distance });
        }
      }
      if (candidates.length) {
        const targetIndex = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
        const target = candidates[targetIndex];
        if (!target) throw new Error("题目生成失败");
        return { startId, targetId: target.id, distance: target.distance, difficulty };
      }
    }
  }
  throw new Error(`没有可用的${DIFFICULTY_LABELS[difficulty]}题目`);
}

export type SubmissionResult =
  | { kind: "invalid"; distance: number | null; brokenSegments: ReturnType<typeof validatePath>["brokenSegments"] }
  | { kind: "valid-long"; distance: number; shortest: number }
  | { kind: "shortest"; distance: number; shortest: number };

export function evaluateSubmission(path: readonly string[], graph: LinkGraphData): SubmissionResult {
  const validation = validatePath(path, graph);
  const distance = path.length - 1;
  const theoretical = path[0] !== undefined && path.at(-1) !== undefined
    ? shortestDistance(graph, path[0], path.at(-1)!)
    : null;
  if (!validation.valid) {
    return { kind: "invalid", distance: theoretical, brokenSegments: validation.brokenSegments };
  }
  if (theoretical === null) {
    return { kind: "invalid", distance: null, brokenSegments: [] };
  }
  return distance === theoretical
    ? { kind: "shortest", distance, shortest: theoretical }
    : { kind: "valid-long", distance, shortest: theoretical };
}
