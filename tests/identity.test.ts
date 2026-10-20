import { fullGraph } from './snapshot-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { LinkGraphData, LinkPlayer } from '../src/types.ts';

test('GK Lyr and AG Weiyang retain separate identities and teammate evidence', () => {
  const players: { players: LinkPlayer[] } = JSON.parse(readFileSync(new URL('../public/data/players.json', import.meta.url), 'utf8'));
  const graph: LinkGraphData = fullGraph();
  const ag = players.players.find((p) => p.id === 'FEC77937DF7DD29C1BEAE6DE2456AFF3')!;
  const gk = players.players.find((p) => p.id === 'WP26473')!;
  assert.equal(ag.name, '未央（AG）');
  assert.equal(gk.name, '未央（GK / Lyr）');
  assert.ok(gk.aliases.includes('GK.lyr'));
  assert.ok(!ag.aliases.includes('GK.lyr'));
  assert.equal(ag.totalGames, 173);
  assert.equal(gk.totalGames, 44);
  assert.equal(gk.recentTeamName, 'GK');
  assert.ok(!graph.adjacency[ag.id]?.includes(gk.id));
  for (const [pair, proofs] of Object.entries(graph.evidence ?? {})) {
    if (pair.split('|').includes(ag.id)) assert.ok(proofs.every((p) => p.seasonId !== 'L20190001' && p.teamId !== '10016'));
    if (pair.split('|').includes(gk.id)) assert.ok(proofs.every((p) => p.teamId === '10016'));
  }
});
