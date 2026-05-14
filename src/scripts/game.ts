import { animate } from "@motionone/dom";
import gsap from "gsap";
import { advanceStage, answerSpStage, answerStage, createInitialState, evaluateCondition, evaluateEnding, getCurrentDay, getCurrentStage, replacePlaceholders } from "@/lib/game/engine";
import { clearGameState, loadGameState, resetGameState, saveGameState } from "@/lib/game/storage";
import type { AnswerResult, BranchCondition, DayContent, DayId, DayIntroContent, DayOutroBranchContent, EndingResultContent, GameContent, GameState, NameDayIntroContent, PrologueScene, SpRouteContent, SpRouteId, StageContent, StorySceneContent } from "@/lib/game/types";
import { sanitizeNickname, MAX_NICKNAME_LENGTH } from "@/lib/security/profanity";

const content = readContent();

const refs = {
  playerNameLabel: getElement<HTMLElement>("player-name-label"),
  routeLabel: getElement<HTMLElement>("route-label"),
  progressLabel: getElement<HTMLElement>("progress-label"),
  totalScore: getElement<HTMLElement>("total-score"),
  scoreProgress: getElement<HTMLElement>("score-progress"),
  scoreProgressFill: getElement<HTMLElement>("score-progress-fill"),
  stageTitle: getElement<HTMLElement>("stage-title"),
  sceneVisual: getElement<HTMLElement>("scene-visual"),
  characterPortrait: getElement<HTMLImageElement>("character-portrait"),
  speakerName: getElement<HTMLElement>("speaker-name"),
  dialogBox: getElement<HTMLElement>("dialog-box"),
  dialogText: getElement<HTMLElement>("dialog-text"),
  dialogContinue: getElement<HTMLElement>("dialog-continue"),
  choiceArea: getElement<HTMLElement>("choice-area"),
  choiceList: getElement<HTMLElement>("choice-list"),
  feedbackBox: getElement<HTMLElement>("feedback-box"),
  feedbackTitle: getElement<HTMLElement>("feedback-title"),
  feedbackText: getElement<HTMLElement>("feedback-text"),
  toastStack: getElement<HTMLElement>("toast-stack"),
  settingsButton: getElement<HTMLButtonElement>("settings-button"),
  nextButton: getElement<HTMLButtonElement>("next-stage-button"),
  resultPanel: getElement<HTMLElement>("result-panel"),
  resultSummary: getElement<HTMLElement>("result-summary"),
  resultPlayerName: getElement<HTMLElement>("result-player-name"),
  resultElapsedTime: getElement<HTMLElement>("result-elapsed-time"),
  resultEndingName: getElement<HTMLElement>("result-ending-name"),
  resultTotal: getElement<HTMLElement>("result-total"),
  resultSp: getElement<HTMLElement>("result-sp"),
  resultGroupStats: getElement<HTMLElement>("result-group-stats"),
  leaderboardForm: getElement<HTMLFormElement>("leaderboard-form"),
  submitScoreButton: getElement<HTMLButtonElement>("submit-score-button"),
  leaderboardStatus: getElement<HTMLElement>("leaderboard-status"),
  leaderboardList: getElement<HTMLOListElement>("leaderboard-list"),
  sidePanel: getElement<HTMLElement>("side-panel"),
  footerBar: getElement<HTMLElement>("footer-bar")
};

// 監聽 choiceList 子元素變化，有內容時顯示 choice-area 與 side-panel
new MutationObserver(() => {
  const hasChoices = refs.choiceList.children.length > 0;
  refs.choiceArea.hidden = !hasChoices;
  if (!refs.resultPanel.hidden) {
    refs.sidePanel.hidden = false;
  } else {
    refs.sidePanel.hidden = !hasChoices;
  }
}).observe(refs.choiceList, { childList: true });

// 監聽 nextButton 屬性變化，控制 footer-bar 可見性
new MutationObserver(() => {
  refs.footerBar.hidden = refs.nextButton.disabled || refs.nextButton.hidden;
}).observe(refs.nextButton, { attributes: true, attributeFilter: ["disabled", "hidden"] });

let state = loadGameState();
// 存檔與目前天數結構不符時清除
if (state && state.currentDayIndex >= content.days.length) {
  clearGameState();
  state = null;
}
if (state) {
  let migrated = false;
  const storedState = state as Partial<GameState> & Record<string, unknown>;

  // 補全缺少的新欄位
  if (!state.spScores) {
    state.spScores = { sp1: 0, sp2: 0 };
    migrated = true;
  }
  if (!Array.isArray(state.completedIntros)) {
    state.completedIntros = [];
    migrated = true;
  }
  if (!Array.isArray(state.completedOutros)) {
    state.completedOutros = [];
    migrated = true;
  }
  if (!Array.isArray(state.completedSpRouteIntros)) {
    state.completedSpRouteIntros = [];
    migrated = true;
  }
  if (!Array.isArray(state.completedSpRoutes)) {
    state.completedSpRoutes = [];
    migrated = true;
  }
  if (!("pendingSpRouteId" in storedState)) {
    state.pendingSpRouteId = null;
    migrated = true;
  }
  if (!("currentSpRouteId" in storedState)) {
    state.currentSpRouteId = null;
    migrated = true;
  }
  if (!("currentSpStageIndex" in storedState)) {
    state.currentSpStageIndex = 0;
    migrated = true;
  }
  if (!("toBeContinued" in storedState)) {
    state.toBeContinued = false;
    migrated = true;
  }
  if (!("completedEnding" in storedState)) {
    state.completedEnding = false;
    migrated = true;
  }
  if (!("completedEpilogue" in storedState)) {
    state.completedEpilogue = false;
    migrated = true;
  }
  if (typeof state.startedAt !== "number") {
    state.startedAt = state.savedAt || Date.now();
    migrated = true;
  }
  if (!("completedAt" in storedState)) {
    state.completedAt = state.completed ? state.savedAt : null;
    migrated = true;
  }
  if (migrated) saveGameState(state);
}
let latestAnswer: AnswerResult | null = null;

