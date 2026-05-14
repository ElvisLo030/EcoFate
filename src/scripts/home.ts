import { loadGameState, saveGameState, clearGameState } from "@/lib/game/storage";
import { createLeaderboardService } from "@/lib/leaderboard/firebase";
import type { GameContent, GameState, DayId, SpRouteContent } from "@/lib/game/types";

// ──────────────────────────────────────────────
// 讀取遊戲內容（建置期序列化到頁面）
// ──────────────────────────────────────────────
function readContent(): GameContent {
  const el = document.getElementById("game-content");
  if (!el) throw new Error("找不到 game-content 資料。");
  return JSON.parse(el.textContent ?? "{}") as GameContent;
}

const content = readContent();
const BASE_URL = import.meta.env.BASE_URL || "/";
const GAME_URL = `${BASE_URL}game`;

// ──────────────────────────────────────────────
// 角色依進度顯示
// ──────────────────────────────────────────────
const DAY_CHARACTERS: Array<{ dayIndex: number; key: string }> = [
  { dayIndex: 0, key: "kosumi" },
  { dayIndex: 1, key: "coco" },
  { dayIndex: 2, key: "hakuon" },
  { dayIndex: 3, key: "jinsui" },
  { dayIndex: 4, key: "yiyun" },
];

function renderCharacters(state: GameState | null): void {
  const container = document.getElementById("home-characters");
  if (!container) return;

  const visibleKeys: string[] = [];

  if (!state) {
    visibleKeys.push("kosumi");
  } else {
    for (const { dayIndex, key } of DAY_CHARACTERS) {
      if (state.currentDayIndex >= dayIndex) visibleKeys.push(key);
    }
    if (state.completedSpRoutes.includes("sp1")) visibleKeys.push("ivy");
    if (state.completedSpRoutes.includes("sp2")) visibleKeys.push("shino");
  }

  container.replaceChildren();
  for (const key of visibleKeys) {
    const char = content.characters[key];
    if (!char) continue;
    const img = document.createElement("img");
    img.className = "home-character-img";
    img.src = `${BASE_URL}${char.portrait}`;
    img.alt = char.displayName;
    container.append(img);
  }
}

// ──────────────────────────────────────────────
// 選單按鈕
// ──────────────────────────────────────────────
function renderMenu(state: GameState | null): void {
  const menu = document.getElementById("home-menu");
  if (!menu) return;

  menu.replaceChildren();

  const hasSave = Boolean(state);
  const isCompleted = state?.completed ?? false;

  // 開始 / 繼續 / 重新開始
  const primaryBtn = document.createElement("button");
  primaryBtn.className = "home-menu-btn home-menu-btn--primary";
  if (!hasSave) {
    primaryBtn.textContent = "▶ 開始新遊戲";
    primaryBtn.addEventListener("click", () => {
      clearGameState();
      window.location.href = GAME_URL;
    });
  } else if (isCompleted) {
    primaryBtn.textContent = "↺ 重新開始";
    primaryBtn.addEventListener("click", () => {
      if (!confirm("確定要清除存檔、重新開始嗎？")) return;
      clearGameState();
      window.location.href = GAME_URL;
    });
  } else {
    primaryBtn.textContent = "▶ 繼續遊戲";
    primaryBtn.addEventListener("click", () => {
      window.location.href = GAME_URL;
    });
  }
  menu.append(primaryBtn);

  // 只有有存檔才顯示以下按鈕
  if (hasSave) {
    // 選擇章節
    const chapterBtn = document.createElement("button");
    chapterBtn.className = "home-menu-btn home-menu-btn--secondary";
    chapterBtn.textContent = "📖 選擇章節";
    chapterBtn.addEventListener("click", () => openChapterModal(state!));
    menu.append(chapterBtn);

    // 知識卡
    const knowledgeBtn = document.createElement("button");
    knowledgeBtn.className = "home-menu-btn home-menu-btn--knowledge";
    knowledgeBtn.textContent = "💡 知識卡";
    knowledgeBtn.addEventListener("click", () => openKnowledgeModal(state!));
    menu.append(knowledgeBtn);
  }

  // 排行榜（永遠顯示）
  const lbBtn = document.createElement("button");
  lbBtn.className = "home-menu-btn home-menu-btn--leaderboard";
  lbBtn.textContent = "🏆 排行榜";
  lbBtn.addEventListener("click", openLeaderboardModal);
  menu.append(lbBtn);
}

