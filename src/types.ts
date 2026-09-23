export type PlayerTier = "popular" | "normal" | "hardcore";
export type Difficulty = "beginner" | "standard" | "hard" | "archive";

export interface LinkPlayer {
  id: string;
  name: string;
  aliases: string[];
  avatar: string;
  positions: string[];
  recentTeamId: string;
  recentTeamName: string;
  active: boolean;
  debutYear: number | null;
  totalGames: number;
  tier: PlayerTier;
}

export interface LinkEvidence {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
}

export interface GraphStats {
  playerCount: number;
  edgeCount: number;
  componentCount: number;
  largestComponent: number;
  isolatedPlayers: number;
  averageDegree: number;
  diameter: number;
  distanceDistribution: Record<string, number>;
}

export interface PlayersData {
  schemaVersion: number;
  dataVersion: string;
  source: string;
  players: LinkPlayer[];
}

export interface LinkGraphData {
  schemaVersion: number;
  dataVersion: string;
  rule: string;
  adjacency: Record<string, string[]>;
  evidence: Record<string, LinkEvidence[]>;
  stats: GraphStats;
  sourceAudit?: {
    attributionRecords: number;
    unmappedRecords: number;
    unmappedReason: string;
  };
}

export interface BrokenSegment {
  index: number;
  from: string;
  to: string;
}

export interface PathValidation {
  valid: boolean;
  brokenSegments: BrokenSegment[];
}

export interface Question {
  startId: string;
  targetId: string;
  distance: number;
  difficulty: Difficulty;
}