// 對話分段狀態
let pendingSegments: string[] = [];
let currentSegmentText = "";
let currentTween: gsap.core.Tween | null = null;
let isDialogPaused = false;
let isNameEntryMode = false;

// 選項選擇狀態（待確認 vs 已計分）
let pendingOptionId: string | null = null;
let onDialogComplete: (() => void) | null = null;

// 回應對話開始後，下次點擊對話框即隱藏 side-panel
let hideSidePanelOnNextDialogClick = false;

// 序章狀態
type ProloguePhase = "pre-choice" | "branch" | "ending";
let prologueCompleted = Boolean(state);
let prologuePhase: ProloguePhase = "pre-choice";
let prologuePendingChoiceId: string | null = null;

// D1-0 開場狀態：非計分 intro，名稱輸入完成後才建立正式存檔。
type DayIntroPhase = "before-name" | "name-entry" | "after-name";
let dayIntroCompleted = Boolean(state);
let dayIntroPhase: DayIntroPhase = "before-name";
let activeDayOutroId: DayId | null = null;
let activeDayOpeningId: DayId | null = null;

// 一次性初始化固定 UI 文字（不屬於遊戲邏輯，只設定一次）
const continueSpan = refs.dialogContinue.querySelector("span");
if (continueSpan) continueSpan.textContent = content.ui.dialogContinueText;

// 設定面板控制
const settingsPanel = document.getElementById("settings-panel") as HTMLDivElement | null;
const settingsClose = document.getElementById("settings-close") as HTMLButtonElement | null;
const settingsRestart = document.getElementById("settings-restart") as HTMLButtonElement | null;
const settingsHelp = document.getElementById("settings-help") as HTMLButtonElement | null;
const settingsHome = document.getElementById("settings-home") as HTMLButtonElement | null;

refs.settingsButton.addEventListener("click", () => {
  if (settingsPanel) settingsPanel.hidden = false;
});

settingsClose?.addEventListener("click", () => {
  if (settingsPanel) settingsPanel.hidden = true;
});

settingsPanel?.addEventListener("click", (e) => {
  if (e.target === settingsPanel) settingsPanel.hidden = true;
});

settingsRestart?.addEventListener("click", () => {
  if (!confirm(content.ui.settingsRestartConfirm)) return;
  if (settingsPanel) settingsPanel.hidden = true;
  clearGameState();
  state = null;
  latestAnswer = null;
  pendingOptionId = null;
  onDialogComplete = null;
  prologueCompleted = false;
  prologuePhase = "pre-choice";
  prologuePendingChoiceId = null;
  dayIntroCompleted = false;
  dayIntroPhase = "before-name";
  activeDayOutroId = null;
  activeDayOpeningId = null;
  refs.resultPanel.hidden = true;
  render();
});

settingsHelp?.addEventListener("click", () => {
  if (settingsPanel) settingsPanel.hidden = true;
  const overlay = document.getElementById("welcome-overlay");
  if (overlay) overlay.hidden = false;
});

settingsHome?.addEventListener("click", () => {
  if (settingsPanel) settingsPanel.hidden = true;
  const wantSave = confirm(content.ui.settingsHomeConfirm);
  if (wantSave && state) saveGameState(state);
  window.location.href = import.meta.env.BASE_URL || "/";
});

refs.nextButton.addEventListener("click", () => {
  // 序章流程
  if (!prologueCompleted && content.prologue) {
    handlePrologueNext();
    return;
  }

  if (!dayIntroCompleted && getDayOneIntro()) {
    handleDayIntroNext();
    return;
  }

  // 名稱輸入模式：提交名稱
  if (isNameEntryMode) {
    const nameInput = document.getElementById("player-name-input") as HTMLInputElement | null;
    const nameError = document.getElementById("name-error") as HTMLElement | null;
    if (!nameInput) return;
    const result = sanitizeNickname(nameInput.value);
    if (!result.ok) {
      if (nameError) {
        const errorMap: Record<string, string> = {
          empty:   content.ui.nameErrorEmpty,
          tooLong: fmt(content.ui.nameErrorTooLong, { maxLength: MAX_NICKNAME_LENGTH }),
          profane: content.ui.nameErrorProfane,
        };
        nameError.textContent = result.errorCode ? (errorMap[result.errorCode] ?? "") : "";
      }
      return;
    }
    state = resetGameState(result.value);
    latestAnswer = null;
    isNameEntryMode = false;
    render();
    return;
  }

  if (!state) return;

  if (state.completed) {
    handleCompletedNext();
    return;
  }

  if (state.toBeContinued) {
    return;
  }

  if (state.pendingSpRouteId) {
    startPendingSpRoute();
    return;
  }

  if (state.currentSpRouteId) {
    handleSpRouteNext();
    return;
  }

  if (activeDayOpeningId) {
    completeActiveDayOpening();
    return;
  }

  if (activeDayOutroId) {
    completeActiveDayOutro();
    return;
  }

  const stage = getCurrentStage(content, state);
  const scoredOptionId = getSelectedOptionId(stage);

  // 有待確認的選項（已選但未計分）：確認選擇並計分
  if (pendingOptionId && !scoredOptionId) {
    latestAnswer = answerStage(content, state, pendingOptionId);
    saveGameState(state);
    const confirmedId = pendingOptionId;
    pendingOptionId = null;
    renderChoices(stage, confirmedId, null);
    if (stage.responseDialogues) {
      refs.feedbackBox.hidden = true;
    } else {
      renderFeedback(stage, confirmedId);
    }
    renderScore();
    refs.nextButton.textContent = latestAnswer.gameCompleted && !shouldRenderDayOutro(content, state)
      ? content.ui.finishButton
      : content.ui.nextButton;
    refs.nextButton.disabled = true;
    renderStageResponse(stage, confirmedId, () => {
      refs.nextButton.disabled = false;
    });
    renderToasts([]);
    return;
  }

  // 已計分：前往下一關
  if (!scoredOptionId) return;
  if (shouldRenderDayOutro(content, state)) {
    render();
    return;
  }
  advanceStage(content, state);
  saveGameState(state);
  latestAnswer = null;
  render();
});