// ──────────────────────────────────────────────
// 知識卡 Modal（兩層式：天數列表 → 知識卡）
// ──────────────────────────────────────────────
function openKnowledgeModal(state: GameState): void {
  const modal = document.getElementById("knowledge-modal");
  if (!modal) return;
  const listEl = document.getElementById("knowledge-list");
  if (!listEl) return;
  renderKnowledgeDayList(listEl, state);
  modal.hidden = false;
}

// 第一層：顯示天數選擇按鈕
function renderKnowledgeDayList(listEl: HTMLElement, state: GameState): void {
  listEl.replaceChildren();
  const container = document.createElement("div");
  container.className = "knowledge-day-list";

  // 主線 5 天
  content.days.forEach((day, i) => {
    const isUnlocked = i <= state.currentDayIndex;
    const chapterTitle = content.ui[`chapter${day.order}_title`] ?? day.theme;
    const char = content.characters[day.heroine];
    const btn = buildKnowledgeDayBtn(
      isUnlocked ? `D${day.order}` : `🔒 D${day.order}`,
      chapterTitle,
      char,
      isUnlocked
    );
    if (isUnlocked) {
      btn.addEventListener("click", () =>
        renderKnowledgeCardView(listEl, state, `D${day.order}　${chapterTitle}`, day.stages)
      );
    }
    container.append(btn);
  });

  // SP 路線（僅已解鎖才顯示於列表末尾）
  if (content.spRoutes) {
    content.spRoutes.forEach((sp, spIdx) => {
      if (!state.completedSpRoutes.includes(sp.id)) return;
      const spTitle = content.ui[`special_chapter${spIdx + 1}_title`] ?? sp.displayName;
      const char = content.characters[sp.heroine];
      const btn = buildKnowledgeDayBtn(sp.id.toUpperCase(), spTitle, char, true);
      btn.addEventListener("click", () =>
        renderKnowledgeCardView(listEl, state, `${sp.id.toUpperCase()}　${spTitle}`, sp.stages)
      );
      container.append(btn);
    });
  }

  listEl.append(container);
}

// 建立天數選擇按鈕（左側：標籤＋主題，右側：角色縮圖）
function buildKnowledgeDayBtn(
  dayLabel: string,
  chapterTitle: string,
  char: { portrait: string; displayName: string } | undefined,
  isUnlocked: boolean
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `knowledge-day-btn${isUnlocked ? "" : " knowledge-day-btn--locked"}`;
  btn.type = "button";
  if (!isUnlocked) btn.disabled = true;

  const infoEl = document.createElement("div");
  infoEl.className = "knowledge-day-btn__info";

  const labelEl = document.createElement("span");
  labelEl.className = "knowledge-day-btn__day-label";
  labelEl.textContent = dayLabel;

  const chapterEl = document.createElement("span");
  chapterEl.className = "knowledge-day-btn__chapter";
  chapterEl.textContent = chapterTitle;

  infoEl.append(labelEl, chapterEl);
  btn.append(infoEl);

  if (char) {
    const thumb = document.createElement("img");
    thumb.className = "knowledge-day-btn__thumb";
    thumb.src = `${BASE_URL}${char.portrait}`;
    thumb.alt = char.displayName;
    btn.append(thumb);
  }

  return btn;
}

