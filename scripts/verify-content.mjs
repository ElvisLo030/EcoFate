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
      ["1-1", "今天有帶水壺嗎？"],
      ["1-2", "買水還是找飲水機？"],
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
  }
];

assert(content.points.correct === 25, "答對必須得 25 分");
assert(content.points.wrong === 0, "答錯必須得 0 分");
assert(content.points.dayMax === 100, "每日最高分必須為 100");
assert(content.points.totalMax === 200, "兩日最高總分必須為 200");
assert(Array.isArray(content.days) && content.days.length === 2, "主線必須有兩天");

const day1Intro = content.days?.[0]?.intro;
assert(day1Intro?.id === "1-0", "Day 1 必須有 1-0 開場 intro");
assert(day1Intro?.title === "開場", "D1-0 標題必須為開場");
assert(day1Intro?.speaker === "kosumi", "D1-0 必須由小澄承接名稱輸入");
assert(Boolean(day1Intro?.beforeNameDialogue), "D1-0 必須有名稱輸入前對話");
assert(day1Intro?.namePrompt?.placeholder === "請輸入你的暱稱", "D1-0 暱稱輸入 placeholder 不符");
assert(day1Intro?.namePrompt?.submitButton === "告訴小澄", "D1-0 暱稱送出按鈕文字不符");
assert(Boolean(day1Intro?.afterNameDialogue), "D1-0 必須有名稱輸入後對話");
assert(day1Intro?.afterNameDialogue?.includes("{playerName}"), "D1-0 名稱輸入後對話必須使用 {playerName}");

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

const stage11 = content.days[0].stages[0];
assert(stage11.title === "今天有帶水壺嗎？", "1-1 必須套用新版標題");
assert(stage11.correctOptionId === "1-1-B", "1-1 正解必須為 1-1-B");
assert(stage11.options.map((option) => option.id).join(",") === "1-1-A,1-1-B,1-1-C,1-1-D", "1-1 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage11), "1-1 必須為每個選項提供回覆劇情");
assert(stage11.responseDialogues["1-1-B"].includes("系統提示：Day 1 分數 +25"), "1-1-B 回覆必須包含加分提示");

const stage12 = content.days[0].stages[1];
assert(stage12.title === "買水還是找飲水機？", "1-2 必須套用新版標題");
assert(stage12.correctOptionId === "1-2-A", "1-2 正解必須為 1-2-A");
assert(stage12.options.map((option) => option.id).join(",") === "1-2-A,1-2-B,1-2-C,1-2-D", "1-2 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage12), "1-2 必須為每個選項提供回覆劇情");
assert(stage12.responseDialogues["1-2-A"].includes("系統提示：Day 1 分數 +25"), "1-2-A 回覆必須包含加分提示");

const goodEnding = content.routeRules?.endings?.find((ending) => ending.id === "good");
assert(goodEnding?.condition?.metric === "dayScoreSum", "Good Ending 必須檢查 D1+D2");
assert(goodEnding?.condition?.dayIds?.join(",") === "day1,day2", "Good Ending 必須檢查 Day 1 + Day 2");
assert(goodEnding?.condition?.operator === "gte", "Good Ending 條件必須為大於等於");
assert(goodEnding?.condition?.value === 150, "Good Ending 必須在 D1+D2 大於等於 150 時觸發");

const badEnding = content.routeRules?.endings?.find((ending) => ending.id === "bad");
assert(badEnding?.condition?.metric === "dayScoreSum", "Bad Ending 必須檢查 D1+D2");
assert(badEnding?.condition?.dayIds?.join(",") === "day1,day2", "Bad Ending 必須檢查 Day 1 + Day 2");
assert(badEnding?.condition?.operator === "lt", "Bad Ending 條件必須為小於");
assert(badEnding?.condition?.value === 150, "Bad Ending 必須在 D1+D2 小於 150 時觸發");
assert(Boolean(content.ending?.results?.good?.summary), "Good Ending 必須有 i18n 結果摘要");
assert(Boolean(content.ending?.results?.bad?.summary), "Bad Ending 必須有 i18n 結果摘要");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("內容驗證通過：兩日主線、D1 劇情回覆、計分與 GE/BE 規則符合規格。");

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function hasResponsesForEveryOption(stage) {
  return stage.options.every((option) => Boolean(stage.responseDialogues?.[option.id]));
}
