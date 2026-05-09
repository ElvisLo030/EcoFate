import { animate } from "@motionone/dom";
import gsap from "gsap";
import { advanceStage, answerStage, getCurrentDay, getCurrentStage, replacePlaceholders } from "@/lib/game/engine";
import { clearGameState, loadGameState, resetGameState, saveGameState } from "@/lib/game/storage";
import type { AnswerResult, GameContent, PrologueScene, StageContent } from "@/lib/game/types";
import { createLeaderboardService } from "@/lib/leaderboard/firebase";
import { sanitizeNickname } from "@/lib/security/profanity";

const content = readContent();
const leaderboard = createLeaderboardService();

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
  choiceList: getElement<HTMLElement>("choice-list"),
  feedbackBox: getElement<HTMLElement>("feedback-box"),
  feedbackTitle: getElement<HTMLElement>("feedback-title"),
  feedbackText: getElement<HTMLElement>("feedback-text"),
  toastStack: getElement<HTMLElement>("toast-stack"),
  settingsButton: getElement<HTMLButtonElement>("settings-button"),
  nextButton: getElement<HTMLButtonElement>("next-stage-button"),
  resultPanel: getElement<HTMLElement>("result-panel"),
  resultSummary: getElement<HTMLElement>("result-summary"),
  resultDay1: getElement<HTMLElement>("result-day1"),
  resultDay2: getElement<HTMLElement>("result-day2"),
  resultDay3: getElement<HTMLElement>("result-day3"),
  leaderboardForm: getElement<HTMLFormElement>("leaderboard-form"),
  submitScoreButton: getElement<HTMLButtonElement>("submit-score-button"),
  leaderboardStatus: getElement<HTMLElement>("leaderboard-status"),
  leaderboardList: getElement<HTMLOListElement>("leaderboard-list")
};

let state = loadGameState();
let latestAnswer: AnswerResult | null = null;
let isSubmittingScore = false;

// 對話分段狀態
let pendingSegments: string[] = [];
let currentSegmentText = "";
let currentTween: gsap.core.Tween | null = null;
let isDialogPaused = false;
let isNameEntryMode = false;

// 選項選擇狀態（待確認 vs 已計分）
let pendingOptionId: string | null = null;
let onDialogComplete: (() => void) | null = null;

// 序章狀態
type ProloguePhase = "pre-choice" | "branch" | "ending";
let prologueCompleted = false;
let prologuePhase: ProloguePhase = "pre-choice";
let prologuePendingChoiceId: string | null = null;

// 設定面板控制
const settingsPanel = document.getElementById("settings-panel") as HTMLDivElement | null;
const settingsClose = document.getElementById("settings-close") as HTMLButtonElement | null;
const settingsRestart = document.getElementById("settings-restart") as HTMLButtonElement | null;
const settingsHelp = document.getElementById("settings-help") as HTMLButtonElement | null;

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
  render();
});

settingsHelp?.addEventListener("click", () => {
  if (settingsPanel) settingsPanel.hidden = true;
  const overlay = document.getElementById("welcome-overlay");
  if (overlay) overlay.hidden = false;
});

refs.nextButton.addEventListener("click", () => {
  // 序章流程
  if (!prologueCompleted && content.prologue) {
    handlePrologueNext();
    return;
  }

  // 名稱輸入模式：提交名稱
  if (isNameEntryMode) {
    const nameInput = document.getElementById("player-name-input") as HTMLInputElement | null;
    const nameError = document.getElementById("name-error") as HTMLElement | null;
    if (!nameInput) return;
    const result = sanitizeNickname(nameInput.value);
    if (!result.ok) {
      if (nameError) nameError.textContent = result.error ?? "";
      return;
    }
    state = resetGameState(result.value);
    latestAnswer = null;
    isNameEntryMode = false;
    render();
    return;
  }

  if (!state) return;

  const stage = getCurrentStage(content, state);
  const scoredOptionId = getSelectedOptionId(stage);

  // 有待確認的選項（已選但未計分）：確認選擇並計分
  if (pendingOptionId && !scoredOptionId) {
    latestAnswer = answerStage(content, state, pendingOptionId);
    saveGameState(state);
    const confirmedId = pendingOptionId;
    pendingOptionId = null;
    renderChoices(stage, confirmedId, null);
    renderFeedback(stage, confirmedId);
    renderScore();
    refs.nextButton.textContent = latestAnswer.gameCompleted ? content.ui.finishButton : content.ui.nextButton;
    renderToasts(stage, latestAnswer.unlockedMessages);
    return;
  }

  // 已計分：前往下一關
  if (!scoredOptionId) return;
  advanceStage(content, state);
  saveGameState(state);
  latestAnswer = null;
  render();
});

