import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const contentPath = path.join(process.cwd(), "src/data/i18n/zh-TW/game.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const errors = [];

const state = {
  playerName: "測試玩家",
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
  completed: false
};

const visitedStageIds = [];
assert(content.days[0]?.intro?.id === "1-0", "流程必須在 Day 1 主線前定義 D1-0 intro");

while (!state.completed) {
  const day = content.days[state.currentDayIndex];
  const stage = day.stages[state.currentStageIndex];
  visitedStageIds.push(stage.id);
  answerCurrentStage(stage.correctOptionId);
  advance();
}

assert(visitedStageIds.join(",") === "1-1,1-2,1-3,1-4,2-1,2-2,2-3,2-4", "流程必須依 Day 1 → Day 2 且不可跳關");
assert(!visitedStageIds.includes("1-0"), "D1-0 是非計分 intro，不可混入計分 stage 流程");
assert(state.dayScores.day1 === 100, "全答對時 Day 1 必須為 100 分");
assert(state.dayScores.day2 === 100, "全答對時 Day 2 必須為 100 分");
assert(state.totalScore === 200, "全答對時總分必須為 200 分");
assert(resolveEndingId(state) === "good", "D1+D2 大於等於 150 時必須進入 Good Ending");

const routeRules = content.routeRules;
assert(routeRules?.endings?.find((ending) => ending.id === "good")?.condition?.value === 150, "Good Ending 規劃門檻必須為 D1+D2 大於等於 150");
assert(routeRules?.endings?.find((ending) => ending.id === "bad")?.condition?.operator === "lt", "Bad Ending 規劃條件必須為 D1+D2 小於 150");

const badEndingState = createStateWithScores({ day1: 50, day2: 75 });
assert(resolveEndingId(badEndingState) === "bad", "D1+D2 小於 150 時必須進入 Bad Ending");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("流程驗證通過：順序推進、兩日配分與 GE/BE 判定符合規格。");

function answerCurrentStage(optionId) {
  const day = content.days[state.currentDayIndex];
  const stage = day.stages[state.currentStageIndex];
  const isCorrect = optionId === stage.correctOptionId;
  const earnedPoints = isCorrect ? content.points.correct : content.points.wrong;

  state.dayScores[day.id] += earnedPoints;
  state.totalScore += earnedPoints;
  state.answeredStageIds.push(stage.id);
  state.selectedAnswers[stage.id] = optionId;
}

function advance() {
  const day = content.days[state.currentDayIndex];
  const isLastStageOfDay = state.currentStageIndex === day.stages.length - 1;

  if (isLastStageOfDay) {
    unlockAfterDay(day.id);
  }

  if (isLastStageOfDay && state.currentDayIndex === content.days.length - 1) {
    state.completed = true;
    return;
  }

  if (isLastStageOfDay) {
    state.currentDayIndex += 1;
    state.currentStageIndex = 0;
    return;
  }

  state.currentStageIndex += 1;
}

function unlockAfterDay(dayId) {
  content.hiddenBranches
    .filter((branch) => branch.unlockAfterDay === dayId)
    .forEach((branch) => {
      if (doesBranchUnlock(branch, state) && !state.unlockedBranches.includes(branch.id)) {
        state.unlockedBranches.push(branch.id);
      }
    });
}

function doesBranchUnlock(branch, targetState) {
  return branch.conditions.every((condition) => {
    if (condition.metric === "dayScore") {
      return compare(targetState.dayScores[condition.dayId], condition.operator, condition.value);
    }

    const scoreSum = condition.dayIds.reduce((sum, dayId) => sum + targetState.dayScores[dayId], 0);
    return compare(scoreSum, condition.operator, condition.value);
  });
}

function compare(actual, operator, expected) {
  if (operator === "eq") {
    return actual === expected;
  }

  if (operator === "gte") {
    return actual >= expected;
  }

  if (operator === "lt") {
    return actual < expected;
  }

  return false;
}

function resolveEndingId(targetState) {
  return content.routeRules.endings.find((ending) => doesEndingMatch(ending, targetState))?.id;
}

function doesEndingMatch(ending, targetState) {
  return evaluateCondition(ending.condition, targetState);
}

function evaluateCondition(condition, targetState) {
  if (condition.metric === "dayScore") {
    return compare(targetState.dayScores[condition.dayId], condition.operator, condition.value);
  }

  const scoreSum = condition.dayIds.reduce((sum, dayId) => sum + targetState.dayScores[dayId], 0);
  return compare(scoreSum, condition.operator, condition.value);
}

function createStateWithScores(dayScores) {
  return {
    dayScores
  };
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
