import { animate } from "@motionone/dom";
import gsap from "gsap";
import { advanceStage, answerStage, getCurrentDay, getCurrentStage, replacePlaceholders } from "@/lib/game/engine";
import { loadGameState, resetGameState, saveGameState } from "@/lib/game/storage";
import type { AnswerResult, GameContent, StageContent } from "@/lib/game/types";
import { createLeaderboardService } from "@/lib/leaderboard/firebase";
import { sanitizeNickname } from "@/lib/security/profanity";

const content = readContent();
const leaderboard = createLeaderboardService();

const refs = {
  nameEntry: getElement<HTMLElement>("name-entry"),
  nameForm: getElement<HTMLFormElement>("name-form"),
  nameInput: getElement<HTMLInputElement>("player-name-input"),
  nameError: getElement<HTMLElement>("name-error"),
  playerNameLabel: getElement<HTMLElement>("player-name-label"),
  routeLabel: getElement<HTMLElement>("route-label"),
  progressLabel: getElement<HTMLElement>("progress-label"),
  totalScore: getElement<HTMLElement>("total-score"),
  scoreProgress: getElement<HTMLElement>("score-progress"),
  scoreProgressFill: getElement<HTMLElement>("score-progress-fill"),
  dayTheme: getElement<HTMLElement>("day-theme"),
  stageTitle: getElement<HTMLElement>("stage-title"),
  dayScoreLabel: getElement<HTMLElement>("day-score-label"),
  dayScore: getElement<HTMLElement>("day-score"),
  sceneVisual: getElement<HTMLElement>("scene-visual"),
  characterPortrait: getElement<HTMLImageElement>("character-portrait"),
  speakerName: getElement<HTMLElement>("speaker-name"),
  dialogText: getElement<HTMLElement>("dialog-text"),
  situationText: getElement<HTMLElement>("situation-text"),
  choiceList: getElement<HTMLElement>("choice-list"),
  feedbackBox: getElement<HTMLElement>("feedback-box"),
  feedbackTitle: getElement<HTMLElement>("feedback-title"),
  feedbackText: getElement<HTMLElement>("feedback-text"),
  toastStack: getElement<HTMLElement>("toast-stack"),
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

refs.nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = sanitizeNickname(refs.nameInput.value);

  if (!result.ok) {
    refs.nameError.textContent = result.error ?? "";
    return;
  }

  state = resetGameState(result.value);
  latestAnswer = null;
  refs.nameError.textContent = "";
  render();
});

refs.nextButton.addEventListener("click", () => {
  if (!state || !getSelectedOptionId(getCurrentStage(content, state))) {
    return;
  }

  advanceStage(content, state);
  saveGameState(state);
  latestAnswer = null;
  render();
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
    renderBeforeStart();
    return;
  }

  refs.nameEntry.hidden = true;
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
  const character = content.characters[stage.speaker];
  const selectedOptionId = getSelectedOptionId(stage);
  const isFinalStage = state.currentDayIndex === content.days.length - 1 && state.currentStageIndex === day.stages.length - 1;

  refs.routeLabel.textContent = `Day ${day.order}`;
  refs.dayTheme.textContent = `${day.title}｜${day.theme}`;
  refs.stageTitle.textContent = `${stage.id} ${stage.title}`;
  refs.dayScoreLabel.textContent = content.ui.dayScoreLabel;
  refs.dayScore.textContent = `${state.dayScores[day.id]} / ${content.points.dayMax}`;
  refs.sceneVisual.dataset.bg = stage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  refs.situationText.textContent = replacePlaceholders(stage.situation, state);
  refs.nextButton.textContent = selectedOptionId && isFinalStage ? content.ui.finishButton : content.ui.nextButton;
  refs.nextButton.disabled = !selectedOptionId;

  renderDialog(replacePlaceholders(stage.dialogue, state));
  renderChoices(stage, selectedOptionId);

  if (selectedOptionId) {
    renderFeedback(stage, selectedOptionId);
  } else {
    refs.feedbackBox.hidden = true;
    refs.toastStack.hidden = true;
    refs.toastStack.replaceChildren();
  }

  animate(refs.characterPortrait, { transform: ["translateY(8px)", "translateY(0)"], opacity: [0.78, 1] }, { duration: 0.28 });
}

function renderBeforeStart(): void {
  const character = content.characters.system;

  refs.nameEntry.hidden = false;
  refs.resultPanel.hidden = true;
  refs.nextButton.disabled = true;
  refs.nextButton.hidden = false;
  refs.playerNameLabel.textContent = "未命名";
  refs.routeLabel.textContent = "Day 1";
  refs.dayTheme.textContent = "Day 1｜加入永續生活研究社";
  refs.stageTitle.textContent = content.ui.namePromptTitle;
  refs.dayScore.textContent = `0 / ${content.points.dayMax}`;
  refs.sceneVisual.dataset.bg = "club";
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  renderDialog(content.ui.namePromptBody);
  refs.totalScore.textContent = `0 / ${content.points.totalMax}`;
  refs.scoreProgress.setAttribute("aria-valuenow", "0");
  refs.scoreProgressFill.style.width = "0%";
  refs.choiceList.replaceChildren();
  refs.feedbackBox.hidden = true;
  refs.toastStack.hidden = true;
}

function renderChoices(stage: StageContent, selectedOptionId: string | null): void {
  refs.choiceList.replaceChildren();

  stage.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = option.text;
    button.disabled = Boolean(selectedOptionId);
    button.dataset.optionId = option.id;

    if (selectedOptionId) {
      if (option.id === stage.correctOptionId) {
        button.classList.add("is-correct");
      } else if (option.id === selectedOptionId) {
        button.classList.add("is-wrong");
      }
    }

    button.addEventListener("click", () => handleChoice(stage, option.id));
    refs.choiceList.append(button);
  });
}

function handleChoice(stage: StageContent, optionId: string): void {
  if (!state || getSelectedOptionId(stage)) {
    return;
  }

  latestAnswer = answerStage(content, state, optionId);
  saveGameState(state);
  renderChoices(stage, optionId);
  renderFeedback(stage, optionId);
  renderScore();
  refs.nextButton.disabled = false;
  refs.nextButton.textContent = latestAnswer.gameCompleted ? content.ui.finishButton : content.ui.nextButton;
  renderToasts(stage, latestAnswer.unlockedMessages);
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
  refs.dayTheme.textContent = "三日主線完成";
  refs.stageTitle.textContent = content.ending.title;
  refs.dayScore.textContent = `${state.dayScores.day3} / ${content.points.dayMax}`;
  refs.sceneVisual.dataset.bg = lastStage.background;
  refs.characterPortrait.src = character.portrait;
  refs.characterPortrait.alt = `${character.displayName} 立繪`;
  refs.speakerName.textContent = character.displayName;
  refs.speakerName.style.background = character.accent;
  renderDialog(`研究完成，${state.playerName}。你的總環保積分是 ${state.totalScore} 分。`);
  refs.situationText.textContent = "三日主線已完成，可送出排行榜。";
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

function renderDialog(text: string): void {
  refs.dialogText.classList.remove("is-finished");
  gsap.killTweensOf(refs.dialogText);
  refs.dialogText.textContent = "";

  const cursor = { index: 0 };
  gsap.to(cursor, {
    index: text.length,
    duration: Math.min(1.2, Math.max(0.35, text.length * 0.025)),
    ease: "none",
    onUpdate: () => {
      refs.dialogText.textContent = text.slice(0, Math.round(cursor.index));
    },
    onComplete: () => refs.dialogText.classList.add("is-finished")
  });
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