// 第二層：顯示指定天的知識卡，頂部附返回按鈕
function renderKnowledgeCardView(
  listEl: HTMLElement,
  state: GameState,
  headerTitle: string,
  stages: Array<{ id: string; knowledgePoint?: string }>
): void {
  listEl.replaceChildren();

  const headerRow = document.createElement("div");
  headerRow.className = "knowledge-day-cards-header";

  const backBtn = document.createElement("button");
  backBtn.className = "knowledge-back-btn";
  backBtn.type = "button";
  backBtn.textContent = "← 返回";
  backBtn.addEventListener("click", () => renderKnowledgeDayList(listEl, state));

  const titleEl = document.createElement("span");
  titleEl.className = "knowledge-day-cards-title";
  titleEl.textContent = headerTitle;

  headerRow.append(backBtn, titleEl);
  listEl.append(headerRow);

  const cardsContainer = document.createElement("div");
  cardsContainer.className = "knowledge-day-group";

  for (const stage of stages) {
    const card = document.createElement("div");
    const isAnswered = state.answeredStageIds.includes(stage.id);
    if (isAnswered && stage.knowledgePoint) {
      card.className = "knowledge-card";
      card.textContent = stage.knowledgePoint;
    } else {
      card.className = "knowledge-card knowledge-card--locked";
      card.textContent = "🔒 完成該關卡後解鎖";
    }
    cardsContainer.append(card);
  }

  listEl.append(cardsContainer);
}

// ──────────────────────────────────────────────
// 選擇章節 Modal
// ──────────────────────────────────────────────
function openChapterModal(state: GameState): void {
  const modal = document.getElementById("chapter-modal");
  if (!modal) return;

  const listEl = document.getElementById("chapter-list");
  if (!listEl) return;

  listEl.replaceChildren();

  for (let i = 0; i <= state.currentDayIndex; i++) {
    const day = content.days[i];
    if (!day) continue;

    const btn = document.createElement("button");
    btn.className = `chapter-btn${i === state.currentDayIndex ? " chapter-btn--current" : ""}`;
    const chapterTitle = content.ui[`chapter${day.order}_title`] ?? day.theme;
    btn.textContent = `D${day.order}：${chapterTitle}`;
    btn.addEventListener("click", () => jumpToChapter(state, i));
    listEl.append(btn);
  }

  // SP 路線（僅顯示已遊玩完成的）
  if (content.spRoutes) {
    content.spRoutes.forEach((sp, spIdx) => {
      if (!state.completedSpRoutes.includes(sp.id)) return;
      const spTitle = content.ui[`special_chapter${spIdx + 1}_title`] ?? sp.displayName;
      const btn = document.createElement("button");
      btn.className = "chapter-btn chapter-btn--sp";
      btn.textContent = `${sp.id.toUpperCase()}：${spTitle}`;
      btn.addEventListener("click", () => jumpToSpRoute(state, sp));
      listEl.append(btn);
    });
  }

  modal.hidden = false;
}

function jumpToChapter(state: GameState, dayIndex: number): void {
  const dayId = content.days[dayIndex]?.id;
  if (!dayId) return;

  if (!confirm(`確定要從 Day ${dayIndex + 1} 重頭開始？之後的進度將會重置。`)) return;

  // 保留前幾天的分數，清除目前天及之後
  const dayIds: DayId[] = ["day1", "day2", "day3", "day4", "day5"];
  for (let i = dayIndex; i < dayIds.length; i++) {
    state.dayScores[dayIds[i]] = 0;
  }
  // 清除答題記錄（保留前幾天已答的）
  const daysToKeep = dayIds.slice(0, dayIndex);
  const keepPrefixes = daysToKeep.map((_, idx) => `${idx + 1}-`);
  state.answeredStageIds = state.answeredStageIds.filter((id) =>
    keepPrefixes.some((prefix) => id.startsWith(prefix))
  );
  state.selectedAnswers = Object.fromEntries(
    Object.entries(state.selectedAnswers).filter(([id]) =>
      keepPrefixes.some((prefix) => id.startsWith(prefix))
    )
  );

  // 重設進度指標
  state.currentDayIndex = dayIndex;
  state.currentStageIndex = 0;
  state.completedIntros = state.completedIntros.filter((d) =>
    daysToKeep.includes(d)
  );
  state.completedOutros = state.completedOutros.filter((d) =>
    daysToKeep.includes(d)
  );

  // 清除 SP 路線相關狀態（如果在重設範圍後才解鎖）
  state.pendingSpRouteId = null;
  state.currentSpRouteId = null;
  state.currentSpStageIndex = 0;

  // 重設完成狀態
  state.completed = false;
  state.completedEnding = false;
  state.completedEpilogue = false;
  state.toBeContinued = false;

  // 重新計算 totalScore
  state.totalScore = Object.values(state.dayScores).reduce((s, v) => s + v, 0);

  saveGameState(state);
  window.location.href = GAME_URL;
}