// 點擊對話框：跳過打字機或推進分段
refs.dialogBox.addEventListener("click", () => {
  // 回應對話後首次點擊：隱藏 side-panel
  if (hideSidePanelOnNextDialogClick) {
    hideSidePanelOnNextDialogClick = false;
    refs.sidePanel.hidden = true;
  }

  if (currentTween?.isActive()) {
    // 打字機播放中：立即跳至段落末尾
    currentTween.kill();
    currentTween = null;
    refs.dialogText.textContent = currentSegmentText;
    refs.dialogText.classList.add("is-finished");
    if (pendingSegments.length > 0) {
      isDialogPaused = true;
      refs.dialogContinue.hidden = false;
      requestAnimationFrame(() => { refs.dialogText.scrollTop = refs.dialogText.scrollHeight; });
    } else {
      // 最後一段跳過：觸發對話完成回調
      const cb = onDialogComplete;
      onDialogComplete = null;
      cb?.();
    }
    return;
  }
  // 等待點擊狀態：繼續下一段
  if (isDialogPaused) {
    isDialogPaused = false;
    refs.dialogContinue.hidden = true;
    playNextSegment();
  }
});

refs.leaderboardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.leaderboardStatus.textContent = "排行榜功能已保留，尚未開放送出。";
  refs.submitScoreButton.disabled = true;
});

render();

function render(): void {
  if (!dayIntroCompleted && getDayOneIntro() && (prologueCompleted || !content.prologue)) {
    renderDayIntro();
    return;
  }

  if (!state) {
    if (!prologueCompleted && content.prologue) {
      renderPrologue();
    } else {
      renderBeforeStart();
    }
    return;
  }

  isNameEntryMode = false;
  pendingOptionId = null;
  onDialogComplete = null;
  refs.playerNameLabel.textContent = state.playerName;
  renderScore();

  if (state.completed) {
    renderCompleted();
    return;
  }

  if (state.toBeContinued) {
    renderToBeContinued();
    return;
  }

  if (state.pendingSpRouteId) {
    renderSpUnlock();
    return;
  }

  if (state.currentSpRouteId) {
    renderSpRoute();
    return;
  }

  if (shouldRenderDayOpening(content, state)) {
    renderDayOpening();
    return;
  }

  if (shouldRenderDayOutro(content, state)) {
    renderDayOutro();
    return;
  }

  activeDayOutroId = null;
  activeDayOpeningId = null;
  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = false;

  const day = getCurrentDay(content, state);
  const stage = getCurrentStage(content, state);
  const character = (stage.speaker ? content.characters[stage.speaker] : undefined) ?? content.characters.system;
  const selectedOptionId = getSelectedOptionId(stage);
  const isFinalStage = state.currentDayIndex === content.days.length - 1 && state.currentStageIndex === day.stages.length - 1;

  refs.routeLabel.textContent = stage.routeLabel;
  refs.stageTitle.textContent = stage.title;
  refs.sceneVisual.dataset.bg = stage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.nextButton.textContent = content.ui.nextButton;
  refs.nextButton.disabled = true;

  const activeDialogue = selectedOptionId && stage.responseDialogues?.[selectedOptionId]
    ? stage.responseDialogues[selectedOptionId]
    : stage.dialogue;
  renderDialog(replacePlaceholders(activeDialogue, state));

  if (selectedOptionId) {
    // 此關已作答（從存檔還原）：對話播放的同時立即顯示選項與反饋
    renderChoices(stage, selectedOptionId, null);
    if (stage.responseDialogues) {
      refs.feedbackBox.hidden = true;
    } else {
      renderFeedback(stage, selectedOptionId);
    }
    refs.nextButton.textContent = selectedOptionId && isFinalStage ? content.ui.finishButton : content.ui.nextButton;
    refs.nextButton.disabled = false;
  } else {
    // 未作答：等對話全部跑完再顯示選項
    refs.choiceList.replaceChildren();
    refs.feedbackBox.hidden = true;
    refs.toastStack.hidden = true;
    refs.toastStack.replaceChildren();

    onDialogComplete = () => {
      renderChoices(stage, null, null);
    };
  }

  animate(refs.characterPortrait, { transform: ["translateY(8px)", "translateY(0)"], opacity: [0.78, 1] }, { duration: 0.28 });
}

function renderPrologue(): void {
  const prologue = content.prologue!;
  const scene = prologue.scenes[0];
  const character = content.characters.system;

  prologuePhase = "pre-choice";
  prologuePendingChoiceId = null;

  refs.resultPanel.hidden = true;
  refs.nextButton.disabled = true;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.continueButton;
  refs.playerNameLabel.textContent = content.ui.defaultPlayerName;
  refs.routeLabel.textContent = prologue.routeLabel;
  refs.stageTitle.textContent = prologue.title;
  refs.sceneVisual.dataset.bg = prologue.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.totalScore.textContent = `0 / ${content.points.totalMax}`;
  refs.scoreProgress.setAttribute("aria-valuenow", "0");
  refs.scoreProgressFill.style.width = "0%";
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.choiceList.replaceChildren();

  onDialogComplete = () => renderPrologueChoices(scene);
  renderDialog(scene.dialogue);
}

function renderPrologueChoices(scene: PrologueScene): void {
  refs.choiceList.replaceChildren();
  scene.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice.text;
    button.dataset.choiceId = choice.id;
    button.addEventListener("click", () => handlePrologueChoice(choice.id));
    refs.choiceList.append(button);
  });
}

function handlePrologueChoice(choiceId: string): void {
  prologuePendingChoiceId = choiceId;
  refs.choiceList.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((btn) => {
    btn.classList.toggle("is-pending", btn.dataset.choiceId === choiceId);
  });
  refs.nextButton.disabled = false;
}

