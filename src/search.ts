import type { LinkPlayer } from "./types.ts";

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

export function searchPlayers(players: readonly LinkPlayer[], query: string): LinkPlayer[] {
  const needle = normalizeSearch(query);
  if (!needle) {
    return players
      .slice()
      .sort((left, right) => right.totalGames - left.totalGames || left.name.localeCompare(right.name, "zh-CN"));
  }
  return players
    .filter((player) => [player.name, ...player.aliases].some((value) => normalizeSearch(value).includes(needle)))
    .sort((left, right) => {
      const leftPrefix = normalizeSearch(left.name).startsWith(needle) ? 0 : 1;
      const rightPrefix = normalizeSearch(right.name).startsWith(needle) ? 0 : 1;
      return leftPrefix - rightPrefix || right.totalGames - left.totalGames || left.name.localeCompare(right.name, "zh-CN");
    });
}