function jumpToSpRoute(state: GameState, sp: SpRouteContent): void {
  const spTitle = sp.displayName;
  if (!confirm(`確定要重新遊玩「${spTitle}」？此 SP 路線積分將會重置。`)) return;

  // 設定 SP 路線為當前播放中
  state.currentSpRouteId = sp.id;
  state.currentSpStageIndex = 0;
  state.pendingSpRouteId = null;

  // 重設 intro 完成狀態，讓 intro 重播
  state.completedSpRouteIntros = state.completedSpRouteIntros.filter((id) => id !== sp.id);

  // 重設 SP 路線積分
  state.spScores[sp.id] = 0;
  state.totalScore =
    Object.values(state.dayScores).reduce((s, v) => s + v, 0) +
    Object.values(state.spScores).reduce((s, v) => s + v, 0);

  // 若遊戲已完成，清除完成狀態讓 SP 路線能正常執行
  if (state.completed) {
    state.completed = false;
    state.completedEnding = false;
    state.completedEpilogue = false;
  }

  saveGameState(state);
  window.location.href = GAME_URL;
}

// 排行榜服務單例（避免重複初始化 Firebase）
let _leaderboardService: ReturnType<typeof createLeaderboardService> | null = null;
function getLeaderboardService() {
  if (!_leaderboardService) _leaderboardService = createLeaderboardService();
  return _leaderboardService;
}

// ──────────────────────────────────────────────
// 排行榜 Modal
// ──────────────────────────────────────────────
async function openLeaderboardModal(): Promise<void> {
  const modal = document.getElementById("leaderboard-modal");
  if (!modal) return;

  const listEl = document.getElementById("leaderboard-content");
  if (!listEl) return;

  modal.hidden = false;
  listEl.innerHTML = '<p class="leaderboard-loading">載入中…</p>';

  try {
    const service = getLeaderboardService();
    if (!service.enabled) {
      listEl.innerHTML = '<p class="leaderboard-loading">排行榜功能尚未啟用。</p>';
      return;
    }

    const entries = await service.fetchTopScores();
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="leaderboard-loading">目前還沒有記錄，快去玩吧！</p>';
      return;
    }

    const table = document.createElement("table");
    table.className = "leaderboard-table";
    table.innerHTML = `<thead><tr><th>#</th><th>玩家</th><th>積分</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    entries.forEach((entry, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx + 1}</td><td>${escapeHtml(entry.playerName)}</td><td>${entry.score}</td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    listEl.replaceChildren(table);
  } catch {
    listEl.innerHTML = '<p class="leaderboard-loading">排行榜載入失敗，請稍後再試。</p>';
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────
// Modal 關閉按鈕
// ──────────────────────────────────────────────
function setupModalClose(modalId: string, closeId: string): void {
  const modal = document.getElementById(modalId);
  const closeBtn = document.getElementById(closeId);
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
}

// ──────────────────────────────────────────────
// 初始化
// ──────────────────────────────────────────────
const state = loadGameState();

renderCharacters(state);
renderMenu(state);

setupModalClose("knowledge-modal", "knowledge-modal-close");
setupModalClose("chapter-modal", "chapter-modal-close");
setupModalClose("leaderboard-modal", "leaderboard-modal-close");