async function handlePrologueNext(): Promise<void> {
  const scene = content.prologue!.scenes[0];

  if (prologuePhase === "pre-choice" && prologuePendingChoiceId) {
    prologuePhase = "branch";
    refs.nextButton.disabled = true;
    refs.choiceList.replaceChildren();

    // 分支對話播完後等待使用者點擊，不自動推進
    onDialogComplete = () => {
      refs.nextButton.textContent = content.ui.continueButton;
      refs.nextButton.disabled = false;
    };
    renderDialog(scene.branchDialogue[prologuePendingChoiceId]);
    return;
  }

  // 分支對話已播完，使用者點擊「繼續」→ 開始共同結尾
  if (prologuePhase === "branch") {
    prologuePhase = "ending";
    refs.nextButton.disabled = true;
    onDialogComplete = () => {
      refs.nextButton.textContent = content.ui.enterGameButton;
      refs.nextButton.disabled = false;
    };
    renderDialog(scene.sharedEnding);
    return;
  }

  if (prologuePhase === "ending") {
    prologueCompleted = true;
    refs.nextButton.disabled = true;
    await showDayTransitionOverlay(1);
    render();
  }
}

function renderDayIntro(): void {
  const intro = getDayOneIntro();
  if (!intro) {
    renderBeforeStart();
    return;
  }

  const character = (intro.speaker ? content.characters[intro.speaker] : undefined) ?? content.characters.system;

  isNameEntryMode = dayIntroPhase === "name-entry";
  pendingOptionId = null;
  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.continueButton;
  refs.playerNameLabel.textContent = state?.playerName ?? content.ui.defaultPlayerName;
  refs.routeLabel.textContent = intro.routeLabel;
  refs.stageTitle.textContent = intro.title;
  refs.sceneVisual.dataset.bg = intro.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.totalScore.textContent = `0 / ${content.points.totalMax}`;
  refs.scoreProgress.setAttribute("aria-valuenow", "0");
  refs.scoreProgressFill.style.width = "0%";
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.toastStack.replaceChildren();

  if (dayIntroPhase === "before-name") {
    refs.nextButton.disabled = true;
    refs.choiceList.replaceChildren();
    onDialogComplete = () => {
      dayIntroPhase = "name-entry";
      renderDayIntro();
    };
    renderDialog(intro.beforeNameDialogue);
    return;
  }

  if (dayIntroPhase === "name-entry") {
    refs.nextButton.disabled = false;
    refs.nextButton.textContent = intro.namePrompt.submitButton;
    renderDayIntroNameInput(intro);
    return;
  }

  refs.nextButton.disabled = true;
  refs.choiceList.replaceChildren();
  onDialogComplete = () => {
    refs.nextButton.textContent = content.ui.nextButton;
    refs.nextButton.disabled = false;
  };
  renderDialog(replacePlaceholders(intro.afterNameDialogue, requireState()));
}

function renderDayIntroNameInput(intro: NameDayIntroContent): void {
  refs.choiceList.replaceChildren();
  const input = document.createElement("input");
  input.className = "text-input";
  input.id = "player-name-input";
  input.type = "text";
  input.maxLength = MAX_NICKNAME_LENGTH;
  input.setAttribute("autocomplete", "nickname");
  input.placeholder = intro.namePrompt.placeholder;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      refs.nextButton.click();
    }
  });

  const errorP = document.createElement("p");
  errorP.id = "name-error";
  errorP.className = "leaderboard-note";
  errorP.setAttribute("aria-live", "polite");
  refs.choiceList.append(input, errorP);
  input.focus();
}

function handleDayIntroNext(): void {
  if (dayIntroPhase === "name-entry") {
    const nameInput = document.getElementById("player-name-input") as HTMLInputElement | null;
    const nameError = document.getElementById("name-error") as HTMLElement | null;
    if (!nameInput) return;

    const result = sanitizeNickname(nameInput.value);
    if (!result.ok) {
      if (nameError) {
        const errorMap: Record<string, string> = {
          empty: content.ui.nameErrorEmpty,
          tooLong: fmt(content.ui.nameErrorTooLong, { maxLength: MAX_NICKNAME_LENGTH }),
          profane: content.ui.nameErrorProfane
        };
        nameError.textContent = result.errorCode ? (errorMap[result.errorCode] ?? "") : "";
      }
      return;
    }

    state = createInitialState(result.value);
    latestAnswer = null;
    isNameEntryMode = false;
    dayIntroPhase = "after-name";
    render();
    return;
  }

  if (dayIntroPhase === "after-name") {
    dayIntroCompleted = true;
    if (state) saveGameState(state);
    render();
  }
}

function renderDayOpening(): void {
  if (!state) {
    return;
  }

  const day = getCurrentDay(content, state);
  const intro = day.intro;
  if (!intro || !isStoryScene(intro)) {
    return;
  }

  renderStoryScene(intro, {
    routeLabel: intro.routeLabel,
    onComplete: () => {
      refs.nextButton.disabled = false;
    }
  });
  activeDayOpeningId = day.id;
}

function completeActiveDayOpening(): void {
  if (!state || !activeDayOpeningId) {
    return;
  }

  if (!state.completedIntros.includes(activeDayOpeningId)) {
    state.completedIntros.push(activeDayOpeningId);
  }

  activeDayOpeningId = null;
  saveGameState(state);
  render();
}

function renderDayOutro(): void {
  if (!state) {
    return;
  }

  const day = getCurrentDay(content, state);
  const outro = day.outro;
  if (!outro) {
    return;
  }

  const branch = resolveDayOutroBranch(day, state);
  const character = (outro.speaker ? content.characters[outro.speaker] : undefined) ?? content.characters.system;

  activeDayOutroId = day.id;
  isNameEntryMode = false;
  pendingOptionId = null;
  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.nextButton;
  refs.nextButton.disabled = true;
  refs.playerNameLabel.textContent = state.playerName;
  refs.routeLabel.textContent = outro.routeLabel;
  refs.stageTitle.textContent = outro.title;
  refs.sceneVisual.dataset.bg = outro.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.choiceList.replaceChildren();
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.toastStack.replaceChildren();
  renderScore();

  onDialogComplete = () => {
    refs.nextButton.disabled = false;
  };
  renderDialog(replacePlaceholders(branch.dialogue, state));
  animate(refs.characterPortrait, { transform: ["translateY(8px)", "translateY(0)"], opacity: [0.78, 1] }, { duration: 0.28 });
}

