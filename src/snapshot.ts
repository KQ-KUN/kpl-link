import type { LinkEvidence, LinkGraphData, PlayersData } from './types.ts';

export interface SnapshotManifest {
  schemaVersion: number;
  dataVersion: string;
  outputs: Array<{ path: string; sha256: string; bytes: number }>;
}
export interface EvidenceData { schemaVersion: number; dataVersion: string; evidence: Record<string, LinkEvidence[]> }

// Cache successful values, share in-flight work, and discard failed attempts so Retry works.
export function singleFlight<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => pending ??= load().catch(error => { pending = null; throw error; });
}

export async function checkedJson<T>(path: string, manifest: SnapshotManifest, fetcher = fetch): Promise<T> {
  const contract = manifest.outputs.find(item => item.path === `public/data/${path}`);
  if (!contract) throw new Error(`快照缺少资源契约：${path}`);
  const response = await fetcher(`./data/${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`资料加载失败 (${response.status})，可以重试`);
  const buffer = await response.arrayBuffer();
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (buffer.byteLength !== contract.bytes || sha256 !== contract.sha256) throw new Error('快照版本或文件校验不一致，请重试');
  const data = JSON.parse(new TextDecoder().decode(buffer)) as T & { schemaVersion?: number; dataVersion?: string };
  if (data.schemaVersion !== 1 || data.dataVersion !== manifest.dataVersion) throw new Error('选手、图谱与证据版本不一致');
  return data;
}

export async function loadSnapshot(fetcher = fetch): Promise<{ players: PlayersData; graph: LinkGraphData; evidence: () => Promise<EvidenceData> }> {
  const response = await fetcher('./data/manifest.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('无法读取快照清单，请重试');
  const manifest = await response.json() as SnapshotManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.outputs) || typeof manifest.dataVersion !== 'string') throw new Error('快照清单无效');
  const [players, graph] = await Promise.all([
    checkedJson<PlayersData>('players.json', manifest, fetcher), checkedJson<LinkGraphData>('link_graph.json', manifest, fetcher),
  ]);
  if (!Array.isArray(players.players) || !graph.adjacency || !graph.latestYear || !graph.stats) throw new Error('核心关系数据结构无效');
  const ids = new Set(players.players.map(player => player.id));
  if (ids.size !== players.players.length || Object.entries(graph.adjacency).some(([id, neighbors]) => !ids.has(id) || !Array.isArray(neighbors) || neighbors.some(other => !ids.has(other)))) throw new Error('关系图身份映射不完整');
  const evidence = singleFlight(async () => {
    const data = await checkedJson<EvidenceData>('link_evidence.json', manifest, fetcher);
    if (!data.evidence || typeof data.evidence !== 'object') throw new Error('详细证据结构无效');
    return data;
  });
  return { players, graph, evidence };
}
