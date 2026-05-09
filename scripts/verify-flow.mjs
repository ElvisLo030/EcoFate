import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const contentPath = path.join(process.cwd(), "src/data/i18n/zh-TW/game.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const errors = [];

const allCorrectRun = simulate({
  day1: ["1-1-B", "1-2-A", "1-3-C", "1-4-A"],
  day2: ["2-1-C", "2-2-A", "2-3-A", "2-4-B"],
  h2: ["H2-1-B", "H2-2-B"]
});

assert(
  allCorrectRun.visitedNodes.join(",") === "1-1,1-2,1-3,1-4,1-ED-A,2-0,2-1,2-2,2-3,2-4,2-ED-A,H2-unlock,H2-0,H2-1,H2-2,H2-ED,TBC-D3",
  "D1+D2 大於等於 150 時必須在 2-ED 後播放 H2 解鎖與 H2 支線，最後停在 D3 待續"
);
assert(allCorrectRun.state.dayScores.day1 === 100, "全答對時 Day 1 必須為 100 分");
assert(allCorrectRun.state.dayScores.day2 === 100, "全答對時 Day 2 必須為 100 分");
assert(allCorrectRun.state.totalScore === 200, "目前兩日主線全答對總分必須為 200 分");
assert(allCorrectRun.state.branchScores.h2 === 50, "全答對觸發 H2 後支線分數必須為 50");
assert(allCorrectRun.state.toBeContinued === true, "D2 後必須停在待續狀態");

const noH2Run = simulate({
  day1: ["1-1-B", "1-2-A", "1-3-C", "1-4-A"],
  day2: ["2-1-A", "2-2-B", "2-3-B", "2-4-A"],
  h2: []
});

assert(
  noH2Run.visitedNodes.join(",") === "1-1,1-2,1-3,1-4,1-ED-A,2-0,2-1,2-2,2-3,2-4,2-ED-B,TBC-D3",
  "D1+D2 小於 150 時不可觸發 H2，必須直接停在 D3 待續"
);
assert(noH2Run.state.dayScores.day1 === 100, "未觸發 H2 測試 Day 1 必須為 100 分");
assert(noH2Run.state.dayScores.day2 === 0, "未觸發 H2 測試 Day 2 必須為 0 分");
assert(noH2Run.state.totalScore === 100, "未觸發 H2 測試主線總分必須為 100");
assert(noH2Run.state.branchScores.h2 === 0, "未觸發 H2 時支線分數必須為 0");
assert(allCorrectRun.state.completedHiddenRoutes.includes("h2"), "H2 完成後必須記錄 completedHiddenRoutes");

const routeRules = content.routeRules;
assert(routeRules?.endings?.find((ending) => ending.id === "good")?.condition?.value === 150, "暫存 GE 門檻仍為 D1+D2 大於等於 150");
assert(routeRules?.endings?.find((ending) => ending.id === "bad")?.condition?.operator === "lt", "暫存 BE 條件仍為 D1+D2 小於 150");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("流程驗證通過：D2 日結、H2 解鎖支線、支線分數與 D3 待續狀態符合規格。");

function simulate(answerPlan) {
  const state = {
    playerName: "測試玩家",
    currentDayIndex: 0,
    currentStageIndex: 0,
    dayScores: {
      day1: 0,
      day2: 0
    },
    branchScores: {
      h2: 0
    },
    totalScore: 0,
    answeredStageIds: [],
    selectedAnswers: {},
    unlockedBranches: [],
    pendingHiddenRouteId: null,
    currentHiddenRouteId: null,
    currentHiddenStageIndex: 0,
    completedIntros: [],
    completedOutros: [],
    completedHiddenRouteIntros: [],
    completedHiddenRoutes: [],
    toBeContinued: false,
    completed: false
  };
  const visitedNodes = [];

  while (!state.toBeContinued && !state.completed) {
    if (state.pendingHiddenRouteId) {
      const route = getHiddenRoute(state.pendingHiddenRouteId);
      visitedNodes.push(route.unlockScene.id);
      state.currentHiddenRouteId = state.pendingHiddenRouteId;
      state.pendingHiddenRouteId = null;
      continue;
    }

    if (state.currentHiddenRouteId) {
      advanceHiddenRoute(state, answerPlan, visitedNodes);
      continue;
    }

    const day = content.days[state.currentDayIndex];
    if (day.intro?.dialogue && !state.completedIntros.includes(day.id)) {
      visitedNodes.push(day.intro.id);
      state.completedIntros.push(day.id);
      continue;
    }

    const stage = day.stages[state.currentStageIndex];
    visitedNodes.push(stage.id);
    answerMainStage(state, day, stage, nextAnswer(answerPlan[day.id], state.currentStageIndex));

    const isLastStageOfDay = state.currentStageIndex === day.stages.length - 1;
    if (isLastStageOfDay && day.outro && !state.completedOutros.includes(day.id)) {
      visitedNodes.push(resolveDayOutroId(day, state));
      state.completedOutros.push(day.id);
      const route = getUnlockedRouteAfterDay(day.id, state);
      if (route) {
        state.pendingHiddenRouteId = route.id;
        continue;
      }
      if (state.currentDayIndex === content.days.length - 1) {
        state.toBeContinued = true;
        visitedNodes.push(content.toBeContinued.id);
        continue;
      }
    }

    if (isLastStageOfDay) {
      state.currentDayIndex += 1;
      state.currentStageIndex = 0;
    } else {
      state.currentStageIndex += 1;
    }
  }

  return { state, visitedNodes };
}

function answerMainStage(state, day, stage, optionId) {
  const earnedPoints = optionId === stage.correctOptionId ? content.points.correct : content.points.wrong;
  state.dayScores[day.id] += earnedPoints;
  state.totalScore += earnedPoints;
  state.answeredStageIds.push(stage.id);
  state.selectedAnswers[stage.id] = optionId;
}

function advanceHiddenRoute(state, answerPlan, visitedNodes) {
  const route = getHiddenRoute(state.currentHiddenRouteId);

  if (!state.completedHiddenRouteIntros.includes(route.id)) {
    visitedNodes.push(route.intro.id);
    state.completedHiddenRouteIntros.push(route.id);
    return;
  }

  if (state.currentHiddenStageIndex >= route.stages.length) {
    visitedNodes.push(route.outro.id);
    state.completedHiddenRoutes.push(route.id);
    state.currentHiddenRouteId = null;
    state.currentHiddenStageIndex = 0;
    state.toBeContinued = true;
    visitedNodes.push(content.toBeContinued.id);
    return;
  }

  const stage = route.stages[state.currentHiddenStageIndex];
  visitedNodes.push(stage.id);
  const optionId = nextAnswer(answerPlan[route.id], state.currentHiddenStageIndex);
  const earnedPoints = optionId === stage.correctOptionId ? content.points.correct : content.points.wrong;
  state.branchScores[route.id] += earnedPoints;
  state.answeredStageIds.push(stage.id);
  state.selectedAnswers[stage.id] = optionId;
  state.currentHiddenStageIndex += 1;
}

function resolveDayOutroId(day, state) {
  const matched = day.outro.branches.find((branch) => branch.condition && evaluateCondition(branch.condition, state));
  const fallback = day.outro.branches.find((branch) => branch.default);
  return matched?.id ?? fallback?.id;
}

function getUnlockedRouteAfterDay(dayId, state) {
  return content.hiddenRoutes?.find((route) =>
    route.unlockAfterDay === dayId &&
    !state.completedHiddenRoutes.includes(route.id) &&
    evaluateCondition(route.unlockCondition, state)
  );
}

function getHiddenRoute(routeId) {
  return content.hiddenRoutes.find((route) => route.id === routeId);
}

function evaluateCondition(condition, state) {
  if (condition.metric === "dayScore") {
    return compare(state.dayScores[condition.dayId], condition.operator, condition.value);
  }

  const scoreSum = condition.dayIds.reduce((sum, dayId) => sum + state.dayScores[dayId], 0);
  return compare(scoreSum, condition.operator, condition.value);
}

function compare(actual, operator, expected) {
  if (operator === "eq") return actual === expected;
  if (operator === "gt") return actual > expected;
  if (operator === "gte") return actual >= expected;
  if (operator === "lt") return actual < expected;
  return false;
}

function nextAnswer(answers, index) {
  return answers[index];
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