async function showDayTransitionOverlay(dayOrder: number): Promise<void> {
  const overlay = document.getElementById("day-transition-overlay");
  const windowEl = overlay?.querySelector<HTMLElement>(".day-transition-window");
  const label = document.getElementById("day-transition-label");
  if (!overlay || !windowEl || !label) return;

  label.textContent = fmt(content.ui.dayTransitionLabel, { dayOrder });
  overlay.hidden = false;

  // 黑幕淡入 + 像素視窗彈出（同步執行）
  await Promise.all([
    gsap.to(overlay, { opacity: 1, duration: 0.35, ease: "power2.inOut" }),
    gsap.to(windowEl, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.5)" }),
  ]);
  // 文字淡入
  await gsap.to(label, { opacity: 1, duration: 0.3, ease: "power2.out" });
  // 停留
  await new Promise<void>((res) => setTimeout(res, 1200));
  // 視窗縮小淡出
  await gsap.to(windowEl, { opacity: 0, scale: 0.85, duration: 0.3, ease: "power2.in" });
  // 黑幕淡出
  await gsap.to(overlay, { opacity: 0, duration: 0.4, ease: "power2.inOut" });

  overlay.hidden = true;
  gsap.set(overlay, { opacity: 0 });
  gsap.set(windowEl, { opacity: 0, scale: 0.7 });
  gsap.set(label, { opacity: 0 });
}

async function completeActiveDayOutro(): Promise<void> {
  if (!state || !activeDayOutroId) {
    return;
  }

  if (!state.completedOutros.includes(activeDayOutroId)) {
    state.completedOutros.push(activeDayOutroId);
  }

  const spRoute = getUnlockedSpRouteAfterDay(activeDayOutroId, state);
  if (spRoute && !state.completedSpRoutes.includes(spRoute.id)) {
    state.pendingSpRouteId = spRoute.id;
    activeDayOutroId = null;
    latestAnswer = null;
    saveGameState(state);
    render();
    return;
  }

  const isLastDay = state.currentDayIndex === content.days.length - 1;
  if (isLastDay) {
    // 最後一天完成 → 判定遊戲結束，不顯示待續
    state.completed = true;
    state.completedAt = state.completedAt ?? Date.now();
    activeDayOutroId = null;
    latestAnswer = null;
    saveGameState(state);
    render();
    return;
  }

  // 非最後一天：先播放天數切換動畫，再推進遊戲
  const nextDayOrder = content.days[state.currentDayIndex + 1].order;
  activeDayOutroId = null;
  latestAnswer = null;
  refs.nextButton.disabled = true;
  await showDayTransitionOverlay(nextDayOrder);
  advanceStage(content, state);
  saveGameState(state);
  render();
}

function shouldRenderDayOutro(gameContent: GameContent, targetState: GameState): boolean {
  const day = getCurrentDay(gameContent, targetState);
  const stage = getCurrentStage(gameContent, targetState);
  const isLastStageOfDay = targetState.currentStageIndex === day.stages.length - 1;

  return Boolean(
    day.outro &&
    isLastStageOfDay &&
    targetState.selectedAnswers[stage.id] &&
    !targetState.completedOutros.includes(day.id)
  );
}

function shouldRenderDayOpening(gameContent: GameContent, targetState: GameState): boolean {
  const day = getCurrentDay(gameContent, targetState);
  return Boolean(
    day.intro &&
    isStoryScene(day.intro) &&
    !targetState.completedIntros.includes(day.id)
  );
}

function resolveDayOutroBranch(day: DayContent, targetState: GameState): DayOutroBranchContent {
  const outro = day.outro;
  if (!outro) {
    throw new Error(`${day.id} 缺少日結資料。`);
  }

  const matched = outro.branches.find((branch) => hasDayOutroCondition(branch) && evaluateCondition(branch.condition, targetState));
  const fallback = outro.branches.find((branch) => branch.default) ?? outro.branches[0];
  if (!matched && !fallback) {
    throw new Error(`${outro.id} 缺少可播放的日結分支。`);
  }

  return matched ?? fallback;
}

function hasDayOutroCondition(
  branch: DayOutroBranchContent
): branch is DayOutroBranchContent & { condition: BranchCondition } {
  return "condition" in branch;
}

function renderSpUnlock(): void {
  if (!state?.pendingSpRouteId) {
    return;
  }

  const route = getSpRoute(state.pendingSpRouteId);
  if (route.unlockScene) {
    renderStoryScene(route.unlockScene, {
      routeLabel: route.unlockScene.routeLabel,
      sceneEffect: "is-hidden-unlock",
      onComplete: () => {
        refs.nextButton.disabled = false;
      }
    });
  } else {
    // 無解鎖場景 → 直接進入
    startPendingSpRoute();
  }
}

function startPendingSpRoute(): void {
  if (!state?.pendingSpRouteId) {
    return;
  }

  state.currentSpRouteId = state.pendingSpRouteId;
  state.pendingSpRouteId = null;
  state.currentSpStageIndex = 0;
  saveGameState(state);
  render();
}

function renderSpRoute(): void {
  if (!state?.currentSpRouteId) {
    return;
  }

  const route = getSpRoute(state.currentSpRouteId);
  refs.routeLabel.textContent = route.displayName;

  if (route.intro && !state.completedSpRouteIntros.includes(route.id)) {
    renderStoryScene(route.intro, {
      routeLabel: route.intro.routeLabel,
      onComplete: () => {
        refs.nextButton.disabled = false;
      }
    });
    return;
  }

  if (state.currentSpStageIndex >= route.stages.length) {
    if (route.outro) {
      renderStoryScene(route.outro, {
        routeLabel: route.outro.routeLabel,
        onComplete: () => {
          refs.nextButton.textContent = content.ui.continueButton;
          refs.nextButton.disabled = false;
        }
      });
    } else {
      handleSpRouteComplete();
    }
    return;
  }

  renderSpStage(route);
}

