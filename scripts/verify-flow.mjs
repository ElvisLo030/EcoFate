import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const scriptRoot = path.join(process.cwd(), "src/data/i18n/zh-TW/script");
const errors = [];
const points = { correct: 25, wrong: 0 };
const mainDays = ["day1", "day2", "day3", "day4", "day5"];
const dayDirs = ["D1", "D2", "D3", "D4", "D5"];
const correctAnswers = Object.fromEntries(
  dayDirs.flatMap((dir, dayIndex) =>
    [1, 2, 3, 4].map((stageOrder) => {
      const routeLabel = `${dir}-${stageOrder}`;
      const stageId = `${dayIndex + 1}-${stageOrder}`;
      return [stageId, parseCorrectOption(readScript(`${dir}/${routeLabel}.md`), stageId)];
    })
  )
);
const spCorrectAnswers = Object.fromEntries(
  ["SP1", "SP2"].flatMap((dir) =>
    [1, 2].map((stageOrder) => {
      const stageId = `${dir}-${stageOrder}`;
      return [stageId, parseCorrectOption(readScript(`${dir}/${stageId}.md`), stageId)];
    })
  )
);

const allCorrect = simulate({
  main: correctAnswers,
  sp: spCorrectAnswers,
});
assert(allCorrect.visited.join(">") === "D1>D2>SP1>D3>D4>SP2>D5>True Ending", "全答對流程必須為 D1>D2>SP1>D3>D4>SP2>D5>True Ending");
assert(allCorrect.mainTotal === 500, "全答對主線總分必須為 500");
assert(allCorrect.spTotal === 100, "全答對隱藏分數必須為 100");

const noSp1 = simulate({
  main: {
    ...correctAnswers,
    "2-1": "2-1-A",
    "2-2": "2-2-B",
    "2-3": "2-3-B",
    "2-4": "2-4-A",
  },
  sp: spCorrectAnswers,
});
assert(!noSp1.visited.includes("SP1"), "D2 未達 100 分時不可觸發 SP1");
assert(noSp1.visited.includes("SP2"), "D1+D2+D3+D4 達 200 分時仍須在 D4 後觸發 SP2");
assert(noSp1.mainTotal === 400, "SP 分數不可計入主線總分");

const goodWithoutTrue = simulate({
  main: correctAnswers,
  sp: {
    "SP1-1": "SP1-1-A",
    "SP1-2": "SP1-2-A",
    "SP2-1": "SP2-1-A",
    "SP2-2": "SP2-2-A",
  },
});
assert(goodWithoutTrue.ending === "Good Ending", "主線達 400 但 SP 未達 75 時必須進 Good Ending");
assert(goodWithoutTrue.spTotal === 0, "隱藏劇情答錯不應增加隱藏分數");

const bad = simulate({
  main: Object.fromEntries(Object.keys(correctAnswers).map((stageId) => [stageId, `${stageId}-A`])),
  sp: {},
});
assert(bad.ending === "Bad Ending", "主線未達 400 時必須進 Bad Ending");
assert(bad.mainTotal < 400, "Bad Ending 測試主線分數必須低於 400");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("流程驗證通過：D2 後 SP1、D4 後 SP2、主線/隱藏分數分流與 True/Good/Bad Ending 規則符合 rule.md。");

function simulate(answerPlan) {
  const state = {
    dayScores: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0 },
    spScores: { sp1: 0, sp2: 0 },
  };
  const visited = [];

  for (let i = 0; i < mainDays.length; i++) {
    const dayId = mainDays[i];
    const dir = dayDirs[i];
    visited.push(dir);

    for (let stageOrder = 1; stageOrder <= 4; stageOrder++) {
      const stageId = `${i + 1}-${stageOrder}`;
      if (answerPlan.main[stageId] === correctAnswers[stageId]) {
        state.dayScores[dayId] += points.correct;
      }
    }

    if (dayId === "day2" && state.dayScores.day2 >= 100) {
      visited.push("SP1");
      scoreSpRoute(state, "sp1", "SP1", answerPlan.sp);
    }

    if (dayId === "day4" && sumDays(state, ["day1", "day2", "day3", "day4"]) >= 200) {
      visited.push("SP2");
      scoreSpRoute(state, "sp2", "SP2", answerPlan.sp);
    }
  }

  const mainTotal = sumDays(state, mainDays);
  const spTotal = state.spScores.sp1 + state.spScores.sp2;
  const ending = mainTotal >= 450 && spTotal >= 75
    ? "True Ending"
    : mainTotal >= 400
      ? "Good Ending"
      : "Bad Ending";
  visited.push(ending);

  return { state, visited, mainTotal, spTotal, ending };
}

function scoreSpRoute(state, spId, routeLabel, spPlan) {
  for (let stageOrder = 1; stageOrder <= 2; stageOrder++) {
    const stageId = `${routeLabel}-${stageOrder}`;
    if (spPlan[stageId] === spCorrectAnswers[stageId]) {
      state.spScores[spId] += points.correct;
    }
  }
}

function sumDays(state, dayIds) {
  return dayIds.reduce((sum, dayId) => sum + state.dayScores[dayId], 0);
}

function readScript(relativePath) {
  return fs.readFileSync(path.join(scriptRoot, relativePath), "utf8");
}

function parseCorrectOption(raw, stageId) {
  const rawValue = raw.match(/^正確選項：(.+)$/m)?.[1]?.trim() ?? "";
  const letter = rawValue.split("-").at(-1);
  return /^[A-D]$/.test(letter) ? `${stageId}-${letter}` : `${stageId}-A`;
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
