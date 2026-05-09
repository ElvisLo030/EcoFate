import type {
  AnswerResult,
  BranchCondition,
  DayContent,
  DayId,
  GameContent,
  GameState,
  HiddenBranchContent,
  Operator,
  StageContent
} from "./types";

const DAY_IDS: DayId[] = ["day1", "day2"];

export function createInitialState(playerName: string): GameState {
  return {
    playerName,
    currentDayIndex: 0,
    currentStageIndex: 0,
    dayScores: {
      day1: 0,
      day2: 0
    },
    totalScore: 0,
    answeredStageIds: [],
    selectedAnswers: {},
    unlockedBranches: [],
    completedOutros: [],
    completed: false,
    savedAt: Date.now()
  };
}

export function getCurrentDay(content: GameContent, state: GameState): DayContent {
  return content.days[state.currentDayIndex];
}

export function getCurrentStage(content: GameContent, state: GameState): StageContent {
  return getCurrentDay(content, state).stages[state.currentStageIndex];
}

export function answerStage(content: GameContent, state: GameState, optionId: string): AnswerResult {
  if (state.completed) {
    return {
      isCorrect: false,
      earnedPoints: 0,
      dayCompleted: false,
      gameCompleted: true,
      unlockedMessages: []
    };
  }

  const currentDay = getCurrentDay(content, state);
  const currentStage = getCurrentStage(content, state);
  const isCorrect = optionId === currentStage.correctOptionId;
  const earnedPoints = isCorrect ? content.points.correct : content.points.wrong;

  if (!state.answeredStageIds.includes(currentStage.id)) {
    state.dayScores[currentDay.id] += earnedPoints;
    state.totalScore += earnedPoints;
    state.answeredStageIds.push(currentStage.id);
    state.selectedAnswers[currentStage.id] = optionId;
  }

  const wasLastStageOfDay = state.currentStageIndex === currentDay.stages.length - 1;
  const wasLastDay = state.currentDayIndex === content.days.length - 1;
  const unlockedMessages = wasLastStageOfDay ? unlockBranchesAfterDay(content, state, currentDay.id) : [];

  state.savedAt = Date.now();

  return {
    isCorrect,
    earnedPoints,
    dayCompleted: wasLastStageOfDay,
    gameCompleted: wasLastStageOfDay && wasLastDay,
    unlockedMessages
  };
}

export function advanceStage(content: GameContent, state: GameState): void {
  const currentDay = getCurrentDay(content, state);
  const wasLastStageOfDay = state.currentStageIndex === currentDay.stages.length - 1;
  const wasLastDay = state.currentDayIndex === content.days.length - 1;

  if (wasLastStageOfDay && wasLastDay) {
    state.completed = true;
    state.savedAt = Date.now();
    return;
  }

  if (wasLastStageOfDay) {
    state.currentDayIndex += 1;
    state.currentStageIndex = 0;
  } else {
    state.currentStageIndex += 1;
  }

  state.savedAt = Date.now();
}

export function replacePlaceholders(value: string, state: GameState): string {
  return value.replaceAll("{playerName}", state.playerName);
}

export function getDayProgressLabel(content: GameContent, state: GameState): string {
  const day = getCurrentDay(content, state);
  const stage = getCurrentStage(content, state);
  return `${day.title}｜第 ${stage.order} / ${day.stages.length} 關`;
}

export function validateSequentialContent(content: GameContent): string[] {
  const errors: string[] = [];
  const sortedDayIds = [...content.days].sort((a, b) => a.order - b.order).map((day) => day.id);

  DAY_IDS.forEach((expectedDayId, index) => {
    if (sortedDayIds[index] !== expectedDayId) {
      errors.push(`第 ${index + 1} 天應為 ${expectedDayId}，目前為 ${sortedDayIds[index] ?? "缺少"}`);
    }
  });

  content.days.forEach((day) => {
    if (day.stages.length !== 4) {
      errors.push(`${day.title} 必須有 4 個關卡`);
    }

    day.stages.forEach((stage) => {
      if (stage.options.length !== 4) {
        errors.push(`${stage.id} 必須有 4 個選項`);
      }

      const correctCount = stage.options.filter((option) => option.id === stage.correctOptionId).length;
      if (correctCount !== 1) {
        errors.push(`${stage.id} 必須且只能有一個最佳永續行為選項`);
      }
    });
  });

  return errors;
}

function unlockBranchesAfterDay(content: GameContent, state: GameState, dayId: DayId): string[] {
  const messages: string[] = [];
  const branches = content.hiddenBranches.filter((branch) => branch.unlockAfterDay === dayId);

  branches.forEach((branch) => {
    if (!state.unlockedBranches.includes(branch.id) && doesBranchUnlock(branch, state)) {
      state.unlockedBranches.push(branch.id);
      messages.push(...branch.messages);
    }
  });

  return messages;
}

function doesBranchUnlock(branch: HiddenBranchContent, state: GameState): boolean {
  return branch.conditions.every((condition) => evaluateCondition(condition, state));
}

function evaluateCondition(condition: BranchCondition, state: GameState): boolean {
  if (condition.metric === "dayScore") {
    return compare(state.dayScores[condition.dayId], condition.operator, condition.value);
  }

  const scoreSum = condition.dayIds.reduce((sum, dayId) => sum + state.dayScores[dayId], 0);
  return compare(scoreSum, condition.operator, condition.value);
}

function compare(actual: number, operator: Operator, expected: number): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
  }
}
