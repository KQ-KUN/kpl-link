import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadSnapshot, singleFlight } from '../src/snapshot.ts';
import { fullGraph } from './snapshot-fixture.ts';
import { selectQuestion } from '../src/game.ts';

test('final manifest hashes, ID mapping and precomputed latestYear agree with frozen evidence', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/data/manifest.json', import.meta.url), 'utf8'));
  for (const item of manifest.outputs) {
    const bytes = readFileSync(new URL(`../${item.path}`, import.meta.url));
    assert.equal(bytes.length, item.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
  }
  const graph = fullGraph(), expected: Record<string, number | null> = Object.fromEntries(Object.keys(graph.adjacency).map(id => [id, null]));
  for (const [edge, proofs] of Object.entries(graph.evidence)) for (const proof of proofs) {
    const year = proof.seasonId.match(/20\d{2}/)?.[0];
    if (year) for (const id of edge.split('|')) expected[id] = Math.max(expected[id] ?? 0, Number(year));
  }
  assert.deepEqual(graph.latestYear, expected);
  const runtime = JSON.parse(readFileSync(new URL('../public/data/link_graph.json', import.meta.url), 'utf8'));
  assert.equal('evidence' in runtime, false);
});

test('question selection never reads detailed evidence', () => {
  const graph = fullGraph(), players = JSON.parse(readFileSync(new URL('../public/data/players.json', import.meta.url), 'utf8')).players;
  Object.defineProperty(graph, 'evidence', { get() { throw Error('detailed evidence scanned'); } });
  for (const difficulty of ['beginner', 'standard', 'hard', 'archive'] as const) assert.ok(selectQuestion(graph, players, difficulty, () => .3));
});

test('singleflight shares in-flight and successful values; rejected attempts remain retryable', async () => {
  let calls = 0;
  const load = singleFlight(async () => { calls++; await Promise.resolve(); if (calls === 1) throw Error('offline'); return { id: 'same' }; });
  const first = load(); assert.equal(load(), first); await assert.rejects(first, /offline/);
  const second = load(); assert.equal(load(), second); const value = await second;
  assert.equal(await load(), value); assert.equal(calls, 2);
});

test('startup skips evidence, evidence is lazy and retries without reloading core', async () => {
  const requests: string[] = []; let fail = true;
  const fetcher = (async (url: string | URL | Request) => {
    const path = String(url); requests.push(path);
    if (path.endsWith('link_evidence.json') && fail) { fail = false; return new Response('offline', { status: 503 }); }
    return new Response(readFileSync(new URL(`../public/${path.slice(2)}`, import.meta.url)), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const snapshot = await loadSnapshot(fetcher);
  assert.equal(requests.length, 3); assert.ok(!requests.some(url => url.includes('evidence')));
  await assert.rejects(snapshot.evidence(), /503/);
  assert.ok((await snapshot.evidence()).evidence); assert.equal(requests.length, 5);
});

test('HTML fallback or mismatched core bytes cannot enter the game', async () => {
  const fetcher = (async (url: string | URL | Request) => String(url).endsWith('manifest.json')
    ? new Response(readFileSync(new URL('../public/data/manifest.json', import.meta.url)))
    : new Response('<!doctype html>fallback', { headers: { 'content-type': 'text/html' } })) as typeof fetch;
  await assert.rejects(loadSnapshot(fetcher), /校验不一致/);
});
