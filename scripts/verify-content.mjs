import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const contentPath = path.join(process.cwd(), "src/data/i18n/zh-TW/game.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const errors = [];

const expectedDays = [
  {
    id: "day1",
    title: "Day 1 小澄線",
    theme: "源頭減量",
    stages: [
      ["1-1", "是否自備水壺"],
      ["1-2", "買瓶裝水或找飲水機"],
      ["1-3", "必要購買時如何選擇"],
      ["1-4", "喝完瓶裝水如何處理"]
    ]
  },
  {
    id: "day2",
    title: "Day 2 可可線",
    theme: "寶特瓶回收",
    stages: [
      ["2-1", "瓶內還有飲料怎麼辦"],
      ["2-2", "是否清潔與壓扁"],
      ["2-3", "是否查詢附近回收站"],
      ["2-4", "高級瓶裝水消費選擇"]
    ]
  },
  {
    id: "day3",
    title: "Day 3 箔音線",
    theme: "複合包材分類",
    stages: [
      ["3-1", "鋁箔包是否能當紙類"],
      ["3-2", "不確定分類時怎麼辦"],
      ["3-3", "查詢高雄回收規則"],
      ["3-4", "有殘液紙盒如何處理"]
    ]
  }
];

assert(content.points.correct === 25, "答對必須得 25 分");
assert(content.points.wrong === 0, "答錯必須得 0 分");
assert(content.points.dayMax === 100, "每日最高分必須為 100");
assert(content.points.totalMax === 300, "三日最高總分必須為 300");
assert(Array.isArray(content.days) && content.days.length === 3, "主線必須有三天");

expectedDays.forEach((expectedDay, dayIndex) => {
  const actualDay = content.days[dayIndex];
  assert(actualDay?.id === expectedDay.id, `第 ${dayIndex + 1} 天順序必須為 ${expectedDay.id}`);
  assert(actualDay?.title === expectedDay.title, `${expectedDay.id} 標題必須為 ${expectedDay.title}`);
  assert(actualDay?.theme === expectedDay.theme, `${expectedDay.id} 主題必須為 ${expectedDay.theme}`);
  assert(Array.isArray(actualDay?.stages) && actualDay.stages.length === 4, `${expectedDay.id} 必須固定 4 關`);

  expectedDay.stages.forEach(([stageId, title], stageIndex) => {
    const actualStage = actualDay?.stages?.[stageIndex];
    assert(actualStage?.id === stageId, `${expectedDay.id} 第 ${stageIndex + 1} 關必須為 ${stageId}`);
    assert(actualStage?.title === title, `${stageId} 標題必須為 ${title}`);
    assert(Array.isArray(actualStage?.options) && actualStage.options.length === 4, `${stageId} 必須有四個選項`);
    assert(
      actualStage?.options?.filter((option) => option.id === actualStage.correctOptionId).length === 1,
      `${stageId} 必須只有一個最佳永續行為選項`
    );
    assert(Boolean(actualStage?.dialogue), `${stageId} 必須有角色對話`);
    assert(Boolean(actualStage?.situation), `${stageId} 必須有情境`);
    assert(Boolean(actualStage?.feedback?.correct), `${stageId} 必須有答對知識回饋`);
    assert(Boolean(actualStage?.feedback?.wrong), `${stageId} 必須有答錯知識回饋`);
  });
});

const ivy = content.hiddenBranches.find((branch) => branch.id === "ivy");
assert(ivy?.unlockAfterDay === "day2", "艾薇支線必須在 Day 2 結束後判定");
assert(ivy?.conditions?.[0]?.metric === "dayScore", "艾薇支線必須檢查 Day 1 分數");
assert(ivy?.conditions?.[0]?.dayId === "day1", "艾薇支線必須檢查 Day 1");
assert(ivy?.conditions?.[0]?.operator === "eq", "艾薇支線條件必須為等於");
assert(ivy?.conditions?.[0]?.value === 100, "艾薇支線條件必須為 Day 1 分數等於 100");
assert(ivy?.messages?.includes("你對源頭減量的理解已達成條件。"), "艾薇支線第一句解鎖訊息不符");
assert(ivy?.messages?.includes("隱藏支線：艾薇 已解鎖。"), "艾薇支線第二句解鎖訊息不符");

const shino = content.hiddenBranches.find((branch) => branch.id === "shino");
assert(shino?.unlockAfterDay === "day3", "紙乃支線必須在 Day 3 結束後判定");
assert(shino?.conditions?.[0]?.metric === "dayScoreSum", "紙乃支線必須檢查 Day 1 + Day 2 分數");
assert(shino?.conditions?.[0]?.dayIds?.join(",") === "day1,day2", "紙乃支線必須檢查 Day 1 + Day 2");
assert(shino?.conditions?.[0]?.operator === "gte", "紙乃支線條件必須為大於等於");
assert(shino?.conditions?.[0]?.value === 150, "紙乃支線條件必須為 Day 1 + Day 2 大於等於 150");
assert(shino?.messages?.includes("你已具備進階分類判斷能力。"), "紙乃支線第一句解鎖訊息不符");
assert(shino?.messages?.includes("隱藏支線：紙乃 已解鎖。"), "紙乃支線第二句解鎖訊息不符");

const day24 = content.days[1].stages[3];
assert(day24.foreshadow?.branchId === "ivy", "Day 2-4 必須作為艾薇支線伏筆");

const day34 = content.days[2].stages[3];
assert(day34.foreshadow?.branchId === "shino", "Day 3-4 必須作為紙乃支線伏筆");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("內容驗證通過：三日主線、關卡、計分與隱藏支線符合規格。");

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