function renderSpStage(route: SpRouteContent): void {
  if (!state) {
    return;
  }

  const stage = route.stages[state.currentSpStageIndex];
  const character = (stage.speaker ? content.characters[stage.speaker] : undefined) ?? content.characters.system;
  const selectedOptionId = getSelectedOptionId(stage);

  activeDayOutroId = null;
  activeDayOpeningId = null;
  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.nextButton;
  refs.nextButton.disabled = true;
  refs.playerNameLabel.textContent = state.playerName;
  refs.routeLabel.textContent = stage.routeLabel;
  refs.stageTitle.textContent = stage.title;
  refs.sceneVisual.classList.remove("is-hidden-unlock");
  refs.sceneVisual.dataset.bg = stage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;

  const activeDialogue = selectedOptionId && stage.responseDialogues?.[selectedOptionId]
    ? stage.responseDialogues[selectedOptionId]
    : stage.dialogue;
  renderDialog(replacePlaceholders(activeDialogue, state));

  if (selectedOptionId) {
    renderChoices(stage, selectedOptionId, null);
    refs.feedbackBox.hidden = true;
    refs.nextButton.disabled = false;
  } else {
    refs.choiceList.replaceChildren();
    refs.feedbackBox.hidden = true;
    refs.toastStack.hidden = true;
    refs.toastStack.replaceChildren();
    onDialogComplete = () => {
      renderChoices(stage, null, null);
    };
  }

  animate(refs.characterPortrait, { transform: ["translateY(8px)", "translateY(0)"], opacity: [0.78, 1] }, { duration: 0.28 });
}

function handleSpRouteNext(): void {
  if (!state?.currentSpRouteId) {
    return;
  }

  const route = getSpRoute(state.currentSpRouteId);

  if (route.intro && !state.completedSpRouteIntros.includes(route.id)) {
    state.completedSpRouteIntros.push(route.id);
    saveGameState(state);
    render();
    return;
  }

  if (state.currentSpStageIndex >= route.stages.length) {
    handleSpRouteComplete();
    return;
  }

  const stage = route.stages[state.currentSpStageIndex];
  const scoredOptionId = getSelectedOptionId(stage);

  if (pendingOptionId && !scoredOptionId) {
    answerSpStage(content, state, route.id, stage.id, pendingOptionId, stage.correctOptionId);
    saveGameState(state);
    const confirmedId = pendingOptionId;
    pendingOptionId = null;
    renderChoices(stage, confirmedId, null);
    refs.feedbackBox.hidden = true;
    refs.nextButton.disabled = true;
    renderStageResponse(stage, confirmedId, () => {
      refs.nextButton.disabled = false;
    });
    return;
  }

  if (!scoredOptionId) return;
  state.currentSpStageIndex += 1;
  saveGameState(state);
  render();
}

function handleSpRouteComplete(): void {
  if (!state?.currentSpRouteId) return;
  if (!state.completedSpRoutes.includes(state.currentSpRouteId)) {
    state.completedSpRoutes.push(state.currentSpRouteId);
  }
  state.currentSpRouteId = null;
  state.currentSpStageIndex = 0;
  // SP 路線結束後繼續推進到下一天
  advanceStage(content, state);
  saveGameState(state);
  render();
}

function renderToBeContinued(): void {
  if (!state) {
    return;
  }

  const scene = content.toBeContinued ?? {
    id: "to-be-continued",
    routeLabel: "to-be-continued",
    title: "後續待開放",
    background: "club",
    speaker: "system",
    dialogue: "系統提示：後續劇情將在下一階段開放。"
  };

  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = true;
  renderStoryScene(scene, {
    routeLabel: scene.routeLabel,
    hideNextButton: true,
    onComplete: () => {}
  });
}

function renderStoryScene(
  scene: StorySceneContent,
  options: { routeLabel: string; hideNextButton?: boolean; sceneEffect?: string; onComplete: () => void }
): void {
  const character = (scene.speaker ? content.characters[scene.speaker] : undefined) ?? content.characters.system;

  isNameEntryMode = false;
  pendingOptionId = null;
  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = Boolean(options.hideNextButton);
  refs.nextButton.textContent = content.ui.continueButton;
  refs.nextButton.disabled = true;
  refs.playerNameLabel.textContent = state?.playerName ?? content.ui.defaultPlayerName;
  refs.routeLabel.textContent = options.routeLabel;
  refs.stageTitle.textContent = scene.title;
  refs.sceneVisual.classList.remove("is-hidden-unlock");
  if (options.sceneEffect) {
    refs.sceneVisual.classList.add(options.sceneEffect);
  }
  refs.sceneVisual.dataset.bg = scene.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.choiceList.replaceChildren();
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.toastStack.replaceChildren();
  if (state) renderScore();

  onDialogComplete = options.onComplete;
  renderDialog(replacePlaceholders(scene.dialogue, requireState()));
  animate(refs.characterPortrait, { transform: ["translateY(8px)", "translateY(0)"], opacity: [0.72, 1] }, { duration: 0.3 });
}

function getUnlockedSpRouteAfterDay(dayId: DayId, targetState: GameState): SpRouteContent | undefined {
  return content.spRoutes?.find((route) =>
    route.unlockAfterDay === dayId &&
    !targetState.completedSpRoutes.includes(route.id) &&
    evaluateCondition(route.unlockCondition, targetState)
  );
}

function getSpRoute(spId: SpRouteId): SpRouteContent {
  const route = content.spRoutes?.find((item) => item.id === spId);
  if (!route) {
    throw new Error(`缺少 SP 路線資料：${spId}`);
  }
  return route;
}

function isStoryScene(intro: DayIntroContent): intro is StorySceneContent {
  return "dialogue" in intro;
}

function isNameDayIntro(intro: DayIntroContent): intro is NameDayIntroContent {
  return "beforeNameDialogue" in intro;
}

