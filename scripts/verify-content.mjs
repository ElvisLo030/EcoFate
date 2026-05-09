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
      ["1-3", "真的需要買水時，該怎麼選？"],
      ["1-4", "喝完瓶裝水後怎麼處理？"]
    ]
  },
  {
    id: "day2",
    title: "Day 2 可可線",
    theme: "寶特瓶回收",
    stages: [
      ["2-1", "瓶內還有飲料時怎麼辦？"],
      ["2-2", "是否壓扁、是否簡單清潔？"],
      ["2-3", "要不要查附近回收站？"],
      ["2-4", "販賣機前的高級瓶裝水選擇"]
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

const stage13 = content.days[0].stages[2];
assert(stage13.title === "真的需要買水時，該怎麼選？", "1-3 必須套用新版標題");
assert(stage13.correctOptionId === "1-3-C", "1-3 正解必須為 1-3-C");
assert(stage13.options.map((option) => option.id).join(",") === "1-3-A,1-3-B,1-3-C,1-3-D", "1-3 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage13), "1-3 必須為每個選項提供回覆劇情");
assert(stage13.responseDialogues["1-3-C"].includes("系統提示：Day 1 分數 +25"), "1-3-C 回覆必須包含加分提示");

const stage14 = content.days[0].stages[3];
assert(stage14.title === "喝完瓶裝水後怎麼處理？", "1-4 必須套用新版標題");
assert(stage14.correctOptionId === "1-4-A", "1-4 正解必須為 1-4-A");
assert(stage14.options.map((option) => option.id).join(",") === "1-4-A,1-4-B,1-4-C,1-4-D", "1-4 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage14), "1-4 必須為每個選項提供回覆劇情");
assert(stage14.responseDialogues["1-4-A"].includes("系統提示：Day 1 分數 +25"), "1-4-A 回覆必須包含加分提示");

const day1Outro = content.days[0].outro;
const day1OutroA = day1Outro?.branches?.find((branch) => branch.id === "1-ED-A");
const day1OutroB = day1Outro?.branches?.find((branch) => branch.id === "1-ED-B");
assert(day1Outro?.id === "1-ED", "Day 1 必須有 1-ED 日結 outro");
assert(day1Outro?.title === "第一天結束", "1-ED 標題必須為第一天結束");
assert(day1Outro?.speaker === "kosumi", "1-ED 必須由小澄承接日結");
assert(day1OutroA?.condition?.metric === "dayScore", "1-ED-A 必須檢查 Day 1 分數");
assert(day1OutroA?.condition?.dayId === "day1", "1-ED-A 必須檢查 day1");
assert(day1OutroA?.condition?.operator === "gt", "1-ED-A 必須在 Day 1 分數大於 50 時觸發");
assert(day1OutroA?.condition?.value === 50, "1-ED-A 門檻必須為 50");
assert(day1OutroA?.dialogue?.includes("{playerName}"), "1-ED-A 日結必須使用 {playerName}");
assert(day1OutroB?.default === true, "1-ED-B 必須作為 Day 1 日結 fallback");
assert(day1OutroB?.dialogue?.includes("地球不是替你收拾殘局的道具"), "1-ED-B 必須使用已確認文本");

const day2Intro = content.days[1].intro;
assert(day2Intro?.id === "2-0", "Day 2 必須有 2-0 開場 intro");
assert(day2Intro?.speaker === "coco", "D2-0 必須由可可承接");
assert(day2Intro?.dialogue?.includes("喂，{playerName}！"), "D2-0 必須使用文檔開場文本");

const stage21 = content.days[1].stages[0];
assert(stage21.correctOptionId === "2-1-C", "2-1 正解必須為 2-1-C");
assert(stage21.options.map((option) => option.id).join(",") === "2-1-A,2-1-B,2-1-C,2-1-D", "2-1 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage21), "2-1 必須為每個選項提供回覆劇情");
assert(stage21.responseDialogues["2-1-B"].includes("系統提示：Day 2 分數 +0"), "2-1-B 必須套用確認後的錯誤回覆");

const stage22 = content.days[1].stages[1];
assert(stage22.correctOptionId === "2-2-A", "2-2 正解必須為 2-2-A");
assert(stage22.options.map((option) => option.id).join(",") === "2-2-A,2-2-B,2-2-C,2-2-D", "2-2 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage22), "2-2 必須為每個選項提供回覆劇情");

const stage23 = content.days[1].stages[2];
assert(stage23.correctOptionId === "2-3-A", "2-3 正解必須為 2-3-A");
assert(stage23.options.map((option) => option.id).join(",") === "2-3-A,2-3-B,2-3-C,2-3-D", "2-3 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage23), "2-3 必須為每個選項提供回覆劇情");

const stage24 = content.days[1].stages[3];
assert(stage24.correctOptionId === "2-4-B", "2-4 正解必須為 2-4-B");
assert(stage24.options.map((option) => option.id).join(",") === "2-4-A,2-4-B,2-4-C,2-4-D", "2-4 選項 id 必須符合劇情文件");
assert(hasResponsesForEveryOption(stage24), "2-4 必須為每個選項提供回覆劇情");

const day2Outro = content.days[1].outro;
const day2OutroA = day2Outro?.branches?.find((branch) => branch.id === "2-ED-A");
const day2OutroB = day2Outro?.branches?.find((branch) => branch.id === "2-ED-B");
assert(day2Outro?.id === "2-ED", "Day 2 必須有 2-ED 日結 outro");
assert(day2OutroA?.condition?.metric === "dayScore", "2-ED-A 必須檢查 Day 2 分數");
assert(day2OutroA?.condition?.dayId === "day2", "2-ED-A 必須檢查 day2");
assert(day2OutroA?.condition?.operator === "gt", "2-ED-A 必須在 Day 2 分數大於 50 時觸發");
assert(day2OutroA?.condition?.value === 50, "2-ED-A 門檻必須為 50");
assert(day2OutroB?.default === true, "2-ED-B 必須作為 Day 2 日結 fallback");

const h2 = content.hiddenRoutes?.find((route) => route.id === "h2");
assert(h2?.unlockAfterDay === "day2", "H2 必須在 Day 2 後判斷解鎖");
assert(h2?.unlockCondition?.metric === "dayScoreSum", "H2 必須使用 D1+D2 加總判斷");
assert(h2?.unlockCondition?.dayIds?.join(",") === "day1,day2", "H2 必須檢查 Day 1 + Day 2");
assert(h2?.unlockCondition?.operator === "gte", "H2 必須在 D1+D2 大於等於門檻時觸發");
assert(h2?.unlockCondition?.value === 150, "H2 解鎖門檻必須為 D1+D2 大於等於 150");
assert(h2?.unlockScene?.dialogue?.includes("隱藏支線：艾薇 已解鎖"), "H2 必須有解鎖展示劇情");
assert(h2?.intro?.id === "H2-0", "H2 必須有 H2-0 開場");
assert(Array.isArray(h2?.stages) && h2.stages.length === 2, "H2 必須有兩個支線關卡");
assert(h2?.stages?.[0]?.correctOptionId === "H2-1-B", "H2-1 正解必須為 H2-1-B");
assert(h2?.stages?.[1]?.correctOptionId === "H2-2-B", "H2-2 正解必須為 H2-2-B");
assert(h2?.stages?.every(hasResponsesForEveryOption), "H2 每個選項都必須提供回覆劇情");
assert(h2?.outro?.id === "H2-ED", "H2 必須有 H2-ED 支線結尾");
assert(content.toBeContinued?.id === "TBC-D3", "H2 或 Day 2 後必須停在 D3 待續畫面");

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

console.log("內容驗證通過：D1/D2 主線、H2 隱藏支線、日結與待續資料符合規格。");

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function hasResponsesForEveryOption(stage) {
  return stage.options.every((option) => Boolean(stage.responseDialogues?.[option.id]));
}
