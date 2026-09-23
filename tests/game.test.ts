import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { availableDifficulties, evaluateSubmission, selectQuestion } from "../src/game.ts";
import { shortestDistance, shortestPath, validatePath } from "../src/graph.ts";
import { planPathLayout } from "../src/path-layout.ts";
import { searchPlayers } from "../src/search.ts";
import type { LinkGraphData, LinkPlayer } from "../src/types.ts";

const adjacency = {
  A: ["B"],
  B: ["A", "C"],
  C: ["B", "D"],
  D: ["C", "E"],
  E: ["D"],
};
const graph: LinkGraphData = {
  schemaVersion: 1,
  dataVersion: "test",
  rule: "same season and team",
  adjacency,
  evidence: {},
  stats: {
    playerCount: 5,
    edgeCount: 4,
    componentCount: 1,
    largestComponent: 5,
    isolatedPlayers: 0,
    averageDegree: 1.6,
    diameter: 4,
    distanceDistribution: { "1": 4, "2": 3, "3": 2, "4": 1 },
  },
};

function player(id: string, overrides: Partial<LinkPlayer> = {}): LinkPlayer {
  return {
    id,
    name: id,
    aliases: [id.toLowerCase()],
    avatar: "avatar.webp",
    positions: ["打野"],
    recentTeamId: "team",
    recentTeamName: "测试战队",
    active: true,
    debutYear: 2020,
    totalGames: 300,
    tier: "normal",
    ...overrides,
  };
}
const players = Object.keys(adjacency).map((id) => player(id));

test("difficulty availability follows real graph distances", () => {
  assert.deepEqual(availableDifficulties(graph), ["beginner", "standard", "hard", "archive"]);
});

test("question generation guarantees a distinct connected pair at the requested distance", () => {
  for (const [difficulty, expected] of [["standard", 2], ["hard", 3], ["archive", 4]] as const) {
    const question = selectQuestion(graph, players, difficulty, () => 0);
    assert.notEqual(question.startId, question.targetId);
    assert.equal(question.distance, expected);
  }
});

test("any valid shortest route wins instead of matching one stored path", () => {
  const diamond: LinkGraphData = {
    ...graph,
    adjacency: { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C"] },
  };
  assert.equal(evaluateSubmission(["A", "B", "D"], diamond).kind, "shortest");
  assert.equal(evaluateSubmission(["A", "C", "D"], diamond).kind, "shortest");
  assert.equal(evaluateSubmission(["A", "D"], diamond).kind, "invalid");
});

test("valid but longer paths remain retryable", () => {
  const cycle: LinkGraphData = {
    ...graph,
    adjacency: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["A", "C"] },
  };
  const result = evaluateSubmission(["A", "B", "C", "D"], cycle);
  assert.deepEqual(result, { kind: "valid-long", distance: 3, shortest: 1 });
});

test("search is case-insensitive, space-normalized, and alias-aware", () => {
  const roster = [player("fly", { name: "Fly", aliases: ["fly", "彭云飞"] }), player("cat", { name: "Cat", aliases: ["cat god"] })];
  assert.equal(searchPlayers(roster, "FLY")[0]?.id, "fly");
  assert.equal(searchPlayers(roster, "catgod")[0]?.id, "cat");
  assert.equal(searchPlayers(roster, "彭云飞")[0]?.id, "fly");
});

test("search exposes the full roster rather than a preset shortlist", () => {
  const roster = Array.from({ length: 24 }, (_, index) => player(`选手${index}`, {
    name: `选手${index}`,
    tier: index < 12 ? "popular" : "normal",
    totalGames: 24 - index,
  }));
  assert.equal(searchPlayers(roster, "").length, 24);
  assert.equal(searchPlayers(roster, "选手").length, 24);
});

test("long paths wrap into alternating horizontal rows without losing an edge", () => {
  const five = planPathLayout(5, 762);
  assert.deepEqual(five.rows.map((row) => row.indexes), [[0, 1, 2, 3], [4]]);
  assert.deepEqual(five.rows.map((row) => row.reversed), [false, true]);
  const long = planPathLayout(11, 762);
  assert.deepEqual(long.rows.map((row) => row.indexes), [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10]]);
  assert.deepEqual(long.rows.map((row) => row.reversed), [false, true, false]);
  assert.deepEqual(planPathLayout(5, 300).rows.map((row) => row.indexes), [[0, 1], [2, 3], [4]]);
});

test("UI keeps keyboard, live feedback, dialogs, and reduced motion hooks", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog id="player-dialog"/);
  assert.match(main, /ArrowDown/);
  assert.match(main, /ArrowUp/);
  assert.match(main, /event\.key === "Enter"/);
  assert.match(main, /event\.key === "Escape"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(main, /查看答案/);
  assert.match(main, /path-row--reverse/);
  assert.doesNotMatch(main, /path-board--stacked/);
  assert.doesNotMatch(main, /searchPlayers\(players, playerSearch\.value, 12\)/);
});

test("generated real-data questions remain connected and evidence-backed", () => {
  const realPlayers = JSON.parse(readFileSync(new URL("../public/data/players.json", import.meta.url), "utf8")) as { players: LinkPlayer[] };
  const realGraph = JSON.parse(readFileSync(new URL("../public/data/link_graph.json", import.meta.url), "utf8")) as LinkGraphData;
  for (const difficulty of availableDifficulties(realGraph)) {
    const question = selectQuestion(realGraph, realPlayers.players, difficulty, () => 0.5);
    assert.notEqual(question.startId, question.targetId);
    assert.equal(shortestDistance(realGraph, question.startId, question.targetId), question.distance);
    const path = shortestPath(realGraph, question.startId, question.targetId);
    assert.ok(path);
    assert.equal(path.length - 1, question.distance);
    assert.equal(validatePath(path, realGraph).valid, true);
  }
});