// 點擊對話框：跳過打字機或推進分段
refs.dialogBox.addEventListener("click", () => {
  if (currentTween?.isActive()) {
    // 打字機播放中：立即跳至段落末尾
    currentTween.kill();
    currentTween = null;
    refs.dialogText.textContent = currentSegmentText;
    refs.dialogText.classList.add("is-finished");
    if (pendingSegments.length > 0) {
      isDialogPaused = true;
      refs.dialogContinue.hidden = false;
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

  if (!state || !state.completed || isSubmittingScore) {
    return;
  }

  isSubmittingScore = true;
  refs.submitScoreButton.disabled = true;
  refs.leaderboardStatus.textContent = "送出中...";

  try {
    await leaderboard.submitScore({
      playerName: state.playerName,
      score: state.totalScore
    });
    refs.leaderboardStatus.textContent = "排行榜已送出。";
    await renderLeaderboard();
  } catch (error) {
    refs.leaderboardStatus.textContent = error instanceof Error ? error.message : "排行榜送出失敗。";
  } finally {
    isSubmittingScore = false;
    refs.submitScoreButton.disabled = !leaderboard.enabled;
  }
});

render();

function render(): void {
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

  refs.resultPanel.hidden = true;
  refs.nextButton.hidden = false;

  const day = getCurrentDay(content, state);
  const stage = getCurrentStage(content, state);
  const character = (stage.speaker ? content.characters[stage.speaker] : undefined) ?? content.characters.system;
  const selectedOptionId = getSelectedOptionId(stage);
  const isFinalStage = state.currentDayIndex === content.days.length - 1 && state.currentStageIndex === day.stages.length - 1;

  refs.routeLabel.textContent = `Day ${day.order}`;
  refs.stageTitle.textContent = `${stage.id} ${stage.title}`;
  refs.sceneVisual.dataset.bg = stage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.nextButton.textContent = content.ui.nextButton;
  refs.nextButton.disabled = true;

  renderDialog(replacePlaceholders(stage.dialogue, state));

  if (selectedOptionId) {
    // 此關已作答（從存檔還原）：對話播放的同時立即顯示選項與反饋
    renderChoices(stage, selectedOptionId, null);
    renderFeedback(stage, selectedOptionId);
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
  refs.nextButton.textContent = "繼續";
  refs.playerNameLabel.textContent = "未命名";
  refs.routeLabel.textContent = "序章";
  refs.stageTitle.textContent = prologue.title;
  refs.sceneVisual.dataset.bg = prologue.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
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

function handlePrologueNext(): void {
  const scene = content.prologue!.scenes[0];

  if (prologuePhase === "pre-choice" && prologuePendingChoiceId) {
    prologuePhase = "branch";
    refs.nextButton.disabled = true;
    refs.choiceList.replaceChildren();

    // 分支對話播完後等待使用者點擊，不自動推進
    onDialogComplete = () => {
      refs.nextButton.textContent = "繼續";
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
      refs.nextButton.textContent = "進入遊戲";
      refs.nextButton.disabled = false;
    };
    renderDialog(scene.sharedEnding);
    return;
  }

  if (prologuePhase === "ending") {
    prologueCompleted = true;
    renderBeforeStart();
  }
}

function renderBeforeStart(): void {
  const character = content.characters.system;
  isNameEntryMode = true;

  refs.resultPanel.hidden = true;
  refs.nextButton.disabled = false;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent = content.ui.startButton;
  refs.playerNameLabel.textContent = "未命名";
  refs.routeLabel.textContent = "Day 1";
  refs.stageTitle.textContent = content.ui.namePromptTitle;
  refs.sceneVisual.dataset.bg = "club";
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
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
  input.maxLength = 16;
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

function renderToasts(stage: StageContent, unlockedMessages: string[]): void {
  refs.toastStack.replaceChildren();
  const messages = [...unlockedMessages.map((message) => `系統：「${message}」`)];

  if (stage.foreshadow) {
    messages.unshift(stage.foreshadow.text);
  }

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

  const lastDay = content.days[content.days.length - 1];
  const lastStage = lastDay.stages[lastDay.stages.length - 1];
  const character = content.characters.system;

  refs.resultPanel.hidden = false;
  refs.nextButton.hidden = true;
  refs.routeLabel.textContent = "完成";
  refs.stageTitle.textContent = content.ending.title;
  refs.sceneVisual.dataset.bg = lastStage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  renderDialog(`研究完成，${state.playerName}。你的總環保積分是 ${state.totalScore} 分。`);
  refs.choiceList.replaceChildren();
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
  refs.resultSummary.textContent = replacePlaceholders(content.ending.summary, state);
  refs.resultDay1.textContent = `${state.dayScores.day1} / ${content.points.dayMax}`;
  refs.resultDay2.textContent = `${state.dayScores.day2} / ${content.points.dayMax}`;
  refs.resultDay3.textContent = `${state.dayScores.day3} / ${content.points.dayMax}`;
  refs.submitScoreButton.textContent = content.ui.submitScoreButton;
  refs.submitScoreButton.disabled = !leaderboard.enabled;
  refs.leaderboardStatus.textContent = leaderboard.enabled ? "" : content.ui.leaderboardUnavailable;
  void renderLeaderboard();
}

async function renderLeaderboard(): Promise<void> {
  refs.leaderboardList.replaceChildren();

  if (!leaderboard.enabled) {
    return;
  }

  const entries = await leaderboard.fetchTopScores();
  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("strong");
    const score = document.createElement("span");

    rank.textContent = `#${index + 1}`;
    name.textContent = entry.playerName;
    score.textContent = `${entry.score}`;

    item.append(rank, name, score);
    refs.leaderboardList.append(item);
  });
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
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
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
    },
    onComplete: () => {
      currentTween = null;
      refs.dialogText.classList.add("is-finished");
      if (hasMore) {
        isDialogPaused = true;
        refs.dialogContinue.hidden = false;
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
