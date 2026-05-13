import type {
  AnswerResult,
  BranchCondition,
  DayContent,
  DayId,
  GameContent,
  GameState,
  Operator,
  SpRouteId,
  StageContent
} from "./types";

const DAY_IDS: DayId[] = ["day1", "day2", "day3", "day4", "day5"];

export function createInitialState(playerName: string): GameState {
  const now = Date.now();
  return {
    playerName,
    currentDayIndex: 0,
    currentStageIndex: 0,
    dayScores: {
      day1: 0,
      day2: 0,
      day3: 0,
      day4: 0,
      day5: 0,
    },
    spScores: {
      sp1: 0,
      sp2: 0,
    },
    totalScore: 0,
    answeredStageIds: [],
    selectedAnswers: {},
    pendingSpRouteId: null,
    currentSpRouteId: null,
    currentSpStageIndex: 0,
    completedIntros: [],
    completedOutros: [],
    completedSpRouteIntros: [],
    completedSpRoutes: [],
    toBeContinued: false,
    completed: false,
    completedEnding: false,
    completedEpilogue: false,
    startedAt: now,
    completedAt: null,
    savedAt: now
  };
}

export function getCurrentDay(content: GameContent, state: GameState): DayContent {
  return content.days[state.currentDayIndex];
}

export function getCurrentStage(content: GameContent, state: GameState): StageContent {
  return getCurrentDay(content, state).stages[state.currentStageIndex];
}

export function answerStage(
  content: GameContent,
  state: GameState,
  optionId: string
): AnswerResult {
  if (state.completed) {
    return {
      isCorrect: false,
      earnedPoints: 0,
      dayCompleted: false,
      gameCompleted: true,
      unlockedSpRouteId: null
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

  const unlockedSpRouteId = wasLastStageOfDay
    ? evaluateSpRouteAfterDay(content, state, currentDay.id)
    : null;

  state.savedAt = Date.now();

  return {
    isCorrect,
    earnedPoints,
    dayCompleted: wasLastStageOfDay,
    gameCompleted: wasLastStageOfDay && wasLastDay,
    unlockedSpRouteId
  };
}

/** SP 關卡得分：寫入 spScores，不計入 totalScore */
export function answerSpStage(
  content: GameContent,
  state: GameState,
  spId: SpRouteId,
  stageId: string,
  optionId: string,
  correctOptionId: string
): { isCorrect: boolean; earnedPoints: number } {
  const isCorrect = optionId === correctOptionId;
  const earnedPoints = isCorrect ? content.points.correct : content.points.wrong;

  if (!state.answeredStageIds.includes(stageId)) {
    state.spScores[spId] += earnedPoints;
    state.answeredStageIds.push(stageId);
    state.selectedAnswers[stageId] = optionId;
  }

  state.savedAt = Date.now();
  return { isCorrect, earnedPoints };
}

export function advanceStage(content: GameContent, state: GameState): void {
  const currentDay = getCurrentDay(content, state);
  const wasLastStageOfDay = state.currentStageIndex === currentDay.stages.length - 1;
  const wasLastDay = state.currentDayIndex === content.days.length - 1;

  if (wasLastStageOfDay && wasLastDay) {
    state.completed = true;
    state.completedAt = state.completedAt ?? Date.now();
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

/**
 * 驗證遊戲內容：允許部分天數存在（未完待續情況），
 * 但有內容的天必須符合格式。
 */
export function validateSequentialContent(content: GameContent): string[] {
  const errors: string[] = [];

  if (content.days.length === 0) {
    errors.push("遊戲至少需要 1 天的內容");
    return errors;
  }

  content.days.forEach((day, index) => {
    const expectedDayId = DAY_IDS[index];
    if (day.id !== expectedDayId) {
      errors.push(`第 ${index + 1} 天應為 ${expectedDayId}，目前為 ${day.id}`);
    }

    if (day.stages.length === 0) {
      errors.push(`${day.title} 至少需要 1 個關卡`);
    }

    day.stages.forEach((stage) => {
      if (stage.options.length === 0) {
        errors.push(`${stage.id} 至少需要 1 個選項`);
      }

      const correctCount = stage.options.filter(
        (option) => option.id === stage.correctOptionId
      ).length;
      if (correctCount !== 1) {
        errors.push(`${stage.id} 必須且只能有一個正確選項（目前找到 ${correctCount} 個）`);
      }
    });
  });

  return errors;
}

/**
 * 評估結局：依 routeRules.endings 條件依序判斷。
 * 回傳第一個所有條件都成立的結局 id，或 default 結局。
 */
export function evaluateEnding(
  content: GameContent,
  state: GameState
): string {
  const endings = content.routeRules?.endings ?? [];

  for (const rule of endings) {
    if (rule.default) continue;
    if (rule.conditions.every((c) => evaluateCondition(c, state))) {
      return rule.id;
    }
  }

  const defaultEnding = endings.find((r) => r.default);
  return defaultEnding?.id ?? "bad";
}

// ─────────────────────────────────────────
// 內部輔助
// ─────────────────────────────────────────

/**
 * 在天結束後評估是否解鎖 SP 路線。
 * 回傳解鎖的 SpRouteId，或 null。
 */
function evaluateSpRouteAfterDay(
  content: GameContent,
  state: GameState,
  dayId: DayId
): SpRouteId | null {
  if (!content.spRoutes) return null;

  for (const spRoute of content.spRoutes) {
    if (spRoute.unlockAfterDay !== dayId) continue;
    if (state.completedSpRoutes.includes(spRoute.id)) continue;
    if (evaluateCondition(spRoute.unlockCondition, state)) {
      return spRoute.id;
    }
  }

  return null;
}

export function evaluateCondition(
  condition: BranchCondition,
  targetState: GameState
): boolean {
  if (condition.metric === "dayScore") {
    return compare(targetState.dayScores[condition.dayId], condition.operator, condition.value);
  }

  if (condition.metric === "dayScoreSum") {
    const sum = condition.dayIds.reduce(
      (acc, dayId) => acc + (targetState.dayScores[dayId] ?? 0),
      0
    );
    return compare(sum, condition.operator, condition.value);
  }

  if (condition.metric === "spScoreSum") {
    const sum = condition.spIds.reduce(
      (acc, spId) => acc + (targetState.spScores[spId] ?? 0),
      0
    );
    return compare(sum, condition.operator, condition.value);
  }

  return false;
}

function compare(actual: number, operator: Operator, expected: number): boolean {
  switch (operator) {
    case "eq":  return actual === expected;
    case "gt":  return actual > expected;
    case "gte": return actual >= expected;
    case "lt":  return actual < expected;
  }
}
