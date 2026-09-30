import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isTeammate, neighbors, shortestDistance, shortestPath, validatePath } from "../src/graph.ts";
import type { LinkGraphData } from "../src/types.ts";

const graph: LinkGraphData = {
  schemaVersion: 1,
  dataVersion: "test",
  rule: "same season and team",
  adjacency: {
    A: ["B", "C"],
    B: ["A", "D"],
    C: ["A", "D"],
    D: ["B", "C", "E"],
    E: ["D"],
    X: [],
  },
  evidence: {},
  stats: {
    playerCount: 6,
    edgeCount: 5,
    componentCount: 2,
    largestComponent: 5,
    isolatedPlayers: 1,
    averageDegree: 1.667,
    diameter: 3,
    distanceDistribution: { "1": 5, "2": 4, "3": 1 },
  },
};

test("neighbors and teammate checks use undirected adjacency", () => {
  assert.deepEqual(neighbors(graph, "A"), ["B", "C"]);
  assert.equal(isTeammate(graph, "A", "B"), true);
  assert.equal(isTeammate(graph, "B", "A"), true);
  assert.equal(isTeammate(graph, "A", "D"), false);
});

test("BFS handles identical, disconnected, and multiple shortest paths", () => {
  assert.equal(shortestDistance(graph, "A", "A"), 0);
  assert.equal(shortestDistance(graph, "A", "X"), null);
  assert.equal(shortestDistance(graph, "A", "D"), 2);
  const path = shortestPath(graph, "A", "D");
  assert.ok(path);
  assert.equal(path.length - 1, 2);
  assert.ok(["B", "C"].includes(path[1] ?? ""));
});

test("path validation reports every broken segment by index", () => {
  assert.deepEqual(validatePath(["A", "B", "D"], graph), { valid: true, brokenSegments: [] });
  assert.deepEqual(validatePath(["A", "D", "X"], graph), {
    valid: false,
    brokenSegments: [
      { index: 0, from: "A", to: "D" },
      { index: 1, from: "D", to: "X" },
    ],
  });
});

test("real snapshot accepts Cat and Fly as direct historical teammates", () => {
  const realGraph = JSON.parse(readFileSync(new URL("../public/data/link_graph.json", import.meta.url), "utf8")) as LinkGraphData;
  const players = JSON.parse(readFileSync(new URL("../public/data/players.json", import.meta.url), "utf8")) as {
    players: Array<{ id: string; name: string }>;
  };
  const cat = players.players.find((player) => player.name === "Cat")?.id;
  const fly = players.players.find((player) => player.name === "Fly")?.id;
  assert.ok(cat && fly);
  assert.equal(isTeammate(realGraph, cat, fly), true);
  assert.equal(isTeammate(realGraph, fly, cat), true);
  assert.equal(shortestDistance(realGraph, cat, fly), 1);
  assert.deepEqual(validatePath([cat, fly], realGraph), { valid: true, brokenSegments: [] });
  const proofs = realGraph.evidence[[cat, fly].sort().join("|")];
  assert.ok(proofs?.some((proof) => proof.teamName === "QGhappy" && proof.seasonId === "KPL2017S1"));
});
