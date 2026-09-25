import { evaluateSubmission, availableDifficulties, DIFFICULTY_LABELS, selectQuestion, type SubmissionResult } from "./game.ts";
import { isTeammate, shortestPath } from "./graph.ts";
import { planPathLayout } from "./path-layout.ts";
import { searchPlayers } from "./search.ts";
import { setupTheme } from "./theme.ts";
import type { Difficulty, LinkGraphData, LinkPlayer, PlayersData, Question } from "./types.ts";
import { avatarMarkup, escapeHtml, evidenceMarkup, installAvatarFallbacks, playerMeta } from "./ui.ts";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少页面元素：${selector}`);
  return element;
}

const loadingState = required<HTMLElement>("#loading-state");
const errorState = required<HTMLElement>("#error-state");
const errorMessage = required<HTMLElement>("#error-message");
const gameContent = required<HTMLElement>("#game-content");
const pathBoard = required<HTMLElement>("#path-board");
const resultPanel = required<HTMLElement>("#result-panel");
const difficultyOptions = required<HTMLElement>("#difficulty-options");
const difficultyBadge = required<HTMLElement>("#difficulty-badge");
const missionHint = required<HTMLElement>("#mission-hint");
const dataNote = required<HTMLElement>("#data-note");
const submitButton = required<HTMLButtonElement>("#submit-path");
const clearButton = required<HTMLButtonElement>("#clear-path");
const nextButton = required<HTMLButtonElement>("#next-question");
const retryButton = required<HTMLButtonElement>("#retry-load");
const playerDialog = required<HTMLDialogElement>("#player-dialog");
const playerSearch = required<HTMLInputElement>("#player-search");
const playerOptions = required<HTMLElement>("#player-options");
const searchStatus = required<HTMLElement>("#search-status");
const rulesDialog = required<HTMLDialogElement>("#rules-dialog");

let players: LinkPlayer[] = [];
let playerById = new Map<string, LinkPlayer>();
let graph: LinkGraphData | null = null;
let question: Question | null = null;
let currentPath: string[] = [];
let currentDifficulty: Difficulty = "standard";
let lastQuestionKey = "";
let submission: SubmissionResult | null = null;
let revealedPath: string[] | null = null;
let attempts = 0;
let startedAt = Date.now();
let insertionIndex = 0;
let visibleSuggestions: LinkPlayer[] = [];
let activeSuggestion = -1;

function getPlayer(playerId: string): LinkPlayer {
  const player = playerById.get(playerId);
  if (!player) throw new Error(`找不到选手：${playerId}`);
  return player;
}

function resetFeedback(): void {
  submission = null;
  revealedPath = null;
  resultPanel.hidden = true;
  resultPanel.innerHTML = "";
  missionHint.textContent = "先加入你认为合适的中间选手，再提交验证。";
}

function renderDifficulties(): void {
  if (!graph) return;
  const available = availableDifficulties(graph);
  if (!available.includes(currentDifficulty)) currentDifficulty = available[0] ?? "standard";
  difficultyOptions.innerHTML = available.map((difficulty) => `
    <button type="button" class="difficulty-option${difficulty === currentDifficulty ? " is-selected" : ""}" data-difficulty="${difficulty}" aria-pressed="${difficulty === currentDifficulty}">
      ${DIFFICULTY_LABELS[difficulty]}
    </button>`).join("");
  difficultyOptions.querySelectorAll<HTMLButtonElement>("button[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.difficulty as Difficulty;
      if (selected === currentDifficulty) return;
      currentDifficulty = selected;
      renderDifficulties();
      newQuestion();
    });
  });
}

function newQuestion(): void {
  if (!graph || !players.length) return;
  nextButton.disabled = true;
  try {
    let next = selectQuestion(graph, players, currentDifficulty);
    for (let retry = 0; retry < 4 && `${next.startId}|${next.targetId}` === lastQuestionKey; retry += 1) {
      next = selectQuestion(graph, players, currentDifficulty);
    }
    question = next;
    lastQuestionKey = `${next.startId}|${next.targetId}`;
    currentPath = [next.startId, next.targetId];
    attempts = 0;
    startedAt = Date.now();
    resetFeedback();
    difficultyBadge.textContent = DIFFICULTY_LABELS[currentDifficulty];
    renderPath();
  } catch (error) {
    showLoadError(error);
  } finally {
    nextButton.disabled = false;
  }
}

function brokenIndexes(): Set<number> {
  return new Set(submission?.kind === "invalid" ? submission.brokenSegments.map((segment) => segment.index) : []);
}

function renderPath(): void {
  if (!question || !graph) return;
  const currentGraph = graph;
  const nodeCount = currentPath.length;
  const layout = planPathLayout(nodeCount, pathBoard.clientWidth);
  pathBoard.style.setProperty("--path-node-width", `${layout.nodeWidth}px`);
  const firstRowLength = layout.rows[0]?.indexes.length ?? 0;
  pathBoard.style.setProperty("--path-track-width", `${firstRowLength * layout.nodeWidth + Math.max(0, firstRowLength - 1) * 56}px`);
  pathBoard.classList.toggle("path-board--compact", nodeCount >= 4);
  pathBoard.classList.toggle("path-board--dense", nodeCount >= 6);
  const broken = brokenIndexes();
  const tested = submission !== null;
  const parts: string[] = [];
  const renderEdge = (index: number, turnSide?: "left" | "right"): string => {
    const playerId = currentPath[index];
    const nextId = currentPath[index + 1];
    if (!playerId || !nextId) return "";
    const isBroken = broken.has(index);
    const isValid = tested && isTeammate(currentGraph, playerId, nextId);
    const edgeClass = isBroken ? " is-broken" : isValid ? " is-valid" : "";
    const status = isBroken ? '<span class="edge-status">× 关系断开</span>' : isValid ? '<span class="edge-status">✓ 队友关系</span>' : "";
    const className = turnSide ? `path-turn path-turn--${turnSide}` : "path-edge";
    return `<div class="${className}${edgeClass}">
      <span class="edge-line" aria-hidden="true"></span>${status}
      <button type="button" class="add-node" data-insert-index="${index + 1}" aria-label="在${escapeHtml(getPlayer(playerId).name)}和${escapeHtml(getPlayer(nextId).name)}之间添加选手"><span class="add-node__icon" aria-hidden="true">＋</span><span class="add-node__label">添加选手</span></button>
    </div>`;
  };
  const renderNode = (playerId: string, index: number): string => {
    const player = getPlayer(playerId);
    const removable = index > 0 && index < currentPath.length - 1;
    return `<article class="path-node${removable ? " path-node--middle" : ""}">
      ${avatarMarkup(player)}
      <div class="node-copy"><strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong><span>${escapeHtml(playerMeta(player))}</span></div>
      ${removable ? `<button type="button" class="remove-node" data-remove-index="${index}" aria-label="删除中间选手${escapeHtml(player.name)}"><span aria-hidden="true">×</span><span>删除</span></button>` : `<span class="endpoint-label">${index === 0 ? "起点" : "终点"}</span>`}
    </article>`;
  };
  layout.rows.forEach((row, rowIndex) => {
    parts.push(`<div class="path-row${row.reversed ? " path-row--reverse" : ""}${rowIndex < layout.rows.length - 1 ? " path-row--full" : ""}">`);
    row.indexes.forEach((index, position) => {
      const playerId = currentPath[index];
      if (!playerId) return;
      parts.push(renderNode(playerId, index));
      if (position < row.indexes.length - 1) parts.push(renderEdge(index));
    });
    parts.push("</div>");
    if (rowIndex < layout.rows.length - 1) {
      const lastIndex = row.indexes.at(-1);
      if (lastIndex !== undefined) parts.push(renderEdge(lastIndex, row.reversed ? "left" : "right"));
    }
  });
  pathBoard.innerHTML = parts.join("");
  installAvatarFallbacks(pathBoard);
  pathBoard.querySelectorAll<HTMLButtonElement>("button[data-insert-index]").forEach((button) => {
    button.addEventListener("click", () => openPlayerSearch(Number(button.dataset.insertIndex)));
  });
  pathBoard.querySelectorAll<HTMLButtonElement>("button[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => {
      currentPath.splice(Number(button.dataset.removeIndex), 1);
      resetFeedback();
      renderPath();
    });
  });
  clearButton.disabled = currentPath.length <= 2;
}

function resultHeader(kind: SubmissionResult["kind"]): string {
  if (kind === "invalid") return '<span class="result-icon" aria-hidden="true">×</span><div><strong>路径断开</strong><span>至少一段没有有效的历史队友关系。</span></div>';
  if (kind === "valid-long") return '<span class="result-icon" aria-hidden="true">↗</span><div><strong>路径成立，但还有更短路线</strong><span>你可以继续调整，也可以主动查看答案。</span></div>';
  return '<span class="result-icon" aria-hidden="true">✓</span><div><strong>最短路径！</strong><span>你找到了理论最短的队友链。</span></div>';
}

function scoreCard(distance: number, revealed: boolean): string {
  const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const verdict = revealed ? "ANSWER VIEWED" : attempts === 1 ? "PERFECT LINK" : "LINK COMPLETE";
  return `<div class="share-card" aria-label="本题成绩卡">
    <span>KPL LINK</span>
    <strong>${Array.from({ length: distance + 1 }, () => "●").join(" ─ ")}</strong>
    <div><span>最短距离 ${distance}</span><span>尝试 ${attempts}</span><span>${elapsed} 秒</span></div>
    <b>${verdict}</b>
  </div>`;
}

function renderResult(): void {
  if (!submission || !graph) return;
  const broken = brokenIndexes();
  let metrics = "";
  let detail = "";
  let actions = "";
  if (submission.kind === "invalid") {
    detail = submission.brokenSegments.map((segment) => {
      const from = getPlayer(segment.from).name;
      const to = getPlayer(segment.to).name;
      return `<p class="broken-copy"><strong>${escapeHtml(from)} 与 ${escapeHtml(to)}</strong>没有有效的历史队友关系。</p>`;
    }).join("");
    detail += evidenceMarkup(currentPath, graph, playerById, broken);
    actions = revealedPath
      ? '<button class="primary-button" data-action="next" type="button">下一题</button>'
      : '<button class="secondary-button" data-action="continue" type="button">继续修改</button><button class="danger-button" data-action="reveal" type="button">查看答案</button><button class="secondary-button" data-action="next" type="button">下一题</button>';
  } else {
    metrics = `<div class="result-metrics"><span>你的路径<strong>${submission.distance} 跳</strong></span><span>理论最短<strong>${submission.shortest} 跳</strong></span><span>尝试次数<strong>${attempts}</strong></span></div>`;
    detail = evidenceMarkup(currentPath, graph, playerById);
    if (submission.kind === "valid-long" && !revealedPath) {
      actions = '<button class="secondary-button" data-action="continue" type="button">继续挑战</button><button class="danger-button" data-action="reveal" type="button">查看最短路径</button><button class="secondary-button" data-action="next" type="button">下一题</button>';
    } else if (revealedPath) {
      actions = '<button class="secondary-button" data-action="copy" type="button">复制成绩</button><button class="primary-button" data-action="next" type="button">下一题</button>';
    } else {
      actions = '<button class="secondary-button" data-action="copy" type="button">复制成绩</button><button class="primary-button" data-action="next" type="button">下一题</button>';
      detail += scoreCard(submission.shortest, Boolean(revealedPath));
    }
  }

  if (revealedPath) {
    const names = revealedPath.map((playerId) => escapeHtml(getPlayer(playerId).name));
    detail = `<section class="answer-path"><span>一个最短答案</span><strong>${names.join(" <i aria-hidden=\"true\">→</i> ")}</strong></section>${evidenceMarkup(revealedPath, graph, playerById)}${scoreCard(revealedPath.length - 1, true)}`;
  }

  resultPanel.className = `result-panel result-panel--${submission.kind}`;
  resultPanel.innerHTML = `<div class="result-heading">${resultHeader(submission.kind)}</div>${metrics}${detail}<div class="result-actions">${actions}</div><p id="copy-status" class="copy-status" aria-live="polite"></p>`;
  resultPanel.hidden = false;
  resultPanel.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleResultAction(button.dataset.action ?? ""));
  });
}

function handleResultAction(action: string): void {
  if (!graph || !question) return;
  if (action === "continue") {
    resetFeedback();
    renderPath();
  } else if (action === "reveal") {
    revealedPath = shortestPath(graph, question.startId, question.targetId);
    renderResult();
  } else if (action === "next") {
    newQuestion();
  } else if (action === "copy" && submission && submission.kind !== "invalid") {
    const text = `KPL LINK\n${Array.from({ length: submission.shortest + 1 }, () => "●").join(" ─ ")}\n最短距离：${submission.shortest}\n尝试：${attempts}\n${revealedPath ? "ANSWER VIEWED" : submission.kind === "shortest" ? "🏆 PERFECT" : "LINK COMPLETE"}`;
    navigator.clipboard.writeText(text).then(
      () => { const status = document.querySelector<HTMLElement>("#copy-status"); if (status) status.textContent = "成绩已复制，不包含真实答案。"; },
      () => { const status = document.querySelector<HTMLElement>("#copy-status"); if (status) status.textContent = "复制失败，请直接截图成绩卡。"; },
    );
  }
}

function submitPath(): void {
  if (!graph || !question) return;
  attempts += 1;
  submission = evaluateSubmission(currentPath, graph);
  revealedPath = null;
  if (submission.kind !== "invalid") {
    missionHint.textContent = `本题理论最短距离为 ${submission.shortest} 跳。`;
  }
  renderPath();
  renderResult();
  resultPanel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
}

function openPlayerSearch(index: number): void {
  insertionIndex = index;
  playerSearch.value = "";
  activeSuggestion = -1;
  renderSuggestions();
  playerDialog.showModal();
  requestAnimationFrame(() => playerSearch.focus());
}

function renderSuggestions(): void {
  const excluded = new Set(currentPath);
  visibleSuggestions = searchPlayers(players, playerSearch.value).filter((player) => !excluded.has(player.id));
  if (activeSuggestion >= visibleSuggestions.length) activeSuggestion = visibleSuggestions.length - 1;
  playerOptions.innerHTML = visibleSuggestions.map((player, index) => `
    <button type="button" id="player-option-${index}" class="player-option${index === activeSuggestion ? " is-active" : ""}" role="option" aria-selected="${index === activeSuggestion}" data-player-id="${escapeHtml(player.id)}">
      ${avatarMarkup(player, "search-avatar")}
      <span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(playerMeta(player))}</small></span>
      <b aria-hidden="true">＋</b>
    </button>`).join("");
  installAvatarFallbacks(playerOptions);
  playerSearch.setAttribute("aria-expanded", String(visibleSuggestions.length > 0));
  if (activeSuggestion >= 0) playerSearch.setAttribute("aria-activedescendant", `player-option-${activeSuggestion}`);
  else playerSearch.removeAttribute("aria-activedescendant");
  searchStatus.textContent = visibleSuggestions.length ? `共 ${visibleSuggestions.length} 位可选选手 · 滚动浏览或输入昵称搜索` : "没有找到可添加的选手";
  playerOptions.querySelectorAll<HTMLButtonElement>("button[data-player-id]").forEach((button) => {
    button.addEventListener("click", () => choosePlayer(button.dataset.playerId ?? ""));
  });
}

function choosePlayer(playerId: string): void {
  if (!playerId || currentPath.includes(playerId)) return;
  currentPath.splice(insertionIndex, 0, playerId);
  playerDialog.close();
  resetFeedback();
  renderPath();
}

function showLoadError(error: unknown): void {
  loadingState.hidden = true;
  gameContent.hidden = true;
  errorState.hidden = false;
  errorMessage.textContent = error instanceof Error ? error.message : "请检查网络后重试。";
}

async function loadGame(): Promise<void> {
  loadingState.hidden = false;
  errorState.hidden = true;
  gameContent.hidden = true;
  try {
    const [playersResponse, graphResponse] = await Promise.all([
      fetch("./data/players.json", { cache: "no-cache" }),
      fetch("./data/link_graph.json", { cache: "no-cache" }),
    ]);
    if (!playersResponse.ok || !graphResponse.ok) throw new Error("无法读取本地关系数据。请重新构建并刷新页面。");
    const playersData = await playersResponse.json() as PlayersData;
    const graphData = await graphResponse.json() as LinkGraphData;
    if (playersData.dataVersion !== graphData.dataVersion) throw new Error("选手与图谱数据版本不一致。请重新构建。");
    players = playersData.players;
    playerById = new Map(players.map((player) => [player.id, player]));
    graph = graphData;
    loadingState.hidden = true;
    gameContent.hidden = false;
    dataNote.textContent = `数据版本 ${graph.dataVersion} · ${graph.stats.playerCount} 位选手 · ${graph.stats.edgeCount} 条队友关系 · 关系只依据同赛季同俱乐部记录`;
    renderDifficulties();
    newQuestion();
  } catch (error) {
    showLoadError(error);
  }
}

submitButton.addEventListener("click", submitPath);
clearButton.addEventListener("click", () => {
  if (!question) return;
  currentPath = [question.startId, question.targetId];
  resetFeedback();
  renderPath();
});
nextButton.addEventListener("click", newQuestion);
retryButton.addEventListener("click", () => void loadGame());
playerSearch.addEventListener("input", () => { activeSuggestion = -1; renderSuggestions(); });
playerSearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const change = event.key === "ArrowDown" ? 1 : -1;
    activeSuggestion = (activeSuggestion + change + visibleSuggestions.length) % Math.max(visibleSuggestions.length, 1);
    renderSuggestions();
  } else if (event.key === "Enter" && activeSuggestion >= 0) {
    event.preventDefault();
    const player = visibleSuggestions[activeSuggestion];
    if (player) choosePlayer(player.id);
  } else if (event.key === "Escape") {
    playerDialog.close();
  }
});
required<HTMLButtonElement>("#close-player-dialog").addEventListener("click", () => playerDialog.close());
required<HTMLButtonElement>("#rules-button").addEventListener("click", () => rulesDialog.showModal());
required<HTMLButtonElement>("#close-rules-dialog").addEventListener("click", () => rulesDialog.close());
required<HTMLButtonElement>("#rules-confirm").addEventListener("click", () => rulesDialog.close());

setupTheme();
let lastBoardWidth = 0;
new ResizeObserver(() => {
  const width = pathBoard.clientWidth;
  if (width !== lastBoardWidth && question) {
    lastBoardWidth = width;
    renderPath();
  }
}).observe(pathBoard);
void loadGame();