function renderBeforeStart(): void {
  const character = content.characters.system;
  isNameEntryMode = true;

  refs.resultPanel.hidden = true;
  refs.nextButton.disabled = false;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.startButton;
  refs.playerNameLabel.textContent = content.ui.defaultPlayerName;
  refs.routeLabel.textContent = fmt(content.ui.dayLabelFormat, { dayOrder: 1 });
  refs.stageTitle.textContent = content.ui.namePromptTitle;
  refs.sceneVisual.dataset.bg = "club";
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.totalScore.textContent = `0 / ${content.points.totalMax}`;
  refs.scoreProgress.setAttribute("aria-valuenow", "0");
  refs.scoreProgressFill.style.width = "0%";
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;

  // 動態注入名稱輸入框到 choice-list
  refs.choiceList.replaceChildren();
  const input = document.createElement("input");
  input.className = "text-input";
  input.id = "player-name-input";
  input.type = "text";
  input.maxLength = MAX_NICKNAME_LENGTH;
  input.setAttribute("autocomplete", "nickname");
  input.placeholder = content.ui.namePlaceholder;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      refs.nextButton.click();
    }
  });
  const errorP = document.createElement("p");
  errorP.id = "name-error";
  errorP.className = "leaderboard-note";
  errorP.setAttribute("aria-live", "polite");
  refs.choiceList.append(input, errorP);

  renderDialog(content.ui.namePromptBody);
}

function renderChoices(stage: StageContent, scoredOptionId: string | null, currentPendingId: string | null): void {
  refs.choiceList.replaceChildren();

  stage.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = option.text;
    button.dataset.optionId = option.id;

    if (scoredOptionId) {
      // 已計分：全部禁用，顯示正誤結果
      button.disabled = true;
      if (option.id === stage.correctOptionId) {
        button.classList.add("is-correct");
      } else if (option.id === scoredOptionId) {
        button.classList.add("is-wrong");
      }
    } else {
      // 未計分：可點選，高亮待確認的選項
      if (currentPendingId && option.id === currentPendingId) {
        button.classList.add("is-pending");
      }
      button.addEventListener("click", () => handleChoiceSelect(stage, option.id));
    }

    refs.choiceList.append(button);
  });
}

function handleChoiceSelect(stage: StageContent, optionId: string): void {
  if (!state || getSelectedOptionId(stage)) return;

  pendingOptionId = optionId;
  renderChoices(stage, null, pendingOptionId);
  refs.nextButton.disabled = false;
}

function renderFeedback(stage: StageContent, selectedOptionId: string): void {
  if (!state) {
    return;
  }

  const isCorrect = selectedOptionId === stage.correctOptionId;
  const points = isCorrect ? content.points.correct : content.points.wrong;
  refs.feedbackTitle.textContent = `${isCorrect ? content.ui.correctLabel : content.ui.wrongLabel}｜+${points}`;
  refs.feedbackText.textContent = isCorrect ? stage.feedback.correct : stage.feedback.wrong;
  refs.feedbackBox.hidden = false;
}

function renderStageResponse(stage: StageContent, selectedOptionId: string, onComplete: () => void): void {
  if (!state) {
    onComplete();
    return;
  }

  const responseDialogue = stage.responseDialogues?.[selectedOptionId];
  if (!responseDialogue) {
    onComplete();
    return;
  }

  // 回應對話開始，下次點擊對話框後隱藏 side-panel
  hideSidePanelOnNextDialogClick = true;
  onDialogComplete = onComplete;
  renderDialog(replacePlaceholders(responseDialogue, state));
}

function renderToasts(messages: string[]): void {
  refs.toastStack.replaceChildren();

  if (messages.length === 0) {
    refs.toastStack.hidden = true;
    return;
  }

  refs.toastStack.hidden = false;
  messages.forEach((message) => {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = message;
    refs.toastStack.append(toast);
  });
}

function renderScore(): void {
  if (!state) {
    return;
  }

  const percentage = Math.min(100, (state.totalScore / content.points.totalMax) * 100);
  refs.progressLabel.textContent = content.ui.scoreLabel;
  refs.totalScore.textContent = `${state.totalScore} / ${content.points.totalMax}`;
  refs.scoreProgress.setAttribute("aria-valuenow", String(state.totalScore));
  refs.scoreProgressFill.style.width = `${percentage}%`;

  const icons = refs.scoreProgress.querySelectorAll<SVGElement>(".progress-icon");
  icons.forEach((icon, index) => {
    const threshold = ((index + 1) / icons.length) * 100;
    const isHeart = percentage >= threshold;
    icon.dataset.state = isHeart ? "heart" : "leaf";
    icon.classList.toggle("is-heart", isHeart);
    icon.classList.toggle("is-leaf", !isHeart);
  });
}

function renderCompleted(): void {
  if (!state) {
    return;
  }

  const ending = getCurrentEnding();

  if (!state.completedEnding) {
    renderEndingScene(ending);
    return;
  }

  if (content.epilogue && !state.completedEpilogue) {
    renderEpilogueScene();
    return;
  }

  renderResultReport(ending);
}

function handleCompletedNext(): void {
  if (!state) return;

  if (!state.completedEnding) {
    state.completedEnding = true;
    saveGameState(state);
    render();
    return;
  }

  if (content.epilogue && !state.completedEpilogue) {
    state.completedEpilogue = true;
    saveGameState(state);
    render();
  }
}

function renderEndingScene(ending: EndingResultContent): void {
  const scene: StorySceneContent = {
    id: ending.routeLabel,
    routeLabel: ending.routeLabel,
    title: ending.title,
    background: "club",
    speaker: "system",
    dialogue: ending.dialogue,
  };

  renderStoryScene(scene, {
    routeLabel: ending.routeLabel,
    onComplete: () => {
      refs.nextButton.textContent = content.epilogue ? "閱讀結語" : "查看成績單";
      refs.nextButton.disabled = false;
    }
  });
}

function renderEpilogueScene(): void {
  if (!content.epilogue) return;

  const scene: StorySceneContent = {
    id: content.epilogue.routeLabel,
    routeLabel: content.epilogue.routeLabel,
    title: content.epilogue.title,
    background: "club",
    speaker: "system",
    dialogue: content.epilogue.dialogue,
  };

  renderStoryScene(scene, {
    routeLabel: content.epilogue.routeLabel,
    onComplete: () => {
      refs.nextButton.textContent = "查看成績單";
      refs.nextButton.disabled = false;
    }
  });
}

