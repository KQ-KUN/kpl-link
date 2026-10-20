import { readFileSync } from 'node:fs';
import type { LinkGraphData, LinkEvidence } from '../src/types.ts';
export function fullGraph(): LinkGraphData & { evidence: Record<string, LinkEvidence[]> } {
  const runtime = JSON.parse(readFileSync(new URL('../public/data/link_graph.json', import.meta.url), 'utf8')) as LinkGraphData;
  const evidence = JSON.parse(readFileSync(new URL('../public/data/link_evidence.json', import.meta.url), 'utf8')) as { evidence: Record<string, LinkEvidence[]> };
  return { ...runtime, ...evidence };
}
