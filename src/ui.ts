import { edgeKey } from "./graph.ts";
import type { LinkGraphData, LinkPlayer } from "./types.ts";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}

export function playerMeta(player: LinkPlayer): string {
  const position = player.positions.join(" / ") || "位置暂无";
  return player.recentTeamName ? `${position} · ${player.recentTeamName}` : position;
}

export function avatarMarkup(player: LinkPlayer, className = "player-avatar"): string {
  const fallback = escapeHtml(player.name.slice(0, 1).toUpperCase());
  if (!player.avatar) return `<span class="${className} avatar-fallback" aria-hidden="true">${fallback}</span>`;
  const loading = className === "search-avatar" ? ' loading="lazy"' : "";
  return `<span class="${className}"><img src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)}头像" data-fallback="${fallback}"${loading} /></span>`;
}

export function installAvatarFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("img[data-fallback]").forEach((image) => {
    image.addEventListener("error", () => {
      const parent = image.parentElement;
      if (!parent) return;
      parent.textContent = image.dataset.fallback ?? "?";
      parent.classList.add("avatar-fallback");
    }, { once: true });
  });
}

export function evidenceMarkup(
  path: readonly string[],
  graph: LinkGraphData,
  players: ReadonlyMap<string, LinkPlayer>,
  brokenIndexes = new Set<number>(),
): string {
  const cards: string[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    if (brokenIndexes.has(index)) continue;
    const leftId = path[index];
    const rightId = path[index + 1];
    if (leftId === undefined || rightId === undefined) continue;
    const proofs = graph.evidence[edgeKey(leftId, rightId)] ?? [];
    if (!proofs.length) continue;
    const left = players.get(leftId);
    const right = players.get(rightId);
    if (!left || !right) continue;
    const primary = proofs[0];
    if (!primary) continue;
    const more = proofs.length > 1
      ? `<details><summary>查看全部 ${proofs.length} 条共同效力记录</summary><ul>${proofs.map((proof) => `<li>${escapeHtml(proof.teamName)} · ${escapeHtml(proof.seasonName)}</li>`).join("")}</ul></details>`
      : "";
    cards.push(`<article class="evidence-card">
      <div class="evidence-players"><strong>${escapeHtml(left.name)}</strong><span aria-hidden="true">↔</span><strong>${escapeHtml(right.name)}</strong></div>
      <p><span aria-hidden="true">✓</span> ${escapeHtml(primary.teamName)} · ${escapeHtml(primary.seasonName)}</p>
      ${more}
    </article>`);
  }
  return cards.length ? `<div class="evidence-list"><h3>共同效力证据</h3>${cards.join("")}</div>` : "";
}