function renderResultReport(ending: EndingResultContent): void {
  if (!state) {
    return;
  }

  const lastDay = content.days[content.days.length - 1];
  const lastStage = lastDay.stages[lastDay.stages.length - 1];
  const character = content.characters.system;
  const spTotal = Object.values(state.spScores).reduce((s, v) => s + v, 0);
  const completedAt = state.completedAt ?? Date.now();

  refs.resultPanel.hidden = false;
  refs.sidePanel.hidden = false;
  refs.nextButton.hidden = true;
  refs.routeLabel.textContent = ending.routeLabel;
  refs.stageTitle.textContent = ending.title;
  refs.sceneVisual.dataset.bg = lastStage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.dialogBox.hidden = true;
  refs.dialogText.textContent = "";
  refs.dialogContinue.hidden = true;
  refs.choiceList.replaceChildren();
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.resultSummary.textContent = "永續回收命運機已完成本次紀錄封存。";
  refs.resultPlayerName.textContent = state.playerName;
  refs.resultElapsedTime.textContent = formatElapsedTime(Math.max(0, completedAt - state.startedAt));
  refs.resultEndingName.textContent = ending.title;
  refs.resultTotal.textContent = `${state.totalScore} / ${content.points.totalMax}`;
  refs.resultSp.textContent = `${spTotal} / ${content.points.spMax}`;
  renderGroupStats();
  refs.submitScoreButton.textContent = content.ui.submitScoreButton;
  refs.submitScoreButton.disabled = true;
  refs.leaderboardStatus.textContent = "排行榜功能已保留，尚未開放送出。";
  refs.leaderboardList.replaceChildren();
}

function getCurrentEnding(): EndingResultContent {
  const endingId = state ? evaluateEnding(content, state) : "bad";
  return content.ending.results[endingId] ?? Object.values(content.ending.results)[0];
}

function renderGroupStats(): void {
  if (!state) return;

  refs.resultGroupStats.replaceChildren();
  const rows = content.days.map((day) => ({
    label: day.title,
    value: state!.dayScores[day.id],
    max: content.points.dayMax,
  }));
  rows.push(
    { label: "SP1", value: state.spScores.sp1, max: content.points.spMax / 2 },
    { label: "SP2", value: state.spScores.sp2, max: content.points.spMax / 2 },
  );

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "group-stat-row";
    const name = document.createElement("span");
    name.className = "group-stat-name";
    name.textContent = row.label;
    const bar = document.createElement("span");
    bar.className = "group-stat-bar";
    const fill = document.createElement("span");
    fill.className = "group-stat-fill";
    fill.style.width = `${Math.min(100, (row.value / row.max) * 100)}%`;
    const value = document.createElement("span");
    value.className = "group-stat-value";
    value.textContent = `${row.value} / ${row.max}`;
    bar.append(fill);
    item.append(name, bar, value);
    refs.resultGroupStats.append(item);
  });
}

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 「。」後插入換行（排除緊接 \n 或段末）
function preprocessText(text: string): string {
  return text.replace(/。(?!\n|$)/g, "。\n");
}

// 解析段落：判斷是旁白還是角色對話
function parseSegment(raw: string): { character: (typeof content.characters)[string]; text: string } {
  for (const char of Object.values(content.characters)) {
    const prefix = `${char.displayName}：`;
    if (raw.startsWith(prefix)) {
      return { character: char, text: raw.slice(prefix.length) };
    }
  }
  return { character: content.characters.system, text: raw };
}

function playNextSegment(): void {
  if (pendingSegments.length === 0) {
    // 所有段落播完：觸發對話完成回調
    const cb = onDialogComplete;
    onDialogComplete = null;
    cb?.();
    return;
  }

  const rawSeg = pendingSegments.shift()!;
  const { character, text } = parseSegment(rawSeg);
  const hasMore = pendingSegments.length > 0;

  // 每段更新說話者與立繪
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = fmt(content.ui.portraitAltFormat, { displayName: character.displayName });
  animate(refs.characterPortrait, { transform: ["translateY(6px)", "translateY(0)"], opacity: [0.8, 1] }, { duration: 0.22 });

  currentSegmentText = preprocessText(text);
  refs.dialogText.classList.remove("is-finished");
  refs.dialogContinue.hidden = true;
  if (currentTween) currentTween.kill();
  refs.dialogText.textContent = "";

  const cursor = { index: 0 };
  currentTween = gsap.to(cursor, {
    index: currentSegmentText.length,
    duration: Math.min(1.4, Math.max(0.35, currentSegmentText.length * 0.025)),
    ease: "none",
    onUpdate: () => {
      refs.dialogText.textContent = currentSegmentText.slice(0, Math.round(cursor.index));
      refs.dialogText.scrollTop = refs.dialogText.scrollHeight;
    },
    onComplete: () => {
      currentTween = null;
      refs.dialogText.classList.add("is-finished");
      if (hasMore) {
        isDialogPaused = true;
        refs.dialogContinue.hidden = false;
        requestAnimationFrame(() => { refs.dialogText.scrollTop = refs.dialogText.scrollHeight; });
      } else {
        // 最後一段打完：觸發對話完成回調
        const cb = onDialogComplete;
        onDialogComplete = null;
        cb?.();
      }
    }
  });
}

function renderDialog(rawText: string): void {
  refs.dialogBox.hidden = false;
  pendingSegments = rawText
    .split("</br>")
    .map((s) => s.trim())
    .filter(Boolean);
  isDialogPaused = false;
  refs.dialogContinue.hidden = true;
  playNextSegment();
}

function getSelectedOptionId(stage: StageContent): string | null {
  if (!state) {
    return null;
  }

  return state.selectedAnswers[stage.id] ?? null;
}

function getDayOneIntro(): NameDayIntroContent | undefined {
  const intro = content.days.find((day) => day.id === "day1")?.intro;
  return intro && isNameDayIntro(intro) ? intro : undefined;
}


function requireState(): GameState {
  if (!state) {
    throw new Error("D1-0 名稱輸入完成前缺少遊戲狀態。");
  }

  return state;
}

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

function readContent(): GameContent {
  const node = document.getElementById("game-content");

  if (!node?.textContent) {
    throw new Error("缺少遊戲內容資料。");
  }

  return JSON.parse(node.textContent) as GameContent;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`找不到畫面元素：${id}`);
  }

  return element as T;
}
