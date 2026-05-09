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
    day2: 0,
    day3: 0
  },
  totalScore: 0,
  answeredStageIds: [],
  selectedAnswers: {},
  unlockedBranches: [],
  completed: false
};

const visitedStageIds = [];

while (!state.completed) {
  const day = content.days[state.currentDayIndex];
  const stage = day.stages[state.currentStageIndex];
  visitedStageIds.push(stage.id);
  answerCurrentStage(stage.correctOptionId);
  advance();
}

assert(visitedStageIds.join(",") === "1-1,1-2,1-3,1-4,2-1,2-2,2-3,2-4,3-1,3-2,3-3,3-4", "流程必須依 Day 1 → Day 2 → Day 3 且不可跳關");
assert(state.dayScores.day1 === 100, "全答對時 Day 1 必須為 100 分");
assert(state.dayScores.day2 === 100, "全答對時 Day 2 必須為 100 分");
assert(state.dayScores.day3 === 100, "全答對時 Day 3 必須為 100 分");
assert(state.totalScore === 300, "全答對時總分必須為 300 分");
assert(state.unlockedBranches.includes("ivy"), "Day 1 等於 100 時，Day 2 結束後必須解鎖艾薇");
assert(state.unlockedBranches.includes("shino"), "Day 1 + Day 2 大於等於 150 時，Day 3 結束後必須解鎖紙乃");

const noIvyState = createStateWithScores({ day1: 75, day2: 100, day3: 0 });
assert(!doesBranchUnlock(content.hiddenBranches.find((branch) => branch.id === "ivy"), noIvyState), "Day 1 不等於 100 時不可解鎖艾薇");

const shinoThresholdState = createStateWithScores({ day1: 75, day2: 75, day3: 0 });
assert(doesBranchUnlock(content.hiddenBranches.find((branch) => branch.id === "shino"), shinoThresholdState), "Day 1 + Day 2 等於 150 時必須解鎖紙乃");

const noShinoState = createStateWithScores({ day1: 50, day2: 75, day3: 0 });
assert(!doesBranchUnlock(content.hiddenBranches.find((branch) => branch.id === "shino"), noShinoState), "Day 1 + Day 2 小於 150 時不可解鎖紙乃");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("流程驗證通過：順序推進、三日配分與隱藏支線判定符合規格。");

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

  return false;
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
